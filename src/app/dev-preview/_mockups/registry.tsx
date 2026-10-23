import type { ComponentType } from 'react'
import { HomeToday, ProgressBuilt, ProgressTimeline } from './home'
import { NetworkOverviewMock, CloseCircle } from './network'
import { FindJobs } from './jobs-find'
import { FindJobsLive, MyJobsLive, MyJobsEmptyLive } from './jobs-find-live'
import { FindUnpostedLive, FindUnpostedEmptyLive, FindUnpostedErrorLive, FindIndependentLive, FindIndependentNewLive, FindIndependentOfferLive, FindResourcesLive, FindResourcesOptedInLive } from './jobs-find-parts-live'
import { FindUnposted, FindIndependent, FindResources, MyJobs, Companies, CompanyProfile, MarketYours, MarketPay, MarketLocal, MarketPivot, Interviews, Offers } from './jobs-more'
import { PayChartLive, CompanySectionsLive, CompanyCultureEmptyLive, InterviewTabsLive, InWorkLive, FormsLive } from './jobs-leftovers-live'
import { CompaniesLive, MarketLive, PayLive, ResumeLive, StrengthsLive, LocalLive, InterviewsLive } from './jobs-redesign-live'
import { PeopleYouKnow, AlumniGroups, IndustryFunction, RecruitersCircle, NetworkThisWeek, Messages } from './network-more'
import { LearnSkills, LearnVideos, ProfileMock, ResumeMock, WhyHireMe, HowIWork, WhatRecruitersSee, DocumentsMock, MembershipMock, HelpTalk, HelpScams, HelpQuestions } from './learn-help'
import { HomeEntrepreneur, HomeTimeOff, HomeCareerChange, HomeFractional, HomeStalled, CheckIn, TailoredForYou } from './personalization'
import { TuneQuestion, TuneDone, DeepDiveIntro, ReceiptHome, ReceiptNetwork } from './questionnaire'
import { TrackRecordRound, TrackRecordIntro, TrackRecordDone, HowIPerformRound, HowIPerformDone } from './rounds'
import { CandidatePlusUnlock, WeeklyEmail, OnboardingSituation, FirstWeek, EmptyJobs, EmptyNetwork, EmptyEffort, OnboardingMoney, AccountMoney } from './moments'
import { MoneyRunway, MoneyDeadlines, MoneyEntrepreneur } from './money'
import { CareerStoryReal } from './career-story'
import { SearchStrategySimple } from './strategy'
import { StrategyNegotiationLive, StrategyNegotiationEmptyLive } from './strategy-negotiation-live'
import { SearchStrategyApplicationMatch, ApplicationMatchFew } from './application-match'
import { AdminSkillsMatch } from './admin-skills-match'
import { MarketReportShort } from './report-short'
import { WorkHelpMock } from './work-help'
import { ExposureMarketReport, ExposureSearchStrategy, ExposurePivots, ExposureLearn } from './ai-exposure'
import { PortalHeaders } from './portal-headers'
import { PartnerInvite, PartnerYourPeople, PartnerMoving } from './partner'
import { OtherPathsNeedLive, OtherPathsBusyLive } from './other-paths-live'
import { BuyPlanLive, BuyPlanNewLive, BuyFindLive, BuyFinancingLive, BuyTrainingLive } from './buy-business-live'
import { BenefitsNetworkLive, CoachMatchLive, CommunityLive, ContactDetailLive, ContactsFiltersLive, ContactsLive, MessagesLive, PrivacyLive, ProfileLive } from './network-account-live'

const CoachMatchShortlistLive = () => <CoachMatchLive step="shortlist" />
const ContactsEmptyLive = () => <ContactsLive empty />

export interface Mockup {
  /** The address after /dev-preview/. */
  path: string
  place: string
  title: string
  /** The live page(s) this replaces or absorbs. */
  replaces: string
  Component: ComponentType
}

export const MOCKUPS: Mockup[] = [
  { path: 'jobs/market/ai-exposure-report', place: 'Jobs', title: 'AI exposure: your market reality', replaces: 'the “AI is reshaping this work” line in the market report', Component: ExposureMarketReport },
  { path: 'home/tailored/ai-exposure-strategy', place: 'Home', title: 'AI exposure: search strategy', replaces: 'the “AI skills” line under open roles', Component: ExposureSearchStrategy },
  { path: 'learn/path/ai-exposure-pivots', place: 'Learn', title: 'AI exposure: career pivots', replaces: 'the “AI task exposure” line on each pivot role', Component: ExposurePivots },
  { path: 'learn/learn/ai-exposure', place: 'Learn', title: 'AI exposure: what to learn next', replaces: 'the generic “AI Training” description line', Component: ExposureLearn },
  { path: 'home/today', place: 'Home', title: 'Your week', replaces: '/dashboard', Component: HomeToday },
  { path: 'home/progress/built', place: 'Home', title: 'Effort and results: what you’ve built', replaces: '/dashboard/stats (badges and leaderboards removed)', Component: ProgressBuilt },
  { path: 'home/progress/timeline', place: 'Home', title: 'Effort and results: your search timeline', replaces: 'new', Component: ProgressTimeline },
  { path: 'network/circles/overview', place: 'Network', title: 'Your network: all circles', replaces: '/dashboard/network', Component: NetworkOverviewMock },
  { path: 'network/circles/close', place: 'Network', title: 'Close circle', replaces: '/dashboard/supporters, /dashboard/my-coaching', Component: CloseCircle },
  { path: 'jobs/find/jobs', place: 'Jobs', title: 'Find a job: list and detail', replaces: '/dashboard/find-my-job, /dashboard/jobs/ID', Component: FindJobs },
  { path: 'jobs/find/unposted', place: 'Jobs', title: 'Find a job: not posted yet', replaces: 'Likely openings on /dashboard/find-my-job', Component: FindUnposted },
  { path: 'jobs/find/independent', place: 'Jobs', title: 'Find a job: independent work', replaces: 'Independent work toolkit on /dashboard/find-my-job', Component: FindIndependent },
  { path: 'jobs/find/resources', place: 'Jobs', title: 'Find a job: resources', replaces: 'Job boards, résumé book, guides on /dashboard/find-my-job', Component: FindResources },
  { path: 'jobs/mine', place: 'Jobs', title: 'My jobs', replaces: '/dashboard/find-my-job?tab=my_jobs', Component: MyJobs },
  { path: 'jobs/find/jobs-live', place: 'Jobs', title: 'Find a job: the built list and detail (sample data)', replaces: 'the code that ships, fed sample data', Component: FindJobsLive },
  { path: 'jobs/find/unposted-live', place: 'Jobs', title: 'Find a job: not posted yet, built (sample data)', replaces: 'the code that ships, fed sample data', Component: FindUnpostedLive },
  { path: 'jobs/find/unposted-empty-live', place: 'Jobs', title: 'Find a job: not posted yet, nothing yet (sample data)', replaces: 'the code that ships, fed sample data', Component: FindUnpostedEmptyLive },
  { path: 'jobs/find/unposted-error-live', place: 'Jobs', title: 'Find a job: not posted yet, could not load (sample data)', replaces: 'the code that ships, fed sample data', Component: FindUnpostedErrorLive },
  { path: 'jobs/find/independent-live', place: 'Jobs', title: 'Find a job: independent work, built (sample data)', replaces: 'the code that ships, fed sample data', Component: FindIndependentLive },
  { path: 'jobs/find/independent-new-live', place: 'Jobs', title: 'Find a job: independent work, just starting (sample data)', replaces: 'the code that ships, fed sample data', Component: FindIndependentNewLive },
  { path: 'jobs/find/independent-offer-live', place: 'Jobs', title: 'Find a job: independent work, define your offer (sample data)', replaces: 'the code that ships, fed sample data', Component: FindIndependentOfferLive },
  { path: 'jobs/find/resources-live', place: 'Jobs', title: 'Find a job: resources, built (sample data)', replaces: 'the code that ships, fed sample data', Component: FindResourcesLive },
  { path: 'jobs/find/resources-in-book-live', place: 'Jobs', title: 'Find a job: resources, résumé in the book (sample data)', replaces: 'the code that ships, fed sample data', Component: FindResourcesOptedInLive },
  { path: 'jobs/mine-live', place: 'Jobs', title: 'My jobs: the built list (sample data)', replaces: 'the code that ships, fed sample data', Component: MyJobsLive },
  { path: 'jobs/mine-empty-live', place: 'Jobs', title: 'My jobs: nothing yet (sample data)', replaces: 'the code that ships, fed sample data', Component: MyJobsEmptyLive },
  { path: 'jobs/companies', place: 'Jobs', title: 'Companies', replaces: '/dashboard/companies, /dashboard/company-tracker', Component: Companies },
  { path: 'jobs/companies/profile', place: 'Jobs', title: 'Company profile', replaces: '/dashboard/companies/[slug]', Component: CompanyProfile },
  { path: 'jobs/market/market', place: 'Jobs', title: 'Market: your market', replaces: '/dashboard/market, market-reality, market-intelligence', Component: MarketYours },
  { path: 'jobs/market/pay', place: 'Jobs', title: 'Market: know your worth', replaces: '/dashboard/pay', Component: MarketPay },
  { path: 'jobs/market/local', place: 'Jobs', title: 'Market: local market', replaces: '/dashboard/local-market', Component: MarketLocal },
  { path: 'jobs/live/companies', place: 'Jobs', title: 'Companies (the built page, sample data)', replaces: 'the code that ships, fed sample data', Component: CompaniesLive },
  { path: 'jobs/live/market', place: 'Jobs', title: 'Your market (the built page, sample data)', replaces: 'the code that ships, fed sample data', Component: MarketLive },
  { path: 'jobs/live/pay', place: 'Jobs', title: 'Know your worth (the built page, sample data)', replaces: 'the code that ships, fed sample data', Component: PayLive },
  { path: 'jobs/live/local', place: 'Jobs', title: 'Local market (the built page, sample data)', replaces: 'the code that ships, fed sample data', Component: LocalLive },
  { path: 'jobs/live/resume', place: 'Jobs', title: 'Résumé (the built page, sample data)', replaces: 'the code that ships, fed sample data', Component: ResumeLive },
  { path: 'jobs/live/whyhire', place: 'Jobs', title: 'Why hire me (the built page, sample data)', replaces: 'the code that ships, fed sample data', Component: StrengthsLive },
  { path: 'jobs/live/interviews', place: 'Jobs', title: 'Interviews (the built page, sample data)', replaces: 'the code that ships, fed sample data', Component: InterviewsLive },
  { path: 'jobs/live/pay-chart', place: 'Jobs', title: 'Know your worth: the advertised-pay chart (sample data)', replaces: 'the code that ships, fed sample data', Component: PayChartLive },
  { path: 'jobs/live/company-sections', place: 'Jobs', title: 'Company profile: hiring history, culture, how to get hired (sample data)', replaces: 'the code that ships, fed sample data', Component: CompanySectionsLive },
  { path: 'jobs/live/company-empty', place: 'Jobs', title: 'Company profile: nothing yet (sample data)', replaces: 'the code that ships, fed sample data', Component: CompanyCultureEmptyLive },
  { path: 'jobs/live/interview-tabs', place: 'Jobs', title: 'Interviews: tabs 2 to 5 (sample data)', replaces: 'the code that ships, fed sample data', Component: InterviewTabsLive },
  { path: 'jobs/live/in-work-overview', place: 'Jobs', title: 'In-work: overview (sample data)', replaces: 'the code that ships, fed sample data', Component: () => <InWorkLive tab="overview" /> },
  { path: 'jobs/live/in-work-impact', place: 'Jobs', title: 'In-work: impact log (sample data)', replaces: 'the code that ships, fed sample data', Component: () => <InWorkLive tab="impact" /> },
  { path: 'jobs/live/in-work-prep', place: 'Jobs', title: 'In-work: review prep (sample data)', replaces: 'the code that ships, fed sample data', Component: () => <InWorkLive tab="prep" /> },
  { path: 'jobs/live/in-work-salary', place: 'Jobs', title: 'In-work: salary and raise (sample data)', replaces: 'the code that ships, fed sample data', Component: () => <InWorkLive tab="salary" /> },
  { path: 'jobs/live/in-work-promotion', place: 'Jobs', title: 'In-work: promotion and scope (sample data)', replaces: 'the code that ships, fed sample data', Component: () => <InWorkLive tab="promotion" /> },
  { path: 'jobs/live/in-work-feedback', place: 'Jobs', title: 'In-work: feedback (sample data)', replaces: 'the code that ships, fed sample data', Component: () => <InWorkLive tab="feedback" /> },
  { path: 'jobs/live/in-work-outcome', place: 'Jobs', title: 'In-work: review outcome (sample data)', replaces: 'the code that ships, fed sample data', Component: () => <InWorkLive tab="outcome" /> },
  { path: 'jobs/live/forms', place: 'Jobs', title: 'Forms: conversation, hire outcome, résumé upload (sample data)', replaces: 'the code that ships, fed sample data', Component: FormsLive },
  { path: 'learn/path/roles', place: 'Learn', title: 'Market: other roles you could do', replaces: '/dashboard/pivot-paths, /dashboard/pivot', Component: MarketPivot },
  { path: 'jobs/interviews', place: 'Jobs', title: 'Interviews', replaces: '/dashboard/interview-prep, /dashboard/review-prep', Component: Interviews },
  { path: 'jobs/offers', place: 'Jobs', title: 'Offers', replaces: '/dashboard/got-hired, /dashboard/in-work', Component: Offers },
  { path: 'network/circles/know', place: 'Network', title: 'People you know', replaces: '/dashboard/network/contacts, /dashboard/references', Component: PeopleYouKnow },
  { path: 'network/circles/alumni', place: 'Network', title: 'Alumni and groups', replaces: '/dashboard/groups, /dashboard/universities, /dashboard/past-jobs', Component: AlumniGroups },
  { path: 'network/circles/industry', place: 'Network', title: 'Industry and function', replaces: '/dashboard/community', Component: IndustryFunction },
  { path: 'network/circles/recruiters', place: 'Network', title: 'Recruiters', replaces: '/dashboard/recruiter-requests', Component: RecruitersCircle },
  { path: 'network/week', place: 'Network', title: 'This week', replaces: '/dashboard/network/this-week, /dashboard/network/follow-ups', Component: NetworkThisWeek },
  { path: 'network/messages', place: 'Network', title: 'Messages', replaces: '/dashboard/messages', Component: Messages },
  { path: 'learn/other-paths/need', place: 'Learn', title: 'Your other paths: needs income soon (sample data)', replaces: 'new: parallel paths', Component: OtherPathsNeedLive },
  { path: 'learn/other-paths/busy', place: 'Learn', title: 'Your other paths: side work, buying, way back (sample data)', replaces: 'new: parallel paths', Component: OtherPathsBusyLive },
  { path: 'learn/buy-a-business/plan', place: 'Learn', title: 'Buy a business: your plan (sample data)', replaces: 'new: the 12th journey', Component: BuyPlanLive },
  { path: 'learn/buy-a-business/start', place: 'Learn', title: 'Buy a business: before starting (sample data)', replaces: 'new: the 12th journey', Component: BuyPlanNewLive },
  { path: 'learn/buy-a-business/find', place: 'Learn', title: 'Buy a business: find businesses (sample data)', replaces: 'new: the 12th journey', Component: BuyFindLive },
  { path: 'learn/buy-a-business/financing', place: 'Learn', title: 'Buy a business: pay for it (sample data)', replaces: 'new: the 12th journey', Component: BuyFinancingLive },
  { path: 'learn/buy-a-business/training', place: 'Learn', title: 'Buy a business: learn (sample data)', replaces: 'new: the 12th journey', Component: BuyTrainingLive },
  { path: 'learn/learn/skills', place: 'Learn', title: 'Skills and courses', replaces: '/dashboard/learning', Component: LearnSkills },
  { path: 'learn/learn/videos', place: 'Learn', title: 'Videos and webinars', replaces: '/dashboard/webinars', Component: LearnVideos },
  { path: 'account/profile', place: 'Account', title: 'Profile', replaces: '/dashboard/profile, complete-profile', Component: ProfileMock },
  { path: 'jobs/apply/resume', place: 'Jobs', title: 'Résumé', replaces: '/dashboard/resume, resume/studio, resume/walkthrough', Component: ResumeMock },
  { path: 'jobs/apply/whyhire', place: 'Jobs', title: 'Why hire me', replaces: '/dashboard/strengths, track-record', Component: WhyHireMe },
  { path: 'learn/path/story', place: 'Learn', title: 'Career story', replaces: '/dashboard/my-career (the real page, sample data)', Component: CareerStoryReal },
  { path: 'learn/know', place: 'Learn', title: 'How I work', replaces: '/dashboard/skills-assessments, how-i-perform', Component: HowIWork },
  { path: 'account/visibility', place: 'Account', title: 'What recruiters see', replaces: '/dashboard/recruiter-report, privacy', Component: WhatRecruitersSee },
  { path: 'account/documents', place: 'Account', title: 'Documents', replaces: '/dashboard/documents', Component: DocumentsMock },
  { path: 'account/membership', place: 'Account', title: 'Membership', replaces: '/dashboard/membership', Component: MembershipMock },
  { path: 'help/talk', place: 'Help', title: 'Talk to someone', replaces: '/dashboard/support', Component: HelpTalk },
  { path: 'help/work', place: 'Help', title: 'A hard situation at work (the real screens, sample answers)', replaces: 'new: for people considering leaving', Component: WorkHelpMock },
  { path: 'help/scams', place: 'Help', title: 'Scam watch', replaces: '/dashboard/scam-watch', Component: HelpScams },
  { path: 'help/questions', place: 'Help', title: 'Questions and feedback', replaces: '/dashboard/help', Component: HelpQuestions },
  { path: 'home/tailored', place: 'Home', title: 'Improve your search', replaces: 'new: every personalization in one place', Component: TailoredForYou },
  { path: 'home/strategy/application-match', place: 'Home', title: 'Search strategy: your applications, match and gaps (sample data)', replaces: 'new section; the unlock card moves into More about your search', Component: SearchStrategyApplicationMatch },
  { path: 'home/strategy/application-match-few', place: 'Home', title: 'Applications match: two applications, failed add (sample data)', replaces: 'the same section, early and error states', Component: ApplicationMatchFew },
  { path: 'admin/skills-match', place: 'Admin', title: 'Admin: skills match and gaps in applications (sample data)', replaces: 'new: support/admin/jobs/skills-match', Component: AdminSkillsMatch },
  { path: 'home/strategy/negotiation', place: 'Home', title: 'Search strategy step 5: interviews, offers and pay (the built form, sample answers)', replaces: 'the step 5 form with nine benefits questions; they moved to Know your worth', Component: StrategyNegotiationLive },
  { path: 'home/strategy/negotiation-empty', place: 'Home', title: 'Search strategy step 5, nothing answered yet (the built form)', replaces: 'the same form, empty', Component: StrategyNegotiationEmptyLive },
  { path: 'home/strategy', place: 'Home', title: 'Search strategy, simplified', replaces: '/dashboard/search-strategy (about twelve blocks down to three)', Component: SearchStrategySimple },
  { path: 'jobs/market/report', place: 'Jobs', title: 'Market reality report: the one-screen brief', replaces: '/dashboard/market-reality (12 pages down to one screen; the full report stays behind a button)', Component: MarketReportShort },
  { path: 'home/stalled', place: 'Home', title: 'Today: week 4, no interviews, widen the search', replaces: 'new: time-driven personalization', Component: HomeStalled },
  { path: 'home/checkin', place: 'Home', title: 'The check-in in three tones', replaces: 'mood pop-up and Still searching dialog, merged', Component: CheckIn },
  { path: 'home/journey/entrepreneur', place: 'Home', title: 'Today: building something of my own', replaces: '/dashboard for ENTREPRENEUR', Component: HomeEntrepreneur },
  { path: 'home/journey/time-off', place: 'Home', title: 'Today: taking time off', replaces: '/dashboard for TIME_OFF', Component: HomeTimeOff },
  { path: 'home/journey/career-change', place: 'Home', title: 'Today: changing careers', replaces: '/dashboard for CAREER_CHANGE', Component: HomeCareerChange },
  { path: 'home/journey/fractional', place: 'Home', title: 'Today: fractional and independent work', replaces: '/dashboard for FRACTIONAL', Component: HomeFractional },
  { path: 'flows/tune-question', place: 'Flows', title: 'A question, with the payoff shown', replaces: 'every one-off question on profile, search strategy, and onboarding', Component: TuneQuestion },
  { path: 'flows/tune-done', place: 'Flows', title: 'The finish: what you just gained', replaces: 'new', Component: TuneDone },
  { path: 'flows/deep-dive', place: 'Flows', title: 'A long assessment as short rounds', replaces: 'How I Work Best (57 items), What I Need (24), Track Record (19)', Component: DeepDiveIntro },
  { path: 'flows/track-record-intro', place: 'Flows', title: 'Track record as short rounds: the start (the real component, sample answers)', replaces: '/dashboard/track-record (19 questions on one page)', Component: TrackRecordIntro },
  { path: 'flows/track-record-round', place: 'Flows', title: 'Track record as short rounds: a round, resumed at round 6 (the real component, sample answers)', replaces: '/dashboard/track-record', Component: TrackRecordRound },
  { path: 'flows/track-record-done', place: 'Flows', title: 'Track record as short rounds: the finish (the real component, sample answers)', replaces: '/dashboard/track-record', Component: TrackRecordDone },
  { path: 'flows/how-i-perform-round', place: 'Flows', title: 'How I perform as short rounds: a round, resumed at round 7 (the real component, sample answers)', replaces: '/dashboard/how-i-perform (40 statements in 5 pages)', Component: HowIPerformRound },
  { path: 'flows/how-i-perform-last', place: 'Flows', title: 'How I perform as short rounds: the last round, then the finish (the real component, sample answers)', replaces: '/dashboard/how-i-perform', Component: HowIPerformDone },
  { path: 'flows/receipt-home', place: 'Flows', title: 'Receipt: Home bundle (pace and tone)', replaces: 'new', Component: ReceiptHome },
  { path: 'flows/receipt-network', place: 'Flows', title: 'Receipt: Network bundle (who you want to reach)', replaces: 'new', Component: ReceiptNetwork },
  { path: 'moments/candidate-plus', place: 'Moments', title: 'You earned Candidate+', replaces: 'the unlock ladder and its locked rungs', Component: CandidatePlusUnlock },
  { path: 'moments/weekly-email', place: 'Moments', title: 'The weekly progress email', replaces: 'the "You just earned new badges" email', Component: WeeklyEmail },
  { path: 'moments/onboarding', place: 'Moments', title: 'Onboarding: which sounds like you', replaces: '/onboarding situation step', Component: OnboardingSituation },
  { path: 'moments/first-week', place: 'Moments', title: 'Your first week', replaces: 'first-week plan on Home', Component: FirstWeek },
  { path: 'moments/empty-jobs', place: 'Moments', title: 'Empty: no jobs yet', replaces: 'Find a job before it can match', Component: EmptyJobs },
  { path: 'moments/empty-network', place: 'Moments', title: 'Empty: no contacts yet', replaces: 'People you know with no contacts', Component: EmptyNetwork },
  { path: 'moments/empty-effort', place: 'Moments', title: 'Empty: first day', replaces: 'Effort and results on day one', Component: EmptyEffort },
  { path: 'money/runway', place: 'Finances and benefits', title: 'Your runway (laid off)', replaces: '/dashboard/benefits (financial bridge)', Component: MoneyRunway },
  { path: 'money/deadlines', place: 'Finances and benefits', title: 'Benefits and deadlines (laid off)', replaces: '/dashboard/benefits action plan, benefits-network', Component: MoneyDeadlines },
  { path: 'money/runway-entrepreneur', place: 'Finances and benefits', title: 'Your runway (building something of my own)', replaces: 'new', Component: MoneyEntrepreneur },
  { path: 'moments/money-first-visit', place: 'Moments', title: 'First time opening Finances and benefits: would you like help with money?', replaces: 'new (not asked in onboarding)', Component: OnboardingMoney },
  { path: 'network/circles/know-live', place: 'Network', title: 'People you know: the built list (sample data)', replaces: 'the code that ships, fed sample data', Component: ContactsLive },
  { path: 'network/circles/know-empty-live', place: 'Network', title: 'People you know: no contacts yet (sample data)', replaces: 'the code that ships, fed sample data', Component: ContactsEmptyLive },
  { path: 'network/circles/know-filters-live', place: 'Network', title: 'People you know: filters on (sample data)', replaces: 'the code that ships, fed sample data', Component: ContactsFiltersLive },
  { path: 'network/circles/know-detail-live', place: 'Network', title: 'A contact: write to them (sample data)', replaces: 'the code that ships, fed sample data', Component: ContactDetailLive },
  { path: 'network/circles/industry-live', place: 'Network', title: 'Industry and function: the built feed (sample data)', replaces: 'the code that ships, fed sample data', Component: CommunityLive },
  { path: 'network/messages-live', place: 'Network', title: 'Messages: the built threads (sample data)', replaces: 'the code that ships, fed sample data', Component: MessagesLive },
  { path: 'network/circles/close-match-live', place: 'Network', title: 'Coach matching: preferences (sample data)', replaces: 'the code that ships, fed sample data', Component: CoachMatchLive },
  { path: 'network/circles/close-matches-live', place: 'Network', title: 'Coach matching: your matches (sample data)', replaces: 'the code that ships, fed sample data', Component: CoachMatchShortlistLive },
  { path: 'account/visibility-live', place: 'Account', title: 'Account and privacy: the built controls (sample data)', replaces: 'the code that ships, fed sample data', Component: PrivacyLive },
  { path: 'account/profile-live', place: 'Account', title: 'Profile: the built page (sample data)', replaces: 'the code that ships, fed sample data', Component: ProfileLive },
  { path: 'account/benefits-network-live', place: 'Account', title: 'Higher education benefits network: the built offers (sample data)', replaces: 'the code that ships, fed sample data', Component: BenefitsNetworkLive },
  { path: 'network/circles/partner-invite', place: 'Network', title: 'Invite your partner: how they join and what they see', replaces: '"Invite someone" as the only way to add a person (supporters)', Component: PartnerInvite },
  { path: 'network/circles/partner-people', place: 'Network', title: 'Your people: your partner at the top, supporters below', replaces: 'the single supporters list on Your people', Component: PartnerYourPeople },
  { path: 'network/circles/partner-move', place: 'Network', title: 'Your move plan: places side by side for both searches', replaces: 'new', Component: PartnerMoving },
  { path: 'portals/headers', place: 'Portals', title: 'Portal top bars: employer, higher education, workforce, recruiter, coach', replaces: 'the one navy top bar on every non-candidate portal (PartnerTopBar)', Component: PortalHeaders },
  { path: 'account/money', place: 'Account', title: 'Money help (off state)', replaces: 'new', Component: AccountMoney },
]

export const mockupFor = (path: string) => MOCKUPS.find((m) => m.path === path)
