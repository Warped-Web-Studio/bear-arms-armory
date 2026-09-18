import type { ContentRecord } from "./content";

export const ARCHIVE_PAGE_SIZE = 12;
export type ArchiveQuery = Record<string, string | string[] | undefined>;
export function validArchiveDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
export function archiveMonth(value: string) {
  return validArchiveDate(value) ? value.slice(0, 7) : null;
}
export function displayArchiveMonth(month: string) {
  if (!validArchiveDate(`${month}-01`)) return "Dates unavailable";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T12:00:00Z`));
}
export function displayArchiveRange(start: string, end: string) {
  if (!validArchiveDate(start) || !validArchiveDate(end) || end < start)
    return "Dates unavailable";
  const monthDay = (value: string) =>
    new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${value}T12:00:00Z`));
  if (start === end) return `${monthDay(start)}, ${start.slice(0, 4)}`;
  if (start.slice(0, 7) === end.slice(0, 7))
    return `${monthDay(start)}–${Number(end.slice(8))}, ${start.slice(0, 4)}`;
  if (start.slice(0, 4) === end.slice(0, 4))
    return `${monthDay(start)} – ${monthDay(end)}, ${start.slice(0, 4)}`;
  return `${monthDay(start)}, ${start.slice(0, 4)} – ${monthDay(end)}, ${end.slice(0, 4)}`;
}
export function groupArchive(records: ContentRecord[]) {
  const groups = new Map<string, ContentRecord[]>();
  const sorted = [...records].sort(
    (a, b) =>
      (archiveMonth(b.startsOn) || "").localeCompare(
        archiveMonth(a.startsOn) || "",
      ) ||
      b.startsOn.localeCompare(a.startsOn) ||
      b.createdAt.getTime() - a.createdAt.getTime() ||
      b.id.localeCompare(a.id),
  );
  for (const record of sorted) {
    const month = archiveMonth(record.startsOn) || "unknown";
    groups.set(month, [...(groups.get(month) || []), record]);
  }
  return [...groups].map(([month, entries]) => ({
    month,
    label: displayArchiveMonth(month),
    entries,
  }));
}
export function archiveOptions(query: ArchiveQuery, today: string) {
  const currentMonth = today.slice(0, 7);
  const month =
    typeof query.weekly === "string" &&
    validArchiveDate(`${query.weekly}-01`) &&
    query.weekly <= currentMonth
      ? query.weekly
      : currentMonth;
  const page = (value: string | string[] | undefined) =>
    typeof value === "string" && /^[1-9]\d{0,3}$/.test(value)
      ? Number(value)
      : 1;
  return {
    currentMonth,
    month,
    weeklyPage: page(query.weeklyPage),
    monthlyPage: page(query.monthlyPage),
  };
}
export function nextMonth(month: string) {
  const [year, number] = month.split("-").map(Number);
  return number === 12
    ? `${year + 1}-01`
    : `${year}-${String(number + 1).padStart(2, "0")}`;
}
export function archiveHref(
  options: { month: string; weeklyPage: number; monthlyPage: number },
  anchor: "weekly-archive" | "monthly-archive",
) {
  const query = new URLSearchParams({
    weekly: options.month,
    weeklyPage: String(options.weeklyPage),
    monthlyPage: String(options.monthlyPage),
  });
  return `/gallery?${query}#${anchor}`;
}
