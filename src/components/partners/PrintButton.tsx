'use client'

// Opens the browser's print dialog, where "Save as PDF" is one of the choices.
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground print:hidden">
      Print or save as PDF
    </button>
  )
}
