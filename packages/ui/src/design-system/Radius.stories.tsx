import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'

/**
 * Radius and elevation.
 *
 * One anchor — `--radius: 0.625rem` — and the rest of the scale derives from it
 * by multiplier, so the whole system re-proportions from a single line. Buttons,
 * badges and kbd are fully pill-shaped by a theme rule rather than a
 * `rounded-full` repeated across forty call sites; icon buttons inside a menu or
 * a table row opt back to `--radius-md`, because a circle in a dense row reads
 * as a status dot, not a control.
 *
 * Depth is deliberately restrained: one soft, low shadow lifts the surfaces that
 * float above the page — sheet, popover, menu, card — so they read as slightly
 * in front, not thrown onto the page.
 */

const RADII: { class: string; token: string; value: string }[] = [
  { class: 'rounded-sm', token: '--radius-sm', value: '0.375rem (× 0.6)' },
  { class: 'rounded-md', token: '--radius-md', value: '0.5rem (× 0.8)' },
  { class: 'rounded-lg', token: '--radius-lg', value: '0.625rem (anchor)' },
  { class: 'rounded-xl', token: '--radius-xl', value: '0.875rem (× 1.4)' },
  { class: 'rounded-2xl', token: '--radius-2xl', value: '1.125rem (× 1.8)' },
  { class: 'rounded-3xl', token: '--radius-3xl', value: '1.375rem (× 2.2)' },
  { class: 'rounded-4xl', token: '--radius-4xl', value: '1.625rem (× 2.6)' },
  { class: 'rounded-full', token: 'pill', value: 'buttons · badges · kbd' },
]

/** The soft depth shadow, in the exact light-mode values from the theme. */
const CARD_SHADOW = '0 1px 2px -1px oklch(0 0 0 / 0.08), 0 8px 24px -12px oklch(0 0 0 / 0.14)'

function RadiusAndElevation() {
  return (
    <div className="bg-background text-foreground mx-auto flex min-h-screen max-w-5xl flex-col gap-12 p-8">
      <header className="flex max-w-3xl flex-col gap-2">
        <h1 className="text-2xl font-semibold">Radius &amp; elevation</h1>
        <p className="text-muted-foreground text-sm">
          A single anchor sets the curvature of the whole system; depth is one restrained shadow.
          Both are theme decisions, so they live in the theme rather than being spelled onto every
          component.
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Radius scale</h2>
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
          {RADII.map((r) => (
            <div key={r.token} className="flex flex-col gap-2">
              <div
                className={`border-border bg-brand-muted h-20 w-full border ${r.class}`}
                aria-hidden
              />
              <div className="flex flex-col gap-0.5">
                <code className="text-foreground text-xs font-medium">{r.class}</code>
                <code className="text-muted-foreground text-xs">{r.token}</code>
                <span className="text-muted-foreground text-xs">{r.value}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Elevation</h2>
        <p className="text-muted-foreground max-w-3xl text-sm">
          Applied to <code className="text-foreground">[data-slot=&apos;card&apos;]</code>,{' '}
          <code className="text-foreground">sheet-content</code>,{' '}
          <code className="text-foreground">popover</code>, menus and selects. In dark mode the same
          shape deepens its alpha so it still separates from the surface.
        </p>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <div
              className="border-border bg-card text-card-foreground flex h-28 items-center justify-center rounded-xl border text-sm"
              style={{ boxShadow: CARD_SHADOW }}
            >
              Floating surface
            </div>
            <code className="text-muted-foreground text-xs">{CARD_SHADOW}</code>
          </div>
          <div className="flex flex-col gap-2">
            <div className="border-border bg-card text-card-foreground flex h-28 items-center justify-center rounded-xl border text-sm">
              Flat surface (no shadow)
            </div>
            <span className="text-muted-foreground text-xs">
              A table row answers the cursor instead: a wash of the theme&apos;s own muted tone on{' '}
              <code className="text-foreground">:hover</code>, so a long list reads as something you
              act on.
            </span>
          </div>
        </div>
      </section>
    </div>
  )
}

const meta = {
  title: 'Design System/Radius & Elevation',
  component: RadiusAndElevation,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof RadiusAndElevation>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { level: 1, name: /Radius/ })).toBeInTheDocument()
    await expect(canvas.getByRole('heading', { name: 'Radius scale' })).toBeInTheDocument()
    await expect(canvas.getByRole('heading', { name: 'Elevation' })).toBeInTheDocument()
  },
}
