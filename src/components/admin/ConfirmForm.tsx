'use client'

// A plain <form action={...}> submits immediately on click — fine for the
// single-posting Approve/Reject buttons already on this page, but a bulk
// approve can silently push hundreds of postings live to candidates in one
// click. Per design-principles.md, that class of action needs an explicit
// confirmation step; this wraps any server action form with one via a
// native confirm() rather than building a custom modal for a single use.
export function ConfirmForm({
  action,
  confirmMessage,
  className,
  children,
}: {
  // A real server action reference (e.g. `someAction.bind(null, id)`), never
  // an inline closure defined in the server component — only an actual
  // server action can cross the boundary into this client component; a
  // plain function wrapping one throws at runtime ("Functions cannot be
  // passed directly to Client Components"), not at build time, so this
  // bug shipped straight past tsc once already.
  action: (formData: FormData) => unknown
  confirmMessage: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <form
      // Wrapped here, inside the client component, purely to satisfy the DOM
      // <form> element's own action type (void | Promise<void>) — this
      // closure never crosses the server/client boundary itself, unlike
      // `action` as received from the caller, which must be a real server
      // action reference the whole way in.
      action={async (formData) => { await action(formData) }}
      className={className}
      onSubmit={(e) => {
        if (!window.confirm(confirmMessage)) e.preventDefault()
      }}
    >
      {children}
    </form>
  )
}
