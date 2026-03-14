export default function gcpPrivateServerInitSH() {
    let sh = ``;

    /**
     * # Quality of life tweaks
     */
    sh += `touch /root/.hushlogin || true\n`;
    sh += `grep -qxF "alias ll='ls -laF'" /root/.bashrc || echo "alias ll='ls -laF'" >> /root/.bashrc\n`;

    return sh;
}
