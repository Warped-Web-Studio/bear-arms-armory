import { it, expect, vi } from "vitest";
const mock = vi.hoisted(() => ({ configured: vi.fn(), handler: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  authConfigured: mock.configured,
  getAuth: () => ({ handler: mock.handler }),
}));
import { GET, POST } from "@/app/api/auth/[...all]/route";
it("returns a safe unavailable response without configuration", async () => {
  mock.configured.mockReturnValue(false);
  expect(
    (await GET(new Request("https://example.com/api/auth/get-session"))).status,
  ).toBe(503);
  expect(mock.handler).not.toHaveBeenCalled();
});
it("delegates configured auth requests to Better Auth", async () => {
  mock.configured.mockReturnValue(true);
  mock.handler.mockResolvedValue(new Response("denied", { status: 401 }));
  expect(
    (
      await POST(
        new Request("https://example.com/api/auth/sign-in/email", {
          method: "POST",
        }),
      )
    ).status,
  ).toBe(401);
});
it("never exposes internal authentication errors", async () => {
  mock.configured.mockReturnValue(true);
  mock.handler.mockRejectedValue(new Error("secret database password"));
  const response = await GET(
    new Request("https://example.com/api/auth/get-session"),
  );
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("secret");
});
