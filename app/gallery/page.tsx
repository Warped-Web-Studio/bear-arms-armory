import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { Navigation } from "@/components/navigation";
import { ContentImage } from "@/components/content-image";
import { getArchive } from "@/lib/archive-data";
import {
  archiveHref,
  displayArchiveMonth,
  displayArchiveRange,
  groupArchive,
  type ArchiveQuery,
} from "@/lib/archive";
import type { ContentRecord } from "@/lib/content";
export const dynamic = "force-dynamic";
const title = "Gallery & Featured Archive | Bear Arms Armory";
const description =
  "Browse past Featured This Week and Featured This Month highlights from Bear Arms Armory.";
export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/gallery" },
  openGraph: {
    title,
    description,
    url: "/gallery",
    type: "website",
    siteName: "Bear Arms Armory",
    locale: "en_US",
    images: [
      {
        url: "/derived/bear-arms-logo.webp",
        width: 900,
        height: 916,
        alt: "Bear Arms Armory",
      },
    ],
  },
  twitter: {
    card: "summary",
    title,
    description,
    images: ["/derived/bear-arms-logo.webp"],
  },
};
function ArchiveGroups({ records }: { records: ContentRecord[] }) {
  return groupArchive(records).map((group) => (
    <section className="archive-month" key={group.month}>
      <h3>{group.label}</h3>
      <div className="gallery-grid">
        {group.entries.map((entry) => (
          <article
            className={`gallery-card ${entry.imageUrl ? "" : "no-image"}`}
            key={entry.id}
          >
            {entry.imageUrl && (
              <ContentImage src={entry.imageUrl} alt={entry.imageAlt} />
            )}
            <div>
              <p className="eyebrow">
                {displayArchiveRange(entry.startsOn, entry.endsOn)}
              </p>
              <h4>{entry.title}</h4>
              <p className="prose">{entry.description}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  ));
}
export default async function Gallery({
  searchParams,
}: {
  searchParams: Promise<ArchiveQuery>;
}) {
  const data = await getArchive(await searchParams);
  const href = (
    changes: Partial<typeof data>,
    anchor: "weekly-archive" | "monthly-archive",
  ) => archiveHref({ ...data, ...changes }, anchor);
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header archive-header">
        <Link className="brand" href="/" aria-label="Bear Arms Armory home">
          <Image
            src="/derived/bear-arms-logo.webp"
            alt=""
            width={64}
            height={65}
          />
          <span>
            BEAR ARMS<span>ARMORY</span>
          </span>
        </Link>
        <Navigation
          links={[
            { href: "/", label: "Main site" },
            { href: "#monthly-archive", label: "Featured This Month" },
            { href: "#weekly-archive", label: "Featured This Week" },
            { href: "/#visit", label: "Location & hours" },
          ]}
        />
      </header>
      <main id="main" className="archive-page section wrap">
        <div className="section-heading">
          <p className="eyebrow">From around the store</p>
          <h1>Gallery & history.</h1>
          <p>Past highlights, organized by their original dates.</p>
          <Link className="text-link" href="/#gallery">
            ← Back to the main site
          </Link>
        </div>
        {data.unavailable ? (
          <p role="status">
            The archive is temporarily unavailable. Please try again later.
          </p>
        ) : (
          <>
            <section
              id="monthly-archive"
              className="archive-category"
              aria-labelledby="monthly-archive-heading"
            >
              <h2 id="monthly-archive-heading">Featured This Month</h2>
              <ArchiveGroups records={data.monthly} />
              {!data.monthly.length && (
                <p>No monthly highlights in this part of the archive yet.</p>
              )}
              <nav className="pagination" aria-label="Monthly archive pages">
                {data.monthlyPage > 1 && (
                  <Link
                    className="button"
                    href={href(
                      { monthlyPage: data.monthlyPage - 1 },
                      "monthly-archive",
                    )}
                  >
                    Newer monthly highlights
                  </Link>
                )}
                {data.moreMonthly && (
                  <Link
                    className="button"
                    href={href(
                      { monthlyPage: data.monthlyPage + 1 },
                      "monthly-archive",
                    )}
                  >
                    Older monthly highlights
                  </Link>
                )}
              </nav>
            </section>
            <section
              id="weekly-archive"
              className="archive-category"
              aria-labelledby="weekly-archive-heading"
            >
              <h2 id="weekly-archive-heading">Featured This Week</h2>
              <p>Grouped by the month each highlight began.</p>
              <ArchiveGroups records={data.weekly} />
              {!data.weekly.length && (
                <p>
                  No archived weekly highlights for{" "}
                  {displayArchiveMonth(data.month)}.
                </p>
              )}
              <nav className="pagination" aria-label="Weekly archive pages">
                {data.weeklyPage > 1 && (
                  <Link
                    className="button"
                    href={href(
                      { weeklyPage: data.weeklyPage - 1 },
                      "weekly-archive",
                    )}
                  >
                    Newer entries this month
                  </Link>
                )}
                {data.moreWeekly && (
                  <Link
                    className="button"
                    href={href(
                      { weeklyPage: data.weeklyPage + 1 },
                      "weekly-archive",
                    )}
                  >
                    More entries this month
                  </Link>
                )}
                {data.olderMonth && (
                  <Link
                    className="button"
                    href={href(
                      { month: data.olderMonth, weeklyPage: 1 },
                      "weekly-archive",
                    )}
                  >
                    View More
                    <span className="sr-only">
                      {" "}
                      — {displayArchiveMonth(data.olderMonth)}
                    </span>
                  </Link>
                )}
                {(data.month !== data.currentMonth || data.weeklyPage > 1) && (
                  <Link
                    className="text-link"
                    href={href(
                      { month: data.currentMonth, weeklyPage: 1 },
                      "weekly-archive",
                    )}
                  >
                    Back to current month
                  </Link>
                )}
              </nav>
            </section>
          </>
        )}
      </main>
      <footer className="site-footer wrap">
        <span>BEAR ARMS ARMORY</span>
        <p>© {new Date().getFullYear()} Bear Arms Armory</p>
        <span>Website by Warped Web Studio</span>
      </footer>
    </>
  );
}
