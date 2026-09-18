# Public gallery archive

## Access and browsing

`/gallery` is reachable from the homepage Gallery navigation link, gallery
heading, and Browse the archive button. The route reuses the site's navigation,
branding, typography, responsive grid and proportional, unframed ContentImage.
The main-site return link is always available. Homepage featured sections and
the Our Store carousel are unchanged.

The monthly archive is grouped by each record's saved start month, newest first,
with 12 entries per page. Multiple records in the same month share a heading;
a large month may continue on the next page.

The weekly archive initially requests only records starting in the current
calendar month in America/New_York. View More opens the next older month with
actual historical records; empty months are skipped. It replaces the selected
month rather than appending an unbounded list. Back to current month resets this
selection. Each month is capped at 12 entries per page with separate pagination
if needed. URLs preserve the other category's position. The controls work without
JavaScript and browser Back restores the previous URL/view.

## Dates and historical eligibility

Both categories group by `startsOn`, not upload time or guessed week boundaries.
Weekly date ranges display the actual inclusive `startsOn` and `endsOn` values;
the admin can select any range, so the archive never assumes Monday–Sunday or
seven days. Cross-month weeks belong to their starting month, and the full range
remains visible. Cross-year ranges include both years. Date-only display uses
UTC to avoid a timezone shift; choosing the current month uses store time.

The database already requires both dates and enforces start <= end. Invalid
legacy values passed to formatting helpers are labeled Dates unavailable instead
of being assigned fabricated dates.

Only published, already-started weekly/monthly records are eligible. The current
weekly and monthly winners are excluded using the same ordering as the homepage:
start date descending, then creation date descending, then ID descending. Ended
and superseded records remain in the archive. Draft and scheduled future records
stay private. Query limits prevent loading the entire archive or all past weeks.

## Admin workflow and preservation

There is no separate archive editor or duplicate archive table. Add highlight
creates a new record, retaining previous highlights automatically. Edit corrects
the same entry; it is not a revision-history or snapshot system. For a new week's
or month's content, use Add highlight instead of rewriting a previous record.
An admin hint explains this distinction. Existing confirmation-based deletion
and publication controls remain unchanged: deleting or unpublishing an entry
removes it from public history. Records already deleted or overwritten before
this change cannot be reconstructed from the current database.

Saves and deletes now invalidate `/gallery` as well as the homepage/admin. No
migration, production data write, new environment variable or dependency is
required by this feature.

## Deployment and acceptance

1. Run `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build`.
   In restricted environments where Turbopack's internal port is blocked,
   `npm run build -- --webpack` verifies the production build.
2. Deploy normally on Vercel. No database migration command is needed.
3. Keep existing SITE_URL and SITE_INDEXABLE settings. The archive has its own
   canonical `/gallery`, metadata and sitemap entry; it inherits the site's
   existing production/preview indexing policy.
4. Check homepage entry points, return navigation, current-month weekly empty
   state, View More through older months, and monthly/weekly pagination.
5. Visually check 375, 430, 768, 1024 and 1440px, especially long ranges,
   portrait/landscape photos, no-photo entries and tablet navigation.
6. Add a new highlight using the normal admin flow and verify its predecessor
   becomes historical. Use approved development records for this check.

Automated tests cover date/month/year boundaries, date grouping, Eastern month
selection, bounded query predicates, current/draft/future exclusion rules,
route/empty-state rendering, clickable entry points and cache invalidation.
Database calls are mocked; production records are not mutated by the tests.
Final visual and live-service acceptance remains a manual developer check.
