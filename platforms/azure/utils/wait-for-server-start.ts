import TurboCIAzure from "..";

type Params = {
    deployment_name: string;
    name: string;
};

export default async function azureWaitForServerStart({
    deployment_name,
    name,
}: Params) {
    let retries = 0;
    const WAIT_DURATION = 5000;

    while (true) {
        if (retries > 30) {
            return false;
        }

        const serverInfo = await TurboCIAzure.servers.get({
            deployment_name,
            name,
        });

        const state =
            serverInfo.server?.properties?.provisioningState;

        if (state === "Succeeded") {
            break;
        }

        if (state === "Failed") {
            return false;
        }

        retries++;
        await Bun.sleep(WAIT_DURATION);
    }

    return true;
}
