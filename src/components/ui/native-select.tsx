import { cn } from '@/lib/utils'

/**
 * A plain browser dropdown, for choices with five or more options (design-principles.md:
 * two to four options are adjacent buttons, five or more a dropdown). Works inside a
 * server-action form as-is and is keyboard- and screen-reader-accessible by default.
 */
export function NativeSelect({
  id,
  name,
  options,
  defaultValue,
  placeholder,
  onChange,
  className,
  'aria-label': ariaLabel,
}: {
  id?: string
  name: string
  options: { value: string; label: string }[]
  defaultValue?: string | null
  /** The empty choice, e.g. "Prefer not to say". Always offered so a question is never forced. */
  placeholder: string
  onChange?: (value: string) => void
  className?: string
  'aria-label'?: string
}) {
  return (
    <select
      id={id}
      name={name}
      defaultValue={defaultValue ?? ''}
      aria-label={ariaLabel}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      className={cn('h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none', className)}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
