# Old cards still on the redesign: Network, Account, Help and related pages

Audit of the redesign branch of each page (`CANDIDATE_REDESIGN=on`). "Old" means a legacy card, badge or chip, a dropdown
with two to four options, a shaded or dashed box, an uppercase or grey label, or small text that the page contract
(`docs/candidate-redesign.md`) and `design-principles.md` rule out. Legacy output is unchanged: every change below is a
`redesign` prop or a sibling component, used only when the redesign is on.

Shared pieces added: `ChoiceButtons` and `ChoiceField` (2 to 4 options are adjacent buttons, 5 or more a dropdown, rule in
`src/lib/redesign/choice.ts`), `Callout` (a notice as a sentence), `stepCard` (Card parts that become a plain section with a
serif sentence-case heading). Pure copy and logic is in `src/lib/redesign/network-account.ts` and `text.ts`, tested in
`src/test/redesign-network-account.test.ts`.

| Page | What was old | What replaced it | Behind Show more |
|---|---|---|---|
| network/contacts | `ContactDirectoryTable` (7 columns, 4 yes/no dropdowns, sort headers), "Your employer" and "Candidate/Coach" tags, `SuggestedContactsCard` card, orange/green import button, "+N pts" pill, accordion with numbered circles, template and guide cards, Title Case scope tabs | `ContactDirectory` rows (name, who they are, one fact, Star and Write actions); filters and sort as buttons under one "Filter and sort (N on)" control; tags became sentences; `SuggestedContactsCard redesign` rows; `ImportContacts` plain steps; `CopyableTemplateCard`, `GuideCard`, `CsvImportForm`, `NextChapterMembersSection` redesign looks; scope as pills | Import, templates, other lists (opens on `?buildList=1`) |
| network/contacts/[id] | `OutreachCoach` card with two dropdowns, uppercase headings, text-xs; `ContactProfileView` tags and boxed communications; bare star icon | `OutreachCoach redesign` (purpose, draft, one orange Open in Gmail), `ContactDetails` sentences, labeled Star, confirmed Remove | Ask size, reason to write, offer, why it works, follow-up, details and history |
| network/follow-ups, this-week, recruiter-requests | Already rows. Recruiter requests had one orange button per row | Both answers quiet buttons with events | n/a |
| references | Request form card with dropdowns, quote cards with uppercase theme | Form without card, relationship as a dropdown (8 options), optional detail folded; quote rows | Optional detail, what references say |
| supporters | Invite form with `bg-orange`, small inputs | Redesign form, `bg-action`, body-size labels | n/a |
| groups | Bordered wrapper around uppercase "Alumni networks" list | `AlumniNetworkOptions redesign` rows with the reason, empty sentence | n/a |
| my-coaching | `RedeemCoachCodeForm` default button | Redesign form, quiet button | Code entry (already folded) |
| coaching-match | Gender (4) and feedback (3) dropdowns, rating chips, bordered coach cards with a college chip | `CoachPreferencesForm` buttons; 12 statements folded; `CoachShortlistRedesign` rows with one reason, college in the fact line | Twelve statements, other reasons and industries |
| coaching-form | `CoachingOnboardingForm` already uses buttons up to 4 and a dropdown past that | No change needed | n/a |
| coach-dossier | Uppercase "Coaching Notes" label, reassignment form last on a long page | Serif section, reassignment folded | Want a different coach |
| recruiter-report | Completeness ring, boxed lock-icon list, dashed empty state | One sentence and a bar, `EmptyCard`; the handout document is unchanged on purpose | Which sections are filled |
| webinars | `WebinarListItem` bordered card with green "Registered" tag; bordered "empty" boxes | Row with host, time, one action and a sentence; plain empty lines | Already folded |
| skills-assessments, support | Already redesigned. Support disclaimer was text-xs | Disclaimer text-sm | n/a |
| company-courses | text-xs status buttons, bordered empty boxes | Pill status buttons, `EmptyCard` | n/a |
| stats | Tile labels text-xs, week labels 10px | text-sm and text-xs. `?view=all` is the deliberate archive of badges and leaderboards and is left as it is | Archive link |
| search-strategy | Seven grey Title Case Card headers, gap (4), company size (4) and location (4) dropdowns, "Not answered yet" pills | `stepCard` serif sentence-case headings; those three as buttons; pills as words (`#gapDuration` and `#remotePreference` anchors kept) | More about your search |
| benefits | `RunwayCard` card, checklist green wash, bordered pressure form | Redesign runway section, ticked rows, form without border | Full guide |
| benefits-network | Six filter dropdowns, six grey tag chips and a dashed box per offer, disabled "Members only" button | `Filter offers (N on)` with buttons or dropdowns by option count; offer row (title, offer, why it fits, one line of facts, one action); non-members get a link and a sentence | Full cost, rate, report; filters |
| profile | Already clean; extracted to `ProfileHubRedesign` so it can be previewed | No visual change | n/a |
| complete-profile | Bordered boxes, "Start - 25 pts" buttons, "+5 pts" chips | Rows with "worth N minutes", chips removed, form cards without borders. The forms inside (`ProfileConfirmForm` and similar) keep their own look | Rest of the list |
| privacy | Status pill on Google connection, 5-way tier button row with Recommended, Currently set and Unlocks tags, bordered opt-in cards, 3 tier cards with tags, hover-only reason for a disabled save | Sentences for every status; tier as a dropdown plus one sentence on what it does; opt-ins without cards; `ChoiceField` for email volume; reasons said in the page; serif headings; action window as a dropdown (5 options) | Situation, email, coach access, data, account, danger zone |
| community | Orange-tinted post box, uppercase Feed and Filters labels, post kind and moderation as small caps, orange count badges, "+N pts" tag, "Peers like you" badge counts, lone x to leave a community, card-in-card cohort | `PostRow` rows, `PostForm redesign`, group and community choices as buttons with a labelled Leave, confirmed Remove, gates as `EmptyCard` and `Callout` | Filters, cohort, groups to join, rankings, encouragement |
| messages (community tab=messages) | Pill tabs with orange count badges, "NEW" badges, 10px times, raw selects for attaching a résumé | Circle switches say "(2 new)", `ThreadList` with "New reply waiting", bubbles at body size, composer with résumé as buttons | n/a |
| membership | Bordered subscription and sign-up cards, capitals status word, small grey labels | Plain sections and sentences; priority booking explained when unavailable | Other plans |
| documents | Card with outlined status badge, dashed `EmptyState`, small upload form | Row with a verdict and its reason, `EmptyCard`, upload form at body size | Older requests |
| help | Status pill on each conversation | State as a line of text | Earlier conversations |
| scam-watch | Dashed `EmptyState`, bordered small alert | `EmptyCard` with the action, alert at body size | Handled alerts |
| benefits-network propose, profile sub-pages, assessments, `CuratedVideoCard` captions | Not on the first view of a listed page | Not changed (see skipped below) | n/a |

## Skipped, and why

- `stats?view=all`: the full archive is the point of that page; it stays behind the "See every stat" link.
- Forms inside `complete-profile` and the privacy fold (`WhatTheySeeSection`, leaderboard and community toggles, `MyRecruitersSection`) are already toggles or buttons with no badges; they were checked, not changed.
- `CuratedVideoCard` and `PodcastCard` captions stay text-xs; the same card is used on legacy pages.

## Previews with sample data

Run the app and open `/dev-preview/...` (see `docs/candidate-mockups.md`). Screenshots are in `docs/screenshots/network-account/`.
