import Hetzner from "../../platforms/hetzner";
import { HetznerServerTypes } from "../../platforms/hetzner/types/server-types";
import type { CloudProviders } from "../../types";

type Params = {
    provider: (typeof CloudProviders)[number]["value"];
    location: string;
};

export type GrabServerTypesReturn = {
    name: string;
    value: string;
    description?: string;
};

export default async function grabServerTypes({
    provider,
    location,
}: Params): Promise<GrabServerTypesReturn[]> {
    switch (provider) {
        case "hetzner":
            const HetznerLatestServerTypesRes =
                await Hetzner.server_types.list();

            const finalHetznerServerTypes =
                HetznerLatestServerTypesRes.server_types || HetznerServerTypes;

            const opts = finalHetznerServerTypes.map((hzSrvTy) => {
                const serverPrices = hzSrvTy.prices;
                const targetPrice = serverPrices.find(
                    (prc) => prc.location == location
                );
                const targetPriceNumber = Number(
                    targetPrice?.price_monthly.net
                );
                const targetPriceParsed = Number.isNaN(targetPriceNumber)
                    ? undefined
                    : `$${targetPriceNumber.toFixed(2)}/Mo`;

                if (!targetPriceParsed) return;

                return {
                    name: `${hzSrvTy.description}`,
                    description: `${hzSrvTy.architecture} | ${hzSrvTy.cores} cpus | ${hzSrvTy.memory}GB RAM | ${hzSrvTy.disk}GB Disk | ${targetPriceParsed}`,
                    value: hzSrvTy.name,
                };
            });

            return opts.filter((opt) =>
                Boolean(opt?.value)
            ) as GrabServerTypesReturn[];

        default:
            return [];
    }
}
