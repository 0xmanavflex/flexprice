import type { Preview } from '@storybook/react-vite'
import '../src/styles.css'
import './preview.css'

// Under an automated browser (the story test run) switch motion off. Dialogs,
// popovers and menus fade in; on a slow CI runner `toBeVisible` and axe would
// catch them half-way and fail a story that is correct. People opening the
// workbench keep the real animations.
if (typeof navigator !== 'undefined' && navigator.webdriver) {
  const style = document.createElement('style')
  style.textContent =
    '*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition-duration: 0s !important; transition-delay: 0s !important; scroll-behavior: auto !important; }'
  document.head.append(style)
}

const preview: Preview = {
  // Every story also generates a docs page from its props and TSDoc, so the
  // workbench documents the component library, not only exercises it.
  tags: ['autodocs'],
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/ } },
    a11y: {
      // Fail the test run, rather than leaving a panel for somebody to read.
      // A data grid is exactly the component where an accessibility regression
      // hides behind a visually convincing implementation.
      test: 'error',
    },
    // The sidebar reads top to bottom like the product: where to start, the
    // design tokens, the generic building blocks, then the app itself, one
    // folder per sidebar area in the console's nav order (see
    // apps/console/src/app/shell/navigation.ts). Inside an entity the full-page
    // story comes first, then its parts. Every story file sets an explicit
    // `title`; src/README.md maps each folder to its section here.
    options: {
      storySort: {
        order: [
          'Start here',
          'Design system',
          ['Colors', 'Typography', 'Radius & elevation', 'Page map'],
          'Building blocks',
          [
            'Layout',
            [
              'Page',
              'Section',
              'FitToWindow',
              'ContextualSection',
              'ResourceNavigation',
              'ConnectorCard',
            ],
            'Forms',
            [
              'FormPage',
              'FormCard',
              'FormToolbar',
              'FormDialog',
              'FormKit',
              'FormSteps',
              'WorkflowStepper',
              'FormActions',
              'FormDisclosure',
              'FormPreview',
              'Field',
              'InlineField',
              'DateInput',
              'OptionSelect',
              'OptionCombobox',
              'CheckboxRow',
              'LabelWithHint',
              'InfoHint',
              'EditableFields',
              'EditableCard',
            ],
            'Tables & lists',
            [
              'EntityList',
              'DetailTable',
              'GridToolbar',
              'GridFooter',
              'FilterBar',
              'SortMenu',
              'SortableList',
              'Toolbar',
              'Cells',
              'RowActionsMenu',
              'DetailList',
            ],
            'Detail pages',
            [
              'DetailShell',
              'DetailHeader',
              'DetailKit',
              'EntityHeader',
              'DetailStats',
              'MetadataCard',
              'MetricRail',
            ],
            'Feedback & states',
            [
              'EmptyState',
              'GuidedEmptyState',
              'SectionEmpty',
              'BlurredEmpty',
              'States',
              'AppFailure',
              'ConfirmDialog',
            ],
            'Charts & metrics',
            [
              'ChartBox',
              'Metric',
              'MetricChart',
              'ArcGauge',
              'HalfDonut',
              'PillColumns',
              'SegmentMeter',
              'SplitMeter',
              'UsageMeter',
              'QuotaCard',
              'StatCards',
              'TrendBadge',
              'Money',
              'StatusBadge',
            ],
            'Shell',
            [
              'AppShell',
              'ShellNav',
              'ShellAccount',
              'ShellBreadcrumb',
              'ShellDetailTrail',
              'ShellCreateMenu',
              'ShellSearch',
              'ShellPromoCard',
              'EnvironmentSwitcher',
              'ThemeProvider',
              'ThemeToggle',
              'ThemeShortcut',
            ],
          ],
          'App',
          [
            'Home',
            ['Home', 'Home dashboard'],
            'Customers',
            [
              'Customer list',
              'Customer detail',
              'Customer table',
              'Customer detail view',
              'Customer form',
              'Customer analytics',
              'Customer events',
              'Customer wallet',
              'Customer tax section',
              'Contract card',
            ],
            'Product catalog',
            [
              'Products',
              [
                'Product list',
                'Product detail',
                'Product table',
                'Product detail view',
                'Product form',
                'Clone product dialog',
              ],
              'Plans',
              [
                'Plan list',
                'Plan detail',
                'Plan table',
                'Plan form',
                'Plan charges',
                'Add charge dialog',
                'Plan entitlements',
                'Plan credit grants',
                'Plan preview card',
                'Plan customer preview',
              ],
              'Add-ons',
              ['Add-on table', 'Add-on form', 'Add-on contracts'],
              'Pricing widgets',
              ['Pricing widget'],
              'Charges',
              ['Charge table', 'Charge form', 'Tier table', 'Price override form'],
              'Entitlements',
              ['Entitlement table', 'Entitlement form', 'Metered entitlement fields'],
              'Credit grants',
              ['Credit grant table', 'Credit grant form'],
              'Catalog detail frame',
            ],
            'Contracts',
            [
              'Contract list',
              'Contract detail',
              'Contract table',
              'Contract form',
              'Contract status badge',
              'Contract revenue',
              'Contract journal',
            ],
            'Billing',
            [
              'Invoices',
              [
                'Invoice list',
                'Invoice detail',
                'Invoice table',
                'Invoice detail view',
                'Invoice form',
                'Billing details block',
              ],
              'Credit notes',
              ['Credit note table', 'Credit note form'],
            ],
            'Collections',
            [
              'Payments',
              ['Payment table', 'Payment form', 'Collections summary', 'Payment status badge'],
            ],
            'Revenue',
            ['Revenue dashboard'],
            'Developers',
            [
              'Webhooks',
              [
                'Endpoint table',
                'Endpoint detail',
                'Endpoint form',
                'Event type picker',
                'Attempt list',
                'Message sheet',
                'Message log',
                'Event catalog',
                'Activity',
              ],
              'Events',
              ['Event table', 'Event detail sheet'],
              'Usage sync',
              ['Usage sync table', 'Usage sync detail sheet'],
              'Exports',
              ['Export table'],
              'Workflows',
              ['Workflow table'],
            ],
            'Integrations',
            ['Integrations'],
            'Settings',
            [
              'Settings',
              ['Settings', 'Settings shell', 'Appearance'],
              'Environments',
              ['Environment form', 'Rename environment form'],
              'Discounts',
              [
                'Discount list',
                'Discount table',
                'Create discount',
                'Discount form',
                'Discount redemptions',
                'Redemption meter',
              ],
              'Taxes',
              ['Tax rate table', 'Tax rate form'],
              'Price units',
              ['Price unit table', 'Price unit form'],
              'Groups',
              ['Group table', 'Group form', 'Group members'],
              'Cost sheets',
              ['Cost sheet table', 'Cost sheet form', 'Cost margin card'],
            ],
            'Sign-in',
            ['Sign-in screen', 'Sign-in form', 'Forgot password form', 'Accept invitation form'],
          ],
        ],
      },
    },
  },
  // Light and dark are both first-class, so any story can be read in either
  // from the toolbar. The app switches themes with a class on <html>; match
  // that here rather than inventing a second mechanism the components would not
  // see.
  globalTypes: {
    theme: {
      description: 'Colour scheme',
      defaultValue: 'light',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      document.documentElement.classList.toggle('dark', context.globals['theme'] === 'dark')
      return Story()
    },
  ],
}

export default preview
