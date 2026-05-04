import type { ParsedDeploymentServiceConfig, TCIGlobalConfig } from "@/types";

type Params = {
    service: ParsedDeploymentServiceConfig;
    deployment: TCIGlobalConfig;
};

export default async function grabMariadbGaleraInitSQL({
    service,
    deployment,
}: Params) {
    const galeraConfig = service.mariadb_galera;
    const rootPassword = galeraConfig?.root_password ?? "";

    // --- SQL INIT (Idempotent Users) ---
    const sql_lines: string[] = [];

    // Detect ProxySQL attachments
    const attached_proxysql = deployment.services.filter(
        (s) =>
            s.type === "proxysql" &&
            s.proxysql?.target_services?.some(
                (ts) => ts.service_name === service.service_name,
            ),
    );

    // Detect HAProxy attachments
    const attached_haproxy = deployment.services.filter(
        (s) =>
            s.type === "haproxy" &&
            s.haproxy?.target_services?.some(
                (ts) => ts.service_name === service.service_name,
            ),
    );

    // Detect Maxscale attachments
    const attached_maxscale = deployment.services.filter(
        (s) =>
            s.type === "maxscale" &&
            s.maxscale?.target_services?.some(
                (ts) => ts.service_name === service.service_name,
            ),
    );

    // ProxySQL Monitor User
    for (const p of attached_proxysql) {
        sql_lines.push(
            `CREATE USER IF NOT EXISTS 'proxysql_monitor'@'%' IDENTIFIED BY '${p.proxysql?.monitor_password}';`,
        );
        sql_lines.push(
            `GRANT USAGE, REPLICATION CLIENT ON *.* TO 'proxysql_monitor'@'%';`,
        );
    }

    // HAProxy Check User (Allows HAProxy 'option mysql-check' to work)
    if (attached_haproxy.length > 0) {
        sql_lines.push(`CREATE USER IF NOT EXISTS 'haproxy_check'@'%';`);
        sql_lines.push(`GRANT USAGE ON *.* TO 'haproxy_check'@'%';`);
    }

    // Check Maxscale proxy
    if (attached_maxscale.length > 0) {
        for (let i = 0; i < attached_maxscale.length; i++) {
            const maxscale = attached_maxscale[i];
            if (!maxscale?.maxscale) continue;

            const maxscale_user_name =
                maxscale.maxscale.user || `turboci-maxscale`;
            const maxscale_user_pass = maxscale.maxscale.password;
            const maxscale_user_host = `%`;
            const maxscale_user = `'${maxscale_user_name}'@'${maxscale_user_host}'`;

            let create_maxscale_user_sql = `CREATE USER IF NOT EXISTS ${maxscale_user}`;
            if (maxscale_user_pass) {
                create_maxscale_user_sql += ` IDENTIFIED BY '${maxscale_user_pass}'`;
            }
            create_maxscale_user_sql += `;`;

            sql_lines.push(create_maxscale_user_sql);

            sql_lines.push(`GRANT SELECT ON mysql.user TO ${maxscale_user};`);
            sql_lines.push(`GRANT SELECT ON mysql.db TO ${maxscale_user};`);
            sql_lines.push(
                `GRANT SELECT ON mysql.tables_priv TO ${maxscale_user};`,
            );
            sql_lines.push(
                `GRANT SELECT ON mysql.columns_priv TO ${maxscale_user};`,
            );
            sql_lines.push(
                `GRANT SELECT ON mysql.procs_priv TO ${maxscale_user};`,
            );
            sql_lines.push(
                `GRANT SELECT ON mysql.proxies_priv TO ${maxscale_user};`,
            );
            sql_lines.push(
                `GRANT SELECT ON mysql.roles_mapping TO ${maxscale_user};`,
            );
            sql_lines.push(
                `GRANT SHOW DATABASES, SELECT ON *.* TO ${maxscale_user};`,
            );
            sql_lines.push(
                `GRANT REPLICATION CLIENT ON *.* TO ${maxscale_user};`,
            );
            // }
        }
    }

    sql_lines.push(
        `ALTER USER 'root'@'localhost' IDENTIFIED BY '${rootPassword}';`,
    );

    if (galeraConfig?.databases) {
        for (const db of galeraConfig.databases) {
            sql_lines.push(`CREATE DATABASE IF NOT EXISTS \\\`${db.name}\\\`;`);
        }
    }

    if (galeraConfig?.users) {
        for (const user of galeraConfig.users) {
            let user_names: string[] = [];

            if (Array.isArray(user.hosts)) {
                for (const host of user.hosts) {
                    user_names.push(`'${user.user}'@'${host}'`);
                }
            } else if (user.hosts) {
                user_names.push(`'${user.user}'@'${user.hosts}'`);
            } else {
                user_names.push(`'${user.user}'@'%'`);
            }

            for (const user_name of user_names) {
                let create_user_sql = `CREATE USER IF NOT EXISTS ${user_name}`;
                if (user.password) {
                    create_user_sql += ` IDENTIFIED BY '${user.password}';`;
                } else {
                    create_user_sql += `;`;
                }

                sql_lines.push(create_user_sql);

                if (user.databases) {
                    for (const user_database of user.databases) {
                        sql_lines.push(
                            `CREATE DATABASE IF NOT EXISTS \\\`${user_database.db_name}\\\`;`,
                        );

                        if (user_database.privileges) {
                            sql_lines.push(
                                `GRANT ${user_database.privileges.join(",")} ON \\\`${user_database.db_name}\\\`.* TO ${user_name};`,
                            );
                        } else {
                            sql_lines.push(
                                `GRANT ALL PRIVILEGES ON \\\`${user_database.db_name}\\\`.* TO ${user_name};`,
                            );
                        }
                    }
                }
            }
        }
    }

    sql_lines.push(`FLUSH PRIVILEGES;`);
    sql_lines.push(`FLUSH HOSTS;`);

    return sql_lines;
}
