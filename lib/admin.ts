import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authConfigured, getAuth, isAdminEmail } from "./auth";
export async function requireAdmin() {
  if (!authConfigured()) redirect("/admin/login");
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session || !isAdminEmail(session.user.email)) redirect("/admin/login");
  return session.user;
}
