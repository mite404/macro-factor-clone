# Working on this app

For implementation work, load `poteto-mode` and read its Principles before starting. Keep Ponytail
full active: implement the ticket's behavior with the smallest maintainable design.

Before delegating, read `.agents/pstack-models.md`. Its repository-specific assignments override
global role defaults for the named work. Read the assigned ticket in `docs/tickets/` and the shared
verification contract in `docs/implementation-plan.md`.

Implement one ticket per thread. Integrate and verify prerequisites before starting dependent work.
Keep native iOS acceptance separate from browser previews and portable SQLite tests. Linux cannot
prove iPhone signing, native keyboard layout, VoiceOver, or camera behavior.
