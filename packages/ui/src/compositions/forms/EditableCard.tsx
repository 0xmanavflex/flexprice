import { useState, type FormEvent, type ReactNode } from 'react'
import { PencilIcon } from 'lucide-react'
import { Button } from '@ui/components/primitives/button'
import { Input } from '@ui/components/primitives/input'
import { Textarea } from '@ui/components/primitives/textarea'
import { provenance } from '@ui/provenance'
import { Section } from '../layout/Section'
import type { EditableFieldDef } from './EditableFields'

export const EditableCardProvenance = provenance({
  source: 'composition',
  composes: ['compositions/section', 'ui/input', 'ui/textarea', 'ui/button'],
  note: 'A card whose header pencil turns its own fields into inputs, with Save and Cancel in place.',
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

  const pencil =
    locked || editing ? undefined : (
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Edit ${title.toLowerCase()}`}
        onClick={start}
      >
        <PencilIcon aria-hidden className="size-4" />
      </Button>
    )

  return (
    <Section
      title={title}
      {...(description ? { description } : {})}
      actions={pencil}
      {...(className ? { className } : {})}
    >
      <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-5">
        <dl className="grid grid-cols-1 gap-x-10 gap-y-5 text-sm md:grid-cols-3">
          {fields.map((field) => {
            const id = `edit-${title}-${field.key}`.replace(/\s+/g, '-').toLowerCase()
            const error = errors[field.key]
            const wide = field.multiline ? 'md:col-span-3' : ''
            if (!editing || field.readOnly) {
              return (
                <div key={field.key} className={`flex min-w-0 flex-col gap-1 ${wide}`}>
                  <dt className="text-muted-foreground text-xs">{field.label}</dt>
                  <dd className="min-w-0 font-normal break-words">
                    {field.display ??
                      (field.value || (
                        <span className="text-muted-foreground font-normal">
                          {field.placeholder ?? '—'}
                        </span>
                      ))}
                  </dd>
                </div>
              )
            }
            const Control = field.multiline ? Textarea : Input
            return (
              <div key={field.key} className={`flex flex-col gap-1 ${wide}`}>
                <label htmlFor={id} className="text-muted-foreground text-xs">
                  {field.label}
                </label>
                <Control
                  id={id}
                  value={draft[field.key] ?? ''}
                  disabled={pending}
                  placeholder={field.placeholder}
                  aria-invalid={error ? true : undefined}
                  onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
                />
                {error ? (
                  <p role="alert" className="text-destructive text-xs">
                    {error}
                  </p>
                ) : null}
              </div>
            )
          })}
        </dl>
        {children}
        {formError ? (
          <p role="alert" className="text-destructive text-sm">
            {formError}
          </p>
        ) : null}
        {editing ? (
          <div className="flex justify-end gap-2 border-t pt-4">
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
      </form>
    </Section>
  )
}
