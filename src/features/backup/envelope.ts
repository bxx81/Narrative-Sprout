import {
  decodeBase64,
  encodeBase64,
  encryptWithPassphrase,
  decryptWithPassphrase,
} from "../../lib/crypto";
import {
  NS_BACKUP_FORMAT,
  NS_BACKUP_VERSION,
  nsBackupEnvelopeSchema,
  type NSBackupEnvelope,
} from "./types";

/**
 * Packs/unpacks the ns-backup envelope (REDESIGN.md §3.3).
 *
 * The envelope is the ONLY shape that leaves the device. Restore refuses
 * future versions instead of guessing (non-destructive policy, §5.6).
 */

/** Builds the §3.3 envelope around already-encrypted material. */
export function buildEnvelope(
  encrypted: Awaited<ReturnType<typeof encryptWithPassphrase>>,
): NSBackupEnvelope {
  return {
    format: NS_BACKUP_FORMAT,
    version: NS_BACKUP_VERSION,
    kdf: {
      algo: "PBKDF2",
      hash: "SHA-256",
      iterations: encrypted.kdfIterations,
      salt: encodeBase64(encrypted.kdfSalt),
    },
    cipher: {
      algo: "AES-GCM",
      iv: encodeBase64(encrypted.cipherIv),
      data: encodeBase64(encrypted.cipherData),
    },
  };
}

/** Encrypts payload bytes with the passphrase and returns the envelope object. */
export async function createEncryptedEnvelope(
  payloadBytes: Uint8Array,
  passphrase: string,
): Promise<NSBackupEnvelope> {
  const encrypted = await encryptWithPassphrase(payloadBytes, passphrase);
  return buildEnvelope(encrypted);
}

/** Serializes an envelope into the exact JSON text stored/uploaded. */
export function serializeEnvelope(envelope: NSBackupEnvelope): string {
  return JSON.stringify(envelope, null, 2);
}

/**
 * Parses envelope JSON text, validating the schema and refusing versions this
 * build does not know (so future formats fail loudly, never silently wrong).
 */
export function parseEnvelopeJson(envelopeText: string): NSBackupEnvelope {
  let rawJson: unknown;
  try {
    rawJson = JSON.parse(envelopeText);
  } catch (error) {
    throw new Error("This file is not a valid ns-backup (JSON parse failed).", { cause: error });
  }
  const parsed = nsBackupEnvelopeSchema.safeParse(rawJson);
  if (!parsed.success) {
    throw new Error("This file is not a valid ns-backup envelope.", { cause: parsed.error });
  }
  if (parsed.data.version > NS_BACKUP_VERSION) {
    throw new Error(
      `Unsupported backup version ${parsed.data.version} (this build supports up to ${NS_BACKUP_VERSION}).`,
    );
  }
  return parsed.data;
}

/** Decrypts a validated envelope with the passphrase into payload bytes. */
export async function decryptEnvelope(
  envelope: NSBackupEnvelope,
  passphrase: string,
): Promise<Uint8Array> {
  return decryptWithPassphrase(
    {
      kdfSalt: decodeBase64(envelope.kdf.salt),
      kdfIterations: envelope.kdf.iterations,
      cipherIv: decodeBase64(envelope.cipher.iv),
      cipherData: decodeBase64(envelope.cipher.data),
    },
    passphrase,
  );
}
