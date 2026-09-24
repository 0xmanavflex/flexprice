/**
 * Vendored from the ReUI registry, on the `base-nova` style (Base UI).
 *
 * Do not hand-edit anything in this folder — an upstream fix should stay a
 * re-install. If a primitive is wrong for us, compose around it in
 * `../compositions`, and record that in the component's provenance.
 *
 * Install with the shadcn CLI, never by hand:
 *   pnpm ui:add <name>
 *
 * Re-exported here so an app can reach a primitive without a deep path. Apps
 * compose; they should not need to know the folder layout of this package.
 */
export { Button } from './button'
export { Input } from './input'
export { Label } from './label'
export { Badge } from '@ui/components/reui/badge'
