# CandidateProfile personalization audit: fields

Source: 339 scalar fields on `CandidateProfile` (`prisma/schema.prisma`), reader counts from `src/**/*.ts(x)` excluding tests, with the interesting ones checked by reading the hub files (`lib/personalization/match-inputs.ts`, `lib/jobs/job-match.ts`, `lib/coach/*`, `lib/email/*`, `lib/reports/*`). "Reads" are rough: a name can collide with another model, and a read in an admin or coach view counts as USED but is flagged in the note.

## Summary

| Kind | Fields |
|---|---|
| PREFERENCE | 63 |
| SIGNAL | 52 |
| FACT | 72 |
| SETTING | 24 |
| SYSTEM | 128 |
| Total | 339 |

Verdicts (non-SYSTEM, 211 fields):

| Verdict | Total | PREFERENCE | SIGNAL | FACT | SETTING |
|---|---|---|---|---|---|
| USED | 175 | 59 | 38 | 60 | 18 |
| WRITE-ONLY | 18 | 2 | 6 | 4 | 6 |
| REDUNDANT | 6 | 1 | 4 | 1 | 0 |
| UNUSED | 10 | 0 | 4 | 6 | 0 |
| UNCLEAR | 2 | 1 | 0 | 1 | 0 |

### Redundant and legacy clusters

- **Location**: `currentCity` + `currentState` (the only two job match reads), `metroArea` (community, higher-ed, recruiter view only), `currentCountry` (admin/recruiter view), `streetAddress` (form only), `openToRelocation` + `relocationNotes` + `travelWillingness` + `maxTravelPct` (willingness, not place), `onboardingLocationConfirmedAt`. `metroArea` and `currentCity/State` can drift apart.
- **Status / stage**: `currentJobStatus`, `journey`, `journeyStage`, `justStartedSearch` (write-only), `confidentialModeEnteredJobStatus`, plus the change timestamps. `justStartedSearch` duplicates `currentJobStatus`/`journeyStage`.
- **Intensity / pace**: `searchIntensity` (live), `jobSearchIntensity` (old slider, kept in the scoring helper and monthly report), `changePacePreference`, `changeReadiness`, `jobSearchDifficultyLevel`.
- **Barriers / blockers**: `blockers` (live) vs `biggestBarriers` (reports only) vs `blockersOpenText`, `dealBreakers`, `aiJobLossReason` (unused), `benefitsPressures`. `biggestBarriers` overlaps `blockers`.
- **Application activity**: `jobsAppliedBucket` / `applicationsBucket` (0 files) and `interviewsReceivedCount` / `interviewsBucket` (0 files) overlap the real application and interview records and `applicationVolumeGoal`. Only the sprint seed reads the first pair.
- **Industry**: `industryContext`, `secondaryIndustryContext`, `industryBucket`, `industryBuckets`, `targetIndustries`. Five fields for one idea; `industryBucket` (single) and `industryBuckets` (list) overlap.
- **Function / role**: `primaryFunction`, `secondaryFunction`, `subFunction`, `targetFunction`, `targetRoleType`, `resumeLatestJobTitle`, `activeJobDescription`.
- **Remote**: `remotePreference` (live) vs `remoteDaysPerWeekDesired` (review-prep only).
- **Pay**: `targetCompMin`, `compFlexible`, `willingToStartLower`, `lastSalary`, `priorityMaxComp`. There is no target max.
- **Work type**: `interimConsultingInterest`, `jobBoardWorkTypes`, `gigDirectoryUnlockAnswer`, `boardAdvisoryWillingness`, `triedPartTimeOrConsulting`.
- **Work authorization**: `workAuthorization` vs `visaStatus`.
- **Privacy**: `privacyTier` (tiers) vs `confidentialSearchMode` (boolean) vs `recruiterDatabaseOptIn` vs `resumeBookOptIn` vs `leaderboardOptIn` + `leaderboardDisplayMode` vs `confidentialLinkedInPostingOptIn` (write-only) vs `includeGapExplanationInDossier` vs `coachDossierConsentedAt` vs `boardDiversityListingsOptIn` (write-only). Six independent visibility switches with no single resolver.
- **Email opt-outs**: `notificationTier` plus eight separate booleans (`dailyEmailOptedOut`, `weeklyReportOptedOut`, `sprintGoalEmailsOptedOut`, `marketDigestOptedOut`, `jobSearchDailyOptedOut`, `freshJobAlertsOptedOut`, `reminderEmailsOptedOut`, `recruiterUnlockNudgeOptedOut`). `sprintGoalEmailsOptedOut` is not read by any sender. `smsPhone` and `smsConsentedAt` have no SMS sender.
- **Skills**: `confirmedSkillsHave`, `skillLevels`, `resumeKeywords`, `certifications`, `skillsToBuild`, five `*Confidence` fields (three write-only).
- **Comfort**: `networkComfortLevel`, `storyComfort`, `interviewComfort`, `negotiationComfort`, `elevatorPitchReady`, `publicDisclosureComfort`, `contentComfortLevel`, `linkedinOpennessComfort`. Eight 1-5 style self ratings, collected on four different pages.

### Write-only and unused personalization fields

**Write-only (collected, shown back, nothing reads it) (18):** `confidentialLinkedInPostingOptIn` (SETT), `independentWorkExperience` (FACT), `recruiterConnectionCount` (SIGN), `functionSkillConfidence` (SIGN), `actionOrientedConfidence` (SIGN), `communicatorConfidence` (SIGN), `willingToFollowUpOnApplications` (SIGN), `restrictiveCovenantDetails` (FACT), `wantsAnimalFriendlyWorkplace` (PREF), `phone` (FACT), `streetAddress` (FACT), `benefitsActionPlanCompletedItems` (SIGN), `boardDiversityListingsOptIn` (SETT), `workSampleType` (PREF), `actionWindow` (SETT), `sprintGoalEmailsOptedOut` (SETT), `smsPhone` (SETT), `smsConsentedAt` (SETT)

**Unused (no real readers) (10):** `aiJobLossReason` (SIGN), `resumeFirstJobStartDate` (FACT), `resumeAiReadinessScore` (FACT), `resumeAiReadinessNotes` (FACT), `displayCompany` (FACT), `justStartedSearch` (SIGN), `applicationsBucket` (SIGN), `interviewsBucket` (SIGN), `jobBoardUsage` (FACT), `jobBoardUsageOther` (FACT)

**Redundant (overlaps another field) (6):** `jobSearchIntensity` (SIGN), `biggestBarriers` (SIGN), `jobsAppliedBucket` (SIGN), `interviewsReceivedCount` (SIGN), `industryBucket` (FACT), `remoteDaysPerWeekDesired` (PREF)

Other notes: the coach-only fields (`startLowerRationale`, `hasBeenReferredBefore`, `referralRecency`, `benefitsPressures*`, `blockersOpenText`, `motivationsElaboration`, `consistencySelfRating`) are counted USED because the coach notes panel reads them, but Victoria chat (`lib/coach/generate-reply.ts`) does not. The 13 fields Victoria reply actually reads are role/function/industry, `currentJobStatus`, `cultureFit`, `searchIntensity`, `jobSearchDifficultyLevel`, `coachingStylePreference`, `isPivoting`, `linkedInUrl` and the networking-list flags. The eight survey-style `Wants*`/`pto*` benefits fields feed only the review-prep benefits checklist, not job matching.

### SYSTEM fields (128, not classified further)

`id`, `userId`, `createdAt`, `updatedAt`, `isSystemAccount`, `isSampleData`, `leadSource`, `leadSourceDetail`, `leadSourceSetBy`, `leadSourceSetAt`, `signupIp`, `adminNewCandidateEmailSentAt`, `privacyOpenedUpBonusAt`, `candidatePlusUnlockedAt`, `candidatePlusUnlockSource`, `candidatePlusRevokedAt`, `candidatePlusUnlockSeenAt`, `effortMinutesTargetOverride`, `confidentialSearchModeChangedAt`, `passiveToActivePromptLastShownAt`, `passiveToActivePromptDontAskAgain`, `stalledSearchPromptLastShownAt`, `stalledSearchPromptDontAskAgain`, `confidentialModeEnteredJobStatus`, `leaderboardOptInAt`, `recruiterDatabaseRequestedAt`, `recruiterVisibilityConfirmedAt`, `recruiterNotifiedAt`, `recruiterUnlockNudgedAt`, `resumeBookOptInConfirmedAt`, `desireComplete`, `journeyChangedAt`, `journeyStageChangedAt`, `journeyCheckedAt`, `positioningStatementSetAt`, `selfAwarenessSetAt`, `searchStrategyGuidanceGeneratedAt`, `searchStrategyFirstAnsweredAt`, `weeklyFocusWeekStartDate`, `dossierGeneratedCache`, `dossierGeneratedAt`, `industryBucketsConfirmedAt`, `toolsConfirmedAt`, `skillGapSuggestions`, `skillGapSuggestionsFingerprint`, `skillsHaveConfirmedAt`, `strengthCache`, `strengthCacheKey`, `searchStrategyConfirmedAt`, `licensesAnsweredAt`, `resumePrefilledFields`, `redFlagsBonusAt`, `benefitsPrioritiesBonusAt`, `pedigreeBonus`, `pedigreeSignals`, `exceptionalGradeOverride`, `exceptionalGradeOverrideReason`, `exceptionalGradeOverrideBy`, `exceptionalGradeOverrideAt`, `profileConfirmedAt`, `industryConfirmedAt`, `functionConfirmedAt`, `salaryConfirmedAt`, `workAuthConfirmedAt`, `skillsAssessmentCompletedAt`, `trackRecordCompletedAt`, `whatINeedCompletedAt`, `workInterestsCompletedAt`, `linkedInConfirmedAt`, `networkingListSubmittedAt`, `askedForHelpAt`, `linkedinConnectionsImportedAt`, `gigDirectoryUnlockBonusAt`, `interimOutreachStartedAt`, `contentUnlockBonusAt`, `linkedinUnlockBonusAt`, `workSampleTypeBonusAt`, `moodCardDismissedAt`, `lastDailyEmailSentAt`, `networkComfortBonusAt`, `comfortCheckBonusAt`, `negotiationInterviewComfortBonusAt`, `searchStrategyCompleteBonusAt`, `coreNarrativeBonusAt`, `waysToSayItBonusAt`, `hardQuestionsBonusAt`, `publicVisibilityComfortBonusAt`, `pitchPracticeWithCoachAt`, `sharedNarrativeForFeedbackAt`, `outreachPlanDismissedAt`, `gmailTrackingTesterEnabled`, `gmailAccessRequestedAt`, `part1Complete`, `part2Complete`, `part3Complete`, `part4Complete`, `assessmentComplete`, `assessmentCompletedAt`, `contractAccepted`, `contractAcceptedAt`, `introCommittedAt`, `welcomeVideoWatchedAt`, `subjectToHardGate`, `resumeStepComplete`, `onboardingResumeConfirmedAt`, `onboardingLocationConfirmedAt`, `onboardingSearchStatusConfirmedAt`, `onboardingComfortConfirmedAt`, `registrationCompletedAt`, `deactivatedAt`, `passwordSetAt`, `duplicateEmailBlockedAt`, `reportGenerationClaimedAt`, `lastReminderSentAt`, `reminderEmailCount`, `resumeFixesAppliedKeys`, `eeocRespondedAt`, `coachId`, `sourcingRecruiterId`, `communityLastViewedAt`, `networkBackchannelLastViewedAt`, `badgesLastSeenCount`, `jobBoardUsageNudgeShownAt`, `jobBoardUsageBonusAt`, `categoryBaselineScores`, `categoryBaselineUpdatedAt`, `levelRankUpdatedAt`, `benefitsNetworkPoints`

## PREFERENCE (63)

| Field | Type | Files | Verdict | Who reads it |
|---|---|---|---|---|
| `currentJobStatus` | CurrentJobStatus? | 56 | USED | Victoria reply, emails, reports, weekly (employed/unemployed context); cluster status |
| `journey` | JourneyType? | 88 | USED | spine, emails, weekly, dashboard variant; cluster status |
| `journeyStage` | JourneyStage? | 24 | USED | emails, weekly sprint, journey engine; cluster status |
| `cultureFit` | Json? | 13 | USED | Victoria reply, spine, reports |
| `currentCity` | String? | 68 | USED | job match, notes; cluster location |
| `currentState` | String? | 72 | USED | job match, notes; cluster location |
| `metroArea` | String? | 18 | UNCLEAR | community, higher-ed, recruiter db; not in job match; cluster location |
| `primaryFunction` | String? | 165 | USED | job match, Victoria, spine, learning, emails; cluster function |
| `remotePreference` | String? | 57 | USED | job match, spine, Victoria notes; cluster remote |
| `targetRoleType` | String? | 111 | USED | job match, Victoria, spine, emails; cluster role target |
| `targetIndustries` | String[] | 66 | USED | job match, spine, emails; cluster industry |
| `targetFunction` | String? | 68 | USED | job match, Victoria, spine; cluster role target |
| `targetCompanySize` | String? | 25 | USED | job match, spine |
| `targetCompanyStage` | String? | 18 | USED | job match, spine |
| `targetCompMin` | Int? | 42 | USED | job match, spine; cluster pay |
| `compFlexible` | Boolean | 24 | USED | job match, coach notes |
| `willingToStartLower` | Boolean | 14 | USED | job match, spine |
| `startLowerRationale` | String? | 5 | USED | coach view only |
| `openToRelocation` | Boolean | 43 | USED | job match, spine; cluster location |
| `relocationNotes` | String? | 13 | USED | coach notes, match inputs (free text, not scored) |
| `travelWillingness` | Boolean | 9 | USED | job match, apply kit |
| `maxTravelPct` | Int? | 5 | USED | job match |
| `hiddenEmployerSectors` | String[] | 7 | USED | job board shortlist, match compute |
| `equityImportant` | Boolean | 10 | USED | job match, negotiation advice |
| `dealBreakers` | String? | 10 | USED | spine, reports, weekly focus, coach notes; cluster blockers |
| `applicationVolumeGoal` | Int? | 16 | USED | spine, reports, coach notes |
| `boardAdvisoryWillingness` | Boolean? | 5 | USED | work-type logic, independent work section |
| `isPivoting` | Boolean | 33 | USED | job match, Victoria, reports, pivots |
| `boardBreadth` | String? | 2 | USED | find-my-job breadth control |
| `industryBuckets` | String[] | 6 | USED | job match inputs, market size; cluster industry |
| `subFunction` | String? | 10 | USED | match inputs, market size |
| `skillsToBuild` | String[] | 17 | USED | learning, Victoria, weekly |
| `workStyleAnswers` | Json | 9 | USED | job match, work profile, pivots |
| `searchExpansion` | Json | 7 | USED | match inputs, pivot paths, addressable market |
| `interimConsultingInterest` | Boolean | 10 | USED | job match work-type, weekly focus, guidance |
| `willingToTakeDrugTest` | Boolean? | 4 | USED | journey engagement-data only |
| `willingToTakeBackgroundCheck` | Boolean? | 4 | USED | journey engagement-data only |
| `wantsAnimalFriendlyWorkplace` | Boolean? | 3 | WRITE-ONLY | screening form only |
| `wantsHealthDentalVisionInsurance` | Boolean? | 3 | USED | review-prep benefits only |
| `wantsDisabilityInsurance` | Boolean? | 3 | USED | review-prep benefits only |
| `wants401kMatch` | Boolean? | 3 | USED | review-prep benefits only |
| `ptoWeeksExpected` | Int? | 3 | USED | review-prep benefits only |
| `remoteDaysPerWeekDesired` | Int? | 3 | REDUNDANT | overlaps remotePreference; review-prep benefits only |
| `paidParentalLeaveWeeksExpected` | Int? | 3 | USED | review-prep benefits only |
| `wantsProfessionalDevReimbursement` | Boolean? | 3 | USED | review-prep benefits only |
| `wantsCommuterBenefits` | Boolean? | 3 | USED | review-prep benefits only |
| `wantsGymMembership` | Boolean? | 3 | USED | review-prep benefits only |
| `gigDirectoryUnlockAnswer` | String? | 5 | USED | work-type logic, interim launch plan |
| `jobBoardWorkTypes` | String[] | 2 | USED | job board work-type filter; overlaps interimConsultingInterest |
| `contentVenues` | ContentVenue[] | 7 | USED | search strategy checklist, marketing plan |
| `activeJobDescription` | String? | 6 | USED | narrative, learning, interview prep (the job they target now) |
| `workSampleType` | String? | 3 | WRITE-ONLY | work-samples page only |
| `networkConnectPreferences` | String[] | 3 | USED | network page, monthly report |
| `networkingOutreachTargetPerWeek` | Int? | 6 | USED | weekly checklist, reports |
| `priorityMaxComp` | Int? | 17 | USED | job match, match inputs; cluster priorities |
| `priorityBrandName` | Int? | 8 | USED | job match |
| `priorityJobSecurity` | Int? | 6 | USED | job match, coach notes |
| `priorityWorkLife` | Int? | 17 | USED | job match |
| `priorityMission` | Int? | 8 | USED | job match |
| `coachGenderPreference` | String? | 3 | USED | coach matching |
| `coachCommunicationStylePreference` | String? | 4 | USED | coach matching |
| `coachLanguagePreference` | String? | 3 | USED | coach matching |
| `coachTimezonePreference` | String? | 3 | USED | coach matching |

## SIGNAL (52)

| Field | Type | Files | Verdict | Who reads it |
|---|---|---|---|---|
| `gapDuration` | GapDurationBucket? | 22 | USED | spine, reports, weekly |
| `jobSearchIntensity` | Int? | 2 | REDUNDANT | older slider of searchIntensity; only scoring/search-intensity + monthly report |
| `biggestBarriers` | String[] | 6 | REDUNDANT | overlaps blockers/blockersOpenText; read only by reports |
| `searchIntensity` | SearchIntensity? | 18 | USED | Victoria reply, spine, reports, weekly; cluster intensity |
| `jobsAppliedBucket` | String? | 4 | REDUNDANT | weekly sprint seed; overlaps applicationsBucket and real application counts |
| `interviewsReceivedCount` | Int? | 6 | REDUNDANT | weekly sprint seed; overlaps interviewsBucket and real interview records |
| `networkingLevel` | Int? | 13 | USED | Victoria, reports, weekly |
| `learnedNewSkillsLevel` | Int? | 9 | USED | coach notes, search-strategy checklist, weekly |
| `triedPartTimeOrConsulting` | Boolean? | 6 | USED | search-strategy checklist, weekly sprint |
| `triedExecutiveCoaching` | Boolean? | 9 | USED | market-reality report, weekly |
| `connectedWithRecruiters` | Boolean? | 9 | USED | market-reality report, weekly |
| `recruiterConnectionCount` | Int? | 3 | WRITE-ONLY | search-strategy form only |
| `growthAreas` | String[] | 12 | USED | Victoria, dossier, skill-gap suggestions |
| `growthAreasElaboration` | String? | 3 | USED | dossier report |
| `functionSkillConfidence` | Int? | 3 | WRITE-ONLY | skills form + dossier competencies score only |
| `aiFlexibilityLevel` | Int? | 7 | USED | learning plan, AI training tiers |
| `managementSkillConfidence` | Int? | 9 | USED | work profile, self-awareness, report |
| `actionOrientedConfidence` | Int? | 2 | WRITE-ONLY | dossier competencies only |
| `creativityConfidence` | Int? | 4 | USED | work profile, people-like-you |
| `communicatorConfidence` | Int? | 3 | WRITE-ONLY | dossier competencies/self-awareness only |
| `jobSearchDifficultyLevel` | Int? | 11 | USED | Victoria reply, pace, weekly, mood labels |
| `storyComfort` | Int? | 10 | USED | interview prep, curated content, monthly report |
| `interviewComfort` | Int? | 14 | USED | interview prep, weekly, reports |
| `elevatorPitchReady` | Int? | 6 | USED | interview prep, monthly report |
| `negotiationComfort` | Int? | 8 | USED | curated content, search-strategy checklist |
| `aiJobLossReason` | String? | 3 | UNUSED | onboarding write; journey engagement-data only |
| `blockers` | String[] | 26 | USED | job match, spine, reports; cluster barriers |
| `consistencySelfRating` | Int? | 7 | USED | market-reality probability, dossier |
| `blockersOpenText` | String? | 7 | USED | coach notes, probability |
| `motivations` | String[] | 19 | USED | spine, reports, weekly |
| `motivationsElaboration` | String? | 7 | USED | coach notes, dossier |
| `coachingStylePreference` | CoachingStylePreference? | 16 | USED | Victoria reply tone, spine |
| `changePacePreference` | ChangePacePreference? | 8 | USED | search-strategy guidance, reports |
| `changeReadiness` | ChangeReadiness? | 11 | USED | spine, guidance, activation items |
| `publicDisclosureComfort` | PublicDisclosureComfort? | 7 | USED | coach notes, reports |
| `willingToFollowUpOnApplications` | Boolean? | 2 | WRITE-ONLY | search-strategy form only |
| `benefitsPressures` | String[] | 3 | USED | coach notes only |
| `benefitsPressureOtherText` | String? | 3 | USED | coach notes only |
| `benefitsActionPlanCompletedItems` | String[] | 2 | WRITE-ONLY | benefits page checklist only |
| `earlyCareerChecklistDone` | String[] | 3 | USED | early-career checklist |
| `contentComfortLevel` | Int? | 9 | USED | visibility calibration, weekly |
| `linkedinOpennessComfort` | Int? | 5 | USED | search-strategy checklist |
| `linkedinUsageFrequency` | String? | 6 | USED | search-strategy checklist |
| `linkedinProfileUpToDate` | Boolean? | 6 | USED | launch plan, checklist |
| `currentStreak` | Int | 15 | USED | daily msg, emails, community, reports |
| `longestStreak` | Int | 4 | USED | badges, stats page |
| `lastCheckInAt` | DateTime? | 6 | USED | daily msg, coach triggers, quiet-member email |
| `networkComfortLevel` | NetworkComfortLevel? | 12 | USED | spine, search-strategy guidance, weekly |
| `networkingConcerns` | NetworkingAnxiety[] | 9 | USED | guidance, monthly report |
| `justStartedSearch` | Boolean | 2 | UNUSED | onboarding form writes; overlaps currentJobStatus/journeyStage |
| `applicationsBucket` | String? | 0 | UNUSED | 0 files; overlaps jobsAppliedBucket |
| `interviewsBucket` | String? | 0 | UNUSED | 0 files; overlaps interviewsReceivedCount |

## FACT (72)

| Field | Type | Files | Verdict | Who reads it |
|---|---|---|---|---|
| `lastJobEndedAt` | DateTime? | 7 | USED | got-hired outcome, search playbook, benefits page |
| `ageBand` | AgeBand? | 8 | USED | outcomes segments, monthly report (not matching) |
| `journeyDetails` | Json? | 12 | USED | spine, journey engine, win-back email |
| `layoffCohortId` | String? | 5 | USED | community cohort |
| `currentCountry` | String | 5 | UNCLEAR | shown in admin/recruiter db; not in matching; cluster location |
| `independentWorkExperience` | Json? | 2 | WRITE-ONLY | search-strategy form only |
| `yearsExperience` | Int? | 53 | USED | job match, spine, reports |
| `highestLevelReached` | String? | 79 | USED | job match, spine, Victoria |
| `industryContext` | String? | 41 | USED | job match, Victoria, learning; cluster industry |
| `secondaryFunction` | String? | 36 | USED | job match, coach notes |
| `secondaryIndustryContext` | String? | 16 | USED | job match inputs, coach notes |
| `industryBucket` | String? | 16 | REDUNDANT | overlaps industryContext/industryBuckets; reports, community |
| `resumeKeywords` | String[] | 28 | USED | job match, learning |
| `certifications` | String[] | 36 | USED | job match, spine, learning |
| `isPeopleManager` | Boolean? | 17 | USED | job match, learning |
| `teamSizeManaged` | Int? | 8 | USED | job match, learning plan, report |
| `topStrengths` | String[] | 13 | USED | reports, learning |
| `knownFor` | String? | 20 | USED | jobs, reports, admin |
| `positioningStatementDraft` | String? | 3 | USED | dossier (draft state) |
| `positioningStatementText` | String? | 13 | USED | dossier, resume walkthrough |
| `selfAwarenessDraft` | String? | 3 | USED | dossier (draft state) |
| `selfAwarenessText` | String? | 5 | USED | dossier, recruiter report |
| `searchStrategyGuidance` | String? | 3 | USED | search strategy page (generated text) |
| `weeklyFocusGuidance` | String? | 1 | USED | weekly focus card |
| `hasBeenReferredBefore` | Boolean? | 5 | USED | coach notes only |
| `referralRecency` | ReferralRecency? | 4 | USED | coach notes only |
| `confirmedSkillsHave` | String[] | 20 | USED | job match, learning |
| `skillLevels` | Json | 11 | USED | job match, skill gap, pivots |
| `canTeach` | String[] | 5 | USED | higher-ed screens, member profile |
| `hasRestrictiveCovenant` | Boolean? | 4 | USED | journey engagement-data only |
| `restrictiveCovenantDetails` | String? | 3 | WRITE-ONLY | screening form only |
| `firedForCause` | Boolean? | 5 | USED | journey engagement |
| `clearanceLevel` | String? | 11 | USED | job match requirements, resume prefill |
| `clearanceActive` | Boolean? | 6 | USED | job match requirements |
| `clearancePolygraph` | String? | 6 | USED | job match requirements |
| `licensesHeld` | String[] | 9 | USED | job match requirements |
| `firstName` | String? | 303 | USED | emails, all views |
| `lastName` | String? | 172 | USED | views, job match name |
| `phone` | String? | 77 | WRITE-ONLY | profile form, admin view; no outbound use found |
| `streetAddress` | String? | 5 | WRITE-ONLY | profile form only; cluster location |
| `graduationDate` | DateTime? | 15 | USED | scoring, resume, admin |
| `resumeFirstJobStartDate` | DateTime? | 1 | UNUSED | resume extract writes only |
| `resumeLatestJobTitle` | String? | 28 | USED | match inputs, learning, weekly |
| `resumeAiReadinessScore` | Int? | 1 | UNUSED | resume extract writes only |
| `resumeAiReadinessNotes` | String? | 1 | UNUSED | resume extract writes only |
| `highestEducationLevel` | HighestEducationLevel? | 9 | USED | reports, narrative weaknesses |
| `hasMBA` | Boolean | 6 | USED | learning plan, admin |
| `hasJD` | Boolean | 11 | USED | job match credential gate |
| `hasMD` | Boolean | 11 | USED | job match credential gate |
| `hasDO` | Boolean | 9 | USED | job match credential gate |
| `jobHoppingFlag` | Boolean | 12 | USED | interview prep, named reasons, scoring |
| `shortTenureCount` | Int | 3 | USED | named reasons, work history facts |
| `careerTrajectory` | CareerTrajectory? | 14 | USED | reports, scoring |
| `promotionVelocity` | PromotionVelocity? | 3 | USED | pedigree scoring, admin |
| `gapExplanation` | String? | 7 | USED | recruiter report, share page |
| `lastSalary` | Int? | 12 | USED | job match, negotiation advice, market pay position |
| `workAuthorization` | String? | 14 | USED | job match, Victoria notes |
| `visaStatus` | String? | 6 | USED | apply kit, coach notes; overlaps workAuthorization |
| `linkedInUrl` | String? | 14 | USED | Victoria, reports, profile |
| `interimOfferDefinition` | String? | 2 | USED | interim launch plan |
| `displayName` | String? | 50 | USED | emails, community, leaderboard |
| `displayCompany` | String? | 0 | UNUSED | 0 files |
| `profilePictureUrl` | String? | 25 | USED | community, talent views |
| `email` | String? | 967 | USED | all emails |
| `eeocGenderIdentity` | EeocGenderIdentity? | 5 | USED | admin bias detection only (aggregate) |
| `eeocRaceEthnicity` | EeocRaceEthnicity? | 4 | USED | admin bias detection only (aggregate) |
| `eeocDisabilityStatus` | EeocYesNoDecline? | 4 | USED | admin bias detection only (aggregate) |
| `eeocVeteranStatus` | EeocYesNoDecline? | 4 | USED | admin bias detection only (aggregate) |
| `jobBoardUsage` | Json? | 0 | UNUSED | 0 files |
| `jobBoardUsageOther` | String? | 0 | UNUSED | 0 files |
| `levelRankScore` | Int? | 33 | USED | job match, reports, weekly |
| `levelRankLabel` | String? | 5 | USED | reports, dossier |

## SETTING (24)

| Field | Type | Files | Verdict | Who reads it |
|---|---|---|---|---|
| `privacyTier` | PrivacyTier | 55 | USED | community, emails, daily msg, weekly; tier cluster |
| `confidentialSearchMode` | Boolean | 85 | USED | emails, community, reports, daily msg; cluster with privacyTier |
| `leaderboardOptIn` | Boolean | 7 | USED | leaderboard queries, monthly report |
| `leaderboardDisplayMode` | LeaderboardDisplayMode? | 4 | USED | leaderboard identity |
| `recruiterDatabaseOptIn` | Boolean | 22 | USED | recruiter database/talent views, daily msg; cluster |
| `resumeBookOptIn` | Boolean | 12 | USED | resume book, find-my-job, admin view; cluster |
| `confidentialLinkedInPostingOptIn` | Boolean | 2 | WRITE-ONLY | marketing-plan page only writes/shows it |
| `includeGapExplanationInDossier` | Boolean | 5 | USED | recruiter report, share |
| `boardDiversityListingsOptIn` | Boolean? | 2 | WRITE-ONLY | interim-work form only |
| `actionWindow` | ActionWindow | 2 | WRITE-ONLY | privacy page and dashboard action write it; nothing reads it |
| `dailyEmailOptedOut` | Boolean | 6 | USED | daily nudge email gates; cluster email opt-outs |
| `weeklyReportOptedOut` | Boolean | 7 | USED | search check-in, win-back, motivation emails; cluster |
| `sprintGoalEmailsOptedOut` | Boolean | 2 | WRITE-ONLY | unsubscribe route + admin view only; no sender checks it; cluster |
| `marketDigestOptedOut` | Boolean | 6 | USED | market update email; cluster |
| `jobSearchDailyOptedOut` | Boolean | 3 | USED | job-search-daily and fresh alert crons; cluster |
| `freshJobAlertsOptedOut` | Boolean | 2 | USED | fresh job alerts cron; cluster |
| `notificationTier` | NotificationTier | 20 | USED | emails, reports; cluster with opt-out flags |
| `smsPhone` | String? | 1 | WRITE-ONLY | privacy action writes; no SMS sender |
| `smsConsentedAt` | DateTime? | 2 | WRITE-ONLY | privacy action, admin view; no SMS sender |
| `weeklySprintTargetOptOut` | Boolean | 5 | USED | community milestone posts |
| `encouragementGivingOptIn` | Boolean | 5 | USED | community settings |
| `reminderEmailsOptedOut` | Boolean | 3 | USED | registration reminders cron; cluster opt-outs |
| `recruiterUnlockNudgeOptedOut` | Boolean | 3 | USED | recruiter-unlock nudge cron; cluster opt-outs |
| `coachDossierConsentedAt` | DateTime? | 20 | USED | coach notes/dossier access |
