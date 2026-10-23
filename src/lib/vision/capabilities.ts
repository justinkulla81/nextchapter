/**
 * What NextChapter can do, one line each, so the competitor matrix has rows.
 *
 * Statuses are about the code, not about a browser check:
 *   BUILT    the code is in the repo and wired to a page, route or job (evidencePath says where).
 *   PARTIAL  part of it exists, or it works with a stated limit (the description says which).
 *   PLANNED  written down in a spec or ideas file, not built (evidencePath is the document).
 *
 * Every BUILT and PARTIAL evidencePath must exist on disk; src/test/vision-capabilities.test.ts checks.
 * Descriptions say what the product does. They never compare us with anyone: no "only", "first" or "unlike".
 */
import type { CompetitorAreaKey } from './competitor-areas'

export type OurStatus = 'BUILT' | 'PARTIAL' | 'PLANNED'

export interface Capability {
  key: string
  area: CompetitorAreaKey
  name: string
  description: string
  ours: OurStatus
  evidencePath: string
}

const c = (area: CompetitorAreaKey, key: string, name: string, description: string, ours: OurStatus, evidencePath: string): Capability =>
  ({ key, area, name, description, ours, evidencePath })

export const CAPABILITIES: Capability[] = [
  // Job search and job board
  c('job_search', 'job_board', 'Job board', 'A searchable board of openings gathered from employer career sites and job systems.', 'BUILT', 'src/app/dashboard/find-my-job'),
  c('job_search', 'job_fit_score', 'Fit verdict per job', 'Each opening gets one fit verdict with one plain reason, based on the member\'s profile.', 'BUILT', 'src/lib/jobs/job-match.ts'),
  c('job_search', 'job_ghost_risk', 'Ghost-posting risk', 'Flags openings that look stale or unlikely to be filled.', 'BUILT', 'src/lib/jobs/ghost-risk.ts'),
  c('job_search', 'job_ai_exposure', 'AI exposure on each opening', 'Shows how much AI use is observed in the occupation of the opening, from the Anthropic Economic Index.', 'BUILT', 'src/lib/jobs/job-ai-view.ts'),
  c('job_search', 'job_pay_vs_market', 'Offered pay against market', 'Compares the pay an opening offers with market pay for the role.', 'BUILT', 'src/lib/market/offered-wage-match.ts'),
  c('job_search', 'job_higher_pay_roles', 'Roles that pay more', 'Points to nearby roles that pay more for the same skills.', 'PARTIAL', 'src/lib/market/ai-pay-premium.ts'),
  c('job_search', 'job_skill_gap', 'Skill gap per job', 'Lists the skills an opening asks for that the member has not shown yet.', 'BUILT', 'src/lib/jobs/job-skill-gap.ts'),
  c('job_search', 'job_who_to_contact', 'Who to contact at the company', 'Suggests people to reach at the employer, starting with the member\'s own contacts.', 'BUILT', 'src/lib/jobs/who-to-contact.ts'),
  c('job_search', 'job_tracker', 'Application tracker', 'A list of the jobs a member is pursuing with their status.', 'BUILT', 'src/lib/jobs/my-jobs.ts'),
  c('job_search', 'job_email_tracking', 'Application tracking from Gmail and Calendar', 'Reads connected Gmail and Calendar to log applications, replies and interviews.', 'BUILT', 'src/app/api/cron/gmail-sync/route.ts'),
  c('job_search', 'job_alerts', 'Fresh job alerts', 'Emails new matching openings to members.', 'BUILT', 'src/lib/jobs/fresh-job-alerts.ts'),
  c('job_search', 'job_likely_openings', 'Likely openings not yet posted', 'Signals from filings and news about companies likely to hire before a posting exists.', 'BUILT', 'src/lib/likely-openings/index.ts'),
  c('job_search', 'job_scam_watch', 'Scam watch', 'Checks job emails and postings for signs of a scam and warns the member.', 'BUILT', 'src/lib/scam-shield/assess-job-posting.ts'),
  c('job_search', 'market_reality_report', 'Market reality report', 'A graded report on how the member\'s search is likely to go against the market, with the reasons.', 'BUILT', 'src/lib/scoring/market-reality/compute.ts'),
  c('job_search', 'search_strategy', 'Search strategy', 'Questions and diagnosis that turn into a plan for the search.', 'BUILT', 'src/app/dashboard/search-strategy'),

  // Career exploration and pivots
  c('career_exploration', 'pivot_paths', 'Career pivot paths', 'Nearby occupations with pay, growth, skills in common, gaps and local openings.', 'BUILT', 'src/app/dashboard/pivot-paths'),
  c('career_exploration', 'pivot_exposure', 'Pay and AI exposure on pivots', 'Shows the change in pay and AI exposure side by side for each pivot.', 'BUILT', 'src/lib/skills/pivot-exposure.ts'),
  c('career_exploration', 'career_timeline', 'Career story timeline', 'A visual timeline of school, work, ventures, pauses and learning, with doors the member could open. Needs a database table that is applied separately.', 'PARTIAL', 'src/lib/career-story/events.ts'),
  c('career_exploration', 'local_market_view', 'Local market view', 'Hiring, pay and layoffs for the member\'s own metro area.', 'BUILT', 'src/app/dashboard/local-market'),
  c('career_exploration', 'move_plan', 'Relocation move plan', 'Compares metro areas a member or a couple is considering by jobs, pay and cost.', 'BUILT', 'src/lib/partner-search/move-plan.ts'),

  // Resume and applications
  c('resume', 'resume_analysis', 'Resume analysis', 'Scores a resume and explains what a reviewer is likely to notice at a glance.', 'BUILT', 'src/lib/scoring/resume-analysis/compute.ts'),
  c('resume', 'resume_studio', 'Resume studio', 'Drafts per target role with writing checks and a keyword check.', 'BUILT', 'src/app/dashboard/resume/studio'),
  c('resume', 'resume_walkthrough', 'Resume walkthrough', 'A guided, bullet-by-bullet rewrite session.', 'BUILT', 'src/lib/walkthrough/session.ts'),
  c('resume', 'linkedin_review', 'LinkedIn profile review', 'Review of the member\'s LinkedIn profile and headshot.', 'BUILT', 'src/app/dashboard/linkedin'),
  c('resume', 'work_samples', 'Work samples and portfolio', 'A place to keep and share samples of work, with imported reviews.', 'BUILT', 'src/app/dashboard/work-samples'),

  // Interview prep and negotiation
  c('interview_prep', 'interview_prep_pack', 'Interview prep per job', 'Likely questions and talking points generated for a specific opening.', 'BUILT', 'src/lib/jobs/generate-interview-prep.ts'),
  c('interview_prep', 'interview_practice_feedback', 'Practice answer feedback', 'Evaluates a written practice answer and says how to improve it.', 'BUILT', 'src/lib/interview-prep/evaluate-practice-answer.ts'),
  c('interview_prep', 'negotiation_advice', 'Offer negotiation advice', 'Advice on what to ask for when an offer arrives.', 'BUILT', 'src/lib/jobs/generate-negotiation-advice.ts'),
  c('interview_prep', 'counter_offer_check', 'Counter-offer evaluation', 'Evaluates a counter offer against the member\'s goals and the market.', 'BUILT', 'src/lib/negotiation/evaluate-counter-offer.ts'),
  c('interview_prep', 'review_raise_prep', 'Review and raise preparation', 'Builds the case for a review, raise or promotion for people who are employed.', 'BUILT', 'src/lib/review-prep/case.ts'),

  // Networking
  c('networking', 'contacts', 'Contacts', 'A contact list with strength, last touch and follow-up due dates.', 'BUILT', 'src/app/dashboard/network/contacts'),
  c('networking', 'weekly_outreach_plan', 'Weekly outreach plan', 'A weekly list of people to contact with a hook and an ask for each.', 'BUILT', 'src/lib/network/weekly-outreach.ts'),
  c('networking', 'follow_up_reminders', 'Follow-up reminders', 'Reminders when a contact is due for a follow-up.', 'BUILT', 'src/lib/network/needs-follow-up.ts'),
  c('networking', 'backchannel_match', 'Backchannel introductions', 'Matches a member with people who can speak for them inside a target company.', 'BUILT', 'src/lib/network/backchannel.ts'),
  c('networking', 'supporter_invite', 'Supporter invite', 'A member invites a spouse, partner or friend to get a weekly effort note and send cheers.', 'BUILT', 'src/lib/supporters/supporters.ts'),
  c('networking', 'partner_invite', 'Partner search invite', 'A member invites a spouse or partner to search together and share a short list of places, each keeping their own search.', 'BUILT', 'src/lib/partner-search/partner.ts'),

  // Learning
  c('learning', 'learning_plan', 'Learning plan', 'A plan of courses matched to the role and the skill gap.', 'BUILT', 'src/lib/learning/build-learning-plan.ts'),
  c('learning', 'course_catalog', 'Course catalog', 'A catalog of courses the plan draws from.', 'BUILT', 'src/lib/learning/courses.ts'),
  c('learning', 'skill_gap_suggestions', 'Suggestions from skill gaps', 'Suggests what to learn from the gap between a member and the postings they want.', 'BUILT', 'src/lib/skills/skill-gap-suggestions.ts'),
  c('ai_reskilling', 'ai_skill_market', 'AI skills in the market', 'Shows which AI skills employers ask for in the member\'s field.', 'BUILT', 'src/lib/skills/ai-skill-market.ts'),
  c('ai_reskilling', 'ai_at_work', 'AI at work for a role', 'Shows how much of a role\'s tasks AI is already used for.', 'BUILT', 'src/lib/skills/ai-at-work.ts'),

  // Fractional and gig
  c('fractional', 'interim_roles', 'Interim and project listings', 'Listings for interim, project and independent work.', 'BUILT', 'src/lib/interim-work/listings.ts'),
  c('fractional', 'independent_toolkit', 'Independent work toolkit', 'Guidance and a launch plan for people starting independent work.', 'BUILT', 'src/lib/gig-directory/interim-launch-plan.ts'),
  c('fractional', 'fractional_marketplace', 'Fractional talent marketplace', 'A public, opt-in list of people available for fractional work, with employer intros.', 'PLANNED', 'IDEAS.md'),

  // Community
  c('community', 'community_feed', 'Community feed', 'Posts, replies and groups among members.', 'BUILT', 'src/lib/community/community-feed.ts'),
  c('community', 'layoff_cohorts', 'Layoff cohorts', 'Groups of members laid off from the same employer.', 'BUILT', 'src/lib/community/layoff-cohort.ts'),
  c('community', 'sms_nudges', 'Text-message nudges', 'Opt-in text reminders for accountability.', 'PLANNED', 'IDEAS.md'),

  // Benefits and money help
  c('benefits', 'benefits_finder', 'Benefits finder', 'Matches a member with benefits and programs they may qualify for.', 'BUILT', 'src/lib/benefits/match.ts'),
  c('benefits', 'unemployment_guides', 'Unemployment benefit guides', 'Public state-by-state guides to unemployment benefits.', 'BUILT', 'src/app/unemployment-benefits'),
  c('benefits', 'benefits_network', 'Higher education benefits network', 'Listings of tuition and benefit offers from participating schools.', 'BUILT', 'src/lib/benefits-network/listings.ts'),

  // Assessments and evidence
  c('assessments', 'skills_assessment', 'Skills assessment', 'A skills inventory and assessment hub for members.', 'BUILT', 'src/app/dashboard/skills-assessments'),
  c('assessments', 'reference_collection', 'Structured reference collection', 'Collects structured references from past managers and colleagues.', 'BUILT', 'src/lib/references/aggregate-performance.ts'),
  c('assessments', 'dossier_evidence', 'Dossier of evidence', 'Builds evidence of traits such as thoroughness and communication from what the member does.', 'BUILT', 'src/lib/dossier/evidence-traits.ts'),
  c('assessments', 'effort_unlock', 'Effort-based unlock', 'Minutes of real search work unlock the level that recruiters can see.', 'BUILT', 'src/lib/unlocks/ladder.ts'),
  c('assessments', 'confidential_mode', 'Confidential search mode', 'Hides the member from recruiters and employers until they choose to show themselves.', 'BUILT', 'src/lib/confidential-mode.ts'),

  // Coaching
  c('coaching', 'coach_matching', 'Coach matching', 'Matches a member with a coach.', 'BUILT', 'src/lib/coach/matching.ts'),
  c('coaching', 'coach_booking', 'Session booking', 'Members book sessions with a coach, with video links on the shared calendar.', 'BUILT', 'src/lib/coach/booking/service.ts'),
  c('coaching', 'coach_notes', 'Coaching notes and summaries', 'Session notes with an automatic summary.', 'BUILT', 'src/lib/coach/note-summary-service.ts'),
  c('coaching', 'coach_pre_session_brief', 'Pre-session brief', 'A short brief on the client before each session.', 'BUILT', 'src/lib/coach/pre-session-brief.ts'),
  c('coaching', 'coach_impact_report', 'Coaching impact report', 'Shows how a coach\'s clients\' search measures changed.', 'BUILT', 'src/lib/coach/impact-report.ts'),
  c('coaching', 'coach_caseload', 'Coach caseload view', 'A coach sees all clients and who needs attention.', 'BUILT', 'src/lib/coach/caseload.ts'),
  c('coaching', 'ai_coach', 'AI coach chat', 'A coach that replies from the member\'s own data, disclosed as AI.', 'BUILT', 'src/lib/coach/generate-reply.ts'),

  // Outplacement and layoff support
  c('outplacement', 'op_enrollment', 'Seat enrollment', 'An employer enrolls people into seats, one by one or by CSV.', 'BUILT', 'src/lib/employer/outplacement-enrollment.ts'),
  c('outplacement', 'op_roster', 'Roster', 'A live roster of enrolled people and their status.', 'BUILT', 'src/lib/employer/outplacement-roster.ts'),
  c('outplacement', 'op_scorecard', 'Outcome scorecard', 'Aggregate outcomes for a program without naming individuals.', 'BUILT', 'src/lib/employer/outcome-scorecard.ts'),
  c('outplacement', 'op_reporting', 'Program reporting', 'Reporting and a printable quarterly review for the buyer.', 'BUILT', 'src/lib/employer/outplacement-reporting.ts'),
  c('outplacement', 'op_compliance_pack', 'Compliance pack', 'Documentation that a severance support obligation was offered.', 'BUILT', 'src/lib/employer/format-compliance-pack.ts'),
  c('outplacement', 'op_seat_continuity', 'Access after the contract ends', 'A participant keeps their account and work after the seat ends.', 'BUILT', 'src/lib/employer/seat-continuity.ts'),

  // Retention and internal mobility
  c('retention', 'ret_career_growth', 'Career growth seats', 'Seats for current staff with growth metrics for the employer.', 'BUILT', 'src/lib/employer/career-growth-metrics.ts'),
  c('retention', 'ret_internal_roles', 'Internal roles', 'Open roles inside the member\'s own company.', 'BUILT', 'src/app/dashboard/internal-roles'),
  c('retention', 'ret_company_courses', 'Company-sponsored courses', 'Courses an employer sponsors for its staff.', 'BUILT', 'src/app/dashboard/company-courses'),

  // Employer hiring tools
  c('employer_hiring', 'hire_roles', 'Roles', 'An employer opens roles and defines what it is looking for.', 'BUILT', 'src/app/talent/(app)/roles'),
  c('employer_hiring', 'hire_candidate_inbox', 'Candidate inbox', 'Candidates who applied or were introduced, in one place.', 'BUILT', 'src/app/talent/(app)/candidates'),
  c('employer_hiring', 'hire_scorecards', 'Interview scorecards', 'Panel scorecards with a side-by-side comparison.', 'BUILT', 'src/lib/talent/scorecards.ts'),
  c('employer_hiring', 'hire_analytics', 'Hiring analytics', 'Funnel and activity numbers for an employer\'s hiring.', 'BUILT', 'src/lib/talent/hiring-analytics.ts'),
  c('employer_hiring', 'hire_no_experience_contests', 'Skills contests for entry-level hiring', 'Employers run short contests and rank entrants on what they can do.', 'BUILT', 'src/app/noexperience'),

  // Recruiters and staffing
  c('recruiters', 'rec_firm', 'Recruiter firm accounts', 'A firm with several recruiters under one account.', 'BUILT', 'src/lib/recruiter/firm-invite.ts'),
  c('recruiters', 'rec_candidate_search', 'Candidate search', 'Recruiters search opted-in candidates.', 'BUILT', 'src/app/recruiters/(app)/search'),
  c('recruiters', 'rec_introductions', 'Introductions', 'Recruiters request an introduction and the member accepts or declines.', 'BUILT', 'src/lib/recruiter/introductions.ts'),
  c('recruiters', 'rec_submissions', 'Submissions and placements', 'Tracks candidates submitted to clients and placements made.', 'BUILT', 'src/lib/recruiter/submissions.ts'),
  c('recruiters', 'rec_ats_export', 'ATS export', 'Exports candidates in a form an applicant tracking system can import.', 'BUILT', 'src/lib/recruiter/ats-export.ts'),
  c('recruiters', 'rec_webhooks', 'Signed webhooks', 'Sends signed event calls to a firm\'s own systems.', 'BUILT', 'src/lib/recruiter/webhooks.ts'),

  // Higher-education career services and alumni
  c('higher_ed', 'he_alumni_network', 'Alumni members and network', 'A college\'s alumni roster and network pages.', 'BUILT', 'src/lib/higher-ed/students.ts'),
  c('higher_ed', 'he_mentoring', 'Mentoring', 'Matches alumni mentors with students and alumni.', 'BUILT', 'src/lib/higher-ed/mentors.ts'),
  c('higher_ed', 'he_events', 'Events', 'Alumni events and registrations.', 'BUILT', 'src/lib/higher-ed/community.ts'),
  c('higher_ed', 'he_giving', 'Giving and the resilience fund', 'Alumni giving tied to outcomes.', 'BUILT', 'src/lib/higher-ed/fund.ts'),
  c('higher_ed', 'he_outcomes_report', 'Career outcomes report', 'A public outcomes report and outcomes by major, with small counts withheld.', 'BUILT', 'src/lib/higher-ed/outcomes-report.ts'),
  c('higher_ed', 'he_roi_dashboard', 'ROI dashboard', 'A development-office view of engagement and results.', 'BUILT', 'src/lib/higher-ed/roi.ts'),
  c('higher_ed', 'he_career_caseload', 'Career services caseload', 'Staff see their caseload and the students who need help.', 'BUILT', 'src/lib/higher-ed/caseload.ts'),
  c('higher_ed', 'he_internships', 'Internship tracking', 'Tracks internships and recruiting by target companies.', 'BUILT', 'src/components/higher-ed/InternshipTracking.tsx'),

  // Workforce-system software
  c('workforce_system', 'wf_participants', 'Participants and programs', 'Training programs with cohorts, learners and payers.', 'BUILT', 'src/lib/higher-ed/programs.ts'),
  c('workforce_system', 'wf_wioa_report', 'WIOA participant report', 'Reports completion, credential and placement for people in training on WIOA vouchers, with a CSV download.', 'BUILT', 'src/lib/higher-ed/programs.ts'),
  c('workforce_system', 'wf_member_companies', 'Member companies', 'Employers that work with a college or board.', 'BUILT', 'src/lib/higher-ed/employers.ts'),
  c('workforce_system', 'wf_layoff_alerts', 'Layoff alerts for a region', 'Alerts when employers in a region file layoff notices.', 'BUILT', 'src/lib/higher-ed/layoffs.ts'),
  c('workforce_system', 'wf_rapid_response', 'Rapid response offers', 'A public sign-up offer to workers affected by a layoff, becoming applications.', 'BUILT', 'src/lib/higher-ed/rapid-response.ts'),
  c('workforce_system', 'wf_warn_data', 'WARN notice data', 'Collects WARN layoff notices from state sources.', 'BUILT', 'src/lib/warn/sync.ts'),
  c('workforce_system', 'wf_funding_opportunities', 'Funding opportunities', 'Finds grants and contracts a provider could apply for. One federal source still needs an API key.', 'PARTIAL', 'src/lib/funding-opportunities/sync.ts'),

  // Labor market data
  c('labor_data', 'ld_occupation_trends', 'Occupation trends', 'Demand and pay trends by occupation.', 'BUILT', 'src/lib/market/occupation-trends.ts'),
  c('labor_data', 'ld_ai_exposure', 'AI exposure by occupation', 'Observed AI use by occupation from the Anthropic Economic Index.', 'BUILT', 'src/lib/aei/exposure.ts'),
  c('labor_data', 'ld_public_layoffs', 'Public layoff tracker', 'A public tracker of layoff notices by state and company.', 'BUILT', 'src/lib/warn/public-tracker.ts'),
  c('labor_data', 'ld_jobs_report', 'Jobs reports', 'Published reports on white-collar employment.', 'BUILT', 'src/app/reports'),

  // Admin and platform
  c('platform', 'plat_roles', 'Roles and permissions', 'Staff roles with different access inside a customer portal.', 'BUILT', 'src/lib/institution/permissions.ts'),
  c('platform', 'plat_audit_log', 'Audit log', 'A record of who did what in a customer portal.', 'BUILT', 'src/lib/higher-ed/audit.ts'),
  c('platform', 'plat_sso', 'Single sign-on', 'Customer staff and members sign in with Google, and with Microsoft where it is switched on.', 'PARTIAL', 'src/lib/higher-ed/sso.ts'),
  c('platform', 'plat_branding', 'Customer branding', 'A customer\'s logo and colors on its portal.', 'BUILT', 'src/lib/institution/branding.ts'),
  c('platform', 'plat_api', 'Roster API', 'A keyed HTTP endpoint to push and read a roster. It covers rosters and nothing else.', 'PARTIAL', 'src/app/api/v1/census/route.ts'),
  c('platform', 'plat_csv_exports', 'CSV exports', 'Downloads of rosters, placements and reports as CSV.', 'BUILT', 'src/lib/admin/csv-export.ts'),
  c('platform', 'plat_crm_exchange', 'CRM exchange', 'Imports a customer\'s CRM roster into the portal.', 'BUILT', 'src/lib/higher-ed/crm-import.ts'),
  c('platform', 'plat_member_data_export', 'Member data export', 'A member can download their own data.', 'BUILT', 'src/app/api/export-data/route.ts'),
  c('platform', 'plat_portal_links', 'Connections between portals', 'Portals share data where the member has agreed.', 'PLANNED', 'docs/what-you-asked-for.md'),
]

export const CAPABILITY_KEYS = new Set(CAPABILITIES.map((x) => x.key))

export function capabilitiesInArea(area: string): Capability[] {
  return CAPABILITIES.filter((x) => x.area === area)
}

export function capabilityCountsByArea(): Record<string, number> {
  const out: Record<string, number> = {}
  for (const x of CAPABILITIES) out[x.area] = (out[x.area] ?? 0) + 1
  return out
}
