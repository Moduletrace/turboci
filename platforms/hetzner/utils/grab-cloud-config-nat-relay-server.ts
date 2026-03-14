type Params = {
    ip_range: string;
};

export default function hetznerGrabCloudConfigForNATRelayServer({
    ip_range,
}: Params) {
    let conf = `#cloud-config\n`;

    /**
     * # Setup NAT for private servers internet access
     */
    conf += `write_files:\n`;
    conf += `- path: /etc/network/interfaces\n`;
    conf += `  content: |\n`;
    conf += `    auto eth0\n`;
    conf += `    iface eth0 inet dhcp\n`;
    conf += `        post-up echo 1 > /proc/sys/net/ipv4/ip_forward\n`;
    conf += `         post-up iptables -t nat -A POSTROUTING -s '${ip_range}' -o eth0 -j MASQUERADE\n`;
    conf += `  append: true\n`;

    /**
     * # Run Commands
     */
    conf += `runcmd:\n`;
    conf += `- touch /root/.hushlogin\n`;
    conf += `- printf "\nalias ll='ls -laF'\n" >> /root/.bashrc\n`;
    conf += `- reboot\n`;

    return conf;
}
