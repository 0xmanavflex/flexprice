import { useState } from 'react'
import { CalendarIcon, XIcon } from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import { Calendar } from '@ui/components/primitives/calendar'
import { Input } from '@ui/components/primitives/input'
import { Popover, PopoverContent, PopoverTrigger } from '@ui/components/primitives/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/components/primitives/select'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'

/**
 * A date picker: and, with `withTime`, a date and time picker: over the
 * stock `Calendar` in a `Popover`, behind an outline button.
 *
 * Date only, the value is a day: `YYYY-MM-DD` (or empty), as the forms hold it.
 *
 * With `withTime`, the calendar is followed by a Time row (hours : minutes)
 * with Local or UTC beside it, as production's DateTimePicker has it, and the
 * value is an instant: an ISO string (`2026-10-21T04:00:00.000Z`). A plain day
 * already in the form reads as midnight local. The trigger says
 * "Oct 21, 2026, 09:30 AM" in the chosen zone, with "UTC" after it in UTC.
 *
 * Both take `min` and `max` days (outside them is disabled), and `clearable`
 * puts a clear button in the trigger for an optional date.
 */
export const DateInputProvenance = provenance({
  source: 'composition',
  composes: ['ui/popover', 'ui/calendar', 'ui/button', 'ui/input', 'ui/select'],
  note: 'Day or instant picker over the stock Calendar in a Popover; the time row is the reference DateTimeField (hours, minutes, Local/UTC).',
})

export interface DateInputProps {
  id?: string
  /** `YYYY-MM-DD`, or with `withTime` an ISO instant; empty for none. */
  value: string | undefined
  onValueChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  /** Pick a time of day too, in local time or UTC. */
  withTime?: boolean
  /** Earliest pickable day, `YYYY-MM-DD` or a `Date`. */
  min?: string | Date
  /** Latest pickable day, `YYYY-MM-DD` or a `Date`. */
  max?: string | Date
  /** Show a clear button once a date is set (for an optional date). */
  clearable?: boolean
  /** Name of the clear button, e.g. "Clear end date". */
  clearLabel?: string
  className?: string
  'aria-label'?: string
  'aria-describedby'?: string | undefined
  'aria-invalid'?: true | undefined
}

const pad = (n: number) => String(n).padStart(2, '0')
const toDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const DAY = /^\d{4}-\d{2}-\d{2}$/

/** A `YYYY-MM-DD` day as local midnight; an ISO instant as itself. */
export function parseDateValue(value: string | undefined): Date | undefined {
  if (!value) return undefined
  if (DAY.test(value)) {
    const [y, m, d] = value.split('-').map(Number)
    return y && m && d ? new Date(y, m - 1, d) : undefined
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

const toDate = (value: string | Date | undefined): Date | undefined =>
  value instanceof Date ? value : parseDateValue(value)

/** "Oct 21, 2026" or, with a time, "Oct 21, 2026, 09:30 AM" (with " UTC" in UTC). */
export function formatDateValue(value: string | undefined, zone: 'local' | 'utc' = 'local') {
  const date = parseDateValue(value)
  if (!date) return ''
  if (!value || DAY.test(value)) return date.toLocaleDateString('en-US', { dateStyle: 'medium' })
  const text = date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    ...(zone === 'utc' ? { timeZone: 'UTC' } : {}),
  })
  return zone === 'utc' ? `${text} UTC` : text
}

export interface DayCalendarProps {
  /** `YYYY-MM-DD`, or empty for none. */
  value: string | undefined
  /** Called with the picked day as `YYYY-MM-DD`. Picking the selected day again keeps it. */
  onValueChange: (value: string) => void
  /** Earliest pickable day, `YYYY-MM-DD` or a `Date`. */
  min?: string | Date | undefined
  /** Latest pickable day, `YYYY-MM-DD` or a `Date`. */
  max?: string | Date | undefined
}

/**
 * The bare day calendar `DateInput` opens, for a popover that has its own
 * trigger (a toolbar's "From" / "To" range buttons). Same calendar, same days,
 * with month and year menus in the caption for jumping far back.
 */
export function DayCalendar({ value, onValueChange, min, max }: DayCalendarProps) {
  const selected = parseDateValue(value)
  const minDate = toDate(min)
  const maxDate = toDate(max)
  const disabledDays = [
    ...(minDate ? [{ before: minDate }] : []),
    ...(maxDate ? [{ after: maxDate }] : []),
  ]
  const month = selected ?? minDate ?? maxDate
  return (
    <Calendar
      mode="single"
      // Month and year menus: a range can start years back without paging month by month.
      captionLayout="dropdown"
      {...(selected ? { selected } : {})}
      {...(month ? { defaultMonth: month } : {})}
      {...(disabledDays.length > 0 ? { disabled: disabledDays } : {})}
      onSelect={(date) => {
        if (date) onValueChange(toDay(date))
      }}
    />
  )
}

export function DateInput({
  id,
  value,
  onValueChange,
  placeholder = 'Pick a date',
  disabled,
  withTime = false,
  min,
  max,
  clearable = false,
  clearLabel = 'Clear date',
  className,
  'aria-label': ariaLabel,
  'aria-describedby': describedBy,
  'aria-invalid': invalid,
}: DateInputProps) {
  const [zone, setZone] = useState<'local' | 'utc'>('local')
  const utc = zone === 'utc'
  const selected = parseDateValue(value)
  const minDate = toDate(min)
  const maxDate = toDate(max)
  const hours = selected ? (utc ? selected.getUTCHours() : selected.getHours()) : 0
  const minutes = selected ? (utc ? selected.getUTCMinutes() : selected.getMinutes()) : 0

  /** `day`'s calendar date at `h:m` in the chosen zone. */
  const at = (day: Date, h: number, m: number) => {
    const next = utc
      ? new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), h, m))
      : new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m)
    return next.toISOString()
  }
  /** The day the calendar shows as selected: in UTC, the instant's UTC date. */
  const calendarDay = selected
    ? utc
      ? new Date(selected.getUTCFullYear(), selected.getUTCMonth(), selected.getUTCDate())
      : selected
    : undefined

  const pick = (date: Date | undefined) => {
    if (!date) return onValueChange('')
    onValueChange(withTime ? at(date, hours, minutes) : toDay(date))
  }
  const setTime = (h: number, m: number) => {
    if (calendarDay) onValueChange(at(calendarDay, h, m))
  }

  const month = calendarDay ?? minDate
  const label = selected ? formatDateValue(value, withTime ? zone : 'local') : ''
  const disabledDays = [
    ...(minDate ? [{ before: minDate }] : []),
    ...(maxDate ? [{ after: maxDate }] : []),
  ]

  return (
    <Popover>
      <div className={cn('relative w-full', className)}>
        <PopoverTrigger
          render={
            <Button
              {...(id ? { id } : {})}
              type="button"
              variant="outline"
              className={cn('w-full justify-start font-normal', clearable && selected && 'pr-8')}
              aria-label={ariaLabel}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              {...(disabled !== undefined ? { disabled } : {})}
            />
          }
        >
          <CalendarIcon className="text-muted-foreground" />
          {selected ? (
            <span className="truncate">{label}</span>
          ) : (
            <span className="text-muted-foreground truncate">{placeholder}</span>
          )}
        </PopoverTrigger>
        {clearable && selected && !disabled ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={clearLabel}
            className="text-muted-foreground absolute top-1/2 right-1.5 -translate-y-1/2"
            onClick={() => onValueChange('')}
          >
            <XIcon aria-hidden />
          </Button>
        ) : null}
      </div>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          {...(calendarDay ? { selected: calendarDay } : {})}
          {...(month ? { defaultMonth: month } : {})}
          {...(disabledDays.length > 0 ? { disabled: disabledDays } : {})}
          onSelect={pick}
        />
        {withTime ? (
          <div className="flex items-center gap-2 border-t px-3 py-3">
            <span className="text-muted-foreground w-10 text-xs font-medium">Time</span>
            <div className="flex flex-1 items-center gap-1">
              <TimePart
                label="Hours"
                placeholder="HH"
                max={23}
                value={selected ? hours : undefined}
                disabled={!selected}
                onCommit={(h) => setTime(h, minutes)}
              />
              <span aria-hidden className="text-muted-foreground font-medium">
                :
              </span>
              <TimePart
                label="Minutes"
                placeholder="MM"
                max={59}
                value={selected ? minutes : undefined}
                disabled={!selected}
                onCommit={(m) => setTime(hours, m)}
              />
            </div>
            <Select
              value={zone}
              onValueChange={(next) => setZone(next === 'utc' ? 'utc' : 'local')}
            >
              <SelectTrigger size="sm" className="h-8 w-20 text-xs" aria-label="Time zone">
                <SelectValue>{utc ? 'UTC' : 'Local'}</SelectValue>
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="local">Local</SelectItem>
                <SelectItem value="utc">UTC</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

/** One half of the time row: typed freely, clamped and applied on blur or Enter. */
function TimePart({
  label,
  placeholder,
  max,
  value,
  disabled,
  onCommit,
}: {
  label: string
  placeholder: string
  max: number
  value: number | undefined
  disabled: boolean
  onCommit: (n: number) => void
}) {
  const shown = value === undefined ? '' : pad(value)
  const [text, setText] = useState<string | null>(null)
  const commit = () => {
    if (text !== null) onCommit(Math.min(max, Number(text) || 0))
    setText(null)
  }
  return (
    <Input
      className="h-8 w-10 px-0 text-center tabular-nums"
      inputMode="numeric"
      maxLength={2}
      aria-label={label}
      placeholder={placeholder}
      disabled={disabled}
      value={text ?? shown}
      onFocus={(event) => event.target.select()}
      onChange={(event) => setText(event.target.value.replace(/\D/g, ''))}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          commit()
        }
      }}
    />
  )
}
