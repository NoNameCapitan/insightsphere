import { notFound } from "next/navigation";
import { pageActor } from "@/server/auth";
import { db } from "@/db";
import { sessionInclude, payloadFor } from "@/server/records";
import {
  registryRoles,
  coordinatorRoles,
  personName,
  displayDate,
  specialties,
  type DocumentPayload,
  canonicalJson,
} from "@/lib/domain";
import { PrintButton } from "@/components/common";
import { createHash } from "node:crypto";
export default async function Print({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ kind?: string }>;
}) {
  const { id } = await params,
    { kind } = await searchParams,
    ticket = kind === "ticket",
    a = await pageActor(ticket ? registryRoles : coordinatorRoles);
  const s = await db.vlkSession.findUnique({
    where: { id },
    include: sessionInclude,
  });
  if (!s) notFound();
  const doc = s.documents[0];
  if (
    doc &&
    createHash("sha256").update(canonicalJson(doc.payload)).digest("hex") !==
      doc.payload_sha256
  )
    throw new Error("Пошкоджено документ");
  const p = doc ? (doc.payload as DocumentPayload) : payloadFor(s);
  await db.auditLog.create({
    data: {
      actor_id: a.id,
      session_id: id,
      action: "PRINT_DOCUMENT",
      entity_type: ticket ? "Ticket" : "Summary",
      entity_id: doc?.id || id,
    },
  });
  return (
    <main className="print-page">
      <div className="no-print print-controls">
        <a href={"/sessions/" + id}>← До картки</a>
        <PrintButton />
      </div>
      <article className="paper">
        <header>
          <p>{p.commission}</p>
          <h1>
            {ticket ? "Талон медичного огляду" : "Робочий зведений запис ВЛК"}
          </h1>
          <p>
            № {p.ticket} · {displayDate(p.date)}
          </p>
        </header>
        {s.replaced_by ? (
          <p className="print-status">
            ЗАМІНЕНО ВИПРАВЛЕННЯМ № {s.replaced_by.ticket_number}
          </p>
        ) : null}
        {s.status === "CANCELLED" ? (
          <p className="print-status">СЕСІЮ СКАСОВАНО</p>
        ) : null}
        <h2>{personName(p.patient)}</h2>
        <p>Дата народження: {displayDate(p.patient.birth_date)}</p>
        {!ticket ? (
          <p>
            РНОКПП: {p.patient.rnokpp || "не зазначено"} · Звання:{" "}
            {p.rank || "—"}
          </p>
        ) : null}
        <p>ТЦК / ВЧ: {p.unit}</p>
        <p>
          Направлення № {p.referral.number} від {displayDate(p.referral.date)},{" "}
          {p.referral.issuer}
        </p>
        {ticket ? (
          <>
            <h3>Маршрут огляду</h3>
            <table>
              <thead>
                <tr>
                  <th>Спеціаліст</th>
                  <th>Дата / підпис</th>
                </tr>
              </thead>
              <tbody>
                {s.requirements.map((r) => (
                  <tr key={r.specialty}>
                    <td>{specialties[r.specialty]}</td>
                    <td>___________________</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <>
            <p className="print-status">
              {doc
                ? "Підсумок підтверджено в локальній системі"
                : "ЧЕРНЕТКА — сесію не завершено"}
            </p>
            {p.examinations.map((e) => (
              <section className="print-exam" key={e.id}>
                <h3>
                  {specialties[e.specialty]} · {e.doctor}
                </h3>
                {[
                  ["Скарги", e.complaints],
                  ["Анамнез", e.anamnesis],
                  ["Об’єктивні дані", e.objective_data],
                  ["Діагноз", (e.icd10_code || "") + " " + e.diagnosis_text],
                  ["Стаття 402", e.order_402_article],
                  ["Висновок", e.doctor_conclusion],
                  ["Рекомендації", e.recommendations],
                ].map(([label, value]) => (
                  <p key={label}>
                    <b>{label}: </b>
                    {value || "—"}
                  </p>
                ))}
                {e.additional_diagnoses.map((d, i) => (
                  <p key={i}>
                    Додатковий діагноз: {d.icd10_code} {d.diagnosis_text};{" "}
                    {d.order_402_article}
                  </p>
                ))}
                <p>Підпис лікаря: ___________________</p>
              </section>
            ))}
            <section>
              <h3>Підсумок комісії</h3>
              <p>
                <b>Діагноз: </b>
                {p.diagnosis || "—"}
              </p>
              <p>
                <b>Постанова: </b>
                {p.decision || "—"}
              </p>
              <p>
                <b>Статті: </b>
                {p.article || "—"}
              </p>
              <p>
                Протокол: {p.protocol || "—"} · {displayDate(p.decisionDate)}
              </p>
              <p>Редакція наказу: {p.orderRevision}</p>
              <p>
                Відповідальна особа: {p.finalizer || "—"} · Підпис:
                ___________________
              </p>
            </section>
            <footer>
              Робочий зведений запис для локального обліку та перенесення даних.
              Не замінює затверджену форму довідки ВЛК / свідоцтва про хворобу
              та КЕП.
            </footer>
          </>
        )}
      </article>
    </main>
  );
}
