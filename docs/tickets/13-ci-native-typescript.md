# 13: Native TypeScript 7 and GitHub CI

Depends on: scaffold, 01, 02, 11, 12. Review boundary: every pull request shows separate lint,
typecheck, test, invariant, export, and Storybook results from GitHub-hosted runners.

## Outcome

`tsc` is the native TypeScript 7 compiler. GitHub Actions runs each required check as its own job,
so a red result names the failing kind of check.

## Implementation

Pin `typescript` 7.0.2. Its `tsc` binary is the native compiler, and no package provides a second
`tsc`. Expo 58 reads only `typescript/package.json` when starting, and its config transpiler skips
the legacy compiler API when TypeScript 7 lacks it. No `.ts` config files exist, so no
`@typescript/typescript6` alias is needed. Expo still recommends `~6.0.3`, so `package.json`
excludes `typescript` from Expo's dependency check.

Pin Oxlint 1.91.0. `npm run lint` fails on warnings. The React plugin and `rules-of-hooks` are on.
`set-state-in-effect` is off because screens call `reload()` in an effect, which sets state after
an awaited SQLite query. `no-unused-vars` ignores rest siblings, so `({ id, ...e }) => e` can
drop a field. Two Storybook files get file-scoped overrides. `storybook/wa-sqlite.d.ts` needs a
triple-slash path reference to load wa-sqlite's ambient types. `storybook/sqlite.tsx` opens its
database once on mount, as expo-sqlite's provider does, so `exhaustive-deps` is off there.

`tsconfig.json` includes `.agents/**/*`, so typecheck covers the invariant scripts CI runs.

`.github/workflows/ci.yml` runs on pull requests, pushes to `orb-setup` and `main`, and manual
dispatch. A newer push to the same ref cancels the older run. Each job runs `npm ci` with the npm
cache keyed by `package-lock.json`:

| Job | Command | Proves |
| --- | --- | --- |
| Lint | `npm run lint` | Oxlint rules, including hooks |
| Typecheck (TypeScript 7 native) | `npm run typecheck` | Types with the native compiler |
| SQLite tests | `npm test` | Behavior against Node's real SQLite |
| Nutrition history invariants | ticket 12's `check.ts`, depth 4 | Diary history across 3,448 op sequences |
| Metro iOS export | `npm run export:ios` | The production iOS JavaScript bundle builds |
| Storybook build and browser flows | `npm run build-storybook`, then `npm run test:storybook` | Every story's play function passes in Chromium against the static build |

The Storybook job installs `agent-browser` 0.38.1 globally and runs `agent-browser install
--with-deps` for Chromium and its system libraries. It is not a project dependency. The job
serves `storybook-static/` with `python3 -m http.server` and sets `STORYBOOK_URL`.

No Turbo or affected-only selection is used. The repository is small enough to check fully on
every run.

## Acceptance checks

- `npx tsc --version` prints `Version 7.0.2`.
- Adding `const broken: number = "nope"` fails typecheck with TS2322 and exit 1. Removing it
  restores exit 0.
- A conditional hook call fails lint with `react-hooks(rules-of-hooks)`. Removing it restores
  exit 0.
- A type error in `.agents/skills/verifying-nutrition-history/scripts/check.ts` fails typecheck.
- The invariant check passes at depth 4 and 5, and `mutants.ts` reports all 10 mutants `CAUGHT`.
- `npm test`, `npm run export:ios`, and `expo start --web` succeed with TypeScript 7.
- With TypeScript 7 installed, `npm run build-storybook` succeeds and all 6 stories pass against
  the static build. Changing the portion scale divisor from 100 to 50 fails
  `saved-food-create-and-log` with exit 1. Restoring it brings back 6 passing stories.
- The pull request shows each job as a separate check.

## Limits

`expo-doctor` is not a CI gate. It compares against versions fetched from the network, so its
result changes over time. It reports outdated packages and does not pass. Before this ticket it
reported `expo` 58.0.22 vs `~58.0.23` and `react-native-safe-area-context` 5.10.1 vs `~5.11.1`.
After this ticket it reports the same two; `typescript` is excluded on purpose. Upgrading Expo or
runtime packages is out of scope.

The Metro export is not a native compile. Native builds, signing, and simulator runs happen later
on a Mac. CI has no pixel-diff screenshot gate. Storybook runs React Native Web in Chromium. It
does not verify native iOS layout, keyboard, VoiceOver, or expo-sqlite on the device.
