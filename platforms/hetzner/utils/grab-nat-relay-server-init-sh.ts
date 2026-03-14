type Params = {
    ip_range: string;
};

export default function hetznerNATRelayServerInitSH({ ip_range }: Params) {
    let sh = ``;

    /**
     * # Setup NAT for private servers internet access
     */
    sh += `cat << 'EOF' >> /etc/network/interfaces\n`;
    sh += `auto eth0\n`;
    sh += `iface eth0 inet dhcp\n`;
    sh += `    post-up echo 1 > /proc/sys/net/ipv4/ip_forward\n`;
    sh += `    post-up iptables -t nat -A POSTROUTING -s '${ip_range}' -o eth0 -j MASQUERADE\n`;
    sh += `EOF\n`;

    /**
     * # Run Commands
     */
    sh += `touch /root/.hushlogin\n`;
    sh += `printf "\nalias ll='ls -laF'\n" >> /root/.bashrc\n`;
    sh += `reboot || true\n`;

    return sh;
}
