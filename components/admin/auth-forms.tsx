"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createAuthClient } from "better-auth/react";
const authClient = createAuthClient();
export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        const form = new FormData(event.currentTarget);
        try {
          const result = await authClient.signIn.email({
            email: String(form.get("email")),
            password: String(form.get("password")),
            rememberMe: false,
          });
          if (result.error)
            setError(
              result.error.status === 429
                ? "Too many attempts. Please wait a minute and try again."
                : "We couldn’t sign you in. Check your email and password, or contact your website administrator.",
            );
          else {
            router.replace("/admin");
            router.refresh();
          }
        } catch {
          setError("Sign-in is temporarily unavailable. Please try again.");
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="field">
        <label htmlFor="email">Email address</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          maxLength={254}
        />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={128}
        />
      </div>
      {error && (
        <p className="feedback error" role="alert">
          {error}
        </p>
      )}
      <button className="button button-dark" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className="help" style={{ marginTop: "1rem" }}>
        Need access or a password reset? Contact Warped Web Studio.
      </p>
    </form>
  );
}
export function LogoutButton() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <div className="admin-logout">
      <button
        className="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          try {
            const result = await authClient.signOut();
            if (result.error) throw new Error();
            router.replace("/admin/login");
            router.refresh();
          } catch {
            setError("Couldn’t sign out. Try again.");
            setPending(false);
          }
        }}
      >
        {pending ? "Signing out…" : "Sign out"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
