import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isBlockedHostname,
  isBlockedIPv4,
  isBlockedIPv6,
  validateUrlSafety,
} from "../lib/ssrf";

const BLOCKED = [
  "http://localhost",
  "http://localhost:3000",
  "http://127.0.0.1",
  "http://127.0.0.1:8080",
  "http://0.0.0.0",
  "http://169.254.169.254", // cloud metadata
  "http://169.254.169.254/latest/meta-data/",
  "http://192.168.1.1",
  "http://10.0.0.5",
  "http://172.16.5.4",
  "https://metadata.google.internal",
  "http://[::1]",
];

for (const url of BLOCKED) {
  test(`blocks ${url}`, () => {
    assert.equal(validateUrlSafety(url).ok, false);
  });
}

test("blocks non-http(s) schemes", () => {
  assert.equal(validateUrlSafety("file:///etc/passwd").ok, false);
  assert.equal(validateUrlSafety("ftp://example.com").ok, false);
});

const ALLOWED = [
  "https://example.com",
  "http://example.com/path",
  "example.com", // gets https:// prepended
  "https://sub.business.example.com",
];

for (const url of ALLOWED) {
  test(`allows ${url} (syntax)`, () => {
    assert.equal(validateUrlSafety(url).ok, true);
  });
}

test("classifies private IPv4 ranges", () => {
  assert.equal(isBlockedIPv4("169.254.169.254"), true);
  assert.equal(isBlockedIPv4("10.1.2.3"), true);
  assert.equal(isBlockedIPv4("172.16.0.1"), true);
  assert.equal(isBlockedIPv4("172.32.0.1"), false); // outside 172.16/12
  assert.equal(isBlockedIPv4("192.168.0.1"), true);
  assert.equal(isBlockedIPv4("8.8.8.8"), false);
});

test("classifies IPv6 ranges", () => {
  assert.equal(isBlockedIPv6("::1"), true);
  assert.equal(isBlockedIPv6("fe80::1"), true);
  assert.equal(isBlockedIPv6("fc00::1"), true);
  assert.equal(isBlockedIPv6("2606:4700:4700::1111"), false);
});

test("classifies hostnames", () => {
  assert.equal(isBlockedHostname("localhost"), true);
  assert.equal(isBlockedHostname("foo.localhost"), true);
  assert.equal(isBlockedHostname("metadata.google.internal"), true);
  assert.equal(isBlockedHostname("example.com"), false);
});
