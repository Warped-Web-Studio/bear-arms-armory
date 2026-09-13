# Bear Arms Armory

A Next.js one-page business-information website and a small, protected administration dashboard for neutral store highlights, events, announcements, and business details. Built for Warped Web Studio.

## Development

```sh
npm ci
npm run dev
```

The public business page works without service credentials. Admin access and persistent content require Neon PostgreSQL and Better Auth configuration. See [client review and setup](docs/CLIENT-REVIEW.md) for environment variables, migrations, account provisioning, image handling, content behavior, verified sources, and manual QA.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

## Database and accounts

Copy `.env.example` to `.env.local` and configure it privately. After reviewing the generated migration:

```sh
npm run db:migrate
npm run admin:create
```

`npm run admin:reset-password` provides developer-assisted recovery and revokes existing sessions. Remove temporary bootstrap passwords from the environment after account maintenance. Do not run migrations or account maintenance against production until the human developer has reviewed the target and configuration.

No public registration, ecommerce, product inventory, or weapon-specific promotional functionality is included.
