/**
 * How highlights are painted on a page: like a highlighter, each stretch of
 * text is painted once.
 *
 * Several terms are often read from the same words (a charge's name, amount
 * and period from one line; a billing structure from the whole paragraph
 * around them). Drawn as one box per term they stack: fills darken where they
 * overlap, and borders nest. Instead, the boxes on a line are cut into
 * side-by-side segments at every box edge; a segment carries every term that
 * covers it, is yellow if any of them needs review, and selects the most
 * specific one (the narrowest box) when clicked.
 */

export interface MarkBox {
  page: number
  left: number
  top: number
  width: number
  height: number
}

export interface MarkTerm {
  id: string
  tone: 'confident' | 'doubt'
  boxes: readonly MarkBox[]
}

export interface Segment<T extends MarkTerm> {
  left: number
  top: number
  width: number
  height: number
  /** Every term covering this stretch, most specific (narrowest box) first. */
  terms: T[]
  tone: 'confident' | 'doubt'
}

interface Piece<T> {
  term: T
  box: MarkBox
}

/** Boxes on one line overlap vertically by at least half the shorter one. */
function sameLine(a: { top: number; height: number }, b: MarkBox): boolean {
  const overlap = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top)
  return overlap >= Math.min(a.height, b.height) / 2
}

/** Edges closer than this (a fraction of the page, ~0.6pt) are one edge. */
const EPSILON = 0.001

/** The segments to paint on `page`, from terms in reading order. */
export function layoutMarks<T extends MarkTerm>(terms: readonly T[], page: number): Segment<T>[] {
  const pieces: Piece<T>[] = terms
    .flatMap((term) => term.boxes.filter((box) => box.page === page).map((box) => ({ term, box })))
    .sort((a, b) => a.box.top - b.box.top)

  // Group into lines.
  const lines: { top: number; height: number; pieces: Piece<T>[] }[] = []
  for (const piece of pieces) {
    const line = lines.find((l) => sameLine(l, piece.box))
    if (line) {
      const bottom = Math.max(line.top + line.height, piece.box.top + piece.box.height)
      line.top = Math.min(line.top, piece.box.top)
      line.height = bottom - line.top
      line.pieces.push(piece)
    } else {
      lines.push({ top: piece.box.top, height: piece.box.height, pieces: [piece] })
    }
  }

  const segments: Segment<T>[] = []
  for (const line of lines) {
    const edges = [
      ...new Set(line.pieces.flatMap(({ box }) => [box.left, box.left + box.width])),
    ].sort((a, b) => a - b)
    let open: Segment<T> | null = null
    for (let i = 0; i < edges.length - 1; i++) {
      const from = edges[i] ?? 0
      const to = edges[i + 1] ?? 0
      if (to - from < EPSILON) continue
      const covering = line.pieces
        .filter(({ box }) => box.left <= from + EPSILON && box.left + box.width >= to - EPSILON)
        .sort((a, b) => a.box.width - b.box.width)
      if (covering.length === 0) {
        open = null
        continue
      }
      const ids = covering.map((c) => c.term.id).join('|')
      // Adjacent stretches covered by the same terms are one segment.
      if (open && open.terms.map((t) => t.id).join('|') === ids) {
        open.width = to - open.left
        continue
      }
      const top = Math.min(...covering.map((c) => c.box.top))
      const bottom = Math.max(...covering.map((c) => c.box.top + c.box.height))
      const unique = [...new Map(covering.map((c) => [c.term.id, c.term])).values()]
      open = {
        left: from,
        top,
        width: to - from,
        height: bottom - top,
        terms: unique,
        tone: unique.some((t) => t.tone === 'doubt') ? 'doubt' : 'confident',
      }
      segments.push(open)
    }
  }
  return segments
}
