import Hetzner from "..";
import type { HETZNER_EXISTING_SERVER } from "../types";

type Params = {
    server: HETZNER_EXISTING_SERVER;
};

export default async function hetznerWaitForServerStart({ server }: Params) {
    let retries = 0;
    const WAIT_DURATION = 5000;

    while (true) {
        if (retries > 10) {
            return false;
        }

        const serverCurrentInfo = await Hetzner.servers.get({
            server_id: server.id,
        });

        if (serverCurrentInfo.server?.status == "running") {
            break;
        }

        retries++;

        await Bun.sleep(WAIT_DURATION);
    }

    return true;
}
