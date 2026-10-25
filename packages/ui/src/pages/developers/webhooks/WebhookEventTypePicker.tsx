import { useMemo, useState } from 'react'
import { SearchIcon } from '@ui/icons'
import { type WebhookEventType, groupWebhookEventTypes } from '@fp/domain'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@ui/components/primitives/input-group'
import { Skeleton } from '@ui/components/primitives/skeleton'
import { CheckboxRow } from '@ui/compositions/forms/CheckboxRow'
import { provenance } from '@ui/provenance'

/**
 * Choose which event types an endpoint receives: Svix's "Subscribe to events"
 * tree.
 *
 * Grouped by name prefix with a checkbox per group, and a search across names.
 * Nothing checked means *every* event type, which is Svix's own default and
 * the note under the list says so: an empty selection is not "nothing".
 */
export const WebhookEventTypePickerProvenance = provenance({
  source: 'composition',
  composes: ['ui/input-group', 'compositions/CheckboxRow'],
  note: 'Grouped, searchable event-type checklist (Svix "Subscribe to events").',
})

export interface WebhookEventTypePickerProps {
  eventTypes: WebhookEventType[]
  selected: string[]
  onChange: (selected: string[]) => void
  isLoading?: boolean
  disabled?: boolean
}

export function WebhookEventTypePicker({
  eventTypes,
  selected,
  onChange,
  isLoading = false,
  disabled = false,
}: WebhookEventTypePickerProps) {
  const [search, setSearch] = useState('')
  const groups = useMemo(() => {
    const term = search.trim().toLowerCase()
    const matching = term
      ? eventTypes.filter((eventType) => eventType.name.toLowerCase().includes(term))
      : eventTypes
    return groupWebhookEventTypes(matching)
  }, [eventTypes, search])

  const chosen = new Set(selected)
  const toggle = (names: string[], on: boolean) => {
    const next = new Set(selected)
    for (const name of names) {
      if (on) next.add(name)
      else next.delete(name)
    }
    onChange([...next].sort())
  }

  return (
    <div className="flex flex-col gap-3">
      <InputGroup>
        <InputGroupAddon>
          <SearchIcon aria-hidden />
        </InputGroupAddon>
        <InputGroupInput
          aria-label="Search event types"
          placeholder="Search event types…"
          value={search}
          disabled={disabled}
          onChange={(event) => setSearch(event.target.value)}
        />
      </InputGroup>
      <div className="max-h-80 overflow-y-auto rounded-lg border">
        {isLoading ? (
          <div className="flex flex-col gap-3 p-4">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-4 w-48" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <p className="text-muted-foreground p-4 text-sm">
            {eventTypes.length === 0
              ? 'No event types are registered for this environment yet.'
              : 'No event types match this search.'}
          </p>
        ) : (
          <ul className="divide-y">
            {groups.map((group) => {
              const names = group.eventTypes.map((eventType) => eventType.name)
              const allOn = names.every((name) => chosen.has(name))
              return (
                <li key={group.name} className="flex flex-col gap-2 p-3">
                  <CheckboxRow
                    checked={allOn}
                    disabled={disabled}
                    onCheckedChange={(on) => toggle(names, on)}
                  >
                    {group.name}
                  </CheckboxRow>
                  <div className="flex flex-col gap-2 pl-6">
                    {group.eventTypes.map((eventType) => (
                      <CheckboxRow
                        key={eventType.name}
                        checked={chosen.has(eventType.name)}
                        disabled={disabled}
                        onCheckedChange={(on) => toggle([eventType.name], on)}
                        className="[&_label]:font-mono [&_label]:text-xs"
                      >
                        {eventType.name}
                      </CheckboxRow>
                    ))}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <p className="text-muted-foreground text-xs">
        {selected.length === 0
          ? 'Nothing selected: this endpoint receives every event type, including ones added later.'
          : `${selected.length} event type${selected.length === 1 ? '' : 's'} selected.`}
      </p>
    </div>
  )
}
