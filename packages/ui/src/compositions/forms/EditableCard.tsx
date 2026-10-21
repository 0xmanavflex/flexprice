import { useState, type FormEvent, type ReactNode } from 'react'
import { PencilIcon } from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import { Input } from '@ui/components/primitives/input'
import { Textarea } from '@ui/components/primitives/textarea'
import { provenance } from '@ui/provenance'
import { cn } from '@ui/lib/cn'
import { FormCard, FormRow } from './FormCard'
import { WriteGate } from '../access/Access'
import type { EditableFieldDef } from './EditableFields'

export const EditableCardProvenance = provenance({
  source: 'composition',
  composes: ['compositions/forms/FormCard', 'ui/input', 'ui/textarea', 'ui/button'],
  note: 'A form card of label/value rows whose header pencil turns its own fields into inputs, with Save and Cancel in place.',
})

export interface EditableCardProps {
  title: string
  description?: string
  /** Editable fields; those marked `readOnly` stay display-only in both modes. */
  fields: readonly EditableFieldDef[]
  /** Only the changed keys. Reject with an Error to show its message. */
  onSave: (changes: Record<string, string>) => Promise<unknown> | void
  /** Hides the pencil (archived records). */
  locked?: boolean
  /** Always-read-only content shown below the fields. */
  children?: ReactNode
  className?: string
}

/**
 * One edit control per card. The pencil sits in the card header and flips only
 * this card's fields into inputs; Save and Cancel appear under them.
 */
export function EditableCard({
  title,
  description,
  fields,
  onSave,
  locked,
  children,
  className,
}: EditableCardProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const start = () => {
    setDraft(Object.fromEntries(fields.map((field) => [field.key, field.value])))
    setErrors({})
    setFormError(null)
    setEditing(true)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const nextErrors: Record<string, string> = {}
    const changes: Record<string, string> = {}
    for (const field of fields) {
      if (field.readOnly) continue
      const next = (draft[field.key] ?? '').trim()
      if (field.required && next === '') nextErrors[field.key] = `${field.label} is required.`
      else {
        const invalid = field.validate?.(next) ?? null
        if (invalid) nextErrors[field.key] = invalid
      }
      if (next !== field.value) changes[field.key] = next
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    if (Object.keys(changes).length === 0) return setEditing(false)
    setPending(true)
    setFormError(null)
    try {
      await onSave(changes)
      setEditing(false)
    } catch (caught) {
      setFormError(caught instanceof Error && caught.message ? caught.message : 'Could not save.')
    } finally {
      setPending(false)
    }
  }

  // Gated by the page's `AccessScope`: disabled with the reason when write is denied.
  const pencil =
    locked || editing ? undefined : (
      <WriteGate>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground size-8"
          aria-label={`Edit ${title.toLowerCase()}`}
          onClick={start}
        >
          <PencilIcon aria-hidden className="size-4" />
        </Button>
      </WriteGate>
    )

  /*
   * The create form's own rows, as on the feature page: the label and its hint
   * on the left, the value on the right, ruled apart. Editing swaps each value
   * for its input in place, so the card never changes shape.
   */
  return (
    <form onSubmit={(event) => void submit(event)} className={cn('flex flex-col', className)}>
      <FormCard title={title} {...(pencil ? { adornment: pencil } : {})}>
        {description ? (
          <p className="text-muted-foreground px-5 pb-4 text-[13px] sm:px-6">{description}</p>
        ) : null}
        {fields.map((field) => {
          const error = errors[field.key]
          const value =
            field.display ??
            (field.value || (
              <span className="text-muted-foreground">{field.placeholder ?? '—'}</span>
            ))
          if (!editing || field.readOnly) {
            return (
              <FormRow
                key={field.key}
                label={field.label}
                {...(field.hint ? { hint: field.hint } : {})}
                align={field.multiline ? 'start' : 'center'}
              >
                <div className="min-w-0 text-sm break-words">{value}</div>
              </FormRow>
            )
          }
          const Control = field.multiline ? Textarea : Input
          return (
            <FormRow
              key={field.key}
              label={field.label}
              {...(field.hint ? { hint: field.hint } : {})}
              {...(error ? { error } : {})}
              align={field.multiline ? 'start' : 'center'}
            >
              {({ id, ...aria }) => (
                <Control
                  id={id}
                  {...aria}
                  value={draft[field.key] ?? ''}
                  disabled={pending}
                  placeholder={field.placeholder}
                  onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
                />
              )}
            </FormRow>
          )
        })}
        {children ? <div className="px-5 py-4 sm:px-6">{children}</div> : null}
        {formError ? (
          <p role="alert" className="text-destructive px-5 py-4 text-sm sm:px-6">
            {formError}
          </p>
        ) : null}
        {editing ? (
          <div className="flex justify-end gap-2 px-5 py-4 sm:px-6">
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        ) : null}
      </FormCard>
    </form>
  )
}
