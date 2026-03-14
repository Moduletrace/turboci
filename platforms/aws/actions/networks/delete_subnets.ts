import { DeleteSubnetCommand } from "@aws-sdk/client-ec2";
import { AWSEC2Client } from "../../clients/ec2";
import list_subnets from "./list_subnets";

type Params = {
    region: string;
    subnet_id?: string;
    vpc_id?: string;
};

export default async function ({ region, subnet_id, vpc_id }: Params) {
    const EC2Client = AWSEC2Client({ region });

    let res;

    if (subnet_id) {
        res = await EC2Client.send(
            new DeleteSubnetCommand({
                SubnetId: subnet_id,
            })
        );
    }

    if (vpc_id) {
        const allSubnets = await list_subnets({
            region,
            vpc_id,
        });

        if (allSubnets.subnets?.[0]) {
            for (let i = 0; i < allSubnets.subnets.length; i++) {
                const subnet = allSubnets.subnets[i];
                await EC2Client.send(
                    new DeleteSubnetCommand({
                        SubnetId: subnet?.SubnetId,
                    })
                );
            }
        }
    }

    return { del: res };
}
