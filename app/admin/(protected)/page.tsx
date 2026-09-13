import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
export default async function Dashboard() {
  await requireAdmin();
  return (
    <>
      <p className="eyebrow">Store administration</p>
      <h1>A little update goes a long way.</h1>
      <p className="admin-intro">
        Share what’s happening around the store. Changes appear on the website
        after you save and publish.
      </p>
      <div className="admin-cards">
        {[
          {
            href: "weekly",
            title: "Featured This Week",
            description:
              "A timely store update, community moment, or introduction.",
          },
          {
            href: "monthly",
            title: "Featured This Month",
            description:
              "A longer-running story or highlight from around the store.",
          },
          {
            href: "event",
            title: "Events",
            description:
              "Add upcoming dates. Past events leave the public calendar automatically.",
          },
          {
            href: "announcement",
            title: "Announcements",
            description:
              "Keep visitors informed about store news and schedule changes.",
          },
        ].map((card) => (
          <Link
            href={`/admin/content/${card.href}`}
            className="admin-card"
            key={card.href}
          >
            <h2>{card.title} ↗</h2>
            <p>{card.description}</p>
          </Link>
        ))}
      </div>
      <div className="admin-card">
        <h2>Location, hours & contact</h2>
        <p>Keep the essentials accurate so visitors can plan ahead.</p>
        <Link className="text-link" href="/admin/business">
          Edit business information →
        </Link>
      </div>
    </>
  );
}
