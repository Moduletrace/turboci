import grabSSHPrefix from "./grab-ssh-prefix";

type Params = {
    ip: string;
    key_file?: string;
    user?: string;
};

export default function grabSSHReadyShellScript({
    ip,
    key_file,
    user = "root",
}: Params) {
    const sshPrefix = grabSSHPrefix({
        key_file,
    });

    return `REMOTE_HOST="${user}@${ip}"
TIMEOUT=5
MAX_ATTEMPTS=10

attempt=0
until ${sshPrefix} "$REMOTE_HOST" "echo 'SSH ready'" >/dev/null 2>&1; do
    attempt=$((attempt + 1))
    if [ "$attempt" -ge "$MAX_ATTEMPTS" ]; then
        echo "Error: Remote server not ready after $MAX_ATTEMPTS attempts. Exiting."
        exit 1
    fi
    echo "Waiting for $REMOTE_HOST to be ready... (attempt $attempt/$MAX_ATTEMPTS)"
    sleep "$TIMEOUT"
done`;
}
