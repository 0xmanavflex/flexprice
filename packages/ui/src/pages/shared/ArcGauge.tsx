import type { CSSProperties, ReactNode } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@ui/components/primitives/tooltip'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { toneColor } from './charts'
import type { ChartTone } from './charts'

/**
 * A segmented arc gauge.
 *
 * `@reui/chart-7` draws its metric as ticks radiating around a 180° arc: a
 * lit run against a faint track, with a soft blurred copy of the lit ticks
 * underneath so the active part reads as glowing rather than merely coloured.
 * The block hard-wires two demo metrics and an avatar stack, so what is reused
 * is the geometry and that bloom: the centre, radius and tick length, the
 * 180°-to-360° sweep, the cropped viewBox that trims the dead space above the
 * arc, and the two-pass render.
 *
 * A gauge is the right mark only when "full" means something: a rate against
 * 100%, usage against a commitment, keys active out of keys issued. For a
 * quantity with no ceiling it is the wrong shape at any radius, because the
 * sweep implies a maximum that does not exist. `max` is required for that
 * reason: there is no version of this component that will invent one.
 *
 * Its tone defaults to `good` because the reading is usually health, and health
 * is state: the one thing status colour is reserved for. Pass `warning` or
 * `critical` when the page has decided the reading is bad; the component does
 * not threshold on its own, because where "bad" starts is a product question
 * and a shared chart component is the wrong place to answer it.
 */
export const ArcGaugeProvenance = provenance({
  source: 'composition',
  composes: ['ui/tooltip'],
  note: 'chart-7 segmented tick arc and bloom over a real reading, status tones, with a tooltip and a text readout. Lineage: @reui/chart-7.',
})

/* The block's geometry, kept as-is so the arc sits the way it was drawn. */
const ARC_START = 180
const ARC_SWEEP = 180
const ARC_VIEWBOX = { minX: 14, minY: 18, width: 216, height: 113 } as const
const CENTER_X = 122
const CENTER_Y = 126
const RADIUS = 80
const TICK_LENGTH = 23

export interface ArcGaugeProps {
  /** The current reading. */
  value: number
  /** The reading a full arc means. Required: a gauge without a ceiling is the wrong mark. */
  max: number
  /** The figure in the middle, already formatted. Defaults to `value`/`max` as a percentage. */
  display?: ReactNode | undefined
  /** Caption under the figure, e.g. "of the committed amount". */
  caption?: ReactNode | undefined
  /** Which token lights the arc. Defaults to `good`, since the reading is usually health. */
  tone?: ChartTone | undefined
  /** Ticks around the arc. Default 40. */
  segments?: number | undefined
  /** Accessible name for the gauge. */
  label: string
  className?: string | undefined
}

export function ArcGauge({
  value,
  max,
  display,
  caption,
  tone = 'good',
  segments = 40,
  label,
  className,
}: ArcGaugeProps) {
  const share = max > 0 ? Math.min(Math.max(value, 0) / max, 1) : 0
  // A non-zero reading always lights a tick, for the same reason the meters do:
  // rounding "a little" down to "none" is the one error a gauge must not make.
  const active = share > 0 ? Math.max(1, Math.round(share * segments)) : 0
  const percent = Math.round(share * 100)

  const angleStep = ARC_SWEEP / Math.max(segments - 1, 1)
  const ticks = Array.from({ length: segments }, (_, index) => {
    const radians = ((ARC_START + angleStep * index) * Math.PI) / 180
    return {
      x1: CENTER_X + RADIUS * Math.cos(radians),
      y1: CENTER_Y + RADIUS * Math.sin(radians),
      x2: CENTER_X + (RADIUS + TICK_LENGTH) * Math.cos(radians),
      y2: CENTER_Y + (RADIUS + TICK_LENGTH) * Math.sin(radians),
      lit: index < active,
    }
  })

  const style = {
    '--gauge-lit': toneColor(tone),
    '--gauge-track': 'color-mix(in oklch, var(--muted-foreground) 14%, var(--background))',
  } as CSSProperties

  const reading = `${label}: ${percent}% (${value} of ${max})`

  return (
    <div className={cn('flex flex-col items-center gap-3', className)} style={style}>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label={reading}
              className="focus-visible:ring-ring relative block h-[113px] w-[216px] shrink-0 cursor-default rounded-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            />
          }
        >
          <svg
            aria-hidden="true"
            className="h-full w-full"
            fill="none"
            viewBox={`${ARC_VIEWBOX.minX} ${ARC_VIEWBOX.minY} ${ARC_VIEWBOX.width} ${ARC_VIEWBOX.height}`}
            preserveAspectRatio="xMidYMid meet"
          >
            {/* The block's bloom: a blurred copy of the lit ticks underneath. */}
            <g className="opacity-40 [filter:blur(2.5px)]">
              {ticks.map((tick, index) =>
                tick.lit ? (
                  <line
                    key={index}
                    stroke="var(--gauge-lit)"
                    strokeLinecap="round"
                    strokeWidth={3}
                    x1={tick.x1}
                    x2={tick.x2}
                    y1={tick.y1}
                    y2={tick.y2}
                  />
                ) : null,
              )}
            </g>
            {ticks.map((tick, index) => (
              <line
                key={index}
                stroke={tick.lit ? 'var(--gauge-lit)' : 'var(--gauge-track)'}
                strokeLinecap="round"
                strokeWidth={2.5}
                x1={tick.x1}
                x2={tick.x2}
                y1={tick.y1}
                y2={tick.y2}
              />
            ))}
          </svg>
        </TooltipTrigger>
        <TooltipContent side="top" className="px-2.5 py-1.5 text-xs">
          {reading}
        </TooltipContent>
      </Tooltip>

      {/*
       * The figure is real text under the arc, not a label inside the SVG, so
       * it reflows, scales with the reader's font size and is selectable.
       * `aria-hidden` because the button above already reads the same figure:
       * without it every gauge announces itself twice.
       */}
      {/*
        chart-7 puts the reading beside the arc, in text, not inside the SVG.
        Sitting it just under the arc keeps that: a real line of type, not a
        label drawn over the ticks.
      */}
      <div aria-hidden="true" className="space-y-0.5 text-center">
        <p className="text-sm font-medium">{display ?? `${percent}%`}</p>
        {caption === undefined ? null : <p className="text-muted-foreground text-xs">{caption}</p>}
      </div>
    </div>
  )
}
