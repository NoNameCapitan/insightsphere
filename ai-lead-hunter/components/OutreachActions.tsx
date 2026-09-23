"use client";

import { useState } from "react";
import {
  availableChannels,
  buildGmailComposeUrl,
  buildInstagramDmUrl,
  buildMailtoUrl,
  buildMessengerUrl,
  buildTelegramUrl,
  buildOutlookComposeUrl,
  buildTelUrl,
  buildViberUrl,
  buildWhatsAppUrl,
} from "@/lib/messaging";
import type { Lead } from "@/lib/types";

function ExternalAction({
  href,
  label,
  onUse,
}: {
  href: string;
  label: string;
  onUse?: () => void;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onUse}
      className="btn-ghost btn-sm justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      aria-label={label}
    >
      {label}
    </a>
  );
}

function DisabledAction({ label, reason }: { label: string; reason: string }) {
  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      title={reason}
      className="btn-ghost btn-sm cursor-not-allowed justify-center text-slate-300"
    >
      {label}
    </button>
  );
}

/**
 * Step 4–5 of the outreach flow: open the chosen service with prepared text,
 * then let the user explicitly record the outcome. Opening a service never
 * implies the message was sent.
 */
export default function OutreachActions({
  lead,
  message,
  emailSubject,
  emailBody,
  onContacted,
  onCopied,
}: {
  lead: Lead;
  message: string;
  emailSubject: string;
  emailBody: string;
  onContacted?: () => void;
  onCopied?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const contacts = lead.websiteAnalysis?.contacts;
  const ch = availableChannels({
    phone: lead.phone,
    telegram: contacts?.telegram,
    instagram: contacts?.instagram,
    facebook: contacts?.facebook,
  });
  const telegram = buildTelegramUrl(contacts?.telegram);
  const instagram = buildInstagramDmUrl(contacts?.instagram);
  const messenger = buildMessengerUrl(contacts?.facebook);
  const to = contacts?.emails[0];

  const tel = buildTelUrl(lead.phone);
  const wa = buildWhatsAppUrl(lead.phone, message);
  const viber = buildViberUrl(lead.phone, message);
  const mail = { to, subject: emailSubject, body: emailBody };

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      onCopied?.();
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
      setCopyError(true);
    }
  }

  if (lead.verification?.doNotContact)
    return (
      <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
        Позначено «Не контактувати». Кнопки звернення вимкнено.
      </p>
    );
  return (
    <div className="space-y-3">
      {lead.source === "demo" && (
        <p className="text-xs text-amber-700">
          Демо-ліди вигадані. Зовнішні канали контакту вимкнено; текст можна
          скопіювати для перевірки.
        </p>
      )}
      {copyError && (
        <p role="alert" className="text-xs text-rose-700">
          Не вдалося скопіювати. Виділіть текст у редакторі й скопіюйте вручну.
        </p>
      )}
      <div
        className={
          "grid grid-cols-2 gap-2 sm:grid-cols-3 " +
          (lead.source === "demo" ? "pointer-events-none opacity-40" : "")
        }
        inert={lead.source === "demo" ? true : undefined}
      >
        {ch.call && tel ? (
          <ExternalAction href={tel} label="Подзвонити" />
        ) : (
          <DisabledAction label="Подзвонити" reason="Немає валідного номера" />
        )}

        {ch.whatsapp && wa ? (
          <ExternalAction href={wa} label="WhatsApp" />
        ) : (
          <DisabledAction label="WhatsApp" reason="Потрібен валідний номер" />
        )}

        {ch.viber && viber ? (
          <ExternalAction href={viber} label="Viber" />
        ) : (
          <DisabledAction label="Viber" reason="Потрібен валідний номер" />
        )}

        {ch.telegram && telegram && (
          <ExternalAction
            href={telegram}
            label="Telegram"
            onUse={() => void copy()}
          />
        )}
        {ch.instagram && instagram && (
          <ExternalAction
            href={instagram}
            label="Instagram DM"
            onUse={() => void copy()}
          />
        )}
        {ch.messenger && messenger && (
          <ExternalAction
            href={messenger}
            label="Messenger"
            onUse={() => void copy()}
          />
        )}
        <ExternalAction href={buildGmailComposeUrl(mail)} label="Gmail" />
        <ExternalAction href={buildOutlookComposeUrl(mail)} label="Outlook" />
        <ExternalAction href={buildMailtoUrl(mail)} label="Пошта (mailto)" />
      </div>

      <button
        type="button"
        onClick={copy}
        className="btn-ghost btn-sm w-full justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      >
        {copied ? "Скопійовано ✓" : "Скопіювати повідомлення"}
      </button>

      {to && (
        <p className="text-xs text-slate-500">
          Email із сайту бізнесу: <b>{to}</b> — підставляється в чернетку листа.
        </p>
      )}
      {(telegram || instagram || messenger) && (
        <p className="text-xs text-slate-400">
          Telegram, Instagram і Messenger не приймають готовий текст у посиланні,
          тому повідомлення копіюється автоматично — вставте його в чат.
        </p>
      )}
      <p className="text-xs text-slate-400">
        Відкриття сервісу не надсилає повідомлення автоматично. Позначте
        «Зв’язались» лише після фактичного контакту.
      </p>

      {onContacted && (
        <button
          type="button"
          onClick={onContacted}
          className="btn-primary btn-sm w-full justify-center"
        >
          Позначити «Зв’язались»
        </button>
      )}
    </div>
  );
}
