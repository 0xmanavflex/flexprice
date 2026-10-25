import { useId, type ReactNode } from 'react'
import {
  Field as FieldRoot,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@ui/components/primitives/field'
import { provenance } from '@ui/provenance'
import { InfoHint } from './InfoHint'

/**
 * A label, a control, its hint and its error: wired together.
 *
 * The layout and typography are the stock shadcn `Field` parts; this only adds
 * the wiring people forget: `htmlFor` to the control, `aria-describedby` to
 * both the hint (shown behind an (i), kept in the DOM for screen readers) and the error, `aria-invalid`, and an announced error.
 *
 * The child is a function because the generated id has to reach the control,
 * and the control differs every time (input, select, combobox, switch).
 */
export const FieldProvenance = provenance({
  source: 'composition',
  composes: ['ui/field', 'compositions/InfoHint'],
  note: 'Stock Field/FieldLabel/FieldDescription/FieldError plus id and aria wiring; the hint sits behind an (i).',
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
    <FieldRoot data-invalid={error ? true : undefined}>
      <div className="flex items-center gap-1.5">
        <FieldLabel htmlFor={id}>
          {label}
          {required ? (
            <span aria-hidden className="text-destructive">
              *
            </span>
          ) : null}
        </FieldLabel>
        {hint ? <InfoHint>{hint}</InfoHint> : null}
      </div>

      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        required: required || undefined,
      })}

      {hint ? (
        <FieldDescription id={hintId} className="sr-only">
          {hint}
        </FieldDescription>
      ) : null}
      {error ? (
        <FieldError id={errorId} className="text-xs">
          {error}
        </FieldError>
      ) : null}
    </FieldRoot>
  )
}
