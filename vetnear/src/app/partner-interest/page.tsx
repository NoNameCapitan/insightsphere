import type { Metadata } from "next";
import Link from "next/link";
import { isPartnerPlan } from "@/lib/partners/plans";
import { PartnerInterestForm } from "@/components/PartnerInterestForm";
import { getPublicPlace } from "@/lib/server/placesFeed";
import { getPartnerIntakeConfig } from "@/lib/partners/config";
import styles from "@/app/for-partners/partners.module.css";

export const metadata: Metadata = { title: "Заявка на партнерський пілот", robots: { index: false, follow: true } };
export const dynamic = "force-dynamic";
export default async function PartnerInterestPage({ searchParams }: { searchParams: Promise<{ plan?: string; founding?: string; claim?: string }> }) {
  const params = await searchParams;
  const place = params.claim ? await getPublicPlace(params.claim) : null;
  const config = getPartnerIntakeConfig();
  return <div className={styles.formPage}>
    <Link href="/for-partners" className={styles.inlineLink}>Партнерська програма</Link>
    <h1 className="mt-6">{place ? "Уточнімо ваш профіль" : "Почнімо з вашого закладу"}</h1>
    <p className={styles.lead}>{place ? "Залиште робочий контакт і потрібні зміни. Повноваження представника перевіряємо через офіційний канал закладу до оновлення картки." : "Назва, місто й робочий контакт — достатньо, щоб почати обговорення. Решту можна додати пізніше."}</p>
    {params.claim && !place && <p className={styles.error}>Цей профіль не знайдено. <Link href="/for-partners#find-your-place" className={styles.inlineLink}>Знайти свій заклад</Link></p>}
    <PartnerInterestForm initialPlan={isPartnerPlan(params.plan) ? params.plan : "free"} initialFounding={params.founding === "1"} intakeEnabled={config.intakeEnabled} contactEmail={config.contactEmail} claimPlace={place ? { slug: place.slug, name: place.name, locality: place.locality ?? "Київ", phone: place.phone, website: place.website } : undefined} />
  </div>;
}
