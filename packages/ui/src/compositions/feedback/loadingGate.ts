/**
 * Decides when a loading state is allowed to be seen.
 *
 * A skeleton that appears for 80ms and vanishes is worse than none: the page
 * flashes. One that stays for 8 seconds with no explanation is worse still: the
 * reader cannot tell slow from broken. So a load passes through phases:
 *
 *   idle      not loading
 *   reserved  loading, but quick so far: the skeleton's space is held (so the
 *             layout does not jump when it arrives) without drawing it
 *   visible   still loading after `delayMs`: draw the skeleton, and keep it
 *             drawn for at least `minMs` so it does not strobe
 *   slow      still loading after `slowMs`: say it is taking longer than usual
 *
 * Framework-free and driven by an injected clock so it is testable without a
 * browser; `useLoadingPhase` is the thin React wrapper.
 */
export type LoadingPhase = 'idle' | 'reserved' | 'visible' | 'slow'

export interface LoadingGateOptions {
  delayMs?: number
  minMs?: number
  slowMs?: number
}

export const LOADING_DEFAULTS = { delayMs: 200, minMs: 400, slowMs: 8000 } as const

export class LoadingGate {
  private phase: LoadingPhase = 'idle'
  private loading = false
  private shownAt = 0
  private timers: ReturnType<typeof setTimeout>[] = []
  private readonly delayMs: number
  private readonly minMs: number
  private readonly slowMs: number

  constructor(
    private readonly onChange: (phase: LoadingPhase) => void,
    options: LoadingGateOptions = {},
    private readonly now: () => number = Date.now,
  ) {
    this.delayMs = options.delayMs ?? LOADING_DEFAULTS.delayMs
    this.minMs = options.minMs ?? LOADING_DEFAULTS.minMs
    this.slowMs = options.slowMs ?? LOADING_DEFAULTS.slowMs
  }

  get current(): LoadingPhase {
    return this.phase
  }

  set(isLoading: boolean): void {
    if (isLoading === this.loading) return
    this.loading = isLoading
    this.clear()

    if (isLoading) {
      this.move('reserved')
      this.timers.push(
        setTimeout(() => {
          this.shownAt = this.now()
          this.move('visible')
        }, this.delayMs),
        setTimeout(() => this.move('slow'), this.slowMs),
      )
      return
    }

    // Finished. Never drawn: nothing to take down. Drawn: hold out the minimum.
    if (this.phase === 'reserved') return this.move('idle')
    const remaining = this.minMs - (this.now() - this.shownAt)
    if (remaining <= 0) return this.move('idle')
    this.timers.push(setTimeout(() => this.move('idle'), remaining))
  }

  dispose(): void {
    this.clear()
  }

  private move(next: LoadingPhase): void {
    if (next === this.phase) return
    this.phase = next
    this.onChange(next)
  }

  private clear(): void {
    for (const timer of this.timers) clearTimeout(timer)
    this.timers = []
  }
}
