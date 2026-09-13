import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { account, session, user } from "../db/schema";
import { isAdminEmail } from "../lib/auth";
async function main() {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (
    !email ||
    !isAdminEmail(email) ||
    !password ||
    password.length < 14 ||
    password.length > 128
  )
    throw new Error();
  const db = getDb();
  const [admin] = await db
    .select()
    .from(user)
    .where(eq(user.email, email))
    .limit(1);
  if (!admin) throw new Error();
  const [credentials] = await db
    .select()
    .from(account)
    .where(
      and(eq(account.userId, admin.id), eq(account.providerId, "credential")),
    )
    .limit(1);
  if (!credentials) throw new Error();
  await db.batch([
    db
      .update(account)
      .set({ password: await hashPassword(password), updatedAt: new Date() })
      .where(eq(account.id, credentials.id)),
    db.delete(session).where(eq(session.userId, admin.id)),
  ]);
  console.log(
    "Password reset and existing sessions revoked. Remove the bootstrap password from your environment.",
  );
}
main().catch(() => {
  console.error(
    "Password reset failed. Verify the environment and the existing allowlisted account.",
  );
  process.exitCode = 1;
});
