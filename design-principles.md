# Design Principles

> These principles govern how new products, features, and UI are designed and built.
> They are written as concrete, testable rules so they can be checked against any design.
> Edit freely — replace the starter rules below with your own conventions.

## How to use this document

- When designing a new product, feature, or component, review every principle below and apply the ones that are relevant.
- When a design would violate a principle, either revise the design or flag the conflict explicitly and explain the tradeoff.
- Prefer the most specific principle when two seem to conflict.

---

## Core principles

1. When a choice has 2–4 discrete options, render them as adjacent buttons rather than a dropdown.
2. When a button is clicked, change the mouse cursor to a busy/thinking state (e.g., `cursor: wait` or a spinner cursor) while the triggered action is processing, and restore the normal cursor once it completes.

---

## Layout & structure

- When a choice has 5 or more options, use a dropdown or searchable list instead of buttons.
- Give every screen one primary action, and make it the most visually prominent element on the screen.
- Group related controls together; separate unrelated groups with whitespace, not with borders or lines wherever possible.
- Keep primary content and primary actions above the fold on the default viewport.

## Interaction

- Every action that changes data or state must give immediate visible feedback (loading state, success confirmation, or error).
- Destructive actions (delete, remove, overwrite) require an explicit confirmation step and must never be the default focus.
- Never disable a button without explaining, in-context, why it is disabled and what the user must do to enable it.
- Preserve user input on error — never clear a form because one field failed validation.
- Make the default option the safest and most common choice.

## Visual

- Use a single accent color for primary actions; do not use the accent color for anything that is not actionable.
- Maintain a consistent spacing scale (e.g., 4 / 8 / 16 / 24 / 32 px); do not use arbitrary one-off spacing values.
- Text must meet WCAG AA contrast against its background at minimum.
- Limit the interface to two typefaces at most: one for UI/body, optionally one for display.

## Content & copy

- Write button labels as the action they perform ("Save changes", "Delete file"), not generic words ("OK", "Submit").
- Write error messages that say what went wrong and what to do next, in plain language, without error codes as the primary message.
- Use sentence case for all UI text unless a brand rule says otherwise.

## Code & implementation

- Build UI from reusable components; do not duplicate a pattern that already exists as a component.
- Every interactive element must be keyboard-accessible and have an accessible label.
- Keep component state as local as possible; lift state up only when it is genuinely shared.
- Name things by what they do, not by how they look ("PrimaryAction", not "BlueButton").
- Handle the empty, loading, and error states of every data-driven view — not just the success state.

---

_Last updated: replace with date. Owner: replace with name._
