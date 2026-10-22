import type { ComponentProps } from 'react'
import { SettingRow as VendoredSettingRow } from '@ui/components/blocks/settings-7/components/setting-row'

/**
 * The settings-7 surfaces, re-exported so a settings page can use them
 * without importing a vendored block path.
 *
 * `SettingsCard` is the titled card with the bordered header and the footer
 * bar. `SettingRow` is the label-left, control-right row. `SettingsFieldGroup`
 * is the container those rows measure themselves against. The files themselves
 * stay untouched.
 */
export { SettingsCard } from '@ui/components/blocks/settings-7/components/settings-card'
export { SettingsFieldGroup } from '@ui/components/blocks/settings-7/components/settings-field-group'

/*
 * Side by side, the vendored row top-aligns the label with the control's box,
 * so beside an input or select the label sits half a line above the text it
 * names. When the control is a text box, the label column is nudged down by
 * the difference (a 20px line beside a 32px box), so the two read on one line.
 * Switches and buttons are already about one line tall and keep the top edge.
 */
const alignLabelWithTextBox =
  '@md/field-group:[&>[data-slot=field]:has(>[data-slot=field-content]_:is(input:not([type=checkbox]):not([type=radio]),textarea,[data-slot=select-trigger],[data-slot=combobox-trigger],[role=combobox]))>div:first-child]:pt-1.5'

export function SettingRow(props: ComponentProps<typeof VendoredSettingRow>) {
  return (
    <div className={`contents ${alignLabelWithTextBox}`}>
      <VendoredSettingRow {...props} />
    </div>
  )
}
