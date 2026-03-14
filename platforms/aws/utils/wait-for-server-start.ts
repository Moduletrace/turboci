import type { Instance } from "@aws-sdk/client-ec2";
import TurboCIAWS from "..";

type Params = {
    server: Instance;
    region: string;
};

export default async function awsWaitForServerStart({
    server,
    region,
}: Params) {
    let retries = 0;
    const WAIT_DURATION = 5000;

    while (true) {
        if (retries > 10) {
            return false;
        }

        const serverCurrentInfo = await TurboCIAWS.servers.get({
            instance_id: server.InstanceId,
            region,
        });

        if (serverCurrentInfo.server?.State?.Name == "running") {
            break;
        }

        retries++;

        await Bun.sleep(WAIT_DURATION);
    }

    return true;
}
