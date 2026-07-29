// lastVerified: 2026-07-29 — exec-ed program URLs and names change more
// often than degree programs; re-check every URL before merging
// Learning-page UI work on top of this file.
//
// Matched against EducationEntry.schoolNameNormalized (parent institution
// only, per the resume-extraction convention — never a sub-school name)
// via normalizeOrgName, so "Michigan Ross", "University of Michigan", and
// "UMich" all resolve to the same entry. If a candidate's primary school
// isn't in this table, only this one card is absent — the rest of the
// Business Skills section still renders.
import { normalizeOrgName } from '@/lib/text/org-name-match'
import type { LearningResource } from '@/lib/constants/learning-partners'

interface ExecEdSchoolEntry {
  aliases: string[] // includes the parent institution's own name
  program: LearningResource
}

const EXEC_ED_SCHOOLS: ExecEdSchoolEntry[] = [
  {
    aliases: ['harvard university', 'harvard business school', 'hbs'],
    program: { title: 'Harvard Business School Executive Education', description: 'Executive programs from HBS.', url: 'https://www.exed.hbs.edu/', provider: 'universityExecEd', free: false, actionType: 'LEARNING_CERTIFICATE' },
  },
  {
    aliases: ['stanford university', 'stanford graduate school of business', 'stanford gsb'],
    program: { title: 'Stanford GSB Executive Education', description: 'Executive programs from Stanford Graduate School of Business.', url: 'https://www.gsb.stanford.edu/exec-ed', provider: 'universityExecEd', free: false, actionType: 'LEARNING_CERTIFICATE' },
  },
  {
    aliases: ['university of pennsylvania', 'wharton', 'wharton school'],
    program: { title: 'Wharton Executive Education', description: "Executive programs from Penn's Wharton School.", url: 'https://executiveeducation.wharton.upenn.edu/', provider: 'universityExecEd', free: false, actionType: 'LEARNING_CERTIFICATE' },
  },
  {
    aliases: ['massachusetts institute of technology', 'mit', 'mit sloan'],
    program: { title: 'MIT Sloan Executive Education', description: 'Executive programs from MIT Sloan School of Management.', url: 'https://executive.mit.edu/', provider: 'universityExecEd', free: false, actionType: 'LEARNING_CERTIFICATE' },
  },
  {
    aliases: ['university of chicago', 'chicago booth', 'booth school of business'],
    program: { title: 'Chicago Booth Executive Education', description: 'Executive programs from University of Chicago Booth School of Business.', url: 'https://www.chicagobooth.edu/executive-education', provider: 'universityExecEd', free: false, actionType: 'LEARNING_CERTIFICATE' },
  },
  {
    aliases: ['northwestern university', 'kellogg', 'kellogg school of management'],
    program: { title: 'Kellogg Executive Education', description: "Executive programs from Northwestern's Kellogg School of Management.", url: 'https://www.kellogg.northwestern.edu/executive-education/', provider: 'universityExecEd', free: false, actionType: 'LEARNING_CERTIFICATE' },
  },
  {
    aliases: ['columbia university', 'columbia business school'],
    program: { title: 'Columbia Business School Executive Education', description: 'Executive programs from Columbia Business School.', url: 'https://executive.business.columbia.edu/', provider: 'universityExecEd', free: false, actionType: 'LEARNING_CERTIFICATE' },
  },
  {
    aliases: ['university of california berkeley', 'uc berkeley', 'berkeley haas'],
    program: { title: 'Berkeley Haas Executive Education', description: "Executive programs from UC Berkeley's Haas School of Business.", url: 'https://executive.berkeley.edu/', provider: 'universityExecEd', free: false, actionType: 'LEARNING_CERTIFICATE' },
  },
  {
    aliases: ['university of california los angeles', 'ucla', 'ucla anderson'],
    program: { title: 'UCLA Anderson Executive Education', description: "Executive programs from UCLA's Anderson School of Management.", url: 'https://www.anderson.ucla.edu/executive-education', provider: 'universityExecEd', free: false, actionType: 'LEARNING_CERTIFICATE' },
  },
  {
    aliases: ['university of michigan', 'umich', 'michigan ross'],
    program: { title: 'Michigan Ross Executive Education', description: "Executive programs from University of Michigan's Ross School of Business.", url: 'https://michiganross.umich.edu/programs/executive-education', provider: 'universityExecEd', free: false, actionType: 'LEARNING_CERTIFICATE' },
  },
  {
    aliases: ['duke university', 'duke fuqua', 'fuqua school of business'],
    program: { title: 'Duke Fuqua Executive Education', description: "Executive programs from Duke's Fuqua School of Business.", url: 'https://www.fuqua.duke.edu/executive-education', provider: 'universityExecEd', free: false, actionType: 'LEARNING_CERTIFICATE' },
  },
  {
    aliases: ['yale university', 'yale som', 'yale school of management'],
    program: { title: 'Yale SOM Executive Education', description: "Executive programs from Yale's School of Management.", url: 'https://exed.som.yale.edu/', provider: 'universityExecEd', free: false, actionType: 'LEARNING_CERTIFICATE' },
  },
  {
    aliases: ['new york university', 'nyu', 'nyu stern'],
    program: { title: 'NYU Stern Executive Education', description: "Executive programs from NYU's Stern School of Business.", url: 'https://www.stern.nyu.edu/experience-stern/executive-education', provider: 'universityExecEd', free: false, actionType: 'LEARNING_CERTIFICATE' },
  },
  {
    aliases: ['cornell university', 'cornell'],
    program: { title: 'Cornell Executive Education', description: "Executive programs from Cornell's eCornell platform.", url: 'https://www.eexecutive.cornell.edu/', provider: 'universityExecEd', free: false, actionType: 'LEARNING_CERTIFICATE' },
  },
  {
    aliases: ['dartmouth college', 'dartmouth', 'tuck school of business'],
    program: { title: 'Tuck Executive Education', description: "Executive programs from Dartmouth's Tuck School of Business.", url: 'https://www.tuck.dartmouth.edu/execed', provider: 'universityExecEd', free: false, actionType: 'LEARNING_CERTIFICATE' },
  },
  {
    aliases: ['university of virginia', 'uva', 'darden school of business'],
    program: { title: 'Darden Executive Education', description: "Executive programs from UVA's Darden School of Business.", url: 'https://www.darden.virginia.edu/executive-education', provider: 'universityExecEd', free: false, actionType: 'LEARNING_CERTIFICATE' },
  },
  {
    aliases: ['university of texas at austin', 'ut austin', 'mccombs school of business'],
    program: { title: 'McCombs Executive Education', description: "Executive programs from UT Austin's McCombs School of Business.", url: 'https://www.mccombs.utexas.edu/execed/', provider: 'universityExecEd', free: false, actionType: 'LEARNING_CERTIFICATE' },
  },
  {
    aliases: ['university of north carolina', 'unc', 'unc chapel hill', 'kenan-flagler'],
    program: { title: 'Kenan-Flagler Executive Development', description: "Executive programs from UNC's Kenan-Flagler Business School.", url: 'https://www.kenan-flagler.unc.edu/executive-development/', provider: 'universityExecEd', free: false, actionType: 'LEARNING_CERTIFICATE' },
  },
  {
    aliases: ['emory university', 'emory', 'goizueta business school'],
    program: { title: 'Goizueta Executive Education', description: "Executive programs from Emory's Goizueta Business School.", url: 'https://goizueta.emory.edu/executive-education', provider: 'universityExecEd', free: false, actionType: 'LEARNING_CERTIFICATE' },
  },
  {
    aliases: ['georgetown university', 'georgetown', 'mcdonough school of business'],
    program: { title: 'McDonough Executive Education', description: "Executive programs from Georgetown's McDonough School of Business.", url: 'https://msb.georgetown.edu/programs/executive-education/', provider: 'universityExecEd', free: false, actionType: 'LEARNING_CERTIFICATE' },
  },
  {
    aliases: ['carnegie mellon university', 'cmu', 'tepper school of business'],
    program: { title: 'Tepper Executive Education', description: "Executive programs from Carnegie Mellon's Tepper School of Business.", url: 'https://www.cmu.edu/tepper/programs/executive-education/', provider: 'universityExecEd', free: false, actionType: 'LEARNING_CERTIFICATE' },
  },
  {
    aliases: ['university of southern california', 'usc', 'usc marshall'],
    program: { title: 'USC Marshall Executive Education', description: "Executive programs from USC's Marshall School of Business.", url: 'https://www.marshall.usc.edu/programs/executive-education', provider: 'universityExecEd', free: false, actionType: 'LEARNING_CERTIFICATE' },
  },
  {
    aliases: ['university of notre dame', 'notre dame', 'mendoza college of business'],
    program: { title: 'Mendoza Executive Education', description: "Executive programs from Notre Dame's Mendoza College of Business.", url: 'https://mendoza.nd.edu/executive-education/', provider: 'universityExecEd', free: false, actionType: 'LEARNING_CERTIFICATE' },
  },
  {
    aliases: ['vanderbilt university', 'vanderbilt', 'owen graduate school of management'],
    program: { title: 'Vanderbilt Owen Executive Education', description: "Executive programs from Vanderbilt's Owen Graduate School of Management.", url: 'https://business.vanderbilt.edu/execed/', provider: 'universityExecEd', free: false, actionType: 'LEARNING_CERTIFICATE' },
  },
  {
    aliases: ['washington university in st louis', 'washu', 'olin business school'],
    program: { title: 'Olin Executive Education', description: "Executive programs from Washington University's Olin Business School.", url: 'https://olin.wustl.edu/executive-education', provider: 'universityExecEd', free: false, actionType: 'LEARNING_CERTIFICATE' },
  },
  {
    aliases: ['indiana university', 'kelley school of business'],
    program: { title: 'Kelley Executive Education', description: "Executive programs from Indiana University's Kelley School of Business.", url: 'https://execed.kelley.iu.edu/', provider: 'universityExecEd', free: false, actionType: 'LEARNING_CERTIFICATE' },
  },
  {
    aliases: ['ohio state university', 'osu', 'fisher college of business'],
    program: { title: 'Fisher Executive Education', description: "Executive programs from Ohio State's Fisher College of Business.", url: 'https://fisher.osu.edu/executive-education', provider: 'universityExecEd', free: false, actionType: 'LEARNING_CERTIFICATE' },
  },
  {
    aliases: ['penn state university', 'penn state', 'smeal college of business'],
    program: { title: 'Smeal Executive Programs', description: "Executive programs from Penn State's Smeal College of Business.", url: 'https://www.smeal.psu.edu/execedu', provider: 'universityExecEd', free: false, actionType: 'LEARNING_CERTIFICATE' },
  },
  {
    aliases: ['purdue university', 'purdue', 'krannert school of management'],
    program: { title: 'Krannert Executive Education', description: "Executive programs from Purdue's Krannert School of Management.", url: 'https://krannert.purdue.edu/programs/executive-education/', provider: 'universityExecEd', free: false, actionType: 'LEARNING_CERTIFICATE' },
  },
  {
    aliases: ['georgia institute of technology', 'georgia tech', 'scheller college of business'],
    program: { title: 'Scheller Executive Education', description: "Executive programs from Georgia Tech's Scheller College of Business.", url: 'https://www.scheller.gatech.edu/execed/', provider: 'universityExecEd', free: false, actionType: 'LEARNING_CERTIFICATE' },
  },
  {
    aliases: ['rice university', 'rice', 'jones graduate school of business'],
    program: { title: 'Rice Jones Executive Education', description: "Executive programs from Rice University's Jones Graduate School of Business.", url: 'https://business.rice.edu/executive-education', provider: 'universityExecEd', free: false, actionType: 'LEARNING_CERTIFICATE' },
  },
  {
    aliases: ['university of minnesota', 'minnesota', 'carlson school of management'],
    program: { title: 'Carlson Executive Education', description: "Executive programs from University of Minnesota's Carlson School of Management.", url: 'https://carlsonschool.umn.edu/executive-education', provider: 'universityExecEd', free: false, actionType: 'LEARNING_CERTIFICATE' },
  },
  {
    aliases: ['university of wisconsin madison', 'wisconsin', 'wisconsin school of business'],
    program: { title: 'Wisconsin Executive Education', description: "Executive programs from University of Wisconsin-Madison's business school.", url: 'https://uwexeced.wisc.edu/', provider: 'universityExecEd', free: false, actionType: 'LEARNING_CERTIFICATE' },
  },
  {
    aliases: ['university of maryland', 'maryland', 'robert h smith school of business'],
    program: { title: 'Smith Executive Education', description: "Executive programs from University of Maryland's Robert H. Smith School of Business.", url: 'https://www.rhsmith.umd.edu/executive-education', provider: 'universityExecEd', free: false, actionType: 'LEARNING_CERTIFICATE' },
  },
  {
    aliases: ['boston university', 'bu', 'questrom school of business'],
    program: { title: 'Questrom Executive Education', description: "Executive programs from Boston University's Questrom School of Business.", url: 'https://www.bu.edu/questrom/executive-education/', provider: 'universityExecEd', free: false, actionType: 'LEARNING_CERTIFICATE' },
  },
  {
    aliases: ['northeastern university', 'northeastern', "d'amore-mckim school of business"],
    program: { title: "D'Amore-McKim Executive Education", description: "Executive programs from Northeastern's D'Amore-McKim School of Business.", url: 'https://damore-mckim.northeastern.edu/executive-education/', provider: 'universityExecEd', free: false, actionType: 'LEARNING_CERTIFICATE' },
  },
  {
    aliases: ['arizona state university', 'asu', 'w p carey school of business'],
    program: { title: 'W. P. Carey Executive Education', description: "Executive programs from Arizona State's W. P. Carey School of Business.", url: 'https://execed.wpcarey.asu.edu/', provider: 'universityExecEd', free: false, actionType: 'LEARNING_CERTIFICATE' },
  },
  {
    aliases: ['rutgers university', 'rutgers'],
    program: { title: 'Rutgers Executive Education', description: "Executive programs from Rutgers Business School.", url: 'https://www.business.rutgers.edu/executive-education', provider: 'universityExecEd', free: false, actionType: 'LEARNING_CERTIFICATE' },
  },
  {
    aliases: ['university of washington', 'washington', 'foster school of business'],
    program: { title: 'Foster Executive Education', description: "Executive programs from University of Washington's Foster School of Business.", url: 'https://foster.uw.edu/executive-education/', provider: 'universityExecEd', free: false, actionType: 'LEARNING_CERTIFICATE' },
  },
  {
    aliases: ['university of colorado boulder', 'colorado', 'leeds school of business'],
    program: { title: 'Leeds Executive Education', description: "Executive programs from University of Colorado Boulder's Leeds School of Business.", url: 'https://www.colorado.edu/business/executive-education', provider: 'universityExecEd', free: false, actionType: 'LEARNING_CERTIFICATE' },
  },
  {
    aliases: ['university of illinois', 'illinois', 'university of illinois urbana-champaign', 'gies college of business'],
    program: { title: 'Gies Executive Education', description: "Executive programs from University of Illinois's Gies College of Business.", url: 'https://giesbusiness.illinois.edu/executive-education', provider: 'universityExecEd', free: false, actionType: 'LEARNING_CERTIFICATE' },
  },
]

const LOOKUP = new Map<string, LearningResource>()
for (const entry of EXEC_ED_SCHOOLS) {
  for (const alias of entry.aliases) {
    LOOKUP.set(normalizeOrgName(alias), entry.program)
  }
}

export function getExecEdProgram(schoolNameNormalized: string): LearningResource | null {
  return LOOKUP.get(normalizeOrgName(schoolNameNormalized)) ?? null
}
