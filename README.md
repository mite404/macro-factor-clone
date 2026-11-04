# Nutrition diary

A personal iOS nutrition tracker for learning React Native and mobile-first design. Inspired by
MacroFactor Nutrition; not affiliated with MacroFactor. The current app is a scaffold.

## Run

Use a current supported Node.js LTS release and npm. Install dependencies with `npm ci`. Run
`npm start` for Metro, or `npm run ios` to open Expo in an available iOS Simulator on a Mac. See
[iOS builds](docs/ios-builds.md) for standalone builds and free personal iPhone installation.

`npm run lint` runs Oxlint. `npm run typecheck` checks types with the native TypeScript 7
compiler. GitHub Actions runs both, plus tests, the nutrition history check, the iOS export, and
the Storybook browser flows, on every pull request ([CI](docs/tickets/13-ci-native-typescript.md)).
`npm run export:ios` checks the production iOS JavaScript bundle; it does not compile or sign a
native app. `npx expo-doctor` checks Expo
compatibility against network-fetched versions and is not a CI gate.
`npm test` runs behavioral tests with Node's built-in test runner and SQLite (Node 22.18 or later).
`npm run web` previews layout in a browser; it does not prove native SQLite or keyboard behavior.

## Project map

- `index.ts`: Expo registration.
- `src/App.tsx`: app composition: safe area, SQLite provider, diary screen.
- `src/storage/migrations.ts`: numbered, transactional SQLite schema migrations.
- `src/features/diary/`: quick-add diary logic, tests, and screen.
- `metro.config.js`: lets expo-sqlite run in the web preview (wasm, COOP/COEP headers).
- `assets/`: official template placeholders, not final product branding.
- [Implementation plan](docs/implementation-plan.md): ten post-scaffold PR-sized units.
- [Implementation record](docs/implementation-record.md): delivery and verification source of truth.
- [Tickets](docs/tickets/): each unit's scope, checks, and mobile learning notes.
- [Research](docs/nutrition-app-research.md): sources, alternatives, and constraints.
- [Architecture decisions](docs/adr/adr.md): why mobile development differs from web development.

Add feature folders when they contain working code. No backend, account, or subscription service.
