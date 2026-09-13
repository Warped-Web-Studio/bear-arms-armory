import { storeTimeZone } from "./business";

export const contentKinds = [
  "weekly",
  "monthly",
  "event",
  "announcement",
] as const;
export type ContentKind = (typeof contentKinds)[number];
export const kindLabels: Record<ContentKind, string> = {
  weekly: "Gun of the Week",
  monthly: "Gun of the Month",
  event: "Event",
  announcement: "Announcement",
};
export type ContentRecord = {
  id: string;
  kind: ContentKind;
  title: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  startsOn: string;
  endsOn: string;
  startTime: string;
  endTime: string;
  location: string;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
};
export function storeClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: storeTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (name: string) => parts.find((p) => p.type === name)!.value;
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    time: `${part("hour")}:${part("minute")}`,
  };
}
export function isActive(record: ContentRecord, date: string) {
  return record.published && record.startsOn <= date && record.endsOn >= date;
}
export function isUpcoming(record: ContentRecord, now = new Date()) {
  const clock = storeClock(now);
  return (
    record.published &&
    record.kind === "event" &&
    (record.endsOn > clock.date ||
      (record.endsOn === clock.date && record.endTime >= clock.time))
  );
}
export function selectHighlights(records: ContentRecord[], date: string) {
  const highlights = records.filter(
    (r) => r.kind === "weekly" || r.kind === "monthly",
  );
  const sorted = [...highlights].sort(
    (a, b) =>
      b.startsOn.localeCompare(a.startsOn) ||
      b.createdAt.getTime() - a.createdAt.getTime() ||
      b.id.localeCompare(a.id),
  );
  const weekly = sorted.find((r) => r.kind === "weekly" && isActive(r, date));
  const monthly = sorted.find((r) => r.kind === "monthly" && isActive(r, date));
  const archive = sorted.filter(
    (r) =>
      r.published &&
      r.startsOn <= date &&
      r.id !== weekly?.id &&
      r.id !== monthly?.id,
  );
  return { weekly, monthly, archive };
}
export function displayDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}
export function displayTime(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}
