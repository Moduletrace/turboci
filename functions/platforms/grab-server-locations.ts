import Hetzner from "../../platforms/hetzner";
import { HetznerLocations } from "../../platforms/hetzner/types";
import { CloudProviders } from "../../types";
import type { GrabServerTypesReturn } from "./grab-server-types";

type Params = {
    provider: (typeof CloudProviders)[number]["value"];
};

export default async function grabServerLocations({
    provider,
}: Params): Promise<GrabServerTypesReturn[]> {
    switch (provider) {
        case "hetzner":
            const HetznerLocationsRes = await Hetzner.locations.list();

            const finalHetznerImages =
                HetznerLocationsRes.locations || HetznerLocations;

            const opts: GrabServerTypesReturn[] = finalHetznerImages.map(
                (hzLoc) => ({
                    name: `${hzLoc.name}`,
                    description: `${hzLoc.description} | ${hzLoc.network_zone}`,
                    value: hzLoc.name,
                })
            );

            return opts;

        default:
            return [];
    }
}
