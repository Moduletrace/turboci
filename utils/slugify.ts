/**
 * # Return the slug of a string
 *
 * @example
 * slugify("Hello World") // "hello-world"
 * slugify("Yes!") // "yes"
 * slugify("Hello!!! World!") // "hello-world"
 */
export default function slugify(
    str?: string,
    divider?: "-" | "_" | null,
    allowTrailingDash?: boolean | null
): string {
    const finalSlugDivider = divider || "_";

    try {
        if (!str) return "";

        let finalStr = String(str)
            .trim()
            .toLowerCase()
            .replace(/ {2,}/g, " ")
            .replace(/ /g, finalSlugDivider)
            .replace(/[^a-z0-9]/g, finalSlugDivider)
            .replace(/-{2,}|_{2,}/g, finalSlugDivider)
            .replace(/^-/, "");

        if (allowTrailingDash) {
            return finalStr;
        }

        return finalStr.replace(/-$/, "");
    } catch (error: any) {
        console.log(`Slugify ERROR: ${error.message}`);
        return "";
    }
}
