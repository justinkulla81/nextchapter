export function StepLabel({ step, total }: { step: number; total: number }) {
  return (
    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      Step {step} of {total}
    </p>
  )
}
