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

A **workforce board** appears for every board the member says they work with
(`WorkforceBoardConnection`, set on "Your local market"). The connection is the
member's own. The board sees nothing about them by name; if they choose "count me,
anonymously, if I find work", an anonymous count of members who found work can
include them, and only once at least 10 members are included
(`src/lib/workforce/area-brief.ts`).

## Rules the tests hold

- No one ever sees mood check-ins.
- Only a coach sees how someone likes to be coached.
- Outplacement never sees an individual.
- A choice made with one affiliation never changes what another sees.

## Screening answers

The Screening Questions (non-compete, fired for cause, drug test, background check) are
**never shown to any affiliation**. They only sharpen the member's own weekly plan
(`redFlagGuidance` in `src/lib/journey/engagement.ts`): read your non-compete, prepare an honest
answer about leaving, know which roles require a background check or drug test. Using them
with anyone else would need the member's explicit, per-item consent and a legal review.

## Area brief for boards and members

`getAreaBrief` (`src/lib/workforce/area-brief-data.ts`) gives a board, or a member in its state, the
anonymous picture of the area: NextChapter members by journey and stage and how many started a job
in the last 90 days, layoffs filed, roles open on the NextChapter job board, local news and (boards only)
funding a board could apply for. Counts below 10 are never shown, a hidden cell hides its next
smallest neighbour too, and members in Confidential Search Mode or with a Stealth or Locked
privacy tier are not counted. Members see it on "Your local market"; the admin sees what a board would
receive on the workforce board page. Nothing is sent to a board automatically: a monthly job (`/api/cron/board-brief-drafts`) only drafts a brief
per board with a director or chair email into the mailing queue, for you to approve and address.
For a local board, member counts cover the board's counties when at least 10 members live there,
and the state otherwise.
