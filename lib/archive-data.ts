import "server-only";
import { and, desc, eq, gte, lt, lte, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { content } from "@/db/schema";
import { storeClock, type ContentRecord } from "./content";
import {
  ARCHIVE_PAGE_SIZE,
  archiveMonth,
  archiveOptions,
  nextMonth,
  type ArchiveQuery,
} from "./archive";

export async function getArchive(query: ArchiveQuery, now = new Date()) {
  const today = storeClock(now).date;
  const options = archiveOptions(query, today);
  const empty = {
    ...options,
    monthly: [] as ContentRecord[],
    weekly: [] as ContentRecord[],
    moreMonthly: false,
    moreWeekly: false,
    olderMonth: null as string | null,
    unavailable: false,
  };
  if (!process.env.DATABASE_URL) return empty;
  try {
    const db = getDb();
    const newest = [
      desc(content.startsOn),
      desc(content.createdAt),
      desc(content.id),
    ];
    // Match the homepage's current-feature selection, including replacement ties.
    const active = (kind: "weekly" | "monthly") =>
      db
        .select({ id: content.id })
        .from(content)
        .where(
          and(
            eq(content.kind, kind),
            eq(content.published, true),
            lte(content.startsOn, today),
            gte(content.endsOn, today),
          ),
        )
        .orderBy(...newest)
        .limit(1);
    const [week, month] = await Promise.all([
      active("weekly"),
      active("monthly"),
    ]);
    const historical = (kind: "weekly" | "monthly", currentId?: string) =>
      and(
        eq(content.kind, kind),
        eq(content.published, true),
        lte(content.startsOn, today),
        currentId ? ne(content.id, currentId) : undefined,
      );
    const weeklyFilter = historical("weekly", week[0]?.id);
    const [monthly, weekly, older] = await Promise.all([
      db
        .select()
        .from(content)
        .where(historical("monthly", month[0]?.id))
        .orderBy(...newest)
        .limit(ARCHIVE_PAGE_SIZE + 1)
        .offset((options.monthlyPage - 1) * ARCHIVE_PAGE_SIZE),
      db
        .select()
        .from(content)
        .where(
          and(
            weeklyFilter,
            gte(content.startsOn, `${options.month}-01`),
            lt(content.startsOn, `${nextMonth(options.month)}-01`),
          ),
        )
        .orderBy(...newest)
        .limit(ARCHIVE_PAGE_SIZE + 1)
        .offset((options.weeklyPage - 1) * ARCHIVE_PAGE_SIZE),
      db
        .select({ startsOn: content.startsOn })
        .from(content)
        .where(and(weeklyFilter, lt(content.startsOn, `${options.month}-01`)))
        .orderBy(...newest)
        .limit(1),
    ]);
    return {
      ...options,
      monthly: monthly.slice(0, ARCHIVE_PAGE_SIZE),
      weekly: weekly.slice(0, ARCHIVE_PAGE_SIZE),
      moreMonthly: monthly.length > ARCHIVE_PAGE_SIZE,
      moreWeekly: weekly.length > ARCHIVE_PAGE_SIZE,
      olderMonth: older[0] ? archiveMonth(older[0].startsOn) : null,
      unavailable: false,
    };
  } catch {
    console.error("Gallery archive could not be loaded.");
    return { ...empty, unavailable: true };
  }
}
