const ITERATIONS = 210000;

const textEncoder = new TextEncoder();

export async function hashPassword(password: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await deriveBits(password, salt, ITERATIONS);

    return `${ITERATIONS}:${toHex(salt)}:${toHex(hash)}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
    const parts = storedHash.split(":");
    if (parts.length !== 3) return false;

    const [iterationsStr, saltHex, hashHex] = parts;
    const iterations = parseInt(iterationsStr, 10);
    const salt = fromHex(saltHex);
    const expectedHash = fromHex(hashHex);

    if (isNaN(iterations) || salt.length === 0 || expectedHash.length === 0) {
        return false;
    }

    const actualHash = await deriveBits(password, salt, iterations);
    return timingSafeEqual(actualHash, expectedHash);
}

async function deriveBits(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
    const baseKey = await crypto.subtle.importKey(
        "raw",
        textEncoder.encode(password),
        "PBKDF2",
        false,
        ["deriveBits"]
    );

    const derivedBits = await crypto.subtle.deriveBits(
        {
            name: "PBKDF2",
            salt,
            iterations,
            hash: "SHA-256",
        },
        baseKey,
        256
    );

    return new Uint8Array(derivedBits);
}

function toHex(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
    if (hex.length % 2 !== 0) return new Uint8Array(0);
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.byteLength !== b.byteLength) return false;
    let result = 0;
    for (let i = 0; i < a.byteLength; i++) {
        result |= a[i] ^ b[i];
    }
    return result === 0;
}