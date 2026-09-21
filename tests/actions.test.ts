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
// The browser posts every business field as a string, including the
// inventory visibility flag the form carries in a hidden input.
const businessForm = (business: Record<string, unknown>) => {
  const f = new FormData();
  Object.entries(business).forEach(([key, value]) => f.set(key, String(value)));
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
  expect(mocks.revalidatePath).toHaveBeenCalledWith("/gallery");
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
  expect(mocks.revalidatePath).toHaveBeenCalledWith("/gallery");
});
it("returns a safe error on database failure", async () => {
  mocks.getDb.mockImplementation(() => {
    throw new Error("secret connection string");
  });
  const result = await saveContent(initial, form());
  expect(result.ok).toBe(false);
  expect(result.message).not.toContain("secret");
});

it.each([
  { storeImageUrl: "", storeImageAlt: "" },
  { storeImageUrl: "/derived/store.webp", storeImageAlt: "Inside the store" },
  { storeImageUrl: "", storeImageAlt: "Previous description" },
])("saves business photograph settings: %j", async (photo) => {
  const { defaultBusiness } = await import("@/lib/business");
  const onConflictDoUpdate = vi.fn().mockResolvedValue([]);
  const values = vi.fn(() => ({ onConflictDoUpdate }));
  mocks.getDb.mockReturnValue({ insert: () => ({ values }) });
  const data = businessForm({ ...defaultBusiness, ...photo });
  expect((await saveBusiness(initial, data)).ok).toBe(true);
  expect(values).toHaveBeenCalledWith({
    id: 1,
    business: { ...defaultBusiness, ...photo },
  });
  expect(onConflictDoUpdate).toHaveBeenCalledWith(
    expect.objectContaining({
      set: expect.objectContaining({
        business: { ...defaultBusiness, ...photo },
      }),
    }),
  );
  expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
});

it.each(["", "   "])(
  "rejects a store photograph without a meaningful description: %j",
  async (description) => {
    const { defaultBusiness } = await import("@/lib/business");
    const data = businessForm({
      ...defaultBusiness,
      storeImageUrl: "/derived/store.webp",
      storeImageAlt: description,
    });
    const result = await saveBusiness(initial, data);
    expect(result.ok).toBe(false);
    expect(result.errors?.storeImageAlt).toContain(
      "Describe the store photograph.",
    );
    expect(mocks.getDb).not.toHaveBeenCalled();
  },
);

it.each([
  { storePhotos: [] },
  { storePhotos: [{ url: "/derived/portrait.webp", description: "Portrait" }] },
  {
    storePhotos: [
      { url: "/derived/wide.webp", description: "Wide" },
      { url: "/derived/tall.webp", description: "Tall" },
    ],
  },
])(
  "persists and reloads an ordered gallery while retaining legacy data: %j",
  async ({ storePhotos }) => {
    const { defaultBusiness, getStorePhotos } = await import("@/lib/business");
    const { getBusiness } = await import("@/lib/data");
    vi.stubEnv("DATABASE_URL", "test-only");
    try {
      const legacy = {
        ...defaultBusiness,
        storeImageUrl: "/derived/old.webp",
        storeImageAlt: "Old photo",
      };
      const data = businessForm(legacy);
      data.set("storePhotos", JSON.stringify(storePhotos));
      const onConflictDoUpdate = vi.fn().mockResolvedValue([]);
      const values = vi.fn<
        (value: unknown) => { onConflictDoUpdate: typeof onConflictDoUpdate }
      >(() => ({ onConflictDoUpdate }));
      mocks.getDb.mockReturnValue({ insert: () => ({ values }) });
      expect((await saveBusiness(initial, data)).ok).toBe(true);
      const persisted = values.mock.calls[0][0] as unknown as {
        business: typeof legacy & { storePhotos: typeof storePhotos };
      };
      expect(persisted.business).toEqual({ ...legacy, storePhotos });
      mocks.getDb.mockReturnValue({
        select: () => ({
          from: () => ({ where: () => ({ limit: async () => [persisted] }) }),
        }),
      });
      const reloaded = await getBusiness();
      expect(getStorePhotos(reloaded)).toEqual(storePhotos);
    } finally {
      vi.unstubAllEnvs();
    }
  },
);

it.each([
  "not json",
  "null",
  "{}",
  JSON.stringify([{ url: "/derived/test.webp", description: "   " }]),
  JSON.stringify([{ url: "javascript:alert(1)", description: "Unsafe" }]),
  JSON.stringify([{ url: "", description: "Missing image" }]),
  JSON.stringify(
    Array.from({ length: 21 }, () => ({
      url: "/derived/test.webp",
      description: "Too many",
    })),
  ),
])("rejects invalid gallery data without writing: %s", async (photos) => {
  const { defaultBusiness } = await import("@/lib/business");
  const data = businessForm(defaultBusiness);
  data.set("storePhotos", photos);
  const result = await saveBusiness(initial, data);
  expect(result.ok).toBe(false);
  expect(result.errors?.storePhotos?.length).toBeGreaterThan(0);
  expect(mocks.getDb).not.toHaveBeenCalled();
});

it("reads an unmigrated saved photograph as the first gallery photo without writing", async () => {
  const { defaultBusiness, getStorePhotos } = await import("@/lib/business");
  const { getBusiness } = await import("@/lib/data");
  vi.stubEnv("DATABASE_URL", "test-only");
  try {
    const business = {
      ...defaultBusiness,
      storeImageUrl: "/derived/old.webp",
      storeImageAlt: "Existing photograph",
    };
    const insert = vi.fn();
    mocks.getDb.mockReturnValue({
      insert,
      select: () => ({
        from: () => ({ where: () => ({ limit: async () => [{ business }] }) }),
      }),
    });
    expect(getStorePhotos(await getBusiness())).toEqual([
      { url: business.storeImageUrl, description: business.storeImageAlt },
    ]);
    expect(insert).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllEnvs();
  }
});

it.each([
  { accessoriesPhotos: [] },
  {
    accessoriesPhotos: [
      { url: "/derived/knives.webp", description: "Knife case" },
    ],
  },
  {
    accessoriesPhotos: [
      { url: "/derived/lights.webp", description: "Flashlights" },
      { url: "/derived/optics.webp", description: "Scopes" },
    ],
  },
])(
  "saves ordered knives, lights and optics photos and clears the old single photo: %j",
  async ({ accessoriesPhotos }) => {
    const { defaultBusiness, getAccessoriesPhotos } =
      await import("@/lib/business");
    const onConflictDoUpdate = vi.fn().mockResolvedValue([]);
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    mocks.getDb.mockReturnValue({ insert: () => ({ values }) });
    const business = {
      ...defaultBusiness,
      accessoriesImageUrl: "",
      accessoriesDescription: "Client description",
    };
    const data = businessForm(business);
    data.set("accessoriesPhotos", JSON.stringify(accessoriesPhotos));
    expect((await saveBusiness(initial, data)).ok).toBe(true);
    expect(values).toHaveBeenCalledWith({
      id: 1,
      business: { ...business, accessoriesPhotos },
    });
    expect(
      getAccessoriesPhotos({
        ...business,
        accessoriesImageUrl: "/derived/old.webp",
        accessoriesPhotos,
      }),
    ).toEqual(accessoriesPhotos);
  },
);

it.each([
  "not json",
  "{}",
  JSON.stringify([{ url: "/derived/test.webp", description: "   " }]),
  JSON.stringify([{ url: "javascript:alert(1)", description: "Unsafe" }]),
  JSON.stringify(
    Array.from({ length: 21 }, () => ({
      url: "/derived/test.webp",
      description: "Too many",
    })),
  ),
])(
  "rejects invalid knives, lights and optics photos without writing: %s",
  async (photos) => {
    const { defaultBusiness } = await import("@/lib/business");
    const data = businessForm(defaultBusiness);
    data.set("accessoriesPhotos", photos);
    const result = await saveBusiness(initial, data);
    expect(result.ok).toBe(false);
    expect(result.errors?.accessoriesPhotos?.length).toBeGreaterThan(0);
    expect(mocks.getDb).not.toHaveBeenCalled();
  },
);

it("shows an unmigrated knives, lights and optics photo until the list is saved", async () => {
  const { defaultBusiness, getAccessoriesPhotos } =
    await import("@/lib/business");
  expect(
    getAccessoriesPhotos({
      ...defaultBusiness,
      accessoriesImageUrl: "/derived/old.webp",
    }),
  ).toEqual([
    {
      url: "/derived/old.webp",
      description: "Knives, lights and optics at Bear Arms Armory",
    },
  ]);
});
