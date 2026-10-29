import { useEffect, useState } from 'react'
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
import { getDefaultClassNames } from 'react-day-picker'
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
  note: 'Day or instant picker over the stock Calendar in a Popover, with today as a primary tint (darker than hover, lighter than the selected day); the time row is the reference DateTimeField (hours, minutes, Local/UTC).',
})

export interface DateInputProps {
  id?: string
  /** `YYYY-MM-DD`, or with `withTime` an ISO instant; empty for none. */
  value: string | undefined
  onValueChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  /** Pick a time of day too, in local time, UTC or `timeZone`. */
  withTime?: boolean
  /**
   * An IANA zone (e.g. the customer's `Asia/Kolkata`) offered beside Local and
   * UTC and chosen by default, so a time is entered in the zone it bills in.
   * Changing it (another customer) moves the picker to it unless the zone
   * was picked by hand.
   */
  timeZone?: string | undefined
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

/**
 * Today on the stock calendar is `bg-muted`, the same as a hovered day, so it
 * reads as "the one under the pointer". Here today is a primary tint with
 * primary text, darker than hover (and it stays tinted when hovered), and the
 * selected day stays solid primary on top, so all three are distinct.
 */
const dayPickerClassNames = {
  today: cn(
    'bg-primary/15 text-primary rounded-(--cell-radius) font-medium data-[selected=true]:rounded-none',
    // Hovering today darkens the tint; a selected today keeps its solid primary.
    '[&_button:not([data-selected-single=true]):hover]:bg-primary/25 [&_button:not([data-selected-single=true]):hover]:text-primary',
    getDefaultClassNames().today,
  ),
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

/**
 * Day fields are stored as UTC days, whatever the browser's zone. A
 * `YYYY-MM-DD` day as the instant it starts: midnight UTC.
 */
export function utcDayStart(day: string): Date | undefined {
  if (!DAY.test(day)) return undefined
  const date = new Date(`${day}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? undefined : date
}

/** The last millisecond of a `YYYY-MM-DD` UTC day, for an inclusive "last day" such as an expiry. */
export function utcDayEnd(day: string): Date | undefined {
  if (!DAY.test(day)) return undefined
  const date = new Date(`${day}T23:59:59.999Z`)
  return Number.isNaN(date.getTime()) ? undefined : date
}

/** The UTC calendar day an instant falls on, as `YYYY-MM-DD`; empty for none. */
export function utcDayOf(date: Date | null | undefined): string {
  if (!date || Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

const DAY_MS = 86_400_000

/** Midnight UTC, or the last millisecond of a UTC day: how day fields are saved. */
function isUtcDayBoundary(date: Date) {
  const into = ((date.getTime() % DAY_MS) + DAY_MS) % DAY_MS
  return into === 0 || into === DAY_MS - 1
}

/**
 * The calendar day a stored day field means, as `YYYY-MM-DD`. Day fields are
 * saved as UTC days (midnight UTC, or the end of the UTC day for a last day)
 * and read back on that UTC day. Any other instant, such as one saved earlier
 * from the browser's local day (local midnight or 23:59:59), reads as the
 * local day it was picked on, so older records keep the day they show today.
 */
export function storedDayOf(date: Date | null | undefined): string {
  if (!date || Number.isNaN(date.getTime())) return ''
  return isUtcDayBoundary(date) ? utcDayOf(date) : toDay(date)
}

/** A stored day field as the reader's locale writes it ("Oct 21, 2026"): the day `storedDayOf` reads. */
export function formatStoredDay(
  date: Date,
  options?: { locale?: string | undefined; dateStyle?: 'short' | 'medium' },
): string {
  return new Intl.DateTimeFormat(options?.locale, {
    dateStyle: options?.dateStyle ?? 'medium',
    ...(isUtcDayBoundary(date) ? { timeZone: 'UTC' } : {}),
  }).format(date)
}

const toDate = (value: string | Date | undefined): Date | undefined =>
  value instanceof Date ? value : parseDateValue(value)

/** Where a time is read and written: the browser's zone, UTC, or an IANA zone. */
export type DateZone = 'local' | 'utc' | (string & {})

/** Whether `zone` is an IANA zone this browser knows (`Asia/Kolkata`); not Local or UTC. */
export function isNamedZone(zone: string | undefined): zone is string {
  if (!zone || zone === 'local' || zone === 'utc' || zone.toUpperCase() === 'UTC') return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone })
    return true
  } catch {
    return false
  }
}

/** The calendar parts of `date` as a clock in `zone` reads them. */
export function zonedParts(date: Date, zone: DateZone) {
  if (zone === 'utc')
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth(),
      day: date.getUTCDate(),
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
    }
  if (!isNamedZone(zone))
    return {
      year: date.getFullYear(),
      month: date.getMonth(),
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
    }
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<string, number>
  return {
    year: parts['year'] ?? 0,
    month: (parts['month'] ?? 1) - 1,
    day: parts['day'] ?? 1,
    hour: (parts['hour'] ?? 0) % 24,
    minute: parts['minute'] ?? 0,
  }
}

/**
 * The instant a clock in `zone` reads as `year-month-day h:m` (month 0-based).
 * For an IANA zone the offset is read at a guess and once more at the result,
 * so a time either side of a daylight-saving change lands on the right hour.
 */
export function zonedInstant(
  zone: DateZone,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  if (zone === 'utc') return new Date(Date.UTC(year, month, day, hour, minute))
  if (!isNamedZone(zone)) return new Date(year, month, day, hour, minute)
  const wall = Date.UTC(year, month, day, hour, minute)
  const offsetAt = (instant: number) => {
    const p = zonedParts(new Date(instant), zone)
    return (
      Date.UTC(p.year, p.month, p.day, p.hour, p.minute) - Math.floor(instant / 60_000) * 60_000
    )
  }
  const first = wall - offsetAt(wall)
  return new Date(wall - offsetAt(first))
}

/**
 * "Oct 21, 2026" or, with a time, "Oct 21, 2026, 09:30 AM" in the zone, with
 * " UTC" in UTC and the zone's name in an IANA zone ("… Asia/Kolkata").
 */
export function formatDateValue(value: string | undefined, zone: DateZone = 'local') {
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
    ...(zone === 'utc' ? { timeZone: 'UTC' } : isNamedZone(zone) ? { timeZone: zone } : {}),
  })
  return zone === 'utc' ? `${text} UTC` : isNamedZone(zone) ? `${text} ${zone}` : text
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
      classNames={dayPickerClassNames}
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
  timeZone,
  className,
  'aria-label': ariaLabel,
  'aria-describedby': describedBy,
  'aria-invalid': invalid,
}: DateInputProps) {
  const named = isNamedZone(timeZone) ? timeZone : undefined
  const [picked, setPicked] = useState<DateZone | null>(null)
  // A zone picked by hand stays; otherwise the given zone (the customer's) leads.
  const zone: DateZone = picked ?? named ?? 'local'
  // Another customer with another zone: drop a hand pick of the old one.
  useEffect(() => {
    setPicked((current) => (current && isNamedZone(current) && current !== named ? null : current))
  }, [named])
  const selected = parseDateValue(value)
  const minDate = toDate(min)
  const maxDate = toDate(max)
  const clock = selected ? zonedParts(selected, zone) : null
  const hours = clock?.hour ?? 0
  const minutes = clock?.minute ?? 0

  /** `day`'s calendar date at `h:m` in the chosen zone. */
  const at = (day: Date, h: number, m: number) =>
    zonedInstant(zone, day.getFullYear(), day.getMonth(), day.getDate(), h, m).toISOString()
  /** The day the calendar shows as selected: the instant's date in the chosen zone. */
  const calendarDay = clock ? new Date(clock.year, clock.month, clock.day) : undefined

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
          classNames={dayPickerClassNames}
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
            <Select value={zone} onValueChange={(next) => next && setPicked(next)}>
              <SelectTrigger
                size="sm"
                className="h-8 w-auto max-w-40 min-w-20 text-xs"
                aria-label="Time zone"
                title={zoneLabel(zone)}
              >
                <SelectValue>
                  <span className="truncate">{zoneLabel(zone)}</span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="end" className="w-auto min-w-(--anchor-width)">
                {named ? <SelectItem value={named}>{named}</SelectItem> : null}
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

const zoneLabel = (zone: DateZone) => (zone === 'utc' ? 'UTC' : zone === 'local' ? 'Local' : zone)

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
