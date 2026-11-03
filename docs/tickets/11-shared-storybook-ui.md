# 11: One UI for the app and Storybook

Depends on: 01, 02, and the Storybook setup. Covers R10. Review boundary: Storybook renders the
production screens, so there is one UI implementation to test.

## Outcome

Storybook stories render the production `App` against isolated data and exercise the diary and
saved-food flows. The separate reference-screen UI is gone. Unbuilt MacroFactor screens remain
only as source links in `storybook/README.md`.

## Implementation

Move the reference components that help the working features into `src/ui.tsx`: a labelled
input with a unit suffix and macro tints that sit beside text labels. Keep the existing behavior.
That means validation, unknown macros, measured units, snapshot history, 44 pt controls, keyboard
radios, and selected state. Do not port fake controls, illustrative charts, health targets, or
coaching.

Alias `expo-sqlite` in Storybook only, to a small provider backed by the wa-sqlite engine that
expo-sqlite ships for the web. Give each story a fresh in-memory database, seeded through the
production `insertEntry` and `insertFood`. It never opens `nutrition.db`. Let `App` take an
optional `onInit` that runs after migration so stories can seed data. Add no dependencies.

## Acceptance checks

- Every story imports `src/App.tsx`. No story defines its own screen, state, or storage logic.
- Stories cover an empty day, a populated day with unknown macros, quick-add validation and
  correction, creating and logging a saved food, food edits that leave the diary unchanged, and a
  per-100 ml serving selected with the keyboard.
- `npm run test:storybook` passes against the dev server and the static build. It fails when the
  radio Space handler breaks or a food edit rewrites a logged entry.
- The Metro web preview shows the same flows at 390 px width.
- `npm test`, `npm run typecheck`, `npm run export:ios`, and `npm run build-storybook` pass.

## Limits

No pixel parity with MacroFactor and no new product features. Browser checks do not verify
native iOS. Native acceptance stays pending under `docs/ios-builds.md`.
