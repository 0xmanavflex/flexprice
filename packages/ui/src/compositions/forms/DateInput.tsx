import { useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import {
  eachMonthOfInterval,
  eachYearOfInterval,
  endOfYear,
  format,
  isAfter,
  isBefore,
  startOfYear,
} from 'date-fns'
import type { CaptionLabelProps, MonthGridProps } from 'react-day-picker'
import { CalendarIcon, ChevronDownIcon, XIcon } from '@ui/icons'
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
 * The time row and the timezone (local by default, or the customer's zone)
 * are always shown. With `withTime` the value is an ISO instant
 * (`2026-10-21T04:00:00.000Z`); otherwise the pick still stores `YYYY-MM-DD`.
 * The caption opens a year grid, then the months of that year (ReUI c-calendar-26).
 *
 * Both take `min` and `max` days (outside them is disabled), and `clearable`
 * puts a clear button in the trigger for an optional date.
 */
export const DateInputProvenance = provenance({
  source: 'composition',
  composes: ['ui/popover', 'ui/calendar', 'ui/button', 'ui/input', 'ui/select'],
  note: 'Day or instant picker over the stock Calendar in a Popover. The caption is the ReUI c-calendar-26 year-then-month picker. Time and timezone are always shown; timezone defaults to local, or the customer zone when one is passed.',
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
 *
 * A wall time the clock shows twice (the hour repeated when daylight saving
 * ends) resolves to its first occurrence, unless `near` is given: then the
 * occurrence with `near`'s UTC offset wins when there is one. Editing the
 * minutes of the second 01:30 in New York keeps it the second, rather than
 * jumping back an hour.
 */
export function zonedInstant(
  zone: DateZone,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  near?: Date,
): Date {
  if (zone === 'utc') return new Date(Date.UTC(year, month, day, hour, minute))
  const wall = Date.UTC(year, month, day, hour, minute)
  /** How far the clock in `zone` runs ahead of UTC at `instant`, in ms. */
  const offsetAt = (instant: number) => {
    const p = zonedParts(new Date(instant), zone)
    return (
      Date.UTC(p.year, p.month, p.day, p.hour, p.minute) - Math.floor(instant / 60_000) * 60_000
    )
  }
  if (near && !Number.isNaN(near.getTime())) {
    const same = wall - offsetAt(near.getTime())
    // Only when the clock really reads the wall time at that offset.
    if (offsetAt(same) === wall - same) return new Date(same)
  }
  if (!isNamedZone(zone)) return new Date(year, month, day, hour, minute)
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
  const [zone, setZone] = useState<DateZone>('local')
  const [hours, setHours] = useState(0)
  const [minutes, setMinutes] = useState(0)
  return (
    <div>
      <YearMonthCalendar
        {...(selected ? { selected } : {})}
        {...(month ? { defaultMonth: month } : {})}
        {...(disabledDays.length > 0 ? { disabled: disabledDays } : {})}
        onSelect={(date) => {
          if (date) onValueChange(toDay(date))
        }}
      />
      <TimeZoneRow
        zone={zone}
        hours={hours}
        minutes={minutes}
        timeDisabled={!selected}
        onZone={setZone}
        onTime={(h, m) => {
          setHours(h)
          setMinutes(m)
        }}
      />
    </div>
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

  /**
   * `day`'s calendar date at `h:m` in the chosen zone. With `near`, a repeated
   * wall time keeps `near`'s offset (see `zonedInstant`).
   */
  const at = (day: Date, h: number, m: number, near?: Date) =>
    zonedInstant(zone, day.getFullYear(), day.getMonth(), day.getDate(), h, m, near).toISOString()
  /** The day the calendar shows as selected: the instant's date in the chosen zone. */
  const calendarDay = clock ? new Date(clock.year, clock.month, clock.day) : undefined

  const pick = (date: Date | undefined) => {
    if (!date) return onValueChange('')
    onValueChange(withTime ? at(date, hours, minutes) : toDay(date))
  }
  // A date-only field stores a day, never an instant: its time does nothing.
  // Editing the time of a chosen instant keeps its occurrence of a repeated hour.
  const setTime = (h: number, m: number) => {
    if (calendarDay && withTime) onValueChange(at(calendarDay, h, m, selected))
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
        <YearMonthCalendar
          {...(calendarDay ? { selected: calendarDay } : {})}
          {...(month ? { defaultMonth: month } : {})}
          {...(disabledDays.length > 0 ? { disabled: disabledDays } : {})}
          {...(minDate ? { min: minDate } : {})}
          {...(maxDate ? { max: maxDate } : {})}
          onSelect={pick}
        />
        <TimeZoneRow
          zone={zone}
          named={named}
          hours={selected && withTime ? hours : undefined}
          minutes={selected && withTime ? minutes : undefined}
          timeDisabled={!selected || !withTime}
          onZone={(next) => setPicked(next)}
          onTime={setTime}
        />
      </PopoverContent>
    </Popover>
  )
}

const zoneLabel = (zone: DateZone) => (zone === 'utc' ? 'UTC' : zone === 'local' ? 'Local' : zone)

/** Time and timezone, always present. Timezone defaults to local unless a customer zone is passed. */
function TimeZoneRow({
  zone,
  named,
  hours,
  minutes,
  timeDisabled,
  onZone,
  onTime,
}: {
  zone: DateZone
  named?: string | undefined
  hours: number | undefined
  minutes: number | undefined
  timeDisabled: boolean
  onZone: (zone: DateZone) => void
  onTime: (hours: number, minutes: number) => void
}) {
  const h = hours ?? 0
  const m = minutes ?? 0
  return (
    <div className="flex items-center gap-2 border-t px-3 py-3">
      <span className="text-muted-foreground w-10 text-xs font-medium">Time</span>
      <div className="flex flex-1 items-center gap-1">
        <TimePart
          label="Hours"
          placeholder="HH"
          max={23}
          value={hours}
          disabled={timeDisabled}
          onCommit={(next) => onTime(next, m)}
        />
        <span aria-hidden className="text-muted-foreground font-medium">
          :
        </span>
        <TimePart
          label="Minutes"
          placeholder="MM"
          max={59}
          value={minutes}
          disabled={timeDisabled}
          onCommit={(next) => onTime(h, next)}
        />
      </div>
      <Select value={zone} onValueChange={(next) => next && onZone(next)}>
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
  )
}

/**
 * Single-day calendar with the ReUI c-calendar-26 caption: the month label
 * opens a year grid, then the twelve months of the chosen year.
 */
function YearMonthCalendar({
  selected,
  defaultMonth,
  disabled,
  min,
  max,
  onSelect,
}: {
  selected?: Date
  defaultMonth?: Date
  disabled?: { before: Date }[] | { after: Date }[] | ({ before: Date } | { after: Date })[]
  /** The field's own bounds; navigation never stops short of them. */
  min?: Date
  max?: Date
  onSelect: (date: Date | undefined) => void
}) {
  const today = new Date()
  const [month, setMonth] = useState(defaultMonth ?? today)
  const [isYearView, setIsYearView] = useState(false)
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  // The field's bounds when it has them, else fifty years either way; a stored
  // date outside that is still reachable.
  const startDate = startOfYear(
    min ?? new Date(Math.min(today.getFullYear() - 50, selected?.getFullYear() ?? Infinity), 0),
  )
  const endDate = endOfYear(
    max ?? new Date(Math.max(today.getFullYear() + 50, selected?.getFullYear() ?? -Infinity), 11),
  )
  const years = eachYearOfInterval({ start: startDate, end: endDate })
  return (
    <Calendar
      mode="single"
      classNames={{
        ...dayPickerClassNames,
        month_caption: 'justify-start',
        nav: 'flex items-center w-full absolute inset-x-0 justify-end pointer-events-none [&>button]:pointer-events-auto',
      }}
      components={{
        CaptionLabel: (props: CaptionLabelProps) => (
          <CaptionLabel
            isYearView={isYearView}
            setIsYearView={(val) => {
              setIsYearView(val)
              if (!val) setSelectedYear(null)
            }}
            {...props}
          />
        ),
        MonthGrid: (props: MonthGridProps) => (
          <MonthGrid
            className={props.className}
            currentMonth={month.getMonth()}
            currentYear={month.getFullYear()}
            endDate={endDate}
            isYearView={isYearView}
            onMonthSelect={(selectedMonth: Date) => {
              setMonth(selectedMonth)
              setIsYearView(false)
              setSelectedYear(null)
            }}
            setIsYearView={setIsYearView}
            startDate={startDate}
            years={years}
            selectedYear={selectedYear}
            setSelectedYear={setSelectedYear}
          >
            {props.children}
          </MonthGrid>
        ),
      }}
      {...(selected ? { selected } : {})}
      month={month}
      onMonthChange={setMonth}
      onSelect={onSelect}
      startMonth={startDate}
      endMonth={endDate}
      {...(disabled && disabled.length > 0 ? { disabled } : {})}
    />
  )
}

function MonthGrid({
  className,
  children,
  isYearView,
  years,
  currentYear,
  currentMonth,
  onMonthSelect,
  selectedYear,
  setSelectedYear,
  startDate,
  endDate,
}: {
  className?: string | undefined
  children: ReactNode
  isYearView: boolean
  setIsYearView: Dispatch<SetStateAction<boolean>>
  startDate: Date
  endDate: Date
  years: Date[]
  currentYear: number
  currentMonth: number
  onMonthSelect: (date: Date) => void
  selectedYear: number | null
  setSelectedYear: Dispatch<SetStateAction<number | null>>
}) {
  return (
    <div className="relative">
      <table className={className}>{children}</table>
      {isYearView ? (
        <div className="bg-background absolute inset-0 z-20 -m-2 overflow-y-auto">
          <div className="px-3 pt-1 pb-3">
            {selectedYear === null ? (
              <div className="grid grid-cols-4 gap-2">
                {years.map((year) => {
                  const y = year.getFullYear()
                  const isCurrent = y === currentYear
                  return (
                    <Button
                      key={y}
                      type="button"
                      variant={isCurrent ? 'default' : 'outline'}
                      size="sm"
                      className="h-8"
                      onClick={() => setSelectedYear(y)}
                    >
                      {y}
                    </Button>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-fit px-2"
                  onClick={() => setSelectedYear(null)}
                >
                  <ChevronDownIcon className="mr-1 size-4 rotate-90" />
                  {selectedYear}
                </Button>
                <div className="grid grid-cols-3 gap-2">
                  {eachMonthOfInterval({
                    start: startOfYear(new Date(selectedYear, 0)),
                    end: endOfYear(new Date(selectedYear, 0)),
                  }).map((monthDate) => {
                    const isCurrent =
                      monthDate.getMonth() === currentMonth && selectedYear === currentYear
                    const isDisabled =
                      isBefore(monthDate, startOfYear(startDate)) ||
                      isAfter(monthDate, endOfYear(endDate))
                    return (
                      <Button
                        key={monthDate.getTime()}
                        type="button"
                        variant={isCurrent ? 'default' : 'outline'}
                        size="sm"
                        className="h-8"
                        disabled={isDisabled}
                        onClick={() => onMonthSelect(monthDate)}
                      >
                        {format(monthDate, 'MMM')}
                      </Button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function CaptionLabel({
  children,
  isYearView,
  setIsYearView,
}: {
  children?: ReactNode
  isYearView: boolean
  setIsYearView: Dispatch<SetStateAction<boolean>>
} & CaptionLabelProps) {
  return (
    <Button
      type="button"
      className="-ms-2 flex items-center gap-2 text-sm hover:bg-transparent"
      aria-expanded={isYearView}
      onClick={() => setIsYearView((prev) => !prev)}
      size="sm"
      variant="ghost"
    >
      {children}
      <ChevronDownIcon aria-hidden className="text-muted-foreground size-4 shrink-0" />
    </Button>
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
