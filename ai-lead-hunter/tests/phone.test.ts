import { test } from "node:test";
import assert from "node:assert/strict";
import {
  digitsOnly,
  isValidPhone,
  normalizePhone,
  phoneDigitsIntl,
} from "../lib/phone";

test("normalizes Ukrainian national formats to E.164", () => {
  assert.equal(normalizePhone("0671234567"), "+380671234567");
  assert.equal(normalizePhone("067 123 45 67"), "+380671234567");
  assert.equal(normalizePhone("+380 67 123 45 67"), "+380671234567");
  assert.equal(normalizePhone("380671234567"), "+380671234567");
  assert.equal(normalizePhone("00380671234567"), "+380671234567");
  assert.equal(normalizePhone("671234567"), "+380671234567");
});

test("keeps explicit international numbers", () => {
  assert.equal(normalizePhone("+1 415 555 2671"), "+14155552671");
});

test("rejects empty / junk / too-short input", () => {
  assert.equal(normalizePhone(undefined), null);
  assert.equal(normalizePhone(""), null);
  assert.equal(normalizePhone("   "), null);
  assert.equal(normalizePhone("abc"), null);
  assert.equal(normalizePhone("12345"), null);
  assert.equal(isValidPhone("0671234567"), true);
  assert.equal(isValidPhone("nope"), false);
});

test("phoneDigitsIntl strips the plus for wa.me / viber", () => {
  assert.equal(phoneDigitsIntl("0671234567"), "380671234567");
  assert.equal(phoneDigitsIntl("bad"), null);
});

test("digitsOnly keeps only digits", () => {
  assert.equal(digitsOnly("+380 (67) 123-45-67"), "380671234567");
});
