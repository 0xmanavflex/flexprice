import type { ReactNode } from 'react'
import { FieldLabel } from '@ui/components/primitives/field'
import { provenance } from '@ui/provenance'
import { InfoHint } from './InfoHint'

/**
 * A label with its (i), for forms that wire their own controls instead of
 * going through `Field` or `FormRow`.
 */
export const LabelWithHintProvenance = provenance({
  source: 'composition',
  composes: ['ui/field', 'compositions/InfoHint'],
  note: 'Stock FieldLabel plus the shared (i) hint, for hand-wired controls.',
})

export interface LabelWithHintProps {
  htmlFor?: string
  hint: string
  children: ReactNode
}

export function LabelWithHint({ htmlFor, hint, children }: LabelWithHintProps) {
  return (
    <div className="flex items-center gap-1.5">
      <FieldLabel {...(htmlFor ? { htmlFor } : {})}>{children}</FieldLabel>
      <InfoHint>{hint}</InfoHint>
    </div>
  )
}
