# Contract browser parity run — 6 November 2026

This run submits forms through V1 and V2 browsers. Earlier direct API probes are separate evidence. Environment: Harshit's home, `env_01M1DQKFMP700552AXFSWFJ032`. Only isolated QA customer contracts are mutated. V1 source is not changed.

## Creation matrix

| Scenario | V1 | V2 | Persisted comparison / finding |
| --- | --- | --- | --- |
| Mixed monthly USD, fixed quantity 3, two usage charges, commitment25/month, overage1.5, true-up, coupon10%, NET15, anniversary immediate | Created in browser: `subs_01M6R8VRA1SY7BNRP740A1XYV7` | Created in browser: `subs_01M6R8W5YNPJ7KW1XYBPEDXBVN` | Both previews subtotal55, discount5.50, due49.50. V1 detail shows commitment25 and overage1.5. Persisted commitment25, overage1.5, true-up enabled and NET15 match. Quantity-only overrides now say Changed here instead of claiming a price change. |

## Confirmed candidates for follow-up

- V1 creation's entitlement Add opens the featureless spending-allowance dialog, confirmed in current V1 source. V2 hides this unavailable allowance capability intentionally; this is not evidence of a missing arbitrary-feature creation action.
- V1 future two-phase contract created through browser: `subs_01M6R93ST7HQSTGMNBDNDCJVB6`, Nov20–Dec1 and Dec1–Dec20. V1 phased-draft save rejected explicitly; overlapping phase save had no visible feedback. V2 phase entry point restored and browser-created `subs_01M6R9FVZTPDTSFBPY824N9RG9`. Both reject phased drafts. Persisted final end dates differed: V1 local midnight (Dec19 18:30Z), V2 UTC midnight (Dec20 00:00Z). Later phase date controls now use time and customer timezone, consistent with the initial contract date controls; fresh browser-created contract `subs_01M6SZCBN3BCB97CV53VZ8KZYD` now persists exactly the V1 boundaries: start `2026-11-19T18:30:00Z`, end `2026-12-19T18:30:00Z`.
- V2 auto-invoice threshold disabled for the current plan/environment; verify availability policy before calling it missing.

## Verification limits

The remaining requested scenario matrix is in progress. No read-only-role account has been established; role behavior must not be claimed live-tested. Browser form submission alone is not considered proof of every persisted field.

## Browser edit verification — resumed 7 November

| Action | Result |
| --- | --- |
| Fixed charge quantity3→4, price10→12 | Both browser previews defer the change to the final instant inside the advance-billed period and create no immediate invoice. Both confirmed. V2 previously rounded timing to a day or defaulted to immediate; exact instants are now preserved. |
| Disable a Boolean entitlement | Both submitted. V1 hides the disabled entitlement. V2 retains the disabled override and its reset action by supplementing the effective-feature response with subscription-owned entitlements. Reset in V2 restored Included. |
| Add-on with quantity2 and price1.50 | V1 submitted in the prior session. V2 submitted on 7 November after fixing nested price/commitment editors discarding quantities and timing. Persisted line quantity2, price1.5; browser upcoming invoice amount3.00. |
| Draft save and activation | Browser-created V1 `subs_01M6R9SE6YCWN5NCJ5VQN57E91` and V2 `subs_01M6R9WSCESC49A1JBTDFY5JWQ`, then activated through their dialogs. Both persisted active. V2 saved drafts now open their detail instead of disappearing behind the default active filter. |

The mixed V1 contract was subsequently converted into a parent with inherited children by concurrent QA activity. Its hierarchy is therefore not a controlled comparison with the standalone V2 mixed contract.

Latest checks: 155 form/detail browser stories passed; UI and console typecheck/lint passed. The earlier benefits/detail run passed 100/101, with the sole stale timing expectation corrected before the 155-story rerun. API readback is saved in `audit-evidence/browser-contract-readback.json`; it contains QA data and no authentication tokens.

The full requested matrix is still incomplete: alternate currencies/cadences, trial/calendar combinations, every lifecycle operation, integration completion and live role restrictions have not all been browser-tested. Existing direct API evidence must not be treated as browser evidence.

Fresh phase retest: the review shows both phases at local midnight, and GET confirms the final end instant matches V1. Seven mocked creation/detail end-to-end journeys and console build also pass.

New display issue observed while reading back the corrected contract: ChargeTable's compact dates force UTC while its tooltip uses the viewer timezone. Thus an actual November20 local-midnight start can display November19 in the row but November20 in the tooltip. Corrected the compact dates to use the viewer timezone, matching their precise tooltip. Browser retest now displays November20 → December1 in both places. The saved phase timestamp is unchanged by this display fix.

Charge date display validation: all 19 ChargeTable stories passed on retry after the first run lost its browser websocket connection (8/19 had completed). UI/console lint and typecheck passed after this change. Browser screenshot `audit-evidence/v2-browser-phases-corrected.png` shows matching local dates.
