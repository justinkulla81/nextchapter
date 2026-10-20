import { GraduationCap, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getAlumniNetworkOptions } from '@/lib/community/alumni-networks'
import { joinAlumniNetworkAction } from '@/app/dashboard/community/actions'
import { ListRow, RowList } from '@/components/candidate/ListRow'
import { ActionSubmit } from '@/components/candidate/ActionSubmit'

// Alumni networks a member can opt into: their colleges and former employers that
// at least five NextChapter members share. Nothing is joined for them. Joined ones
// appear as chips in the community picker. `redesign` lists them as rows, each with the reason it is offered.
export async function AlumniNetworkOptions({ candidateId, redesign = false }: { candidateId: string; redesign?: boolean }) {
  const options = (await getAlumniNetworkOptions(candidateId)).filter((o) => !o.joined)
  if (options.length === 0) {
    return redesign ? <p className="text-base text-muted-foreground">Nothing to join right now. An alumni network opens once five members share a school or a past employer.</p> : null
  }

  if (redesign) {
    return (
      <RowList label="Alumni networks you can join">
        {options.map((o) => (
          <ListRow
            key={`${o.kind}:${o.refId}`}
            name={o.name}
            title={o.name}
            why={`${o.kind === 'SCHOOL' ? 'Other members studied here too.' : 'Other members worked here too.'} Only members who also join can see you in it.`}
            fact={`${o.memberCount} members`}
            actions={
              <form action={joinAlumniNetworkAction}>
                <input type="hidden" name="kind" value={o.kind} />
                <input type="hidden" name="refId" value={o.refId} />
                <ActionSubmit variant="secondary" pendingLabel="Joining…" event="alumni_network_joined" props={{ kind: o.kind, refId: o.refId }}>
                  Join
                </ActionSubmit>
              </form>
            }
          />
        ))}
      </RowList>
    )
  }

  return (
    <div className="border-b border-border px-4 py-3">
      <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Alumni networks</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Join to see posts from other members who studied or worked there. Only members who have also joined see you in it.
      </p>
      <ul className="mt-2 space-y-2">
        {options.map((o) => (
          <li key={`${o.kind}:${o.refId}`} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-sm text-foreground">
              {o.kind === 'SCHOOL' ? (
                <GraduationCap className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              ) : (
                <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <span className="truncate">{o.name}</span>
              <span className="shrink-0 text-muted-foreground">· {o.memberCount} members</span>
            </span>
            <form action={joinAlumniNetworkAction}>
              <input type="hidden" name="kind" value={o.kind} />
              <input type="hidden" name="refId" value={o.refId} />
              <Button type="submit" size="sm" variant="outline">
                Join
              </Button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  )
}
