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
