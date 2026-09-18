import { afterEach, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/pg-proxy";
const mocks = vi.hoisted(() => ({ db: vi.fn() }));
vi.mock("@/db", () => ({ getDb: mocks.db }));
import { getArchive } from "@/lib/archive-data";
afterEach(() => vi.unstubAllEnvs());
const now = new Date("2026-09-18T16:00:00Z");
const row = (id: string, kind: string, date: string) => [
  id,
  kind,
  `Sample ${id}`,
  "Description",
  "",
  "",
  date,
  date,
  "",
  "",
  "",
  true,
  "2026-01-01T00:00:00Z",
  "2026-01-01T00:00:00Z",
];
it("queries bounded archives, excludes both current records, and initially fetches only current-month weeks", async () => {
  vi.stubEnv("DATABASE_URL", "test");
  const responses = [
    [["current-week"]],
    [["current-month"]],
    Array.from({ length: 13 }, (_, i) =>
      row(String(i), "monthly", "2026-08-01"),
    ),
    [row("week", "weekly", "2026-09-07")],
    [["2026-07-21"]],
  ];
  const execute = vi.fn(async () => ({ rows: responses.shift() || [] }));
  const queries: { sql: string; params: unknown[] }[] = [];
  mocks.db.mockReturnValue(
    drizzle(async (sql, params) => {
      queries.push({ sql, params });
      return execute();
    }),
  );
  const result = await getArchive({}, now);
  expect(result.unavailable).toBe(false);
  expect(result.monthly).toHaveLength(12);
  expect(result.moreMonthly).toBe(true);
  expect(result.weekly[0].startsOn).toBe("2026-09-07");
  expect(result.olderMonth).toBe("2026-07");
  expect(queries).toHaveLength(5);
  expect(queries[2].params).toEqual(
    expect.arrayContaining([
      "monthly",
      true,
      "2026-09-18",
      "current-month",
      13,
    ]),
  );
  expect(queries[3].params).toEqual(
    expect.arrayContaining([
      "weekly",
      true,
      "2026-09-18",
      "current-week",
      "2026-09-01",
      "2026-10-01",
      13,
    ]),
  );
  expect(queries[3].sql).toContain('"starts_on" >=');
  expect(queries[3].sql).toContain('"starts_on" <');
  expect(queries[3].sql).toContain('"id" <>');
  expect(queries[4].params).toEqual(expect.arrayContaining(["2026-09-01", 1]));
  expect(queries[4].sql).toContain('"starts_on" <');
});
it("View More selects only the requested older month with bounded page offsets", async () => {
  vi.stubEnv("DATABASE_URL", "test");
  const queries: { sql: string; params: unknown[] }[] = [];
  mocks.db.mockReturnValue(
    drizzle(async (sql, params) => {
      queries.push({ sql, params });
      return { rows: [] };
    }),
  );
  const result = await getArchive(
    { weekly: "2025-12", weeklyPage: "2", monthlyPage: "3" },
    now,
  );
  expect(result.month).toBe("2025-12");
  expect(queries[3].params).toEqual(
    expect.arrayContaining(["2025-12-01", "2026-01-01", 13, 12]),
  );
  expect(queries[2].params).toContain(24);
  expect(result.olderMonth).toBeNull();
});
it("handles missing services and database errors without leaking details", async () => {
  vi.stubEnv("DATABASE_URL", "");
  expect((await getArchive({}, now)).unavailable).toBe(false);
  expect(mocks.db).not.toHaveBeenCalled();
  vi.stubEnv("DATABASE_URL", "test");
  mocks.db.mockImplementationOnce(() => {
    throw new Error("private error");
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
  expect((await getArchive({}, now)).unavailable).toBe(true);
  expect(console.error).toHaveBeenCalledWith(
    "Gallery archive could not be loaded.",
  );
});
