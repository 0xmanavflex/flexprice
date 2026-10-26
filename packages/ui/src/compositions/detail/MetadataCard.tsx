import { useId, useState, type FormEvent } from 'react'
import { CopyIcon, PencilIcon, PlusIcon, Trash2Icon } from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import { Input } from '@ui/components/primitives/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@ui/components/primitives/tooltip'
import { provenance } from '@ui/provenance'
import { toast } from 'sonner'
import { Section } from '../layout/Section'

export const MetadataCardProvenance = provenance({
  source: 'composition',
  composes: ['compositions/section', 'ui/input', 'ui/button'],
  note: 'A key/value card with a pencil icon button at the top right of the header: rows become inputs with add and remove, and Save and Cancel replace Edit in the header.',
})

export interface MetadataCardProps {
  title?: string
  description?: string
  metadata: Readonly<Record<string, string>>
  /** The whole map after the edit. Reject with an Error to show its message. Omitted, the card is read-only. */
  onSave?: (metadata: Record<string, string>) => Promise<unknown> | void
  className?: string
}

interface DraftRow {
  id: number
  key: string
  value: string
}

/**
 * Free-form key/value fields on a record. One pencil button at the top right of
 * the card turns the rows into inputs; blank rows are dropped and duplicate keys are
 * refused, so what is saved is exactly what is shown.
 */
export function MetadataCard({
  title = 'Metadata',
  description,
  metadata,
  onSave,
  className,
}: MetadataCardProps) {
  const [editing, setEditing] = useState(false)
  const [rows, setRows] = useState<DraftRow[]>([])
  const [nextId, setNextId] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const entries = Object.entries(metadata)
  const formId = useId()

  const start = () => {
    setRows(entries.map(([key, value], index) => ({ id: index, key, value })))
    setNextId(entries.length)
    setError(null)
    setEditing(true)
  }

  const update = (id: number, patch: Partial<DraftRow>) =>
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const next: Record<string, string> = {}
    for (const row of rows) {
      const key = row.key.trim()
      if (key === '' && row.value.trim() === '') continue
      if (key === '') return setError('Every value needs a key.')
      if (key in next) return setError(`The key "${key}" is used twice.`)
      next[key] = row.value
    }
    setPending(true)
    setError(null)
    try {
      await onSave?.(next)
      setEditing(false)
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : 'Could not save.')
    } finally {
      setPending(false)
    }
  }

  const actions = editing ? (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => setEditing(false)}
      >
        Cancel
      </Button>
      <Button type="submit" form={formId} size="sm" disabled={pending}>
        {pending ? 'Saving…' : 'Save'}
      </Button>
    </>
  ) : onSave ? (
    <Button
      variant="ghost"
      size="icon"
      onClick={start}
      aria-label={`Edit ${title.toLowerCase()}`}
      title={`Edit ${title.toLowerCase()}`}
    >
      <PencilIcon aria-hidden className="size-4" />
    </Button>
  ) : undefined

  return (
    <Section
      title={title}
      {...(description ? { description } : {})}
      actions={actions}
      flush
      {...(className ? { className } : {})}
    >
      <form id={formId} onSubmit={(event) => void submit(event)} className="flex flex-col">
        {editing ? (
          <div className="flex flex-col gap-4 p-6">
            <ul className="flex flex-col gap-2">
              {rows.map((row, index) => (
                <li key={row.id} className="flex items-center gap-2">
                  <Input
                    aria-label={`Key ${index + 1}`}
                    placeholder="key"
                    value={row.key}
                    disabled={pending}
                    className="font-mono text-xs"
                    onChange={(event) => update(row.id, { key: event.target.value })}
                  />
                  <Input
                    aria-label={`Value ${index + 1}`}
                    placeholder="value"
                    value={row.value}
                    disabled={pending}
                    onChange={(event) => update(row.id, { value: event.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${row.key.trim() || `row ${index + 1}`}`}
                    disabled={pending}
                    onClick={() => setRows((current) => current.filter((r) => r.id !== row.id))}
                  >
                    <Trash2Icon aria-hidden className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              disabled={pending}
              onClick={() => {
                setRows((current) => [...current, { id: nextId, key: '', value: '' }])
                setNextId(nextId + 1)
              }}
            >
              <PlusIcon aria-hidden />
              Add field
            </Button>
          </div>
        ) : entries.length > 0 ? (
          <dl className="flex flex-col divide-y text-sm">
            {entries.map(([key, value]) => (
              <div
                key={key}
                className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-baseline gap-4 px-6 py-3"
              >
                {/* One line, like every other label in the rail: a long snake_case key
                    truncates (full key on hover) instead of breaking letter by letter. */}
                <dt className="text-muted-foreground min-w-0 truncate font-mono text-xs" title={key}>
                  {key}
                </dt>
                <dd className="group flex min-w-0 items-center justify-end gap-1">
                  <Tooltip>
                    <TooltipTrigger className="min-w-0 truncate text-right">{value}</TooltipTrigger>
                    <TooltipContent side="top" className="max-w-72 break-all">
                      {value}
                    </TooltipContent>
                  </Tooltip>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Copy ${key}`}
                    className="text-muted-foreground size-6 shrink-0 opacity-0 group-hover:opacity-100"
                    onClick={() => {
                      void navigator.clipboard
                        ?.writeText(value)
                        .then(() => toast.success('Copied'))
                        .catch(() => toast.error('Copy failed'))
                    }}
                  >
                    <CopyIcon aria-hidden className="size-3.5" />
                  </Button>
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-muted-foreground p-6 text-[13px]">No metadata yet.</p>
        )}
        {error ? (
          <p role="alert" className="text-destructive px-6 pb-4 text-sm">
            {error}
          </p>
        ) : null}
      </form>
    </Section>
  )
}
