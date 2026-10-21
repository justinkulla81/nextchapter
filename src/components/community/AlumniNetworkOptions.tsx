import { getAlumniNetworkOptions } from '@/lib/community/alumni-networks'
import { joinAlumniNetworkAction } from '@/app/dashboard/community/actions'
import { ListRow, RowList } from '@/components/candidate/ListRow'
import { ActionSubmit } from '@/components/candidate/ActionSubmit'

// Alumni networks a member can opt into: their colleges and former employers that
// at least five NextChapter members share. Nothing is joined for them. Joined ones
// appear as chips in the community picker. `redesign` lists them as rows, each with the reason it is offered.
export async function AlumniNetworkOptions({ candidateId }: { candidateId: string }) {
  const options = (await getAlumniNetworkOptions(candidateId)).filter((o) => !o.joined)
  if (options.length === 0) {
    return <p className="text-base text-muted-foreground">Nothing to join right now. An alumni network opens once five members share a school or a past employer.</p>
  }

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
