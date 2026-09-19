// Єдина точка застосування міграцій: локальний файл чи віддалена база libSQL
// визначаються за DATABASE_URL, окремих команд для розгортання не потрібно.
import { applyOfflineEnv, databaseUrl, isRemoteUrl } from "./offline.mjs";

applyOfflineEnv();
try {
  if (isRemoteUrl(databaseUrl())) {
    const { applyRemoteMigrations } = await import("./migrate-remote.mjs");
    await applyRemoteMigrations();
  } else {
    const { applyMigrations } = await import("./migrate-offline.mjs");
    applyMigrations();
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
