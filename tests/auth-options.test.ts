import { afterEach, it, expect, vi } from "vitest";
vi.mock("@/db", () => ({ getDb: () => ({}) }));
const mock = vi.hoisted(() => ({ betterAuth: vi.fn((options) => options) }));
vi.mock("better-auth", () => ({ betterAuth: mock.betterAuth }));
vi.mock("better-auth/adapters/drizzle", () => ({ drizzleAdapter: () => ({}) }));
import { createAuth, isAdminEmail } from "@/lib/auth";
afterEach(() => vi.unstubAllEnvs());
it("does not admit any administrator when the allowlist is empty", () => {
  vi.stubEnv("ADMIN_EMAILS", "");
  expect(isAdminEmail("someone@example.com")).toBe(false);
});
it("matches exact email addresses, case-insensitively", () => {
  vi.stubEnv("ADMIN_EMAILS", " admin@example.com,owner@example.com ");
  expect(isAdminEmail("ADMIN@example.com")).toBe(true);
  expect(isAdminEmail("other-admin@example.com")).toBe(false);
});
it("disables public registration, stores rate limits in the database, and disables cookie session caching", async () => {
  vi.stubEnv("DATABASE_URL", "postgresql://test");
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-only-not-for-real-use");
  vi.stubEnv("BETTER_AUTH_URL", "https://example.com");
  vi.stubEnv("ADMIN_EMAILS", "admin@example.com");
  createAuth();
  const options = mock.betterAuth.mock.calls[0][0];
  expect(options.emailAndPassword.disableSignUp).toBe(true);
  expect(options.rateLimit.storage).toBe("database");
  expect(options.session.cookieCache.enabled).toBe(false);
  await expect(
    options.databaseHooks.user.create.before({ email: "unknown@example.com" }),
  ).resolves.toBe(false);
});
