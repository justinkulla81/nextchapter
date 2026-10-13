# Several affiliations at once

A member can be connected to more than one organization at the same time:
outplacement paid for by a former employer, a coach, recruiters, one or more
colleges, a workforce board, and a company's hiring funnel. The rules below
are the code in `src/lib/affiliations/visibility.ts`; the Privacy page shows
each member their own connections and what each one sees right now.

## Who owns the journey and stage

The member does. There is one journey and one stage per member
(`CandidateProfile.journey`, `journeyStage`). An affiliation may report a fact
that is true everywhere, and it applies to every affiliation:

- laid off (journey becomes Laid off)
- interviewing, got an offer, started a job (stage changes)

An affiliation may **not** change something that is its own status or the
member's own call. A college's "no longer looking" closes that college's
do-not-solicit flag; it does not move the member to "Managing your career", because
that would change their coach's, outplacement's and weekly plan's view of them.
Only the member moves themselves to "Managing your career", from their own
account or the Saturday check-in (`appliesAcrossAffiliations`, enforced in
`applyJourneyChange`).

## Who sees what

| | Situation | Stage | Activity | Search detail | Dossier | Coaching style | Outcome | Mood |
|---|---|---|---|---|---|---|---|---|
| Coach | by name* | by name* | by name* | by name* | by name* | by name* | by name* | never |
| Outplacement (former employer) | no | no | no | no | no | no | counts only, on opt-in | never |
| College | counts only† | counts only† | counts only† | by name, if shared | by name, if shared | no | by name, if shared | never |
| Recruiters | no | no | no | no | by name, on opt-in | no | no | never |
| Workforce board | no | no | no | no | no | no | counts only | never |
| Employer hiring funnel | no | no | no | no | by name, only what you sent them | no | no | never |

\* after the member agrees to share with their coach.
† only members who share engagement with the college; groups under the minimum size are hidden.

An employer hiring funnel appears on the Privacy page for every employer the
member has chosen to reveal themselves to (`ApprovedEmployer`).

A **workforce board** is defined here but has no member link in the data model:
nothing records that a member is working with a board, and joining one is a
product decision (how a member connects, what the board may see) that has not
been made. It will appear on the Privacy page once that link exists.

## Rules the tests hold

- No one ever sees mood check-ins.
- Only a coach sees how someone likes to be coached.
- Outplacement never sees an individual.
- A choice made with one affiliation never changes what another sees.
