/**
 * WebCrypto helpers for encrypted backups (REDESIGN.md §3.3).
 *
 * WebCrypto only — no external crypto dependency. The passphrase is never
 * stored or logged anywhere; it is stretched into a key that lives in memory
 * for the duration of one encrypt/decrypt call.
 */

/** KDF iterations required by §3.3. Never lower this silently. */
export const PBKDF2_ITERATIONS = 600_000;

/** Salt length in bytes for PBKDF2. */
export const PBKDF2_SALT_BYTES = 16;

/** IV length in bytes for AES-GCM (the WebCrypto-recommended 96 bits). */
export const AES_GCM_IV_BYTES = 12;

const subtle = globalThis.crypto.subtle;
const textEncoder = new TextEncoder();

export class BackupCryptoError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "BackupCryptoError";
  }
}

/** Encodes binary data as base64 (chunked so large Blobs never blow the call stack). */
export function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

/** Decodes base64 into binary data (inverse of `encodeBase64`). */
export function decodeBase64(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

/**
 * Stretches a passphrase into an AES-GCM key with PBKDF2-SHA256.
 * Same passphrase + same salt + same iterations = same key.
 */
export async function deriveBackupKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<CryptoKey> {
  const passphraseBytes = textEncoder.encode(passphrase);
  const baseKey = await subtle.importKey("raw", passphraseBytes, "PBKDF2", false, ["deriveKey"]);
  return subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Encrypts bytes with AES-GCM under the given key. */
export async function encryptWithAesGcm(
  key: CryptoKey,
  plaintext: Uint8Array,
  iv: Uint8Array,
): Promise<Uint8Array> {
  const ciphertext = await subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    plaintext as BufferSource,
  );
  return new Uint8Array(ciphertext);
}

/** Decrypts AES-GCM bytes under the given key; throws on auth failure. */
export async function decryptWithAesGcm(
  key: CryptoKey,
  ciphertext: Uint8Array,
  iv: Uint8Array,
): Promise<Uint8Array> {
  const plaintext = await subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    ciphertext as BufferSource,
  );
  return new Uint8Array(plaintext);
}

export function createRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

/** Result of encrypting a payload under a passphrase: ready for envelope packing. */
export interface EncryptedPayload {
  kdfSalt: Uint8Array;
  kdfIterations: number;
  cipherIv: Uint8Array;
  cipherData: Uint8Array;
}

/**
 * One-shot encrypt: derive key from passphrase with a fresh random salt,
 * encrypt with a fresh random IV.
 */
export async function encryptWithPassphrase(
  plaintext: Uint8Array,
  passphrase: string,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<EncryptedPayload> {
  const kdfSalt = createRandomBytes(PBKDF2_SALT_BYTES);
  const cipherIv = createRandomBytes(AES_GCM_IV_BYTES);
  const key = await deriveBackupKey(passphrase, kdfSalt, iterations);
  const cipherData = await encryptWithAesGcm(key, plaintext, cipherIv);
  return { kdfSalt, kdfIterations: iterations, cipherIv, cipherData };
}

/**
 * One-shot decrypt. Throws `BackupCryptoError` when the passphrase is wrong
 * or the data was tampered with (AES-GCM authentication failure).
 */
export async function decryptWithPassphrase(
  encrypted: EncryptedPayload,
  passphrase: string,
): Promise<Uint8Array> {
  const key = await deriveBackupKey(passphrase, encrypted.kdfSalt, encrypted.kdfIterations);
  try {
    return await decryptWithAesGcm(key, encrypted.cipherData, encrypted.cipherIv);
  } catch (error) {
    throw new BackupCryptoError("Wrong passphrase or corrupted backup: decryption failed.", {
      cause: error,
    });
  }
}
