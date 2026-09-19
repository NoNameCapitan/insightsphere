import {
  randomBytes,
  scrypt as rawScrypt,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(rawScrypt);
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return "scrypt:" + salt + ":" + key.toString("hex");
}
export async function verifyPassword(password: string, stored: string) {
  const [kind, salt, hex] = stored.split(":");
  if (kind !== "scrypt" || !salt || !hex) return false;
  const expected = Buffer.from(hex, "hex"),
    actual = (await scrypt(password, salt, 64)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
