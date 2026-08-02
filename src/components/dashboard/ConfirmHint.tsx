// Shared instructional text for the profile confirm-form pattern (gray-out
// once confirmed, re-enable on edit — see ProfileConfirmForm,
// IndustryConfirmForm, FunctionConfirmForm, SalaryConfirmForm,
// WorkAuthorizationConfirmForm). Without this, an unconfirmed field looked
// identical to a confirmed one except for a "+N pts" tag most people never
// notice — this makes "you need to act here" visually unmistakable, reusing
// the orange "needs attention" convention already used elsewhere in the
// dashboard (PendingEmployerReferenceBanner, LockedFeatureNotice).
export function ConfirmHint({ show }: { show: boolean }) {
  if (!show) return null
  return <p className="text-sm font-medium text-orange">Review below, then confirm to lock this in.</p>
}
