import Link from "next/link";
export default function NotFound() {
  return (
    <div className="container-app py-16">
      <p className="page-eyebrow">404</p>
      <h1 className="page-title">Цієї сторінки немає</h1>
      <Link href="/" className="btn-primary mt-6">
        До робочого простору
      </Link>
    </div>
  );
}
