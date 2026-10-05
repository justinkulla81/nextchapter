import { cn } from '@/lib/utils'

// 2–4 options rendered as adjacent buttons (design-principles.md) that still
// submit with a plain <form>: real radio inputs, visually hidden, with the
// label styled as the button. Keyboard: Tab into the group, arrows to move.
export function SegmentedRadio({
  name,
  options,
  defaultValue,
  legend,
  size = 'md',
}: {
  name: string
  options: { value: string; label: string }[]
  defaultValue: string
  legend: string
  size?: 'sm' | 'md'
}) {
  return (
    <fieldset className="space-y-1">
      <legend className={cn(size === 'sm' ? 'sr-only' : 'mb-1 text-sm font-medium')}>{legend}</legend>
      <div className="inline-flex flex-wrap overflow-hidden rounded-md border border-input">
        {options.map((option) => (
          <label key={option.value} className="relative">
            <input type="radio" name={name} value={option.value} defaultChecked={option.value === defaultValue} className="peer sr-only" />
            <span
              className={cn(
                'block cursor-pointer border-r border-input text-muted-foreground transition-colors last:border-r-0 hover:bg-muted',
                'peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring',
                size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'
              )}
            >
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
