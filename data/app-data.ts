const AppData = {
    max_instances: 200,
    max_clusters: 1000,
    max_servers_batch: 50,
    load_balancer_fail_timeout_secs: 5,
    load_balancer_max_fails: 1,
    load_balancer_next_upstream_tries: 3,
    load_balancer_next_upstream_timeout: 10,
    load_balancer_connect_timeout: 3,
    load_balancer_send_timeout: 60,
    load_balancer_read_timeout: 60,
    certbot_http_challenge_port: 8888,
    private_server_batch_exec_size: 50,
    ssh_max_tries: 50,
    ssh_try_timeout_milliseconds: 5000,
    TerminalBinName: "ttyd",

    RelayAdminWebPort: 3772,
    RelayAdminWebsocketPort: 3773,

    /**
     * Hetzner
     */
    HetznerNamesMaxLength: 63,
    DefaultHetznerOS: "debian-12",
} as const;

export default AppData;
