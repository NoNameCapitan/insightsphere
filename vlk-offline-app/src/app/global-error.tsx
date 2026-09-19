"use client";
// Остання межа: спрацьовує, коли виняток стався поза межами кореневого
// макета. Власні <html> і <body> обов'язкові — макет сюди вже не потрапляє.
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="uk">
      <body
        style={{
          margin: 0,
          fontFamily: 'Arial, "Segoe UI", system-ui, sans-serif',
          background: "#f4f6f7",
          color: "#1e303b",
        }}
      >
        <main style={{ maxWidth: 640, margin: "0 auto", padding: "48px 16px" }}>
          <h1 style={{ fontSize: 22, margin: "0 0 12px" }}>
            Застосунок не вдалося відобразити
          </h1>
          <p>
            Збережені записи залишаються в базі. Не закривайте вкладки з
            незбереженими формами — текст залишається на екрані.
          </p>
          <p>
            Перевірте стан сервера за адресою <code>/api/health</code>.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 16,
              padding: "10px 16px",
              borderRadius: 12,
              border: "none",
              background: "#126b62",
              color: "#fff",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Повторити
          </button>
        </main>
      </body>
    </html>
  );
}
