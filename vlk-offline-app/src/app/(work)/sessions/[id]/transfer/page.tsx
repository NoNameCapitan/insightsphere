import Link from "next/link";
import { notFound } from "next/navigation";
import { pageActor } from "@/server/auth";
import { db } from "@/db";
import {
  coordinatorRoles,
  copyFields,
  type DocumentPayload,
  personName,
  canonicalJson,
} from "@/lib/domain";
import { createHash } from "node:crypto";
import { Transfer } from "@/components/transfer";
export default async function TransferPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const a = await pageActor(coordinatorRoles),
    { id } = await params;
  const doc = await db.vlkDocument.findFirst({
    where: { session_id: id },
    orderBy: { created_at: "desc" },
    include: {
      sync_logs: { orderBy: { created_at: "desc" }, take: 1 },
      session: { select: { replaced_by: { select: { id: true } } } },
    },
  });
  if (!doc) notFound();
  if (doc.session.replaced_by)
    return (
      <div className="notice">
        Це попередня сесія.{" "}
        <Link href={"/sessions/" + doc.session.replaced_by.id}>
          Відкрити виправлення
        </Link>
      </div>
    );
  if (
    createHash("sha256").update(canonicalJson(doc.payload)).digest("hex") !==
    doc.payload_sha256
  )
    throw new Error("Пошкоджено знімок документа");
  const p = doc.payload as DocumentPayload,
    last = doc.sync_logs[0];
  await db.auditLog.create({
    data: {
      actor_id: a.id,
      session_id: id,
      action: "READ_RECORD",
      entity_type: "VlkDocument",
      entity_id: doc.id,
    },
  });
  return (
    <>
      <Link className="back-link" href={"/sessions/" + id}>
        ← До картки
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">SMART COPY / HELSI</span>
          <h1>Перенесення без передруковування</h1>
          <p>
            {personName(p.patient)} · {p.ticket}
          </p>
        </div>
      </div>
      <Transfer
        documentId={doc.id}
        fields={copyFields(p)}
        initialKeys={
          Array.isArray(last?.transferred_fields)
            ? last.transferred_fields.filter(
                (k): k is string => typeof k === "string",
              )
            : []
        }
        initialNotes={last?.notes || ""}
        confirmed={last?.status === "CONFIRMED"}
      />
    </>
  );
}
