import Hetzner from "..";
import type { HetznerServerTypes } from "../types/server-types";

type Params = {
    server_type?: string;
};

export default async function hetznerGrabServerType(
    params?: Params
): Promise<(typeof HetznerServerTypes)[number]["name"]> {
    if (!process.env.TURBOCI_HETZNER_API_KEY) {
        console.error(`\`TURBOCI_HETZNER_API_KEY\` env variable is missing.`);
        process.exit(1);
    }

    if (params?.server_type) {
        const targetServerTypesRes = await Hetzner.server_types.list();
        const targetServerTypes = targetServerTypesRes.server_types;

        if (!targetServerTypes?.[0]) {
            console.error(`COuldn't Fetch Hetzner Server Types!`);
            process.exit(1);
        }

        const targetServerType = targetServerTypes.find((t) =>
            t.name.match(new RegExp(`${params.server_type}`))
        );

        return targetServerType?.name || "cpx11";
    }

    return "cpx11";
}
