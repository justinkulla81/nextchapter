import { KIND_EXPLAINER, KIND_LABEL, type RoleKind } from '@/lib/careers/roles'

const STYLE: Record<RoleKind, string> = {
  lead: 'bg-navy text-white',
  contributor: 'border border-navy text-navy',
  platform: 'border border-border text-muted-foreground',
}

/** Says whether a role leads a function, works inside one, or is a platform listing. The label is text, not color alone. */
export function RoleBadge({ kind }: { kind: RoleKind }) {
  return (
    <span
      title={KIND_EXPLAINER[kind]}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLE[kind]}`}
    >
      {KIND_LABEL[kind]}
    </span>
  )
}
