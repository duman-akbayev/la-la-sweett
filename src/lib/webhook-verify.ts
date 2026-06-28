import { createHmac } from "crypto";

export function verifyMetaSignature(
  body: string,
  signature: string | null,
  appSecret: string,
): boolean {
  if (!signature || !appSecret) return false;

  const expectedSig =
    "sha256=" +
    createHmac("sha256", appSecret).update(body).digest("hex");

  if (signature.length !== expectedSig.length) return false;

  let mismatch = 0;
  for (let i = 0; i < signature.length; i++) {
    mismatch |= signature.charCodeAt(i) ^ expectedSig.charCodeAt(i);
  }
  return mismatch === 0;
}

export function verifyTelegramSecret(
  request: Request,
  secretToken: string | undefined,
): boolean {
  if (!secretToken) return true;
  const header = request.headers.get("x-telegram-bot-api-secret-token");
  if (!header) return false;

  if (header.length !== secretToken.length) return false;
  let mismatch = 0;
  for (let i = 0; i < header.length; i++) {
    mismatch |= header.charCodeAt(i) ^ secretToken.charCodeAt(i);
  }
  return mismatch === 0;
}
