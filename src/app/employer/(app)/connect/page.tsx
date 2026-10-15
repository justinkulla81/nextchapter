import { requireOutplacementRole } from '@/lib/employer/outplacement-auth'
import { prisma } from '@/lib/prisma'
import { listOrgKeys } from '@/lib/census/api-keys'
import { readProgramSettings } from '@/lib/employer/program-settings'
import { getEnrollableContracts } from '@/lib/employer/outplacement-enrollment'
import { CommsToggles, OrgKeysPanel } from '@/components/census/OrgKeysPanel'
import { makeEmployerKey, saveEmployerComms, turnOffEmployerKey } from './actions'

const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://launchyournextchapter.com'

export default async function EmployerConnectPage() {
  const orgUser = await requireOutplacementRole(['ADMIN'])
  const [keys, org, contracts] = await Promise.all([
    listOrgKeys('outplacement', orgUser.orgId),
    prisma.outplacementEmployerOrg.findUniqueOrThrow({ where: { id: orgUser.orgId }, select: { programSettings: true } }),
    getEnrollableContracts(orgUser.orgId),
  ])
  const settings = readProgramSettings(org.programSettings)
  const example = `curl -X POST ${base}/api/v1/census \\
  -H "Authorization: Bearer nck_…" \\
  -H "Content-Type: application/json" \\
  -d '{${contracts.length > 1 ? `\n    "contractId": "${contracts[0].id}",` : ''}
    "people": [
      { "email": "jane@company.com", "name": "Jane Doe", "externalId": "E1042",
        "cohort": "March RIF", "package": "${settings.packages[0]?.name ?? 'all'}", "accessEnds": "2027-03-31" },
      { "email": "sam@company.com", "remove": true }
    ]
  }'

New people are invited; people already on your roster are updated; "remove": true ends their seat.
Fields you leave out stay as they are. GET the same address to read your roster back (status only).${contracts.length > 1 ? `\n\nYour active contracts: ${contracts.map((c) => `${c.cohortLabel ?? c.tier} = ${c.id}`).join('; ')}` : ''}`

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">HR system and emails</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Keep your roster in step with your HR system automatically, or upload a spreadsheet on Enroll. Either way, people are matched on your employee id, then email.
        </p>
      </div>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Connect your HR system</h2>
        <OrgKeysPanel
          keys={keys.map((k) => ({ ...k, createdAt: k.createdAt.toISOString(), lastUsedAt: k.lastUsedAt?.toISOString() ?? null, revokedAt: k.revokedAt?.toISOString() ?? null }))}
          makeKey={makeEmployerKey}
          turnOff={turnOffEmployerKey}
          example={example}
        />
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Emails to your people</h2>
        <p className="text-sm text-muted-foreground">Off unless you turn them on. Everyone gets their invite either way.</p>
        <CommsToggles value={settings.comms} save={saveEmployerComms} />
      </section>
    </div>
  )
}
