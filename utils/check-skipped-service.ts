import type {
    CommanderDefaultOptions,
    ParsedDeploymentServiceConfig,
    TCIGlobalConfig,
} from "@/types";

type Params = {
    options?: CommanderDefaultOptions;
    deployment: TCIGlobalConfig;
    service: ParsedDeploymentServiceConfig;
};

export default function ({ deployment, service, options }: Params) {
    if (!options?.skip || !options.target) return false;

    if (options?.target?.[0]) {
        for (let i = 0; i < options.target.length; i++) {
            const target_service = options.target[i];
            if (!target_service) return false;

            const { deployment_name, service_name } =
                parseDeploymentServiceStr(target_service);

            const final_service_name =
                service.parent_service_name || service.service_name;

            if (
                !options.target.find((s) =>
                    s.match(
                        new RegExp(
                            deployment_name
                                ? `^${deployment.deployment_name}.${final_service_name}$`
                                : `^${final_service_name}$`,
                        ),
                    ),
                )
            ) {
                return true;
            }

            if (
                service_name &&
                !deployment_name &&
                service_name !== final_service_name
            ) {
                return true;
            }

            if (
                service_name &&
                deployment_name &&
                service_name !== final_service_name &&
                deployment.deployment_name !== deployment_name
            ) {
                return true;
            }
        }
    }

    if (options?.skip?.[0]) {
        for (let i = 0; i < options.skip.length; i++) {
            const skipped_service = options.skip[i];
            if (!skipped_service) return false;

            const { deployment_name, service_name } =
                parseDeploymentServiceStr(skipped_service);

            if (
                service_name &&
                deployment_name &&
                service_name == "*" &&
                deployment.deployment_name == deployment_name
            ) {
                return true;
            }

            if (
                service &&
                service_name &&
                deployment_name &&
                (service_name == service.service_name ||
                    service_name == service.parent_service_name) &&
                deployment.deployment_name == deployment_name
            ) {
                return true;
            }

            if (service_name && !deployment_name && service_name == "*") {
                return true;
            }

            if (
                service &&
                service_name &&
                !deployment_name &&
                (service_name == service.service_name ||
                    service_name == service.parent_service_name)
            ) {
                return true;
            }
        }
    }

    return false;
}

function parseDeploymentServiceStr(str: string) {
    const arr = str.split(".");

    const deployment_name =
        arr.length == 1 ? undefined : arr.length == 2 ? arr[0] : undefined;
    const service_name =
        arr.length == 1 ? arr[0] : arr.length == 2 ? arr[1] : undefined;

    return { deployment_name, service_name };
}
