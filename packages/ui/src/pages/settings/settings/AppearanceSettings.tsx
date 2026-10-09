import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { RadioGroup, RadioGroupItem } from '@ui/components/primitives/radio-group'
import { cn } from '@ui/lib/cn'
import { Source, provenance } from '@ui/provenance'

/**
 * The interface-theme choice, as three selectable preview cards.
 *
 * `ThemeChoiceCards` is presentational: a value in, a change out. It draws each
 * card as a miniature of the app in that theme, so the choice is seen rather
 * than read. The miniatures use fixed colours on purpose. They show what the
 * theme looks like, so they must not follow the theme currently applied.
 *
 * `ThemePreferenceCards` is the connected one. It reads and writes the same
 * `next-themes` state that `ThemeProvider` mounts and `ThemeToggle` and the
 * ⌘D shortcut use, so every control agrees by construction. It lives in this
 * package because `next-themes` is a dependency of this package, not of apps.
 */
export const ThemeChoiceCardsProvenance = provenance({
  source: Source.COMPOSITION,
  composes: ['ui/radio-group'],
  note: 'System / Light / Dark as preview cards in a radio group; connected variant reads next-themes.',
})

export type ThemeChoice = 'system' | 'light' | 'dark'

export const THEME_CHOICES: readonly { value: ThemeChoice; label: string; hint: string }[] = [
  { value: 'system', label: 'System', hint: 'Follows your device setting' },
  { value: 'light', label: 'Light', hint: 'Always light' },
  { value: 'dark', label: 'Dark', hint: 'Always dark' },
]

interface Palette {
  surface: string
  rail: string
  card: string
  line: string
  accent: string
}

const LIGHT: Palette = {
  surface: '#fafafa',
  rail: '#f0f0f1',
  card: '#ffffff',
  line: '#e4e4e7',
  accent: '#a1a1aa',
}

const DARK: Palette = {
  surface: '#18181b',
  rail: '#1f1f23',
  card: '#27272a',
  line: '#3f3f46',
  accent: '#71717a',
}

function MiniApp({ palette }: { palette: Palette }) {
  return (
    <div className="flex h-full w-full" style={{ background: palette.surface }}>
      <div
        className="flex w-1/4 flex-col gap-1.5 p-2"
        style={{ background: palette.rail, borderRight: `1px solid ${palette.line}` }}
      >
        <span className="h-1.5 w-3/4 rounded-full" style={{ background: palette.accent }} />
        <span className="h-1.5 w-1/2 rounded-full" style={{ background: palette.line }} />
        <span className="h-1.5 w-2/3 rounded-full" style={{ background: palette.line }} />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-2">
        <span className="h-1.5 w-1/3 rounded-full" style={{ background: palette.accent }} />
        <div
          className="flex flex-1 flex-col gap-1.5 rounded-md p-2"
          style={{ background: palette.card, border: `1px solid ${palette.line}` }}
        >
          <span className="h-1.5 w-full rounded-full" style={{ background: palette.line }} />
          <span className="h-1.5 w-4/5 rounded-full" style={{ background: palette.line }} />
          <span className="h-1.5 w-3/5 rounded-full" style={{ background: palette.line }} />
        </div>
      </div>
    </div>
  )
}

function ThemePreview({ choice }: { choice: ThemeChoice }) {
  if (choice === 'system') {
    return (
      <div className="relative h-full w-full">
        <MiniApp palette={LIGHT} />
        <div
          className="absolute inset-0"
          style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}
        >
          <MiniApp palette={DARK} />
        </div>
      </div>
    )
  }
  return <MiniApp palette={choice === 'dark' ? DARK : LIGHT} />
}

export interface ThemeChoiceCardsProps {
  value: ThemeChoice
  onValueChange: (value: ThemeChoice) => void
  /** Names the group for assistive tech. */
  label?: string
  disabled?: boolean
}

export function ThemeChoiceCards({
  value,
  onValueChange,
  label = 'Interface theme',
  disabled = false,
}: ThemeChoiceCardsProps) {
  return (
    <RadioGroup
      aria-label={label}
      value={value}
      disabled={disabled}
      onValueChange={(next) => onValueChange(next as ThemeChoice)}
      className="grid grid-cols-1 gap-3 sm:grid-cols-3"
    >
      {THEME_CHOICES.map((choice) => {
        const selected = value === choice.value
        return (
          <label
            key={choice.value}
            className={cn(
              'flex cursor-pointer flex-col gap-2.5 rounded-xl border p-2.5 text-left transition-colors',
              selected ? 'border-primary/60 ring-primary/20 ring-2' : 'hover:bg-muted/40',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            <span
              aria-hidden
              className="block aspect-[16/10] w-full overflow-hidden rounded-lg border"
            >
              <ThemePreview choice={choice.value} />
            </span>
            <span className="flex items-start gap-2 px-0.5 pb-0.5">
              <RadioGroupItem value={choice.value} className="mt-0.5" />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-medium">{choice.label}</span>
                <span className="text-muted-foreground text-xs">{choice.hint}</span>
              </span>
            </span>
          </label>
        )
      })}
    </RadioGroup>
  )
}

function isThemeChoice(value: string | undefined): value is ThemeChoice {
  return value === 'system' || value === 'light' || value === 'dark'
}

export function ThemePreferenceCards({ label }: { label?: string }) {
  const { theme, setTheme } = useTheme()
  // The stored theme is unknown until the client has run; until then the
  // group shows the default rather than flipping on hydration.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <ThemeChoiceCards
      value={mounted && isThemeChoice(theme) ? theme : 'system'}
      onValueChange={setTheme}
      {...(label ? { label } : {})}
    />
  )
}
