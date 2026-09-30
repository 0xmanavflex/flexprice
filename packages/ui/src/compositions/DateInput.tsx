import { CalendarIcon } from 'lucide-react'
import { Button } from '@ui/primitives/button'
import { Calendar } from '@ui/primitives/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@ui/primitives/popover'
import { provenance } from '@ui/provenance'

/**
 * A date picker: stock `Popover` + `Calendar` behind an outline button.
 * Value is an ISO `YYYY-MM-DD` string (or empty), matching what the forms hold.
 * Replaces native `type="date"` inputs.
 */
export const DateInputProvenance = provenance({
  source: 'composition',
  composes: ['ui/popover', 'ui/calendar', 'ui/button'],
  note: 'ISO-date-string picker over the stock Calendar in a Popover.',
})

export interface DateInputProps {
  id?: string
  value: string | undefined
  onValueChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  'aria-describedby'?: string | undefined
  'aria-invalid'?: true | undefined
}

const pad = (n: number) => String(n).padStart(2, '0')
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const fromIso = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return y && m && d ? new Date(y, m - 1, d) : undefined
}

export function DateInput({
  id,
  value,
  onValueChange,
  placeholder = 'Pick a date',
  disabled,
  'aria-describedby': describedBy,
  'aria-invalid': invalid,
}: DateInputProps) {
  const selected = value ? fromIso(value) : undefined
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            {...(id ? { id } : {})}
            type="button"
            variant="outline"
            className="w-full justify-start font-normal"
            aria-describedby={describedBy}
            aria-invalid={invalid}
            {...(disabled !== undefined ? { disabled } : {})}
          />
        }
      >
        <CalendarIcon />
        {selected ? (
          selected.toLocaleDateString(undefined, { dateStyle: 'medium' })
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          {...(selected ? { selected, defaultMonth: selected } : {})}
          onSelect={(date: Date | undefined) => onValueChange(date ? toIso(date) : '')}
        />
      </PopoverContent>
    </Popover>
  )
}
