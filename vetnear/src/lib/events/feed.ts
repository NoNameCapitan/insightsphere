import { eventStatus, type KyivEvent } from "@/lib/data/kyivUpdates";

export type EventFeedGroup = "dated" | "ongoing" | "pending" | "archive";
export const EVENT_FEED_GROUPS: { id: EventFeedGroup; title: string; description: string }[] = [
  { id: "dated", title: "Підтверджені дати", description: "Заходи з опублікованими умовами. Перед поїздкою звірте можливі зміни." },
  { id: "ongoing", title: "Доступно постійно", description: "Вакцинації, адопція та корисні сервіси — коли це потрібно вам." },
  { id: "pending", title: "Очікуємо підтвердження", description: "Збережіть анонс, але уточніть дату й умови в організатора перед поїздкою." },
  { id: "archive", title: "Минулі події", description: "Ці дати вже минули. Нову акцію потрібно підтвердити окремо." },
];

/** Groups describe evidence and timing, never infer a date or current availability. */
export function groupEventFeed(events: KyivEvent[], now: Date) {
  const grouped: Record<EventFeedGroup, KyivEvent[]> = { dated: [], ongoing: [], pending: [], archive: [] };
  for (const event of events) {
    const status = eventStatus(event, now);
    const key: EventFeedGroup = status === "expired" ? "archive"
      : status === "needs_confirmation" ? "pending"
      : event.schedule.kind === "date" ? "dated" : "ongoing";
    grouped[key].push(event);
  }
  grouped.dated.sort((a, b) => {
    if (a.schedule.kind !== "date" || b.schedule.kind !== "date") return 0;
    return a.schedule.startDate.localeCompare(b.schedule.startDate);
  });
  return EVENT_FEED_GROUPS.map((group) => ({ ...group, events: grouped[group.id] })).filter((group) => group.events.length);
}
