import { useId, type ReactNode } from 'react'
import { Label } from '@ui/primitives/label'
import { provenance } from '@ui/provenance'

/**
 * A label, a control, its hint and its error — wired together.
 *
 * Extracted after the same twenty lines appeared in two forms. The wiring is
 * the whole point and it is the part people forget: `htmlFor` to the control,
 * `aria-describedby` to *both* the hint and the error, `role="alert"` on the
 * error so it is announced rather than merely rendered.
 *
 * The child is a function because the id has to reach the control, and the
 * control is different every time — a native input, a select, a ReUI
 * primitive. Generating the id here rather than deriving it from the label
 * means two fields can share a label text without colliding.
 */
export const FieldProvenance = provenance({
  source: 'composition',
  composes: ['ui/label'],
  note: 'Label/control/hint/error association, so it cannot be forgotten per form.',
})

export interface FieldProps {
  label: string
  hint?: string
  /** Validation message. Presence switches the field into its error state. */
  error?: string | undefined
  /** Marks the control required for assistive tech, not just visually. */
  required?: boolean
  children: (props: {
    id: string
    'aria-describedby': string | undefined
    'aria-invalid': true | undefined
    required: boolean | undefined
  }) => ReactNode
}

export function Field({ label, hint, error, required, children }: FieldProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {required ? (
          <span aria-hidden className="text-destructive">
            {' '}
            *
          </span>
        ) : null}
      </Label>

      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}

      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        required: required || undefined,
      })}

      {error ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
