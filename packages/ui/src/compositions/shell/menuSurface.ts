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
export const MENU_CONTENT = 'min-w-56 rounded-2xl p-1.5 shadow-lg'

/** Rows the same height as the sidebar's, so the cursor does not change gear. */
export const MENU_ITEM = 'gap-2 rounded-xl px-2.5 py-2'

/** Section headings inside a menu. Quieter than the rows they introduce. */
export const MENU_LABEL = 'px-2.5 py-1.5 text-muted-foreground text-xs font-normal'
