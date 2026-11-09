const endpoint = "https://api.ukrainealarm.com/api/v3/alerts";
const token = process.env.UKRAINE_ALARM_API_TOKEN?.trim();

if (!token) {
  console.error("UKRAINE_ALARM_API_TOKEN is not configured.");
  process.exitCode = 1;
} else {
  try {
    const response = await fetch(endpoint, {
      headers: { Accept: "application/json", Authorization: token },
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      throw new Error(`UkraineAlarm returned HTTP ${response.status}`);
    }

    const payload = await response.json();
    const records = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.states)
        ? payload.states
        : Array.isArray(payload?.alerts)
          ? payload.alerts
          : [];
    const kyiv = records.find((record) => {
      const name = String(record?.regionName ?? record?.regionEngName ?? record?.name ?? "").toLowerCase();
      const type = String(record?.regionType ?? record?.type ?? "").toLowerCase();
      return (
        name === "м. київ" ||
        name === "київ" ||
        name === "kyiv city" ||
        name === "kyiv" ||
        (name.includes("київ") && (type.includes("city") || type.includes("міст")))
      );
    });

    if (!kyiv) throw new Error("The response has no separate Kyiv city record");

    const activeAlerts = Array.isArray(kyiv.activeAlerts) ? kyiv.activeAlerts : [];
    console.log(JSON.stringify({
      ok: true,
      region: "Kyiv city",
      state: activeAlerts.length > 0 ? "active" : "inactive",
      checkedAt: new Date().toISOString(),
    }, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "UkraineAlarm check failed");
    process.exitCode = 1;
  }
}
