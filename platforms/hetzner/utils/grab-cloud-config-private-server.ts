type Params = {
    defaultNetworkGateway: string;
};

export default function hetznerGrabCloudConfigForPrivateServer({
    defaultNetworkGateway,
}: Params) {
    let conf = `#cloud-config\n`;

    /**
     * # Setup NAT for internet access
     */
    conf += `write_files:\n`;
    conf += `- path: /etc/network/interfaces\n`;
    conf += `  content: |\n`;
    conf += `    auto enp7s0\n`;
    conf += `    iface enp7s0 inet dhcp\n`;
    conf += `        post-up echo "Waiting..."\n`;
    conf += `        post-up ip route add default via ${defaultNetworkGateway}\n`;
    conf += `  append: true\n`;
    conf += `- path: /etc/systemd/resolved.conf\n`;
    conf += `  content: |\n`;
    conf += `    [Resolve]\n`;
    conf += `    DNS=185.12.64.2 185.12.64.1\n`;
    conf += `    FallbackDNS=8.8.8.8\n`;
    conf += `  append: true\n`;
    // conf += `- path: /etc/resolv.conf\n`;
    // conf += `  content: |\n`;
    // conf += `    nameserver 185.12.64.1\n`;
    // conf += `    nameserver 185.12.64.2\n`;
    // conf += `  append: true\n`;

    /**
     * # Run Commands
     */
    conf += `runcmd:\n`;
    conf += `- touch /root/.hushlogin\n`;
    conf += `- printf "\nalias ll='ls -laF'\n" >> /root/.bashrc\n`;
    conf += `- reboot\n`;

    return conf;
}
