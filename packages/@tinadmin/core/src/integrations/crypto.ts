import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

type EncryptedPayload = {
  _enc: true;
  alg: typeof ALGORITHM;
  iv: string;
  tag: string;
  data: string;
};

function resolveKey(): Buffer | null {
  const raw = process.env.INTEGRATION_CREDENTIALS_KEY;
  if (!raw) return null;

  const base64 = Buffer.from(raw, "base64");
  if (base64.length === 32) return base64;

  const hex = Buffer.from(raw, "hex");
  if (hex.length === 32) return hex;

  throw new Error(
    "INTEGRATION_CREDENTIALS_KEY must be 32 bytes (base64 or hex)."
  );
}

function isEncrypted(
  value: Record<string, unknown> | null | undefined
): value is EncryptedPayload {
  return Boolean(value && (value as EncryptedPayload)._enc);
}

export function encryptIntegrationCredentials(
  credentials: Record<string, unknown>
) {
  if (isEncrypted(credentials)) {
    return credentials;
  }

  const key = resolveKey();
  if (!key) {
    return credentials;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const serialized = JSON.stringify(credentials ?? {});
  const encrypted = Buffer.concat([
    cipher.update(serialized, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    _enc: true,
    alg: ALGORITHM,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: encrypted.toString("base64"),
  };
}

export function decryptIntegrationCredentials(
  credentials: Record<string, unknown> | null | undefined
) {
  if (!credentials) return credentials ?? null;
  if (!isEncrypted(credentials)) return credentials;

  const key = resolveKey();
  if (!key) {
    throw new Error(
      "INTEGRATION_CREDENTIALS_KEY is required to decrypt integration credentials."
    );
  }

  const iv = Buffer.from(credentials.iv, "base64");
  const tag = Buffer.from(credentials.tag, "base64");
  const data = Buffer.from(credentials.data, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([
    decipher.update(data),
    decipher.final(),
  ]).toString("utf8");

  return JSON.parse(decrypted) as Record<string, unknown>;
}
