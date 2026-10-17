# Candidate site redesign: the brief and the rules

This is the owner's brief for every candidate page, in their words and decisions.
Every change to a page under `src/app/dashboard` follows it. A change that adds a
card, a tag, a toggle or a section to a page must say what it removes.

## The goal

Clear structure for what to do and why to do it. Not overwhelming. Clean, easy,
addictive, modern, professional, totally obvious and self-explanatory: how you use
it, the steps to get a job, and what keeps you motivated. Always positive, always
simple. "Duolingo for professionals": people want jobs, not badges, so every
screen should feel like progress toward a job.

## Decisions already made

- **Six places**: Home, Jobs, Network, Learn, Personalize, Help. One small tab row
  per place. Nothing sequential is forced: people go back and forth between
  stages, so there is **no stage stepper** (no "Exploring, Preparing, Applying...").
- **One note per page, and only on Home.** Daily messages, prompts, nudges and
  small check-ins ("still searching? how are you doing?") are one card in one
  place. Working pages (Find a job, Contacts, ...) carry no note and no action plan.
- **Unlocks are one ladder.** Effort (minutes of real search work) earns Candidate+.
  Candidate+ is what recruiters and hiring managers see. Confidential mode hides
  the mark until the member shows it. Points are explained once, in plain words
  ("1 point = 1 minute"), or removed.
- **Dossier is not its own section.** It is evidence of the nine traits (motivation,
  thoroughness, conscientiousness, helpfulness, communication, references and
  self-awareness, peak strengths, ...) that a CV cannot show. Everything the member
  does builds it. It is shown as progress, never as a lock. Once earned, nothing
  about it looks locked.
- **Coaching style** (pushed hard, casual, supported) changes how much, which
  parts and how it is said. Always positive.
- **Terms stay consistent**: Personalize, not Prepare. "Higher education", not
  "Higher ed", where there is room.
- **Private communities** (outplacement, higher education, alumni, workforce) can
  appear inside Jobs, Network and Learn. People can belong to many schools and many
  programs.
- **Colors**: the NextChapter palette, not too blue. One action color. Serif for
  display headings, Inter for everything else. Two typefaces at most.

## Added 2026-10-17

- **Dark navy is for the one unlock or "next level" moment on a page** (Unlocks, Candidate+ progress, a finished-tuning reveal). One per page, so it draws the eye. Never for ordinary cards.
- **The menu shrinks to icons.** A small control at the top of the menu collapses it so the page gets the width. The choice is remembered.
- **Names say the benefit.** Home entries: Your plan, Improve your search, Momentum. Strips: Build your plan (Home), Better jobs for you (Jobs), Warmer introductions (Network), Closer to hired (Learn). The Personalize place is replaced by these strips and the Improve your search page. Settings: Account and privacy.
- **Every question flow**: two or three questions at a time, "why we ask" first, the payoff updating as you answer, a finish screen that shows what you gained, and one optional next question. Long assessments become short rounds with a reveal at the end.

## Page contract

1. One headline. One primary action, the most visible thing on the page.
2. Everything needed to decide the next step is on the first screen, with no
   scrolling.
3. At most three sections visible. The rest sit behind tabs or "Show more". Never
   one long run of unrelated sections.
4. Every claim says why. A fit verdict gives one plain reason. A competition claim
   states the fact it rests on, or it is dropped.
5. No row carries more than: a title, one verdict with its reason, one fact, and
   two actions. Detail opens on demand.
6. Legal and licence credits (O*NET, BLS) stay, as one line linking to the full
   notice.
7. Pages that were merged into one long page are split again by purpose.

## Job row

> **Chief Financial Officer** · Arsenault
> **Good fit.** You have led finance at a company this size.
> Few applicants: a search-firm role that is not on the big boards. Posted 34 hours ago.
> [Save] [Apply]    Why this fits ▾

The skills, culture, salary, goals and working-style breakdown opens under
"Why this fits". "Low competition" is never a bare tag.

## How a page gets built

1. A prototype with sample data in `src/app/dev-preview/` (never reachable in
   production), screenshotted and reviewed by the owner.
2. Then the real data is wired in. The visual stays as approved.
3. Partner portals (higher education, outplacement, coach, hiring, recruiter,
   workforce) follow the same system once the candidate site is done.
