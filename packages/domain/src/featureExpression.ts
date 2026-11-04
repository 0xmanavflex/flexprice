/**
 * A first check of a custom aggregation expression, before the API's own CEL
 * parse: brackets and quotes that close, and no operator left hanging. It does
 * not know CEL's grammar, so it only catches what is plainly unfinished; the
 * API still has the last word, and its refusal is shown on the same field.
 */
export function expressionProblem(expression: string): string | null {
  const text = expression.trim()
  if (!text) return null

  const closing: Record<string, string> = { ')': '(', ']': '[', '}': '{' }
  const open: string[] = []
  let quote: string | null = null
  for (const char of text) {
    if (quote) {
      if (char === quote) quote = null
      continue
    }
    if (char === '"' || char === "'") quote = char
    else if (char === '(' || char === '[' || char === '{') open.push(char)
    else if (char in closing) {
      if (open.pop() !== closing[char]) return `Unexpected ${char}.`
    }
  }
  if (quote) return 'A quote is never closed.'
  if (open.length > 0) return `A ${open[open.length - 1]} is never closed.`
  if (/[+\-*/%<>=!&|?:.,]$/.test(text)) return 'The expression ends with an operator.'
  if (/^[*/%<>=&|?:.,]/.test(text)) return 'The expression starts with an operator.'
  return null
}

/**
 * The property names seen on events with this name, most common first: the
 * variables an expression over those events can use.
 */
export function eventPropertyNames(
  events: readonly { eventName: string; properties: Record<string, unknown> }[],
  eventName: string,
  limit = 12,
): string[] {
  const counts = new Map<string, number>()
  for (const event of events) {
    if (event.eventName !== eventName) continue
    for (const key of Object.keys(event.properties ?? {})) {
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key]) => key)
}
