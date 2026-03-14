import TurboCIAWS from "@/platforms/aws";
import {
    TurboCIPreferedOS,
    type ParsedDeploymentServiceConfig,
    type TCIGlobalConfig,
} from "@/types";

type Params = {
    deployment: Omit<TCIGlobalConfig, "services">;
    os?: string;
};

export default async function grabPreferedOSType({
    deployment,
    os,
}: Params): Promise<(typeof TurboCIPreferedOS)[number]> {
    switch (deployment.provider) {
        case "hetzner":
            if (!os) {
                return "debian";
            }

            for (let i = 0; i < TurboCIPreferedOS.length; i++) {
                const preferedOS = TurboCIPreferedOS[i];
                if (preferedOS && os.match(new RegExp(`${preferedOS}`))) {
                    return preferedOS;
                }
            }

            return "debian";

        case "aws":
            const image = await TurboCIAWS.images.get({
                region: deployment.location!,
                ami: os || "ami-0702a3ce7f850fb87",
            });

            if (!image.image?.Name) {
                throw new Error(`No AWS image object found for this AMI`);
            }

            if (image.image.Name.match(/debian/i)) {
                return "debian";
            }

            if (image.image.Name.match(/ubuntu/i)) {
                return "ubuntu";
            }

            throw new Error(`This AWS image is not supported yet`);

        default:
            throw new Error(`Platform not supported yet`);
    }
}
