import { SettingRow, SettingsFieldGroup, ThemeToggle } from '@fp/ui/compositions'
import { Panel, SettingsBlock } from './panelKit'

/**
 * Theme.
 *
 * One control, and it is the control already in the shell header rather than a
 * second one wired to its own state. `ThemeProvider` (mounted in `main.tsx`)
 * owns the choice and persists it; two toggles reading one provider agree by
 * construction, whereas two toggles with two states disagree the moment
 * somebody uses the other one.
 *
 * Deliberately not padded out. A settings section with one honest control is
 * better than one with a density slider and an accent-colour picker that do
 * nothing — and this console has no per-user customisation to offer beyond the
 * theme, by design.
 */
export function AppearancePanel() {
  return (
    <Panel>
      <SettingsBlock label="Theme" flush>
        <SettingsFieldGroup legend="Theme" description="Light or dark, remembered on this device.">
          <SettingRow title="Appearance" description="Light or dark, remembered on this device." last>
            <ThemeToggle />
          </SettingRow>
        </SettingsFieldGroup>
      </SettingsBlock>
    </Panel>
  )
}
