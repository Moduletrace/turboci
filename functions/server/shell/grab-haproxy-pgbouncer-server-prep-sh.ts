import type { ParsedDeploymentServiceConfig, TCIGlobalConfig } from "@/types";
import bunGrabPrivateIPsBulkScripts from "@/utils/bun-scripts/bun-grab-private-ips-bulk-scripts";
import grabPrivateIPsBulkScripts from "@/utils/ssh/shell-scripts/grab-private-ips-bulk-scripts";
import grabHAProxyConfig from "./grab-haproxy-config";

type Params = {
    private_server_ips: string[];
    haproxy_service: ParsedDeploymentServiceConfig;
    deployment: TCIGlobalConfig;
    skip_init?: boolean;
    bun?: boolean;
};

/**
 * Generates the shell script that runs on HAProxy/PgBouncer servers
 * during the prepare phase:
 *
 * 1. Installs haproxy and pgbouncer from apt (idempotent).
 * 2. Writes /etc/haproxy/haproxy.cfg from the generated config.
 *    HAProxy listens on the public port and forwards to PgBouncer on
 *    localhost:6432 — PgBouncer is the only backend in the HAProxy pool.
 *    Health-checking against the Patroni REST API (/primary on port 8008)
 *    is done at the DB tier, not here.
 * 3. Writes /etc/pgbouncer/pgbouncer.ini and userlist.txt.
 *    PgBouncer connects to the Patroni primary IP (first DB node) in
 *    transaction pooling mode. The target IP is re-written on every deploy
 *    so failovers are reflected automatically.
 * 4. Validates haproxy config, then enables and (re)starts both services.
 *
 * Traffic path:
 *   client → HAProxy :5432 → PgBouncer :6432 → Patroni primary :5432
 *
 * PgBouncer is intentionally NOT aware of which Postgres node is the
 * primary — that is HAProxy's job via the Patroni /primary health check.
 * PgBouncer only pools; HAProxy only routes.
 */
export default async function grabHAProxyPGBouncerServerPrepSH({
    private_server_ips,
    haproxy_service,
    deployment,
    skip_init,
    bun,
}: Params) {
    const pgBouncer = haproxy_service.haproxy?.pgbouncer;
    const haproxyConfig = haproxy_service.haproxy;

    let finalCmd = `set -e\n\n`;

    // -------------------------------------------------------------------------
    // INSTALLATION
    // -------------------------------------------------------------------------
    if (!skip_init) {
        finalCmd += `touch /root/.hushlogin\n`;
        finalCmd += `apt-get update -qq\n`;
        finalCmd += `command -v haproxy >/dev/null 2>&1 || apt-get install -y haproxy\n`;
        if (pgBouncer?.enabled) {
            finalCmd += `command -v pgbouncer >/dev/null 2>&1 || apt-get install -y pgbouncer\n`;
        }
        finalCmd += `\n`;
    }

    // -------------------------------------------------------------------------
    // PGBOUNCER CONFIG
    // -------------------------------------------------------------------------
    if (pgBouncer?.enabled) {
        const pgHost = pgBouncer.db_host;
        const pgPort = pgBouncer.db_port ?? 5432;
        const pgBouncerPort = pgBouncer.listen_port ?? 6432;
        const poolMode = pgBouncer.pool_mode ?? "transaction";
        const maxClientConn = pgBouncer.max_client_conn ?? 1000;
        const defaultPoolSize = pgBouncer.default_pool_size ?? 25;
        const minPoolSize = pgBouncer.min_pool_size ?? 5;
        const reservePoolSize = pgBouncer.reserve_pool_size ?? 5;
        const adminUser = pgBouncer.admin_user ?? "pgbouncer_admin";
        const adminPassword = pgBouncer.admin_password ?? "";
        const databases = pgBouncer.databases ?? [];

        finalCmd += `echo "--- TurboCI: Writing PgBouncer config ---"\n`;
        finalCmd += `mkdir -p /etc/pgbouncer\n\n`;

        // pgbouncer.ini
        finalCmd += `cat > /etc/pgbouncer/pgbouncer.ini << 'PGBEOF'\n`;
        finalCmd += `[databases]\n`;

        if (databases.length > 0) {
            for (const db of databases) {
                finalCmd += `${db.name} = host=${pgHost} port=${pgPort} dbname=${db.name}\n`;
            }
        } else {
            // wildcard — proxies all databases
            finalCmd += `* = host=${pgHost} port=${pgPort}\n`;
        }

        finalCmd += `\n[pgbouncer]\n`;
        finalCmd += `listen_addr = 127.0.0.1\n`; // HAProxy is the public face
        finalCmd += `listen_port = ${pgBouncerPort}\n`;
        finalCmd += `auth_type = md5\n`;
        finalCmd += `auth_file = /etc/pgbouncer/userlist.txt\n`;
        finalCmd += `pool_mode = ${poolMode}\n`;
        finalCmd += `max_client_conn = ${maxClientConn}\n`;
        finalCmd += `default_pool_size = ${defaultPoolSize}\n`;
        finalCmd += `min_pool_size = ${minPoolSize}\n`;
        finalCmd += `reserve_pool_size = ${reservePoolSize}\n`;
        finalCmd += `reserve_pool_timeout = 5\n`;
        finalCmd += `server_reset_query = DISCARD ALL\n`;
        finalCmd += `ignore_startup_parameters = extra_float_digits\n`;
        finalCmd += `log_connections = 0\n`;
        finalCmd += `log_disconnections = 0\n`;
        finalCmd += `admin_users = ${adminUser}\n`;
        finalCmd += `stats_users = ${adminUser}\n`;
        finalCmd += `PGBEOF\n\n`;

        // userlist.txt — md5 hashed passwords (pgbouncer format)
        // md5 hash = md5(password + username), prefixed with "md5"
        finalCmd += `echo "--- TurboCI: Writing PgBouncer userlist ---"\n`;
        finalCmd += `cat > /etc/pgbouncer/userlist.txt << 'USERLISTEOF'\n`;

        if (pgBouncer.users) {
            for (const u of pgBouncer.users) {
                // Write as plaintext — pgbouncer accepts both plain and md5.
                // In prod, pre-hash these: md5(password||username)
                finalCmd += `"${u.username}" "${u.password}"\n`;
            }
        }

        // Admin user entry
        finalCmd += `"${adminUser}" "${adminPassword}"\n`;
        finalCmd += `USERLISTEOF\n\n`;

        finalCmd += `chown -R postgres:postgres /etc/pgbouncer\n`;
        finalCmd += `chmod 640 /etc/pgbouncer/userlist.txt\n\n`;

        // systemd override — pgbouncer's default unit runs as its own user
        // but needs to read the postgres-owned config dir
        finalCmd += `mkdir -p /etc/systemd/system/pgbouncer.service.d\n`;
        finalCmd += `cat > /etc/systemd/system/pgbouncer.service.d/override.conf << 'OVERRIDEEOF'\n`;
        finalCmd += `[Service]\n`;
        finalCmd += `User=postgres\n`;
        finalCmd += `Group=postgres\n`;
        finalCmd += `OVERRIDEEOF\n\n`;

        finalCmd += `systemctl daemon-reload\n`;
        finalCmd += `systemctl enable pgbouncer\n`;
        finalCmd += `systemctl restart pgbouncer 2>/dev/null || systemctl start pgbouncer\n\n`;

        // Verify PgBouncer came up before proceeding to HAProxy
        finalCmd += `sleep 2\n`;
        finalCmd += `if ! systemctl is-active --quiet pgbouncer; then\n`;
        finalCmd += `    echo "ERROR: PgBouncer failed to start. Logs:"\n`;
        finalCmd += `    journalctl -u pgbouncer --no-pager -n 30\n`;
        finalCmd += `    exit 1\n`;
        finalCmd += `fi\n`;
        finalCmd += `echo "TurboCI: PgBouncer is up on 127.0.0.1:${pgBouncerPort}"\n\n`;
    }

    // -------------------------------------------------------------------------
    // HAPROXY CONFIG
    // -------------------------------------------------------------------------
    const haproxyCnf = await grabHAProxyConfig({ haproxy_service, deployment });

    if (haproxyCnf) {
        finalCmd += `echo "--- TurboCI: Writing HAProxy config ---"\n`;
        finalCmd += `cat << 'HAPROXYEOF' > /etc/haproxy/haproxy.cfg\n`;
        finalCmd += `${haproxyCnf}`;
        finalCmd += `HAPROXYEOF\n\n`;
        finalCmd += `haproxy -c -f /etc/haproxy/haproxy.cfg || exit 1\n\n`;
    }

    finalCmd += `systemctl enable haproxy\n`;
    finalCmd += `systemctl restart haproxy 2>/dev/null || systemctl start haproxy\n`;

    return bun
        ? bunGrabPrivateIPsBulkScripts({
              private_server_ips,
              script: finalCmd,
              parrallel: true,
          })
        : grabPrivateIPsBulkScripts({
              private_server_ips,
              script: finalCmd,
              parrallel: true,
          });
}
