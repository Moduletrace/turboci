import TurboCIGCP from "..";

type Params = {
    name: string;
    zone: string;
};

export default async function gcpWaitForServerStart({ name, zone }: Params) {
    let retries = 0;
    const WAIT_DURATION = 5000;

    while (true) {
        if (retries > 30) {
            return false;
        }

        const serverCurrentInfo = await TurboCIGCP.servers.get({ zone, name });

        if (serverCurrentInfo.server?.status === "RUNNING") {
            break;
        }

        retries++;
        await Bun.sleep(WAIT_DURATION);
    }

    return true;
}
