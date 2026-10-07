// The tracking directory: every fractional/flexible work platform and
// learning provider whose own email NextChapter reads to tell how far a
// candidate has gotten there (signed up → accepted → working, or enrolled →
// learning → completed). Tracking-only — what's LISTED on the Interim Work
// and Learning pages stays curated in the InterimListing and Course tables;
// a listing links to its entry here by sharing a sender domain.
//
// `domains` are matched as suffixes of the sender's domain (mail from
// "notifications.coursera.org" matches "coursera.org"). `gate` is required
// for any domain that also sends unrelated mail (linkedin.com, google.com,
// a university's .edu): the From header or subject must match it, and the
// email must look automated (see track.ts), so a personal email or a
// LinkedIn connection request never reads as a course.

export type PlatformKind = 'WORK' | 'LEARNING'

export const PLATFORM_CATEGORY_LABEL = {
  AI_TRAINING: 'AI training & expert data work',
  FRACTIONAL: 'Fractional & interim executive',
  FREELANCE: 'Freelance & project marketplaces',
  EXPERT_NETWORK: 'Expert networks',
  BOARD: 'Board & advisory',
  RETURN_TO_WORK: 'Return-to-work & flexible',
  OUTPLACEMENT: 'Outplacement & career transition',
  GOVERNMENT: 'Government & workforce training',
  COURSE_PLATFORM: 'Online course platforms',
  AI_LEARNING: 'AI learning',
  CODING: 'Coding & tech skills',
  VENDOR_ACADEMY: 'Vendor academies & tech certificates',
  PRO_CERT: 'Professional certifications',
  CREDENTIAL_SERVICE: 'Exams & credentials',
  EXEC_ED: 'Executive education',
  ONLINE_DEGREE: 'Online degrees',
  BOOTCAMP: 'Bootcamps',
} as const

export type PlatformCategory = keyof typeof PLATFORM_CATEGORY_LABEL

export interface PlatformEntry {
  key: string
  name: string
  kind: PlatformKind
  category: PlatformCategory
  domains: string[]
  gate?: RegExp
}

const WORK_CATEGORIES = new Set<PlatformCategory>(['AI_TRAINING', 'FRACTIONAL', 'FREELANCE', 'EXPERT_NETWORK', 'BOARD', 'RETURN_TO_WORK'])

type Row = [key: string, name: string, domains: string, gate?: RegExp]

function group(category: PlatformCategory, rows: Row[]): PlatformEntry[] {
  const kind: PlatformKind = WORK_CATEGORIES.has(category) ? 'WORK' : 'LEARNING'
  return rows.map(([key, name, domains, gate]) => ({
    key,
    name,
    kind,
    category,
    domains: domains.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean),
    ...(gate ? { gate } : {}),
  }))
}

// University mail is mostly alumni/fundraising/news — only the online,
// extension and executive-education arms count, by name.
const UNI_LEARNING = /online|executive education|exec ed|extension|xpro|professional education|continuing|certificate|emeritus|getsmarter|admissions|registrar|course|program/i

export const PLATFORM_DIRECTORY: PlatformEntry[] = [
  ...group('AI_TRAINING', [
    ['micro1', 'micro1', 'micro1.ai'],
    ['mercor', 'Mercor', 'mercor.com, mercor.io'],
    ['outlier', 'Outlier', 'outlier.ai'],
    ['scale', 'Scale AI / Remotasks', 'scale.com, remotasks.com'],
    ['surge', 'Surge AI / DataAnnotation', 'surgehq.ai, dataannotation.tech'],
    ['turing', 'Turing', 'turing.com'],
    ['labelbox', 'Labelbox / Alignerr', 'labelbox.com, alignerr.com'],
    ['prolific', 'Prolific', 'prolific.com, prolific.co, prolific.ac'],
    ['invisible', 'Invisible Technologies', 'invisible.co, invisible.email'],
    ['handshake-ai', 'Handshake AI', 'joinhandshake.com', /handshake ai|\bai\b|fellowship|project/i],
    ['snorkel', 'Snorkel AI experts', 'snorkel.ai'],
    ['mindrift', 'Mindrift', 'mindrift.ai'],
    ['toloka', 'Toloka', 'toloka.ai'],
    ['appen', 'Appen', 'appen.com'],
    ['telus-ai', 'TELUS Digital AI', 'telusinternational.com, telusinternational.ai, telusdigital.com'],
    ['welocalize', 'Welocalize', 'welocalize.com'],
    ['pareto', 'Pareto', 'pareto.ai'],
    ['g2i', 'G2i', 'g2i.co'],
    ['rws-trainai', 'RWS TrainAI', 'rws.com', /trainai|ai data/i],
    ['oneforma', 'OneForma', 'oneforma.com'],
  ]),
  ...group('FRACTIONAL', [
    ['toptal', 'Toptal', 'toptal.com'],
    ['catalant', 'Catalant', 'catalant.com'],
    ['btg', 'Business Talent Group', 'businesstalentgroup.com'],
    ['bolster', 'Bolster', 'bolster.com'],
    ['fractional-jobs', 'Fractional Jobs', 'fractionaljobs.co, fractionaljobs.io'],
    ['gigx', 'GigX', 'gigx.com'],
    ['neogig', 'NeoGig', 'yourneogig.com, neogig.com'],
    ['chief-outsiders', 'Chief Outsiders', 'chiefoutsiders.com'],
    ['marketerhire', 'MarketerHire', 'marketerhire.com'],
    ['go-fractional', 'Go Fractional', 'gofractional.com'],
    ['paro', 'Paro', 'paro.ai, paro.io'],
    ['graphite', 'Graphite Financial', 'graphitefinancial.com'],
    ['umbrex', 'Umbrex', 'umbrex.com'],
    ['expert360', 'Expert360', 'expert360.com'],
    ['continuum', 'Continuum', 'continuum.work'],
    ['robert-half', 'Robert Half (interim)', 'roberthalf.com', /interim|project|consult|assignment|timesheet/i],
    ['korn-ferry-interim', 'Korn Ferry Interim', 'kornferry.com', /interim/i],
    ['heidrick-interim', 'Heidrick Interim', 'heidrick.com', /interim|on-demand/i],
  ]),
  ...group('FREELANCE', [
    ['upwork', 'Upwork', 'upwork.com'],
    ['fiverr', 'Fiverr Pro', 'fiverr.com'],
    ['contra', 'Contra', 'contra.com'],
    ['a-team', 'A.Team', 'a.team'],
    ['braintrust', 'Braintrust', 'usebraintrust.com, braintrust.com'],
    ['gun-io', 'Gun.io', 'gun.io'],
    ['arc', 'Arc', 'arc.dev'],
    ['andela', 'Andela', 'andela.com'],
    ['lemon', 'Lemon.io', 'lemon.io'],
    ['malt', 'Malt', 'malt.com'],
    ['kolabtree', 'Kolabtree', 'kolabtree.com'],
    ['freelancer', 'Freelancer.com', 'freelancer.com'],
    ['guru', 'Guru', 'guru.com'],
    ['working-not-working', 'Working Not Working', 'workingnotworking.com'],
  ]),
  ...group('EXPERT_NETWORK', [
    ['glg', 'GLG', 'glg.it, glgresearch.com, glginsights.com'],
    ['alphasights', 'AlphaSights', 'alphasights.com'],
    ['guidepoint', 'Guidepoint', 'guidepoint.com, guidepointglobal.com'],
    ['third-bridge', 'Third Bridge', 'thirdbridge.com'],
    ['coleman', 'Coleman Research', 'colemanrg.com'],
    ['dialectica', 'Dialectica', 'dialecticanet.com'],
    ['tegus', 'Tegus / AlphaSense', 'tegus.co, tegus.com, alphasense.com'],
    ['atheneum', 'Atheneum', 'atheneum.ai, atheneum-partners.com'],
    ['newtonx', 'NewtonX', 'newtonx.com'],
    ['office-hours', 'Office Hours', 'officehours.com'],
    ['prosapient', 'proSapient', 'prosapient.com'],
    ['capvision', 'Capvision', 'capvision.com'],
    ['inex-one', 'Inex One', 'inex.one'],
    ['zintro', 'Zintro', 'zintro.com'],
  ]),
  ...group('BOARD', [
    ['nacd', 'NACD', 'nacdonline.org'],
    ['boardprospects', 'BoardProspects', 'boardprospects.com'],
    ['athena', 'Athena Alliance', 'athenaalliance.com, athenaalliance.org'],
    ['theboardlist', 'theBoardlist', 'theboardlist.com'],
    ['boardsource', 'BoardSource', 'boardsource.org'],
    ['catchafire', 'Catchafire', 'catchafire.org'],
    ['equilar', 'Equilar BoardEdge', 'equilar.com'],
    ['wcd', 'Women Corporate Directors', 'womencorporatedirectors.org, wcdforum.org'],
    ['advisorycloud', 'AdvisoryCloud', 'advisorycloud.com'],
    ['taproot', 'Taproot Foundation', 'taprootfoundation.org, taprootplus.org'],
    ['boardready', 'BoardReady', 'boardready.io'],
  ]),
  ...group('RETURN_TO_WORK', [
    ['mom-project', 'The Mom Project', 'themomproject.com'],
    ['path-forward', 'Path Forward', 'pathforward.org'],
    ['irelaunch', 'iRelaunch', 'irelaunch.com'],
    ['flexjobs', 'FlexJobs', 'flexjobs.com'],
    ['powertofly', 'PowerToFly', 'powertofly.com'],
    ['fairygodboss', 'Fairygodboss', 'fairygodboss.com'],
    ['retirementjobs', 'RetirementJobs / Encore', 'retirementjobs.com, encore.org'],
  ]),

  // ── Learning ──────────────────────────────────────────────────────────
  ...group('OUTPLACEMENT', [
    ['lhh', 'LHH', 'lhh.com'],
    ['right-management', 'Right Management', 'right.com, manpowergroup.com', /right management|career|transition|coach|program/i],
    ['risesmart', 'Randstad RiseSmart', 'risesmart.com'],
    ['careerminds', 'Careerminds', 'careerminds.com'],
    ['korn-ferry-advance', 'Korn Ferry Advance', 'kornferry.com', /advance|career coach|transition/i],
    ['intoo', 'INTOO', 'intoo.com, intoo.us'],
    ['challenger', 'Challenger, Gray & Christmas', 'challengergray.com'],
    ['careerarc', 'CareerArc', 'careerarc.com'],
    ['keystone', 'Keystone Partners', 'keystonepartners.com'],
    ['ayers', 'The Ayers Group', 'theayersgroup.com'],
    ['velvetjobs', 'VelvetJobs', 'velvetjobs.com'],
    ['mercer-transition', 'Mercer career transition', 'mercer.com', /career transition|outplacement/i],
    ['torch', 'Torch', 'torch.io'],
    ['betterup', 'BetterUp', 'betterup.com, betterup.co'],
    ['bravely', 'Bravely', 'workbravely.com'],
  ]),
  ...group('GOVERNMENT', [
    ['careeronestop', 'CareerOneStop', 'careeronestop.org'],
    ['apprenticeship-gov', 'Apprenticeship.gov', 'apprenticeship.gov'],
    // State workforce agencies all use .gov — only training/reemployment
    // mail counts, never a tax notice or a personal note from a .gov worker.
    ['state-workforce', 'State workforce & American Job Center', '.gov', /\bwioa\b|workforce|reemployment|resea|american job center|career center|training (account|voucher|program|provider)|individual training account|job training|apprenticeship|dislocated worker|skillup|one-stop/i],
    ['metrix', 'Metrix Learning', 'metrixlearning.com'],
    ['skillup', 'SkillUp', 'skillup.org'],
    ['per-scholas', 'Per Scholas', 'perscholas.org'],
    ['year-up', 'Year Up', 'yearup.org'],
    ['npower', 'NPower', 'npower.org'],
    ['merit-america', 'Merit America', 'meritamerica.org'],
    ['generation', 'Generation', 'generation.org'],
    ['goodwill', 'Goodwill career training', 'goodwill.org', /training|course|program|digital career|enroll/i],
    ['jobcorps', 'Job Corps', 'jobcorps.gov'],
    ['veterans-va', 'VA VET TEC / GI Bill training', 'va.gov', /vet tec|gi bill|education benefit|training|vr&e|veteran readiness/i],
    ['hiring-our-heroes', 'Hiring Our Heroes', 'hiringourheroes.org'],
    ['onward-to-opportunity', 'Onward to Opportunity', 'onwardtoopportunity.org'],
    ['aarp-skills', 'AARP Skills Builder', 'aarp.org', /skills builder|backtowork|back to work|career|training|course/i],
    ['opportunity-at-work', 'Opportunity@Work / Stellarworx', 'opportunityatwork.org, stellarworx.org'],
  ]),
  ...group('COURSE_PLATFORM', [
    ['coursera', 'Coursera', 'coursera.org'],
    ['edx', 'edX', 'edx.org'],
    ['linkedin-learning', 'LinkedIn Learning', 'linkedin.com', /linkedin learning|learning[-_.]?(?:no-?reply|notifications?|messages?)?@linkedin/i],
    ['udemy', 'Udemy', 'udemy.com'],
    ['udacity', 'Udacity', 'udacity.com'],
    ['pluralsight', 'Pluralsight', 'pluralsight.com'],
    ['skillshare', 'Skillshare', 'skillshare.com'],
    ['masterclass', 'MasterClass', 'masterclass.com'],
    ['futurelearn', 'FutureLearn', 'futurelearn.com'],
    ['khan', 'Khan Academy', 'khanacademy.org'],
    ['simplilearn', 'Simplilearn', 'simplilearn.com, simplilearn.net'],
    ['maven', 'Maven', 'maven.com'],
    ['reforge', 'Reforge', 'reforge.com'],
    ['section', 'Section', 'sectionschool.com, sectionai.com'],
    ['great-courses', 'Wondrium / The Great Courses', 'wondrium.com, thegreatcourses.com'],
    ['alison', 'Alison', 'alison.com'],
    ['domestika', 'Domestika', 'domestika.org'],
    ['open-university', 'OpenLearn', 'open.ac.uk'],
    ['toastmasters', 'Toastmasters', 'toastmasters.org'],
    ['dale-carnegie', 'Dale Carnegie', 'dalecarnegie.com'],
    ['success-coaching', 'Success Coaching', 'successcoaching.co'],
    ['franklin-covey', 'FranklinCovey', 'franklincovey.com'],
    ['amanet', 'American Management Association', 'amanet.org'],
    ['noodle', 'Noodle', 'noodle.com'],
    ['emeritus', 'Emeritus', 'emeritus.org'],
    ['getsmarter', 'GetSmarter', 'getsmarter.com'],
  ]),
  ...group('AI_LEARNING', [
    ['deeplearning-ai', 'DeepLearning.AI', 'deeplearning.ai'],
    ['anthropic-academy', 'Anthropic Academy', 'anthropic.com, skilljar.com', /academy|course|skilljar|learn/i],
    ['openai-academy', 'OpenAI Academy', 'openai.com', /academy|course|learn|certif/i],
    ['google-ai-essentials', 'Google AI Essentials / Grow with Google', 'grow.google, google.com', /grow with google|career certificate|ai essentials|google career|google skills|skillshop/i],
    ['microsoft-ai-skills', 'Microsoft Learn (AI Skills)', 'microsoft.com, learn.microsoft.com', /microsoft learn|ai skills|certification|training|exam|credential/i],
    ['nvidia-dli', 'NVIDIA Deep Learning Institute', 'nvidia.com', /deep learning institute|\bdli\b|course|certif/i],
    ['hugging-face', 'Hugging Face Learn', 'huggingface.co', /course|learn|certificate/i],
    ['kaggle-learn', 'Kaggle Learn', 'kaggle.com', /learn|course|certificate/i],
    ['elements-of-ai', 'Elements of AI', 'elementsofai.com'],
    ['prompt-engineering', 'Learn Prompting', 'learnprompting.org'],
    ['ibm-skillsbuild', 'IBM SkillsBuild', 'ibm.com, skillsbuild.org', /skillsbuild|course|badge|learning|credential/i],
    ['aws-skill-builder', 'AWS Skill Builder', 'amazon.com, aws.amazon.com, amazonaws.com', /skill builder|aws training|aws certification|aws certified|learning plan/i],
    ['google-cloud-skills', 'Google Cloud Skills Boost', 'cloudskillsboost.google, qwiklabs.com'],
    ['fast-ai', 'fast.ai', 'fast.ai'],
    ['datacamp', 'DataCamp', 'datacamp.com'],
  ]),
  ...group('CODING', [
    ['codecademy', 'Codecademy', 'codecademy.com'],
    ['freecodecamp', 'freeCodeCamp', 'freecodecamp.org'],
    ['treehouse', 'Treehouse', 'teamtreehouse.com'],
    ['scrimba', 'Scrimba', 'scrimba.com'],
    ['frontend-masters', 'Frontend Masters', 'frontendmasters.com'],
    ['educative', 'Educative', 'educative.io'],
    ['exercism', 'Exercism', 'exercism.org'],
    ['boot-dev', 'Boot.dev', 'boot.dev'],
    ['zero-to-mastery', 'Zero To Mastery', 'zerotomastery.io'],
    ['leetcode', 'LeetCode', 'leetcode.com'],
    ['hackerrank', 'HackerRank', 'hackerrank.com'],
    ['codewars', 'Codewars', 'codewars.com'],
    ['brilliant', 'Brilliant', 'brilliant.org'],
    ['egghead', 'egghead', 'egghead.io'],
    ['laracasts', 'Laracasts', 'laracasts.com'],
    ['oreilly', "O'Reilly Learning", 'oreilly.com'],
    ['a-cloud-guru', 'A Cloud Guru', 'acloudguru.com'],
    ['linux-foundation', 'Linux Foundation Training', 'linuxfoundation.org'],
    ['github-skills', 'GitHub Skills / Certifications', 'github.com', /certification|exam|github skills|learning/i],
  ]),
  ...group('VENDOR_ACADEMY', [
    ['salesforce-trailhead', 'Salesforce Trailhead', 'trailhead.com, salesforce.com', /trailhead|certification|exam|superbadge|badge/i],
    ['hubspot-academy', 'HubSpot Academy', 'hubspot.com', /academy|certification|certificate|course/i],
    ['meta-blueprint', 'Meta Blueprint', 'meta.com, facebookmail.com, fb.com', /blueprint|certification|exam/i],
    ['cisco-netacad', 'Cisco Networking Academy', 'netacad.com'],
    ['cisco-learning', 'Cisco Learning Network', 'cisco.com', /certification|exam|learning network|course/i],
    ['oracle-university', 'Oracle University', 'oracle.com', /oracle university|certification|exam|learning/i],
    ['sap-learning', 'SAP Learning', 'sap.com', /sap learning|certification|exam|course/i],
    ['servicenow-university', 'ServiceNow University', 'servicenow.com', /university|now learning|certification|exam/i],
    ['tableau-learning', 'Tableau Learning', 'tableau.com', /certification|exam|training|elearning/i],
    ['adobe-learn', 'Adobe certifications', 'adobe.com', /certified|certification|exam|learn/i],
    ['atlassian-university', 'Atlassian University', 'atlassian.com', /university|certification|course/i],
    ['semrush-academy', 'Semrush Academy', 'semrush.com', /academy|certification|course/i],
    ['workday-learning', 'Workday Learning', 'workday.com', /certification|training|learning/i],
  ]),
  ...group('PRO_CERT', [
    ['pmi', 'PMI (PMP, CAPM)', 'pmi.org'],
    ['shrm', 'SHRM', 'shrm.org'],
    ['hrci', 'HRCI', 'hrci.org'],
    ['cfa', 'CFA Institute', 'cfainstitute.org'],
    ['aicpa', 'AICPA & CIMA', 'aicpa-cima.com, aicpa.org'],
    ['garp', 'GARP (FRM)', 'garp.org'],
    ['isaca', 'ISACA', 'isaca.org'],
    ['isc2', 'ISC2 (CISSP)', 'isc2.org'],
    ['comptia', 'CompTIA', 'comptia.org'],
    ['scrum-alliance', 'Scrum Alliance', 'scrumalliance.org'],
    ['scrum-org', 'Scrum.org', 'scrum.org'],
    ['asq', 'ASQ (Six Sigma)', 'asq.org'],
    ['ascm', 'ASCM / APICS', 'ascm.org, apics.org'],
    ['iiba', 'IIBA', 'iiba.org'],
    ['iapp', 'IAPP (privacy)', 'iapp.org'],
    ['ima', 'IMA (CMA)', 'imanet.org'],
    ['iia', 'IIA (CIA)', 'theiia.org'],
    ['cfp-board', 'CFP Board', 'cfp.net'],
    ['finra', 'FINRA exams', 'finra.org'],
    ['nasba', 'NASBA / CPA exam', 'nasba.org'],
    ['atd', 'ATD (talent development)', 'td.org'],
    ['ama-marketing', 'American Marketing Association', 'ama.org'],
    ['peoplecert', 'PeopleCert / AXELOS (PRINCE2, ITIL)', 'axelos.com, peoplecert.org'],
    ['cncf', 'CNCF (Kubernetes certifications)', 'cncf.io'],
    ['scce', 'SCCE & HCCA (compliance)', 'corporatecompliance.org, hcca-info.org'],
    ['iaap', 'IAAP (administrative professionals)', 'iaap-hq.org'],
  ]),
  ...group('CREDENTIAL_SERVICE', [
    ['pearson-vue', 'Pearson VUE', 'pearsonvue.com, pearson.com', /exam|test|appointment|certification|score/i],
    ['prometric', 'Prometric', 'prometric.com'],
    ['psi', 'PSI Exams', 'psiexams.com, psionline.com'],
    ['credly', 'Credly', 'credly.com'],
    ['accredible', 'Accredible', 'accredible.com, credential.net'],
    ['certiport', 'Certiport', 'certiport.com'],
    ['badgr', 'Badgr / Canvas Credentials', 'badgr.com, badgr.io'],
    ['parchment', 'Parchment', 'parchment.com'],
  ]),
  ...group('EXEC_ED', [
    ['hbs-online', 'Harvard Business School Online', 'hbs.edu', /hbs online|online|executive education|course|program|credential/i],
    ['harvard-extension', 'Harvard Extension / DCE', 'harvard.edu', /extension|dce|division of continuing|professional development|online|course/i],
    ['mit', 'MIT xPRO / Sloan Exec Ed', 'mit.edu', UNI_LEARNING],
    ['stanford', 'Stanford Online / GSB Exec Ed', 'stanford.edu', UNI_LEARNING],
    ['wharton', 'Wharton Online / Exec Ed', 'upenn.edu', UNI_LEARNING],
    ['columbia', 'Columbia Exec Ed', 'columbia.edu', UNI_LEARNING],
    ['kellogg', 'Kellogg Exec Ed', 'northwestern.edu', UNI_LEARNING],
    ['booth', 'Chicago Booth Exec Ed', 'chicagobooth.edu, uchicago.edu', UNI_LEARNING],
    ['berkeley', 'Berkeley Exec Ed', 'berkeley.edu', UNI_LEARNING],
    ['ecornell', 'eCornell', 'ecornell.com, ecornell.cornell.edu'],
    ['yale-som', 'Yale SOM Exec Ed', 'yale.edu', UNI_LEARNING],
    ['duke-ce', 'Duke Exec Ed', 'duke.edu', UNI_LEARNING],
    ['michigan-ross', 'Michigan Ross Exec Ed', 'umich.edu', UNI_LEARNING],
    ['darden', 'Darden Exec Ed', 'virginia.edu', UNI_LEARNING],
    ['insead', 'INSEAD', 'insead.edu', UNI_LEARNING],
    ['lbs', 'London Business School', 'london.edu', UNI_LEARNING],
    ['imd', 'IMD', 'imd.org', UNI_LEARNING],
    ['oxford-said', 'Oxford Saïd Exec Ed', 'ox.ac.uk', UNI_LEARNING],
    ['cambridge-judge', 'Cambridge Judge Exec Ed', 'cam.ac.uk', UNI_LEARNING],
    ['nyu-sps', 'NYU SPS / Stern Exec Ed', 'nyu.edu', UNI_LEARNING],
    ['georgetown-scs', 'Georgetown SCS', 'georgetown.edu', UNI_LEARNING],
    ['notre-dame', 'Notre Dame Exec Ed', 'nd.edu', UNI_LEARNING],
    ['ucla-anderson', 'UCLA Anderson / Extension', 'ucla.edu', UNI_LEARNING],
    ['usc', 'USC Online / Exec Ed', 'usc.edu', UNI_LEARNING],
  ]),
  ...group('ONLINE_DEGREE', [
    ['georgia-tech', 'Georgia Tech OMSCS / OMSA', 'gatech.edu', UNI_LEARNING],
    ['uiuc', 'UIUC iMBA / MCS', 'illinois.edu', UNI_LEARNING],
    ['wgu', 'WGU', 'wgu.edu'],
    ['snhu', 'SNHU', 'snhu.edu'],
    ['asu', 'ASU Online', 'asu.edu', UNI_LEARNING],
    ['purdue-global', 'Purdue Global', 'purdueglobal.edu'],
    ['umgc', 'UMGC', 'umgc.edu'],
    ['penn-state-world', 'Penn State World Campus', 'psu.edu', UNI_LEARNING],
    ['university-of-phoenix', 'University of Phoenix', 'phoenix.edu'],
    ['capella', 'Capella University', 'capella.edu'],
    ['excelsior', 'Excelsior University', 'excelsior.edu'],
    ['uopeople', 'University of the People', 'uopeople.edu'],
    ['2u', '2U programs', '2u.com'],
    ['boston-university', 'BU Online / Questrom', 'bu.edu', UNI_LEARNING],
    ['jhu', 'Johns Hopkins Online / Engineering for Professionals', 'jhu.edu', UNI_LEARNING],
  ]),
  ...group('BOOTCAMP', [
    ['general-assembly', 'General Assembly', 'generalassemb.ly, ga.co'],
    ['springboard', 'Springboard', 'springboard.com'],
    ['flatiron', 'Flatiron School', 'flatironschool.com'],
    ['bloomtech', 'BloomTech', 'bloomtech.com'],
    ['hack-reactor', 'Hack Reactor', 'hackreactor.com'],
    ['tripleten', 'TripleTen', 'tripleten.com'],
    ['le-wagon', 'Le Wagon', 'lewagon.com, lewagon.org'],
    ['product-school', 'Product School', 'productschool.com'],
    ['careerfoundry', 'CareerFoundry', 'careerfoundry.com'],
    ['brainstation', 'BrainStation', 'brainstation.io'],
    ['ironhack', 'Ironhack', 'ironhack.com'],
    ['app-academy', 'App Academy', 'appacademy.io'],
    ['coding-dojo', 'Coding Dojo', 'codingdojo.com'],
    ['nucamp', 'Nucamp', 'nucamp.co'],
    ['codesmith', 'Codesmith', 'codesmith.io'],
    ['launch-school', 'Launch School', 'launchschool.com'],
    ['tech-elevator', 'Tech Elevator', 'techelevator.com'],
    ['turing-school', 'Turing School', 'turing.edu'],
    ['thinkful', 'Thinkful', 'thinkful.com'],
    ['data-science-dojo', 'Data Science Dojo', 'datasciencedojo.com'],
    ['edx-bootcamps', 'edX Boot Camps (2U)', 'bootcamp.edx.org, bootcampspot.com'],
    ['fullstack-academy', 'Fullstack Academy', 'fullstackacademy.com'],
    ['multiverse', 'Multiverse (apprenticeships)', 'multiverse.io'],
  ]),
]

const BY_KEY = new Map(PLATFORM_DIRECTORY.map((p) => [p.key, p]))

export function getPlatform(key: string): PlatformEntry | undefined {
  return BY_KEY.get(key)
}

// Domain → every entry that claims it, gated entries after dedicated ones.
const BY_DOMAIN = new Map<string, PlatformEntry[]>()
for (const p of PLATFORM_DIRECTORY) {
  for (const d of p.domains) {
    const list = BY_DOMAIN.get(d) ?? []
    list.push(p)
    BY_DOMAIN.set(d, list)
  }
}
for (const list of BY_DOMAIN.values()) list.sort((a, b) => Number(!!a.gate) - Number(!!b.gate))

/**
 * Every directory entry whose domains cover this sender domain, most
 * specific domain first ("bootcamp.edx.org" before "edx.org"), then
 * dedicated before gated. A bare ".gov" entry matches any *.gov sender.
 */
export function platformsForSenderDomain(senderDomain: string): PlatformEntry[] {
  const labels = senderDomain.toLowerCase().replace(/\.$/, '').split('.')
  const out: PlatformEntry[] = []
  for (let i = 0; i < labels.length - 1; i++) {
    const suffix = labels.slice(i).join('.')
    for (const p of BY_DOMAIN.get(suffix) ?? []) if (!out.includes(p)) out.push(p)
  }
  const tld = `.${labels[labels.length - 1]}`
  for (const p of BY_DOMAIN.get(tld) ?? []) if (!out.includes(p)) out.push(p)
  return out
}

/** Root domains (no bare TLD rules) for building a Gmail `from:` search. */
export function allSenderDomains(): string[] {
  return [...BY_DOMAIN.keys()].filter((d) => !d.startsWith('.'))
}
