export default function normalizeText(txt: string) {
    return txt
        .replace(/\n|\r|\n\r/g, " ")
        .replace(/ {2,}/g, " ")
        .trim();
}
