// Reading the connection forms, and the state they show. Shared by the organization portal and the employer hiring portal.
import type { Party, PartyKind } from './rules'

export type ConnState = { ok?: boolean; message?: string; error?: string } | undefined

export function partyFrom(raw: FormDataEntryValue | null): Party | null {
  const m = /^(INSTITUTION|EMPLOYER):([A-Za-z0-9_-]{1,64})$/.exec(String(raw ?? ''))
  return m ? { kind: m[1] as PartyKind, id: m[2] } : null
}
export const idFrom = (raw: FormDataEntryValue | null) => {
  const s = String(raw ?? '')
  return /^[A-Za-z0-9_-]{1,64}$/.test(s) ? s : null
}
