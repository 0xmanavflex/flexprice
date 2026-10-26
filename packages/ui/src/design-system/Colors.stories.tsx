import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'

/**
 * The palette, rendered from the tokens themselves.
 *
 * Every swatch fills with `var(--token)`, so this page is not a picture of the
 * palette — it *is* the palette, and it re-tints the moment a token changes or
 * the theme flips. Values are shown for both modes so the shift is legible even
 * when the workbench is only in one of them.
 *
 * Swatches carry no text on the fill. This is the system's own rule made
 * visible: colour rides on glyphs and borders, not on filled text, precisely
 * because a 500-level semantic fill rarely clears 4.5:1 — white on `--success`
 * measures 2.47:1. Labels sit below, on a neutral surface, where they pass.
 */

interface Token {
  /** The CSS custom property, e.g. `--brand`. */
  name: string
  /** Resolved value in light mode. */
  light: string
  /** Resolved value in dark mode. */
  dark: string
  /** One line on what the token is for. */
  note?: string
}

interface Group {
  title: string
  description: string
  tokens: Token[]
}

const GROUPS: Group[] = [
  {
    title: 'Brand',
    description:
      'One deep teal. Swap these three lines to rebrand — nothing else in the system names a colour.',
    tokens: [
      {
        name: '--brand',
        light: '#07383e',
        dark: '#81cec4',
        note: 'The accent. Lighter on dark so it holds without glowing.',
      },
      {
        name: '--brand-foreground',
        light: '#ffffff',
        dark: '#07383e',
        note: 'Text/icon on brand.',
      },
      {
        name: '--brand-muted',
        light: '#eaf5f1',
        dark: '#173b3b',
        note: 'A faint brand wash for tinted surfaces.',
      },
    ],
  },
  {
    title: 'Primary',
    description:
      'Primary is the brand, not near-black — the primary action, links and focus all read as one accent.',
    tokens: [
      {
        name: '--primary',
        light: 'var(--brand)',
        dark: 'var(--brand)',
        note: 'Aliased to --brand.',
      },
      {
        name: '--primary-foreground',
        light: 'var(--brand-foreground)',
        dark: 'var(--brand-foreground)',
      },
      {
        name: '--ring',
        light: 'var(--brand)',
        dark: 'var(--brand)',
        note: 'Focus ring, in the brand.',
      },
    ],
  },
  {
    title: 'Semantic',
    description:
      'Meaning, not decoration. Carried by icons rather than fills — five tinted rows in a dense table is a traffic light, which is the same as no signal at all.',
    tokens: [
      { name: '--success', light: 'emerald-500', dark: 'emerald-500' },
      { name: '--success-foreground', light: 'emerald-900', dark: 'emerald-600' },
      { name: '--info', light: 'blue-500', dark: 'blue-500' },
      { name: '--info-foreground', light: 'blue-900', dark: 'blue-400' },
      {
        name: '--trial',
        light: 'violet-500',
        dark: 'violet-500',
        note: 'Trialing only.',
      },
      { name: '--trial-foreground', light: 'violet-900', dark: 'violet-400' },
      { name: '--warning', light: 'yellow-500', dark: 'yellow-500' },
      { name: '--warning-foreground', light: 'yellow-900', dark: 'yellow-600' },
      {
        name: '--destructive',
        light: 'oklch(0.577 0.245 27.325)',
        dark: 'oklch(0.704 0.191 22.216)',
      },
      { name: '--destructive-foreground', light: 'red-800', dark: 'red-600' },
      {
        name: '--invert',
        light: 'zinc-900',
        dark: 'zinc-700',
        note: 'A high-contrast slab for solid emphasis.',
      },
      { name: '--invert-foreground', light: 'zinc-50', dark: 'zinc-50' },
    ],
  },
  {
    title: 'Neutrals & surfaces',
    description:
      'The field the accent stands on. Kept greyscale so the one colour in the room means something.',
    tokens: [
      { name: '--background', light: 'oklch(1 0 0)', dark: 'oklch(0.145 0 0)' },
      { name: '--foreground', light: 'oklch(0.145 0 0)', dark: 'oklch(0.985 0 0)' },
      { name: '--card', light: 'oklch(1 0 0)', dark: 'oklch(0.205 0 0)' },
      { name: '--card-foreground', light: 'oklch(0.145 0 0)', dark: 'oklch(0.985 0 0)' },
      { name: '--popover', light: 'oklch(1 0 0)', dark: 'oklch(0.205 0 0)' },
      { name: '--secondary', light: 'oklch(0.97 0 0)', dark: 'oklch(0.269 0 0)' },
      { name: '--muted', light: 'oklch(0.97 0 0)', dark: 'oklch(0.269 0 0)' },
      {
        name: '--muted-foreground',
        light: 'oklch(0.520 0 0)',
        dark: 'oklch(0.708 0 0)',
        note: 'Darkened from nova so muted-on-muted clears AA (#686868).',
      },
      { name: '--accent', light: 'oklch(0.97 0 0)', dark: 'oklch(0.269 0 0)' },
      { name: '--border', light: 'oklch(0.922 0 0)', dark: 'oklch(1 0 0 / 10%)' },
      { name: '--input', light: 'oklch(0.922 0 0)', dark: 'oklch(1 0 0 / 15%)' },
    ],
  },
  {
    title: 'Sidebar',
    description:
      'A shade darker than the page, with a faint brand wash on the active row — so the current page is found by colour before it is read.',
    tokens: [
      { name: '--sidebar', light: '#fafafa', dark: 'oklch(0.185 0.003 75)' },
      { name: '--sidebar-foreground', light: 'oklch(0.145 0 0)', dark: 'oklch(0.985 0 0)' },
      { name: '--sidebar-primary', light: 'var(--brand)', dark: 'var(--brand)' },
      {
        name: '--sidebar-accent',
        light: '#e6f3f2',
        dark: 'oklch(0.34 0.03 190)',
        note: 'The active row — a brand wash, not a flat grey.',
      },
      { name: '--sidebar-border', light: 'oklch(0.922 0 0)', dark: 'oklch(1 0 0 / 10%)' },
      { name: '--sidebar-ring', light: 'var(--brand)', dark: 'var(--brand)' },
    ],
  },
]

function Swatch({ token, mode }: { token: Token; mode: 'light' | 'dark' }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div
        aria-hidden
        className="border-border h-14 w-full rounded-lg border"
        style={{ background: `var(${token.name})` }}
      />
      <div className="flex flex-col gap-0.5">
        <code className="text-foreground text-xs font-medium">{token.name}</code>
        <code className="text-muted-foreground text-xs">
          {mode === 'light' ? token.light : token.dark}
        </code>
        {token.note ? (
          <span className="text-muted-foreground mt-0.5 text-xs leading-snug">{token.note}</span>
        ) : null}
      </div>
    </div>
  )
}

function Palette({ mode, withHeadings }: { mode: 'light' | 'dark'; withHeadings: boolean }) {
  return (
    <div className="flex flex-col gap-10">
      {GROUPS.map((group) => (
        <section key={group.title} className="flex flex-col gap-3">
          {withHeadings ? (
            <h2 className="text-foreground text-lg font-semibold">{group.title}</h2>
          ) : (
            <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              {group.title}
            </span>
          )}
          <p className="text-muted-foreground max-w-3xl text-sm">{group.description}</p>
          <div className="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {group.tokens.map((token) => (
              <Swatch key={token.name} token={token} mode={mode} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function ColorSystem() {
  return (
    <div className="bg-background text-foreground min-h-screen p-8">
      <header className="mb-10 flex max-w-3xl flex-col gap-2">
        <h1 className="text-2xl font-semibold">Colour</h1>
        <p className="text-muted-foreground text-sm">
          One accent on a neutral field. Every value is a token; the swatches fill with{' '}
          <code className="text-foreground">var(--token)</code>, so this page tracks the theme
          rather than describing it. Fills carry no text on purpose — colour rides on glyphs and
          borders here, because a 500-level fill rarely clears the 4.5:1 contrast bar.
        </p>
      </header>

      <Palette mode="light" withHeadings />

      <section className="mt-14 flex flex-col gap-4">
        <div className="flex max-w-3xl flex-col gap-1">
          <h2 className="text-lg font-semibold">The same tokens, in dark mode</h2>
          <p className="text-muted-foreground text-sm">
            Dark mode is first-class, not an inversion. The accent lightens and desaturates so it
            holds against a dark surface, and every neutral re-scopes under{' '}
            <code className="text-foreground">.dark</code>.
          </p>
        </div>
        <div className="dark border-border bg-background text-foreground rounded-2xl border p-6">
          <Palette mode="dark" withHeadings={false} />
        </div>
      </section>
    </div>
  )
}

const meta = {
  title: 'Design system/Colors',
  component: ColorSystem,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ColorSystem>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { level: 1, name: 'Colour' })).toBeInTheDocument()
    // The three lines that carry the whole brand are present and labelled.
    await expect(canvas.getAllByText('--brand').length).toBeGreaterThan(0)
    await expect(
      canvas.getByRole('heading', { name: 'The same tokens, in dark mode' }),
    ).toBeInTheDocument()
  },
}
