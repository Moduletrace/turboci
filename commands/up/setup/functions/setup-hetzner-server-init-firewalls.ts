import Hetzner from "../../../../platforms/hetzner";
import type {
    TCIConfigDeployment,
    TCIConfigServiceConfig,
} from "../../../../types";
import grabAppNames from "../../../../utils/grab-app-names";
import _ from "lodash";
import grabFirewallName from "@/utils/grab-firewall-name";

type Params = {
    service: TCIConfigServiceConfig;
    serviceName: string;
    deployment: Omit<TCIConfigDeployment, "services">;
};

export default async function ({ service, serviceName, deployment }: Params) {
    const deploymentName = deployment.deployment_name;

    const { loadBalancerFirewallName, dbLoadBalancerFirewallName } =
        grabAppNames({
            name: deploymentName,
            serviceName,
            deployment,
        });

    const firewall =
        service.type == "load_balancer"
            ? (await Hetzner.firewalls.list({ name: loadBalancerFirewallName }))
                  ?.firewalls?.[0]
            : service.type == "haproxy" ||
                service.type == "proxysql" ||
                service.type == "maxscale"
              ? (
                    await Hetzner.firewalls.list({
                        name: dbLoadBalancerFirewallName,
                    })
                )?.firewalls?.[0]
              : undefined;

    const defined_firewalls = service.firewalls?.map((fw) =>
        grabFirewallName({ config: deployment, firewall_name: fw }),
    );

    let final_firewalls: number[] = [];

    if (firewall?.id) {
        final_firewalls.push(firewall.id);
    }

    if (defined_firewalls?.[0]) {
        for (let i = 0; i < defined_firewalls.length; i++) {
            const defined_firewall = defined_firewalls[i];
            const fw = (
                await Hetzner.firewalls.list({ name: defined_firewall })
            )?.firewalls?.[0];
            if (fw?.id) {
                final_firewalls.push(fw.id);
            }
        }
    }

    return final_firewalls?.map((fw) => ({
        firewall: fw,
    }));
}
