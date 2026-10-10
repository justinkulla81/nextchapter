// Loads search firms into the CRM for search-firm outreach.
//
//   python3 scripts/search-firms/export-firms.py > /tmp/firms.json
//   node --env-file=.env.local --conditions=react-server --import tsx \
//     scripts/search-firms/import.ts /tmp/firms.json [teams.json] [--apply]
//
// teams.json: people read off each firm's own team page and checked against
// the page's HTML (see TeamRecord in src/lib/search-firms/sync.ts). Dry run
// by default: prints what would match without writing.
import { readFileSync } from 'node:fs'
import { prisma } from '@/lib/prisma'
import { addTeamPeople, syncSearchFirms, type FirmRecord, type TeamRecord } from '@/lib/search-firms/sync'
import { matchFirmToOrgs } from '@/lib/search-firms/match'

async function main() {
  const args = process.argv.slice(2)
  const apply = args.includes('--apply')
  const [firmsPath, teamsPath] = args.filter((a) => !a.startsWith('--'))
  const firms = JSON.parse(readFileSync(firmsPath, 'utf8')) as FirmRecord[]
  const teams = teamsPath ? (JSON.parse(readFileSync(teamsPath, 'utf8')) as TeamRecord[]) : []

  if (!apply) {
    const orgs = await prisma.crmOrganization.findMany({ select: { id: true, name: true, website: true, emailDomain: true } })
    const byId = new Map(orgs.map((o) => [o.id, o.name]))
    const counts = { matched: 0, review: 0, none: 0 }
    for (const f of firms) {
      const m = matchFirmToOrgs(f, orgs)
      counts[m.kind]++
      if (m.kind !== 'none') console.log(`${m.kind.padEnd(8)} ${f.name} → ${byId.get(m.orgId)}${m.kind === 'review' ? ` (${m.reason})` : ''}`)
    }
    console.log(counts, `${teams.reduce((n, t) => n + t.people.length, 0)} team-page people. Dry run — pass --apply to write.`)
    return
  }
  console.log('firms', await syncSearchFirms(firms))
  if (teams.length) console.log('people', await addTeamPeople(teams))
}

main().finally(() => prisma.$disconnect())
