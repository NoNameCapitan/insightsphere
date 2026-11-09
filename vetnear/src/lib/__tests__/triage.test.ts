import { describe, it, expect } from "vitest";
import {
  triageFromAnswers,
  resolveTriage,
  maxLevel,
  FALLBACK_ADVICE,
  LEVEL_META,
} from "@/lib/triage/engine";
import type { QuestionnaireAnswers } from "@/lib/questionnaire";

const base: QuestionnaireAnswers = {
  intent: "general",
  urgency: null,
  duration: null,
  eating: null,
  symptoms: [],
};

describe("triageFromAnswers — red flags", () => {
  it.each([["breathing"], ["bleeding"], ["trauma"]] as const)(
    "symptom %s => emergency_now",
    (s) => {
      const r = triageFromAnswers({ ...base, symptoms: [s] });
      expect(r.level).toBe("emergency_now");
    },
  );

  it("intent=emergency => emergency_now", () => {
    expect(triageFromAnswers({ ...base, intent: "emergency" }).level).toBe("emergency_now");
  });

  it("urgency=critical => emergency_now", () => {
    expect(triageFromAnswers({ ...base, urgency: "critical" }).level).toBe("emergency_now");
  });

  it("not eating + weakness => emergency_now", () => {
    const r = triageFromAnswers({ ...base, eating: "no", symptoms: ["weakness"] });
    expect(r.level).toBe("emergency_now");
  });

  it("emergency CTA is the SAFE href (no fake 24/7 promise)", () => {
    const r = triageFromAnswers({ ...base, intent: "emergency" });
    expect(r.ctaHref).toContain("veterinary_clinic");
  });
});

describe("triageFromAnswers — amber zone", () => {
  it("vomiting alone => vet_today", () => {
    expect(triageFromAnswers({ ...base, symptoms: ["vomiting"] }).level).toBe("vet_today");
  });
  it("not eating alone => vet_today", () => {
    expect(triageFromAnswers({ ...base, eating: "no" }).level).toBe("vet_today");
  });
  it("urgency=high => vet_today", () => {
    expect(triageFromAnswers({ ...base, urgency: "high" }).level).toBe("vet_today");
  });
  it("reduced eating for days => vet_today", () => {
    const r = triageFromAnswers({ ...base, eating: "reduced", duration: "days" });
    expect(r.level).toBe("vet_today");
  });
});

describe("triageFromAnswers — green zone", () => {
  it("no flags => planned_visit with a reason", () => {
    const r = triageFromAnswers({ ...base, symptoms: ["none"], eating: "yes" });
    expect(r.level).toBe("planned_visit");
    expect(r.reasons.length).toBeGreaterThan(0);
  });
  it("grooming intent with healthy answers => planned_visit", () => {
    const r = triageFromAnswers({ ...base, intent: "grooming", eating: "yes" });
    expect(r.level).toBe("planned_visit");
  });
});

describe("resolveTriage — free text can only ESCALATE", () => {
  it("urgent free text escalates a green case to emergency_now", () => {
    const r = resolveTriage({ ...base, eating: "yes" }, "собака не дихає");
    expect(r.level).toBe("emergency_now");
  });

  it("calm free text NEVER downgrades a red case", () => {
    const r = resolveTriage(
      { ...base, symptoms: ["bleeding"] },
      "та все нормально, здається дрібниця",
    );
    expect(r.level).toBe("emergency_now");
  });

  it("non-urgent text keeps the deterministic level", () => {
    const r = resolveTriage({ ...base, symptoms: ["vomiting"] }, "зранку двічі");
    expect(r.level).toBe("vet_today");
  });
});

describe("maxLevel monotonicity", () => {
  it("never returns a softer level", () => {
    expect(maxLevel("planned_visit", "vet_today")).toBe("vet_today");
    expect(maxLevel("vet_today", "emergency_now")).toBe("emergency_now");
    expect(maxLevel("emergency_now", "planned_visit")).toBe("emergency_now");
    expect(maxLevel("vet_today", "vet_today")).toBe("vet_today");
  });
});

describe("meta and fallbacks are complete", () => {
  it("every level has meta and 3 fallback advice items", () => {
    for (const level of ["emergency_now", "vet_today", "planned_visit"] as const) {
      expect(LEVEL_META[level].title).toBeTruthy();
      expect(FALLBACK_ADVICE[level]).toHaveLength(3);
    }
  });
});
