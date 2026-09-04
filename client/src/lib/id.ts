const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ' // Crockford Base32 to avoid confusion and help readability (excludes: I,L,O,U)

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
    const pattern = /^(?:[0-9A-HJ-KM-NP-TV-Z]{4}-){2}[0-9A-HJ-KM-NP-TV-Z]{4}$/;
    return pattern.test(clean);
}