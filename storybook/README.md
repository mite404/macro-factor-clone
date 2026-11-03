# Storybook

Storybook renders the production `App` from `src/App.tsx`, not a copy of it. Every story uses the
same `DiaryScreen`, `FoodPanel`, and `src/ui.tsx` components that the iPhone build ships. Stories
seed data with the production `insertEntry` and `insertFood` functions, then drive the real flows
in play functions.

## Data isolation

`main.ts` aliases `expo-sqlite` to `sqlite.tsx` in Storybook only. That module runs the wa-sqlite
engine and WebAssembly binary that expo-sqlite ships for the web, on the main thread, with a fresh
in-memory database for each story. It ignores `databaseName`, so stories never open or change
`nutrition.db` or any browser storage. Each story starts empty and runs `migrate` as
the app does. The app, Metro, and the iOS export do not use this alias.

The stand-in implements only the `Db` surface in `src/storage/migrations.ts`, plus
`SQLiteProvider` and `useSQLiteContext`. If production code needs another expo-sqlite API, add it
there or the story fails with a missing method.

## Run and verify

- `npm run storybook` starts the dev server on port 6006. In an Amp orb, `amp orb services ensure`
  starts it as the declared `storybook` service.
- `npm run build-storybook` writes a static build to the ignored `storybook-static/` folder. It
  needs no cross-origin isolation headers, so any static file server can host it.
- `npm run test:storybook` opens every story at 390 × 844 px and fails unless its play function
  finishes without browser or console errors. Set `STORYBOOK_URL` to test another origin, such as a
  static build.

`verify.mjs` drives Chromium through the `agent-browser` CLI. The orb preinstalls it. A CI runner
needs Node ≥ 22.18, `npm ci`, `agent-browser` with its Chromium, and a server for Storybook, either
`npm run storybook` or `storybook-static/` behind a static server. If CI cannot install
`agent-browser`, `@storybook/addon-vitest` with Playwright can run the same play functions. That
adds dependencies and needs the owner's approval.

| Story | Flow it checks |
| --- | --- |
| `EmptyDiary` | Empty day and zero totals |
| `PopulatedDiary` | Seeded entries, a lower-bound protein total, incomplete-macro warning |
| `QuickAddValidationAndCorrection` | Required and invalid calories, save, correct, delete |
| `SavedFoodCreateAndLog` | Empty search, create from the search text, validation, 150 g portion |
| `SavedFoodEditKeepsHistory` | Edit food calories; the earlier diary snapshot stays 184.5 kcal |
| `MeasuredServingWithKeyboard` | Per-100 ml food, Space selects the serving radio, 2 bottles = 660 ml |

These are browser checks of React Native Web. They do not verify native iOS layout, keyboard,
VoiceOver, or expo-sqlite on the device. See `docs/ios-builds.md`.

## Design references for unbuilt features

The earlier reference reconstructions of MacroFactor screens were removed. They were a second UI
with fake controls. The useful parts now live in production: the input with a unit suffix
(`Field` in `src/ui.tsx`) and the macro tints next to their text labels in the diary totals.

These public sources remain design references for later tickets. They are links, not components.

| Feature | Ticket | Source |
| --- | --- | --- |
| Food logging, search, barcode results | 05 to 07 | [Food logging tutorial][logging], [2026 press kit][press] |
| Custom food photo capture | Later | [2026 annual report][report], [custom-food help][custom] |
| Recipes | 08 | [2026 annual report][report] |
| Targets compared with intake | 04 | [Nutrition product][product] |
| Weight trend | 10 | [2026 press kit][press], [Nutrition product][product] |
| Dashboard, timeline settings | Later | [2024 dashboard release][dashboard], [timeline help][timeline] |

Adaptive coaching, expenditure estimates, and program updates are out of scope for this app. The
plan sets manual targets only.

[press]: https://macrofactor.com/press-kit/
[product]: https://macrofactor.com/macrofactor/
[report]: https://macrofactor.com/annual-report-2026/
[dashboard]: https://macrofactor.com/dashboard-customization/
[logging]: https://help.macrofactorapp.com/en/articles/215-how-to-log-food-in-macrofactor
[custom]: https://help.macrofactorapp.com/en/articles/5-create-and-add-a-custom-food
[timeline]: https://help.macrofactorapp.com/en/articles/218-how-to-configure-your-food-timeline
