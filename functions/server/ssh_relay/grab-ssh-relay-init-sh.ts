import type { TCIConfigDeployment } from "@/types";
import { turboCiDepsCmds } from "../install-turboci-dependencies";
import AppData from "@/data/app-data";
import grabDirNames from "@/utils/grab-dir-names";
import generateRandomPassword from "@/utils/generate-random-password";

const {
    relayDeploymentIDFile,
    relayNGINXConfigFile,
    relayNGINXConfigDir,
    relayNGINXDefaultServerConfigFile,
    relayAdminDir,
} = grabDirNames();

type Params = {
    deployment: Omit<TCIConfigDeployment, "services">;
};

export default function grabSSHRelayServerInitSH({ deployment }: Params) {
    let initSh = "";

    initSh += `set -e\n`;

    initSh += `apt update\n`;
    initSh += `apt install -y curl wget zip unzip xz-utils\n`;

    const installNodeSH = turboCiDepsCmds({ os: "debian", dependency: "node" });
    const installBunSH = turboCiDepsCmds({ os: "debian", dependency: "bun" });
    // const installDocker = turboCiDepsCmds({
    //     os: "debian",
    //     dependency: "docker",
    // });

    initSh += installBunSH;
    initSh += installNodeSH;
    // initSh += installDocker;

    initSh += `\n`;
    initSh += `ls /root/.bun/install/global/node_modules/lodash/index.js || bun add -g lodash\n`;
    initSh += `ls /root/.bun/install/global/node_modules/pm2 || bun add -g pm2\n`;

    initSh += `if ! grep -qE '^PasswordAuthentication\\s+no' /etc/ssh/sshd_config; then\n`;
    initSh += `    echo "Updating PasswordAuthentication to no..."\n`;
    initSh += `    cat << 'EOF' > /etc/ssh/sshd_config\n`;
    initSh += `Include /etc/ssh/sshd_config.d/*.conf\n`;
    initSh += `PermitRootLogin prohibit-password\n`;
    initSh += `ChallengeResponseAuthentication no\n`;
    initSh += `PasswordAuthentication no\n`;
    initSh += `UsePAM yes\n`;
    initSh += `X11Forwarding yes\n`;
    initSh += `PrintMotd no\n`;
    initSh += `AcceptEnv LANG LC_*\n`;
    initSh += `Subsystem       sftp    /usr/lib/openssh/sftp-server\n`;
    initSh += `EOF\n`;
    initSh += `    systemctl restart sshd\n`;
    initSh += `    sleep 4\n`;
    initSh += `fi\n`;

    initSh += `if [ ! -f /usr/local/bin/${AppData["TerminalBinName"]} ]; then\n`;
    initSh += `    echo "Installing ttyd terminal applicaton ..."\n`;
    initSh += `    curl -fsSL https://pub-a4a5f01bcc334cba98a0d0b5594ef7d8.r2.dev/ttyd.x86_64 -o /usr/local/bin/${AppData["TerminalBinName"]}\n`;
    initSh += `    chmod +x /usr/local/bin/${AppData["TerminalBinName"]}\n`;
    initSh += `fi\n`;

    initSh += `if ! command -v git >/dev/null 2>&1; then\n`;
    initSh += `    echo "Installing git ..."\n`;
    initSh += `    apt install -y git\n`;
    initSh += `fi\n`;

    const deployment_uid = crypto.randomUUID();

    initSh += `if [ ! -f ${relayDeploymentIDFile} ]; then\n`;
    initSh += `    echo "Writing Deployment ID File ..."\n`;
    initSh += `    echo "${deployment_uid}" > ${relayDeploymentIDFile}\n`;
    initSh += `fi\n`;

    initSh += `if ! command -v nginx >/dev/null 2>&1; then\n`;
    initSh += `    echo "Installing NGINX ..."\n`;
    initSh += `    apt install -y nginx\n`;
    initSh += `fi\n`;

    initSh += `rm -f ${relayNGINXDefaultServerConfigFile}\n`;

    initSh += `echo "Wrting NGINX main config ..."\n`;
    initSh += `cat << 'EOF' > ${relayNGINXConfigFile}\n`;
    initSh += `user  www-data;\n`;
    initSh += `worker_processes  auto;\n\n`;
    initSh += `error_log  /var/log/nginx/error.log notice;\n`;
    initSh += `pid        /run/nginx.pid;\n`;
    initSh += `include /etc/nginx/modules-enabled/*.conf;\n\n`;
    initSh += `events {\n`;
    initSh += `    worker_connections  1024;\n`;
    initSh += `}\n\n`;
    initSh += `http {\n`;
    initSh += `    include       /etc/nginx/mime.types;\n`;
    initSh += `    default_type  application/octet-stream;\n`;
    initSh += `    log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '\n`;
    initSh += `                      '$status $body_bytes_sent "$http_referer" '\n`;
    initSh += `                      '"$http_user_agent" "$http_x_forwarded_for"';\n\n`;
    initSh += `    access_log  /var/log/nginx/access.log  main;\n`;
    initSh += `    sendfile        on;\n`;
    initSh += `    keepalive_timeout  65;\n`;
    initSh += `    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;\n\n`;
    initSh += `    include /etc/nginx/conf.d/*.conf;\n`;
    initSh += `}\n`;
    initSh += `EOF\n`;

    initSh += `nginx -t\n`;

    initSh += `mkdir -p ${relayNGINXConfigDir}\n`;

    let defaultNginx = `\n`;
    defaultNginx += `        proxy_set_header Upgrade $http_upgrade;\n`;
    defaultNginx += `        proxy_set_header Connection "Upgrade";\n`;
    defaultNginx += `        proxy_set_header Host $host;\n`;

    initSh += `echo "Wrting NGINX default server config ..."\n`;
    initSh += `cat << 'EOF' > ${relayNGINXDefaultServerConfigFile}\n`;
    initSh += `server {\n`;
    initSh += `    listen 80 default_server;\n`;
    initSh += `    listen [::]:80 default_server;\n`;
    initSh += `    server_name _;\n\n`;
    initSh += `    client_max_body_size 20M;\n\n`;

    initSh += `    location ~ "^/ttyd/(?<port>\\d+)" {\n`;
    initSh += `        resolver 127.0.0.53;\n`;
    initSh += `        proxy_pass http://127.0.0.1:$port/;\n`;
    initSh += `        proxy_http_version 1.1;\n`;
    initSh += `        ${defaultNginx}\n`;
    initSh += `    }\n\n`;

    initSh += `    location /ws {\n`;
    initSh += `        proxy_pass http://127.0.0.1:${AppData["RelayAdminWebsocketPort"]};\n`;
    initSh += `        proxy_http_version 1.1;\n`;
    initSh += `        ${defaultNginx}\n`;
    initSh += `        proxy_read_timeout 3600s;\n`;
    initSh += `        proxy_send_timeout 3600s;\n`;
    initSh += `        proxy_connect_timeout 60s;\n`;
    initSh += `        proxy_buffering off;\n`;
    initSh += `        keepalive_timeout 75s;\n`;
    initSh += `        tcp_nodelay on;\n`;
    initSh += `    }\n\n`;

    initSh += `    location / {\n`;
    initSh += `        proxy_pass http://127.0.0.1:${AppData["RelayAdminWebPort"]};\n`;
    initSh += `        ${defaultNginx}\n`;
    initSh += `    }\n`;
    initSh += `}\n`;
    initSh += `EOF\n`;

    initSh += `nginx -t\n`;
    initSh += `nginx -s reload\n`;

    initSh += `if [ ! -d ${relayAdminDir} ]; then\n`;
    initSh += `    mkdir -p ${relayAdminDir}\n`;
    initSh += `    cd ${relayAdminDir}\n`;
    initSh += `    git clone https://git.tben.me/Moduletrace/turboci-admin.git .\n`;
    initSh += `    cat << 'EOF' > ${relayAdminDir}/.env\n`;
    initSh += `DSQL_ENCRYPTION_PASSWORD="${generateRandomPassword(32)}"\n`;
    initSh += `DSQL_ENCRYPTION_SALT="${generateRandomPassword(16)}"\n`;
    initSh += `NODE_ENV=production\n`;
    initSh += `EOF\n`;
    initSh += `elif [ -d ${relayAdminDir}/.git ]; then\n`;
    initSh += `    cd ${relayAdminDir}\n`;
    initSh += `    git pull\n`;
    initSh += `else\n`;
    initSh += `    mkdir -p ${relayAdminDir}\n`;
    initSh += `fi\n`;
    initSh += `cd ${relayAdminDir}\n`;
    initSh += `chmod +x ./src/scripts/shell/init.sh\n`;
    initSh += `./src/scripts/shell/init.sh\n`;
    initSh += `./src/scripts/shell/start-prod.sh\n`;

    initSh += `echo "Relay initialization success!"\n`;

    return initSh;
}
