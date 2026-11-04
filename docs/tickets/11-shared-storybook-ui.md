# 11: One UI for the app and Storybook

Depends on: 01, 02, and the Storybook setup. Covers R10. Review boundary: Storybook renders the
production screens, so there is one UI implementation to test.

## Outcome

The app runs the reference screens built in Storybook. Storybook renders those same production
screens against isolated data, so there is one UI to test.

## Implementation

Move `storybook/ui.tsx` to `src/ui.tsx`. Move `FoodLog`, `FoodSearch`, `QuickAdd`, `FoodDetail`,
and `CreateFood` into `src/`, replace their fixtures with real data, and wire their buttons to
the existing validation and storage functions. Delete `DiaryScreen` and `FoodPanel`. Keep each
screen's original light or dark theme. Remove the simulated phone frame, status bar, and keypad
from live screens. Remove tabs and buttons for features that do not exist yet. Hide target
denominators and Impact on Targets until ticket 04 supplies targets. Portions offer only the
food's basis unit and its measured serving.

Keep the other 11 reference screens as Storybook design references with fixture data, built on
the same kit. Alias `expo-sqlite` in Storybook only, to wa-sqlite with a fresh in-memory database
per story. Add no dependencies.

## Acceptance checks

- The live screens are the moved reference components, recognizably the same composition.
- Unknown macros stay unknown, a known 0 stays 0, and food edits leave logged entries unchanged.
- Stories cover an empty day, unknown macros, quick-add validation and correction, creating and
  logging a saved food, a food edit, and a per-100 ml serving chosen with the keyboard.
- `npm run test:storybook` passes all 17 stories on the dev server and the static build.
- `npm test`, `npm run typecheck`, `npm run export:ios`, and `npm run build-storybook` pass.

## Limits

No pixel parity with MacroFactor and no new product features. Browser checks do not verify
native iOS. Native acceptance stays pending under `docs/ios-builds.md`.
