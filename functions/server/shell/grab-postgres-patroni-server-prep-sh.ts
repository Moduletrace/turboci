import type { ParsedDeploymentServiceConfig, TCIGlobalConfig } from "@/types";
import bunGrabPrivateIPsBulkScripts from "@/utils/bun-scripts/bun-grab-private-ips-bulk-scripts";
import grabPrivateIPsBulkScripts from "@/utils/ssh/shell-scripts/grab-private-ips-bulk-scripts";
import grabDefaultServicePrepSH from "./grab-default-service-prep-sh";

type Params = {
    private_server_ips: string[];
    service: ParsedDeploymentServiceConfig;
    deployment: TCIGlobalConfig;
    bun?: boolean;
};

/**
 * Generates the shell script that runs on every PostgreSQL node during
 * the prepare phase:
 *
 * 1. Installs postgresql, postgresql-contrib, etcd, and patroni (all
 *    idempotent — skipped if already present).
 * 2. Writes /etc/default/etcd — etcd peer/client URLs derived from the
 *    node's private IP at runtime. ETCD_INITIAL_CLUSTER_STATE is set to
 *    "existing" if the data dir already exists (restart-safe).
 * 3. Writes /etc/patroni.yml — scope, etcd3 endpoints, bootstrap DCS
 *    config, and postgresql auth/pg_hba. All postgresql.conf tuning is
 *    delegated to Patroni (no direct postgresql.conf edits needed).
 * 4. Writes systemd units for etcd and patroni.
 * 5. Writes /usr/local/bin/tci-postgres-start.sh — starts etcd, waits
 *    for quorum, then starts patroni. Idempotent (restarts if already
 *    running).
 * 6. Writes /usr/local/bin/tci-postgres-init.sql + tci-postgres-init.sh
 *    — idempotent SQL (users, databases, privileges) executed only on
 *    whichever node Patroni has elected as leader, detected via the
 *    Patroni REST API (/patroni endpoint).
 *
 * Automatic failover: Patroni handles primary election and standby
 * promotion via etcd consensus. HAProxy should use the Patroni REST API
 * health endpoints (/primary → 200 on leader only) rather than the raw
 * pgsql check, so write traffic is always routed to the current leader.
 *
 * The script runs SEQUENTIALLY across nodes so etcd quorum forms before
 * any Patroni instance tries to bootstrap.
 */
export default async function grabPostgresPatroniServerPrepSH({
    private_server_ips,
    service,
    deployment,
    bun,
}: Params) {
    const pgConfig = service.postgres;
    const port = pgConfig?.port ?? 5432;
    const maxConnections = pgConfig?.max_connections ?? 100;
    const sharedBuffers = pgConfig?.shared_buffers ?? "128MB";
    const rootPassword = pgConfig?.root_password ?? "";
    const replication = pgConfig?.replication;

    const allIPs = private_server_ips.map((ip) => ip.replace(/"/g, ""));
    const defaultPrepCmd = await grabDefaultServicePrepSH({
        service,
        deployment,
    });

    let finalCmd = defaultPrepCmd;

    // -------------------------------------------------------------------------
    // IDEMPOTENT INSTALLATION
    // -------------------------------------------------------------------------
    finalCmd += `echo "--- TurboCI: Checking/Installing PostgreSQL, etcd, Patroni ---"\n`;
    finalCmd += `export DEBIAN_FRONTEND=noninteractive\n\n`;

    finalCmd += `command -v psql >/dev/null 2>&1 || (\n`;
    finalCmd += `    apt-get update -qq\n`;
    finalCmd += `    apt-get install -y postgresql postgresql-contrib\n`;
    finalCmd += `)\n\n`;

    finalCmd += `command -v etcd >/dev/null 2>&1 || (\n`;
    finalCmd += `    apt-get update -qq\n`;
    finalCmd += `    apt-get install -y etcd-server etcd-client\n`;
    finalCmd += `)\n\n`;

    finalCmd += `command -v patroni >/dev/null 2>&1 || (\n`;
    finalCmd += `    apt-get install -y python3-pip python3-psycopg2\n`;
    finalCmd += `    pip3 install patroni[etcd3] --break-system-packages\n`;
    finalCmd += `)\n\n`;

    // Stop and disable the stock postgresql systemd unit — Patroni owns the
    // process from here on.
    finalCmd += `systemctl stop postgresql 2>/dev/null || true\n`;
    finalCmd += `systemctl disable postgresql 2>/dev/null || true\n\n`;

    finalCmd += `PG_VERSION=$(pg_lsclusters -h 2>/dev/null | awk '{print $1}' | head -1)\n`;
    finalCmd += `PG_DATA_DIR="/var/lib/postgresql/$PG_VERSION/main"\n`;
    finalCmd += `PG_BIN_DIR="/usr/lib/postgresql/$PG_VERSION/bin"\n\n`;

    // -------------------------------------------------------------------------
    // ETCD CONFIG
    // -------------------------------------------------------------------------
    const etcdInitialCluster = allIPs
        .map((ip, i) => `node${i}=http://${ip}:2380`)
        .join(",");

    finalCmd += `echo "--- TurboCI: Writing etcd config ---"\n`;

    // Detect whether this is a first-boot or a restart. On restart the member
    // data dir already exists, so INITIAL_CLUSTER_STATE must be "existing".
    finalCmd += `if [ -d /var/lib/etcd/member ]; then\n`;
    finalCmd += `    ETCD_CLUSTER_STATE=existing\n`;
    finalCmd += `else\n`;
    finalCmd += `    ETCD_CLUSTER_STATE=new\n`;
    finalCmd += `fi\n\n`;

    finalCmd += `MY_IP=$(hostname -I | awk '{print $1}')\n\n`;

    // Derive the node name from the IP index so every node gets a stable,
    // deterministic name (node0, node1, node2) regardless of hostname.
    allIPs.forEach((ip, i) => {
        finalCmd += `[ "$MY_IP" = "${ip}" ] && ETCD_NODE_NAME=node${i}\n`;
    });
    finalCmd += `\n`;

    finalCmd += `cat > /etc/default/etcd << ETCDEOF\n`;
    finalCmd += `ETCD_NAME=$\\\{ETCD_NODE_NAME}\n`;
    finalCmd += `ETCD_DATA_DIR=/var/lib/etcd\n`;
    finalCmd += `ETCD_LISTEN_CLIENT_URLS=http://0.0.0.0:2379\n`;
    finalCmd += `ETCD_ADVERTISE_CLIENT_URLS=http://$\\\{MY_IP}:2379\n`;
    finalCmd += `ETCD_LISTEN_PEER_URLS=http://0.0.0.0:2380\n`;
    finalCmd += `ETCD_INITIAL_ADVERTISE_PEER_URLS=http://$\\\{MY_IP}:2380\n`;
    finalCmd += `ETCD_INITIAL_CLUSTER=${etcdInitialCluster}\n`;
    finalCmd += `ETCD_INITIAL_CLUSTER_STATE=$\\\{ETCD_CLUSTER_STATE}\n`;
    finalCmd += `ETCD_INITIAL_CLUSTER_TOKEN=turboci-pg-etcd\n`;
    finalCmd += `ETCDEOF\n\n`;

    // -------------------------------------------------------------------------
    // PATRONI CONFIG
    // -------------------------------------------------------------------------
    const etcdHosts = allIPs.map((ip) => `${ip}:2379`).join(",");
    const maxReplicationSlots = allIPs.length + 2;

    finalCmd += `echo "--- TurboCI: Writing Patroni config ---"\n`;

    // patroni.yml uses shell variables that must expand at write-time (MY_IP,
    // PG_DATA_DIR, PG_BIN_DIR) — use a non-quoted heredoc delimiter so the
    // shell interpolates them. Literal dollar signs inside the yaml that must
    // NOT expand are escaped with a backslash.
    finalCmd += `cat > /etc/patroni.yml << PATRONIEOF\n`;
    finalCmd += `scope: turboci-pg-cluster\n`;
    finalCmd += `namespace: /service/\n`;
    finalCmd += `name: $\\\{ETCD_NODE_NAME}\n\n`;

    finalCmd += `etcd3:\n`;
    finalCmd += `  hosts: ${etcdHosts}\n\n`;

    finalCmd += `restapi:\n`;
    finalCmd += `  listen: 0.0.0.0:8008\n`;
    finalCmd += `  connect_address: $\\\{MY_IP}:8008\n\n`;

    finalCmd += `bootstrap:\n`;
    finalCmd += `  dcs:\n`;
    finalCmd += `    ttl: 30\n`;
    finalCmd += `    loop_wait: 10\n`;
    finalCmd += `    retry_timeout: 10\n`;
    finalCmd += `    maximum_lag_on_failover: 1048576\n`;
    finalCmd += `    postgresql:\n`;
    finalCmd += `      use_pg_rewind: true\n`;
    finalCmd += `      use_slots: true\n`;
    finalCmd += `      parameters:\n`;
    finalCmd += `        wal_level: replica\n`;
    finalCmd += `        hot_standby: "on"\n`;
    finalCmd += `        max_wal_senders: ${replication?.max_wal_senders ?? 5}\n`;
    finalCmd += `        max_replication_slots: ${maxReplicationSlots}\n`;
    finalCmd += `        shared_buffers: ${sharedBuffers}\n`;
    finalCmd += `        max_connections: ${maxConnections}\n`;
    finalCmd += `  initdb:\n`;
    finalCmd += `    - encoding: UTF8\n`;
    finalCmd += `    - data-checksums\n\n`;

    finalCmd += `postgresql:\n`;
    finalCmd += `  listen: 0.0.0.0:${port}\n`;
    finalCmd += `  connect_address: $\\\{MY_IP}:${port}\n`;
    finalCmd += `  data_dir: $\\\{PG_DATA_DIR}\n`;
    finalCmd += `  bin_dir: $\\\{PG_BIN_DIR}\n`;
    finalCmd += `  authentication:\n`;
    finalCmd += `    superuser:\n`;
    finalCmd += `      username: postgres\n`;
    finalCmd += `      password: '${rootPassword}'\n`;

    if (replication?.enabled && replication.user && replication.password) {
        finalCmd += `    replication:\n`;
        finalCmd += `      username: ${replication.user}\n`;
        finalCmd += `      password: '${replication.password}'\n`;
    }

    finalCmd += `  pg_hba:\n`;
    finalCmd += `    - host all all 0.0.0.0/0 md5\n`;
    if (replication?.enabled && replication.user) {
        finalCmd += `    - host replication ${replication.user} 0.0.0.0/0 md5\n`;
    }
    finalCmd += `PATRONIEOF\n\n`;

    // -------------------------------------------------------------------------
    // SYSTEMD UNITS
    // -------------------------------------------------------------------------
    finalCmd += `echo "--- TurboCI: Writing systemd units ---"\n`;

    finalCmd += `cat > /etc/systemd/system/etcd.service << 'ETCDSVCEOF'\n`;
    finalCmd += `[Unit]\n`;
    finalCmd += `Description=etcd key-value store\n`;
    finalCmd += `After=network.target\n\n`;
    finalCmd += `[Service]\n`;
    finalCmd += `Type=notify\n`;
    finalCmd += `EnvironmentFile=/etc/default/etcd\n`;
    finalCmd += `ExecStart=/usr/bin/etcd\n`;
    finalCmd += `Restart=always\n`;
    finalCmd += `RestartSec=5\n`;
    finalCmd += `LimitNOFILE=65536\n\n`;
    finalCmd += `[Install]\n`;
    finalCmd += `WantedBy=multi-user.target\n`;
    finalCmd += `ETCDSVCEOF\n\n`;

    finalCmd += `cat > /etc/systemd/system/patroni.service << 'PATRONISVCEOF'\n`;
    finalCmd += `[Unit]\n`;
    finalCmd += `Description=Patroni PostgreSQL HA\n`;
    finalCmd += `After=network.target etcd.service\n`;
    finalCmd += `Requires=etcd.service\n\n`;
    finalCmd += `[Service]\n`;
    finalCmd += `User=postgres\n`;
    finalCmd += `Group=postgres\n`;
    finalCmd += `Type=simple\n`;
    finalCmd += `ExecStart=/usr/local/bin/patroni /etc/patroni.yml\n`;
    finalCmd += `Restart=always\n`;
    finalCmd += `RestartSec=5\n`;
    finalCmd += `LimitNOFILE=65536\n\n`;
    finalCmd += `[Install]\n`;
    finalCmd += `WantedBy=multi-user.target\n`;
    finalCmd += `PATRONISVCEOF\n\n`;

    finalCmd += `systemctl daemon-reload\n\n`;

    // -------------------------------------------------------------------------
    // START SCRIPT
    // -------------------------------------------------------------------------
    finalCmd += `echo "--- TurboCI: Writing tci-postgres-start.sh ---"\n`;
    finalCmd += `cat > /usr/local/bin/tci-postgres-start.sh << 'STARTEOF'\n`;
    finalCmd += `#!/bin/bash\n`;
    finalCmd += `set -e\n\n`;

    finalCmd += `PG_VERSION=$(pg_lsclusters -h 2>/dev/null | awk '{print $1}' | head -1)\n`;
    finalCmd += `PG_DATA_DIR="/var/lib/postgresql/$PG_VERSION/main"\n`;
    finalCmd += `PG_BIN_DIR="/usr/lib/postgresql/$PG_VERSION/bin"\n\n`;

    // etcd
    finalCmd += `if systemctl is-active --quiet etcd; then\n`;
    finalCmd += `    echo "TurboCI: etcd already running, restarting..."\n`;
    finalCmd += `    systemctl restart etcd\n`;
    finalCmd += `else\n`;
    finalCmd += `    echo "TurboCI: Starting etcd..."\n`;
    finalCmd += `    systemctl enable etcd\n`;
    finalCmd += `    systemctl start etcd\n`;
    finalCmd += `fi\n\n`;

    // Wait for etcd quorum before Patroni tries to register
    finalCmd += `echo "TurboCI: Waiting for etcd quorum..."\n`;
    finalCmd += `for i in $(seq 1 20); do\n`;
    finalCmd += `    etcdctl endpoint health --endpoints=http://localhost:2379 >/dev/null 2>&1 && break\n`;
    finalCmd += `    echo "  attempt $i/20..."\n`;
    finalCmd += `    sleep 3\n`;
    finalCmd += `done\n\n`;

    // patroni
    finalCmd += `if systemctl is-active --quiet patroni; then\n`;
    finalCmd += `    echo "TurboCI: Patroni already running, restarting..."\n`;
    finalCmd += `    systemctl restart patroni\n`;
    finalCmd += `    exit 0\n`;
    finalCmd += `else\n`;
    finalCmd += `    echo "TurboCI: Starting Patroni..."\n`;
    finalCmd += `    systemctl enable patroni\n`;
    finalCmd += `    systemctl start patroni\n`;
    finalCmd += `fi\n\n`;

    finalCmd += `sleep 5\n`;
    finalCmd += `if ! systemctl is-active --quiet patroni; then\n`;
    finalCmd += `    echo "ERROR: Patroni failed to start. Logs:"\n`;
    finalCmd += `    journalctl -u patroni --no-pager -n 30\n`;
    finalCmd += `    exit 1\n`;
    finalCmd += `fi\n`;
    finalCmd += `echo "TurboCI: Patroni is up."\n`;
    finalCmd += `STARTEOF\n`;
    finalCmd += `chmod +x /usr/local/bin/tci-postgres-start.sh\n\n`;

    // -------------------------------------------------------------------------
    // SQL INIT (idempotent)
    // -------------------------------------------------------------------------
    const initSqlLines: string[] = [];

    if (rootPassword) {
        initSqlLines.push(`ALTER USER postgres PASSWORD '${rootPassword}';`);
    }

    if (replication?.enabled && replication.user && replication.password) {
        initSqlLines.push(
            `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='${replication.user}') THEN CREATE USER ${replication.user} WITH REPLICATION ENCRYPTED PASSWORD '${replication.password}'; END IF; END $$;`,
        );
    }

    if (pgConfig?.databases) {
        for (const db of pgConfig.databases) {
            initSqlLines.push(
                `SELECT 'CREATE DATABASE ${db.name}' WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname='${db.name}')\\gexec`,
            );
            // if (db.user && db.password) {
            //     initSqlLines.push(
            //         `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='${db.user}') THEN CREATE USER ${db.user} WITH ENCRYPTED PASSWORD '${db.password}'; END IF; END $$;`,
            //     );
            //     initSqlLines.push(
            //         `ALTER USER ${db.user} WITH ENCRYPTED PASSWORD '${db.password}';`,
            //     );
            //     initSqlLines.push(
            //         `GRANT ALL PRIVILEGES ON DATABASE ${db.name} TO ${db.user};`,
            //     );
            //     initSqlLines.push(`\\connect ${db.name}`);
            //     initSqlLines.push(
            //         `GRANT USAGE, CREATE ON SCHEMA public TO ${db.user};`,
            //     );
            //     initSqlLines.push(`ALTER SCHEMA public OWNER TO ${db.user};`);
            //     initSqlLines.push(`\\connect postgres`);
            // }
        }
    }

    finalCmd += `echo "--- TurboCI: Writing init SQL ---"\n`;
    finalCmd += `cat > /usr/local/bin/tci-postgres-init.sql << 'INITEOF'\n`;
    finalCmd += `${initSqlLines.join("\n")}\n`;
    finalCmd += `INITEOF\n\n`;

    // -------------------------------------------------------------------------
    // INIT SCRIPT — runs on leader only, detected via Patroni REST API
    // -------------------------------------------------------------------------
    finalCmd += `echo "--- TurboCI: Writing tci-postgres-init.sh ---"\n`;
    finalCmd += `cat > /usr/local/bin/tci-postgres-init.sh << 'INITSHEOF'\n`;
    finalCmd += `#!/bin/bash\n`;
    finalCmd += `set -e\n\n`;
    finalCmd += `echo "TurboCI: Waiting for Patroni leader election..."\n`;
    finalCmd += `for i in $(seq 1 30); do\n`;
    finalCmd += `    ROLE=$(curl -sf http://localhost:8008/patroni \\\n`;
    finalCmd += `        | python3 -c "import sys,json; print(json.load(sys.stdin).get('role',''))" \\\n`;
    finalCmd += `        2>/dev/null || echo "")\n`;
    finalCmd += `    if [ "$ROLE" = "master" ] || [ "$ROLE" = "primary" ]; then\n`;
    finalCmd += `        echo "TurboCI: Leader confirmed. Running init SQL..."\n`;
    finalCmd += `        sudo -u postgres psql < /usr/local/bin/tci-postgres-init.sql || echo "WARN: SQL init failed (may already be applied)"\n`;
    finalCmd += `        exit 0\n`;
    finalCmd += `    fi\n`;
    finalCmd += `    echo "  Not leader yet (role=$ROLE), attempt $i/30..."\n`;
    finalCmd += `    sleep 3\n`;
    finalCmd += `done\n`;
    finalCmd += `echo "TurboCI: Not the leader on this node — skipping init SQL."\n`;
    finalCmd += `INITSHEOF\n`;
    finalCmd += `chmod +x /usr/local/bin/tci-postgres-init.sh\n`;

    // -------------------------------------------------------------------------
    // DISPATCH
    // -------------------------------------------------------------------------
    return bun
        ? bunGrabPrivateIPsBulkScripts({
              private_server_ips,
              script: finalCmd,
              parrallel: false,
          })
        : grabPrivateIPsBulkScripts({
              private_server_ips,
              script: finalCmd,
              parrallel: false,
          });
}
