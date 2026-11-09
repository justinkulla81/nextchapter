// The staff admin area looks different from every member page, the same way staff emails do (src/lib/email/admin-layout.tsx):
// a navy bar that says so. It sits at the top of every admin page, in the shared admin layout, and is not dismissible.
export function AdminBanner({ className }: { className?: string }) {
  return (
    <div role="note" className={`flex flex-wrap items-center justify-between gap-2 bg-navy px-6 py-2 text-xs font-bold tracking-[0.14em] text-white uppercase ${className ?? ''}`}>
      <span>Internal · NextChapter staff only</span>
      <span className="rounded-sm bg-[#fde68a] px-2 py-0.5 tracking-wider text-[#78350f]">Not a member page</span>
    </div>
  )
}
