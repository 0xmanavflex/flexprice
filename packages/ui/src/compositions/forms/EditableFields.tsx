import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '@ui/components/primitives/button'
import { Input } from '@ui/components/primitives/input'
import { Textarea } from '@ui/components/primitives/textarea'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { InlineField } from './InlineField'

/**
 * The basic-information block of a detail page, editable where it is shown.
 *
 * Two ways in, one save path. Each value has its own pencil (`InlineField`) for
 * a one-value change; the page header's Edit flips `editing` so every field
 * becomes an input at once, with a single Save and Cancel. Both call `onSave`
 * with only the keys that changed, so the page issues one update either way and
 * never navigates.
 *
 * `editing` is controlled so the header button, which lives outside this block,
 * can start it.
 */
export const EditableFieldsProvenance = provenance({
  source: 'composition',
  composes: ['compositions/inline-field', 'ui/input', 'ui/textarea', 'ui/button'],
  note: 'Detail-page fields with per-field pencils and a header-driven edit-all mode.',
})

export interface EditableFieldDef {
  key: string
  label: string
  value: string
  display?: ReactNode
  multiline?: boolean
  required?: boolean
  placeholder?: string
  validate?: (next: string) => string | null
  readOnly?: boolean
  /** A short explanation, shown as an info hint beside the label. */
  hint?: string
}

export interface EditableFieldsProps {
  fields: readonly EditableFieldDef[]
  editing: boolean
  onEditingChange: (editing: boolean) => void
  /** Only the changed keys. Reject with an Error to show its message. */
  onSave: (changes: Record<string, string>) => Promise<unknown> | void
  className?: string
}

export function EditableFields({
  fields,
  editing,
  onEditingChange,
  onSave,
  className,
}: EditableFieldsProps) {
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (editing) {
      setDraft(Object.fromEntries(fields.map((field) => [field.key, field.value])))
      setErrors({})
      setFormError(null)
    }
    // Re-seed only when edit mode opens; a refetch mid-edit must not eat typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  if (!editing) {
    return (
      <div className={cn('grid gap-4 sm:grid-cols-2', className)}>
        {fields.map(({ key, ...field }) => (
          <InlineField key={key} {...field} onSave={(next) => onSave({ [key]: next })} />
        ))}
      </div>
    )
  }

  const cancel = () => onEditingChange(false)

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
    if (Object.keys(changes).length === 0) return cancel()
    setPending(true)
    setFormError(null)
    try {
      await onSave(changes)
      onEditingChange(false)
    } catch (caught) {
      setFormError(caught instanceof Error && caught.message ? caught.message : 'Could not save.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className={cn('flex flex-col gap-4', className)}>
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => {
          const id = `edit-${field.key}`
          const error = errors[field.key]
          if (field.readOnly) {
            return (
              <div key={field.key} className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">{field.label}</span>
                <div className="text-sm">{field.display ?? (field.value || '—')}</div>
              </div>
            )
          }
          const Control = field.multiline ? Textarea : Input
          return (
            <div key={field.key} className="flex flex-col gap-1">
              <label htmlFor={id} className="text-muted-foreground text-xs">
                {field.label}
              </label>
              <Control
                id={id}
                value={draft[field.key] ?? ''}
                disabled={pending}
                placeholder={field.placeholder}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${id}-error` : undefined}
                onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
              />
              {error ? (
                <p id={`${id}-error`} role="alert" className="text-destructive text-xs">
                  {error}
                </p>
              ) : null}
            </div>
          )
        })}
      </div>
      {formError ? (
        <p role="alert" className="text-destructive text-sm">
          {formError}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Saving…' : 'Save changes'}
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={cancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
