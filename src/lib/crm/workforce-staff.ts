/**
 * The staff list for the workforce system: the people who work at a local workforce board, an American Job Center
 * or a state workforce agency (not the board's volunteer members, who stay on the board list). Each person gets a
 * role (what they do) and a level (senior or mid), read from their title. Pure.
 */
export type WorkforceStaffRole = 'rapid_response' | 'business_services' | 'program' | 'leadership' | 'operations' | 'board_member' | 'other'
export type WorkforceStaffLevel = 'senior' | 'mid' | 'junior' | 'unknown'

export const WORKFORCE_STAFF_ROLES: WorkforceStaffRole[] = ['rapid_response', 'business_services', 'program', 'leadership', 'operations', 'board_member', 'other']
export const WORKFORCE_STAFF_LEVELS: WorkforceStaffLevel[] = ['senior', 'mid', 'junior', 'unknown']
export const ROLE_LABEL: Record<WorkforceStaffRole, string> = {
  rapid_response: 'Rapid response', business_services: 'Business services', program: 'Programs and career services',
  leadership: 'Leadership', operations: 'Operations', board_member: 'Board member (volunteer)', other: 'Other',
}

/** An organization that is a workforce board, job center or state workforce agency, by name. */
export const WORKFORCE_ORG_NAME = /\b(workforce|job cent(er|re)s?|one[- ]stop|careerone|career cent(er|re)|rapid response|workforce (board|development|investment|solutions|services)|wioa|employment (development|security|services) (department|commission|division|agency)|department of (labor|employment))\b/i
/** Names that match the pattern but are not part of the public workforce system. */
const NOT_SYSTEM_ORG = /\b(university|college|school|goodwill|staffing|recruit\w*)\b/i

export function isWorkforceSystemOrg(name: string): boolean {
  return WORKFORCE_ORG_NAME.test(name) && !NOT_SYSTEM_ORG.test(name)
}

const BOARD_MEMBER = /\b(board (chair|vice[- ]?chair|member|president|treasurer|secretary)|(vice[- ])?chair(man|woman|person)?\b(?!.*(staff|operations))|commissioner|trustee|council member|councilmember|councilman|councilwoman)\b/i
const RAPID = /\b(rapid response|dislocated worker|layoff aversion|business (retention|engagement)|lay-?off)\b/i
const BUSINESS = /\b(business (services|solutions|liaison|representative|rep|account)|employer (services|engagement|relations|solutions|outreach|liaison|account)|account (manager|executive)|industry (liaison|partnership|sector)|sector (strateg|partner|manager|director)|talent (solutions|partnership)|work-?based learning|apprenticeship|on-the-job)\b/i
const OPERATIONS = /\b(finance|fiscal|accounting|accountant|budget|grants?|contracts?|procurement|compliance|monitoring|audit|quality assurance|performance|data|research|analyst|it |information|technology|communications|marketing|outreach|human resources|\bhr\b|legal|counsel|policy|legislative|administrative|operations)\b/i
const PROGRAM = /\b(program|career (services|advisor|counselor|coach|navigator)|case manager|workforce (development|services|specialist|advisor|consultant)|employment (specialist|counselor|services|coordinator)|youth|adult|veteran|one[- ]stop|job center|american job center|training|education|wioa|navigator|counselor|service delivery|operator|career)\b/i
const LEADERSHIP = /\b(executive director|director|ceo|chief|president|vice president|vp|deputy|head of|commissioner|secretary|administrator|superintendent|general manager|managing)\b/i

const SENIOR = /\b(executive director|ceo|chief|president|vice president|\bvp\b|svp|evp|deputy|director|head of|commissioner|secretary|administrator|superintendent|general manager|senior (manager|program|policy|advisor|specialist|analyst|officer)|assistant (director|commissioner|secretary)|bureau chief|division chief|section chief)\b/i
const MID = /\b(manager|supervisor|coordinator|lead|specialist|officer|analyst|advisor|consultant|representative|counselor|coach|navigator|case manager|liaison|planner|strategist|project|team)\b/i
const JUNIOR = /\b(assistant|intern|clerk|receptionist|aide|associate(?! (director|commissioner))|trainee|technician|fellow|volunteer|student|admin(istrative)? (support|assistant))\b/i

export interface WorkforceStaffTag { role: WorkforceStaffRole; level: WorkforceStaffLevel }

export function classifyWorkforceStaff(title: string | null | undefined): WorkforceStaffTag {
  const t = (title ?? '').trim()
  if (!t) return { role: 'other', level: 'unknown' }
  const staffy = /\b(workforce|rapid|business services|program|operations|staff)\b/i.test(t)
  if (BOARD_MEMBER.test(t) && !(/\b(commissioner|secretary)\b/i.test(t) && staffy && !/board/i.test(t))) return { role: 'board_member', level: 'unknown' }
  const role: WorkforceStaffRole = RAPID.test(t) ? 'rapid_response'
    : BUSINESS.test(t) ? 'business_services'
    : OPERATIONS.test(t) && !PROGRAM.test(t) ? 'operations'
    : PROGRAM.test(t) ? 'program'
    : LEADERSHIP.test(t) ? 'leadership'
    : OPERATIONS.test(t) ? 'operations'
    : 'other'
  // "Assistant director" is senior; any other assistant or associate is junior.
  const level: WorkforceStaffLevel = /\bassistant (director|commissioner|secretary)\b/i.test(t) ? 'senior'
    : JUNIOR.test(t) ? 'junior'
    : SENIOR.test(t) ? 'senior'
    : MID.test(t) ? 'mid'
    : 'unknown'
  return { role, level }
}
