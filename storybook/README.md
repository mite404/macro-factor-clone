# Storybook

The MacroFactor reference screens are the app's UI. Their component kit moved from
`storybook/ui.tsx` to `src/ui.tsx`. `FoodLog`, `FoodSearch`, `QuickAdd`, `FoodDetail`, and
`CreateFood` moved to `src/features/diary/LoggingScreens.tsx`, where fixtures became props and
disabled buttons became callbacks. `src/features/diary/Diary.tsx` wires them to SQLite. The
`App` stories render that production app.

The other 11 references are under **Design references**. They show features that are not built
yet, with fixture data only, and import the same `src/ui.tsx` kit. Inside the `DeviceFrame`
context, `Phone` draws the phone outline and simulated status bar. The live app draws neither.

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
- `npm run test:storybook` opens all 20 stories at 390 × 844 px and fails unless its play function
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
| `BackupExport` | The downloaded backup equals the restored version 1 fixture, archived food included |
| `BackupRestoreConfirmation` | Counts and warning, Cancel keeps data, Replace all data replaces it |
| `BackupRestoreRejectsInvalidFiles` | Malformed, newer-format, and dangling-food files leave data unchanged |
| `Design references/*` | Each of the 11 unbuilt-feature studies renders without errors |

These are browser checks of React Native Web. They do not verify native iOS layout, keyboard,
VoiceOver, or expo-sqlite on the device. See `docs/ios-builds.md`.

## Design references for unbuilt features

`screens.stories.tsx` holds the source manifest with each public image URL. **Compare source**
shows the original artwork beside each study. Later tickets reuse these designs: targets (04)
for the dashboards, recipes (08) for the recipe screens, and weight history (10) for the trends.
Adaptive coaching, expenditure estimates, and program updates stay design-only. The plan sets
manual targets.

[press]: https://macrofactor.com/press-kit/
[product]: https://macrofactor.com/macrofactor/
[report]: https://macrofactor.com/annual-report-2026/
[dashboard]: https://macrofactor.com/dashboard-customization/
[logging]: https://help.macrofactorapp.com/en/articles/215-how-to-log-food-in-macrofactor
[custom]: https://help.macrofactorapp.com/en/articles/5-create-and-add-a-custom-food
[timeline]: https://help.macrofactorapp.com/en/articles/218-how-to-configure-your-food-timeline
