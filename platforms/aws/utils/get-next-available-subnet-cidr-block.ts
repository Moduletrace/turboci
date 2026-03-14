import {
    DescribeVpcsCommand,
    DescribeSubnetsCommand,
    EC2Client,
} from "@aws-sdk/client-ec2";

type Params = {
    vpcId: string;
    subnetMask?: number;
    ec2: EC2Client;
};

export async function awsGetNextAvailableSubnetCidrBlock({
    vpcId,
    subnetMask = 24,
    ec2,
}: Params): Promise<string> {
    // 1️⃣ Fetch VPC CIDR block
    const vpcRes = await ec2.send(new DescribeVpcsCommand({ VpcIds: [vpcId] }));
    const vpcCidr = vpcRes.Vpcs?.[0]?.CidrBlock;
    if (!vpcCidr) throw new Error(`VPC ${vpcId} not found or has no CIDR`);

    const [vpcBaseIp, vpcPrefixStr] = vpcCidr.split("/");
    const vpcPrefix = parseInt(vpcPrefixStr!, 10);
    const vpcBase = ipToInt(vpcBaseIp!);

    // 2️⃣ Fetch all subnets in this VPC
    const subnetsRes = await ec2.send(
        new DescribeSubnetsCommand({
            Filters: [{ Name: "vpc-id", Values: [vpcId] }],
        })
    );

    const existingCidrs =
        subnetsRes.Subnets?.map((s) => s.CidrBlock!).filter(Boolean) ?? [];

    // 3️⃣ Iterate through potential subnets inside the VPC
    const totalSubnets = 1 << (subnetMask - vpcPrefix);
    const subnetSize = 1 << (32 - subnetMask);

    for (let i = 0; i < totalSubnets; i++) {
        const candidateBase = vpcBase + i * subnetSize;
        const candidate = `${intToIp(candidateBase)}/${subnetMask}`;

        const overlaps = existingCidrs.some((cidr) =>
            cidrOverlap(cidr, candidate)
        );
        if (!overlaps) return candidate;
    }

    throw new Error("No available CIDR blocks left in VPC");
}

/* ---------- Helper Functions ---------- */

// Convert IP address to integer
function ipToInt(ip: string): number {
    return ip
        .split(".")
        .map((x) => parseInt(x, 10))
        .reduce((acc, oct) => (acc << 8) + oct);
}

// Convert integer back to IP address
function intToIp(int: number): string {
    return [
        (int >>> 24) & 255,
        (int >>> 16) & 255,
        (int >>> 8) & 255,
        int & 255,
    ].join(".");
}

// Check if two CIDRs overlap
function cidrOverlap(a: string, b: string): boolean {
    const [aIp, aMaskStr] = a.split("/");
    const [bIp, bMaskStr] = b.split("/");
    const aInt = ipToInt(aIp!);
    const bInt = ipToInt(bIp!);
    const aMask = maskBits(parseInt(aMaskStr!, 10));
    const bMask = maskBits(parseInt(bMaskStr!, 10));

    // Two CIDRs overlap if their masked network bits intersect
    return (
        (aInt & aMask) === (bInt & aMask) || (bInt & bMask) === (aInt & bMask)
    );
}

// Create a mask for given prefix length (e.g. /24)
function maskBits(prefix: number): number {
    return prefix === 0 ? 0 : 0xffffffff << (32 - prefix);
}
