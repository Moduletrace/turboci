import { EC2Client, DescribeVpcsCommand } from "@aws-sdk/client-ec2";

function cidrBaseToNumber(cidr: string): number {
    const match = cidr.match(/^10\.(\d+)\./);
    if (!match?.[1]) return -1;
    return match ? parseInt(match[1], 10) : -1;
}

export default async function awsGetNextAvailableCidrBlock(ec2: EC2Client) {
    const res = await ec2.send(new DescribeVpcsCommand({}));
    const usedCidrBases = new Set(
        (res.Vpcs ?? [])
            .map((v) => v.CidrBlock)
            .filter(Boolean)
            .map((cidr) => cidrBaseToNumber(cidr!))
    );

    for (let i = 0; i < 256; i++) {
        if (!usedCidrBases.has(i)) {
            return `10.${i}.0.0/16`;
        }
    }

    throw new Error("No available /16 blocks in 10.0.0.0/8 range");
}
