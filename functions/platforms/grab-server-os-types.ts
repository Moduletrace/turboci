import Hetzner from "../../platforms/hetzner";
import { HetznerImages } from "../../platforms/hetzner/types/images";
import {
    TurboCIOsPreferenceRegexp,
    CloudProviders,
    TurboCIPreferedOS,
} from "../../types";
import type { GrabServerTypesReturn } from "./grab-server-types";

type Params = {
    provider: (typeof CloudProviders)[number]["value"];
    server_type?: string;
};

export default async function grabServerOperatingSystemTypes({
    provider,
    server_type,
}: Params): Promise<GrabServerTypesReturn[]> {
    let serverTypes: GrabServerTypesReturn[] = [];

    switch (provider) {
        case "hetzner":
            const hetznerServerTypesRes = server_type
                ? await Hetzner.server_types.list({ name: server_type })
                : undefined;

            const hetznerServerType = hetznerServerTypesRes?.server_types?.[0];

            const HetznerLatestImagesRes = await Hetzner.images.list({
                filter_fn: async (images) => {
                    return images.filter(
                        (img) =>
                            Boolean(
                                img.name.match(TurboCIOsPreferenceRegexp)
                            ) &&
                            (hetznerServerType?.architecture
                                ? img.architecture ==
                                  hetznerServerType.architecture
                                : true)
                    );
                },
            });

            const finalHetznerImages =
                HetznerLatestImagesRes.images || HetznerImages;

            const opts = finalHetznerImages.map((hzImg) => ({
                name: `${hzImg.name} | ${hzImg.architecture}`,
                value: hzImg.name,
            }));

            serverTypes = opts;
            break;

        default:
            break;
    }

    return serverTypes.filter((t) =>
        TurboCIPreferedOS.find((o) => t.name.match(new RegExp(`${o}`, `i`)))
    );
}
