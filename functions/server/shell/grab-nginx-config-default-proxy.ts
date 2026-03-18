import AppData from "@/data/app-data";

type Params = {
    upstream_name: string;
    path?: string;
};

export default function grabDefaultProxyLocation({
    upstream_name,
    path,
}: Params): string {
    let loc = "";

    loc += `            proxy_pass http://${upstream_name}${path || ""};\n`;
    loc += `            proxy_set_header Host \\$host;\n`;
    loc += `            proxy_set_header X-Real-IP \\$remote_addr;\n`;
    loc += `            proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;\n`;

    loc += `            proxy_http_version 1.1;\n`;
    loc += `            proxy_set_header Upgrade \\$http_upgrade;\n`;
    loc += `            proxy_set_header Connection "upgrade";\n`;

    const proxy_connect_timeout = AppData["load_balancer_connect_timeout"];
    const proxy_read_timeout = AppData["load_balancer_read_timeout"];
    const send_timeout = AppData["load_balancer_send_timeout"];

    loc += `            proxy_connect_timeout       ${proxy_connect_timeout}s;\n`;
    loc += `            proxy_send_timeout          ${send_timeout}s;\n`;
    loc += `            proxy_read_timeout          ${proxy_read_timeout}s;\n`;
    loc += `            send_timeout                ${send_timeout}s;\n`;

    const next_upstream_tries = AppData["load_balancer_next_upstream_tries"];
    const next_upstream_timeout =
        AppData["load_balancer_next_upstream_timeout"];

    loc += `            proxy_next_upstream http_500 http_502 http_503 http_504 error timeout invalid_header;\n`;
    loc += `            proxy_next_upstream_tries ${next_upstream_tries};\n`;
    loc += `            proxy_next_upstream_timeout ${next_upstream_timeout}s;\n`;

    return loc;
}
