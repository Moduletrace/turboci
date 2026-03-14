import _ from "lodash";
import { execSync } from "child_process";

const SSH_KEY = "/root/.turboci/.ssh/turboci";
const SSH_OPTS = `-i ${SSH_KEY} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -C -c aes128-ctr`;
const TIMEOUT = 5;
const MAX_ATTEMPTS = 20;
const REMOTE_HOSTS = ["10.1.0.13"];
const DEFAULT_SSH_USER = "root";
const BATCH_SIZE = 5;
async function run(host: string) {
    let attempt = 0;
    console.log(`Setting up ${host} ...`);
    while (attempt < MAX_ATTEMPTS) {
        attempt += 1;
        if (attempt > MAX_ATTEMPTS) {
            console.log(
                `Error: ${host} not ready after ${MAX_ATTEMPTS} attempts. Exiting.`
            );
            process.exit(1);
        }
        console.log(
            `Waiting for ${host} to be ready... (attempt ${attempt}/${MAX_ATTEMPTS})`
        );
        await Bun.sleep(TIMEOUT);
    }
    attempt = 0;

    let execCmd = `ssh ${SSH_OPTS} ${DEFAULT_SSH_USER}@${host} << 'TURBOCIEXEC'\n`;
    execCmd += `cat /root/.bashrc | grep "ll='ls -laF'" || printf "
alias ll='ls -laF'
" >> /root/.bashrc
cat /root/.hushlogin || touch /root/.hushlogin
apt update
command -v nginx >/dev/null 2>&1 || apt install -y nginx
command -v certbot >/dev/null 2>&1 || apt install -y certbot
command -v bun >/dev/null 2>&1 || (apt install -y zip unzip curl wget && curl -fsSL https://bun.com/install | bash)
rm -f /etc/nginx/sites-enabled/default

cat << 'EOF' > /etc/nginx/nginx.conf
user www-data;
worker_processes auto;
pid /run/nginx.pid;
include /etc/nginx/modules-enabled/*.conf;

events {
        worker_connections 768;
}

http {
    sendfile on;
    tcp_nopush on;
    types_hash_max_size 2048;
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    ssl_protocols TLSv1 TLSv1.1 TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;
    gzip on;

    upstream turboci_load_balancer_upstream_web {
        server 10.1.0.3:3000 max_fails=1 fail_timeout=5s;
        server 10.1.0.4:3000 max_fails=1 fail_timeout=5s;
        server 10.1.0.5:3000 max_fails=1 fail_timeout=5s;
        server 10.1.0.8:3000 max_fails=1 fail_timeout=5s;
        server 10.1.0.11:3000 max_fails=1 fail_timeout=5s;
        server 10.1.0.6:3000 max_fails=1 fail_timeout=5s;
        server 10.1.0.7:3000 max_fails=1 fail_timeout=5s;
        server 10.1.0.10:3000 max_fails=1 fail_timeout=5s;
        server 10.1.0.9:3000 max_fails=1 fail_timeout=5s;
        server 10.1.0.12:3000 max_fails=1 fail_timeout=5s;
    }

    server {
        listen 80;
        server_name web;
        location /.well-known/acme-challenge/ {
            proxy_pass http://127.0.0.1:8888;
        }
        location / {
            proxy_pass http://turboci_load_balancer_upstream_web;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_connect_timeout       3s;
            proxy_send_timeout          60s;
            proxy_read_timeout          60s;
            send_timeout                60s;
            proxy_next_upstream http_500 http_502 http_503 http_504 error timeout invalid_header;
            proxy_next_upstream_tries 3;
            proxy_next_upstream_timeout 10s;
        }

    }
}


EOF
nginx -t || exit 1
rm -rf /var/cache/nginx/*
nginx -s reload
\n`;
    execCmd += `TURBOCIEXEC\n`;
    try {
        execSync(execCmd);
    } catch (error) {
        process.exit(1);
    }
}

const first_host = REMOTE_HOSTS.splice(0, 1)[0] as string;
await run(first_host);

const chunks = _.chunk(REMOTE_HOSTS, 5);
for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (!chunk) continue;
    const runChunk = await Promise.all(chunk.map((h) => run(h)));
}
