import _ from "lodash";
import type { DownSetupParams } from "..";
import grabAppNames from "@/utils/grab-app-names";
import TurboCIAWS from "@/platforms/aws";
import { waitUntilInstanceTerminated } from "@aws-sdk/client-ec2";
import { AWSEC2Client } from "@/platforms/aws/clients/ec2";
import type { TCIGlobalConfig } from "@/types";

export default async function ({
    deployment,
}: {
    deployment: TCIGlobalConfig;
}) {
    let isSuccess = false;

    const EC2Client = AWSEC2Client({ region: deployment.location! });

    const { sshRelayServerName } = grabAppNames({
        name: deployment.deployment_name,
    });

    const awsRelaySrvRes = await TurboCIAWS.servers.list({
        name: sshRelayServerName,
        region: deployment.location!,
    });

    const awsRelaySrv = awsRelaySrvRes.servers?.[0];

    if (awsRelaySrv?.InstanceId) {
        const delRelaySrv = await TurboCIAWS.servers.delete({
            region: deployment.location!,
            instance_id: awsRelaySrv.InstanceId,
        });

        await waitUntilInstanceTerminated(
            {
                client: EC2Client,
                maxWaitTime: 600,
            },
            {
                InstanceIds: [awsRelaySrv.InstanceId],
            },
        );

        isSuccess = Boolean(delRelaySrv);
    } else {
        isSuccess = true;
    }

    return isSuccess;
}
