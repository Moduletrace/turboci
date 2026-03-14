import Hetzner from "..";
import {
    HetznerLocations,
    type HETZNER_NETWORK,
    type HETZNER_NETWORK_SUBNET,
} from "../types";

type HetznerNextAvailableNetworkReturn = {
    ip_range: string;
    subnets: HETZNER_NETWORK_SUBNET[];
};

type Params = {
    location: (typeof HetznerLocations)[number]["name"];
};

export default async function hetznerGrabNextAvailableNetwork({
    location,
}: Params): Promise<HetznerNextAvailableNetworkReturn> {
    const ntwkRes = await Hetzner.networks.list();
    const availableNetworks = ntwkRes.networks;

    const HetznerLiveLocations = (await Hetzner.locations.list()).locations;

    const targetLocation = (HetznerLiveLocations || HetznerLocations).find(
        (loc) => loc.name == location
    );
    const network_zone = targetLocation?.network_zone as any;

    if (!network_zone) {
        throw new Error(`network_zone not found!`);
    }

    if (!availableNetworks?.[0]) {
        const networkPrefix = `10.0.0.0`;

        return {
            ip_range: `${networkPrefix}/16`,
            subnets: [
                {
                    type: "cloud",
                    ip_range: `${networkPrefix}/24`,
                    network_zone,
                    vswitch_id: 1000,
                },
            ],
        };
    }

    const latestNetwork = availableNetworks.pop() as HETZNER_NETWORK;

    const lastIpRange = latestNetwork.ip_range;
    const lastIpRangeNumber = lastIpRange.split("/")[0]?.split(".")[1];

    const nextIpRangeNumber = lastIpRangeNumber
        ? Number(lastIpRangeNumber) + 1
        : 0;

    const nextIpPrefix = `10.${nextIpRangeNumber}.0.0`;

    return {
        ip_range: `${nextIpPrefix}/16`,
        subnets: [
            {
                type: "cloud",
                ip_range: `${nextIpPrefix}/24`,
                network_zone,
                vswitch_id: 1000,
            },
        ],
    };
}
