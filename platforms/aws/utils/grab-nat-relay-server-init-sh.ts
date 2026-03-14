type Params = {
    ip_range: string;
};

export default function awsNATRelayServerInitSH({ ip_range }: Params) {
    let sh = ``;

    /**
     * # Enable IPv4 forwarding persistently
     */
    sh += `cat << 'EOF' > /etc/sysctl.d/99-nat.conf\n`;
    sh += `net.ipv4.ip_forward=1\n`;
    sh += `EOF\n`;
    sh += `sysctl --system\n\n`;

    /**
     * # Install iptables and persistence tools
     */
    sh += `export DEBIAN_FRONTEND=noninteractive\n`;
    sh += `apt-get update -y\n`;
    sh += `apt-get install -y iptables iptables-persistent --no-install-recommends\n\n`;

    /**
     * # Determine outbound interface dynamically
     */
    sh += `OUT_IF=$(ip route get 8.8.8.8 | awk '{for(i=1;i<=NF;i++) if($i=="dev") print $(i+1)}' | head -n1)\n`;
    sh += `echo "Using outbound interface: $OUT_IF"\n\n`;

    /**
     * # Add NAT MASQUERADE rule (idempotent)
     */
    sh += `if ! iptables -t nat -C POSTROUTING -s '${ip_range}' -o "$OUT_IF" -j MASQUERADE 2>/dev/null; then\n`;
    sh += `    iptables -t nat -A POSTROUTING -s '${ip_range}' -o "$OUT_IF" -j MASQUERADE\n`;
    sh += `fi\n`;
    sh += `netfilter-persistent save\n\n`;

    /**
     * # Quality of life tweaks
     */
    sh += `touch /root/.hushlogin || true\n`;
    sh += `grep -qxF "alias ll='ls -laF'" /root/.bashrc || echo "alias ll='ls -laF'" >> /root/.bashrc\n\n`;

    /**
     * # Final log
     */
    sh += `echo "NAT setup complete for ${ip_range}"\n`;

    return sh;
}
