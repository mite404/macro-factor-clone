# 01: Persist a quick-add diary

Depends on: scaffold. Covers R1, R9, R10. Review boundary: one usable offline logging flow.

## Outcome

Choose a day, enter a label, calories, protein, carbs, and fat, and see that day's entries and
totals. Edit or delete an entry and retain the result after app restart. No food search yet.

## Implementation

Add `src/features/diary/` and `src/storage/`; compose the screen in `src/App.tsx`. Install
Expo-compatible SQLite and safe-area support when needed. Keep schema migrations numbered and
transactional. Persist explicit calendar-day strings and nutrition snapshots; derive totals.
Validate non-negative finite numbers at form boundaries, allow zero, and preserve missing macros as
unknown with an incomplete-total indication. Use a keyboard-aware form with visible Save/Cancel.
Introduce the smallest useful `npm test` setup for the installed toolchain, not a second app stack.

## Acceptance checks

- Log 240 kcal, 17 g protein, 23 g carbs, and 9 g fat, then 80 kcal with unknown macros. Show 320
  kcal and an incomplete macro total, not a fabricated complete 17/23/9 result.
- Edit 240 to 200: the total becomes 280. Delete the 80 entry: it becomes 200.
- Restart the app and reopen the database: the remaining entry is unchanged.
- A rejected negative or non-finite value adds no row; changing timezone leaves the chosen day
  intact.
- Inspect empty and populated states, validation, large text, and the open iOS numeric keyboard.

## Mobile lesson and limits

React Native uses native views and text, not HTML. The keyboard and safe area are part of layout. No
automated calorie advice or default diet goal. Run the plan's shared verification commands. Report
native SQLite and keyboard checks as pending if no Mac/iPhone is available.
