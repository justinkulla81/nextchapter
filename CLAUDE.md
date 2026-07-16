# Project instructions

## Design principles

Whenever you design a new product, feature, UI, or write code that produces
user-facing output, you MUST consult the design principles below and apply
every relevant rule. If a design would violate a principle, revise it or
explicitly flag the conflict and explain the tradeoff before proceeding.

@design-principles.md

## Analytics instrumentation

PostHog is wired up (`src/lib/posthog/`) — SDK init, pageview tracking, and
user identification on dashboard load. Whenever you build a new feature that
involves a user action (a button click, a form submit, an unlock, a
generated artifact, a status change), fire a PostHog event for it as part of
that same build — do not ship the feature first and add analytics later.
Name events `snake_case`, past-tense-ish and specific (`job_rated`, not
`click`), and include the IDs/params a real query would need (e.g.
`{ jobId, source, reaction }`, not just the event name). Use
`posthog.capture()` client-side for user-initiated actions; use
`posthog-node` server-side for events that only happen in a Server Action
(add the package when the first such event is needed).
