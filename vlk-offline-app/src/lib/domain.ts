export const specialties = {
  THERAPIST: "Терапевт",
  SURGEON: "Хірург",
  NEUROLOGIST: "Невропатолог",
  OPHTHALMOLOGIST: "Офтальмолог",
  OTORHINOLARYNGOLOGIST: "Отоларинголог",
  PSYCHIATRIST: "Психіатр",
  DERMATOLOGIST: "Дерматолог",
  DENTIST: "Стоматолог",
} as const;
export type Specialty = keyof typeof specialties;
export const roleNames = {
  ADMIN: "Адміністратор",
  REGISTRAR: "Реєстратор",
  DOCTOR: "Лікар",
  SECRETARY: "Секретар",
  CHAIRPERSON: "Голова ВЛК",
  DEPUTY_CHAIRPERSON: "Заступник голови",
} as const;
export type Role = keyof typeof roleNames;
export const coordinatorRoles: Role[] = [
  "SECRETARY",
  "CHAIRPERSON",
  "DEPUTY_CHAIRPERSON",
];
export const registryRoles: Role[] = ["REGISTRAR", ...coordinatorRoles];
export const clinicalRoles: Role[] = ["DOCTOR", ...coordinatorRoles];
export const statusNames: Record<string, string> = {
  REGISTERED: "Зареєстровано",
  IN_PROGRESS: "Огляди тривають",
  READY_FOR_REVIEW: "На розгляді",
  FINALIZED: "Завершено",
  CANCELLED: "Скасовано",
  DRAFT: "Чернетка",
  COMPLETED: "Підтверджено",
  VOIDED: "Скасовано",
  PARTIAL: "Частково перенесено",
  CONFIRMED: "Перенесено",
  FAILED: "Помилка перенесення",
};
export const fitnessNames = {
  FIT: "Придатний",
  FIT_FOR_SPECIFIED_SERVICE: "Придатний до визначених видів служби",
  TEMPORARILY_UNFIT: "Тимчасово непридатний",
  UNFIT: "Непридатний",
  OTHER: "Інше формулювання",
} as const;
export type Actor = {
  id: string;
  full_name: string;
  username: string;
  role: Role;
  specialty: Specialty | null;
  roles: Role[];
};
export function hasRole(a: Actor, roles: Role[]) {
  return a.roles.some((r) => roles.includes(r));
}
export function today() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const v = (k: string) => parts.find((p) => p.type === k)?.value;
  return v("year") + "-" + v("month") + "-" + v("day");
}
export function displayDate(v: string) {
  return v.split("-").reverse().join(".");
}
export type PatientSnapshot = {
  schemaVersion: 1;
  rnokpp: string | null;
  rnokpp_absence_reason: string | null;
  last_name: string;
  first_name: string;
  middle_name: string | null;
  birth_date: string;
};
export function personName(
  p: Pick<PatientSnapshot, "last_name" | "first_name" | "middle_name">,
) {
  return [p.last_name, p.first_name, p.middle_name].filter(Boolean).join(" ");
}
export type CopyField = {
  key: string;
  label: string;
  value: string;
  group: string;
};
export type ExamSnapshot = {
  id: string;
  revision: number;
  specialty: Specialty;
  status: string;
  doctor: string;
  complaints: string;
  anamnesis: string;
  objective_data: string;
  icd10_code: string | null;
  icd10_version: string | null;
  no_icd_reason: string | null;
  fitness_category: string | null;
  examined_at: string | null;
  completed_at: string | null;
  diagnosis_text: string;
  order_402_article: string | null;
  doctor_conclusion: string;
  recommendations: string;
  additional_diagnoses: {
    icd10_code: string;
    icd10_version: string;
    diagnosis_text: string;
    order_402_article: string | null;
  }[];
};
export type DocumentPayload = {
  schemaVersion: 1;
  sessionId: string;
  ticket: string;
  patient: PatientSnapshot;
  date: string;
  commission: string;
  rank: string | null;
  unit: string;
  referral: { number: string; date: string; issuer: string };
  examinations: ExamSnapshot[];
  decision: string;
  diagnosis: string;
  article: string;
  orderRevision: string;
  protocol: string;
  decisionDate: string;
  finalizer: string;
};
// Єдине джерело полів для буфера, перевірки перенесення та експорту.
export function copyFields(p: DocumentPayload): CopyField[] {
  const fields: CopyField[] = [];
  const add = (
    key: string,
    label: string,
    value: string | null | undefined,
    group: string,
  ) => {
    if (value?.trim()) fields.push({ key, label, value, group });
  };
  add("patient.rnokpp", "РНОКПП", p.patient.rnokpp, "Пацієнт");
  add("patient.name", "ПІБ", personName(p.patient), "Пацієнт");
  add(
    "patient.birth",
    "Дата народження",
    displayDate(p.patient.birth_date),
    "Пацієнт",
  );
  add("patient.rank", "Звання", p.rank, "Пацієнт");
  add("patient.unit", "ТЦК / військова частина", p.unit, "Пацієнт");
  add("referral.number", "Номер направлення", p.referral.number, "Направлення");
  add(
    "referral.date",
    "Дата направлення",
    displayDate(p.referral.date),
    "Направлення",
  );
  add("referral.issuer", "Орган направлення", p.referral.issuer, "Направлення");
  for (const e of p.examinations) {
    const g = specialties[e.specialty],
      k = "exam." + e.id;
    for (const [field, label] of [
      ["complaints", "Скарги"],
      ["anamnesis", "Анамнез"],
      ["objective_data", "Об’єктивні дані"],
      ["icd10_code", "МКХ-10"],
      ["diagnosis_text", "Діагноз"],
      ["order_402_article", "Стаття 402"],
      ["doctor_conclusion", "Висновок"],
      ["recommendations", "Рекомендації"],
    ] as const)
      add(k + "." + field, label, e[field], g);
    e.additional_diagnoses.forEach((d, i) => {
      add(k + ".additional." + i + ".code", "Додатковий МКХ", d.icd10_code, g);
      add(
        k + ".additional." + i + ".diagnosis",
        "Додатковий діагноз",
        d.diagnosis_text,
        g,
      );
      add(
        k + ".additional." + i + ".article",
        "Додаткова стаття",
        d.order_402_article,
        g,
      );
    });
  }
  add("final.diagnosis", "Підсумковий діагноз", p.diagnosis, "Постанова");
  add("final.article", "Статті 402", p.article, "Постанова");
  add("final.decision", "Повний текст постанови", p.decision, "Постанова");
  return fields;
}
export function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return "[" + v.map(canonicalJson).join(",") + "]";
  if (v && typeof v === "object")
    return (
      "{" +
      Object.entries(v)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, val]) => JSON.stringify(k) + ":" + canonicalJson(val))
        .join(",") +
      "}"
    );
  return JSON.stringify(v);
}
