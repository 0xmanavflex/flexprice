/**
 * A list's sort, with a tie-break so the order is actually an order.
 *
 * Sorting by a timestamp alone is not a total order: rows that share a value
 * come back in whatever order the database happened to produce, and that can
 * differ between two identical requests. On a paged list that is not cosmetic
 *: a row tied with another can appear on page one and page two, or on
 * neither, because the offsets are cut through an order that moved.
 *
 * It surfaced when the default moved to updated-at: four of thirty fixture
 * customers share an `updated_at`, and two screenshots that render the
 * customers list started passing locally and failing in CI. The screenshots
 * were right. The list was wrong.
 *
 * `id` is the tie-break because every row has one and no two share it. The
 * direction follows the primary sort so the secondary key does not read as
 * backwards next to it.
 *
 * The API honours a second entry in `sort`: checked against the live API by
 * reversing the secondary key and watching the rows swap, not assumed from
 * the fact that it accepts the field.
 */
export function sortWithTieBreak(
  field: string,
  direction: 'asc' | 'desc',
): Array<{ field: string; direction: 'asc' | 'desc' }> {
  // Already total: nothing to break.
  if (field === 'id') return [{ field, direction }]
  return [
    { field, direction },
    { field: 'id', direction },
  ]
}
