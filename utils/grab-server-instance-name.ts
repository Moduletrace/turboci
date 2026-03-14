import type { CloudProviders } from "../types";
import slugify from "./slugify";

type Params = {
    serviceName: string;
    index: number;
    platform: (typeof CloudProviders)[number]["value"];
};

export default function grabServerInstanceName({
    index,
    serviceName,
    platform,
}: Params) {
    let finalName = `${serviceName}_${index}`;

    if (platform == "hetzner") {
        return slugify(finalName);
    }

    return finalName;
}
