import { existsSync, readFileSync } from "fs";
import path from "path";

const shell_script_path = process.argv.pop();

if (!shell_script_path) {
    console.error(`No Shell Script Path Passed`);
    process.exit(1);
}

const resolved_shell_script_path = path.resolve(
    process.cwd(),
    shell_script_path,
);

if (!existsSync(resolved_shell_script_path)) {
    console.error(`Shell Script ${resolved_shell_script_path} does not exist`);
    process.exit(1);
}

const skip_comments = Boolean(process.argv.find((a) => a == "--skip-comments"));

const shell_script_content = readFileSync(resolved_shell_script_path, "utf-8");

const shell_script_lines_array = shell_script_content.split(/\n/);

let cmd = `let cmd = "";\n`;

for (let i = 0; i < shell_script_lines_array.length; i++) {
    const line = shell_script_lines_array[i];
    if (!line) continue;
    if (skip_comments && line.startsWith("#")) continue;
    const parsed_line = line.replace(/\$\{/g, `\\$\{`);
    cmd += `cmd += \`${parsed_line}\\n\`;\n`;
}

console.log(cmd);
