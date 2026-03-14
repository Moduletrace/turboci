export default function generateRandomPassword(length = 16) {
    const charset =
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@()[]";
    let password = "";

    // Create an array to hold cryptographically strong random values
    const randomValues = new Uint32Array(length);
    crypto.getRandomValues(randomValues);

    for (let i = 0; i < length; i++) {
        const value = randomValues[i];
        if (!value) continue;
        password += charset[value % charset.length];
    }

    return password;
}
