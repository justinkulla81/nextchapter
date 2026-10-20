# The partner experience: a spouse or girlfriend in your corner

Status: **design and preview screens with sample data only.** Nothing here is wired to real data
or live. The supporter feature that exists today is described at the end.

Builds on your own roadmap in `IDEAS.md` ("Supporter extensions") and keeps every guardrail in it.

## The idea

A job search is hard on the person doing it and on the person living with them. A partner wants to
help but does not know how, and the usual ways (asking "any news?", watching progress) make
things worse. This gives a partner a calm, private place that does three things well:

1. They can see that you are putting in effort, in numbers only.
2. You can tell them, in one tap, what kind of day it is.
3. They get small, concrete ways to help, and a way to say "I did this".

You control all of it, per person, and can change or pause it any time.

## Principles

- **Opt-in on both sides.** Nothing is shared until you invite someone and pick what they see.
- **Numbers, never specifics.** A partner never sees job titles, companies, people you contacted,
  messages, rejections or "behind schedule" language.
- **Your signal, not their request.** A partner cannot ask you for an update. You choose to tell them.
- **No surveillance.** No read receipts, no "last seen", no streaks, no comparison.
- **Always warm.** Quiet weeks read as "just getting going", never as a problem.
- **Not in confidential mode.** On either side, as today.
- **Pause is one tap.** And automatic when your plan is "taking a break".

## The member's side: "Your people"

One page: https://launchyournextchapter.com/dashboard/supporters (renamed "Your people"; sits under
Network in the menu, in the entry "References and supporters").

1. **What would help today?** Four buttons: *Listen*, *Space*, *Distract me*, *Cheer me on*. Shown only
   when someone is at the Close level. They see it today only; it clears at midnight. Skipping it is fine.
2. **In your corner.** Each person with their relationship, what they can see, and the last thing they
   did ("Sent a cheer yesterday"). **Pause** and **Change** on each row.
3. **Invite someone.** The primary action, top right. Three questions in order: who are they (Partner,
   Family, Friend, Coach), what can they see (three levels below), name and email. Choosing Partner
   suggests the Close level. They get an email and a private page, no account needed.

Home also shows, once, after your first week: "Want someone in your corner?" as the one note.

### The three levels

| Level | What they can do and see |
|---|---|
| Cheers only | Send you a cheer. See nothing about your search. |
| Weekly update | The weekly note: minutes, days active, actions done, messages sent. Numbers only. (Today's behavior.) |
| Close | The weekly update, plus what you need today, three ways to help, and wins you choose to share. |

## The partner's side: their private page

Reached from the invite email, no login. Mobile first.

1. **"Justin's week"**: one warm sentence and four numbers.
2. **Send a cheer**: starter chips ("Proud of you", "Dinner is on me"), a text box, one orange button.
   This is the page's one primary action.
3. **What Justin needs today**: only if he tapped something. Otherwise: "Justin hasn't asked for anything
   today. A warm hello is always welcome."
4. **Ways to help this week**: three small, specific ideas, each with **I did this**. Tapping it sends
   Justin a short, warm note. No pressure either way.
5. **Instead of "Any news?"**: three better openers. Plus: "It is fine to need a break yourself."
6. A footer that says exactly what they can and cannot see, with **Pause these updates** and
   **Stop receiving them**.

### Ways to help

Chosen from a short library by what your week looks like and how you like to be coached
(pushed hard, casual, supported). Examples: take a household task off your plate tonight; offer to be a
15-minute practice interviewer; plan something fun that has nothing to do with work; keep the
weekend free of search talk. Three a week at most.

## Later phases

- **Wins you share.** One tap to tell your people about a win: first interview, 5 conversations,
  Candidate+. They can only react.
- **Ask for help.** A specific small ask they can answer or ignore ("Could you read my cover note?").
- **Partner as a NextChapter member.** They accept the invite inside the app and see the same page
  under "Supporting Justin". The invite email never reveals whether an account exists.
- **Runway conversation** (opt-in, partner level only). You share a calm frame: "Runway: about 7 months.
  Aim: start by March." Uses the savings figure from the career timeline's pause what-if. Includes a
  10-minute money check-in guide.
- **Buddy pairs**, co-working hours and practice-interview swaps, as already in `IDEAS.md`.

## Data changes (additive)

- `SearchSupporter`: add `relationship`, `shareLevel`, `pausedUntil`, `acceptedAt`, and an optional link to
  a member account for the later phase.
- New `SupporterNeed` (your daily signal, one per day), `SupporterGesture` (their "I did this"), and
  `SupporterWin` (wins you share).
- One module reads these, enforced by a test, like the career timeline does. Employers, colleges,
  coaches and recruiters never see any of it.

## Limits and rules

- Up to three people (as today). One cheer a day per person. Three ways to help a week. One weekly
  email, and none after you land a job except a short congratulations.
- A supporter can leave at any time. Removing someone stops everything immediately.
- Confidential mode on either side switches the whole thing off.

## Events (PostHog)

`supporter_invite_submitted` (relationship, level), `supporter_level_changed`, `supporter_paused`,
`supporter_need_set` (need), `supporter_gesture_sent`, `supporter_cheer_sent`,
`supporter_page_viewed`, `supporter_win_shared`.

## Build order

1. Relationship, levels and pause, plus the redesigned partner page. Needs three new columns.
2. "What would help today?" and "I did this".
3. Wins and ask-for-help.
4. Supporter as a member.
5. Runway conversation.

## Decisions for you

1. **Name.** "Supporter" (today) or "Your people"? I used "Your people" for the page and "Partner" as a
   relationship.
2. **Default level for a partner.** I chose Close, with the choice shown before sending.
3. **Milestones.** Should a partner ever see "interview landed" or "offer"? I would only ever show wins
   you choose to share.
4. **Runway.** Include the money conversation at all? It is the most sensitive piece.
5. **The weekly email** is off today because it emails people outside NextChapter. Turn it on?

## What exists today

Page https://launchyournextchapter.com/dashboard/supporters: name and email, up to 3 people, an invite
email, a private page with four numbers and a cheer box. The weekly note exists but is switched off
(`SUPPORTER_DIGEST_ENABLED`). No relationship, no levels, no pause, no daily signal, no "I did this".
