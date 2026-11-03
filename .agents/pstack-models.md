# Repository pstack overrides

This is a repository-local override, not a copy of the global skill. Read it before selecting a
worker for this app. Keep the global poteto-mode model reference's gateway, escalation, Kimi-spend,
and review-lens rules unchanged. Roles not overridden here keep their current global defaults;
revalidate their model availability before using them.

## Notation and scope

`model/effort` specifies both independently. These assignments apply to visible Amp threads using
`external-agent:claude-code`, not Amp's generic Task tool, which cannot pin a model or effort.

| Work | Requested model | Effort | Authority |
| --- | --- | --- | --- |
| Tickets 01 through 10, including their corrections | Claude Opus 5.5 | medium | User |
| Orb setup scripts | Claude Sonnet 5.5 | high | User |

For these assignments, the role overrides are:

```text
feature, refactoring: opus/medium
bug-fix: opus/medium
orb setup: sonnet/high
```

These overrides are limited to the work in the table. They do not lower the model used for unrelated
future bug investigations, planning, independent review, or prose.

## Amp routes

For tickets, pass `agent_mode: external-agent:claude-code` and features
`["model:claude-opus-5-5", "effort:medium"]`.

For orb setup, pass the same agent mode and features
`["model:claude-sonnet-5-5", "effort:high"]`.

Both routes were accepted by Amp thread creation in this project on October 31, 2026. That verifies
the requested configuration, not a provider-side attestation of the effort actually used.
`list_agent_modes` reports Amp model and plugin modes but does not enumerate these external Claude
routes. The local cross-vendor detector found no subscription CLI families in this orb; use native
Amp thread tools rather than trying to launch terminal agents.

Start implementation briefs with a request to read `poteto-mode` in full, including its Principles.
Transfer unpushed prerequisites explicitly, since a new orb cannot see the coordinator's working
tree. Keep the original thread for corrections to its ticket. Keep independent setup work separate
from feature files. If a requested route is unavailable, report it instead of changing models.
