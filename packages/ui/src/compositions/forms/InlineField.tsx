import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { PencilIcon } from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import { Input } from '@ui/components/primitives/input'
import { Textarea } from '@ui/components/primitives/textarea'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'

/**
 * A labelled value on a detail page that edits where it is displayed.
 *
 * For simple values only: a name, a description, one config value. Nothing
 * navigates and nothing reloads; Save calls `onSave`, the field shows a pending
 * state and any failure inline, and the page's query refetch supplies the new
 * `value`. Enter saves (Cmd/Ctrl+Enter when multiline), Escape cancels.
 *
 * Anything with several fields, dependent sections or validation across them
 * belongs on a dedicated Edit page, not here.
 */
export const InlineFieldProvenance = provenance({
  source: 'composition',
  composes: ['ui/input', 'ui/textarea', 'ui/button'],
  note: 'Detail-page value with an Edit affordance that swaps to a stock input in place.',
})

export interface InlineFieldProps {
  label: string
  value: string
  /** Display node for the read state; defaults to the text. */
  display?: ReactNode
  /** Resolve to commit; reject (or throw) with an Error to show its message. */
  onSave: (next: string) => Promise<unknown> | void
  multiline?: boolean
  required?: boolean
  placeholder?: string
  /** Return a message to block the save. */
  validate?: (next: string) => string | null
  /** Hide the edit affordance, e.g. for archived records. */
  readOnly?: boolean
  className?: string
}

export function InlineField({
  label,
  value,
  display,
  onSave,
  multiline = false,
  required = false,
  placeholder,
  validate,
  readOnly = false,
  className,
}: InlineFieldProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const open = () => {
    setDraft(value)
    setError(null)
    setEditing(true)
  }
  const cancel = () => {
    setEditing(false)
    setError(null)
  }

  const save = async () => {
    const next = draft.trim()
    if (required && next === '') return setError(`${label} is required.`)
    const invalid = validate?.(next) ?? null
    if (invalid) return setError(invalid)
    if (next === value) return cancel()
    setPending(true)
    setError(null)
    try {
      await onSave(next)
      setEditing(false)
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : 'Could not save.')
    } finally {
      setPending(false)
    }
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      cancel()
    } else if (event.key === 'Enter' && (!multiline || event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      void save()
    }
  }

  const fieldId = `inline-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  const errorId = `${fieldId}-error`

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={editing ? fieldId : undefined} className="text-muted-foreground text-xs">
        {label}
      </label>
      {editing ? (
        <div className="flex flex-col gap-2">
          {multiline ? (
            <Textarea
              id={fieldId}
              ref={inputRef}
              rows={3}
              value={draft}
              disabled={pending}
              placeholder={placeholder}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onKeyDown}
            />
          ) : (
            <Input
              id={fieldId}
              ref={inputRef}
              value={draft}
              disabled={pending}
              placeholder={placeholder}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onKeyDown}
            />
          )}
          {error ? (
            <p id={errorId} role="alert" className="text-destructive text-xs">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={pending} onClick={() => void save()}>
              {pending ? 'Saving…' : 'Save'}
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={cancel}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="group flex items-start gap-2">
          <div className="min-w-0 text-sm">
            {display ??
              (value || <span className="text-muted-foreground">{placeholder ?? '—'}</span>)}
          </div>
          {readOnly ? null : (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={`Edit ${label}`}
              onClick={open}
              className="opacity-60 group-hover:opacity-100 focus-visible:opacity-100"
            >
              <PencilIcon aria-hidden className="size-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
