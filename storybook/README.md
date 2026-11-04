# Storybook

The MacroFactor reference screens are the app's UI. Their component kit moved from
`storybook/ui.tsx` to `src/ui.tsx`. `FoodLog`, `FoodSearch`, `QuickAdd`, `FoodDetail`, and
`CreateFood` moved to `src/features/diary/LoggingScreens.tsx`, where fixtures became props and
disabled buttons became callbacks. `src/features/goals/TargetsForm.tsx` follows `CreateFood`'s
layout. `src/features/lookup/BarcodeScreens.tsx` adds the logger's Barcode tab, in the place of the
reference's Scan tab, and a USDA or Open Food Facts record review that follows `FoodDetail`.
`src/features/recipes/RecipeScreens.tsx` adds the logger's Recipes tab and recipe detail on the dark
sheet, and a builder and ingredient picker that follow the light `RecipeBuilder` reference.
`src/features/weight/WeightHistory.tsx` adds weight history, opened from the scale button beside
the food log's date. It follows the dark weight `Trend` reference, with real weigh-ins in place of
its fixture lines, and a weigh-in form that follows `TargetsForm`.
`src/features/diary/Diary.tsx` wires them to SQLite. The
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
- `npm run test:storybook` opens all 50 stories at 390 × 844 px and fails unless its play function
  finishes without browser or console errors. It then resizes two App stories between 1280 and
  320 px windows and fails unless each shows a centered 390 × 844 screen that only narrows. Set
  `STORYBOOK_URL` to test another origin, such as a static build.

`verify.mjs` drives Chromium through the `agent-browser` CLI. The orb preinstalls it. A CI runner
needs Node ≥ 22.18, `npm ci`, `agent-browser` with its Chromium, and a server for Storybook, either
`npm run storybook` or `storybook-static/` behind a static server. If CI cannot install
`agent-browser`, `@storybook/addon-vitest` with Playwright can run the same play functions. That
adds dependencies and needs the owner's approval.

| Story | Flow it checks |
| --- | --- |
| `EmptyDiary` | Empty day, zero totals, and no targets or invented goal |
| `TargetsUnderAndIncomplete` | Amounts left, unknown protein marked incomplete, carbs without a target |
| `TargetsOver` | 2150 kcal against 2000 kcal reads 150 kcal over |
| `TargetsLargeText` | At 1.5× text every total stays whole on one line; the last entry scrolls above the footer |
| `SetTargetsWithKeyboard` | Typed and tabbed targets, 0 rejected, edits change the comparison, not the entry |
| `PopulatedDiary` | Seeded entries, a lower-bound protein total, incomplete-macro warning |
| `QuickAddValidationAndCorrection` | Required and invalid calories, save, correct, delete |
| `SavedFoodCreateAndLog` | Empty search, create from the search text, validation, 150 g portion |
| `SavedFoodEditKeepsHistory` | Edit food calories; the earlier diary snapshot stays 184.5 kcal |
| `MeasuredServingWithKeyboard` | Per-100 ml food, Space selects the serving radio, 2 bottles = 660 ml |
| `BackupExport` | The downloaded backup equals the restored version 5 fixture, archived food, brand, targets, recipes, weigh-ins, and unit included |
| `BackupRestoreConfirmation` | Counts and warning, Cancel keeps data, Replace all data replaces it |
| `BackupRestoresTargets` | A version 2 file's targets are counted, restored, and compared |
| `BackupRestoreRejectsInvalidFiles` | Malformed, newer-format, and dangling-food files leave data unchanged |
| `BackupRestoreInProgressLocksNavigation` | Held restore writes: spinner, Cancel and back disabled, then restored |
| `BarcodeSavedFoodOffline` | A saved barcode in another GTIN length is found with no USDA request; detail shows brand and source |
| `BarcodeUsdaReviewSaveAndRepeat` | Keyboard lookup, top-ranked unrelated record ignored, review, save, log 28 g, repeat lookup is local |
| `BarcodeMultipleRecords` | Two exact USDA records listed with record ids and dates; an invalid one is counted, not shown |
| `BarcodeLookupErrors` | Check digit, length, missing key to Settings and back, 429, offline, rejected key, not found, invalid nutrition |
| `BarcodeTimeoutRecovers` | A USDA request with no reply shows the loading state, then the timeout, then Try again succeeds |
| `UsdaKeySettings` | Blank and malformed keys rejected, key saved masked and never shown, then removed |
| `BarcodeLargeText` | At 1.5× text the USDA review keeps every figure whole and scrolls clear of Save food |
| `BarcodeOffFallbackSaveOffline` | USDA miss falls back to Open Food Facts; review, license link, save, log 20 g, repeat lookup offline |
| `BarcodeUsdaLimitOffersOff` | USDA 429 asks nothing else; Try Open Food Facts, its 503, then Try again sends nothing during the cooldown |
| `BarcodeOffLargeText` | No key: Open Food Facts directly; unknown protein, fat, and net-only carbs stay "?"; 1.5× text keeps figures whole |
| `BarcodeScanOnceAndRescan` | One permission request; three repeated detections make one lookup; an explicit rescan makes one more |
| `BarcodeScanDeniedTypeUnknown` | Denied camera offers Settings, re-reads access on return; a typed unknown code reaches Create food |
| `BarcodeScanPromptOpen` | While the iOS prompt is open the scanner waits behind it, with no scan hint and no access-off message |
| `BarcodeScanMountErrors` | A recovered media reset keeps the camera open; another mount error reports a failed start |
| `RecipeBuildAndLog` | 0 g and empty recipes rejected, ml food refused, draft kept across picks, 150 g of 600 g = 225 kcal, fat unknown |
| `RecipeEditKeepsHistory` | Removing an ingredient and reweighing changes the next portion, not the one already logged |
| `RecipeManyIngredientsScrolls` | Ten ingredients keep the draft, and the last one scrolls clear of Save |
| `CopyEntriesToToday` | Cancel adds nothing; 2 of 3 entries (580 kcal) copied to a 120 kcal day make 700; three taps make one batch |
| `WeightEmpty` | No weigh-ins shows no average or chart; 0 kg rejected; one weigh-in reads as one sample |
| `WeightTrendAddEditDelete` | 80 and 82 kg six days apart average 81; a day-8 84 kg averages 83; edit to 86, then delete |
| `WeightReplaceAndPounds` | A second weigh-in today warns and replaces; 100 lb shows as 45.4 kg; an earlier day adds |
| `WeightLongHistoryLargeText` | 53 weigh-ins with gaps: 30-day chart of 20, every row listed, 1.5× text unclipped above Log weigh-in |
| `WeightUnitSaveFails` | A failed unit save on the history screen shows an alert and keeps kg |
| `Design references/*` | Each of the 11 unbuilt-feature studies renders without errors |

`main.ts` also aliases `expo-camera` to `camera.tsx`. Its permission answers follow iOS, and its
camera reports the story's codes on every render, so the scanner's one-scan lock is exercised.
It proves wiring, not real camera behavior.

Barcode stories stub `window.fetch` for `api.nal.usda.gov` and `world.openfoodfacts.org` with
recorded fixtures and use a fake key held in memory by `key.web.ts`. They never call either
provider or touch a Keychain.

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
