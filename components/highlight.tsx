import { ContentImage } from "./content-image";
import { kindLabels, type ContentRecord } from "@/lib/content";
export function Highlight({ record }: { record: ContentRecord }) {
  return (
    <section
      className={`highlight section ${record.kind} ${record.imageUrl ? "with-image" : "text-only"}`}
      id={record.kind}
      aria-labelledby={`${record.kind}-heading`}
    >
      <div className="highlight-copy">
        <p className="eyebrow">{kindLabels[record.kind]}</p>
        <h2 id={`${record.kind}-heading`}>{record.title}</h2>
        <p className="prose">{record.description}</p>
        <span className="section-number" aria-hidden="true">
          {record.kind === "weekly" ? "01" : "02"}
        </span>
      </div>
      {record.imageUrl && (
        <ContentImage src={record.imageUrl} alt={record.imageAlt} />
      )}
    </section>
  );
}
