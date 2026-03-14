import type { TCIGitParadigms } from "@/types";
import { AppNames } from "./app-names";

export interface CloneUrlOptions {
    platform: (typeof TCIGitParadigms)[number]["value"];
    full_name: string;
    username?: string;
    api_key?: string;
    host?: string;
    public_repo?: boolean;
}

export default function grabGitCloneURL({
    platform,
    full_name,
    username: passed_username,
    host,
    public_repo,
    api_key,
}: CloneUrlOptions): string | undefined {
    let url: URL;
    let username: string | undefined = passed_username;
    let token: string | undefined = api_key;

    switch (platform) {
        case "github":
            host = host ?? "github.com";
            url = new URL(`https://${host}/${full_name}.git`);

            if (!public_repo) {
                username = "x-access-token";
                token = token || process.env[AppNames["GithubAPIKey"]] || "";
            }

            break;

        case "gitlab":
            host = host ?? "gitlab.com";
            url = new URL(`https://${host}/${full_name}.git`);

            if (!public_repo) {
                username = "oauth2";
                token = token || process.env[AppNames["GitlabAPIKey"]] || "";
            }

            break;

        case "gitea":
            if (!username || !host) {
                url = new URL(`https://${host}/${full_name}.git`);
                throw new Error(
                    "Gitea requires a username for token authentication, and a host.",
                );
            }

            url = new URL(`https://${host}/${full_name}.git`);

            if (!public_repo) {
                token = token || process.env[AppNames["GiteaAPIKey"]] || "";
            }

            break;

        default:
            return undefined;
    }

    url.username = username || "";
    url.password = token || "";

    return url.toString();
}
