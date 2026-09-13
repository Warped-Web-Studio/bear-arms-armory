import { beforeEach, afterEach, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  authConfigured: vi.fn(),
  isAdminEmail: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  authConfigured: mocks.authConfigured,
  isAdminEmail: mocks.isAdminEmail,
  getAuth: () => ({ api: { getSession: mocks.getSession } }),
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`Redirect:${path}`);
  },
}));
import { requireAdmin } from "@/lib/admin";
beforeEach(() => {
  mocks.authConfigured.mockReturnValue(true);
  mocks.isAdminEmail.mockReturnValue(true);
});
afterEach(() => vi.unstubAllEnvs());
it("fails closed when auth is not configured", async () => {
  mocks.authConfigured.mockReturnValue(false);
  await expect(requireAdmin()).rejects.toThrow("Redirect:/admin/login");
  expect(mocks.getSession).not.toHaveBeenCalled();
});
it("rejects missing sessions", async () => {
  mocks.getSession.mockResolvedValue(null);
  await expect(requireAdmin()).rejects.toThrow("Redirect:/admin/login");
});
it("rejects authenticated users removed from the allowlist", async () => {
  mocks.getSession.mockResolvedValue({ user: { email: "old@example.com" } });
  mocks.isAdminEmail.mockReturnValue(false);
  await expect(requireAdmin()).rejects.toThrow("Redirect:/admin/login");
});
it("accepts a server-verified allowlisted administrator", async () => {
  mocks.getSession.mockResolvedValue({ user: { email: "admin@example.com" } });
  await expect(requireAdmin()).resolves.toEqual({ email: "admin@example.com" });
});
