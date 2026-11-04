# Working on this app

Use vanilla Git for this project. Do not use GitButler, even when a global skill recommends it.

Every thread must load `poteto-mode` and read its Principles before starting or resuming work.
Keep Ponytail full active: implement the ticket's behavior with the smallest maintainable design.

Before reporting work verified, load the project skill
`.agents/skills/verifying-nutrition-history/SKILL.md` and follow its checks and scope limits.
If the skill is missing from the checkout, obtain its verified prerequisite before sign-off.
Its bounded nutrition checks supplement the ticket's tests, browser flows, and native acceptance;
they do not verify UI behavior or the whole app. Report commands, results, and untested scope.

Before delegating, read `.agents/pstack-models.md`. Its repository-specific assignments override
global role defaults for the named work. Read the assigned ticket in `docs/tickets/` and the shared
verification contract in `docs/implementation-plan.md`.

Each ticket thread owns its independent oracle review. After local checks, create a draft PR;
CI jobs skip drafts. For Claude Code implementations, the ticket thread starts a separate Amp
Claude Code reviewer thread pinned to Fable 5.1 at xhigh through the linked Claude subscription.
Follow the exact route and findings-return protocol in
[the repository review routing](.agents/pstack-models.md#claude-code-ticket-reviews).
For Amp-native Dial implementations, retain the existing Review-button workflow instead. The
Claude-specific route does not apply to them. Record the reviewed head and findings in either case.
Self-review by the implementation agent is not an oracle review.
Fix medium-and-higher findings and have the oracle recheck the corrections. Summarize low/minor
findings for the owner and wait for their decision before continuing. Mark the PR ready only after
review is complete; this starts its first CI jobs. Do not manually dispatch CI before that review.
Keep later code changes in draft until their review is complete. The coordinator integrates reviewed
PRs with passing CI. Record delivery and verification in `docs/implementation-record.md`.

Implement one ticket per thread. Integrate and verify prerequisites before starting dependent work.
Keep native iOS acceptance separate from browser previews and portable SQLite tests. Linux cannot
prove iPhone signing, native keyboard layout, VoiceOver, or camera behavior.
