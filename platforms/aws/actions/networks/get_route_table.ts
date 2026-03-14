import type { AWSRouteTableNames } from "./create_route_table";
import list_route_tables from "./list_route_tables";

type Params = {
    region: string;
    route_table_name: (typeof AWSRouteTableNames)[number];
};

export default async function ({ region, route_table_name }: Params) {
    const route_tables = await list_route_tables({ region, route_table_name });
    return { route_table: route_tables.route_tables?.[0] };
}
