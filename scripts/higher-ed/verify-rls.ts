// HE-01 RLS tests (spec §11): staff with the role, staff without it, the
// member, another member and an anonymous user, against every Higher Ed
// policy that gates candidate data.
//
// Everything runs inside ONE transaction that is always rolled back, so no
// fixture row ever persists. Personas are simulated the way Supabase does it:
// `set local role authenticated|anon` plus request.jwt.claims.
//
//   npm run verify:he-rls
//
// Before the schema is pushed, it can dry-run the whole migration in the
// same rolled-back transaction:
//
//   npm run verify:he-rls -- --ddl path/to/migration.sql --apply-rls
import { readFileSync } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { PrismaClient, Prisma } from '@prisma/client'
import { splitSqlStatements } from './sql-statements'

type Tx = Prisma.TransactionClient
class Rollback extends Error {}

const args = process.argv.slice(2)
const ddlFile = args.includes('--ddl') ? args[args.indexOf('--ddl') + 1] : null
const applyRls = args.includes('--apply-rls')

const P = 'he01test_' // every fixture id starts with this
const id = (s: string) => P + s

// Supabase auth ids (auth.uid() casts the JWT sub to uuid).
const U = {
  ncAdmin: randomUUID(),
  alumniA: randomUUID(), // ALUMNI_RELATIONS at A
  devA: randomUUID(), // DEVELOPMENT at A
  counselorA: randomUUID(), // CAREER_SERVICES at A, assigned to member 1
  counselorA2: randomUUID(), // CAREER_SERVICES at A, not assigned
  adminA: randomUUID(), // INSTITUTION_ADMIN at A
  pendingA: randomUUID(), // invited to A, never accepted
  alumniB: randomUUID(), // ALUMNI_RELATIONS at B
  member1: randomUUID(), // candidate, member of A
  member2: randomUUID(), // candidate, member of A
}

let passed = 0
const failures: string[] = []
function check(name: string, actual: unknown, expected: unknown) {
  if (actual === expected) passed++
  else failures.push(`${name}: expected ${String(expected)}, got ${String(actual)}`)
}

// A uid ending in ANON_SUFFIX is the same user signed in through Supabase
// anonymous sign-in (is_anonymous: true in the JWT).
const ANON_SUFFIX = '#anonymous'

async function asUser<T>(tx: Tx, uid: string | null, fn: () => Promise<T>): Promise<T | Error> {
  await tx.$executeRawUnsafe('savepoint persona')
  try {
    await tx.$executeRawUnsafe(`set local role ${uid ? 'authenticated' : 'anon'}`)
    await tx.$queryRawUnsafe(
      `select set_config('request.jwt.claims', $1, true)`,
      JSON.stringify(
        uid
          ? { sub: uid.replace(ANON_SUFFIX, ''), role: 'authenticated', is_anonymous: uid.endsWith(ANON_SUFFIX) }
          : { role: 'anon' },
      ),
    )
    return await fn()
  } catch (e) {
    return e as Error
  } finally {
    // Undoes the persona's writes and the role/claims change.
    await tx.$executeRawUnsafe('rollback to savepoint persona')
    await tx.$executeRawUnsafe('release savepoint persona')
  }
}

async function count(tx: Tx, uid: string | null, table: string, ids: string[]) {
  const r = await asUser(tx, uid, () =>
    tx.$queryRawUnsafe<{ n: number }[]>(`select count(*)::int as n from "${table}" where id = any($1)`, ids),
  )
  // A permission error is as good as zero rows for a read check.
  return r instanceof Error ? 0 : r[0].n
}

async function write(tx: Tx, uid: string | null, sql: string, ...params: unknown[]) {
  const r = await asUser(tx, uid, () => tx.$executeRawUnsafe(sql, ...params))
  return r instanceof Error ? 'denied' : r // rows affected
}

async function seed(tx: Tx) {
  const ex = (sql: string, ...p: unknown[]) => tx.$executeRawUnsafe(sql, ...p)
  await ex(`insert into "RoleGrant"(id,"userId",role) values ($1,$2,'nc_admin')`, id('rg'), U.ncAdmin)
  for (const [k, uid] of [['c1', U.member1], ['c2', U.member2]] as const) {
    await ex(`insert into "CandidateProfile"(id,"userId","updatedAt") values ($1,$2,now())`, id(k), uid)
  }
  await ex(
    `insert into "Institution"(id,slug,name,"isSampleData","updatedAt") values ($1,$2,'Test A',true,now()),($3,$4,'Test B',true,now())`,
    id('instA'), id('a'), id('instB'), id('b'),
  )
  const staff: [string, string, string, string, boolean][] = [
    ['uAlumniA', 'instA', U.alumniA, 'ALUMNI_RELATIONS', true],
    ['uDevA', 'instA', U.devA, 'DEVELOPMENT', true],
    ['uCounselorA', 'instA', U.counselorA, 'CAREER_SERVICES', true],
    ['uCounselorA2', 'instA', U.counselorA2, 'CAREER_SERVICES', true],
    ['uAdminA', 'instA', U.adminA, 'INSTITUTION_ADMIN', true],
    ['uPendingA', 'instA', U.pendingA, 'ALUMNI_RELATIONS', false],
    ['uAlumniB', 'instB', U.alumniB, 'ALUMNI_RELATIONS', true],
  ]
  for (const [k, inst, uid, role, accepted] of staff) {
    await ex(
      `insert into "InstitutionUser"(id,"institutionId","userId","invitedEmail",role,"acceptedAt","inviteToken","updatedAt")
       values ($1,$2,$3,$4,$5::"InstitutionUserRole",$6,$1,now())`,
      id(k), id(inst), uid, `${k}@he01.test`, role, accepted ? new Date() : null,
    )
  }
  const members: [string, string, string | null][] = [
    ['m1', 'instA', id('c1')],
    ['m2', 'instA', id('c2')],
    ['m3', 'instB', null],
  ]
  for (const [k, inst, cand] of members) {
    await ex(
      `insert into "InstitutionMember"(id,"institutionId","candidateId",email,"updatedAt") values ($1,$2,$3,$4,now())`,
      id(k), id(inst), cand, `${k}@he01.test`,
    )
  }
  await ex(
    `insert into "InstitutionConsent"(id,"memberId",scope,granted,source,"updatedAt") values ($1,$2,'SHARE_OUTCOME',true,'MEMBER',now())`,
    id('consent1'), id('m1'),
  )
  await ex(
    `insert into "TransitionFlag"(id,"memberId","openFlagMemberId",source,reason,"updatedAt") values ($1,$2,$2,'SELF_REPORTED','private reason',now())`,
    id('flag1'), id('m1'),
  )
  await ex(`insert into "OutcomeReport"(id,"memberId","updatedAt") values ($1,$2,now())`, id('outcome1'), id('m1'))
  await ex(
    `insert into "CheckIn"(id,"memberId",kind,"dueAt","updatedAt") values ($1,$2,'M6',now(),now())`,
    id('checkin1'), id('m1'),
  )
  await ex(
    `insert into "CaseloadAssignment"(id,"institutionId","counselorId","memberId","updatedAt") values ($1,$2,$3,$4,now())`,
    id('case1'), id('instA'), id('uCounselorA'), id('m1'),
  )
  await ex(
    `insert into "InstitutionGift"(id,"institutionId","memberId","externalConstituentId","amountCents","giftDate","dedupeKey","updatedAt")
     values ($1,$2,$3,'100',10000,now(),'k1',now())`,
    id('gift1'), id('instA'), id('m1'),
  )
  await ex(
    `insert into "EngagementEvent"(id,"institutionId","memberId",type,"caseCategory",points,"occurredAt","sourceTable","sourceId","updatedAt")
     values ($1,$2,$3,'LOGIN','COMMUNICATION',1,now(),'test','1',now()),
            ($4,$5,$6,'LOGIN','COMMUNICATION',1,now(),'test','2',now())`,
    id('ev1'), id('instA'), id('m1'), id('ev3'), id('instB'), id('m3'),
  )
}

async function run(tx: Tx) {
  const inst = [id('instA'), id('instB')]
  const members = [id('m1'), id('m2'), id('m3')]

  // Institution
  check('Institution: nc_admin sees both', await count(tx, U.ncAdmin, 'Institution', inst), 2)
  check('Institution: staff A sees only A', await count(tx, U.alumniA, 'Institution', inst), 1)
  check('Institution: staff B sees only B', await count(tx, U.alumniB, 'Institution', [id('instB')]), 1)
  check('Institution: staff B cannot see A', await count(tx, U.alumniB, 'Institution', [id('instA')]), 0)
  check('Institution: member sees own institution', await count(tx, U.member1, 'Institution', [id('instA')]), 1)
  check('Institution: member cannot see other institution', await count(tx, U.member1, 'Institution', [id('instB')]), 0)
  check('Institution: anon sees none', await count(tx, null, 'Institution', inst), 0)

  // InstitutionMember
  check('Member: nc_admin sees all', await count(tx, U.ncAdmin, 'InstitutionMember', members), 3)
  check('Member: staff A sees A roster', await count(tx, U.alumniA, 'InstitutionMember', members), 2)
  check('Member: staff B sees B roster only', await count(tx, U.alumniB, 'InstitutionMember', members), 1)
  check('Member: unaccepted invite sees none', await count(tx, U.pendingA, 'InstitutionMember', members), 0)
  check('Member: member sees only self', await count(tx, U.member1, 'InstitutionMember', members), 1)
  check('Member: anon sees none', await count(tx, null, 'InstitutionMember', members), 0)

  // Staff-only institution data
  check('Gift: staff A sees it', await count(tx, U.devA, 'InstitutionGift', [id('gift1')]), 1)
  check('Gift: staff B does not', await count(tx, U.alumniB, 'InstitutionGift', [id('gift1')]), 0)
  check('Gift: the donor member does not', await count(tx, U.member1, 'InstitutionGift', [id('gift1')]), 0)
  check('Gift: anon does not', await count(tx, null, 'InstitutionGift', [id('gift1')]), 0)

  const evs = [id('ev1'), id('ev3')]
  check('Engagement: staff A sees A only', await count(tx, U.alumniA, 'EngagementEvent', evs), 1)
  check('Engagement: member sees own', await count(tx, U.member1, 'EngagementEvent', evs), 1)
  check('Engagement: other member sees none', await count(tx, U.member2, 'EngagementEvent', evs), 0)

  // Candidate-owned: TransitionFlag
  const flag = [id('flag1')]
  check('Flag: nc_admin sees it', await count(tx, U.ncAdmin, 'TransitionFlag', flag), 1)
  check('Flag: the member sees it', await count(tx, U.member1, 'TransitionFlag', flag), 1)
  check('Flag: assigned counselor sees it', await count(tx, U.counselorA, 'TransitionFlag', flag), 1)
  check('Flag: unassigned counselor does not', await count(tx, U.counselorA2, 'TransitionFlag', flag), 0)
  check('Flag: Development does not (views only)', await count(tx, U.devA, 'TransitionFlag', flag), 0)
  check('Flag: Alumni Relations does not (views only)', await count(tx, U.alumniA, 'TransitionFlag', flag), 0)
  check('Flag: other member does not', await count(tx, U.member2, 'TransitionFlag', flag), 0)
  check('Flag: anon does not', await count(tx, null, 'TransitionFlag', flag), 0)
  check('Flag: anonymous sign-in with the member\'s id does not', await count(tx, U.member1 + ANON_SUFFIX, 'TransitionFlag', flag), 0)
  check('Member: anonymous sign-in with the member\'s id does not', await count(tx, U.member1 + ANON_SUFFIX, 'InstitutionMember', [id('m1')]), 0)

  // Candidate-owned: OutcomeReport, consent, check-ins
  check('Outcome: member sees own', await count(tx, U.member1, 'OutcomeReport', [id('outcome1')]), 1)
  check('Outcome: Development does not', await count(tx, U.devA, 'OutcomeReport', [id('outcome1')]), 0)
  check('Outcome: other member does not', await count(tx, U.member2, 'OutcomeReport', [id('outcome1')]), 0)
  check('Consent: member sees own', await count(tx, U.member1, 'InstitutionConsent', [id('consent1')]), 1)
  check('Consent: staff do not', await count(tx, U.adminA, 'InstitutionConsent', [id('consent1')]), 0)
  check('Consent: other member does not', await count(tx, U.member2, 'InstitutionConsent', [id('consent1')]), 0)
  check('CheckIn: member sees own', await count(tx, U.member1, 'CheckIn', [id('checkin1')]), 1)
  check('CheckIn: assigned counselor sees it', await count(tx, U.counselorA, 'CheckIn', [id('checkin1')]), 1)
  check('CheckIn: Development does not', await count(tx, U.devA, 'CheckIn', [id('checkin1')]), 0)

  // Caseloads
  check('Caseload: own counselor sees it', await count(tx, U.counselorA, 'CaseloadAssignment', [id('case1')]), 1)
  check('Caseload: other counselor does not', await count(tx, U.counselorA2, 'CaseloadAssignment', [id('case1')]), 0)
  check('Caseload: INSTITUTION_ADMIN sees all', await count(tx, U.adminA, 'CaseloadAssignment', [id('case1')]), 1)
  check('Caseload: Alumni Relations does not', await count(tx, U.alumniA, 'CaseloadAssignment', [id('case1')]), 0)

  // Writes: consent is member-only
  const insertConsent = `insert into "InstitutionConsent"(id,"memberId",scope,granted,source,"updatedAt") values ($1,$2,'SHARE_DOSSIER_WITH_EMPLOYERS',true,'MEMBER',now())`
  check('Consent write: member for self', await write(tx, U.member1, insertConsent, id('cw1'), id('m1')), 1)
  check('Consent write: other member', await write(tx, U.member2, insertConsent, id('cw2'), id('m1')), 'denied')
  check('Consent write: staff', await write(tx, U.adminA, insertConsent, id('cw3'), id('m1')), 'denied')
  check('Consent write: anon', await write(tx, null, insertConsent, id('cw4'), id('m1')), 'denied')
  check(
    'Consent is append-only (member update affects nothing)',
    await write(tx, U.member1, `update "InstitutionConsent" set granted = false where id = $1`, id('consent1')),
    0,
  )

  // Writes: TransitionFlag is member or assigned counselor
  const updateFlag = `update "TransitionFlag" set "doNotSolicit" = false where id = $1`
  check('Flag update: assigned counselor', await write(tx, U.counselorA, updateFlag, id('flag1')), 1)
  check('Flag update: member', await write(tx, U.member1, updateFlag, id('flag1')), 1)
  check('Flag update: Development affects nothing', await write(tx, U.devA, updateFlag, id('flag1')), 0)
  check('Flag update: unassigned counselor affects nothing', await write(tx, U.counselorA2, updateFlag, id('flag1')), 0)
  const insertFlag = `insert into "TransitionFlag"(id,"memberId","openFlagMemberId",source,"updatedAt") values ($1,$2,$2,$3::"TransitionFlagSource",now())`
  check('Flag insert: member for self', await write(tx, U.member2, insertFlag, id('fw1'), id('m2'), 'SELF_REPORTED'), 1)
  check('Flag insert: unassigned counselor', await write(tx, U.counselorA2, insertFlag, id('fw2'), id('m2'), 'COUNSELOR'), 'denied')
  check('Flag insert: other member', await write(tx, U.member1, insertFlag, id('fw3'), id('m2'), 'SELF_REPORTED'), 'denied')

  // Staff have no direct write path (writes go through server actions)
  check(
    'Member write: staff cannot insert directly',
    await write(tx, U.adminA, `insert into "InstitutionMember"(id,"institutionId",email,"updatedAt") values ($1,$2,'x@he01.test',now())`, id('mw'), id('instA')),
    'denied',
  )

  // One open flag per member (runs as the owner, so RLS is not the gate here)
  check('Second open flag for a member is rejected', await ownerWrite(tx, insertFlag, id('dup'), id('m1'), 'COUNSELOR'), 'denied')
  check(
    'A cleared flag alongside the open one is fine',
    await ownerWrite(tx, `insert into "TransitionFlag"(id,"memberId",state,source,"clearedAt","updatedAt") values ($1,$2,'CLEARED','SELF_REPORTED',now(),now())`, id('cleared'), id('m1')),
    1,
  )
}

async function ownerWrite(tx: Tx, sql: string, ...params: unknown[]) {
  await tx.$executeRawUnsafe('savepoint owner')
  try {
    return await tx.$executeRawUnsafe(sql, ...params)
  } catch {
    return 'denied'
  } finally {
    await tx.$executeRawUnsafe('rollback to savepoint owner')
    await tx.$executeRawUnsafe('release savepoint owner')
  }
}

async function main() {
  const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } })
  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(`set local lock_timeout = '5s'`)
        if (ddlFile) {
          const ddl = splitSqlStatements(readFileSync(path.resolve(ddlFile), 'utf8'))
          for (const s of ddl) await tx.$executeRawUnsafe(s)
          console.log(`Dry-ran ${ddl.length} migration statements (will roll back)`)
        }
        if (applyRls) {
          const rls = splitSqlStatements(readFileSync(path.join(process.cwd(), 'prisma/sql/higher-ed-rls.sql'), 'utf8'))
          for (const s of rls) await tx.$executeRawUnsafe(s)
          console.log(`Dry-ran ${rls.length} RLS statements (will roll back)`)
        }
        await seed(tx)
        await run(tx)
        throw new Rollback()
      },
      { timeout: 120_000, maxWait: 20_000 },
    )
  } catch (e) {
    if (!(e instanceof Rollback)) throw e
  } finally {
    await prisma.$disconnect()
  }
  console.log(`${passed} passed, ${failures.length} failed (all fixtures rolled back)`)
  for (const f of failures) console.log('  FAIL ' + f)
  if (failures.length) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
