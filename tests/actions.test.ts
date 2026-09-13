import { beforeEach, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getDb: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock("@/lib/admin", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/db", () => ({ getDb: mocks.getDb }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
import { saveContent, deleteContent, saveBusiness } from "@/app/admin/actions";
const initial = { message: "", ok: false };
const form = () => {
  const f = new FormData();
  Object.entries({
    kind: "weekly",
    title: "Community update",
    description: "News from around the store.",
    startsOn: "2026-09-01",
    endsOn: "2026-09-30",
    startTime: "",
    endTime: "",
    imageUrl: "",
    imageAlt: "",
    location: "",
    published: "on",
  }).forEach(([k, v]) => f.set(k, v));
  return f;
};
beforeEach(() => {
  mocks.requireAdmin.mockResolvedValue({ id: "admin" });
});
it.each([saveContent, deleteContent, saveBusiness])(
  "checks authorization before touching the database",
  async (action) => {
    mocks.requireAdmin.mockRejectedValue(new Error("Unauthorized"));
    await expect(action(initial, new FormData())).rejects.toThrow(
      "Unauthorized",
    );
    expect(mocks.getDb).not.toHaveBeenCalled();
  },
);
it("does not persist invalid input", async () => {
  expect((await saveContent(initial, new FormData())).ok).toBe(false);
  expect(mocks.getDb).not.toHaveBeenCalled();
});
it("creates an image-free highlight and invalidates public content", async () => {
  const values = vi.fn().mockResolvedValue([]);
  mocks.getDb.mockReturnValue({ insert: () => ({ values }) });
  const result = await saveContent(initial, form());
  expect(result.ok).toBe(true);
  expect(values).toHaveBeenCalledWith(
    expect.objectContaining({ imageUrl: "", published: true, kind: "weekly" }),
  );
  expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
});
it("updates an existing record without duplicating it", async () => {
  const returning = vi.fn().mockResolvedValue([{ id: "a" }]);
  const set = vi.fn(() => ({ where: () => ({ returning }) }));
  mocks.getDb.mockReturnValue({ update: () => ({ set }) });
  const f = form();
  f.set("id", "00000000-0000-4000-8000-000000000001");
  expect((await saveContent(initial, f)).ok).toBe(true);
  expect(set).toHaveBeenCalledWith(
    expect.objectContaining({ title: "Community update" }),
  );
});
it("requires explicit destructive confirmation", async () => {
  const f = new FormData();
  f.set("id", "00000000-0000-4000-8000-000000000001");
  expect((await deleteContent(initial, f)).ok).toBe(false);
  expect(mocks.getDb).not.toHaveBeenCalled();
});
it("deletes only the validated record after confirmation", async () => {
  const where = vi.fn().mockResolvedValue([]);
  mocks.getDb.mockReturnValue({ delete: () => ({ where }) });
  const f = new FormData();
  f.set("id", "00000000-0000-4000-8000-000000000001");
  f.set("confirm", "on");
  expect((await deleteContent(initial, f)).ok).toBe(true);
  expect(where).toHaveBeenCalledOnce();
});
it("returns a safe error on database failure", async () => {
  mocks.getDb.mockImplementation(() => {
    throw new Error("secret connection string");
  });
  const result = await saveContent(initial, form());
  expect(result.ok).toBe(false);
  expect(result.message).not.toContain("secret");
});
