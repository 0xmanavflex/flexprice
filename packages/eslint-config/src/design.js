/**
 * The design rules in `docs/design-rules.md` that a machine can check.
 *
 * Each rule is its own name in a small local plugin (`design/*`) rather than
 * another entry in `no-restricted-syntax`. Flat config replaces a rule's whole
 * option list per file (see the note at the top of `architecture.js`), so a
 * file-scoped exception to one check would otherwise silently switch off every
 * other check that shares the rule name. With one name per rule, an exception
 * is exactly as wide as it says.
 *
 * ## The legacy lists
 *
 * Some rules start with files that already break them. Those are listed by
 * path in `LEGACY` below so lint stays at `--max-warnings 0` without blessing
 * the pattern. A list only ever shrinks: fix a file, delete its line. Never add
 * a new file to it; a new exception is an `eslint-disable-next-line` at the
 * point of use with a `-- reason`, which review sees.
 */

/**
 * A rule that reports every node matching one of `selectors`.
 *
 * @param {string} description
 * @param {Array<{ selector: string, message: string }>} selectors
 */
function selectorRule(description, selectors) {
  return {
    meta: { type: 'problem', docs: { description, url: 'docs/design-rules.md' }, schema: [] },
    create(context) {
      return Object.fromEntries(
        selectors.map(({ selector, message }) => [
          selector,
          (node) => context.report({ node, message }),
        ]),
      )
    },
  }
}

const RULES_DOC = 'See docs/design-rules.md.'

/** Hand-built controls where a kit part exists. */
const noHandBuiltControls = selectorRule('Pages use kit controls, not raw HTML controls', [
  {
    selector: "JSXOpeningElement[name.name='table']",
    message: `Do not hand-build a table in a page. Use EntityList (lists) or SimpleTable (inside a Section). ${RULES_DOC}`,
  },
  {
    selector: "JSXOpeningElement[name.name='button']",
    message: `Do not hand-build a <button>. Use Button from @ui/components/primitives/button (variant outline/ghost/link for anything that is not the page's main create action). ${RULES_DOC}`,
  },
  {
    selector: 'JSXOpeningElement[name.name=/^(input|select|textarea)$/]',
    message: `Do not hand-build form controls. Use Field with the primitives Input / Textarea / OptionSelect / OptionCombobox, inside FormDialog, FormCard or EditableCard. ${RULES_DOC}`,
  },
])

/** Colour that bypasses the tokens. */
const HEX = '#[0-9a-fA-F]{3,8}\\b'
const COLOUR_FN = '\\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\\('
const ARBITRARY_COLOUR =
  '\\b(?:text|bg|border|ring|fill|stroke|from|via|to|outline|decoration|divide|shadow|accent|caret)-\\[(?:#|rgb|hsl|oklch|oklab|color:)'
const colourMessage = `Colours come from the theme tokens in packages/ui/src/styles.css (text-muted-foreground, bg-muted, text-primary, text-success, text-destructive…). No hex, rgb()/oklch() values or arbitrary colour classes, and no new theme. ${RULES_DOC}`
const noLiteralColour = selectorRule('Pages and compositions take colour from tokens only', [
  ...[HEX, COLOUR_FN, ARBITRARY_COLOUR].flatMap((re) => [
    { selector: `Literal[value=/${re}/]`, message: colourMessage },
    { selector: `TemplateElement[value.raw=/${re}/]`, message: colourMessage },
  ]),
])

/** Styling that lives outside the component. */
const noStylesheets = selectorRule('No stylesheets or style tags in pages and compositions', [
  {
    selector: 'ImportDeclaration[source.value=/\\.(css|scss|sass|less)$/]',
    message: `Do not add or import a stylesheet. Tokens live in packages/ui/src/styles.css only; style with Tailwind token classes on kit components. ${RULES_DOC}`,
  },
  {
    selector: "JSXOpeningElement[name.name='style']",
    message: `Do not inline a <style> block. Style with Tailwind token classes on kit components. ${RULES_DOC}`,
  },
])

/** Every item in a row or header menu leads with an icon. */
const menuItemIcon = selectorRule('Every menu item has an icon', [
  {
    selector:
      "ObjectExpression:has(> Property[key.name='onSelect']):has(> Property[key.name='label']):not(:has(> Property[key.name='icon']))",
    message: `Every row-menu and header-menu item has an icon: add icon: <PencilIcon aria-hidden /> (from @ui/icons). ${RULES_DOC}`,
  },
])

/**
 * A section's header action is secondary: outline, never the filled primary.
 * The filled button is reserved for the page's one create action (PageHeader
 * `action`, EntityList `primaryAction`).
 */
const SECTION_BUTTON =
  "JSXOpeningElement[name.name='Section'] > JSXAttribute[name.name=/^(action|actions|titleAction)$/] JSXOpeningElement[name.name='Button']"
const sectionMessage = `A Section's header action is secondary: use <Button variant="outline">. The filled primary is only for the page's main create action (PageHeader action / EntityList primaryAction). ${RULES_DOC}`
const sectionActionVariant = selectorRule('Section actions are outline buttons', [
  {
    selector: `${SECTION_BUTTON}:not(:has(JSXAttribute[name.name='variant']))`,
    message: sectionMessage,
  },
  {
    selector: `${SECTION_BUTTON}:has(JSXAttribute[name.name='variant'][value.value='default'])`,
    message: sectionMessage,
  },
])

export const designPlugin = {
  meta: { name: 'design' },
  rules: {
    'no-hand-built-controls': noHandBuiltControls,
    'no-literal-colour': noLiteralColour,
    'no-stylesheets': noStylesheets,
    'menu-item-icon': menuItemIcon,
    'section-action-variant': sectionActionVariant,
  },
}

const PAGES = 'packages/ui/src/pages/**/*.{ts,tsx}'
const COMPOSITIONS = 'packages/ui/src/compositions/**/*.{ts,tsx}'
const NOT_STORIES_OR_TESTS = ['**/*.stories.tsx', '**/*.test.{ts,tsx}']

/**
 * Files that broke a rule before it existed. Shrink only; see the top of this
 * file.
 */
export const LEGACY = {
  'no-hand-built-controls': [
    'packages/ui/src/pages/auth/RegionField.tsx',
    'packages/ui/src/pages/auth/ReviewPanel.tsx',
    'packages/ui/src/pages/auth/SetPasswordForm.tsx',
    'packages/ui/src/pages/auth/SignInForm.tsx',
    'packages/ui/src/pages/auth/SignInScreen.tsx',
    'packages/ui/src/pages/auth/SignUpScreen.tsx',
    'packages/ui/src/pages/billing/credit-notes/CreditNoteDetailView.tsx',
    'packages/ui/src/pages/billing/invoices/InvoiceDetailView.tsx',
    'packages/ui/src/pages/contracts/SubscriptionForm.tsx',
    'packages/ui/src/pages/customer-portal/PortalDialogs.tsx',
    'packages/ui/src/pages/customer-portal/PortalInvoiceSheet.tsx',
    'packages/ui/src/pages/customer-portal/PortalUsage.tsx',
    'packages/ui/src/pages/customers/CustomerWalletView.tsx',
    'packages/ui/src/pages/customers/SubscriptionCard.tsx',
    'packages/ui/src/pages/customers/WalletLedgerTable.tsx',
    'packages/ui/src/pages/developers/events/EventDetailSheet.tsx',
    'packages/ui/src/pages/developers/events/EventTrace.tsx',
    'packages/ui/src/pages/developers/exports/ExportFlow.tsx',
    'packages/ui/src/pages/developers/webhooks/WebhookEventCatalog.tsx',
    'packages/ui/src/pages/product-catalog/charges/ChargeFlags.tsx',
    'packages/ui/src/pages/product-catalog/entitlements/MeteredEntitlementFields.tsx',
    'packages/ui/src/pages/product-catalog/plans/PlanAiSetupView.tsx',
    'packages/ui/src/pages/selfBilling/AccountStatus.tsx',
    'packages/ui/src/pages/selfBilling/CheckoutReturnView.tsx',
    'packages/ui/src/pages/settings/settings/SettingsShell.tsx',
  ],
  'menu-item-icon': [
    'packages/ui/src/pages/contracts/SubscriptionDetailView.tsx',
    'packages/ui/src/pages/developers/exports/ExportFlow.tsx',
    'packages/ui/src/pages/developers/webhooks/WebhookEndpointDetail.tsx',
    'packages/ui/src/pages/product-catalog/charges/ChargeTable.tsx',
  ],
}

/**
 * Where a raw colour is the content, not styling: chart and meter encodings
 * (as in `uiStyleExemptions`), country flags, card-network marks, the
 * appearance previews that draw each theme, and the customer portal's
 * merchant brand colour. Permanent, not legacy.
 */
const COLOUR_IS_CONTENT = [
  'packages/ui/src/pages/shared/charts*.{ts,tsx}',
  'packages/ui/src/pages/shared/viz*.{ts,tsx}',
  'packages/ui/src/pages/shared/{ArcGauge,HalfDonut,PillColumns,QuotaCard,SegmentMeter,Metric}*.{ts,tsx}',
  'packages/ui/src/pages/auth/RegionField.tsx',
  'packages/ui/src/pages/customer-portal/CardLogo.tsx',
  'packages/ui/src/pages/customer-portal/PortalShell.tsx',
  'packages/ui/src/pages/settings/settings/AppearanceSettings.tsx',
]

const on = (rule) => ({ [`design/${rule}`]: 'error' })

export const designRules = [
  { plugins: { design: designPlugin } },
  {
    // `pages/shared` is the kit itself: it is where the controls get built.
    files: [PAGES],
    ignores: [
      ...NOT_STORIES_OR_TESTS,
      'packages/ui/src/pages/shared/**',
      ...LEGACY['no-hand-built-controls'],
    ],
    rules: on('no-hand-built-controls'),
  },
  {
    files: [PAGES, COMPOSITIONS],
    ignores: [...NOT_STORIES_OR_TESTS, ...COLOUR_IS_CONTENT],
    rules: on('no-literal-colour'),
  },
  {
    files: [PAGES, COMPOSITIONS],
    rules: on('no-stylesheets'),
  },
  {
    files: [PAGES],
    ignores: [...NOT_STORIES_OR_TESTS, ...LEGACY['menu-item-icon']],
    rules: on('menu-item-icon'),
  },
  {
    files: [PAGES],
    ignores: NOT_STORIES_OR_TESTS,
    rules: on('section-action-variant'),
  },
]

export default designRules
