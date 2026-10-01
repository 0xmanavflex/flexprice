import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'

/**
 * The type system.
 *
 * One family — Inter Variable — carries the whole console. `--font-heading` is
 * aliased to `--font-sans`, so there is no second display face: hierarchy comes
 * from weight and size, not from a change of typeface. The density is compact
 * (ported from Ferry): UI text sits at the small end of the scale, and every
 * figure is set in `tabular-nums` so columns of numbers line up.
 */

const SCALE: { class: string; token: string; px: string; use: string }[] = [
  {
    class: 'text-xs',
    token: '0.75rem',
    px: '12px',
    use: 'Badges, table meta, keyboard hints — the console default.',
  },
  { class: 'text-sm', token: '0.875rem', px: '14px', use: 'Body and form text.' },
  { class: 'text-base', token: '1rem', px: '16px', use: 'Rarely — dense UI lives below this.' },
  { class: 'text-lg', token: '1.125rem', px: '18px', use: 'Rarely — page titles sit at xl.' },
  { class: 'text-xl', token: '1.25rem', px: '20px', use: 'Page titles and metric values, at medium weight.' },
  { class: 'text-2xl', token: '1.5rem', px: '24px', use: 'Chart figures, at medium weight.' },
  { class: 'text-3xl', token: '1.875rem', px: '30px', use: 'Hero figures.' },
  { class: 'text-4xl', token: '2.25rem', px: '36px', use: 'Marketing / auth surfaces.' },
]

const WEIGHTS: { class: string; weight: string; use: string }[] = [
  { class: 'font-normal', weight: '400', use: 'Body, table cells.' },
  { class: 'font-medium', weight: '500', use: 'Page titles, section titles, metric values, table headers.' },
  { class: 'font-semibold', weight: '600', use: 'Not used on product pages.' },
  { class: 'font-bold', weight: '700', use: 'Reserved for emphasis.' },
]

function TypeRow({ item }: { item: (typeof SCALE)[number] }) {
  return (
    <div className="border-border flex flex-col gap-1 border-b py-4 sm:flex-row sm:items-baseline sm:gap-6">
      <div className="flex w-40 shrink-0 flex-col">
        <code className="text-foreground text-xs font-medium">{item.class}</code>
        <code className="text-muted-foreground text-xs">
          {item.token} · {item.px}
        </code>
      </div>
      <span className={`${item.class} text-foreground leading-tight font-medium`}>
        Invoices, plans & usage
      </span>
      <span className="text-muted-foreground text-xs sm:ml-auto sm:max-w-xs sm:text-right">
        {item.use}
      </span>
    </div>
  )
}

function TypeSystem() {
  return (
    <div className="bg-background text-foreground mx-auto flex min-h-screen max-w-5xl flex-col gap-12 p-8">
      <header className="flex max-w-3xl flex-col gap-2">
        <h1 className="text-2xl font-semibold">Typography</h1>
        <p className="text-muted-foreground text-sm">
          <span className="text-foreground font-medium">Geist Variable</span>, one family for
          everything. <code className="text-foreground">--font-heading</code> is aliased to{' '}
          <code className="text-foreground">--font-sans</code> — hierarchy is weight and size, not a
          second typeface. The density is compact, so UI text lives at the small end of the scale.
        </p>
      </header>

      <section className="flex flex-col gap-1">
        <h2 className="mb-2 text-lg font-semibold">Type scale</h2>
        {SCALE.map((item) => (
          <TypeRow key={item.class} item={item} />
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Weights</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {WEIGHTS.map((w) => (
            <div
              key={w.class}
              className="border-border bg-card flex flex-col gap-1 rounded-xl border p-4"
            >
              <span className={`${w.class} text-card-foreground text-xl`}>Aa</span>
              <code className="text-foreground text-xs font-medium">{w.class}</code>
              <code className="text-muted-foreground text-xs">{w.weight}</code>
              <span className="text-muted-foreground text-xs">{w.use}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Tabular numerals</h2>
        <p className="text-muted-foreground max-w-3xl text-sm">
          Every figure in the console — <code className="text-foreground">Money</code>,{' '}
          <code className="text-foreground">Metric</code>, stat cards — is set in{' '}
          <code className="text-foreground">tabular-nums</code>, so digits share a width and columns
          of numbers align on the decimal. The difference shows the moment amounts stack.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="border-border bg-card flex flex-col gap-2 rounded-xl border p-4">
            <span className="text-muted-foreground text-xs font-medium">Proportional (drifts)</span>
            <div className="text-card-foreground flex flex-col text-right font-medium">
              <span>1,284,093.00</span>
              <span>48,250.10</span>
              <span>312.99</span>
            </div>
          </div>
          <div className="border-border bg-card flex flex-col gap-2 rounded-xl border p-4">
            <span className="text-muted-foreground text-xs font-medium">tabular-nums (aligns)</span>
            <div className="text-card-foreground flex flex-col text-right font-medium tabular-nums">
              <span>1,284,093.00</span>
              <span>48,250.10</span>
              <span>312.99</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

const meta = {
  title: 'Design System/Typography',
  component: TypeSystem,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof TypeSystem>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { level: 1, name: 'Typography' })).toBeInTheDocument()
    await expect(canvas.getByRole('heading', { name: 'Type scale' })).toBeInTheDocument()
    await expect(canvas.getByRole('heading', { name: 'Tabular numerals' })).toBeInTheDocument()
  },
}
