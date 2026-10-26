'use client'

import { useEffect, useId, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  addSectionAdminAction,
  linkSectionRecordAction,
  makeAdminFromRequestAction,
  removeSectionAdminAction,
  searchLinkableRecordsAction,
  setSectionAdminRoleAction,
  setSectionStatusAction,
  type WorkspaceActionResult,
} from '@/app/support/admin/(portal)/organizations/workspace-actions'
import type { RecordOption, StaffAdminRow, StaffRequestRow, StaffSectionView } from '@/lib/employer/staff-workspaces'

// Staff controls for each employer section of an organization: status, linked record, team and claim requests.
// Actions give feedback next to the button (working, done, or what went wrong), show a busy cursor while they run, and the
// two that take access away (Suspend, Remove) ask first with the safe choice focused.

const STATUS_COPY: Record<string, { label: string; means: string }> = {
  PENDING: { label: 'Pending', means: 'Its admins cannot sign in to this section yet. Activating it lets them in.' },
  ACTIVE: { label: 'Active', means: 'Its admins can sign in to this section.' },
  SUSPENDED: { label: 'Suspended', means: 'Its admins cannot sign in to this section until you reactivate it.' },
}

const SOURCE_LABEL: Record<string, string> = { INVITE: 'Added by staff', DOMAIN_CLAIM: 'Domain claim', MIGRATED: 'Migrated from the old account' }

const primary = 'rounded-md border border-navy bg-navy px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60'
const secondary = 'rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-60'
const danger = 'rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60'

function useStaffAction() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [working, setWorking] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const run = (label: string, fn: () => Promise<WorkspaceActionResult>, after?: (r: WorkspaceActionResult) => void) =>
    start(async () => {
      setError(null)
      setDone(null)
      setWorking(label)
      try {
        const r = await fn()
        if (r.error) setError(r.error)
        else {
          setDone(r.message ?? 'Saved.')
          after?.(r)
        }
      } catch {
        setError('That did not go through. Check your connection and try again.')
      }
      setWorking(null)
      router.refresh()
    })
  return { pending, working, done, error, run }
}

export function EmployerWorkspaceControls({ views, loadError }: { views: StaffSectionView[]; loadError?: string | null }) {
  if (loadError) return <p role="alert" className="text-sm text-destructive">{loadError}</p>
  if (views.length === 0) return <p className="text-sm text-muted-foreground">No section has been claimed for this organization yet. When someone verifies a claim, it appears here as pending.</p>
  return (
    <div className="space-y-8">
      {views.map((v) => (
        <SectionCard key={v.workspaceId} view={v} />
      ))}
    </div>
  )
}

function SectionCard({ view: v }: { view: StaffSectionView }) {
  const a = useStaffAction()
  const [confirmSuspend, setConfirmSuspend] = useState(false)
  const copy = STATUS_COPY[v.status] ?? { label: v.status, means: '' }

  return (
    <section aria-label={`${v.label} workspace`} className={cn('space-y-5 rounded-md border border-border p-4', a.pending && 'cursor-wait [&_button]:cursor-wait [&_input]:cursor-wait')}>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold">{v.label}</h3>
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', v.status === 'ACTIVE' ? 'bg-success/15 text-success' : v.status === 'SUSPENDED' ? 'bg-destructive/10 text-destructive' : 'bg-warn/20')}>{copy.label}</span>
        </div>
        <p className="text-sm text-muted-foreground">{copy.means}</p>

        {v.status === 'PENDING' && !v.activateBlockedReason && (
          <div className="space-y-1">
            <button type="button" className={primary} disabled={a.pending} onClick={() => a.run('Activating', () => setSectionStatusAction(v.workspaceId, 'ACTIVE'))}>
              Activate {v.label}
            </button>
            {v.section !== 'hiring' && !v.refId && <p className="text-xs text-muted-foreground">Link its employer record below as well. Until it is linked, the admins have nothing to open.</p>}
          </div>
        )}
        {v.status === 'PENDING' && v.activateBlockedReason && <p className="text-sm">{v.activateBlockedReason}</p>}
        {v.status === 'SUSPENDED' && (
          <button type="button" className={primary} disabled={a.pending} onClick={() => a.run('Reactivating', () => setSectionStatusAction(v.workspaceId, 'ACTIVE'))}>
            Reactivate {v.label}
          </button>
        )}
        {v.status === 'ACTIVE' && !confirmSuspend && (
          <button type="button" className={secondary} disabled={a.pending} onClick={() => setConfirmSuspend(true)}>
            Suspend {v.label}
          </button>
        )}
        {v.status === 'ACTIVE' && confirmSuspend && (
          <div role="alertdialog" aria-label={`Suspend ${v.label}`} className="space-y-2 rounded-md border border-destructive/40 p-3 text-sm">
            <p>Everyone on the {v.label} team loses access until you reactivate it. Their data is kept. Suspend {v.label}?</p>
            <div className="flex flex-wrap gap-2">
              {/* The safe choice takes the focus, so Enter never suspends. */}
              <button type="button" autoFocus className={secondary} onClick={() => setConfirmSuspend(false)}>
                Keep it active
              </button>
              <button
                type="button"
                className={danger}
                disabled={a.pending}
                onClick={() => {
                  setConfirmSuspend(false)
                  a.run('Suspending', () => setSectionStatusAction(v.workspaceId, 'SUSPENDED'))
                }}
              >
                Suspend {v.label}
              </button>
            </div>
          </div>
        )}
        <Feedback a={a} />
      </div>

      {v.section === 'hiring' ? <HiringSignup v={v} /> : <RecordLink v={v} />}
      <Team v={v} />
      <Requests v={v} />
    </section>
  )
}

function Feedback({ a }: { a: { working: string | null; done: string | null; error: string | null } }) {
  return (
    <div aria-live="polite">
      {a.working && <p role="status" className="text-sm text-muted-foreground">{a.working}…</p>}
      {a.done && <p role="status" className="text-sm text-success">{a.done}</p>}
      {a.error && <p role="alert" className="text-sm text-destructive">{a.error}</p>}
    </div>
  )
}

function HiringSignup({ v }: { v: StaffSectionView }) {
  return (
    <div className="space-y-1 text-sm">
      <h4 className="font-medium">Claimant sign-up</h4>
      {v.hiringSignedUp ? (
        <p className="text-muted-foreground">Signed up{v.hiringCompany ? ` as ${v.hiringCompany}` : ''}. The Hiring account is linked to this section.</p>
      ) : v.inviteEmail ? (
        <p className="text-muted-foreground">Not signed up yet. Waiting for {v.inviteEmail} to sign up for Hiring with that email. The section goes live and links itself when they do.</p>
      ) : (
        <p className="text-muted-foreground">No claimant is on record and nobody has signed up yet.</p>
      )}
    </div>
  )
}

function RecordLink({ v }: { v: StaffSectionView }) {
  const a = useStaffAction()
  const [confirmUnlink, setConfirmUnlink] = useState(false)
  const [picked, setPicked] = useState<RecordOption | null>(null)
  const [changing, setChanging] = useState(false)
  const linked = !!v.refId

  return (
    <div className="space-y-2 text-sm">
      <h4 className="font-medium">Employer record</h4>
      {linked ? (
        <p className="text-muted-foreground">
          {v.linkedRecord ? (
            <>
              Linked to <span className="font-medium text-foreground">{v.linkedRecord.name}</span>
              {v.linkedRecord.contactEmail ? ` (contact ${v.linkedRecord.contactEmail})` : ''}.
            </>
          ) : (
            'Linked to a record that can no longer be found. Remove the link and pick another.'
          )}{' '}
          Once the section is active, its admins open this record’s program.
        </p>
      ) : (
        <p className="text-muted-foreground">Not linked. Pick the existing employer record this section belongs to. Nothing is created: no contract and no seats.</p>
      )}

      {linked && !confirmUnlink && !changing && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={secondary} disabled={a.pending} onClick={() => setChanging(true)}>
            Change record
          </button>
          <button type="button" className={secondary} disabled={a.pending} onClick={() => setConfirmUnlink(true)}>
            Remove link
          </button>
        </div>
      )}
      {confirmUnlink && (
        <div role="alertdialog" aria-label="Remove the link" className="space-y-2 rounded-md border border-destructive/40 p-3">
          <p>The section’s admins can no longer open that record’s program. The record itself is not changed. Remove the link?</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" autoFocus className={secondary} onClick={() => setConfirmUnlink(false)}>
              Keep the link
            </button>
            <button
              type="button"
              className={danger}
              disabled={a.pending}
              onClick={() => {
                setConfirmUnlink(false)
                a.run('Removing the link', () => linkSectionRecordAction(v.workspaceId, null))
              }}
            >
              Remove link
            </button>
          </div>
        </div>
      )}

      {(!linked || changing) && !picked && (
        <RecordPicker
          workspaceId={v.workspaceId}
          onPick={(o) => setPicked(o)}
          onCancel={changing ? () => setChanging(false) : undefined}
        />
      )}
      {picked && (
        <div role="alertdialog" aria-label="Link this record" className="space-y-2 rounded-md border border-border p-3">
          <p>
            Link {v.label} to <span className="font-medium">{picked.name}</span>
            {picked.contactEmail ? ` (contact ${picked.contactEmail})` : ''}? Once the section is active, its admins open this record’s program, so check it is the right company.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={primary}
              disabled={a.pending}
              onClick={() =>
                a.run('Linking', () => linkSectionRecordAction(v.workspaceId, picked.id), () => {
                  setPicked(null)
                  setChanging(false)
                })
              }
            >
              Link {picked.name}
            </button>
            <button type="button" className={secondary} onClick={() => setPicked(null)}>
              Pick a different record
            </button>
          </div>
        </div>
      )}
      <Feedback a={a} />
    </div>
  )
}

// A searchable list: there can be hundreds of employer records, so staff type to narrow it (two letters or more).
function RecordPicker({ workspaceId, onPick, onCancel }: { workspaceId: string; onPick: (o: RecordOption) => void; onCancel?: () => void }) {
  const id = useId()
  const [q, setQ] = useState('')
  const [options, setOptions] = useState<RecordOption[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const seq = useRef(0)

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) {
      setOptions(null)
      setError(null)
      setSearching(false)
      return
    }
    const mine = ++seq.current
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const r = await searchLinkableRecordsAction(workspaceId, term)
        if (mine !== seq.current) return
        if (r.error) {
          setError(r.error)
          setOptions(null)
        } else {
          setError(null)
          setOptions(r.options ?? [])
        }
      } catch {
        if (mine === seq.current) setError('The search did not go through. Try again.')
      }
      if (mine === seq.current) setSearching(false)
    }, 250)
    return () => clearTimeout(t)
  }, [q, workspaceId])

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium">
        Find an employer record
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input id={id} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Company name or contact email" className="w-full max-w-sm rounded-md border border-border bg-background px-3 py-1.5 text-sm" autoComplete="off" />
        {onCancel && (
          <button type="button" className={secondary} onClick={onCancel}>
            Keep the current record
          </button>
        )}
      </div>
      <div aria-live="polite" className="text-sm">
        {q.trim().length < 2 && <p className="text-muted-foreground">Type at least two letters to search.</p>}
        {searching && <p role="status" className="text-muted-foreground">Searching…</p>}
        {error && <p role="alert" className="text-destructive">{error}</p>}
        {!searching && !error && options && options.length === 0 && <p className="text-muted-foreground">No employer record matches “{q.trim()}”. Records are created with a contract, not here.</p>}
      </div>
      {options && options.length > 0 && (
        <ul className="max-w-xl divide-y divide-border rounded-md border border-border" aria-label="Matching employer records">
          {options.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 p-2">
              <span>
                <span className="font-medium">{o.name}</span>
                {o.contactEmail && <span className="ml-2 text-xs text-muted-foreground">{o.contactEmail}</span>}
                {o.linkedElsewhere && <span className="block text-xs text-muted-foreground">Already linked to another organization, so it cannot be linked again.</span>}
              </span>
              <button type="button" className={secondary} disabled={o.linkedElsewhere} onClick={() => onPick(o)}>
                Select
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Team({ v }: { v: StaffSectionView }) {
  const a = useStaffAction()
  const emailId = useId()
  const [email, setEmail] = useState('')
  // The least access is the default; staff pick a wider role on purpose.
  const [role, setRole] = useState(v.roles.includes('VIEWER') ? 'VIEWER' : v.roles[v.roles.length - 1])
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)

  return (
    <div className={cn('space-y-3 text-sm', a.pending && 'cursor-wait [&_button]:cursor-wait [&_input]:cursor-wait')}>
      <h4 className="font-medium">Team</h4>
      {v.admins.length === 0 ? (
        <p className="text-muted-foreground">No one is on the {v.label} team yet. Add a person below, or make one from a request.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {v.admins.map((m) => (
            <TeamRow key={m.id} m={m} roles={v.roles} label={v.label} busy={a.pending} confirming={confirmRemove === m.id} onAskRemove={() => setConfirmRemove(m.id)} onCancelRemove={() => setConfirmRemove(null)} run={a.run} />
          ))}
        </ul>
      )}

      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault()
          a.run('Adding', () => addSectionAdminAction(v.workspaceId, email, role), () => setEmail(''))
        }}
      >
        <label htmlFor={emailId} className="block font-medium">
          Add a person by email
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input id={emailId} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" className="w-full max-w-xs rounded-md border border-border bg-background px-3 py-1.5 text-sm" autoComplete="off" />
          <div className="flex flex-wrap gap-2" role="group" aria-label={`Role for the new ${v.label} team member`}>
            {v.roles.map((r) => (
              <button key={r} type="button" aria-pressed={role === r} onClick={() => setRole(r)} className={cn('rounded-md border px-3 py-1.5 text-sm font-medium', role === r ? 'border-navy bg-navy text-white' : 'border-border hover:bg-muted')}>
                {roleLabel(r)}
              </button>
            ))}
          </div>
          <button type="submit" disabled={a.pending} className={primary}>
            Add to team
          </button>
        </div>
        <p className="text-xs text-muted-foreground">No email is sent. They get in when they sign in with this address and the section is active. Admins can run the section; viewers can only look.</p>
      </form>
      <Feedback a={a} />
    </div>
  )
}

function roleLabel(r: string): string {
  return r.charAt(0) + r.slice(1).toLowerCase()
}

function TeamRow({ m, roles, label, busy, confirming, onAskRemove, onCancelRemove, run }: { m: StaffAdminRow; roles: string[]; label: string; busy: boolean; confirming: boolean; onAskRemove: () => void; onCancelRemove: () => void; run: ReturnType<typeof useStaffAction>['run'] }) {
  return (
    <li className="space-y-2 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{m.email}</p>
          <p className="text-xs text-muted-foreground">
            {SOURCE_LABEL[m.source] ?? m.source} on {m.addedOn} · {m.signedIn ? 'Signed in' : m.accepted ? 'Accepted' : 'Has not signed in yet'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-2" role="group" aria-label={`Role of ${m.email}`}>
            {roles.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={m.role === r}
                disabled={busy}
                onClick={() => m.role !== r && run('Saving the role', () => setSectionAdminRoleAction(m.id, r))}
                className={cn('rounded-md border px-2.5 py-1 text-xs font-medium', m.role === r ? 'border-navy bg-navy text-white' : 'border-border hover:bg-muted')}
              >
                {roleLabel(r)}
              </button>
            ))}
          </div>
          {!confirming && (
            <button type="button" className={secondary} disabled={busy} onClick={onAskRemove} aria-label={`Remove ${m.email} from the ${label} team`}>
              Remove
            </button>
          )}
        </div>
      </div>
      {confirming && (
        <div role="alertdialog" aria-label={`Remove ${m.email}`} className="space-y-2 rounded-md border border-destructive/40 p-3">
          <p>{m.email} loses access to {label}. Remove them from the team?</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" autoFocus className={secondary} onClick={onCancelRemove}>
              Keep on the team
            </button>
            <button
              type="button"
              className={danger}
              disabled={busy}
              onClick={() => {
                onCancelRemove()
                run('Removing', () => removeSectionAdminAction(m.id))
              }}
            >
              Remove from team
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

function Requests({ v }: { v: StaffSectionView }) {
  const a = useStaffAction()
  return (
    <div className={cn('space-y-2 text-sm', a.pending && 'cursor-wait [&_button]:cursor-wait')}>
      <h4 className="font-medium">Requests to join</h4>
      {v.requestsError && <p role="alert" className="text-destructive">{v.requestsError}</p>}
      {!v.requestsError && v.requests.length === 0 && <p className="text-muted-foreground">No one is waiting. A person who verifies a claim on a section that already has an admin appears here.</p>}
      {v.requests.length > 0 && (
        <>
          <p className="text-muted-foreground">These people verified their work email and asked for {v.label} while someone already holds it. Nothing has been granted.</p>
          <ul className="divide-y divide-border rounded-md border border-border">
            {v.requests.map((r) => (
              <RequestRow key={r.claimId} r={r} label={v.label} busy={a.pending} run={a.run} />
            ))}
          </ul>
        </>
      )}
      <Feedback a={a} />
    </div>
  )
}

function RequestRow({ r, label, busy, run }: { r: StaffRequestRow; label: string; busy: boolean; run: ReturnType<typeof useStaffAction>['run'] }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 p-3">
      <div>
        <p className="font-medium">{r.name}</p>
        <p className="text-xs text-muted-foreground">
          {r.title} · {r.email} · asked on {r.requestedOn}
        </p>
      </div>
      <button type="button" className={secondary} disabled={busy} onClick={() => run('Making admin', () => makeAdminFromRequestAction(r.claimId))} aria-label={`Make ${r.name} an admin of ${label}`}>
        Make admin
      </button>
    </li>
  )
}
