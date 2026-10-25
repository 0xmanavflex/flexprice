import { useState } from 'react'
import { PlusIcon, Trash2Icon } from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import { Input } from '@ui/components/primitives/input'
import { provenance } from '@ui/provenance'

export const MetadataFieldsProvenance = provenance({
  source: 'composition',
  composes: ['ui/input', 'ui/button'],
  note: "Free-form key/value metadata as a form field: MetadataCard's edit rows (key, value, remove) with Add field, for create forms where there is no record to edit in place yet.",
})

export interface MetadataFieldsProps {
  /** The metadata the field opens with. Read once; the field owns its rows after that. */
  defaultValue?: Readonly<Record<string, string>> | undefined
  /**
   * The map after every edit, with blank rows dropped, and what is wrong with
   * the rows if anything: a value without a key, or a key used twice. While
   * there is a problem the map holds only the rows that are fine, and the form
   * should not submit.
   */
  onChange: (metadata: Record<string, string>, problem: string | null) => void
  disabled?: boolean | undefined
  /** Names the rows for assistive tech: "Plan metadata". */
  label?: string | undefined
}

interface Row {
  id: number
  key: string
  value: string
}

/** The rows as a map, and the first problem with them. */
export function metadataOfRows(rows: readonly { key: string; value: string }[]): {
  metadata: Record<string, string>
  problem: string | null
} {
  const metadata: Record<string, string> = {}
  let problem: string | null = null
  for (const row of rows) {
    const key = row.key.trim()
    if (key === '' && row.value.trim() === '') continue
    if (key === '') {
      problem ??= 'Every value needs a key.'
      continue
    }
    if (key in metadata) {
      problem ??= `The key "${key}" is used twice.`
      continue
    }
    metadata[key] = row.value
  }
  return { metadata, problem }
}

/**
 * Key/value metadata on a create form. Rows start empty (or from
 * `defaultValue`); Add field appends one, the bin removes one. Blank rows are
 * ignored, and a value without a key or a repeated key is said once under the
 * rows, the same rules as `MetadataCard`, so what is created is what is shown.
 */
export function MetadataFields({
  defaultValue,
  onChange,
  disabled = false,
  label = 'Metadata',
}: MetadataFieldsProps) {
  const [rows, setRows] = useState<Row[]>(() =>
    Object.entries(defaultValue ?? {}).map(([key, value], id) => ({ id, key, value })),
  )
  const [nextId, setNextId] = useState(() => Object.keys(defaultValue ?? {}).length)
  const { problem } = metadataOfRows(rows)

  const commit = (next: Row[]) => {
    setRows(next)
    const result = metadataOfRows(next)
    onChange(result.metadata, result.problem)
  }

  return (
    <div role="group" aria-label={label} className="flex flex-col gap-2">
      {rows.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {rows.map((row, index) => (
            <li key={row.id} className="flex items-center gap-2">
              <Input
                aria-label={`Key ${index + 1}`}
                placeholder="key"
                value={row.key}
                disabled={disabled}
                className="font-mono text-xs"
                onChange={(event) =>
                  commit(rows.map((r) => (r.id === row.id ? { ...r, key: event.target.value } : r)))
                }
              />
              <Input
                aria-label={`Value ${index + 1}`}
                placeholder="value"
                value={row.value}
                disabled={disabled}
                onChange={(event) =>
                  commit(
                    rows.map((r) => (r.id === row.id ? { ...r, value: event.target.value } : r)),
                  )
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove ${row.key.trim() || `row ${index + 1}`}`}
                disabled={disabled}
                onClick={() => commit(rows.filter((r) => r.id !== row.id))}
              >
                <Trash2Icon aria-hidden className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 self-start px-3"
        disabled={disabled}
        onClick={() => {
          setRows([...rows, { id: nextId, key: '', value: '' }])
          setNextId(nextId + 1)
        }}
      >
        <PlusIcon aria-hidden />
        Add field
      </Button>
      {problem ? (
        <p role="alert" className="text-destructive text-sm">
          {problem}
        </p>
      ) : null}
    </div>
  )
}
