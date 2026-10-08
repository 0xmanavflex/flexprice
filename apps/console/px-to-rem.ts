import type { Plugin } from 'vite'

/**
 * Turns the px lengths in the compiled stylesheet into rem.
 *
 * The console renders at 90% of the stock scale (`html { font-size: 90% }`),
 * which only moves rem values. Tailwind's arbitrary values (`text-[13px]`,
 * `max-w-[720px]`, `h-[60px]`) are literal px, so without this they stay at
 * 100% while everything around them shrinks. Runs on the output CSS, so
 * vendored components are covered without editing them.
 *
 * Lengths under 3px (hairline borders, rings, outlines) stay px so they remain
 * crisp. Only declaration values change: selectors, media/container queries,
 * url() and strings are left untouched.
 */
const MIN_PX = 3
// A declaration is `name: value` right after `{`, `;` or `}`; selectors end in
// `{` rather than `;`/`}`, so they never match and class names stay intact.
const DECLARATION = /([{;}]\s*)([-\w]+)(\s*:\s*)([^;{}]+)(?=[;}])/g
const LENGTH = /url\([^)]*\)|"[^"]*"|'[^']*'|(?<![\w.-])(-?\d*\.?\d+)px(?![\w-])/g

function convert(value: string): string {
  return value.replace(LENGTH, (match, px: string | undefined) => {
    if (px === undefined) return match
    const n = Number(px)
    if (Math.abs(n) < MIN_PX) return match
    return `${Number((n / 16).toFixed(4))}rem`
  })
}

export function pxToRem(): Plugin {
  return {
    name: 'fp:px-to-rem',
    transform(code, id) {
      if (!/\.css(?:$|\?)/.test(id) || /[?&](?:url|raw)\b/.test(id)) return null
      if (!code.includes('px')) return null
      const out = code.replace(
        DECLARATION,
        (_m, lead: string, name: string, colon: string, value: string) =>
          lead + name + colon + convert(value),
      )
      return out === code ? null : { code: out, map: null }
    },
  }
}
