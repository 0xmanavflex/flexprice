import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { AUTH_IMAGES } from '@ui/assets/auth'
import { Badge } from '@ui/components/reui/badge'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { CUSTOMER_LOGOS, TESTIMONIALS, type Testimonial } from './testimonials'

/**
 * The right-hand panel of every sign-in screen, after the dashboard redesign.
 *
 * An inset island holding admin.flexprice.io's login photograph (one per
 * theme) under a light veil; a review carousel in the upper part: the current
 * review at full strength, the next one peeking in at 30%, the outgoing one
 * drifting left as it fades, every 6.5 s, paused on hover and still under
 * reduced motion; and the "Trusted by" logo grid along the foot.
 */
export const ReviewPanelProvenance = provenance({
  source: 'composition',
  composes: ['motion/react'],
  note: 'Auth right panel from the dashboard redesign: login photo, review carousel, Trusted by grid.',
})

const QUOTE_MS = 6500
/** The gap to the next review, how much of it peeks in, and the widest a review gets. */
const GAP = 64
const PEEK = 120
const MAX_W = 600
/** How far the outgoing review drifts left as it fades. */
const EXIT_X = 96

const ink = 'text-foreground'
const inkMuted = 'text-muted-foreground'

/** The two photographs, one per theme. */
export function PhotoGround({ light, dark }: { light: string; dark: string }) {
  return (
    <>
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center bg-no-repeat dark:hidden"
        style={{ backgroundImage: `url(${light})` }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 hidden bg-cover bg-center bg-no-repeat dark:block"
        style={{ backgroundImage: `url(${dark})` }}
      />
    </>
  )
}

function StageTag({ stage }: { stage: string }) {
  return (
    <Badge variant="info-light" size="lg" className="h-7 rounded-[4px] px-2.5 text-[13px]">
      {stage}
    </Badge>
  )
}

function Review({ t }: { t: Testimonial }) {
  return (
    <figure className="flex flex-col items-start text-left">
      <img
        src={t.logo}
        alt={t.company}
        className={cn(
          'w-auto shrink-0 object-contain object-left brightness-0 dark:invert',
          t.logoClass,
        )}
      />
      <blockquote
        className={cn(
          'mt-7 text-[20px]/[1.5] tracking-[-0.01em] text-pretty xl:text-[22px]/[1.48]',
          ink,
        )}
      >
        “{t.quote}”
      </blockquote>
      <figcaption className="mt-9 flex flex-col items-start gap-3.5">
        <span className="flex items-center gap-3.5">
          <img
            src={t.photo}
            alt=""
            className="border-border size-11 rounded-full border object-cover"
          />
          <span>
            <span className={cn('block text-[15px]', ink)}>{t.name}</span>
            <span className={cn('block text-sm', inkMuted)}>
              {t.role}, {t.company}
            </span>
          </span>
        </span>
        {t.stage ? <StageTag stage={t.stage} /> : null}
      </figcaption>
    </figure>
  )
}

function ReviewCarousel({ start }: { start: number }) {
  const n = TESTIMONIALS.length
  const [index, setIndex] = useState(start)
  const [paused, setPaused] = useState(false)
  const reduce = useReducedMotion()

  useEffect(() => {
    if (reduce || paused) return
    const id = window.setTimeout(() => setIndex((i) => (i + 1) % n), QUOTE_MS)
    return () => window.clearTimeout(id)
  }, [reduce, paused, index, n])

  // The review's width follows the panel, leaving room for the next one to peek in.
  const rowRef = useRef<HTMLDivElement>(null)
  const [rowW, setRowW] = useState(MAX_W + PEEK)
  useEffect(() => {
    const el = rowRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setRowW(entry.contentRect.width)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const slideW = Math.max(0, Math.min(MAX_W, rowW - PEEK))

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Customer reviews"
    >
      <div
        ref={rowRef}
        className="relative h-[19rem] overflow-hidden xl:h-[20.5rem]"
        style={{
          maskImage: `linear-gradient(90deg, black ${slideW}px, transparent ${slideW + GAP + PEEK}px)`,
        }}
      >
        {TESTIMONIALS.map((t, i) => {
          // 0 is the current review, 1 the next one peeking in; earlier ones leave to the left.
          let d = (i - index + n) % n
          if (d === n - 1) d = -1
          return (
            <motion.div
              key={t.id}
              aria-hidden={d !== 0}
              className="absolute top-0 left-0"
              style={{ width: slideW }}
              initial={false}
              animate={{
                x: d === -1 ? -EXIT_X : d * (slideW + GAP),
                opacity: d === 0 ? 1 : d === 1 ? 0.3 : 0,
              }}
              transition={
                reduce
                  ? { duration: 0 }
                  : {
                      x: { duration: 1.1, ease: [0.45, 0, 0.15, 1] },
                      opacity: {
                        duration: d === -1 ? 0.45 : 0.9,
                        ease: 'easeOut',
                        delay: d === 0 ? 0.15 : 0,
                      },
                    }
              }
            >
              <Review t={t} />
            </motion.div>
          )
        })}
      </div>

      {/*
        The dots are the whole control. The chevrons that sat beside them were
        a second way to do what the dots already do, on a panel that also
        advances on its own: and each dot names the review it goes to, which
        a chevron cannot.
      */}
      <div className="mt-4 flex items-center">
        <div className="flex gap-1.5">
          {TESTIMONIALS.map((q, i) => (
            <button
              key={q.id}
              type="button"
              aria-label={`Show review from ${q.name}, ${q.company}`}
              aria-pressed={i === index}
              onClick={() => setIndex(i)}
              className={cn(
                'h-1 rounded-full transition-[width,background-color] duration-200',
                i === index ? 'bg-foreground w-7' : 'bg-foreground/20 hover:bg-foreground/40 w-3.5',
              )}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

/** The panel. `start` picks the first review by id. Hidden below `lg`. */
export function ReviewPanel({ start }: { start?: string }) {
  const startIndex = Math.max(
    0,
    TESTIMONIALS.findIndex((t) => t.id === start),
  )
  return (
    <aside className="bg-background hidden h-svh p-3 lg:sticky lg:top-0 lg:flex">
      <div className="border-border/80 bg-background relative flex flex-1 flex-col overflow-hidden rounded-xl border">
        <PhotoGround light={AUTH_IMAGES.authLight} dark={AUTH_IMAGES.authDark} />
        {/* A light veil so the text reads on the photo while the sky and hills still show. */}
        <div
          aria-hidden="true"
          className="from-background/30 via-background/50 to-background/80 absolute inset-0 bg-gradient-to-b"
        />
        <div className="relative flex flex-1 flex-col justify-center gap-[clamp(3rem,8vh,5rem)] py-[7vh] pl-16 xl:pl-20">
          <ReviewCarousel start={startIndex} />
          <div className="pr-16 xl:pr-20">
            <p className={cn('mb-7 text-sm', inkMuted)}>Trusted by</p>
            <div className="grid grid-cols-3 items-center gap-x-12 gap-y-5">
              {CUSTOMER_LOGOS.map((logo) => (
                <div key={logo.name} className="flex h-10 items-center">
                  <img
                    src={logo.src}
                    alt={logo.name}
                    className="w-auto max-w-none object-contain opacity-80 dark:brightness-0 dark:invert"
                    style={{ height: logo.height, marginLeft: logo.offset }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
