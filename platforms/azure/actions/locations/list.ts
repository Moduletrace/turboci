import { azureRequest } from "../../client";

export default async function () {
    const res = await azureRequest<{ value: any[] }>(
        `/locations`,
        "GET",
        undefined,
        "2022-12-01"
    );

    return { locations: res.data?.value || [] };
}
