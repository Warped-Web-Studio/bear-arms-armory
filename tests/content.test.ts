import { describe, it, expect, afterEach, vi } from "vitest";
import {
  selectHighlights,
  isUpcoming,
  storeClock,
  type ContentRecord,
} from "@/lib/content";
import {
  contentSchema,
  allowedImageUrl,
  businessSchema,
} from "@/lib/validation";
import { defaultBusiness } from "@/lib/business";
const record = (changes: Partial<ContentRecord> = {}): ContentRecord => ({
  id: "a",
  kind: "weekly",
  title: "Community notice",
  description: "A general store update.",
  imageUrl: "",
  imageAlt: "",
  startsOn: "2026-09-01",
  endsOn: "2026-09-30",
  startTime: "",
  endTime: "",
  location: "",
  published: true,
  createdAt: new Date("2026-09-01Z"),
  updatedAt: new Date("2026-09-01Z"),
  ...changes,
});
afterEach(() => vi.unstubAllEnvs());
describe("highlights and history", () => {
  it("omits drafts and future highlights from current and archive", () => {
    expect(
      selectHighlights(
        [
          record({ published: false }),
          record({
            id: "future",
            startsOn: "2026-10-01",
            endsOn: "2026-10-31",
          }),
        ],
        "2026-09-12",
      ),
    ).toEqual({ weekly: undefined, monthly: undefined, archive: [] });
  });
  it("selects each kind independently and preserves replaced highlights", () => {
    const old = record();
    const current = record({ id: "b", startsOn: "2026-09-10" });
    const month = record({ id: "c", kind: "monthly" });
    const result = selectHighlights([old, current, month], "2026-09-12");
    expect(result.weekly?.id).toBe("b");
    expect(result.monthly?.id).toBe("c");
    expect(result.archive.map((r) => r.id)).toEqual(["a"]);
  });
  it("includes the last day then archives without deleting", () => {
    const records = [record({ endsOn: "2026-09-12" })];
    expect(selectHighlights(records, "2026-09-12").weekly?.id).toBe("a");
    expect(selectHighlights(records, "2026-09-13").archive).toEqual(records);
    expect(records).toHaveLength(1);
  });
  it("breaks equal-date ties by creation date then id", () => {
    expect(
      selectHighlights([record(), record({ id: "b" })], "2026-09-12").weekly
        ?.id,
    ).toBe("b");
  });
  it("handles no content", () => {
    expect(selectHighlights([], "2026-09-12").archive).toEqual([]);
  });
});
describe("events use store time", () => {
  it("uses Eastern dates across midnight and daylight saving seasons", () => {
    expect(storeClock(new Date("2026-09-13T02:00:00Z"))).toEqual({
      date: "2026-09-12",
      time: "22:00",
    });
    expect(storeClock(new Date("2026-01-13T02:00:00Z"))).toEqual({
      date: "2026-01-12",
      time: "21:00",
    });
  });
  it("retains ongoing events and removes ended ones", () => {
    const event = record({
      kind: "event",
      endsOn: "2026-09-12",
      startTime: "10:00",
      endTime: "17:00",
    });
    expect(isUpcoming(event, new Date("2026-09-12T20:59:00Z"))).toBe(true);
    expect(isUpcoming(event, new Date("2026-09-12T21:01:00Z"))).toBe(false);
    expect(
      isUpcoming({ ...event, published: false }, new Date("2026-09-12T20:00Z")),
    ).toBe(false);
  });
});
describe("server input validation", () => {
  it("allows content without an image", () => {
    expect(contentSchema.safeParse(record()).success).toBe(true);
  });
  it("rejects invalid and reversed dates", () => {
    expect(
      contentSchema.safeParse(record({ startsOn: "2026-02-30" })).success,
    ).toBe(false);
    expect(
      contentSchema.safeParse(record({ endsOn: "2026-08-01" })).success,
    ).toBe(false);
  });
  it("requires meaningful title, event times, and image descriptions", () => {
    for (const changes of [
      { title: " " },
      { kind: "event" as const },
      { imageUrl: "/derived/store.webp", imageAlt: "" },
    ])
      expect(contentSchema.safeParse(record(changes)).success).toBe(false);
  });
  it("limits image sources to a configured HTTPS host", () => {
    vi.stubEnv("IMAGE_HOST", "images.example.com");
    expect(allowedImageUrl("https://images.example.com/store.webp")).toBe(true);
    for (const value of [
      "javascript:alert(1)",
      "https://evil.com/a.jpg",
      "http://images.example.com/a.jpg",
      "https://images.example.com.evil.com/a.jpg",
      "/derived/../secret.png",
      "https://u:p@images.example.com/a.jpg",
    ])
      expect(allowedImageUrl(value)).toBe(false);
  });
  it("validates business contact fields", () => {
    expect(businessSchema.safeParse(defaultBusiness).success).toBe(true);
    expect(
      businessSchema.safeParse({ ...defaultBusiness, email: "invalid" })
        .success,
    ).toBe(false);
  });
});
