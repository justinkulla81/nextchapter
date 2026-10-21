// The design rule for picking one of several options (design-principles.md): 2 to 4 choices sit side by
// side as buttons, 5 or more become a dropdown. Pure, so every redesigned form decides the same way and a
// test can hold the rule in place.

export const MAX_BUTTON_CHOICES = 4

export type ChoiceControl = 'buttons' | 'dropdown'

/** Counts the real options only: a leading "No preference" or "Any" is one of them, a placeholder is not. */
export function controlFor(optionCount: number): ChoiceControl {
  return optionCount > MAX_BUTTON_CHOICES ? 'dropdown' : 'buttons'
}
