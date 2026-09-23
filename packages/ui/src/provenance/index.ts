/**
 * Where a component came from, in the type system.
 *
 * ReUI is the foundation. When a requirement differs from what the registry
 * gives us, the answer is a composition over ReUI parts — not a fork of a ReUI
 * component, and not a new primitive. Custom is the exception, and it has to be
 * argued for.
 *
 * Recording this per component is what makes "prefer composition" observable.
 * Without it the rule is a sentence in a document nobody can check, and a
 * library drifts custom one reasonable-looking component at a time. V1 reached
 * 616 component files that way, 371 of them in a single `molecules/` folder.
 */

export const Source = {
  /** Straight from the registry. We own none of its markup. */
  REUI: 'reui',
  /** Flexprice behaviour composed over ReUI parts. The preferred way to differ. */
  COMPOSITION: 'composition',
  /** Built here, because ReUI could not express it. The exception. */
  CUSTOM: 'custom',
} as const

export type Source = (typeof Source)[keyof typeof Source]

/**
 * Note the asymmetry: `custom` demands a `reason` and the others do not.
 *
 * That is the point of the type. Declaring a component custom means writing
 * down what ReUI could not do at the moment you decide it — not at review, when
 * the code is already written and the honest answer is "it was easier". A
 * component cannot be quietly custom; TypeScript will not compile it.
 */
export type Provenance =
  | { source: typeof Source.REUI; registry: string[]; note?: string }
  | { source: typeof Source.COMPOSITION; composes: string[]; note?: string }
  | { source: typeof Source.CUSTOM; reason: string; note?: string }

export function provenance(value: Provenance): Provenance {
  return value
}

/**
 * The project's block surface.
 *
 * ReUI blocks render on one of two surfaces, and mixing them on a screen looks
 * inconsistent. Card is the default; reach for Frame only when there is an
 * explicit layout reason, and say what it is.
 *
 * Pass this on every `search` and `compose_page` call to the ReUI MCP so the
 * results cannot drift from what the project actually uses.
 */
export const SURFACE = 'card' as const
export type Surface = 'card' | 'frame'
