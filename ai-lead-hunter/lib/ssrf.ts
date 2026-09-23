import ipaddr from "ipaddr.js";
import { lookup } from "node:dns/promises";
export type UrlCheck = { ok: true; url: URL } | { ok: false; reason: string };
export function parseIPv4(host: string): number[] | null {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return null;
  const parts = host.split(".").map(Number);
  return parts.every((n) => n >= 0 && n <= 255) ? parts : null;
}
export function isBlockedIPv4(host: string): boolean {
  if (!parseIPv4(host)) return false;
  return ipaddr.parse(host).range() !== "unicast";
}
export function isBlockedIPv6(raw: string): boolean {
  const host = raw.replace(/^\[|\]$/g, "").split("%")[0];
  if (!host.includes(":")) return false;
  if (!ipaddr.isValid(host)) return true;
  // Process IPv4-mapped addresses, including hex-encoded ::ffff:7f00:1.
  return ipaddr.process(host).range() !== "unicast";
}
export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "");
  return (
    !host ||
    (!host.includes(".") && !host.includes(":")) ||
    /(^|\.)(localhost|local|internal|localhost\.localdomain)$/.test(host) ||
    /(^|\.)metadata\.google\.internal$/.test(host) ||
    isBlockedIPv4(host) ||
    isBlockedIPv6(host)
  );
}
export function validateUrlSafety(raw: string): UrlCheck {
  try {
    const value = raw.trim();
    const scheme = /^[a-z][a-z0-9+.-]*:/i.test(value);
    const url = new URL(scheme ? value : `https://${value}`);
    if (!["http:", "https:"].includes(url.protocol))
      return { ok: false, reason: "Дозволено тільки HTTP/HTTPS." };
    if (
      url.username ||
      url.password ||
      (url.port && !["80", "443"].includes(url.port))
    )
      return {
        ok: false,
        reason: "Облікові дані й нестандартні порти в URL заборонено.",
      };
    if (isBlockedHostname(url.hostname))
      return { ok: false, reason: "Локальні/внутрішні адреси заблоковано." };
    return { ok: true, url };
  } catch {
    return { ok: false, reason: "Некоректний URL." };
  }
}
export async function resolvePublicAddresses(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, "");
  const records = ipaddr.isValid(host)
    ? [{ address: host, family: host.includes(":") ? 6 : 4 }]
    : await lookup(host, { all: true });
  if (
    !records.length ||
    records.some((r) =>
      r.family === 4 ? isBlockedIPv4(r.address) : isBlockedIPv6(r.address),
    )
  )
    throw new Error("Хост вказує на внутрішню IP-адресу.");
  return records;
}
export async function resolveHostnameSafe(
  hostname: string,
): Promise<{ ok: boolean; reason?: string }> {
  try {
    await resolvePublicAddresses(hostname);
    return { ok: true };
  } catch {
    return {
      ok: false,
      reason: "DNS недоступний або містить внутрішню IP-адресу.",
    };
  }
}
export async function assertSafeUrl(raw: string): Promise<UrlCheck> {
  const basic = validateUrlSafety(raw);
  if (!basic.ok) return basic;
  const check = await resolveHostnameSafe(basic.url.hostname);
  return check.ok ? basic : { ok: false, reason: check.reason! };
}
