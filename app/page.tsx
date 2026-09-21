import Image from "next/image";
import { Fragment } from "react";
import { getBusiness, getPublicContent, getPublicInventory } from "@/lib/data";
import {
  defaultBusiness,
  getAccessoriesPhotos,
  getStorePhotos,
  siteOrigin,
  facebookUrl,
} from "@/lib/business";
import { displayDate, displayTime } from "@/lib/content";
import { Navigation } from "@/components/navigation";
import { MapToggle } from "@/components/map-toggle";
import { Highlight } from "@/components/highlight";
import { StoreCarousel } from "@/components/store-carousel";
import { ContentImage } from "@/components/content-image";
import { InventorySection } from "@/components/inventory-section";
export const dynamic = "force-dynamic";
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ gallery?: string }>;
}) {
  const query = await searchParams;
  const page = /^[1-9]\d{0,3}$/.test(query.gallery || "")
    ? Number(query.gallery)
    : 1;
  const [business, data] = await Promise.all([
    getBusiness().catch(() => defaultBusiness),
    getPublicContent(page),
  ]);
  // Inventory is only read when the client has switched it on, and the
  // section disappears entirely when there is nothing published.
  const publicInventory = await getPublicInventory(business.showInventory);
  const email = business.email || defaultBusiness.email;
  const accessoriesPhotos = getAccessoriesPhotos(business);
  const showAccessories = !!(
    accessoriesPhotos.length || business.accessoriesDescription
  );
  const storePhotos = getStorePhotos(business);
  const address = `${business.address}, ${business.city}, ${business.region} ${business.postalCode}`;
  const phone = business.phone.replace(/[^+\d]/g, "");
  const links = [
    ...(data.weekly ? [{ href: "#weekly", label: "This week" }] : []),
    ...(data.monthly ? [{ href: "#monthly", label: "This month" }] : []),
    ...(publicInventory.items.length
      ? [{ href: "#inventory", label: "Inventory" }]
      : []),
    ...(data.events.length ? [{ href: "#events", label: "Events" }] : []),
    { href: "#about", label: "Our store" },
    { href: "/gallery", label: "Gallery" },
    ...(showAccessories
      ? [{ href: "#knives-lights-optics", label: "Knives & optics" }]
      : []),
    { href: "#visit", label: "Location & hours" },
  ];
  const structured = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: business.name,
    url: siteOrigin,
    telephone: business.phone,
    address: {
      "@type": "PostalAddress",
      streetAddress: business.address,
      addressLocality: business.city,
      addressRegion: business.region,
      postalCode: business.postalCode,
      addressCountry: "US",
    },
    email,
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structured).replace(/</g, "\\u003c"),
        }}
      />
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <a className="brand" href="#" aria-label="Bear Arms Armory home">
          <Image
            src="/derived/bear-arms-logo.webp"
            alt=""
            width={64}
            height={65}
            priority
          />
          <span>
            BEAR ARMS<span>ARMORY</span>
          </span>
        </a>
        <Navigation links={links} />
      </header>
      <main id="main">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">{business.city}, Pennsylvania</p>
            <h1>
              A local store.
              <br />
              <em>A familiar place.</em>
            </h1>
            <p>
              Welcome to Bear Arms Armory. Find store updates, community news,
              and the details for your next visit.
            </p>
            <a className="button button-brass" href="#visit">
              Location & hours
            </a>
          </div>
          <div className="hero-mark">
            <Image
              src="/derived/bear-arms-logo.webp"
              alt="Bear Arms Armory bear emblem"
              width={540}
              height={550}
              priority
              sizes="(max-width: 720px) 70vw, 40vw"
            />
          </div>
          <div className="hero-bottom">
            <span>BEAR ARMS ARMORY</span>
            <span>
              {business.address} · {business.city}, {business.region}
            </span>
            <a href={`tel:${phone}`}>{business.phone}</a>
          </div>
        </section>
        {data.announcements.length > 0 && (
          <section
            className="announcements wrap"
            aria-label="Store announcements"
          >
            {data.announcements.map((a) => (
              <article key={a.id}>
                <p className="eyebrow">Store note</p>
                <div>
                  <h2>{a.title}</h2>
                  <p className="prose">{a.description}</p>
                </div>
                {a.imageUrl && (
                  <ContentImage src={a.imageUrl} alt={a.imageAlt} />
                )}
              </article>
            ))}
          </section>
        )}
        {data.weekly && <Highlight record={data.weekly} />}
        {data.monthly && <Highlight record={data.monthly} />}
        {publicInventory.items.length > 0 && (
          <InventorySection
            items={publicInventory.items}
            hasMore={publicInventory.hasMore}
          />
        )}
        {data.events.length > 0 && (
          <section id="events" className="section events wrap">
            <div className="section-heading">
              <p className="eyebrow">On the calendar</p>
              <h2>Coming together.</h2>
              <p>
                Upcoming events at the store and in our community. All times
                Eastern.
              </p>
            </div>
            <div className="event-list">
              {data.events.map((event) => (
                <article key={event.id} className="event">
                  <div className="date-tile">
                    <span>
                      {new Date(
                        event.startsOn + "T12:00:00Z",
                      ).toLocaleDateString("en-US", {
                        month: "short",
                        timeZone: "UTC",
                      })}
                    </span>
                    <strong>{event.startsOn.slice(-2)}</strong>
                  </div>
                  <div>
                    <p className="eyebrow">
                      {displayDate(event.startsOn)}
                      {event.endsOn !== event.startsOn
                        ? ` – ${displayDate(event.endsOn)}`
                        : ""}
                    </p>
                    <h3>{event.title}</h3>
                    <p>
                      {displayTime(event.startTime)} –{" "}
                      {displayTime(event.endTime)} · {event.location || address}
                    </p>
                    <p className="prose">{event.description}</p>
                  </div>
                  {event.imageUrl && (
                    <ContentImage src={event.imageUrl} alt={event.imageAlt} />
                  )}
                </article>
              ))}
            </div>
          </section>
        )}
        {(data.archive.length > 0 || page > 1) && (
          <section id="gallery" className="section gallery">
            <div className="wrap">
              <div className="section-heading">
                <p className="eyebrow">From around the store</p>
                <h2>
                  <a className="text-link" href="/gallery">
                    Store Highlights Gallery
                  </a>
                </h2>
                <p>
                  A look back at the people, moments, and updates we’ve shared.
                </p>
                <a className="button" href="/gallery">
                  Browse the archive →
                </a>
              </div>
              <div className="gallery-grid">
                {data.archive.map((item) => (
                  <article
                    key={item.id}
                    className={`gallery-card ${item.imageUrl ? "" : "no-image"}`}
                  >
                    {item.imageUrl && (
                      <ContentImage src={item.imageUrl} alt={item.imageAlt} />
                    )}
                    <div>
                      <p className="eyebrow">
                        Previous highlight · {displayDate(item.startsOn)}
                      </p>
                      <h3>{item.title}</h3>
                      <p className="prose">{item.description}</p>
                    </div>
                  </article>
                ))}
              </div>
              {!data.archive.length && <p>No highlights on this page.</p>}
              <nav className="pagination" aria-label="Highlights gallery pages">
                {page > 1 && (
                  <a className="button" href={`?gallery=${page - 1}#gallery`}>
                    Newer highlights
                  </a>
                )}
                {data.hasMore && (
                  <a className="button" href={`?gallery=${page + 1}#gallery`}>
                    Older highlights
                  </a>
                )}
              </nav>
            </div>
          </section>
        )}
        {showAccessories && (
          <section
            id="knives-lights-optics"
            className={`section wrap accessories-section ${accessoriesPhotos.length && business.accessoriesDescription ? "two-column" : "one-column"}`}
          >
            <div className="section-heading">
              <p className="eyebrow">Also in the store</p>
              <h2>Knives, Lights and Optics</h2>
            </div>
            <div className="about-content">
              {accessoriesPhotos.length > 0 && (
                <StoreCarousel
                  photos={accessoriesPhotos}
                  label="Knives, lights and optics photographs"
                  itemName="photograph"
                />
              )}
              {business.accessoriesDescription && (
                <div>
                  <p className="prose large-copy">
                    {business.accessoriesDescription}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}
        <section
          id="about"
          className={`about section wrap ${storePhotos.length ? "with-store-photos" : "without-store-photos"}`}
        >
          <header className="about-heading">
            <p className="eyebrow">Rooted in Corry</p>
            <h2>
              Our store.
              <br />
              Our community.
            </h2>
          </header>
          <div className="about-content">
            {storePhotos.length > 0 && <StoreCarousel photos={storePhotos} />}
            <div>
              <p className="prose large-copy">
                {business.about.split("\n").map((line, index) => {
                  const label = line.match(/^([ \t]*)(Purchase Information:)/);
                  return (
                    <Fragment key={index}>
                      {index > 0 && "\n"}
                      {label ? (
                        <>
                          {label[1]}
                          <strong>{label[2]}</strong>
                          {line.slice(label[0].length)}
                        </>
                      ) : (
                        line
                      )}
                    </Fragment>
                  );
                })}
              </p>
              <p>
                Find us on East Columbus Avenue. For store hours or general
                questions, give us a call.
              </p>
              <a className="text-link" href={`tel:${phone}`}>
                {business.phone}
              </a>
            </div>
          </div>
        </section>
        <section id="visit" className="visit section">
          <div className="wrap">
            <div className="section-heading">
              <p className="eyebrow">Location & contact</p>
              <h2>Find us in Corry.</h2>
            </div>
            <div className="contact-grid">
              <div>
                <h3>Visit the store</h3>
                <address>
                  {business.name}
                  <br />
                  {business.address}
                  <br />
                  {business.city}, {business.region} {business.postalCode}
                </address>
                <a
                  className="text-link"
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Get directions
                </a>
              </div>
              <div>
                <h3>Store hours</h3>
                <p className="prose">{business.hours}</p>
              </div>
              <div>
                <h3>Get in touch</h3>
                <a className="contact-phone" href={`tel:${phone}`}>
                  {business.phone}
                </a>
                {email && (
                  <p>
                    <a className="text-link" href={`mailto:${email}`}>
                      Email Us
                    </a>
                  </p>
                )}
                <p>
                  <a
                    className="text-link facebook-link"
                    href={facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047v-2.66c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.971h-1.513c-1.491 0-1.956.931-1.956 1.887v2.264h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
                    </svg>
                    <span>Follow Us on Facebook</span>
                  </a>
                </p>
                <p>Call with questions before your visit.</p>
              </div>
            </div>
            <MapToggle address={address} />
            {data.unavailable && (
              <p className="service-note" role="status">
                Store updates are temporarily unavailable. Please call for the
                latest information.
              </p>
            )}
          </div>
        </section>
      </main>
      <footer className="site-footer wrap">
        <span>BEAR ARMS ARMORY</span>
        <p>© {new Date().getFullYear()} Bear Arms Armory</p>
        <span>Website by Warped Web Studio</span>
      </footer>
    </>
  );
}
