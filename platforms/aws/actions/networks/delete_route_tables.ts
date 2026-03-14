import {
    DeleteRouteTableCommand,
    DisassociateRouteTableCommand,
    type RouteTable,
} from "@aws-sdk/client-ec2";
import { AWSEC2Client } from "../../clients/ec2";
import list_route_tables from "./list_route_tables";

type Params = {
    region: string;
    route_table?: RouteTable;
    vpc_id?: string;
};

export default async function ({ region, route_table, vpc_id }: Params) {
    if (route_table) {
        const delRouteTableRes = await deleteRouteTable({
            rt: route_table,
            region,
        });
        return { del: delRouteTableRes };
    }

    if (vpc_id) {
        const allRouteTablesRes = await list_route_tables({ region, vpc_id });

        const allRouteTables = allRouteTablesRes.route_tables;

        let delRouteTableRes;

        if (allRouteTables?.[0]) {
            for (let i = 0; i < allRouteTables.length; i++) {
                const rt = allRouteTables[i];
                if (!rt?.RouteTableId) continue;

                delRouteTableRes = await deleteRouteTable({ rt, region });

                if (!delRouteTableRes) continue;

                if (
                    !delRouteTableRes.$metadata.httpStatusCode
                        ?.toString()
                        .match(/^2/)
                ) {
                    throw new Error(
                        `Route table ${rt.RouteTableId} couldn't be deleted!`
                    );
                }
            }
        }
    }

    return {};
}

async function deleteRouteTable({
    region,
    rt,
}: {
    rt: RouteTable;
    region: string;
}) {
    const EC2Client = AWSEC2Client({ region });

    if (rt.Associations?.[0]) {
        for (const assoc of rt.Associations || []) {
            if (!assoc.Main) {
                await EC2Client.send(
                    new DisassociateRouteTableCommand({
                        AssociationId: assoc.RouteTableAssociationId,
                    })
                );
            }
        }
    }

    if (!rt.Associations?.find((assoc) => assoc.Main)) {
        const delRouteTableRes = await EC2Client.send(
            new DeleteRouteTableCommand({
                RouteTableId: rt.RouteTableId,
            })
        );

        return delRouteTableRes;
    }

    return undefined;
}
