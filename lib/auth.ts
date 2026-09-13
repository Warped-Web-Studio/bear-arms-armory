import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb } from "../db";
import * as schema from "../db/schema";

export function authConfigured() {
  return !!(
    process.env.DATABASE_URL &&
    process.env.BETTER_AUTH_SECRET &&
    process.env.BETTER_AUTH_URL &&
    process.env.ADMIN_EMAILS
  );
}
export function isAdminEmail(email: string) {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}
// Provisioning is only called by the local maintenance script; HTTP registration stays disabled.
export function createAuth(provisioning = false) {
  if (!authConfigured()) throw new Error("Admin sign-in is not configured.");
  return betterAuth({
    appName: "Bear Arms Armory",
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema,
      transaction: false,
    }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: !provisioning,
      minPasswordLength: 14,
      maxPasswordLength: 128,
    },
    session: {
      expiresIn: 60 * 60 * 8,
      updateAge: 60 * 60,
      cookieCache: { enabled: false },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 60,
      customRules: { "/sign-in/email": { window: 60, max: 5 } },
    },
    user: { changeEmail: { enabled: false }, deleteUser: { enabled: false } },
    databaseHooks: {
      user: {
        create: {
          before: async (user) =>
            isAdminEmail(user.email) ? { data: user } : false,
        },
      },
      session: {
        create: {
          before: async (session) => {
            const dbUser = await getDb().query.user.findFirst({
              where: (users, { eq }) => eq(users.id, session.userId),
            });
            return dbUser && isAdminEmail(dbUser.email)
              ? { data: session }
              : false;
          },
        },
      },
    },
  });
}
let cached: ReturnType<typeof createAuth> | undefined;
export function getAuth() {
  return (cached ??= createAuth());
}
