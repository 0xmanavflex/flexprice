import { Children, useId, type ReactNode } from 'react'
import {
  Field as FieldRoot,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from '@ui/components/primitives/field'
import { Badge } from '@ui/components/reui/badge'
import { Separator } from '@ui/components/primitives/separator'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { InfoHint } from './InfoHint'

/**
 * The single-page form layout from ReUI's `form-12`: one Section-style surface
 * (`bg-background rounded-xl border`, never the Card primitive), and inside it
 * label-and-hint on the left of each row, the control on the right, rows split
 * by inset dashed rules.
 *
 * `form-12` is an ecommerce block, so only its structure is taken, not its
 * fields. The stock Field / Separator primitives do the work; this adds
 * the row grid, the separators between rows, and the same id and aria wiring
 * as `Field` so labels, hints and errors stay connected to the control.
 */
export const FormCardProvenance = provenance({
  source: 'composition',
  composes: ['ui/field', 'ui/separator', '@reui/badge'],
  note: 'form-12 layout: Section surface, label/control rows, dashed inset separators. Lineage: compositions/section.',
})

const dashedRule =
  'border-border bg-transparent data-horizontal:h-0 data-horizontal:border-t data-horizontal:border-dashed'

export interface FormCardProps {
  title?: string
  description?: string
  /** Whether the card holds fields the form cannot be submitted without. */
  status?: 'required' | 'optional'
  children: ReactNode
  className?: string
}

export function FormCard({ title, description, status, children, className }: FormCardProps) {
  const rows = Children.toArray(children)
  return (
    <section className={cn('bg-background flex w-full flex-col rounded-xl border', className)}>
      {title ? (
        <div className="flex items-start justify-between gap-4 border-b px-6 py-4">
          <div className="space-y-0.5">
            <h2 className="text-sm font-medium">{title}</h2>
            {description ? (
              <p className="text-muted-foreground text-[13px]">{description}</p>
            ) : null}
          </div>
          {status ? (
            <Badge variant={status === 'required' ? 'primary-light' : 'secondary'} size="sm">
              {status === 'required' ? 'Required' : 'Optional'}
            </Badge>
          ) : null}
        </div>
      ) : null}
      <div>
        <FieldGroup className="gap-0">
          {rows.map((row, index) => (
            <div key={index}>
              {index > 0 ? (
                <div className="px-5 sm:px-6">
                  <Separator className={dashedRule} />
                </div>
              ) : null}
              {row}
            </div>
          ))}
        </FieldGroup>
      </div>
    </section>
  )
}

interface ControlProps {
  id: string
  'aria-describedby': string | undefined
  'aria-invalid': true | undefined
  required: boolean | undefined
}

export interface FormRowProps {
  label: string
  /** Supporting text under the label; also the control's accessible description. */
  hint?: string
  error?: string | undefined
  required?: boolean
  /** Top-align the control, for tall ones (a textarea, a radio group). */
  align?: 'center' | 'start'
  /**
   * A function receives the wired control props (a labelled input). A plain
   * node is for a group of controls, where the label becomes a group title.
   */
  children: ReactNode | ((props: ControlProps) => ReactNode)
}

export function FormRow({
  label,
  hint,
  error,
  required,
  align = 'center',
  children,
}: FormRowProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  const isControl = typeof children === 'function'

  const asterisk = required ? (
    <span aria-hidden className="text-destructive">
      *
    </span>
  ) : null

  return (
    <FieldRoot
      data-invalid={error ? true : undefined}
      className={cn(
        'grid gap-3 px-5 py-4 sm:px-6 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]',
        align === 'start' ? 'md:items-start' : 'md:items-center',
      )}
    >
      <FieldContent className="gap-0.5 md:pt-0.5">
        <div className="flex items-center gap-1.5">
          {isControl ? (
            <FieldLabel htmlFor={id}>
              {label}
              {asterisk}
            </FieldLabel>
          ) : (
            <FieldTitle>
              {label}
              {asterisk}
            </FieldTitle>
          )}
          {hint ? <InfoHint>{hint}</InfoHint> : null}
        </div>
        {hint ? (
          <FieldDescription id={hintId} className="sr-only">
            {hint}
          </FieldDescription>
        ) : null}
      </FieldContent>
      <div className="flex min-w-0 flex-col gap-1.5">
        {isControl
          ? children({
              id,
              'aria-describedby': describedBy,
              'aria-invalid': error ? true : undefined,
              required: required || undefined,
            })
          : children}
        {error ? (
          <FieldError id={errorId} className="text-xs">
            {error}
          </FieldError>
        ) : null}
      </div>
    </FieldRoot>
  )
}
