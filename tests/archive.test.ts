import { describe, expect, it } from "vitest";
import {
  archiveMonth,
  archiveOptions,
  displayArchiveMonth,
  displayArchiveRange,
  groupArchive,
  nextMonth,
} from "@/lib/archive";
import {
  selectHighlights,
  storeClock,
  type ContentRecord,
} from "@/lib/content";
const record = (
  id: string,
  startsOn: string,
  changes: Partial<ContentRecord> = {},
): ContentRecord => ({
  id,
  startsOn,
  endsOn: startsOn,
  kind: "weekly",
  title: "Sample highlight",
  description: "Sample description",
  imageUrl: "",
  imageAlt: "",
  startTime: "",
  endTime: "",
  location: "",
  published: true,
  createdAt: new Date("2026-01-01Z"),
  updatedAt: new Date("2026-01-01Z"),
  ...changes,
});
describe("archive dates", () => {
  it.each([
    ["2026-09-14", "2026-09-20", "September 14–20, 2026"],
    ["2026-09-28", "2026-10-04", "September 28 – October 4, 2026"],
    ["2026-12-28", "2027-01-03", "December 28, 2026 – January 3, 2027"],
    ["2026-09-14", "2026-09-14", "September 14, 2026"],
    ["2026-09-02", "2026-09-12", "September 2–12, 2026"],
    ["", "2026-09-12", "Dates unavailable"],
    ["2026-02-30", "2026-03-04", "Dates unavailable"],
    ["2026-09-12", "2026-09-01", "Dates unavailable"],
  ])("formats %s to %s exactly", (start, end, result) =>
    expect(displayArchiveRange(start, end)).toBe(result),
  );
  it("groups by original start month, including cross-month weeks, without mutating records", () => {
    const records = [
      record("a", "2025-12-28", { endsOn: "2026-01-03" }),
      record("b", "2026-09-28", { endsOn: "2026-10-04" }),
      record("c", "2026-09-07"),
      record("d", "2026-01-01"),
    ];
    const groups = groupArchive(records);
    expect(groups.map((g) => g.label)).toEqual([
      "September 2026",
      "January 2026",
      "December 2025",
    ]);
    expect(groups[0].entries.map((r) => r.id)).toEqual(["b", "c"]);
    expect(records[0].id).toBe("a");
  });
  it("labels unknown legacy dates rather than inventing a month", () => {
    expect(archiveMonth("unknown")).toBeNull();
    expect(groupArchive([record("a", "unknown")])[0].label).toBe(
      "Dates unavailable",
    );
    expect(displayArchiveMonth("2026-13")).toBe("Dates unavailable");
    expect(groupArchive([])).toEqual([]);
  });
  it("uses the Eastern current month and handles December rollover", () => {
    const today = storeClock(new Date("2026-10-01T02:00:00Z")).date;
    expect(archiveOptions({}, today).month).toBe("2026-09");
    expect(nextMonth("2026-12")).toBe("2027-01");
    expect(nextMonth("2026-09")).toBe("2026-10");
  });
  it.each(["2026-13", "2026-10", ["2026-08", "2026-07"], "invalid"])(
    "rejects invalid/future month query %j",
    (weekly) => {
      expect(
        archiveOptions(
          { weekly, weeklyPage: "-1", monthlyPage: "bad" },
          "2026-09-18",
        ),
      ).toEqual({
        currentMonth: "2026-09",
        month: "2026-09",
        weeklyPage: 1,
        monthlyPage: 1,
      });
    },
  );
  it("keeps previous features when a newer feature takes over and excludes drafts/future content", () => {
    const old = record("old", "2026-09-01", { endsOn: "2026-09-30" });
    const newer = record("new", "2026-09-14", { endsOn: "2026-09-20" });
    const data = selectHighlights(
      [
        old,
        newer,
        record("draft", "2026-09-13", { published: false }),
        record("future", "2026-10-01"),
      ],
      "2026-09-18",
    );
    expect(data.weekly?.id).toBe("new");
    expect(data.archive.map((r) => r.id)).toEqual(["old"]);
    expect(old.title).toBe("Sample highlight");
  });
});
