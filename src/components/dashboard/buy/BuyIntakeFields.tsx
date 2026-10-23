import { ChoiceButtons } from '@/components/candidate/ChoiceButtons'
import type { BuyDetails, BuyField } from '@/lib/journey/buy-business'

const SELECT = 'h-10 w-full max-w-md rounded-lg border border-border bg-background px-3 text-sm text-ink focus-visible:ring-2 focus-visible:ring-ink/40'

// One profile question, with the reason we ask first. Two to four choices are buttons, five or more a
// dropdown, several answers are checkboxes, and a place is a text box (the design principles).
export function BuyIntakeField({ field, current }: { field: BuyField; current: BuyDetails }) {
  const value = (current as Record<string, unknown>)[field.key]
  return (
    <fieldset className="space-y-2">
      <legend className="text-base font-semibold text-ink">{field.label}</legend>
      <p className="text-sm text-muted-foreground">Why we ask: {field.why}</p>
      {field.kind === 'choice' && field.options && field.options.length <= 4 && (
        <ChoiceButtons name={field.key} label={field.label} options={field.options} defaultValue={typeof value === 'string' ? value : undefined} />
      )}
      {field.kind === 'choice' && field.options && field.options.length > 4 && (
        <select name={field.key} aria-label={field.label} defaultValue={typeof value === 'string' ? value : ''} className={SELECT}>
          <option value="">Choose one</option>
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
      {field.kind === 'multi' && field.options && (
        <div className="grid gap-2 sm:grid-cols-2">
          <input type="hidden" name={`${field.key}__shown`} value="1" />
          {field.options.map((o) => (
            <label key={o.value} className="flex items-start gap-2 text-sm text-ink">
              <input type="checkbox" name={field.key} value={o.value} defaultChecked={Array.isArray(value) && value.includes(o.value)} className="mt-0.5" />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      )}
      {field.kind === 'text' && (
        <input type="text" name={field.key} maxLength={120} defaultValue={typeof value === 'string' ? value : ''} aria-label={field.label} placeholder="For example: Louisville, Kentucky" className={SELECT} />
      )}
    </fieldset>
  )
}
