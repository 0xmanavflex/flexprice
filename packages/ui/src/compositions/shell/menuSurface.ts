/**
 * One surface for every menu the shell opens.
 *
 * There are four: the rail's group menus, the account menu, Create, and the
 * environment switcher: and they were drifting apart: different padding,
 * different radii, rows that were 24px tall in one and 32px in another. A menu
 * that opens from a 36px sidebar row should not feel like a different
 * component when it opens from the header.
 *
 * The surface itself: corner, inset and float-shadow: is now one rule in
 * `styles.css` shared with the sort menu, the selects and the filter popover, so
 * every menu in the app opens the same shape. What is left here is only what is
 * particular to a shell menu: a comfortable minimum width, and rows at the
 * sidebar's own height (below), since the primitive's `p-1`/`py-1` default reads
 * cramped at this size.
 */
export const MENU_CONTENT = 'min-w-60'

/**
 * Rows at the sidebar's own height. The radius, inset and float-shadow now come
 * from the one menu-surface rule in `styles.css` (so this menu matches the sort
 * menu, the selects and the filter popover); this sets only what is this menu's
 * own: its comfortable row height and gap.
 */
export const MENU_ITEM = 'gap-2.5 px-3 py-2.5'

/** Section headings inside a menu. Quieter than the rows they introduce. */
export const MENU_LABEL = 'px-3 py-1.5 text-muted-foreground text-xs font-normal'
