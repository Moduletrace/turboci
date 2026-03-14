import TurboCIAWS from "@/platforms/aws";
import type {
    ParsedDeploymentServiceConfig,
    TCIConfigDeployment,
} from "../../../../types";
import { AppNames } from "../../../../utils/app-names";
import grabAppNames from "../../../../utils/grab-app-names";
import _ from "lodash";
import { waitUntilInstanceTerminated } from "@aws-sdk/client-ec2";
import { AWSEC2Client } from "@/platforms/aws/clients/ec2";

type Params = {
    service: ParsedDeploymentServiceConfig;
    deployment: Omit<TCIConfigDeployment, "services">;
};

export default async function ({ service, deployment }: Params) {
    const deploymentName = deployment.deployment_name;

    const { finalServiceName } = grabAppNames({
        name: deploymentName,
        serviceName: service.service_name,
    });

    const servers = await TurboCIAWS.servers.list({
        region: deployment.location!,
        tag: {
            [AppNames["TurboCILabelServiceNameKey"]]: finalServiceName,
        },
    });

    if (!servers.servers?.[0]) {
        return true;
    }

    const deleteServer = await TurboCIAWS.servers.delete({
        region: deployment.location!,
        instance_id: servers.servers.map((s) => s.InstanceId!),
    });

    const EC2Client = AWSEC2Client({ region: deployment.location! });

    await waitUntilInstanceTerminated(
        {
            client: EC2Client,
            maxWaitTime: 600,
        },
        {
            InstanceIds: servers.servers.map((s) => s.InstanceId!),
        },
    );

    return Boolean(deleteServer);
}
