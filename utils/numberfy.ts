export default function numberfy(num: any, decimals?: number): number {
    try {
        const numberString = String(num)
            .replace(/[^0-9\.]/g, "")
            .replace(/\.$/, "");

        if (!numberString.match(/./)) return 0;

        const existingDecimals = numberString.match(/\./)
            ? numberString.split(".").pop()?.length
            : undefined;

        const numberfiedNum = Number(numberString);

        if (typeof numberfiedNum !== "number") return 0;
        if (isNaN(numberfiedNum)) return 0;

        if (decimals == 0) {
            return Math.round(Number(numberfiedNum));
        } else if (decimals) {
            return Number(numberfiedNum.toFixed(decimals));
        }

        if (existingDecimals)
            return Number(numberfiedNum.toFixed(existingDecimals));
        return Math.round(numberfiedNum);
    } catch (error: any) {
        console.log(`Numberfy ERROR: ${error.message}`);
        return 0;
    }
}

export const _n = numberfy;
