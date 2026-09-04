import type { Metadata } from "next";
import { Landing } from "@/components/Landing";
import { PLACES } from "@/lib/data/places";
import {
  hasPhoneConfirmedEmergency,
  isPublicEmergencyVisible,
  SAFE_EMERGENCY_CTA_HREF,
  SAFE_EMERGENCY_CTA_LABEL,
} from "@/lib/data/verification";

const PATH = "/emergency-vet-near-me";

export const metadata: Metadata = {
  title: "Термінова ветдопомога поруч — найближчі ветклініки",
  description:
    "Найближчі ветклініки для термінової ситуації. Цілодобові провайдери додаються тільки після підтвердження дзвінком.",
  alternates: { canonical: PATH },
};

export default function Page() {
  // Public emergency-first list: demo/unverified emergency hidden unless
  // NEXT_PUBLIC_SHOW_DEMO_EMERGENCY=true.
  const places = PLACES.filter(
    (p) => (p.emergencyAvailable || p.isOpen24_7) && isPublicEmergencyVisible(p),
  ).slice(0, 30);

  // Until at least one place is phone-confirmed for emergency, don't promise
  // 24/7 care — send people to the nearest vet clinics instead.
  const confirmed = hasPhoneConfirmedEmergency(PLACES);
  const ctaHref = confirmed ? "/nearby?category=emergency_vet&emergency=1" : SAFE_EMERGENCY_CTA_HREF;
  const ctaLabel = confirmed ? "Показати невідкладні" : SAFE_EMERGENCY_CTA_LABEL;

  return (
    <Landing
      h1="Термінова ситуація з твариною — найближчі ветклініки"
      intro="Дані про термінову/цілодобову допомогу мають бути підтверджені вручну перед публічним запуском. У критичній ситуації телефонуйте у клініку напряму."
      places={places}
      path={PATH}
      ctaHref={ctaHref}
      ctaLabel={ctaLabel}
      emergencyMode
    />
  );
}
