import AppData from "@/data/app-data";
import grabDirNames from "@/utils/grab-dir-names";

type Params = {
    private_server_ips: string[];
    script: string;
    work_dir?: string;
    parrallel?: boolean;
};

export default function grabPrivateIPsBulkScripts({
    private_server_ips,
    script,
    work_dir,
    parrallel,
}: Params) {
    const { relayServerSshPrivateKeyFile } = grabDirNames();

    let finalCmd = "";

    finalCmd += `SSH_KEY="${relayServerSshPrivateKeyFile}"\n`;
    finalCmd += `SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -C -c aes128-ctr"\n`;
    finalCmd += `TIMEOUT=10\n`;
    finalCmd += `MAX_ATTEMPTS=50\n`;
    finalCmd += `REMOTE_HOSTS=(${private_server_ips.join(" ")})\n`;
    finalCmd += `DEFAULT_SSH_USER="root"\n`;
    finalCmd += `BATCH_SIZE=${AppData["private_server_batch_exec_size"]}\n`;

    finalCmd += `run() {\n`;
    finalCmd += `    local attempt=0\n`;
    finalCmd += `    echo "Setting up $1..."\n`;
    finalCmd += `    until ssh $SSH_OPTS $DEFAULT_SSH_USER@$1 "echo 'SSH ready'" >/dev/null 2>&1; do\n`;
    finalCmd += `        attempt=$((attempt + 1))\n`;
    finalCmd += `        if [ "$attempt" -ge "$MAX_ATTEMPTS" ]; then\n`;
    finalCmd += `            echo "Error: $1 not ready after $MAX_ATTEMPTS attempts. Exiting."\n`;
    finalCmd += `            return 1\n`;
    finalCmd += `        fi\n`;
    finalCmd += `        echo "Waiting for $1 to be ready... (attempt $attempt/$MAX_ATTEMPTS)"\n`;
    finalCmd += `        sleep "$TIMEOUT"\n`;
    finalCmd += `    done\n`;
    finalCmd += `    attempt=0\n\n`;

    finalCmd += `    ssh $SSH_OPTS $DEFAULT_SSH_USER@$1 << 'TURBOCIEXEC'\n`;
    if (work_dir) {
        finalCmd += `cd ${work_dir}\n`;
    }
    finalCmd += `${script}\n`;
    finalCmd += `TURBOCIEXEC\n`;
    finalCmd += `}\n`;

    if (parrallel) {
        finalCmd += `\nfirst_host="\${REMOTE_HOSTS[0]}"\n`;
        finalCmd += `run "$first_host" || exit 1\n`;

        finalCmd += `\ncount=0\n`;
        finalCmd += `pids=()\n`;
        finalCmd += `for host in "\${REMOTE_HOSTS[@]:1}"; do\n`;
        finalCmd += `    run $host &\n`;
        finalCmd += `    pids+=($!)\n`;
        finalCmd += `    count=$((count + 1))\n`;
        finalCmd += `    if (( count % BATCH_SIZE == 0 )); then\n`;
        finalCmd += `        for pid in "\${pids[@]}"; do\n`;
        finalCmd += `            wait "$pid" || exit 1\n`;
        finalCmd += `        done\n`;
        finalCmd += `        pids=()\n`;
        finalCmd += `    fi\n`;
        finalCmd += `done\n`;

        finalCmd += `\nfor pid in "\${pids[@]}"; do\n`;
        finalCmd += `    wait "$pid" || exit 1\n`;
        finalCmd += `done\n`;
    } else {
        finalCmd += `for host in "\${REMOTE_HOSTS[@]}"; do\n`;
        finalCmd += `    run $host\n`;
        finalCmd += `done\n`;
    }

    return finalCmd;
}
