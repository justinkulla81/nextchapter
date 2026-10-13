# NextChapter Higher Ed Module — V1 Build Spec

For: Claude Code, working in the NextChapter repo. Status: V1 (platform only). V2 (programs, cohorts, WIOA) is out of scope; see §13. First customer: Washington & Jefferson College (W&J), ~11,000 alumni. Build everything multi-tenant; nothing W&J-specific in code.

> **Implementation notes (kept current as HE steps land)** — see the end of this file.

## 0. How to work on this spec

- Read the codebase first. The database is Supabase Postgres (project "NextChapter - Claude"). Schema lives in `prisma/schema.prisma`, pushed with `prisma db push` (no migration history; see `docs/DATABASE_SCHEMA.md`). Don't run raw DDL against production.
- Build in the order in §12 (HE-01 → HE-14), one prompt at a time. Stop after each, summarize what changed and how to verify it.
- Reuse before you add (§1). If an existing table already holds the data, extend it.
- Don't modify unrelated candidate pages. The Candidate workspace is the existing candidate portal, branded; the only additions are in §5.1.
- Security is server-side. Hiding a menu item is never the only protection (§4, §8).
- Terminology is locked: Market Reality Grade, Search Action Plan, Weekly Search Sprint, Dossier, Support Network, Bearing.
- Mark all seed and demo rows `isSampleData = true`.

## 1. Scope

V1 adds an institution (college) layer:

- One portal per institution at `/i/[slug]`, with five role workspaces: Candidate, Alumni Relations, Development, Career Services, Employer.
- A left role rail shows only the workspaces a person holds. A demo admin sees all of them.
- CSV-based CRM exchange: roster in, gifts in, updates out.
- A resettable demo tenant.

### Existing tables to reuse

| Need | Existing table(s) | V1 use |
|---|---|---|
| Candidate record and tools | CandidateProfile, WeeklySprint, MarketRealitySnapshot, HireabilityReport, Resume, Dossier tables | Unchanged; Candidate workspace is the existing portal, branded |
| Global roles | RoleGrant | Platform roles; institution staff roles live in a new table |
| B2B tenant pattern | OutplacementEmployerOrg, OutplacementOrgUser, OutplacementContract, OutplacementSeat | Copy (org → users with roles → seats), including the invite-token flow |
| Employment and outcomes | MemberEmployment, Company | A reported new job creates a MemberEmployment row |
| Layoff data | WarnNotice (companyMatchStatus), LayoffNewsMention | Match notices to members' employers |
| Schooling | EducationEntry | Suggest institution matches; class year |
| Coaching | Coach, CoachSession, CoachRateCard, PlanCatalogEntry | Premium coaching packages; counselor sessions |
| Employers | EmployerProfile, EmployerSeat, (employer job posts) | Employer workspace |
| Audit | AdminAccessLog, ConfidentialModeChangeLog | "View as" logging; staff views of members |
| Analytics | AnalyticsEvent, CandidateLoginEvent | Engagement event sources |
| Scholarships | ScholarshipApplication | Pattern for Resilience Fund awards |
| Email | Existing send pipeline (CandidateEmailSendLog) | Outreach sends |

Not in V1: programs, cohorts, enrollment, attendance, coursework, payers/billing, WIOA, faculty/teaching, workforce boards, live CRM connectors, LMS, SIS, earnings forecasts.

## 2. Tenancy and roles

- Institution is the tenant.
- Staff get workspace roles through InstitutionUser.
- Candidates (alumni, students, parents) are linked through InstitutionMember.
- Employers get access through InstitutionEmployer (link to an existing EmployerProfile) plus their EmployerSeat.
- One person can be both staff and a member.

| Role (InstitutionUserRole) | Workspace(s) | Can do |
|---|---|---|
| INSTITUTION_ADMIN | All V1 workspaces + Settings | Branding, roster import, users, exports |
| ALUMNI_RELATIONS | Alumni Relations | Outreach, mentors, coaching packages, engagement |
| DEVELOPMENT | Development | ROI dashboard, flags, Resilience Fund, CRM exports |
| CAREER_SERVICES | Career Services | Caseloads, check-ins, student tools, employer packages |
| EMPLOYER_RELATIONS | Career Services (Employers tab) | Approve employers, manage packages |
| VIEWER | Assigned workspace, read-only | Reports only |

Member affiliations: ALUM, STUDENT, PARENT, STAFF_ALUM. Every member gets the Candidate workspace.

**Role resolution (every request):** load the session user; collect InstitutionUser roles (revokedAt null), InstitutionMember (→ Candidate), EmployerSeat on an APPROVED InstitutionEmployer (→ Employer), RoleGrant nc_admin; build the rail from those only. nc_admin: demo tenant sees every workspace; real tenant must use "View as," which writes an AdminAccessLog row with a reason. A candidate can belong to several institutions; the slug selects one; each sees only what the candidate consented to share with it.

## 3. New tables (21)

All have id, createdAt, updatedAt, RLS enabled.

| Table | Key columns | Notes |
|---|---|---|
| Institution | slug (unique), name, programBrandName, logoUrl, accentColor, domains[], ssoProvider, ssoConfig, tier (CAREER/ADVANCEMENT/INSTITUTION), alumniCount, includedSeats, licenseStartAt/EndAt, enabledFeatures, givingUrl, isDemo, isSampleData | enabledFeatures: graceDays (60), fiscalYearStartMonth (7), engagementWeights, wioa:false |
| InstitutionUser | institutionId, userId, invitedEmail, fullName, role, inviteToken, invitedAt, acceptedAt, revokedAt | OutplacementOrgUser shape; one row per role |
| InstitutionMember | institutionId, candidateId (null until claimed), externalId, email, first/lastName, affiliation, classYear, degree, major, matchMethod (ROSTER_EMAIL/EDUCATION_ENTRY/SSO/MANUAL), status (IMPORTED/INVITED/CLAIMED/ACTIVE/OPTED_OUT), doNotContact, lastKnownEmployer, lastKnownTitle, isActiveSeat, seatActivatedAt, isSampleData | Unique (institutionId, externalId), (institutionId, email) |
| InstitutionConsent | memberId, scope (SHARE_ENGAGEMENT, SHARE_OUTCOME, SHARE_SEARCH_DETAIL_WITH_CAREER, SHARE_DOSSIER_WITH_EMPLOYERS), granted, changedAt, source | Engagement/outcome default on; other two off. History rows, never overwrite |
| TransitionFlag | memberId, state (IN_TRANSITION/PLACED_GRACE/CLEARED), doNotSolicit, source (SELF_REPORTED/LAYOFF_MATCH/COUNSELOR/CHECK_IN/IMPORT), startedAt, placedAt, graceEndsAt, clearedAt | At most one open flag per member |
| LayoffMatch | institutionId, warnNoticeId, memberId, companyId, matchedAt, outreachStatus (NEW/SENT/SKIPPED), outreachSendId | Unique (warnNoticeId, memberId) |
| OutreachCampaign | institutionId, type (LAYOFF/WELCOME/CHECK_IN/GRATITUDE/MENTOR_INVITE/CUSTOM), subject, body (merge fields), createdBy, scheduledAt, sentAt | |
| OutreachSend | campaignId, memberId, email, sentAt, openedAt, clickedAt, claimedAt, claimToken | claimedAt = member created/claimed an account from this send |
| EngagementEvent | institutionId, memberId, type, caseCategory (VOLUNTEER/EXPERIENTIAL/PHILANTHROPIC/COMMUNICATION), points, occurredAt, sourceTable, sourceId | Unique (sourceTable, sourceId, memberId, type) |
| InstitutionMentor | institutionId, memberId, industries[], functions[], maxCallsPerMonth, isActive | |
| MentorRequest | mentorId, requesterMemberId, note, status (REQUESTED/ACCEPTED/DECLINED/COMPLETED), requestedAt, completedAt | |
| InstitutionGift | institutionId, memberId?, externalConstituentId, amountCents, giftDate, fund, appeal, importRunId | Imported, read-only |
| CrmExchangeRun | institutionId, direction (IMPORT_ROSTER/IMPORT_GIFTS/EXPORT_UPDATES), fileName, rowCount, errorCount, status, errorsJson, createdBy, startedAt, completedAt | |
| OutcomeReport | memberId, memberEmploymentId, reportedAt, helpedByInstitution, shareMilestone, gratitudeStatus (NONE/PENDING/APPROVED/SENT/CLICKED/DISMISSED) | |
| ProspectFlag | institutionId, memberId, type (PROMOTION_VP_PLUS/EXIT/NEW_EMPLOYER_MATCHING_GIFT), sourceMemberEmploymentId, detectedAt, exportedAt, dismissedAt | |
| ResilienceFund | institutionId, name, description, goalCents, raisedCents, isActive | raisedCents by hand or imported |
| FundAward | fundId, memberId, awardType (COACHING_PACKAGE/PREMIUM_SEAT), valueCents, status, awardedBy, awardedAt | |
| CaseloadAssignment | institutionId, counselorId (InstitutionUser.id), memberId, assignedAt, endedAt | |
| CheckIn | memberId, kind (M6/M18/M24/CUSTOM), dueAt, status (SCHEDULED/SENT/RESPONDED/SKIPPED), responseJson | From classYear (May graduation unless known) |
| InstitutionEmployer | institutionId, employerProfileId, status (PENDING/APPROVED/REJECTED), packageTier (BASIC/FEATURED), featuredUntil, approvedBy, approvedAt | |
| InstitutionPurchase | institutionId, memberId, planCatalogEntryId, stripePaymentIntentId, amountCents, revenueShareBps, purchasedAt | Premium coaching, spouse seats |

Changes to existing tables: `CoachSession.institutionId` (nullable). An institution scope on employer job posts (nullable; reuse an existing scoping mechanism if one exists).

## 4. Portal shell and routing

| Path | Workspace | Required role |
|---|---|---|
| /i/[slug] | Redirect to first workspace | Any |
| /i/[slug]/candidate/* | Candidate (existing pages, branded) | InstitutionMember |
| /i/[slug]/alumni/* | Alumni Relations | ALUMNI_RELATIONS or INSTITUTION_ADMIN |
| /i/[slug]/development/* | Development | DEVELOPMENT or INSTITUTION_ADMIN |
| /i/[slug]/career/* | Career Services | CAREER_SERVICES, EMPLOYER_RELATIONS or INSTITUTION_ADMIN |
| /i/[slug]/employer/* | Employer | EmployerSeat on an APPROVED InstitutionEmployer |
| /i/[slug]/settings/* | Branding, users, roster, exports | INSTITUTION_ADMIN |
| /i/[slug]/claim/[token] | Alumni claim/sign-up from outreach | Public |

- `workspaceNav` config: one typed object keyed by workspace (label, icon, requiredRoles, release 'V1'|'V2', homePath, tabs). The rail renders only entries the user qualifies for. V2 entries (Exec Ed, Teaching, Workforce board) render greyed "Coming" only on demo tenants.
- Branding: the institution layout sets theme variables from logoUrl, accentColor, programBrandName; candidate pages inherit. Every page footer reads "powered by NextChapter."
- Demo mode (isDemo): "Demo mode" banner; "Reset demo data" (nc_admin only); nc_admin sees all workspaces without View-as logging; outbound email goes to a demo outbox page.
- `requireWorkspace(slug, workspace)` in every route handler and server action; reruns role resolution.

## 5. Workspace screens and acceptance criteria

### 5.1 Candidate (additions only)
| Screen | Contents | Done when |
|---|---|---|
| Claim / welcome | Landing from outreach link: brand, pitch, sign up/in, consent summary | New user reaches Search Action Plan in ≤3 steps; member → CLAIMED; OutreachSend.claimedAt set |
| Privacy & sharing | Four consent toggles in plain language; "Who viewed my profile" (workspace + date, no staff names) | Each toggle writes an InstitutionConsent row; staff views reflect it within 1 minute |
| "I'm in transition" / "I got a job" | Two top-bar buttons | Transition opens a TransitionFlag (SELF_REPORTED). Got a job creates MemberEmployment (isCurrent) + OutcomeReport, asks "Did [college] help?", offers milestone sharing |
| Mentors | Browse by industry/function; request a call | Request emails the mentor; accepting reveals contact details to both |
| Coaching | Premium packages from PlanCatalogEntry via Stripe; Resilience Fund awards show as prepaid | Purchase creates InstitutionPurchase and unlocks booking |

### 5.2 Alumni Relations
| Screen | Contents | Done when |
|---|---|---|
| Home | Members, claimed, active seats, in transition; new layoff matches; mentor requests this month | Counts match DB; each links to a filtered list |
| Layoff alerts | LayoffMatch grouped by WARN notice | "Send outreach" sends LAYOFF template to selected members, marks SENT |
| Outreach | Campaigns, template editor with merge fields, send log | Test send to self works; log updates from webhooks |
| Mentors | Roster, invite alumni to mentor, activity | Invite creates OutreachSend; accepting creates InstitutionMentor |
| Members | Searchable roster: name, class year, status, employer, engagement tier; no search details | Filters by class year, status, in-transition |
| Engagement | Score distribution and CASE breakdown by class decade | Totals reconcile with EngagementEvent |

### 5.3 Development
| Screen | Contents | Done when |
|---|---|---|
| ROI dashboard | Giving rate/dollars users vs matched non-users, lift, new donors, reactivated lapsed, Resilience Fund totals | Follows §7; shows date range, group sizes, "as of last gift import" |
| In transition | Open flags: name, class year, since, doNotSolicit badge | No reason/source/search detail; one-click suppression export |
| Signals | ProspectFlag and gratitude-PENDING items | Approve, dismiss or export each |
| Resilience Fund | Settings, awards, donor report (PDF) | Report shows seats funded, alumni placed, opted-in stories |
| CRM exchange | Upload roster/gift CSVs; download updates CSV; run history | Per-row errors; reruns idempotent on externalId |

### 5.4 Career Services
| Screen | Contents | Done when |
|---|---|---|
| Caseload | Assigned members, last activity, sprint status (if consented), next check-in | Assign/unassign; counselors see only their own, director sees all |
| Check-ins | M6/M18/M24 with responses | Automatic sends; "looking" opens TransitionFlag (CHECK_IN) and alerts the counselor |
| Student tools | Invite students/recent grads (STUDENT) | Invites create members and OutreachSends |
| Employers | Approve employers, package tier, featured-until | Approval lets that employer's seats into Employer workspace |

### 5.5 Employer
| Screen | Contents | Done when |
|---|---|---|
| Employer page | Branded page shown to the institution's candidates | Visible in Candidate job area |
| Post a role | Post scoped to the institution; FEATURED pins to top | Visible only to that institution's members |
| Shared Dossiers | Members with SHARE_DOSSIER_WITH_EMPLOYERS on; request intro | Candidate notified; can accept or decline |

## 6. Key flows

**6.1 Roster import.** Upload CSV (§9) → validate rows → upsert InstitutionMember by externalId, falling back to email → match CandidateProfile by exact email, else suggest by EducationEntry.schoolNameNormalized + graduation year (effective only after candidate confirms) → new rows IMPORTED → log CrmExchangeRun with per-row errors.

**6.2 Layoff alert.** After each WARN sync, run over new WarnNotices with companyMatchStatus = MATCHED. Match members whose current MemberEmployment.companyId = WarnNotice.companyId, or whose normalized lastKnownEmployer matches. Create LayoffMatch (NEW), notify Alumni Relations. AMBIGUOUS notices go to an admin review list. LAYOFF copy asks rather than assumes ("If you're affected, [college] has your back"). Never auto-flag on a WARN match; a LAYOFF_MATCH flag opens only when the member confirms.

**6.3 TransitionFlag lifecycle.**
```
(no flag) --self-report | confirmed layoff | counselor | check-in "looking"--> IN_TRANSITION (doNotSolicit = true)
IN_TRANSITION --"I got a job"--> PLACED_GRACE (doNotSolicit = true, graceEndsAt = placedAt + graceDays)
PLACED_GRACE --graceEndsAt passes (nightly)--> CLEARED (doNotSolicit = false)
CLEARED --new layoff or self-report--> new IN_TRANSITION flag
Member can close their own flag any time → CLEARED
```

**6.4 Outcome to CRM.** "I got a job" → MemberEmployment (isCurrent) + OutcomeReport; flag → PLACED_GRACE. Nightly ProspectFlags: PROMOTION_VP_PLUS when title/seniorityBand reaches VP+ (VP, SVP, EVP, Chief, President, Head of …); NEW_EMPLOYER_MATCHING_GIFT whenever the employer changes. Updates export includes employer/title/start date only with SHARE_OUTCOME on.

**6.5 Gratitude ask.** Flag reaches CLEARED and helpedByInstitution true → gratitudeStatus PENDING (Development Signals). Approve → GRATITUDE template with givingUrl, status SENT; clicks → CLICKED. A resulting gift is attributed when the next gift import matches the member.

## 7. Metric definitions

Fiscal year per `enabledFeatures.fiscalYearStartMonth` (default 7).

| Metric | Definition |
|---|---|
| Platform user | Member CLAIMED or ACTIVE with ≥1 TOOL_USE, COACHING_SESSION or MENTOR_CALL event in the period |
| Comparison group | Never-claimed members, matched to users by class decade and prior-FY giving |
| Giving rate | Share of a group with ≥1 gift in the FY |
| Lift | (users' rate this yr − last yr) − (comparison this yr − last yr), in points |
| Gift dollars | Sum of users' gifts dated after their claim date |
| New donors | Users whose first-ever gift is after their claim date |
| Reactivated lapsed donors | Gave before, not last FY, gave this FY after claiming |
| Active seat | Completes a Market Reality Grade or creates a Search Action Plan in the license year; sets isActiveSeat, counts against includedSeats |

Always show group sizes. If either group < 30, show raw numbers and hide lift.

Engagement score: rolling 12 months; weights in `enabledFeatures.engagementWeights`.

| Event | CASE category | Points | Cap |
|---|---|---|---|
| LOGIN | Communication | 1 | 4/month |
| OUTREACH_CLICK | Communication | 1 | 4/month |
| MILESTONE_SHARED | Communication | 2 | — |
| TOOL_USE | Experiential | 2 | 8/month |
| COACHING_SESSION | Experiential | 3 | — |
| EVENT | Experiential | 3 | — |
| MENTOR_CALL (mentor) | Volunteer | 5 | — |
| MENTOR_CALL (requester) | Experiential | 2 | — |
| GIFT_PROMPT_CLICK | Philanthropic | 1 | — |
| GIFT (import) | Philanthropic | 10 | 1/fiscal year |

Staff see Low/Medium/High by percentile within the institution, plus CASE breakdown.

## 8. Permissions, RLS and audit

RLS: tables with institutionId readable only by active InstitutionUser of that institution or nc_admin; InstitutionMember also by the member; candidate-owned tables keep current policies (staff get no new direct access); InstitutionConsent writes from the member only; TransitionFlag writes from the member, an assigned CAREER_SERVICES counselor, or system jobs.

Consent-applying views (security definer, filtered by role and consent) — staff read candidate data only through these:

| View | Exposes | Gate |
|---|---|---|
| v_member_directory | Name, class year, status, employer, title, engagement tier | Any staff; employer/title only if SHARE_OUTCOME |
| v_member_transition | Flag state, doNotSolicit, since date | DEVELOPMENT, ALUMNI_RELATIONS, CAREER_SERVICES; Development never sees reason/source |
| v_caseload_activity | Sprint status, last activity, coaching dates | Assigned counselor, only if SHARE_SEARCH_DETAIL_WITH_CAREER |
| v_employer_dossiers | Dossier summary and link | Approved employer seats, only if SHARE_DOSSIER_WITH_EMPLOYERS |
| v_roi_inputs | Aggregates only | DEVELOPMENT, INSTITUTION_ADMIN |

Never visible to any staff: assessment item responses, Bearing results, coaching notes, email/calendar activity details, resume content (except through a consented Dossier).

Audit: every staff view of an individual member writes AdminAccessLog (surface = workspace); consent changes keep history; "Who viewed my profile" reads AdminAccessLog.

## 9. Integrations

CSV only for CRM exchange in V1.

Roster import:
```csv
external_id,email,first_name,last_name,affiliation,class_year,degree,major,employer,title,do_not_contact
100234,jsmith@example.com,Jordan,Smith,ALUM,2009,BA,Economics,Example Corp,Director of Operations,false
```
Required: external_id, email, first_name, last_name, affiliation. do_not_contact=true rows imported but never emailed.

Gifts import:
```csv
external_id,gift_date,amount,fund,appeal
100234,2026-11-03,100.00,Annual Fund,Giving Day 2026
```

Updates export:
```csv
external_id,email,employer,title,start_date,in_transition,do_not_solicit,prospect_flag,engagement_tier,last_active
100234,jsmith@example.com,New Example Inc,VP Operations,2027-01-15,false,true,PROMOTION_VP_PLUS,High,2027-01-20
```
Employer/title/start date only with SHARE_OUTCOME on.

| System | V1 approach |
|---|---|
| SSO | Google and Microsoft now; SAML via Supabase Auth SSO only if a college requires it |
| Email | Existing pipeline; per-institution sender name and reply-to; webhooks set openedAt/clickedAt |
| Stripe | Existing account; Checkout for coaching packages and spouse seats; metadata.institutionId; revenue-share report from InstitutionPurchase |
| WARN | Existing sync; only MATCHED notices create LayoffMatch; AMBIGUOUS → admin review list |
| Handshake | V1: students/recent grads via roster CSV, affiliation STUDENT |

## 10. Demo tenant seed

"Demo College" (slug `demo`), configurable branding, every row isSampleData. "Reset demo data" deletes demo rows and reruns the seed. All names, companies, gifts fictional.

| Data | Count | Details |
|---|---|---|
| Institution | 1 | isDemo, tier ADVANCEMENT, alumniCount 11,000, includedSeats 330 |
| Staff users | 5 | INSTITUTION_ADMIN, ALUMNI_RELATIONS, DEVELOPMENT, CAREER_SERVICES, EMPLOYER_RELATIONS |
| Members | 200 | Class years 1975–2026; 60 claimed, 140 imported; 8 open flags |
| Hero alum | 1 | Mid-career operations leader, imported (not claimed), employed at the WARN company |
| WARN notice | 1 | Fictional regional employer, MATCHED to a Company, 3 member matches incl. hero |
| Gifts | 400 | Two FYs; users' giving rate rises more than comparison, so lift renders |
| Mentors | 12 | Across 6 industries |
| Employer | 1 | Alum-led, APPROVED, 2 posted roles |
| Caseload | 15 | Recent grads with M6/M18 check-ins, one answered "looking" |
| Outcome reports | 6 | Two gratitude-PENDING, one with PROMOTION_VP_PLUS |

Also seeds engagement events and outreach sends so every screen has data.

Demo script: (1) Alumni Relations sees the WARN alert and sends outreach. (2) Hero claims, takes the Market Reality Grade, sees the Search Action Plan. (3) Development sees the hero In transition with do-not-solicit, no details. (4) Career Services sees the hero in caseload; books a session. (5) Employer posts a role and requests an intro to a shared Dossier. (6) Hero reports a new job. (7) After grace ("advance time" control), gratitude ask ready, export shows the new employer, ROI dashboard counts the hero.

## 11. Non-functional requirements

- Staff list pages < 2s with 15,000 members (server-side pagination).
- All CSV imports, nightly jobs and engagement writers idempotent.
- Each HE prompt adds tests for its acceptance criteria. RLS tests cover staff with the role, staff without it, the member, another member, anonymous.
- Every job logs start/end/row counts (WarnSyncRun / CrmSyncRun pattern).
- Accessibility: keyboard navigable; labels on all inputs; color never the only signal (do-not-solicit has icon and text).

## 12. Build sequence

| # | Name | Builds | Done when | Needs |
|---|---|---|---|---|
| HE-01 | Schema | 21 tables, enums, indexes, RLS, CoachSession.institutionId | Migration applies cleanly; RLS tests pass | — |
| HE-02 | Consent views and audit | Five views, AdminAccessLog writes, requireWorkspace | Staff without consent sees no search detail through any path | HE-01 |
| HE-03 | Portal shell | /i/[slug] routes, workspaceNav, rail, branding, demo banner | Each seeded role sees exactly its workspaces | HE-02 |
| HE-04 | Settings | Branding, staff invites/roles, graceDays, fiscal year, givingUrl | Admin invites a Development user who accepts and lands in Development | HE-03 |
| HE-05 | Roster and gift import | CSV upload, validation, upsert, matching, CrmExchangeRun | 200-row roster and 400-row gift file import with per-row errors | HE-04 |
| HE-06 | Candidate additions | Claim/welcome, Privacy & sharing, transition/got a job, OutcomeReport, flag nightly job | Hero can claim, flag, report a job, see flag clear after grace (time-travel test) | HE-05 |
| HE-07 | Engagement pipeline | EngagementEvent writers, nightly scoring | Scores and CASE breakdown reconcile with events | HE-06 |
| HE-08 | Alumni Relations | Home, Members, Layoff alerts, Outreach + webhooks + demo outbox | WARN match → outreach → claim end to end | HE-07 |
| HE-09 | Mentors | InstitutionMentor, MentorRequest, candidate mentor screen | Request → accept → complete writes engagement for both | HE-08 |
| HE-10 | Development | ROI dashboard, In transition, Signals, Resilience Fund, CRM exchange + updates export | Lift renders from seed; export matches §9 | HE-07 |
| HE-11 | Career Services | Caseload, check-in scheduler, student invites, employer approvals | M18 "looking" opens a flag and alerts the counselor | HE-06 |
| HE-12 | Demo seed and reset | §10 seed, reset, "advance time" | Demo steps 1–4, 6, 7 run on a fresh reset | HE-03–HE-11 |
| HE-13 | Employer | InstitutionEmployer link, scoped/featured posts, shared Dossiers, intro requests | Approved employer sees only opted-in Dossiers; demo step 5 works | HE-11 |
| HE-14 | Coaching purchases | Stripe checkout, InstitutionPurchase, revenue-share report, FundAward as prepaid | Test purchase unlocks booking; report splits revenue | HE-10 |

## 13. V2 (do not build now; design so it fits)

New tables: Program, Track, Cohort, Session, Enrollment, Payer (SELF_PAY, EMPLOYER, RESILIENCE_FUND, WIOA_VOUCHER, BOARD_CONTRACT, PELL), Invoice, Attendance, Assessment, Credential, placement proof (extends OutcomeReport), WageMatch, VendorFee. Candidate "My program". Workspaces: Exec Ed, Teaching. Employer capstones, interview commitments, sponsored seats. `enabledFeatures.wioa` unlocks the Workforce board workspace, voucher tracking, state performance export, encrypted SSN vault.

V1 must not block this: data-driven workspace config, extensible EngagementEvent types, no hard-coded five workspaces.

## 14. Open decisions (defaults until changed)

| Decision | Default |
|---|---|
| Grace period after placement | 60 days |
| Engagement and outcome sharing | On by default; search detail and Dossier off |
| Minimum group size for ROI lift | 30 |
| SAML SSO at launch | No; Google/Microsoft |
| Demo branding | Neutral "Demo College," rebranded per meeting |
| Extra CRM export columns | None until W&J specifies |

---

## Implementation notes

### HE-01 (schema)

- **Where things live:** models and enums at the end of `prisma/schema.prisma`; RLS in `prisma/sql/higher-ed-rls.sql` (apply with `npm run he:rls` after every `db push` touching these tables; idempotent); RLS tests in `scripts/higher-ed/verify-rls.ts` (`npm run verify:he-rls`, runs in one rolled-back transaction).
- **RLS is defense in depth.** Every public table in this DB already has RLS on with zero policies, and the app reads through Prisma as the owner (bypasses RLS). The policies only matter for a direct Supabase-client read; `requireWorkspace` (HE-02) is the real gate.
- **Employer posts are `ExclusiveJobPosting`, not `JobPosting`.** In this codebase `JobPosting` is a candidate's own tracked application. Employer-submitted roles are `ExclusiveJobPosting` (`source = 'employer'`, `submittedByEmployerId`), so the institution scope is `ExclusiveJobPosting.institutionScopeId`. It had no existing institution scoping (its audienceTier/distribution model is candidate-tier based).
- **One open flag per member** is enforced by `TransitionFlag.openFlagMemberId` (`@unique`, set to memberId while open, null once CLEARED). Prisma can't express a partial unique index, and a hand-made one would be dropped by the next `db push`.
- **Staff read candidate-owned rows (TransitionFlag, OutcomeReport, InstitutionConsent, CheckIn) only through HE-02 views,** not directly. The exception is an assigned CAREER_SERVICES counselor for TransitionFlag and CheckIn. This is stricter than "every table with institutionId is staff-readable," because those tables carry reason/source/response detail Development must never see.
- **CaseloadAssignment** RLS: the counselor's own rows plus INSTITUTION_ADMIN (the "director"), not all staff.
- **Columns added beyond §3,** each needed by a later step: `InstitutionMember.claimedAt` (§7 "after claim date"), `InstitutionMember.lastKnownEmployerNormalized` (§6.2 matching), `TransitionFlag.reason` (§8 "Development never sees the reason"), `OutreachSend.providerMessageId` (§5.2 webhook updates), `InstitutionGift.dedupeKey` (gift file has no gift id; makes reruns idempotent), `MentorRequest.respondedAt`, `ProspectFlag.approvedAt` (§5.3 approve), `FundAward.redeemedAt`, `CheckIn.sentAt/respondedAt`, `isSampleData` on all 21 tables (simplifies demo reset).
- **Consent defaults are not stored.** With no InstitutionConsent row for a scope, the §14 default applies; rows are only written on change.
- CASE category enum is named `CaseEngagementCategory`.

### Portal consolidation and alignment with the Product Design doc (Oct 10–11, 2026)

Aligned to "NextChapter Higher Ed Module — Product Design" (Claude Doc). Decisions:

- **One portal: `/i/[slug]`.** The separate `/institution` staff portal (2f6bda08) was folded in and removed. Its Alumni jobs and Target companies are tabs, its capability map (`src/lib/institution/permissions.ts`) still authorizes the actions, and its invites land staff in `/i/<slug>` on the main NextChapter login. There's no separate cookie, because one person can be staff and alum.
- **Workspaces:** Candidate, Alumni Relations, Development, Career Services, Teaching, Exec Ed, Employer, Admin (was Settings), plus Workforce board as V2. Tier-gated per the doc's Packaging: Development needs Advancement; Teaching and Exec Ed need Institution. Admins see locked workspaces with the tier that adds them.
- **Coaching (decision):** no college coaching workspace. Members choose and book coaches in the candidate portal (`/dashboard/coaching-match`). A college's own coaches are regular coaches with `Coach.institutionId`: only that college's members are offered them, first. Sessions they log with those members set `CoachSession.institutionId`, and the coach portal says which college they coach for. Inviting someone with the COACH role creates or links their coach profile. College coaches also get the Career Services caseload, as in the doc's permissions table.
- **Search-detail visibility:** the doc's design rule ("the college sees only what the learner shares") is kept over its permissions table. Career staff and coaches see search detail only when the member turns sharing on; coaching notes stay with the coach.
- **Services:** `src/lib/higher-ed/services.ts` replaces `offerings.ts`, matching the doc's service menu. Each service has on/off, audience, owning office and person, free/paid/donor pricing, link, and 30-day usage (card opens via `/i/[slug]/go/[service]` → `he_service_opened`). Switching one on puts its card on the Candidate home for its audiences. Exec Ed's catalog is `PROGRAM_IDEAS` (V2 for cohorts and enrollment).
- **Admin:** a launch checklist, ticked from real data (brand, team, services, roster, coaches, alumni job). Branding (logo and hero upload, color, name, tagline) is editable by the college's admins.
- **Cut:** the Coaching workspace, Local market in Development, the speculative services not in the doc, and VIEWER invites (they need a workspace picker first).

### Release 1, "Live in a day" (HE-04, HE-05, HE-06), Oct 11, 2026

- **HE-04 settings:** Admin › Overview edits the quiet period after a new job (grace days), fiscal-year start and giving page. Branding was already editable. VIEWER seats stay cut until there's a workspace picker.
- **HE-05 imports:** Admin › Roster uploads the roster and gift CSVs (`src/lib/higher-ed/crm-csv.ts` parses and validates; `crm-import.ts` writes). Members upsert on external id (falling back to email); gifts dedupe on constituent, date, amount, fund and appeal, so reruns add nothing. Every run is a CrmExchangeRun listing bad rows by spreadsheet row number. **An import never links a NextChapter account**: that happens only when the alum joins, so the college never sees anyone's NextChapter data before they agree. (This replaces the spec's "match by exact email" step; the EducationEntry suggestion is cut.)
- **HE-06 join:** Admin › Roster sends one branded email per imported alum (batches of 100, with a confirm step; demo colleges only record them). The link `/i/<slug>/join?t=<claimToken>` is the proof of address: "Join" signs them in as that email with a one-time magic link (no password, no second email), then `/i/<slug>/welcome` asks two sharing questions (land a job: on; progress for Career Services: off) and "I'll take a call" (which makes them a mentor), and sends them into NextChapter. Three steps: email, choices, their grade. Without a token, a signed-in person joins only if their login email is on the roster. `CallbackHandler` routes `next=institution-join` only to a `/i/<slug>/welcome` path.
- **Candidate:** a status card ("I'm in transition", "I got a job", "I'm no longer looking"), and Privacy & sharing with four switches (history rows) and "Who viewed my profile". The existing `/dashboard` pages show a slim bar in the college's color with a link back to its portal (`CollegeBar`, looked up from the member's own joined membership, not a cookie).
- **Lifecycle:** `src/lib/higher-ed/transition.ts`. "I got a job" sets the current employment, records an OutcomeReport ("Did <college> help?") and starts the grace period. `/api/cron/higher-ed-nightly` (07:30 UTC) clears ended grace and queues the gratitude ask when the college helped.
- **Tests:** CSV unit tests; `npm run verify:he06` (imports twice, lifecycle, nightly) runs on a throwaway college that it deletes afterward.

### Journeys (Oct 12, 2026)

Every NextChapter member (direct, college alumni, outplacement seats) has a journey (why they're moving) and a stage (how close to applying); see the Journeys tab of the Product Design doc and `src/lib/journey/`. For colleges:

- **Career Services:** the caseload's Situation column shows journey and stage only when the member shares search detail (`v_caseload_activity`).
- **Alumni Relations:** home shows the journey mix as counts only, among joined alumni who share engagement; groups under `MIN_CELL_SIZE` show as "Under 5".
- **Development:** a reported job raises prospect signals (spec §6.4): `PROMOTION_VP_PLUS` for VP-and-up titles and `NEW_EMPLOYER_MATCHING_GIFT` for any new employer, only with outcome sharing on (`raiseProspectSignals` in `transition.ts`). Development home shows how many are waiting; the Signals screen remains HE-10.
- **The portal's buttons and NextChapter check-ins are one system:** "I'm in transition" = journey Laid off; "I got a job" = stage Landed; "I'm no longer looking" = Paused. Going the other way, "I was laid off" anywhere in NextChapter opens the college's transition flag, and Landed starts its grace period (`src/lib/journey/apply.ts`).

### Release 2, outreach that runs itself (HE-07, HE-08, HE-11 check-ins), Oct 13, 2026

Staff approve every send; the system finds who to send to.

- **Nightly** (`/api/cron/higher-ed-nightly`, real colleges only): `matchLayoffs` (WARN notices from the last 180 days against the roster's last-known employer, and against NextChapter employment only for members who share their outcome), `syncEngagement` (EngagementEvent from logins, completed sprint weeks, college coaching, link clicks, shared milestones and gifts; idempotent), `scheduleCheckIns`.
- **Layoff alerts:** grouped by notice; pick, then send or skip. One email per member however many notices match. A match never opens a flag.
- **Check-ins:** M6/M18/M24 from mid-May of the class year, and an annual one in the month set in Admin › Services; due ones are scheduled only while fresh (45 days), never backfilled. Staff approve each batch (Alumni Relations the annual, Career Services the early-career). The email has four answers; `/i/<slug>/checkin/<id>` preselects the clicked one and records it only on "Send my answer", so link scanners can't answer. "Laid off", or a recent grad "starting to look", opens a CHECK_IN flag; both put the member on a caseload (below). Joined members' answers go through `applyJourneyChange`.
- **Waiting for you** (`src/lib/higher-ed/inbox.ts`) on the Alumni and Career homes, and a Monday email per office (`/api/cron/higher-ed-weekly`), sent only when something is waiting.
- **Engagement:** `v_member_engagement` ranks every member who shares engagement (zero is always Low), so tiers mean something with a mostly inactive roster. Alumni Relations › Engagement shows tiers and CASE points by class decade; the directory shows the tier.

### Release 3, Development (HE-10), Oct 13, 2026

- **ROI** (`roi-math.ts`, pure and unit-tested; `roi.ts` loads): spec §7. Users are joined members with a TOOL_USE, COACHING_SESSION or MENTOR_CALL event in the FY; the comparison is never-joined alumni re-weighted to the users' mix of class decade × gave-last-FY. Lift hidden under 30 per group. Shown for this FY so far and last FY, with fund totals.
- **Signals:** approve (goes in the next updates file) or dismiss with undo. Thank-you asks (`gratitude.ts`) need a giving page, are held while a member is do-not-solicit, and link through `/i/<slug>/give`, which marks CLICKED and scores GIFT_PROMPT_CLICK.
- **Resilience Fund:** settings, awards to members in transition (shown prepaid on their Coaching tab), printable donor report (`/i/<slug>/report/fund`, counts only). Marking an award used when they book is not built yet.
- **CRM exchange:** `/i/<slug>/export/updates` (spec §9 columns; outcome fields only with SHARE_OUTCOME; marks approved signals exported and logs EXPORT_UPDATES unless the seat is read-only) and `/export/suppression`. Development can upload gifts.
- **Peer benchmark** (`peers.ts`): College Scorecard/IPEDS from CollegeProfile; same control and level, half to double the enrollment, same state first. `profile.college.unitid` links a college (W&J 216667), else exact name.
- **Give back** card for joined members not in transition; public `/i/<slug>/for-alumni` page (counts only above MIN_CELL_SIZE).

### Release 4, network and employers (HE-09, HE-11, HE-13), Oct 13, 2026

- **Mentors** (`mentors.ts`): directory by industry (title/employer only with outcome sharing), monthly limit, request email to the mentor, accept/decline at `/i/<slug>/mentor/<id>` (token from the email), emails swapped only on accept, "We talked" scores both sides once. Alumni Relations invites in batches of 100 (`/mentor/join`).
- **Alumni jobs** for members: roles scoped to the college, featured employers first, "N alumni work here" (roster employer, or NextChapter employment with consent).
- **Employers** (`employers.ts`): ask at `/i/<slug>/recruit`; Career › Employers approves and sets Basic/Featured with an end date. Approved employers post scoped roles (pending NextChapter review; `addedBy = employer:<profileId>` identifies them) and ask to meet members sharing their Dossier: new `DossierIntroRequest` table (RLS on), email only after the member accepts.
- **Student tools:** first-job invitations for STUDENT and last-five-year alumni.

### HE-12 demo, caseloads and the composer, Oct 13, 2026

- **Demo seed** (`demo-seed.ts`): 200 people (8 students), 60 joined with sample CandidateProfiles (`userId demo-<slug>-<i>`, isSampleData, removed on reset) across every journey; hero alum matched to a **real recent state WARN filing** (referenced, never written: WarnNotice has no sample flag and feeds public layoff pages and the CRM); three FYs of gifts giving a visible lift; 12 mentors; featured employer with roles plus a pending one; 15-grad caseload with M6/M18 check-ins; 6 outcomes; fund awards. No Company or MemberEmployment rows. Demo bar: "Skip ahead 60 days". On a demo, "Preview as alum" acts as `<slug>_member_featured`.
- **Caseloads** (`caseload.ts`): Career › Caseload lists, adds (roster search), moves and removes (confirm); directors see whose is whose. A check-in "looking" or "laid off" auto-assigns to the counselor with the fewest open cases (counselors before coaches). Coaches see their own caseload.
- **Composer** (`composer.ts`): Alumni Relations › Outreach writes an email to an audience (all, joined, not joined, recent grads), with merge-field buttons and an unknown-field check, live preview, "Send a test to me" (demo colleges preview instead), then confirmed batches of 200 that never reach anyone twice; editing locks after the first send. `OutreachCampaign.audience` added.
- **Checks:** `npm run verify:release2|3|4`, `verify:he-demo` (the §10 demo script end to end on /i/demo, then reseeds), `check:he-screens` (renders every workspace screen on the server against a demo college).
- **Still open:** Resend open/click webhooks, paid coaching via Stripe and the revenue-share report, fund award redemption on booking, configurable engagement weights, college SSO.

### College email safety, Oct 13, 2026

- `src/lib/higher-ed/email-events.ts`: the Resend webhook (`/api/webhooks/resend`) checks Higher Ed sends first. Opens and clicks set `OutreachSend.openedAt/clickedAt` (unsubscribe clicks excluded); a permanent bounce or a spam complaint sets `InstitutionMember.emailSuppressedAt/Reason`. Suppressed members are skipped by `sendCampaign` and excluded from every audience, invite, check-in and mentor invitation; a roster import can't clear it (it's separate from `doNotContact`).
- Every college email: the college's "from" name and reply-to (Admin › Overview, `enabledFeatures.email`), a footer link to `/i/<slug>/unsubscribe?t=<token>` (one click to stop; an unsubscribe, not a bounce, can be undone) and RFC 8058 `List-Unsubscribe` + `List-Unsubscribe-Post` (`POST /api/higher-ed/unsubscribe/<token>`). Join invitations now go through `sendCampaign`.
- The CRM updates file adds `email_status`. `npm run verify:email-safety`.

### V2, lean (spec §13), Oct 13, 2026

Built: `Program`, `Cohort`, `Enrollment` (payer: self-pay, employer, Resilience Fund, WIOA voucher, board contract, Pell), `CorporateClient`, `Capstone`; role `WORKFORCE_PARTNER`. `src/lib/higher-ed/programs.ts`.

- **Exec Ed:** Programs (add, edit, cohorts with seats, format and instructor), Enrollments (apply → enroll → complete with the program's credential, or withdraw; payer and client per enrollment; completion scores EVENT engagement with consent), Corporate clients (seats purchased vs used).
- **Teaching:** Courses lists the cohorts faculty teach; Employer capstones (employers propose from their Employer page with interview commitments; faculty approve, start, complete).
- **Candidate:** Programs tab (open cohorts, apply with "I'll pay / my employer / I need help paying") and a "My program" card on home.
- **Workforce board:** only when Admin turns WIOA on (`enabledFeatures.wioa`, feature-gated in `workspacesFor`). WIOA-voucher and board-contract participants with completion, credential and placement (an OutcomeReport within 180 days after completion), CSV at `/i/<slug>/export/wioa`. Employer only with outcome sharing.
- **Not built (deliberately):** SSN vault, invoices and billing, attendance and assessments, wage-record matching, the state performance export, enrolling non-alumni employees of corporate clients (needs a non-alum learner affiliation).
- `npm run verify:v2`; the demo seeds three programs, five cohorts, about 20 enrollments (WIOA completers placed), two clients and three capstones.

### The college at every stage of a move, Oct 13, 2026

The seven journey stages (Exploring → Preparing → Applying → Interviewing → Offer → Landed, and Paused) each get something from the college. `src/lib/higher-ed/lifecycle.ts`, `outcomes-report.ts`, `segments.ts`, `rapid-response.ts`; screens in `screens-lifecycle.tsx`.

- **Stage panel** on the alum's home ("From <college>, for where you are"), from `stageHelp()`: Exploring → outcomes by major, groups, events, programs; Preparing → programs, office hours, mentors; Applying → alumni jobs, intros; Interviewing → an alum inside, office hours; Offer → sanity-check the offer; Landed → share a milestone, give back; Paused → nothing. Plus **program recommendations**: the latest Market Reality report's gap areas and the alum's growth areas matched to `Program.skills`.
- **Candidate › Network:** alumni intros at a company (`AlumniIntroRequest`; targets are joined alumni who share their employer; five open asks at a time; emails on accept), office hours (`OfficeHourSlot`; mentors post slots, alumni book one at a time, two upcoming max), events (`CollegeEvent`, `EventRsvp`), groups (class, major, metro: where at least two work, mentors, milestones), what grads with my major do, and the milestones feed.
- **Engagement:** completed office hours and accepted intros score as MENTOR_CALL for both sides, event check-ins as EVENT (nightly sync, with consent).
- **Alumni Relations:** Events tab (create, RSVP list, check-in, cancel); milestones on home; saved audiences (`Segment`) usable in the composer (`segment:<id>`).
- **Standing out:** public `/i/<slug>/outcomes` (rolling 12 months, counts under MIN_CELL_SIZE withheld, employers only with five or more, by major, peers), Admin › Board report (printable).
- **Exec Ed:** non-alum learners (`InstitutionAffiliation.LEARNER`, never sent alumni email or invites), completion rules per cohort (sessions × attendance % + capstone) blocking "Mark completed", and credentials: `/credentials/<id>` (public verification, Add to LinkedIn) with Open Badges 2.0 JSON at `/api/credentials/<id>`, `/api/credentials/class/<programId>`, `/api/credentials/issuer/<slug>`.
- **Workforce board:** Rapid response (recent WARN filings in the college's region; an offer with a public, rate-limited sign-up at `/i/<slug>/rapid/<id>` that creates WIOA applications, reusing roster emails, else learners) and an Eligible-provider listing helper (CIP, hours, credential type, cost, completion, credential and 180-day placement rates; CSV at `/export/etpl`).
- **Times** typed by staff and mentors are US Eastern (`zonedToUtc`) until colleges can set a time zone.
- **Not built:** AI-drafted outreach (cost per use, needs approval), live CRM and Handshake connectors (need vendor credentials), wage-record matching (needs the SSN decision).
- `npm run verify:lifecycle`.

### Time zone, In-work links, college sign-in, engagement weights, Oct 13, 2026

- **Time zone** (`time-zone.ts`): Admin › Overview picks a US zone (`enabledFeatures.timeZone`); default from the college's state. Events and office hours are typed and shown in it.
- **In-work track links** in the stage panel: Landed → impact log for the first review; Going for a promotion → the promotion plan; Thinking about a move (Exploring) → pay against the market.
- **College sign-in** (`CollegeSignIn`, `sso.ts`): "Continue with Google / Microsoft" on the join and for-alumni pages returns to `/i/<slug>/welcome`, which joins anyone whose sign-in email is on the roster. Microsoft shows only once the Azure provider is enabled in Supabase Auth (read from `/auth/v1/settings`).
- **Engagement weights**: Alumni Relations › Engagement edits points per activity (0–20; the mentor's side of a call is `MENTOR_CALL_MENTOR`) in `enabledFeatures.engagementWeights`. `v_member_engagement` applies them, so history re-scores at once. Monthly caps stay in points.
