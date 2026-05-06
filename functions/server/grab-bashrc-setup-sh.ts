import grabDirNames from "@/utils/grab-dir-names";

const { serviceBashrcDir } = grabDirNames();

export default function () {
    let cmd = ``;

    cmd += `mkdir -p "${serviceBashrcDir}"\n`;
    cmd += `if ! grep -q "${serviceBashrcDir}" /root/.bashrc; then\n`;
    cmd += `    cat >> /root/.bashrc << 'BASHRCEOF'\n`;
    cmd += `\n`;
    cmd += `# Source modular configs\n`;
    cmd += `if [ -d "${serviceBashrcDir}" ]; then\n`;
    cmd += `    for f in "${serviceBashrcDir}"/*; do\n`;
    cmd += `        [ -r "$f" ] && . "$f"\n`;
    cmd += `    done\n`;
    cmd += `fi\n`;
    cmd += `BASHRCEOF\n`;
    cmd += `fi\n`;

    return cmd;
}
