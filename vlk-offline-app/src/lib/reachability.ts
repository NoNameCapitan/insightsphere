// Розрізнення «сервер мовчить» і «сервер відповів, але база не готова».
// Винесено окремо від компонента, щоб покрити тестами: саме тут була помилка,
// через яку 503 від /api/health показувався як недоступний сервер.
export type Reachability = "ok" | "degraded" | "offline";

export async function probeHealth(
  fetcher: typeof fetch = fetch,
  timeout = 4000,
): Promise<Reachability> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetcher("/api/health", {
      cache: "no-store",
      signal: controller.signal,
    });
    // Будь-яка HTTP-відповідь означає, що сервер живий. 503 — це стан бази,
    // а не втрата зв'язку, і формулювання попередження має бути іншим.
    return response.ok ? "ok" : "degraded";
  } catch {
    return "offline";
  } finally {
    clearTimeout(timer);
  }
}

// Адреса в локальній мережі або на цьому ж комп'ютері.
export function isLocalHost(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]" ||
    hostname.endsWith(".local") ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  );
}
