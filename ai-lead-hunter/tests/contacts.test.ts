import { test } from "node:test";
import assert from "node:assert/strict";
import { extractContacts, hasAnyContact } from "../lib/contactExtractor";
import {
  availableChannels,
  buildInstagramDmUrl,
  buildMessengerUrl,
  buildTelegramUrl,
} from "../lib/messaging";

const html = `<html><head><title>Салон</title>
<script type="application/ld+json">{"email":"booking@salon.ua"}</script>
<script>var sentry="abc@sentry.io"; var x="bundle@2x.png"</script></head>
<body>
<a href="mailto:Info@Salon.ua?subject=hi">Пишіть</a>
<a href="https://www.instagram.com/salon.kyiv/">IG</a>
<a href="https://instagram.com/p/Cxyz123/">post</a>
<a href="https://www.facebook.com/sharer/sharer.php?u=x">share</a>
<a href="https://facebook.com/SalonKyiv">FB</a>
<a href="https://t.me/share/url?url=x">share</a>
<a href="https://t.me/salon_kyiv">TG</a>
<a href="https://api.whatsapp.com/send?phone=380671234567">WA</a>
<a href="https://www.tiktok.com/@salon.kyiv">TT</a>
<p>Або: hello&#64;salon.ua, logo@2x.png, test@example.com</p>
</body></html>`;

test("extracts published emails and social profiles, skipping share links and junk", () => {
  const c = extractContacts(html);
  assert.deepEqual(c.emails, ["info@salon.ua", "booking@salon.ua", "hello@salon.ua"]);
  assert.equal(c.instagram, "https://instagram.com/salon.kyiv");
  assert.equal(c.facebook, "https://facebook.com/SalonKyiv");
  assert.equal(c.telegram, "https://t.me/salon_kyiv");
  assert.equal(c.whatsapp, "https://wa.me/380671234567");
  assert.equal(c.tiktok, "https://tiktok.com/@salon.kyiv");
  assert.equal(hasAnyContact(c), true);
});

test("empty page yields no contacts", () => {
  const c = extractContacts("<html><body>Ласкаво просимо</body></html>");
  assert.deepEqual(c, { emails: [] });
  assert.equal(hasAnyContact(c), false);
});

test("social channels are enabled only for published links", () => {
  assert.equal(buildTelegramUrl("https://t.me/salon_kyiv"), "https://t.me/salon_kyiv");
  assert.equal(buildTelegramUrl("https://evil.example/t.me/x"), null);
  assert.equal(buildInstagramDmUrl("https://instagram.com/salon.kyiv"), "https://ig.me/m/salon.kyiv");
  assert.equal(buildMessengerUrl("https://facebook.com/SalonKyiv"), "https://m.me/SalonKyiv");
  const ch = availableChannels({ phone: undefined, telegram: "https://t.me/salon_kyiv" });
  assert.equal(ch.telegram, true);
  assert.equal(ch.instagram, false);
  assert.equal(ch.call, false);
});
