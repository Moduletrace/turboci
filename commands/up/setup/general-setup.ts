import setupFirewalls from "./setup-firewalls";
import setupNetwork from "./setup-network";
import setupSshKey from "./setup-ssh-key";

export default async function () {
    /**
     * # Set up Networks
     */
    global.ORA_SPINNER.text = `Setting up Networks ...`;
    global.ORA_SPINNER.start();

    const setupNtwk = await setupNetwork();

    if (setupNtwk) {
        global.ORA_SPINNER.succeed(`Networks Setup Successful!`);
    } else {
        global.ORA_SPINNER.fail(`Networks Setup Failed!`);
        process.exit(1);
    }

    /**
     * # Set up Firewalls
     */
    global.ORA_SPINNER.text = `Setting up Firewalls ...`;
    global.ORA_SPINNER.start();

    const setupFirewlls = await setupFirewalls();

    if (setupFirewlls) {
        global.ORA_SPINNER.succeed(`Firewalls Setup Successful!`);
    } else {
        global.ORA_SPINNER.fail(`Firewalls Setup Failed!`);
        process.exit(1);
    }

    /**
     * # Set up SSH Keys
     */
    global.ORA_SPINNER.text = `Setting up SSH Keys ...`;
    global.ORA_SPINNER.start();

    const setupSSHKey = await setupSshKey();

    if (setupSSHKey) {
        global.ORA_SPINNER.succeed(`SSH Keys Setup Successful!`);
    } else {
        global.ORA_SPINNER.fail(`SSH Keys Setup Failed!`);
        process.exit(1);
    }

    global.ORA_SPINNER.stop();
}
