import { describe, expect, test } from "bun:test";
import {
  BackupCryptoError,
  PBKDF2_ITERATIONS,
  decodeBase64,
  decryptWithPassphrase,
  encodeBase64,
  encryptWithPassphrase,
} from "./crypto";

describe("base64 helpers", () => {
  test("round-trips small and large binary data", () => {
    const small = new Uint8Array([0, 1, 2, 253, 254, 255]);
    expect([...decodeBase64(encodeBase64(small))]).toEqual([...small]);

    const large = new Uint8Array(200_000);
    for (let index = 0; index < large.length; index += 1) {
      large[index] = index % 251;
    }
    expect([...decodeBase64(encodeBase64(large))]).toEqual([...large]);
  });
});

describe("encryptWithPassphrase / decryptWithPassphrase", () => {
  test("round-trips the payload and uses the requested iterations", async () => {
    const plaintext = new TextEncoder().encode("secret story payload");
    const encrypted = await encryptWithPassphrase(plaintext, "correct horse", PBKDF2_ITERATIONS);

    expect(encrypted.kdfIterations).toBe(PBKDF2_ITERATIONS);
    expect(encrypted.kdfSalt.length).toBe(16);
    expect(encrypted.cipherIv.length).toBe(12);

    const decrypted = await decryptWithPassphrase(encrypted, "correct horse");
    expect(new TextDecoder().decode(decrypted)).toBe("secret story payload");
  });

  test("rejects a wrong passphrase via AES-GCM authentication", async () => {
    const encrypted = await encryptWithPassphrase(
      new TextEncoder().encode("payload"),
      "right",
      1000,
    );
    expect(decryptWithPassphrase(encrypted, "wrong")).rejects.toBeInstanceOf(BackupCryptoError);
  });

  test("detects tampered ciphertext", async () => {
    const encrypted = await encryptWithPassphrase(new TextEncoder().encode("payload"), "pw", 1000);
    encrypted.cipherData[0] ^= 0xff;
    expect(decryptWithPassphrase(encrypted, "pw")).rejects.toBeInstanceOf(BackupCryptoError);
  });

  test("never emits the plaintext passphrase into the encrypted material", async () => {
    const passphrase = "super-secret-passphrase";
    const encrypted = await encryptWithPassphrase(new TextEncoder().encode("x"), passphrase, 1000);
    const materialText = [
      encodeBase64(encrypted.cipherData),
      encodeBase64(encrypted.kdfSalt),
      encodeBase64(encrypted.cipherIv),
    ].join("");
    expect(materialText.includes(passphrase)).toBe(false);
  });
});
