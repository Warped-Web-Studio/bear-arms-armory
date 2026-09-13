import Link from "next/link";
export default function NotFound() {
  return (
    <main className="wrap section">
      <p className="eyebrow">Page not found</p>
      <h1>Let’s head back.</h1>
      <Link className="button" href="/">
        Return to the store website
      </Link>
    </main>
  );
}
