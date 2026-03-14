import list, { type AWSListServersParams } from "./list";

export default async function (params: AWSListServersParams) {
    const serversRes = await list(params);
    return { server: serversRes?.servers?.[0] };
}
