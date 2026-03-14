import { AppNames } from "@/utils/app-names";

const AZURE_MANAGEMENT_URL = "https://management.azure.com";
const NETWORK_API_VERSION = "2023-05-01";
const COMPUTE_API_VERSION = "2023-07-01";

let _tokenCache: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
    if (_tokenCache && Date.now() < _tokenCache.expiresAt) {
        return _tokenCache.token;
    }

    const tenantId = process.env[AppNames["AzureTenantIdEnvName"]];
    const clientId = process.env[AppNames["AzureClientIdEnvName"]];
    const clientSecret = process.env[AppNames["AzureClientSecretEnvName"]];

    if (!tenantId || !clientId || !clientSecret) {
        throw new Error(
            `Missing Azure credentials. Set ${AppNames["AzureTenantIdEnvName"]}, ${AppNames["AzureClientIdEnvName"]}, ${AppNames["AzureClientSecretEnvName"]}`,
        );
    }

    const body = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://management.azure.com/.default",
    });

    const res = await fetch(
        `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
        {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString(),
        },
    );

    if (!res.ok) {
        const error = await res.text();
        throw new Error(`Azure auth failed: ${res.status} ${error}`);
    }

    const data = (await res.json()) as {
        access_token: string;
        expires_in: number;
    };

    _tokenCache = {
        token: data.access_token,
        expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    };

    return data.access_token;
}

export function getAzureResourceGroup(deployment_name: string): string {
    const slug = deployment_name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    return `turboci_${slug}_rg`;
}

export async function azureRequest<T = any>(
    path: string,
    method: string = "GET",
    body?: any,
    apiVersion?: string,
): Promise<{ data: T; status: number }> {
    const subscriptionId = process.env[AppNames["AzureSubscriptionIdEnvName"]];

    if (!subscriptionId) {
        throw new Error(
            `Missing ${AppNames["AzureSubscriptionIdEnvName"]} environment variable`,
        );
    }

    const token = await getAccessToken();
    const version = apiVersion || COMPUTE_API_VERSION;

    const url = `${AZURE_MANAGEMENT_URL}/subscriptions/${subscriptionId}${path}?api-version=${version}`;

    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
    };

    if (body && method !== "GET") {
        options.body = JSON.stringify(body);
    }

    const res = await fetch(url, options);

    if (!res.ok && res.status !== 404) {
        const error = await res.text();
        throw new Error(`Azure API error ${res.status}: ${error}`);
    }

    let data: T;
    try {
        data = (await res.json()) as T;
    } catch (_e) {
        data = {} as T;
    }

    return { data, status: res.status };
}

export async function azureNetworkRequest<T = any>(
    path: string,
    method: string = "GET",
    body?: any,
): Promise<{ data: T; status: number }> {
    return azureRequest<T>(path, method, body, NETWORK_API_VERSION);
}

export async function azureComputeRequest<T = any>(
    path: string,
    method: string = "GET",
    body?: any,
): Promise<{ data: T; status: number }> {
    return azureRequest<T>(path, method, body, COMPUTE_API_VERSION);
}

export async function waitForAzureOperation(
    operationUrl: string,
    maxRetries = 60,
): Promise<boolean> {
    const token = await getAccessToken();

    for (let i = 0; i < maxRetries; i++) {
        const res = await fetch(operationUrl, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) return false;

        const data = (await res.json()) as any;
        const status = data?.status || data?.properties?.provisioningState;

        if (status === "Succeeded") return true;
        if (status === "Failed" || status === "Canceled") return false;

        await Bun.sleep(5000);
    }

    return false;
}
