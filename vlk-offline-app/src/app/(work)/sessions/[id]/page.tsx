import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRightLeft,
  Printer,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { db } from "@/db";
import { pageActor, AppError } from "@/server/auth";
import { standbyScreen } from "@/components/standby";
import {
  readSession,
  latestExams,
  completeRequirements,
} from "@/server/records";
import {
  personName,
  displayDate,
  hasRole,
  registryRoles,
  coordinatorRoles,
  specialties,
  statusNames,
  type PatientSnapshot,
} from "@/lib/domain";
import { Examination } from "@/components/examination";
import { Decision, CancelSession, CorrectSession } from "@/components/decision";
import { Button } from "@/components/ui/button";
import { RefreshButton } from "@/components/common";
import { CopyField } from "@/components/copy-field";
export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const standby = await standbyScreen();
  if (standby) return standby;
  const a = await pageActor(),
    { id } = await params;
  let s;
  try {
    s = await readSession(a, id);
  } catch (e) {
    if (e instanceof AppError) notFound();
    throw e;
  }
  const p = s.patient_snapshot as PatientSnapshot,
    current = latestExams(s),
    own = current.find((e) => e.specialty === a.specialty),
    coord = hasRole(a, coordinatorRoles),
    closed = ["FINALIZED", "CANCELLED"].includes(s.status);
  const prefill =
    s.replaces_session_id && a.specialty
      ? await db.medicalExamination.findFirst({
          where: { session_id: s.replaces_session_id, specialty: a.specialty },
          orderBy: { revision: "desc" },
          include: { additional_diagnoses: true },
        })
      : null;
  return (
    <div className="stack">
      <Link className="back-link" href="/">
        <ArrowLeft size={15} />
        До черги
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow mono">
            {s.ticket_number} · {displayDate(s.session_date)}
          </span>
          <h1>{personName(p)}</h1>
          <p>
            {displayDate(p.birth_date)} ·{" "}
            {p.rnokpp ? "РНОКПП " + p.rnokpp : "Без РНОКПП"} ·{" "}
            {s.military_unit_or_tck}
          </p>
        </div>
        <span
          className={"badge " + (s.status === "FINALIZED" ? "success" : "")}
        >
          {statusNames[s.status]}
        </span>
      </div>
      <div className="inline no-print">
        {hasRole(a, registryRoles) ? (
          <Button asChild variant="outline">
            <Link href={"/print/" + id + "?kind=ticket"} target="_blank">
              <Printer size={16} />
              Талон
            </Link>
          </Button>
        ) : null}
        {coord ? (
          <>
            <Button asChild variant="outline">
              <Link href={"/print/" + id} target="_blank">
                <Printer size={16} />
                Зведення / PDF
              </Link>
            </Button>
            {s.documents.length ? (
              <Button asChild>
                <Link href={"/sessions/" + id + "/transfer"}>
                  <ArrowRightLeft size={16} />
                  Перенести в Helsi
                </Link>
              </Button>
            ) : null}
          </>
        ) : null}
        {coord && s.status === "FINALIZED" && !s.replaced_by ? (
          <CorrectSession id={id} />
        ) : null}
        <RefreshButton />
        {hasRole(a, registryRoles) && !closed ? (
          <CancelSession id={id} version={s.version} />
        ) : null}
      </div>
      {s.replaced_by ? (
        <div className="notice">
          Для цього запису є виправлення:{" "}
          <Link href={"/sessions/" + s.replaced_by.id}>
            {s.replaced_by.ticket_number}
          </Link>
        </div>
      ) : null}
      <section className="card card-content">
        <div className="specialty-progress">
          {s.requirements.map((r) => {
            const e = current.find((e) => e.specialty === r.specialty);
            return (
              <div
                key={r.specialty}
                className={e?.status === "COMPLETED" ? "done" : ""}
              >
                {e?.status === "COMPLETED" ? (
                  <CheckCircle2 size={17} />
                ) : (
                  <Circle size={17} />
                )}
                <span>
                  {specialties[r.specialty]}
                  <small>{e ? statusNames[e.status] : "Очікує огляду"}</small>
                </span>
              </div>
            );
          })}
        </div>
      </section>
      <details className="card card-content">
        <summary>Направлення та дані прийому</summary>
        <div className="detail-grid">
          <p>
            <small>Направлення</small>№ {s.referral_number} від{" "}
            {displayDate(s.referral_date)}
          </p>
          <p>
            <small>Орган</small>
            {s.referral_issuer}
          </p>
          <p>
            <small>Комісія</small>
            {s.commission_name}
          </p>
          <p>
            <small>Редакція наказу 402</small>
            {s.order_402_revision}
          </p>
        </div>
      </details>
      {hasRole(a, ["DOCTOR"]) &&
      s.requirements.some((r) => r.specialty === a.specialty) ? (
        <Examination
          key={
            (own?.id || "new") + ":" + (own?.version || 0) + ":" + own?.status
          }
          sessionId={id}
          sessionVersion={s.version}
          initial={own || null}
          prefill={prefill}
          actorId={a.id}
          closed={closed}
        />
      ) : null}
      {coord ? (
        <>
          <section className="card">
            <div className="card-header">
              <h2>Висновки спеціалістів</h2>
              <p>Показано останню версію кожного огляду.</p>
            </div>
            <div className="card-content stack">
              {current.length ? (
                current.map((e) => (
                  <details key={e.id} className="exam-summary">
                    <summary>
                      <strong>{specialties[e.specialty]}</strong>
                      <span className="badge">{statusNames[e.status]}</span>
                    </summary>
                    <p className="muted">
                      {e.doctor_name_snapshot} · версія {e.revision}
                    </p>
                    {[
                      ["Скарги", e.complaints],
                      ["Анамнез", e.anamnesis],
                      ["Об’єктивні дані", e.objective_data],
                      [
                        "Діагноз",
                        (e.icd10_code ? e.icd10_code + " · " : "") +
                          e.diagnosis_text,
                      ],
                      ["Стаття 402", e.order_402_article],
                      ["Висновок", e.doctor_conclusion],
                      ["Рекомендації", e.recommendations],
                    ].map(([label, text]) => (
                      <div className="clinical-text" key={label}>
                        <small>{label}</small>
                        <p>{text || "—"}</p>
                      </div>
                    ))}
                    {e.additional_diagnoses.map((d) => (
                      <p key={d.id}>
                        {d.icd10_code} · {d.diagnosis_text}
                      </p>
                    ))}
                  </details>
                ))
              ) : (
                <p className="muted">Лікарі ще не зберегли оглядів.</p>
              )}
            </div>
          </section>
          {!closed ? (
            <Decision
              key={"decision:" + s.version}
              id={id}
              version={s.version}
              canFinalize={hasRole(a, ["CHAIRPERSON", "DEPUTY_CHAIRPERSON"])}
              complete={completeRequirements(s)}
              initial={{
                final_diagnosis:
                  s.final_diagnosis ||
                  current
                    .filter((e) => e.status === "COMPLETED")
                    .map((e) => e.diagnosis_text)
                    .filter(Boolean)
                    .join(";\n"),
                final_decision: s.final_decision || "",
                order_402_article: s.order_402_article || "",
                protocol_number: s.protocol_number || "",
                decision_date: s.decision_date || s.session_date,
                fitness_category: s.fitness_category || "",
              }}
            />
          ) : (
            <section className="card card-content stack">
              <h2>Збережений підсумок</h2>
              <CopyField
                label="Постанова"
                value={s.final_decision || s.cancellation_reason || "—"}
              />
            </section>
          )}
        </>
      ) : null}
    </div>
  );
}
