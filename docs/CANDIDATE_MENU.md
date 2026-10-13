# Candidate menu by situation

The sidebar follows the member's journey and stage. The rules are in
`src/lib/journey/menu.ts` (tested in `src/test/menu.test.ts`); labels, icons,
badges and the Gmail, LinkedIn, Skills and Membership locks are in
`src/components/dashboard/DashboardNav.tsx`.

## Show, lock, or hide

- **Show**: the tool helps in this situation.
- **Locked**: the tool turns on when the member's situation changes. It stays in the menu, muted, and a
  "Turn on more tools" box under the menu says why it is off and updates the status in one click (the same
  change as "Has anything changed?"). This is how people learn why they should keep their status current.
- **Hidden**: the tool will not matter in this situation or the next one.

Locks for something the member can go and do (connect Gmail, take the Skills Assessment) are separate and
keep their own reason.

## The pillars of a search

| Pillar | What it holds |
|---|---|
| Personalize | Search strategy, profile, assessments, Market Reality Report |
| Prove it | References, portfolio, marketing plan (LinkedIn) |
| Search and apply | Find a job, companies, interview prep, offer, market intelligence |
| Network | Contacts, community, inbox, recruiters, universities and college benefits |
| Learn | Skills, courses, videos |
| Coaching | Executive coach (always visible) |
| Work now | Interim, fractional, advisory |
| Support and settings | Stats, benefits, I'm Struggling, membership, help, privacy |

There is no "on a break" state: someone who is not looking is managing their career, with a plan, a menu
and emails of their own. (The old paused value is still in the database enum and reads as Managing your career.)

Compared with the five first proposed (personalize, learn, search and apply, network, work), two were added:
**Prove it**, because references, the Dossier and the résumé are the evidence the whole product runs on, and
**Coaching**, which is a service available in every situation, not a kind of learning.

## By situation

| Situation (stage) | Menu |
|---|---|
| Exploring | Personalize, Prove it, Network, Learn, Coaching first. Job-search tools **locked** until they start applying. |
| Preparing | Adds Search and apply. Offer tools locked until they are interviewing or have an offer. |
| Active (applying, interviewing, offer) | Everything. Nothing locked. |
| Managing your career (growing in a job, not looking right now, or going for a promotion before applying elsewhere) | "Manage your career" first: know your worth, prove your results, build skills, practice the hard conversation, know how you work. Job tools locked. |
| Landed | "Manage your career": first 90 days, know your worth, thank the people who helped, the Offer Bonus claim. Job-search tools hidden. |

## Not built yet

There is no dedicated pay-benchmark or review-prep page; "Know your worth" opens the Market Reality Report
and "Practice the hard conversation" opens Interview Prep, the closest existing pages.
