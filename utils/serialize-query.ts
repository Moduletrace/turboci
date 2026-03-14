/**
 * # Serialize Query
 */
export default function serializeQuery(query: any): string {
    let str = "?";

    if (typeof query !== "object") {
        console.log("Invalid Query type");
        return str;
    }
    if (Array.isArray(query)) {
        console.log("Query is an Array. This is invalid.");
        return str;
    }
    if (!query) {
        console.log("No Query provided.");
        return str;
    }

    const keys = Object.keys(query);

    const queryArr: string[] = [];

    keys.forEach((key) => {
        if (!key || !query[key]) return;
        const value = query[key];

        if (typeof value === "object") {
            const jsonStr = JSON.stringify(value);
            queryArr.push(`${key}=${encodeURIComponent(String(jsonStr))}`);
        } else if (typeof value === "string" || typeof value === "number") {
            queryArr.push(`${key}=${encodeURIComponent(value)}`);
        } else {
            queryArr.push(`${key}=${String(value)}`);
        }
    });

    str += queryArr.join("&");
    return str;
}
