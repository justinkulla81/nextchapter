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
  action: () => void | Promise<void>
  confirmMessage: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <form
      action={action}
      className={className}
      onSubmit={(e) => {
        if (!window.confirm(confirmMessage)) e.preventDefault()
      }}
    >
      {children}
    </form>
  )
}
