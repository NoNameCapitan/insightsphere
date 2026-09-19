import { z } from "zod";
import { specialties, roleNames, fitnessNames, today } from "@/lib/domain";
const text = (max = 200) => z.string().trim().max(max);
export const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Дата має формат РРРР-ММ-ДД")
  .refine((s) => {
    const d = new Date(s + "T12:00:00Z");
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "Невірна календарна дата");
export const specialty = z.enum(
  Object.keys(specialties) as [
    keyof typeof specialties,
    ...(keyof typeof specialties)[],
  ],
);
export const role = z.enum(
  Object.keys(roleNames) as [
    keyof typeof roleNames,
    ...(keyof typeof roleNames)[],
  ],
);
export const category = z.enum(
  Object.keys(fitnessNames) as [
    keyof typeof fitnessNames,
    ...(keyof typeof fitnessNames)[],
  ],
);
export const registration = z
  .object({
    creation_key: text(100).min(16),
    patient_id: text(100).optional(),
    rnokpp: text(10).regex(/^\d{10}$|^$/, "РНОКПП має містити 10 цифр"),
    rnokpp_absence_reason: text(300),
    last_name: text().min(1),
    first_name: text().min(1),
    middle_name: text(),
    birth_date: day.refine(
      (s) => s <= today(),
      "Дата народження в майбутньому",
    ),
    rank: text(),
    military_unit_or_tck: text(500).min(1),
    referral_number: text().min(1),
    referral_date: day,
    referral_issuer: text(500).min(1),
    session_date: day,
    commission_name: text(500).min(1),
    order_402_revision: text(200).min(1),
    required_specialties: z.array(specialty).min(1).max(8),
  })
  .refine((d) => !!d.rnokpp || d.rnokpp_absence_reason.length >= 3, {
    message: "Вкажіть причину відсутності РНОКПП",
    path: ["rnokpp"],
  });
const diagnosis = z.object({
  icd10_code: text(15).regex(
    /^[A-Z]\d{2}(?:\.[A-Z0-9]{1,5})?$/,
    "Перевірте формат коду МКХ",
  ),
  icd10_version: text(200),
  diagnosis_text: text(4000).min(1),
  order_402_article: text(200),
});
export const examInput = z
  .object({
    session_id: text(100).min(1),
    session_version: z.number().int().positive(),
    exam_id: text(100).optional(),
    version: z.number().int().positive().optional(),
    complaints: text(15000),
    anamnesis: text(15000),
    objective_data: text(20000),
    icd10_code: text(15),
    icd10_version: text(200),
    diagnosis_text: text(10000),
    no_icd_reason: text(1000),
    order_402_article: text(500),
    doctor_conclusion: text(10000),
    recommendations: text(10000),
    amendment_reason: text(1000),
    fitness_category: z.union([category, z.literal("")]),
    additional_diagnoses: z.array(diagnosis).max(30),
    complete: z.boolean(),
  })
  .superRefine((d, c) => {
    if (d.icd10_code && !/^[A-Z]\d{2}(?:\.[A-Z0-9]{1,5})?$/.test(d.icd10_code))
      c.addIssue({
        code: "custom",
        message: "Перевірте формат коду МКХ",
        path: ["icd10_code"],
      });
    if (d.complete) {
      for (const k of [
        "diagnosis_text",
        "doctor_conclusion",
        "objective_data",
      ] as const)
        if (!d[k])
          c.addIssue({
            code: "custom",
            message:
              "Для підтвердження потрібні діагноз, об’єктивні дані та висновок",
            path: [k],
          });
      if (!d.icd10_code && !d.no_icd_reason)
        c.addIssue({
          code: "custom",
          message: "Вкажіть код МКХ або поясніть його відсутність",
          path: ["icd10_code"],
        });
    }
  });
export const decisionInput = z.object({
  session_id: text(100),
  version: z.number().int().positive(),
  final_diagnosis: text(20000).min(1),
  final_decision: text(20000).min(1),
  order_402_article: text(1000).min(1),
  protocol_number: text(200).min(1),
  decision_date: day,
  fitness_category: category,
  finalize: z.boolean(),
});
export const userInput = z
  .object({
    id: text(100).optional(),
    username: text(50).regex(
      /^[a-z0-9._-]{3,50}$/,
      "Логін: 3–50 латинських символів",
    ),
    full_name: text().min(2),
    password: z.string().max(256),
    roles: z.array(role).min(1),
    specialty: z.union([specialty, z.literal("")]),
    is_active: z.boolean(),
  })
  .superRefine((d, c) => {
    if ((!d.id || d.password) && d.password.length < 12)
      c.addIssue({
        code: "custom",
        message: "Пароль: щонайменше 12 символів",
        path: ["password"],
      });
    if (d.roles.includes("DOCTOR") && !d.specialty)
      c.addIssue({
        code: "custom",
        message: "Оберіть спеціальність лікаря",
        path: ["specialty"],
      });
  });
