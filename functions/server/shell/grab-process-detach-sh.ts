import { AppNames } from "@/utils/app-names";
import slugify from "@/utils/slugify";

type DetachParams = {
    cmd: string;
    name: string;
};

export function grabProcessName(params: {
    deployment_name: string;
    service_name: string;
    index: number;
}) {
    return slugify(
        `tci_${params.deployment_name}_${params.service_name}_${params.index}`,
    );
}

/**
 * Portable process wrapper for every `run.start` command.
 * Uses setsid (preferred) or nohup — no PM2/systemd required.
 * Stops any prior instance by PID/process-group before start (idempotent updates).
 * Does not fail if the command exits quickly.
 */
export default function grabProcessDetachSH({ cmd, name }: DetachParams): string {
    const runDir = AppNames.ProcessRunDir;
    const logDir = AppNames.ProcessLogDir;
    const eof = `TCI_EOF_${name.replace(/[^a-zA-Z0-9_]/g, "_")}`;

    let sh = "";
    sh += `# --- turboci process: ${name} ---\n`;
    sh += `tci_name=${shellQuote(name)}\n`;
    sh += `tci_run_dir=${shellQuote(runDir)}\n`;
    sh += `tci_log_dir=${shellQuote(logDir)}\n`;
    sh += `mkdir -p "$tci_run_dir" 2>/dev/null || { tci_run_dir="/tmp/turboci/run"; mkdir -p "$tci_run_dir"; }\n`;
    sh += `mkdir -p "$tci_log_dir" 2>/dev/null || { tci_log_dir="/tmp/turboci/log"; mkdir -p "$tci_log_dir"; }\n`;
    sh += `tci_pid_file="$tci_run_dir/$tci_name.pid"\n`;
    sh += `tci_log_file="$tci_log_dir/$tci_name.log"\n`;
    sh += `tci_cmd_file="$tci_run_dir/$tci_name.cmd.sh"\n`;
    sh += `tci_stop_pid() {\n`;
    sh += `  _pf="$1"\n`;
    sh += `  [ -f "$_pf" ] || return 0\n`;
    sh += `  _pid=$(cat "$_pf" 2>/dev/null || true)\n`;
    sh += `  rm -f "$_pf"\n`;
    sh += `  [ -n "$_pid" ] || return 0\n`;
    sh += `  if kill -0 "$_pid" 2>/dev/null; then\n`;
    sh += `    kill -TERM -"$_pid" 2>/dev/null || kill -TERM "$_pid" 2>/dev/null || true\n`;
    sh += `    _i=0\n`;
    sh += `    while [ "$_i" -lt 10 ] && kill -0 "$_pid" 2>/dev/null; do\n`;
    sh += `      sleep 1\n`;
    sh += `      _i=$((_i + 1))\n`;
    sh += `    done\n`;
    sh += `    kill -KILL -"$_pid" 2>/dev/null || kill -KILL "$_pid" 2>/dev/null || true\n`;
    sh += `  fi\n`;
    sh += `}\n`;
    sh += `tci_stop_pid "$tci_pid_file"\n`;
    sh += `cat > "$tci_cmd_file" <<'${eof}'\n`;
    sh += `${cmd}\n`;
    sh += `${eof}\n`;
    sh += `: > "$tci_log_file"\n`;
    sh += `if command -v setsid >/dev/null 2>&1; then\n`;
    sh += `  setsid /bin/sh "$tci_cmd_file" </dev/null >>"$tci_log_file" 2>&1 &\n`;
    sh += `else\n`;
    sh += `  nohup /bin/sh "$tci_cmd_file" </dev/null >>"$tci_log_file" 2>&1 &\n`;
    sh += `fi\n`;
    sh += `echo $! > "$tci_pid_file"\n`;
    sh += `echo "TurboCI: started $tci_name (pid $(cat "$tci_pid_file")) log=$tci_log_file"\n`;

    return sh;
}

function shellQuote(value: string): string {
    return `'${value.replace(/'/g, `'\\''`)}'`;
}
