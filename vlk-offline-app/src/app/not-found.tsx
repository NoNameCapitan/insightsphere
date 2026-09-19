import Link from "next/link";
export default function NotFound() {
  return (
    <main className="error-page">
      <h1>Картку не знайдено</h1>
      <Link href="/">Повернутися до черги</Link>
    </main>
  );
}
