/**
 * # Convert Serialized Query back to object
 */
export default function deserializeQuery(
    query: string | { [s: string]: any }
): {
    [s: string]: any;
} {
    let queryObject: { [s: string]: any } =
        typeof query == "object" ? query : Object(JSON.parse(query));

    const keys = Object.keys(queryObject);

    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (!key) continue;
        const value = queryObject[key];

        if (typeof value == "string") {
            if (value.match(/^\{|^\[/)) {
                queryObject[key] = JSON.parse(value);
            }
        }
    }

    return queryObject;
}
