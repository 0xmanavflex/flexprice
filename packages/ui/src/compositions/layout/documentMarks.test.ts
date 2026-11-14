import { describe, expect, it } from 'vitest'
import { layoutMarks, type MarkTerm } from './documentMarks'

const box = (left: number, width: number, top = 0.38, height = 0.0116, page = 1) => ({
  page,
  left,
  top,
  width,
  height,
})
const term = (
  id: string,
  tone: MarkTerm['tone'],
  ...boxes: MarkTerm['boxes'][number][]
): MarkTerm => ({
  id,
  tone,
  boxes,
})
const ids = (segments: ReturnType<typeof layoutMarks>) =>
  segments.map((s) => s.terms.map((t) => t.id))

describe('layoutMarks', () => {
  it('paints identical boxes once, carrying both terms', () => {
    const segments = layoutMarks(
      [
        term('term.term_months', 'confident', box(0.31, 0.014)),
        term('term.renewal_term_months', 'confident', box(0.31, 0.014)),
      ],
      1,
    )
    expect(segments).toHaveLength(1)
    expect(ids(segments)).toEqual([['term.term_months', 'term.renewal_term_months']])
  })

  it('cuts a wide box around the narrower ones inside it, without stacking', () => {
    // The Süppmayer "Annual Usage fee" line: a structure box across the line,
    // a charge name and an amount inside it.
    const segments = layoutMarks(
      [
        term('billing.structure', 'doubt', box(0.312, 0.525, 0.3814, 0.0106)),
        term('charges[2].name', 'confident', box(0.313, 0.121, 0.3829)),
        term('charges[2].amount_period', 'confident', box(0.439, 0.06, 0.3829)),
      ],
      1,
    )
    // Never two segments over the same stretch.
    for (let i = 1; i < segments.length; i++) {
      const prev = segments[i - 1]!
      expect(segments[i]!.left).toBeGreaterThanOrEqual(prev.left + prev.width - 1e-9)
    }
    // The most specific term comes first where boxes overlap.
    expect(ids(segments).find((t) => t.includes('charges[2].name'))?.[0]).toBe('charges[2].name')
    // Any term to check makes the stretch yellow.
    expect(segments.every((s) => s.tone === 'doubt')).toBe(true)
    // The structure box's own stretches remain.
    expect(ids(segments).at(-1)).toEqual(['billing.structure'])
  })

  it('keeps separate lines apart and ignores other pages', () => {
    const segments = layoutMarks(
      [
        term('a', 'confident', box(0.1, 0.2, 0.1), box(0.1, 0.2, 0.5, 0.01, 2)),
        term('b', 'confident', box(0.1, 0.2, 0.2)),
      ],
      1,
    )
    expect(ids(segments)).toEqual([['a'], ['b']])
  })

  it('merges adjacent stretches covered by the same terms', () => {
    const segments = layoutMarks([term('a', 'confident', box(0.1, 0.1), box(0.2, 0.1))], 1)
    expect(segments).toHaveLength(1)
    expect(segments[0]?.width).toBeCloseTo(0.2)
  })
})
