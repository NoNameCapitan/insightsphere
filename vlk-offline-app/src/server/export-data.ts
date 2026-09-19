import { type DocumentPayload, personName, displayDate } from "@/lib/domain";
// Табличний експорт розгортає всі діагнози, без втрати початкових нулів у XLSX.
export function exportRows(
  records: { status: string; payload: DocumentPayload }[],
) {
  return records.flatMap((r) => {
    const p = r.payload,
      base = {
        Сесія: p.sessionId,
        Талон: p.ticket,
        Стан: r.status,
        Дата: p.date,
        ПІБ: personName(p.patient),
        РНОКПП: p.patient.rnokpp || "",
        "Дата народження": p.patient.birth_date,
        Звання: p.rank || "",
        "ТЦК / ВЧ": p.unit,
        Направлення: p.referral.number,
        "Дата направлення": p.referral.date,
        "Орган направлення": p.referral.issuer,
        "Підсумковий діагноз": p.diagnosis,
        Постанова: p.decision,
        "Статті постанови": p.article,
      };
    return (p.examinations.length ? p.examinations : [null]).flatMap((e) => {
      const row = {
        ...base,
        Спеціальність: e?.specialty || "",
        "Стан огляду": e?.status || "",
        Лікар: e?.doctor || "",
        "Версія огляду": String(e?.revision || ""),
        Скарги: e?.complaints || "",
        Анамнез: e?.anamnesis || "",
        "Об’єктивні дані": e?.objective_data || "",
        МКХ: e?.icd10_code || "",
        "Версія МКХ": e?.icd10_version || "",
        "Без МКХ — причина": e?.no_icd_reason || "",
        "Категорія огляду": e?.fitness_category || "",
        "Час огляду": e?.examined_at || "",
        Діагноз: e?.diagnosis_text || "",
        "Стаття 402": e?.order_402_article || "",
        Висновок: e?.doctor_conclusion || "",
        Рекомендації: e?.recommendations || "",
        "Вид діагнозу": "Основний",
      };
      return [
        row,
        ...(e?.additional_diagnoses || []).map((d) => ({
          ...row,
          МКХ: d.icd10_code,
          "Версія МКХ": d.icd10_version,
          "Без МКХ — причина": "",
          Діагноз: d.diagnosis_text,
          "Стаття 402": d.order_402_article || "",
          "Вид діагнозу": "Додатковий",
        })),
      ];
    });
  });
}
export function csvCell(value: unknown) {
  let s = String(value ?? "");
  if (/^[\s\uFEFF]*[=+\-@]|^[\t\r\n]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
export function toCsv(rows: Record<string, string>[]) {
  if (!rows.length) return "\uFEFF";
  const keys = Object.keys(rows[0]);
  return (
    "\uFEFF" +
    [
      keys.map(csvCell).join(";"),
      ...rows.map((r) => keys.map((k) => csvCell(r[k])).join(";")),
    ].join("\r\n")
  );
}
