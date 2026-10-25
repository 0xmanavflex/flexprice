# ReUI components for Flexprice

`✅` installed · `➕` to add

---

## ReUI components

All 22 are free. Install with `npx shadcn@latest add @reui/<name>`.

| | Component | Used for |
|---|---|---|
| ✅ | `badge` | Statuses, counts, type chips |
| ✅ | `data-grid` | Every list screen |
| ✅ | `stepper` | Subscription and plan wizards |
| ✅ | `frame` | Bordered content groups |
| ✅ | `rating` |: |
| ➕ | `alert` | Page and inline callouts |
| ➕ | `filters` | Filter builder on list screens |
| ➕ | `icon-tile` | Source marks, list row media |
| ➕ | `icon-stack` | Empty-state illustrations |
| ➕ | `number-field` | Prices, quantities, tiers, credits, limits |
| ➕ | `date-selector` | Invoice ranges, revenue periods, billing anchors |
| ➕ | `timeline` | Invoice, subscription and payment history |
| ➕ | `code-block` | Event payloads, webhook bodies, API snippets, config values |
| ➕ | `autocomplete` | Customer, feature and plan pickers |
| ➕ | `sortable` | Tier order, entitlement display order |
| ➕ | `tree` | Groups, nested entitlements |
| ➕ | `cascader` | Dependency of `filters` |
| ➕ | `scrollspy` | Section nav on long editors |
|: | `event-calendar` | |
|: | `gantt` | |
|: | `kanban` | |
|: | `phone-input` | |

---

## shadcn registry items

Install with `npx shadcn@latest add <name>`.

### Installed

`avatar` · `breadcrumb` · `button` · `button-group` · `card` · `checkbox` ·
`dialog` · `dropdown-menu` · `field` · `input` · `input-group` · `item` · `kbd` ·
`label` · `popover` · `progress` · `radio-group` · `scroll-area` · `select` ·
`separator` · `sheet` · `sidebar` · `skeleton` · `spinner` · `table` · `tabs` ·
`textarea` · `tooltip`

### To add

| | Item | Used for |
|---|---|---|
| ➕ | `chart` | Revenue, usage and forecast charts |
| ➕ | `combobox` | Searchable selects |
| ➕ | `calendar` | Date fields |
| ➕ | `switch` | Boolean settings |
| ➕ | `toggle-group` | Segmented controls |
| ➕ | `collapsible` | Advanced sections |
| ➕ | `accordion` | Grouped settings |
| ➕ | `alert-dialog` | Archive, delete, terminate confirmations |
| ➕ | `empty` | Empty states |
| ➕ | `sonner` | Toasts |
| ➕ | `slider` | Range inputs, preview scrubbing |
| ➕ | `native-select` | Compact selects in dense rows |
| ➕ | `pagination` | Standalone pagination |

---

## Blocks

| | Block | Plan | Used for |
|---|---|---|---|
| ✅ | `app-shell-3` | pro | Sidebar, header, navigation |
| ✅ | `auth-18` | pro | Sign in, reset, invitation |

---

## npm dependencies

`recharts` · `@tanstack/react-table` · `@tanstack/react-virtual` ·
`@base-ui/react` · `@dnd-kit/core` · `@dnd-kit/modifiers` · `@dnd-kit/sortable` ·
`@dnd-kit/utilities` · `class-variance-authority` · `cn` · `date-fns` ·
`react-day-picker` · `sonner` · `lucide-react` · `next-themes` · `shiki`

---

## Install

```bash
# ReUI
pnpm ui:add alert filters icon-tile icon-stack number-field date-selector \
            timeline code-block autocomplete sortable tree scrollspy

# shadcn
pnpm ui:add chart combobox calendar switch toggle-group collapsible accordion \
            alert-dialog empty sonner slider native-select pagination
```
