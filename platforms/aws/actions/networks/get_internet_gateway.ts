import type { AWSInternetGatewayNames } from "./create_internet_gateway";
import list_internet_gateways from "./list_internet_gateways";

type Params = {
    region: string;
    igw_name?: (typeof AWSInternetGatewayNames)[number];
    igw_ids?: string[];
};

export default async function ({ region, igw_name }: Params) {
    const route_tables = await list_internet_gateways({ region, igw_name });
    return { internet_gateway: route_tables.internet_gateways?.[0] };
}
