import { useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { XIcon } from '@ui/icons'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'

/**
 * A list of short values typed into one field, each shown as a chip: V1's
 * event filter values. Enter or a comma adds what was typed, pasting a
 * comma-separated list adds each, Backspace in the empty field removes the last
 * chip, and leaving the field keeps a value still being typed.
 *
 * `fixed` values are shown without a remove control and survive Backspace: the
 * ones a backend only adds to, such as a saved meter filter's.
 */
export const ValuesInputProvenance = provenance({
  source: 'composition',
  composes: [],
  note: 'A field styled like ui/input, holding removable value chips and a bare input.',
})

export interface ValuesInputProps {
  value: readonly string[]
  onChange: (next: string[]) => void
  /** Values that cannot be removed here; shown as chips without a remove control. */
  fixed?: readonly string[]
  id?: string
  placeholder?: string
  disabled?: boolean
  onBlur?: () => void
  required?: boolean | undefined
  /** When no `<label>` names the field. */
  'aria-label'?: string | undefined
  'aria-invalid'?: boolean | undefined
  'aria-describedby'?: string | undefined
  className?: string
}

const split = (text: string) =>
  text
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

export function ValuesInput({
  value,
  onChange,
  fixed = [],
  id,
  placeholder,
  disabled = false,
  onBlur,
  required,
  className,
  ...aria
}: ValuesInputProps) {
  const [draft, setDraft] = useState('')

  const add = (text: string) => {
    const fresh = split(text).filter((part) => !value.includes(part))
    if (fresh.length > 0) onChange([...value, ...new Set(fresh)])
    setDraft('')
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      add(draft)
    } else if (event.key === 'Backspace' && draft === '' && value.length > 0) {
      const last = value[value.length - 1]
      if (last !== undefined && !fixed.includes(last)) onChange(value.slice(0, -1))
    }
  }

  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData('text')
    if (!text.includes(',')) return
    event.preventDefault()
    add(`${draft},${text}`)
  }

  return (
    <div
      className={cn(
        'border-input focus-within:border-ring focus-within:ring-ring/50 dark:bg-input/30 flex min-h-8 w-full flex-wrap items-center gap-1 rounded-lg border bg-transparent px-1.5 py-1 transition-colors focus-within:ring-3',
        aria['aria-invalid'] &&
          'border-destructive ring-destructive/20 dark:border-destructive/50 ring-3',
        disabled && 'bg-input/50 cursor-not-allowed opacity-50',
        className,
      )}
    >
      {value.map((item) => (
        <span
          key={item}
          className={cn(
            'bg-muted text-foreground inline-flex h-6 max-w-full items-center gap-1 rounded-md pl-2 text-xs',
            fixed.includes(item) ? 'pr-2' : 'pr-1',
          )}
        >
          <span className="truncate">{item}</span>
          {fixed.includes(item) ? null : (
            <button
              type="button"
              disabled={disabled}
              aria-label={`Remove ${item}`}
              onClick={() => onChange(value.filter((v) => v !== item))}
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex size-4 items-center justify-center rounded-sm outline-none focus-visible:ring-2"
            >
              <XIcon aria-hidden className="size-3" />
            </button>
          )}
        </span>
      ))}
      <input
        id={id}
        value={draft}
        disabled={disabled}
        placeholder={value.length === 0 ? placeholder : undefined}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onBlur={() => {
          if (draft.trim()) add(draft)
          onBlur?.()
        }}
        aria-required={required || undefined}
        {...aria}
        className="placeholder:text-muted-foreground h-6 min-w-20 flex-1 bg-transparent px-1 text-base outline-none md:text-sm"
      />
    </div>
  )
}
