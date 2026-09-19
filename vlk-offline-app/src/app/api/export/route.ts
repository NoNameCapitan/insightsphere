import { createHash } from "node:crypto";
import { canonicalJson } from "@/lib/domain";
import { z } from "zod";
import { assertOrigin, requireActor, AppError } from "@/server/auth";
import { coordinatorRoles, type DocumentPayload } from "@/lib/domain";
import { day } from "@/server/validation";
import { db } from "@/db";
import { payloadFor, sessionInclude } from "@/server/records";
import { exportRows, toCsv } from "@/server/export-data";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    await assertOrigin();
    const a = await requireActor(coordinatorRoles);
    const d = z
      .object({
        date: day,
        format: z.enum(["json", "csv", "xlsx"]),
        scope: z.enum(["all", "finalized"]),
      })
      .parse(await request.json());
    const where = {
      session_date: d.date,
      status:
        d.scope === "finalized"
          ? ("FINALIZED" as const)
          : { notIn: ["CANCELLED" as const] },
      replaced_by: null,
    };
    const count = await db.vlkSession.count({ where });
    if (count > 2000)
      throw new AppError(
        "Понад 2000 сесій за день. Зверніться до адміністратора для окремого експорту.",
      );
    const sessions = await db.vlkSession.findMany({
      where,
      include: sessionInclude,
      orderBy: { created_at: "asc" },
    });
    for (const s of sessions) {
      const doc = s.documents[0];
      if (
        doc &&
        createHash("sha256")
          .update(canonicalJson(doc.payload))
          .digest("hex") !== doc.payload_sha256
      )
        throw new AppError(
          "Не пройдено перевірку цілісності документа. Експорт зупинено.",
        );
    }
    const records = sessions.map((s) => ({
      status: s.status,
      sourceVersion: s.version,
      documentHash: s.documents[0]?.payload_sha256 || null,
      payload: s.documents[0]
        ? (s.documents[0].payload as DocumentPayload)
        : payloadFor(s),
    }));
    if (!records.length)
      throw new AppError("На цю дату немає записів за обраними умовами.");
    await db.auditLog.create({
      data: {
        actor_id: a.id,
        action: "EXPORT_DATA",
        entity_type: "DailyExport",
        entity_id: d.date,
        metadata: { format: d.format, count },
      },
    });
    const headers = {
      "Cache-Control": "private, no-store",
      "Content-Disposition":
        'attachment; filename="VLK-' + d.date + "." + d.format + '"',
      "X-Content-Type-Options": "nosniff",
    };
    if (d.format === "json")
      return new Response(
        JSON.stringify(
          {
            schemaVersion: 1,
            exportedAt: new Date().toISOString(),
            sessionDate: d.date,
            records,
          },
          null,
          2,
        ),
        {
          headers: {
            ...headers,
            "Content-Type": "application/json; charset=utf-8",
          },
        },
      );
    const rows = exportRows(records);
    if (d.format === "csv")
      return new Response(toCsv(rows), {
        headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" },
      });
    const ExcelJS = (await import("exceljs")).default,
      book = new ExcelJS.Workbook();
    book.creator = "ВЛК Offline";
    const sheet = book.addWorksheet("Огляди");
    sheet.columns = Object.keys(rows[0]).map((key) => ({
      header: key,
      key,
      width: ["Об’єктивні дані", "Діагноз", "Постанова"].includes(key)
        ? 50
        : 22,
    }));
    rows.forEach((r) => {
      const row = sheet.addRow(r);
      row.eachCell((cell) => {
        cell.numFmt = "@";
        cell.alignment = { vertical: "top", wrapText: true };
      });
    });
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF126B62" },
    };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: sheet.columnCount },
    };
    const info = book.addWorksheet("Про експорт");
    info.addRows([
      ["Формат", "Робочий експорт для ручного перенесення"],
      ["Дата", d.date],
      ["Сесій", String(count)],
      ["Автоматичний імпорт Helsi", "Не підтримується цим файлом"],
    ]);
    const bytes = await book.xlsx.writeBuffer();
    return new Response(new Uint8Array(bytes), {
      headers: {
        ...headers,
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof AppError
            ? e.message
            : e instanceof z.ZodError
              ? "Перевірте дату та формат"
              : "Не вдалося сформувати експорт",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
