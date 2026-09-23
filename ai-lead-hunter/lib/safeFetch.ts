import { Agent, fetch as undiciFetch } from "undici";
import { resolvePublicAddresses, validateUrlSafety } from "./ssrf";
// Resolve once, validate every returned address, then PIN the connection to that
// result. A second DNS resolution during connect cannot rebind to a private IP.
export async function fetchWebsitePage(
  raw: string,
  signal: AbortSignal,
): Promise<{
  status: number;
  location: string | null;
  contentType: string;
  html: string;
  truncated: boolean;
}> {
  const safe = validateUrlSafety(raw);
  if (!safe.ok) throw new Error(safe.reason);
  const records = await new Promise<
    Awaited<ReturnType<typeof resolvePublicAddresses>>
  >((resolve, reject) => {
    const abort = () => reject(new Error("Таймаут DNS."));
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener("abort", abort, { once: true });
    resolvePublicAddresses(safe.url.hostname)
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
  const agent = new Agent({
    connect: {
      lookup(_hostname, options, callback) {
        const selected =
          records.find((r) => !options.family || r.family === options.family) ??
          records[0];
        // Node supports both the single-address and all-addresses lookup contracts.
        if (options.all) callback(null, records);
        else callback(null, selected.address, selected.family);
      },
      timeout: 6000,
    },
  });
  try {
    const res = await undiciFetch(safe.url, {
      dispatcher: agent,
      redirect: "manual",
      signal,
      headers: {
        "User-Agent": "AILeadHunter/0.3 (single-page website check)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    const result = {
      status: res.status,
      location: res.headers.get("location"),
      contentType: res.headers.get("content-type") ?? "",
      html: "",
      truncated: false,
    };
    if (
      res.status < 200 ||
      res.status >= 300 ||
      !/text\/html|application\/xhtml\+xml/i.test(result.contentType)
    ) {
      await res.body?.cancel();
      return result;
    }
    const reader = res.body?.getReader();
    if (reader) {
      const decoder = new TextDecoder();
      let bytes = 0;
      try {
        while (bytes < 200000) {
          const { done, value } = await reader.read();
          if (done) break;
          const allowed = value.subarray(0, 200000 - bytes);
          bytes += allowed.byteLength;
          result.html += decoder.decode(allowed, { stream: true });
          if (bytes >= 200000) {
            result.truncated = true;
            await reader.cancel();
            break;
          }
        }
        result.html += decoder.decode();
      } finally {
        reader.releaseLock();
      }
    }
    return result;
  } finally {
    await agent.destroy();
  }
}
