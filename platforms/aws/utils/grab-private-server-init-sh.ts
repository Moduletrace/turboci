type Params = {
    defaultNetworkGateway: string;
};

export default function awsPrivateServerInitSH({
    defaultNetworkGateway,
}: Params) {
    let sh = ``;

    /**
     * # Setup NAT for internet access
     */
    // sh += `cat << 'EOF' >> /etc/network/interfaces\n`;
    // sh += `auto enp7s0\n`;
    // sh += `iface enp7s0 inet dhcp\n`;
    // sh += `    post-up echo "Waiting..."\n`;
    // sh += `    post-up ip route add default via ${defaultNetworkGateway}\n`;
    // sh += `EOF\n`;
    // sh += `cat << 'EOF' >> /etc/systemd/resolved.conf\n`;
    // sh += `[Resolve]\n`;
    // sh += `DNS=185.12.64.2 185.12.64.1\n`;
    // sh += `FallbackDNS=8.8.8.8\n`;
    // sh += `EOF\n`;

    /**
     * # Run Commands
     */
    sh += `touch /root/.hushlogin\n`;
    sh += `printf "\nalias ll='ls -laF'\n" >> /root/.bashrc\n`;
    // sh += `reboot || true\n`;

    return sh;
}
