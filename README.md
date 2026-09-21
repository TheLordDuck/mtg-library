# MTG Collection Manager

A self-hosted web app for managing a Magic: The Gathering card collection exported from [ManaBox](https://manabox.app/). Import your `collection.csv`, browse and edit it in a searchable table, filter it against a decklist to see what you're missing, and keep automatic daily backups — all backed by a single CSV file on disk, no database required.

## Features

- **Dashboard** — collection file stats (size, card/column counts, last modified), CSV import/export, and a backup manager with manual "backup now" and one-click restore.
- **Collection editor** — searchable, sortable table (desktop) / card list (mobile) of every card, with inline edit and delete, bulk delete, and hover/tap previews of card art and set icons (via the [Scryfall API](https://scryfall.com/docs/api)).
- **Add cards** — search Scryfall by name, pick a specific printing, and add it with quantity, foil, condition, and language.
- **Deck check** — upload a decklist (`.txt`/`.dec`/`.dek`, plain `4 Card Name` or `4x Card Name` per line) to filter the collection down to what you own from that deck and see quantities owned per card.
- **Automatic backups** — a daily cron job snapshots `collection.csv` to `data/backups/`, keeping the last 7 days; snapshots can also be triggered and restored from the dashboard.

## Tech stack

- [Next.js](https://nextjs.org) (App Router) + React 19 + TypeScript
- Tailwind CSS
- `node-cron` for scheduled backups
- Collection data is stored as a flat CSV file on the filesystem — there is no database

## Getting started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). If no collection file exists yet, you'll be prompted to import a ManaBox `collection.csv` export to get started.

## Data storage

All runtime data (the collection CSV and its backups) lives under a single directory, controlled by the `DATA_DIR` environment variable:

- `DATA_DIR/collection.csv` — the active collection
- `DATA_DIR/backups/collection-YYYY-MM-DD.csv` — daily backups (last 7 kept)

Locally this defaults to `./data` in the repo. **In production, `DATA_DIR` must point at a mounted persistent volume** (e.g. `/data`), otherwise the collection is lost on every redeploy/restart. See `lib/paths.ts` for details.

## Deployment (Coolify)

This app is designed to run on [Coolify](https://coolify.io/):

1. Set the `DATA_DIR` environment variable (e.g. `/data`).
2. Add a persistent storage volume mounted at that same path.
3. Deploy — the app builds and runs with `pnpm build` / `pnpm start`.

## Scripts

| Command      | Description                          |
| ------------ | ------------------------------------ |
| `pnpm dev`   | Start the dev server                 |
| `pnpm build` | Build for production                 |
| `pnpm start` | Run the production build             |
| `pnpm lint`  | Run ESLint                           |
