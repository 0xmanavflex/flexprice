import { SettingRow, SettingsFieldGroup } from '@fp/ui/compositions'
import { ThemePreferenceCards } from '@fp/ui/pages'
import { Panel, SettingsBlock } from './panelKit'

/**
 * Appearance: the interface theme, as three preview cards, plus the shortcut.
 *
 * The cards read and write the provider mounted in `main.tsx`, the same state
 * the ⌘D shortcut flips, so the two agree by construction. System, Light and
 * Dark are everything the provider supports, and the choice is remembered on
 * this device.
 *
 * No accent-colour picker. The accent is a design token that every surface
 * reads, so offering a choice means rewriting tokens at runtime or editing the
 * global stylesheet, and neither is something a settings panel should do.
 */
export function AppearancePanel() {
  return (
    <Panel>
      <SettingsBlock label="Interface theme">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">Interface theme</p>
          <p className="text-muted-foreground text-sm">
            Choose how Flexprice looks. System follows your device. Remembered on this device.
          </p>
        </div>
        <ThemePreferenceCards label="Interface theme" />
      </SettingsBlock>
      <SettingsBlock label="Shortcut" flush>
        <SettingsFieldGroup legend="Shortcut" description="Switch theme from anywhere.">
          <SettingRow
            title="Switch theme"
            description="Flip between light and dark without opening Settings."
            last
          >
            <kbd className="bg-muted text-muted-foreground rounded-md border px-2 py-1 font-sans text-xs">
              ⌘D / Ctrl+D
            </kbd>
          </SettingRow>
        </SettingsFieldGroup>
      </SettingsBlock>
    </Panel>
  )
}
