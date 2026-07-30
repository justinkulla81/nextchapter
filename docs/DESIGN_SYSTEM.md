# Design System

This is the visual/interaction design doc: tokens, typography, component patterns, and the status/grade/empty-state conventions built out in the most recent design-system pass. Pair with [design-principles.md](../design-principles.md) (the binding design rules every new feature is checked against) and [CLAUDE.md](../CLAUDE.md).

## Stack

Tailwind CSS v4, CSS-first config — **there is no `tailwind.config.ts`**. Every design token is a CSS custom property defined in `src/app/globals.css`'s `@theme inline` block, which Tailwind turns into utility classes automatically (`--color-navy` → `text-navy`/`bg-navy`/`border-navy`, etc.). To add a new token, add it there — don't reach for an inline hex value or a config file that doesn't exist.

UI primitives come from `@base-ui/react`, not shadcn/Radix directly (though the file layout under `src/components/ui/` looks shadcn-shaped). The one gotcha that's tripped up new code before: to render `Button` as a different element (e.g. a `Link`), use `<Button nativeButton={false} render={<Link href="..." />}>` — **not** a shadcn-style `asChild` prop, which doesn't exist on this `Button`.

## Color tokens

| Token | Hex | Use |
|---|---|---|
| `navy` | `#0b2545` | Primary text-on-light, headline color on marketing pages |
| `brand` | `#1d4e89` | Brand blue — B-grade color, "Good fit" pills, secondary accents |
| `light-blue` | `#2980d4` | Lighter accent, used sparingly |
| `orange` | `#f4a259` | **Locked states, number/counts, badges** — legitimate use, not banned. Never used for CTAs. |
| `success` | `#2e7d5b` | The single accent color for primary actions/CTAs, A-grade, ✓ status icon |
| `success-hover` | `#3f9b72` | Hover state for success/primary buttons |
| `error` | `#c4574a` | D/F grades, ✗ status icon, destructive actions |
| `warning` | `#e9a94b` | C-grade color |
| `off-white` | `#f7f9fa` | Page background |
| `light-gray` / `gray` | `#e2e8f0` / `#8892a0` | Borders, muted text |

**The accent-color rule** (from `design-principles.md`): success green is the *only* color used for anything actionable/CTA — it must never appear on non-actionable elements, and no other color may be used for a primary action. Orange is reserved specifically for locked/gated states, counts, and badges — it reads as "not available yet," never as "click me."

A `.dark` class and full dark-mode token set exist in `globals.css` (inherited from the shadcn scaffold), but nothing in the app currently toggles it — the product is light-mode only today. Don't assume dark mode is live anywhere.

## Typography

- **Font**: Inter (`next/font/google`), applied via `--font-sans`. Base root font size is **112.5%** (18px) sitewide, deliberately larger than the Tailwind default — the candidate base skews 35-55.
- **Two coexisting, both-intentional h1 systems** (documented in the Prompt 66 typography audit — see `IDEAS.md`'s history / task list, not itself a bug):
  - **Marketing/public pages**: `text-4xl font-bold tracking-tight text-navy` (h1), `text-3xl font-bold tracking-tight text-navy` (h2).
  - **App/dashboard/admin/onboarding pages** (~20+ pages, byte-identical): `text-2xl font-semibold tracking-tight` — no explicit color class, inherits `text-foreground`.
  - Two known drift spots exist outside this split: `onboarding/working-style/page.tsx` and `resources/page.tsx` use the marketing h1 style despite being product-adjacent pages — flagged, not yet fixed (low-value cosmetic fix).
- **Eyebrow/section labels**: `text-xs font-semibold tracking-widest text-muted-foreground uppercase` — the standardized form as of the Prompt 66 pass (previously drifted between `tracking-wide` and `tracking-widest` across a few pages).

## Grade color system

**Single source of truth**: `GRADE_TEXT_COLOR` and `GRADE_RING_STROKE` in `src/lib/scoring/grade.ts`. Every grade display anywhere in the product must import and use these — this was audited and consolidated in the Prompt 66/67 pass after finding several components (`stats/page.tsx`, `MarketRealitySnapshotArchive.tsx`) rendering grades in plain black instead.

```
A → text-success / stroke-success   (green)
B → text-brand   / stroke-brand     (blue)
C → text-warning / stroke-warning   (amber)
D → text-error   / stroke-error     (red)
F → text-error   / stroke-error     (red)
```

**The "hard graders" philosophy** (`GRADE_BAND_DESCRIPTION` in `grade.ts`) is a real product stance, not just copy: "You have some good stuff going, but it's clearly not working the way it needs to yet... Most candidates land here" is the C-band description. This directly shapes UI decisions — e.g. the Hireability Report's six graded categories deliberately do **not** get binary ✓/✗ status icons, because that would misrepresent an honest curve as pass/fail.

## Status icon system

`src/components/ui/status-icon.tsx` — `StatusIcon` and `StatusRow` (icon + label/sublabel row), three states:

| Status | Icon | Color | Meaning |
|---|---|---|---|
| `success` | ✓ (Check) | `text-success` | Done / no issues |
| `error` | ✗ (X) | `text-error` | Issue found |
| `locked` | 🔒 (Lock) | `text-orange` | Locked / gated / not enough signal yet |

Applied to: Dossier section-completeness rows, badge shelf locked state, Hireability Report's true-N/A category edge case. **Deliberately not applied** to the six normally-graded (A-F) Hireability Report categories — see the grade-color section above.

## Loading states — two distinct patterns, never mixed

1. **Branded inline spinner** (`InlineLoadingState`) — for short async actions (roughly under 5-10 seconds): report generation, resume analysis, LinkedIn tool, job-fit checks. Shows next to the triggering button with a specific label (e.g. "This takes a few seconds — analyzing your resume…").
2. **Skeleton screens** (`src/components/ui/skeleton.tsx`, route-level `loading.tsx` files) — for heavier full-page loads: Stats page, Recruiter Report/Dossier full render. Shape-matches the real page layout (header, hero, card grid) so there's no layout jump when real content arrives.

Per the design-principles.md rule ("every button click gets a busy-cursor state"), form-submitting buttons across the app also use a shared `SubmitButton`/`cursor-progress` pattern independent of which of the two loading patterns above applies.

## Empty states

One reusable component: `src/components/ui/empty-state.tsx` — icon (any `lucide-react` icon) + title + short encouraging description + optional CTA button. Applied wherever a candidate can hit a genuinely empty list early in their journey: zero references, zero completed Weekly Search Sprint actions (this was a real rendering bug before the fix — the section used to render fully blank), Executive Dossier with no content yet. Not yet applied to individual empty sub-sections within the Dossier (References/AI Fluency/Learning sections still silently omit themselves when empty — see `IDEAS.md`).

CTA buttons inside `EmptyState` use the `Button` + `render={<Link .../>}` pattern noted above, not `asChild`.

## Job Board / Job Fit patterns

- **Locked card** (A-List-exclusive listings): dashed border, 🔒 orange lock icon + "A-List-exclusive opportunity — locked" label, non-identifying info only ("Direct Employer · Seattle, Washington"), and an inline unlock condition ("Reach an A grade to see who's hiring and apply") — a distinct card treatment, not a generic locked message.
- **Fit pills**: small rounded pill, "Good fit" = brand blue, "Strong fit" = success green.
- **Reaction buttons**: "Interested" = solid `success`-variant button; "Not Interested" = `outline`-variant button (white with border). Paired side by side.

## Homepage stat callouts

`src/components/StatCallouts.tsx` — reusable `{value, label}[]` component: soft rounded off-white box (`bg-off-white rounded-xl`), bold navy number, gray label underneath. Used for plain factual claims (not locked-states or live counts, hence navy not orange) — e.g. "15 — free expert guides." Built generic enough that real usage numbers can swap in later without a rebuild.

## Button variants

`src/components/ui/button.tsx` (cva-based): `default` (success green, the primary/CTA action), `outline`, `secondary`, `ghost`, `destructive`, `link`, `cta`/`success` (explicit aliases for the same green treatment). Every variant has an explicit hover and `focus-visible` ring state baked into the shared `buttonVariants` — this part of the system has no drift. Clickable `Card` wrappers (cards that are themselves links) are less consistent — three different hover treatments exist across the few places this pattern is used (`hover:border-brand` is the majority pattern; standardize new ones to that).

## Known inconsistencies (flagged, not fixed)

From the Prompt 66 audit — worth knowing about before assuming something is a new bug:
- Inline text links use two coexisting conventions: always-underlined (`text-primary underline underline-offset-4`) vs. underline-only-on-hover (`hover:underline`), split roughly evenly across the codebase. Not normalized — cosmetic, high-blast-radius-to-fix, low value.
- `onboarding/working-style` and `resources` pages use the marketing h1 style instead of the app-page style (see Typography above).
