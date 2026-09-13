# AGENTS.md

# Bear Arms Armory

This repository contains the website and internal admin tooling for Bear Arms Armory.

The project is being developed by Warped Web Studio.

Codex should act as an implementation partner. Make technically sound decisions, preserve the intended design and architecture, and avoid expanding scope without a clear reason.

---

## Project Goal

Build a polished, fast, easy-to-maintain website for Bear Arms Armory.

The primary business goal is:

> Bring more customers into the physical store.

The public website should help visitors quickly understand what Bear Arms Armory offers, see featured firearms, optionally browse current inventory, discover upcoming events, and find the information needed to visit or contact the store.

This is not an ecommerce website.

Do not implement online firearm sales, checkout, firearm reservations, shipping workflows, FFL transfers through the website, or other ecommerce functionality unless explicitly requested.

---

# Public Website

The public website should be one continuous page.

Avoid splitting normal public content across unnecessary routes.

Anchor navigation is preferred where appropriate.

The expected page structure includes:

1. Hero
2. Gun of the Week
3. Gun of the Month
4. Current inventory, when enabled by the client
5. Upcoming events
6. Previous featured guns gallery
7. Store/about content
8. Store photography
9. Location, hours, phone, and contact information
10. Footer

The experience should feel cohesive rather than like unrelated sections stacked together.

---

# Design Direction

Bear Arms Armory should feel established, trustworthy, practical, and distinctive.

Do not default to generic gun-store design clichés.

Avoid making the website unnecessarily aggressive, militaristic, tactical, or visually cluttered.

The design should primarily be informed by:

- client-provided store photography
- the physical character of the business
- the Bear Arms Armory brand
- usability
- the goal of bringing customers into the store

Use strong typography, spacing, imagery, hierarchy, and restrained visual details.

The site should feel custom-built rather than like a generic template.

Mobile quality is equally important to desktop quality.

---

# Inventory

Inventory is optional.

The client should be able to decide through the admin dashboard whether inventory is displayed publicly.

If inventory is enabled and inventory records exist, the public website should display the inventory section.

If inventory is disabled, the inventory section should not appear on the public website.

Do not leave an empty inventory section, placeholder, navigation item, or awkward gap when inventory is disabled.

Turning inventory visibility off must preserve existing inventory data so it can be re-enabled later.

Inventory is informational only.

It is NOT an ecommerce catalog.

Inventory records should support appropriate fields such as:

- name/title
- manufacturer
- category
- caliber or relevant specification
- price when applicable
- description or notes when applicable
- availability/status
- optional image
- timestamps

Exact schema decisions should reflect the client's actual needs rather than blindly following this example.

## Inventory Images

Images are optional.

The client should be able to add an inventory item with or without an image.

The public UI must look intentional in both cases:

- inventory item with image
- inventory item without image

Do not display broken-image placeholders or make image-less inventory cards appear incomplete.

Do not require the client to photograph every inventory item.

## Inventory Visibility

The admin dashboard should provide a simple explicit control such as:

> Show inventory on website

The control should not delete records.

Disabling inventory visibility should only hide the inventory section from the public website.

Existing inventory records must remain intact.

---

# Gun of the Week / Gun of the Month

The website should support:

- Gun of the Week
- Gun of the Month

These should be manageable from the admin dashboard.

Featured records should support enough information to present them prominently on the public site.

Where appropriate, support:

- title
- description
- image
- feature type
- start date
- end date
- relevant firearm information
- timestamps

Do not hard-code current featured firearms into components.

---

# Previous Features Gallery

The client wants a gallery containing previous Guns of the Week and Guns of the Month.

This should derive from historical feature records rather than requiring the client to manually recreate archived entries.

When a Gun of the Week or Gun of the Month is no longer current, it should remain available for the previous-features gallery when appropriate.

Clearly distinguish current features from historical features.

The archive/gallery should remain visually useful as it grows.

---

# Events

Upcoming events must be manageable through the admin dashboard.

Events may include fields such as:

- title
- description
- date
- start time
- end time
- optional image
- location
- publication status

Exact fields should be based on actual requirements.

The public website should prioritize future/upcoming events.

Past events should not clutter the primary public experience.

Do not hard-code events into the page.

---

# Location and Map

The website should clearly provide the store's:

- address
- hours
- phone number
- relevant contact information

The map should NOT be permanently visible on the page.

Instead, provide a clear control such as:

- "Show Map"
- "View Location"
- "See on Map"

When the visitor activates the control, reveal an embedded map showing the Bear Arms Armory location.

The map should function as a toggle.

Expected behavior:

1. Map is hidden by default.
2. User clicks the map control.
3. Map becomes visible.
4. User can hide/collapse the map again.
5. The control text or state should clearly indicate whether the map is open or closed.

The interaction should work well on mobile and desktop.

Do not permanently reserve a large empty area for the hidden map.

Avoid loading unnecessary map resources before the visitor requests the map when practical.

The toggle must be keyboard accessible and should expose appropriate accessibility state such as `aria-expanded`.

The location section should still provide enough address/contact information to be useful even when the map is hidden.

---

# Admin Dashboard

The admin dashboard exists so the client can manage frequently changing business content without contacting the developer for every update.

Keep it narrow and purpose-built.

Expected areas include:

- Inventory
- Featured Guns
- Events
- Site settings relevant to editable content

Do not turn this into a general-purpose CMS.

The client should NOT have unrestricted control over:

- site layout
- typography
- design system
- SEO architecture
- components
- arbitrary page creation
- application configuration

Warped Web Studio controls the website itself.

The client controls business content that changes regularly.

---

# Admin UX

The client is not a developer.

Admin interfaces should therefore prioritize:

- obvious actions
- clear labels
- simple forms
- useful validation
- confirmation for destructive actions
- helpful empty states
- understandable error messages
- minimal technical terminology

Common actions should require as few steps as reasonably possible.

Do not expose database concepts or implementation details to the client.

---

# Authentication

Admin routes must require authentication.

Do not rely solely on client-side route protection.

Authorization must be enforced server-side for protected operations.

Do not expose secrets, credentials, session tokens, database credentials, or sensitive environment variables to the browser.

Use established security practices rather than inventing custom cryptography or authentication mechanisms.

---

# Client Assets

Client-provided assets are authoritative.

These may include:

- store photography
- logos
- business information
- event information
- firearm information

Store and perimeter photography should primarily establish the visual identity and atmosphere of the website.

Inventory photography is optional.

Do not make the design dependent on every inventory item having a photo.

---

# Existing Website

The existing Bear Arms Armory website may be inspected for:

- business information
- existing content
- contact information
- location
- hours
- useful factual context

Do NOT treat the existing site's design as the design specification.

Do not copy its layout merely because it already exists.

Authority order:

1. Explicit client requirements
2. Warped Web Studio direction
3. Client-provided current assets/data
4. Existing public website
5. Codex assumptions

When information conflicts, follow the highest-authority source.

---

# Database

Prefer a straightforward relational model.

Avoid unnecessary abstraction.

Schema design should support the real business workflow rather than hypothetical future SaaS requirements.

Use migrations for schema changes.

Do not manually mutate production database structure outside the migration workflow.

Preserve historical records where they are useful, particularly featured-gun history.

---

# SEO

The site should ship with a strong local-business SEO foundation.

Include appropriate:

- metadata
- canonical URLs
- Open Graph metadata
- sitemap
- robots configuration
- semantic HTML
- heading hierarchy
- structured data where appropriate
- descriptive image alt text
- local business information

SEO copy should remain natural.

Do not keyword-stuff.

Do not invent business claims, awards, services, inventory, certifications, or other facts for SEO purposes.

---

# Performance

Performance matters.

Prefer:

- optimized images
- appropriate image sizing
- minimal unnecessary JavaScript
- server rendering where appropriate
- efficient database queries
- reasonable caching
- lightweight components

Do not add large dependencies for functionality that can be implemented cleanly without them.

For the map toggle, avoid eagerly loading a heavy embedded map before the user requests it when practical.

---

# Accessibility

Maintain reasonable accessibility throughout development.

Use:

- semantic elements
- keyboard-accessible controls
- proper labels
- visible focus states
- sufficient contrast
- meaningful alt text
- accessible forms and validation
- appropriate ARIA state for expandable/collapsible UI

Do not sacrifice basic usability for visual effects.

---

# Responsive Design

Every public section and admin workflow must work at:

- mobile
- tablet
- desktop

Do not treat mobile as a final cleanup task.

Avoid horizontal overflow, unusable tables, tiny controls, broken navigation, or content that depends on hover.

The map toggle and revealed map must work cleanly on small screens.

---

# Content Rules

Never invent factual business information.

If required information is unknown, use clearly identifiable placeholder/sample content during development or flag the missing information.

Do not fabricate:

- inventory
- prices
- events
- hours
- addresses
- policies
- firearm specifications
- business history
- testimonials
- promotions

Sample development data must be clearly distinguishable from verified client data.

---

# Client Image Assets

Client-provided assets are stored under `public/client-assets/`.

Images under `store-inventory/` show miscellaneous merchandise and inventory around the physical store.

These images are general visual assets only.

They must NOT be interpreted as authoritative current inventory.

Do not create inventory database records, prices, availability claims, or product listings based on objects visible in these photographs.

Items visible in these photographs may no longer be available.

Use these images selectively where they improve the visual presentation of the store and its merchandise without implying current availability.

Actual public inventory is managed separately through the admin dashboard.

The client has provided both JPEG and PDF versions of the Bear Arms Armory logo.

Preserve both original files.

Inspect both logo sources and use the highest-quality suitable source for web presentation. If a web-optimized or vector derivative is needed, create it separately without modifying the client originals.

---

# Firearm-Related Functionality

This website represents a firearms retailer, but the current scope is informational and promotional.

Do not independently add functionality for:

- online firearm purchasing
- firearm shipping
- deposits/reservations on firearms
- automated eligibility determinations
- background checks
- transfer processing
- age/identity verification workflows
- ammunition ecommerce
- regulated transaction workflows

If functionality involving regulated transactions is requested later, stop and clarify requirements before implementation.

---

# Testing

Before considering implementation complete, run the repository's available:

- tests
- linting
- type checking
- production build

Add or update automated tests for meaningful business logic.

Prioritize testing around:

- authentication
- authorization
- inventory CRUD
- inventory visibility toggle
- optional inventory images
- feature activation/archive behavior
- event filtering
- map toggle behavior
- validation
- destructive actions
- API/route behavior

External services should be mocked in automated tests where appropriate.

---

# Manual QA

Do not spend excessive Codex time performing exhaustive manual visual QA.

The developer will personally perform final manual and visual QA.

Codex should focus on:

- implementation
- correctness
- automated testing
- linting
- type safety
- production build verification

Report areas that deserve manual verification rather than repeatedly interacting with the UI.

---

# Scope Discipline

Do not introduce unrelated features because they might be useful someday.

In particular, do not independently add:

- ecommerce
- payment processing
- customer accounts
- public user authentication
- loyalty programs
- CRM functionality
- email marketing systems
- analytics dashboards
- multi-tenant architecture
- generalized CMS functionality
- unnecessary microservices

Build for Bear Arms Armory, not for a hypothetical SaaS product.

---

# Git Rules

The human developer owns Git.

Codex may inspect:

- git status
- git diff
- git log when useful

Codex must NOT:

- commit
- push
- pull
- stage files
- create tags
- rewrite history
- force push
- change branches without explicit instruction
- modify remote configuration

Do not run:

git add
git commit
git push

unless explicitly instructed by the human developer.

---

# Working Style

Before making substantial architectural changes:

1. Inspect the existing implementation.
2. Understand the current patterns.
3. Prefer extending those patterns when they are sound.
4. Explain significant architectural changes before implementing them.
5. Avoid rewriting working systems without a concrete benefit.

For straightforward implementation tasks, proceed without unnecessary ceremony.

If requirements are genuinely ambiguous and the choice materially affects the client experience, flag the ambiguity rather than inventing a requirement.

---

# Definition of Done

A feature is not complete merely because code was generated.

A feature is complete when:

- the implementation matches the client requirement
- data persists correctly
- authorization is enforced where required
- error and empty states are handled
- mobile behavior is reasonable
- automated checks pass
- production build succeeds
- no unrelated functionality was broken
- remaining manual QA items are clearly reported

The human developer performs final acceptance and client-facing approval.

---

# Final Principle

Bear Arms Armory does not need complicated software.

It needs a website that looks excellent, makes the business easy to understand, gives customers reasons to visit, and lets the owners update the information that changes regularly.

Prefer simple, durable solutions over clever ones.