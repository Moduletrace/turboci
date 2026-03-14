import grabLoadBalancersServers from "@/functions/server/load-balancers/grab-load-balancers-servers";
import grabSSHRelayServer from "@/functions/server/ssh_relay/grab-ssh-relay-server";
import grabDirNames from "@/utils/grab-dir-names";
import chalk from "chalk";

const { sshPrivateKeyFile } = grabDirNames();

export default async function () {
    const deployments = global.CONFIGS;

    if (!deployments?.[0]) {
        return;
    }

    for (let i = 0; i < deployments.length; i++) {
        const deployment = deployments[i];

        if (!deployment) continue;

        const loadBalancers = await grabLoadBalancersServers({ deployment });

        if (loadBalancers?.[0]) {
            console.log(
                chalk.white(
                    chalk.bold(
                        `\nInfo for ${chalk.green(
                            deployment.deployment_name,
                        )} deployment:\n`,
                    ),
                ),
            );

            console.log(` - Load Balancer IP addresses:`);

            for (let k = 0; k < loadBalancers.length; k++) {
                const loadBalancer = loadBalancers[k];
                if (!loadBalancer?.public_ip) continue;
                console.log(
                    `   - ${chalk.blue(chalk.bold(loadBalancer?.public_ip))}`,
                );
            }
        }

        const relayServer = await grabSSHRelayServer({ deployment });

        global.ORA_SPINNER.clear();

        if (relayServer?.ip) {
            console.log(`\n - Relay Server IP address:`);
            console.log(`   - ${chalk.blue(chalk.bold(relayServer.ip))}`);
            console.log(`   - Connect to the Admin Panel:`);
            console.log(
                `     - ${chalk.white(chalk.bold(`ssh -N -L 3772:localhost:80 -i ${sshPrivateKeyFile} root@${relayServer.ip}`))}`,
            );
            console.log(`   - Connect to the Relay Server via SSH:`);
            console.log(
                `     - ${chalk.white(chalk.bold(`ssh -i ${sshPrivateKeyFile} root@${relayServer.ip}`))}`,
            );
        }
    }
}
