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

Implement one ticket per thread. Integrate and verify prerequisites before starting dependent work.
Keep native iOS acceptance separate from browser previews and portable SQLite tests. Linux cannot
prove iPhone signing, native keyboard layout, VoiceOver, or camera behavior.
