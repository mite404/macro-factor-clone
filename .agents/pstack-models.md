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
| Independent reviews of Claude Code tickets | Claude Fable 5.1 | xhigh | User |

For these assignments, the role overrides are:

```text
feature, refactoring: opus/medium
bug-fix: opus/medium
orb setup: sonnet/high
Claude Code ticket review: fable/xhigh
```

These overrides are limited to the work in the table. They do not lower the model used for unrelated
future bug investigations, planning, or prose. Amp-native Dial threads retain their existing
Review-button workflow; the Claude Code review override does not apply to them.

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

## Claude Code ticket reviews

The implementation thread owns review after draft PR creation and before marking ready or the first
CI jobs. Follow the severity and re-review rules in [AGENTS.md](../AGENTS.md).

1. Start a separate reviewer with Amp's `create_thread`, `intent: independent-review`,
   `agent_mode: external-agent:claude-code`, and the explicit features
   `["model:claude-fable-5-1", "effort:xhigh"]`. Use the linked Claude subscription, not a raw
   Anthropic mode or API key. A generic Task named "oracle" does not select this model or effort.
2. Give the reviewer the repository, draft PR URL, exact base and head SHAs, ticket, verification
   evidence, and the implementation thread's actual ID. Request read-only review, with no further
   delegation. A new orb must fetch that PR head; transfer any unpushed review inputs explicitly.
   Have the reviewer confirm the actual checked-out head matches the requested head before review.
3. Ask the reviewer to send its verdict back with `send_thread_message` to the implementation
   thread's supplied ID, and include the same findings in its final response. Require the exact
   reviewed base/head, severity, file/line evidence, suggested fixes, checks run, and coverage
   limits.
   Include the requested model/effort and any observed routing mismatch or cap. Request this reply
   explicitly; a child thread's final response is not delivered back automatically. Use the reply
   path rather than also calling `wait_for_threads`.
4. Record the reviewer thread link, reviewed head, and findings in the PR's implementation thread
   and delivery record. Own fixes there, then send the updated head to the same pinned reviewer for
   re-review. A verdict for an older head does not approve later changes. Keep the PR draft until
   the current head has completed review and any owner decisions are resolved.

If the subscription, model, or effort is unavailable, stop and report the blocker. Do not substitute
Opus, a floating `fable` alias, another effort, or paid API inference. Check the created thread's
configuration and available runtime evidence; disclose unobservable settings rather than claiming
provider attestation. A detected fallback or effort cap does not satisfy the requested review.

### Route evidence and limits

Checked November 4, 2026 against [Amp's Claude subscription routing][amp-claude],
[Fable 5.1's model ID][fable], and [Claude Code's model and effort support][claude-config].
The exact Amp features are `model:claude-fable-5-1` and `effort:xhigh`; Fable 5.1 supports xhigh.
Claude Code can cap effort through managed settings or organization policy. The supplied features
request the configuration; they do not prove the provider used it.

The owner's `claude_usage` setting was `subscription-only`. That preference alone does not prove an
active subscription or Fable entitlement. No live Fable review was launched for this guidance check.
Claude's docs warn that some plans bill Fable to extra usage credits, including without a prompt in
SDK sessions. Verify included-plan access before launching; if unclear, ask the owner rather than
assuming subscription routing means no extra charge. Amp orb charges are separate from inference.

[amp-claude]: https://ampcode.com/docs/the-dial#use-your-claude-subscription
[fable]: https://platform.claude.com/docs/en/models/fable-5-1/overview
[claude-config]: https://docs.claude.com/en/docs/claude-code/model-config
