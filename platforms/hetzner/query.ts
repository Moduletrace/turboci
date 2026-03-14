import { AppNames } from "../../utils/app-names";
import serializeQuery from "../../utils/serialize-query";
import type {
    HETZNER_API_ACTIONS,
    HETZNER_API_PATHS,
    HETZNER_API_RESPONSE_DATA,
} from "./types";

type Param = {
    path: (typeof HETZNER_API_PATHS)[number];
    options?: RequestInit;
    id?: string | number;
    query_params?: { [k: string]: any };
    body?: { [k: string]: any };
    action?: (typeof HETZNER_API_ACTIONS)[number];
};

export default async function hetznerQuery<
    ResData extends { [key: string]: any } = any
>({ path, options, id, query_params, body, action }: Param) {
    try {
        let finalPath = path;
        if (id) finalPath += `/${id}`;
        if (action) finalPath += `/actions/${action}`;

        let url = `https://api.hetzner.cloud/v1/${finalPath}`;

        if (query_params) {
            url += serializeQuery(query_params);
        }

        const fetchOptions: RequestInit = {
            ...options,
            headers: {
                Authorization: `Bearer ${
                    process.env[AppNames["HetznerAPIKeyEnvName"]]
                }`,
                "Content-Type": "application/json",
                ...options?.headers,
            },
            body: body ? JSON.stringify(body) : options?.body,
        };

        const res = await fetch(url, fetchOptions);

        const result = (await res.json()) as HETZNER_API_RESPONSE_DATA<ResData>;

        return result;
    } catch (error: any) {
        console.log(`Hetzner Query Error: ${error.message}`);
        return undefined;
    }
}
