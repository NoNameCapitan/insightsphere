import type { Metadata } from "next";
import { Questionnaire } from "@/components/Questionnaire";
import { t } from "@/lib/i18n";

export const metadata: Metadata = {
  title: t.questionnaire.title,
  description: t.questionnaire.intro,
  alternates: { canonical: "/questionnaire" },
};

export default function QuestionnairePage() {
  return <Questionnaire />;
}
