import { google } from "googleapis";
import { AppNames } from "@/utils/app-names";
import { GoogleAuth } from "google-auth-library";

export default async function getGCPClient() {
    const credentials = {
        client_email: process.env[AppNames["GCPServiceAccountEmail"]],
        private_key: process.env[
            AppNames["GCPServiceAccountPrivateKey"]
        ]!.replace(/\\n/g, "\n"),
    };

    const auth = new GoogleAuth({
        credentials,
        projectId: process.env[AppNames["GCPProjectID"]]!,
        scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });

    const compute = google.compute({
        version: "v1",
        auth,
    });

    return { GCPCompute: compute };
}
