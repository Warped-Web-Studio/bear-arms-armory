import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { LogoutButton } from "@/components/admin/auth-forms";
export const dynamic = "force-dynamic";
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return (
    <div className="admin-root">
      <a className="skip-link" href="#admin-main">
        Skip to content
      </a>
      <header className="admin-header">
        <strong>
          Bear Arms Armory <span className="badge">Admin</span>
        </strong>
        <Link href="/">View website</Link>
      </header>
      <div className="admin-shell">
        <nav className="admin-nav" aria-label="Administration">
          <Link href="/admin">Overview</Link>
          <p className="eyebrow">Store content</p>
          <Link href="/admin/content/weekly">Featured This Week</Link>
          <Link href="/admin/content/monthly">Featured This Month</Link>
          <Link href="/admin/content/event">Events</Link>
          <Link href="/admin/content/announcement">Announcements</Link>
          <Link href="/admin/business">Business information</Link>
          <LogoutButton />
        </nav>
        <main id="admin-main" className="admin-main">
          {children}
        </main>
      </div>
    </div>
  );
}
