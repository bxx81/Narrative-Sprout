import { z } from "zod";

/**
 * Secrets the user entered in the app (knowledge/overview/security.md).
 *
 * HARD RULE: values in this store must never be reachable from
 * export / backup / logging code paths in plaintext. Backups may only carry
 * them inside the encrypted layer (knowledge/features/backup-restore.md).
 */

/** Known credential keys. Extend this list when adding a provider. */
export const credentialKeys = [
  "openrouterApiKey",
  "huggingFaceToken",
  "nvidiaNimToken",
  "googleOAuthToken",
] as const;
export type CredentialKey = (typeof credentialKeys)[number];

export const credentialRecordSchema = z.object({
  key: z.enum(credentialKeys),
  /** The secret value. Never log this. */
  value: z.string(),
});
export type CredentialRecord = z.infer<typeof credentialRecordSchema>;
