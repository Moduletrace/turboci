import list_subnets from "./list_subnets";

type Params = {
    region: string;
    vpc_id: string;
    subnet_name?: string;
};

export default async function ({ region, vpc_id, subnet_name }: Params) {
    const subnets = await list_subnets({ region, subnet_name, vpc_id });
    return { subnet: subnets.subnets?.[0] };
}
