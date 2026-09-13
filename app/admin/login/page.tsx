import Link from "next/link";
import { LoginForm } from "@/components/admin/auth-forms";
import { authConfigured } from "@/lib/auth";
export const dynamic = "force-dynamic";
export default function Login() {
  return (
    <main className="login-page">
      <div className="login-card">
        <p className="eyebrow">Bear Arms Armory</p>
        <h1>Welcome back.</h1>
        <p>Sign in to manage your store updates.</p>
        {authConfigured() ? (
          <LoginForm />
        ) : (
          <p className="feedback" role="status">
            Admin sign-in is not available yet. Contact Warped Web Studio to
            finish setup.
          </p>
        )}
        <Link className="text-link" href="/">
          ← Back to the website
        </Link>
      </div>
    </main>
  );
}
