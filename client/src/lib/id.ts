const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ' //Excluding 1,I,O,0 to help readability and prevent confusion

export function generateUserId(): string {
    const length = 12;
    const randomBytes = new Uint8Array(length);

    window.crypto.getRandomValues(randomBytes);

    let result = '';
    for (let i = 0; i < length; i++) {
        const charIndex = randomBytes[i] & 31;
        result += ALPHABET[charIndex];
    }

    return `${result.slice(0, 4)}-${result.slice(4, 8)}-${result.slice(8, 12)}`;
}

export function isValidUserId(id: string): boolean {
    const clean = id.trim().toUpperCase();
    const pattern = /^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/;
    return pattern.test(clean);
}