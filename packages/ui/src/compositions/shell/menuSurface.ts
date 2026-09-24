/**
 * One surface for every menu the shell opens.
 *
 * There are four — the rail's group menus, the account menu, Create, and the
 * environment switcher — and they were drifting apart: different padding,
 * different radii, rows that were 24px tall in one and 32px in another. A menu
 * that opens from a 36px sidebar row should not feel like a different
 * component when it opens from the header.
 *
 * The primitive's defaults are tuned for a dense desktop menu bar: `p-1`
 * around `py-1` rows, which at this size reads as cramped rather than compact.
 * These loosen it to match the rows the menus open from, and round the
 * corners to match the shell's own.
 */
export const MENU_CONTENT = 'min-w-60 rounded-3xl p-2 shadow-xl'

/**
 * Rows at the sidebar's own height, and rounded nearly as much as the menu
 * that holds them — Flux's proportion, where a selected row is a soft pill
 * filling the panel rather than a thin highlighted line inside it.
 */
export const MENU_ITEM = 'gap-2.5 rounded-2xl px-3 py-2.5'

/** Section headings inside a menu. Quieter than the rows they introduce. */
export const MENU_LABEL = 'px-3 py-1.5 text-muted-foreground text-xs font-normal'
