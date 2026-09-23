import { test } from "node:test";
import assert from "node:assert/strict";
import {
  availableChannels,
  buildGmailComposeUrl,
  buildMailtoUrl,
  buildOutlookComposeUrl,
  buildTelUrl,
  buildViberUrl,
  buildWhatsAppUrl,
} from "../lib/messaging";

test("tel: link uses normalized E.164", () => {
  assert.equal(buildTelUrl("0671234567"), "tel:+380671234567");
  assert.equal(buildTelUrl("bad"), null);
});

test("WhatsApp uses wa.me with digits and encoded text", () => {
  const url = buildWhatsAppUrl("0671234567", "Вітаю! Тест");
  assert.ok(url && url.startsWith("https://wa.me/380671234567?text="));
  assert.ok(url.includes(encodeURIComponent("Вітаю! Тест")));
  assert.equal(buildWhatsAppUrl(undefined, "x"), null);
});

test("Viber deep link includes +number and text", () => {
  const url = buildViberUrl("0671234567", "Привіт");
  assert.ok(url && url.startsWith("viber://chat?number=%2B380671234567"));
  assert.ok(url.includes(encodeURIComponent("Привіт")));
  assert.equal(buildViberUrl("", "x"), null);
});

test("email builders encode subject + body", () => {
  const parts = { subject: "Тема", body: "Текст листа" };
  const mailto = buildMailtoUrl(parts);
  assert.ok(mailto.startsWith("mailto:?"));
  assert.ok(mailto.includes("subject=") && mailto.includes("body="));

  const gmail = buildGmailComposeUrl({ to: "a@b.com", ...parts });
  assert.ok(gmail.startsWith("https://mail.google.com/mail/?"));
  assert.ok(
    gmail.includes("view=cm") &&
      gmail.includes("su=") &&
      gmail.includes("to=a%40b.com"),
  );

  const outlook = buildOutlookComposeUrl(parts);
  assert.ok(
    outlook.startsWith("https://outlook.office.com/mail/deeplink/compose?"),
  );
});

test("availableChannels reflects missing contact data honestly", () => {
  const withPhone = availableChannels({ phone: "0671234567" });
  assert.equal(withPhone.call, true);
  assert.equal(withPhone.whatsapp, true);
  assert.equal(withPhone.viber, true);
  assert.equal(withPhone.telegram, false); // no username invented
  assert.equal(withPhone.mailto, true);

  const noPhone = availableChannels({ phone: undefined });
  assert.equal(noPhone.call, false);
  assert.equal(noPhone.whatsapp, false);
  assert.equal(noPhone.viber, false);
  assert.equal(noPhone.mailto, true); // email draft still possible
});
