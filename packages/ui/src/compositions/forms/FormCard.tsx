import { Children, Fragment, isValidElement, useId, type ReactNode } from 'react'
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
 * The main content of a form: ONE card per form (or per step), laid out as in
 * ReUI's `form-9` (`blocks/form-9/components/enterprise-member-invite.tsx`): a
 * header with title, description and a Required/Optional badge, then rows with
 * the title and its description on the left and the control on the right, every
 * part split by inset dashed rules.
 *
 * `form-9`'s `FormRow` and `InsetSeparator` are private to that demo and cannot
 * be edited in place, so the markup is rebuilt here with the same tokens, on the
 * stock Field / Separator primitives, with the same id and aria wiring as `Field`
 * so labels, descriptions and errors stay connected to the control.
 */
export const FormCardProvenance = provenance({
  source: 'composition',
  composes: ['ui/field', 'ui/separator', '@reui/badge', 'compositions/InfoHint'],
  note: 'form-9 layout: one card, header with badge, title+description / control rows, dashed inset separators. Lineage: blocks/form-9.',
})

const dashedRule =
  'border-border bg-transparent data-horizontal:h-0 data-horizontal:border-t data-horizontal:border-dashed'

/**
 * The dashed rule between a form's rows, for a form that is not a `FormCard`
 * but splits into parts the same way (an alert's info, warning and critical
 * levels), so both read alike.
 */
export function DashedRule(props: { 'data-testid'?: string }) {
  return <Separator className={dashedRule} {...props} />
}

function flattenRows(children: ReactNode): ReactNode[] {
  return Children.toArray(children).flatMap((child) =>
    isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment
      ? flattenRows(child.props.children)
      : [child],
  )
}

export interface FormCardProps {
  title?: string
  /** Whether the card holds fields the form cannot be submitted without. */
  status?: 'required' | 'optional'
  /**
   * Anything else for the title row's right side: a count, an Edit link, a
   * qualifier like "2 overridden". Sits after the status badge.
   */
  adornment?: ReactNode
  /** Sits to the left of the title, so a long form can be scanned by section. */
  icon?: ReactNode
  /** A muted line under the title: what the card is for, or a short status. */
  description?: ReactNode
  children: ReactNode
  className?: string
}

export function FormCard({
  title,
  status,
  adornment,
  icon,
  description,
  children,
  className,
}: FormCardProps) {
  const rows = flattenRows(children)
  return (
    <section className={cn('bg-background flex w-full flex-col rounded-xl border', className)}>
      {title ? (
        <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex min-w-0 items-center gap-2">
              {icon}
              <h2 className="text-sm font-medium">{title}</h2>
            </div>
            {description ? (
              <p className="text-muted-foreground text-[13px]/relaxed">{description}</p>
            ) : null}
          </div>
          {/* Centred on the title, and `-my-1.5` takes back a button's extra height,
              so a card is as tall with an action in its header as without. */}
          {status || adornment ? (
            <div className="-my-1.5 flex shrink-0 items-center gap-2">
              {status ? (
                <Badge variant={status === 'required' ? 'primary-light' : 'secondary'} size="sm">
                  {status === 'required' ? 'Required' : 'Optional'}
                </Badge>
              ) : null}
              {adornment}
            </div>
          ) : null}
        </div>
      ) : null}
      <FieldGroup className="gap-0">
        {rows.map((row, index) => (
          <div key={index}>
            {index > 0 || title ? (
              <div className="px-5 sm:px-6">
                <Separator className={dashedRule} />
              </div>
            ) : null}
            {row}
          </div>
        ))}
      </FieldGroup>
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
  /** Description shown under the title; also the control's accessible description. */
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
        'grid gap-3 px-5 py-4 sm:px-6 md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]',
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
