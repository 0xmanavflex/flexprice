# Contract browser parity run — 6 November 2026

This run submits forms through V1 and V2 browsers. Earlier direct API probes are separate evidence. Environment: Harshit's home, `env_01M1DQKFMP700552AXFSWFJ032`. Only isolated QA customer contracts are mutated. V1 source is not changed.

## Creation matrix

| Scenario | V1 | V2 | Persisted comparison / finding |
| --- | --- | --- | --- |
| Mixed monthly USD, fixed quantity 3, two usage charges, commitment25/month, overage1.5, true-up, coupon10%, NET15, anniversary immediate | Created in browser: `subs_01M6R8VRA1SY7BNRP740A1XYV7` | Created in browser: `subs_01M6R8W5YNPJ7KW1XYBPEDXBVN` | Both previews subtotal55, discount5.50, due49.50. V1 detail shows commitment25 and overage1.5. V2 fixed row incorrectly says Price changed for quantity-only override; investigate mapping. |

## Confirmed candidates for follow-up

- V1 creation's entitlement Add opens the featureless spending-allowance dialog, confirmed in current V1 source. V2 hides this unavailable allowance capability intentionally; this is not evidence of a missing arbitrary-feature creation action.
- V1 future two-phase contract created through browser: `subs_01M6R93ST7HQSTGMNBDNDCJVB6`, Nov20–Dec1 and Dec1–Dec20. V1 phased-draft save rejected explicitly; overlapping phase save had no visible feedback. V2 phase entry point missing in single-phase view; restoration in progress.
- V2 auto-invoice threshold disabled for the current plan/environment; verify availability policy before calling it missing.

## Verification limits

The remaining requested scenario matrix is in progress. No read-only-role account has been established; role behavior must not be claimed live-tested. Browser form submission alone is not considered proof of every persisted field.
