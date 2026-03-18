/**
 * Generates schema/turboci.schema.json from types.ts via typescript-json-schema,
 * then injects the $id, title, and description fields required by SchemaStore.
 */
import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";

const SCHEMA_PATH = "schema/turboci.schema.json";
const SCHEMA_ID =
    "https://raw.githubusercontent.com/Moduletrace/turboci/main/schema/turboci.schema.json";

execSync(
    `bunx typescript-json-schema tsconfig.schema.json TCIConfig` +
        ` --out ${SCHEMA_PATH}` +
        ` --required` +
        ` --titles` +
        ` --ignoreErrors`,
    { stdio: "inherit" },
);

const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));

schema["$id"] = SCHEMA_ID;
schema["title"] = "TurboCI Config";
schema["description"] =
    "TurboCI deployment configuration file (.turboci/config.yaml)";

writeFileSync(SCHEMA_PATH, JSON.stringify(schema, null, 4));

console.log(`Schema written to ${SCHEMA_PATH}`);
