import { ContentImage } from "./content-image";
import {
  displayPrice,
  statusLabels,
  type InventoryRecord,
} from "@/lib/inventory";

// Informational only. No cart, no reservations — the point is to bring
// customers into the store.
export function InventorySection({
  items,
  hasMore = false,
}: {
  items: InventoryRecord[];
  hasMore?: boolean;
}) {
  const categories = [...new Set(items.map((item) => item.category || ""))];
  // Category headings only earn their place once there is more than one, and
  // item headings follow whichever level is actually above them.
  const grouped = categories.length > 1;
  return (
    <section id="inventory" className="section inventory">
      <div className="wrap">
        <div className="section-heading">
          <p className="eyebrow">In the store</p>
          <h2>Current inventory.</h2>
          <p>
            A look at what’s on the shelves right now. Stock changes often —
            call ahead or stop in to see anything here in person.
          </p>
        </div>
        {categories.map((category) => {
          const showHeading = grouped && !!category;
          const Title = showHeading ? "h4" : "h3";
          return (
            <div className="inventory-group" key={category || "uncategorised"}>
              {showHeading && <h3>{category}</h3>}
              <div className="inventory-grid">
                {items
                  .filter((item) => (item.category || "") === category)
                  .map((item) => (
                    <article
                      className={`inventory-card ${item.imageUrl ? "" : "no-image"}`}
                      key={item.id}
                    >
                      {item.imageUrl && (
                        <ContentImage src={item.imageUrl} alt={item.imageAlt} />
                      )}
                      <div className="inventory-body">
                        {item.manufacturer && (
                          <p className="eyebrow">{item.manufacturer}</p>
                        )}
                        <Title className="inventory-title">{item.name}</Title>
                        {item.caliber && (
                          <p className="inventory-spec">{item.caliber}</p>
                        )}
                        {item.description && (
                          <p className="prose">{item.description}</p>
                        )}
                        <p className="inventory-meta">
                          <span className="inventory-price">
                            {displayPrice(item.priceCents)}
                          </span>
                          {item.status !== "available" && (
                            <span className="badge">
                              {statusLabels[item.status]}
                            </span>
                          )}
                        </p>
                      </div>
                    </article>
                  ))}
              </div>
            </div>
          );
        })}
        <p className="inventory-note">
          {hasMore
            ? "This is part of what we have on hand — call or stop in for the full list. "
            : ""}
          Prices and availability can change without notice. Nothing is sold or
          reserved through this website.
        </p>
      </div>
    </section>
  );
}
