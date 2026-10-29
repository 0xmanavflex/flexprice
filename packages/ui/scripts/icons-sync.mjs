/**
 * Installs the ReUI Motion Icons named in `src/icons/icon-map.json`, makes them
 * compile in this repo, and regenerates the `src/icons/index.ts` barrel.
 *
 * `icon-map.json` is the only file anyone edits. This script does the rest, so
 * swapping an icon is: change one line in the map, run `pnpm icons:sync`.
 *
 * Installing needs the ReUI licence key (Motion Icons are a paid registry), read
 * from `REUI_LICENSE_KEY` in `packages/ui/.env.local` (git-ignored) or the
 * environment. The installed files are committed, so CI and everyone else never
 * need the key.
 *
 *   pnpm icons:sync            install what is missing, normalize, regenerate
 *   pnpm icons:sync --force    reinstall every icon from the registry
 *   pnpm icons:sync --offline  skip installing; only normalize and regenerate
 *
 * An entry with `local` instead of `reui` names a repo-owned icon in
 * `src/icons/local/<name>.tsx` (same shape as a registry icon: a component
 * taking `className`), for a glyph the registry set does not have. Those are
 * never installed or removed here, only exported.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, globSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const mapPath = resolve(root, 'src/icons/icon-map.json')
const barrelPath = resolve(root, 'src/icons/index.ts')
const vendorDir = resolve(root, 'src/reui/icons')
const args = new Set(process.argv.slice(2))

const map = JSON.parse(readFileSync(mapPath, 'utf8'))
const style = map.style
const entries = Object.entries(map.icons).sort(([a], [b]) => a.localeCompare(b))

const localDir = resolve(root, 'src/icons/local')
const isLocal = (icon) => typeof icon.local === 'string'
const variantOf = (icon) => (icon.animated ? 'animated' : 'default')
const styleOf = (icon) => icon.style ?? style
const fileOf = (variant, iconStyle, name) => resolve(vendorDir, variant, iconStyle, `${name}.tsx`)

// Keyed by variant/style/name; an icon may override the map's default style.
const wanted = new Map()
for (const [, icon] of entries) {
  if (isLocal(icon)) continue
  const variant = variantOf(icon)
  const iconStyle = styleOf(icon)
  wanted.set(`${variant}/${iconStyle}/${icon.reui}`, [variant, iconStyle, icon.reui])
}

const failures = []
for (const [key, icon] of Object.entries(map.icons)) {
  if (!/^[A-Z][A-Za-z0-9]*$/.test(key)) failures.push(`"${key}" is not a PascalCase export name`)
  if (isLocal(icon) && !existsSync(resolve(localDir, `${icon.local}.tsx`)))
    failures.push(`local icon missing: src/icons/local/${icon.local}.tsx`)
}

if (!args.has('--offline')) {
  const missing = [...wanted.values()].filter(
    ([variant, iconStyle, name]) =>
      args.has('--force') || !existsSync(fileOf(variant, iconStyle, name)),
  )
  for (let i = 0; i < missing.length; i += 20) {
    const items = missing
      .slice(i, i + 20)
      .map(([variant, iconStyle, name]) => `@reui/icons/${variant}/${iconStyle}/${name}`)
    execFileSync('pnpm', ['dlx', 'shadcn@latest', 'add', ...items, '--yes', '--overwrite'], {
      cwd: root,
      stdio: 'inherit',
      env: process.env,
    })
  }
  console.log(
    missing.length === 0 ? 'all icons already installed' : `installed ${missing.length} icons`,
  )
}

const HEADER = `// @ts-nocheck — vendored from the ReUI registry (Motion Icons); do not hand-edit.
// Regenerate with: pnpm icons:sync   (see scripts/icons-sync.mjs)
`

for (const [variant, iconStyle, name] of wanted.values()) {
  if (!existsSync(fileOf(variant, iconStyle, name)))
    failures.push(`not installed: ${variant}/${iconStyle}/${name}`)
}

// Normalise every vendored icon: the registry source imports `cn` by a bare
// specifier that does not resolve here, and does not carry our header.
for (const file of globSync('**/*.tsx', { cwd: vendorDir })) {
  const path = resolve(vendorDir, file)
  const source = readFileSync(path, 'utf8')
  let next = source.replaceAll(/from (["'])cn\1/g, `from '@ui/lib/cn'`)
  if (!next.startsWith('// @ts-nocheck')) next = HEADER + next
  if (next !== source) writeFileSync(path, next)
}

// Drop icons the map no longer uses, so the vendored folder mirrors the map.
for (const file of globSync('**/*.tsx', { cwd: vendorDir })) {
  if (!wanted.has(file.replace(/\.tsx$/, ''))) {
    rmSync(resolve(vendorDir, file))
    console.log(`  removed unused ${relative(root, resolve(vendorDir, file))}`)
  }
}

const identifier = (variant, iconStyle, name) =>
  `${variant === 'animated' ? 'animated' : 'static'}_${iconStyle === style ? '' : `${iconStyle}_`}${name.replaceAll(/-(\w)/g, (_, c) => c.toUpperCase()).replaceAll(/\W/g, '_')}`

const localIdentifier = (name) =>
  `local_${name.replaceAll(/-(\w)/g, (_, c) => c.toUpperCase()).replaceAll(/\W/g, '_')}`

const imports = [
  ...[...wanted.values()]
    .sort(([av, as, an], [bv, bs, bn]) => `${av}/${as}/${an}`.localeCompare(`${bv}/${bs}/${bn}`))
    .map(
      ([variant, iconStyle, name]) =>
        `import ${identifier(variant, iconStyle, name)} from '../reui/icons/${variant}/${iconStyle}/${name}'`,
    ),
  ...[...new Set(entries.filter(([, icon]) => isLocal(icon)).map(([, icon]) => icon.local))]
    .sort()
    .map((name) => `import ${localIdentifier(name)} from './local/${name}'`),
]

const exports = entries.map(([key, icon]) => {
  if (isLocal(icon)) {
    const rotate = icon.rotate === undefined ? '' : `, ${icon.rotate}`
    return `export const ${key}: IconComponent = staticIcon(${localIdentifier(icon.local)}, '${key}'${rotate})
export { ${key} as ${key}Icon }`
  }
  const variant = variantOf(icon)
  const factory = icon.animated ? 'animatedIcon' : 'staticIcon'
  const rotate = icon.rotate === undefined ? '' : `, ${icon.rotate}`
  return `export const ${key}: IconComponent = ${factory}(${identifier(variant, styleOf(icon), icon.reui)}, '${key}'${rotate})
export { ${key} as ${key}Icon }`
})

writeFileSync(
  barrelPath,
  `// GENERATED by scripts/icons-sync.mjs from icon-map.json. Do not edit by hand.
//
// The one place the app gets icons from. Names follow lucide's, so existing
// call sites keep working while the glyphs come from ReUI Motion Icons.
import { animatedIcon, staticIcon, type IconComponent, type IconProps } from './factory'
${imports.join('\n')}

export type { IconComponent, IconProps } from './factory'
export type LucideIcon = IconComponent
export type LucideProps = IconProps

${exports.join('\n')}
`,
)

if (failures.length > 0) {
  console.error(failures.map((f) => `  ${f}`).join('\n'))
  process.exit(1)
}
const locals = entries.filter(([, icon]) => isLocal(icon)).length
console.log(
  `icons: ${entries.length} names -> ${wanted.size} ReUI icons (${style})${locals ? `, ${locals} local` : ''}`,
)
