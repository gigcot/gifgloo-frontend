# EXP-001 tracking

Experiment: https://app.notion.com/p/3e5920d3d9998184b562e08ddd6b0da6

## Responsibility boundaries

- `shared/lib/campaign-attribution.ts`: browser-only campaign storage; no API or domain dependency.
- `shared/lib/umami.ts`: attaches campaign properties to existing custom events, including queued events.
- `features/auth/ui/CallbackHandler.tsx`: records the existing server redirect's new-user signal separately from the welcome UI flag.
- `shared/ui/UmamiIdentity.tsx`: waits for the existing authenticated user ID before submitting the pending signup event after callback navigation.
- No backend, domain, port, database schema, credit policy, or payment behavior changes.

## Semantics

The first non-empty `utm_campaign` in a tab wins. Only `utm_source`, `utm_medium`, `utm_campaign`, and `utm_content` are retained (100 characters each). Session storage preserves them across same-tab OAuth redirects and reloads. No full URL, email, photo, or new user identifier is added to event data. Existing Umami identity remains unchanged.

These are **custom event properties**, not rewritten page URLs or native UTM fields. A dashboard's native UTM filter must not be assumed to match later events without query parameters. Use event properties or a verified visitor cohort for follow-up analysis.

`signup_completed` is a browser-observed signup signal, not authoritative account creation. It requires the existing `is_new_user=true` callback signal and authenticated user ID. Deduplication is per account per tab session. It does not grant credit. Actual signup counts must be checked against backend records.

Browser event attribution does not persist across tabs, devices, or browser restarts. LoginModal also sends the preserved acquisition to OAuth start; the backend stores it on newly created users only. That durable signup attribution supports subsequent account-based analysis, but does not automatically populate Umami's campaign fields on other devices. Existing tracker timeout/ad-blocking may drop events, including a signup already marked as queued. Credit consumption, refunds, expirations, test payments, and repeat composition still need backend-based analysis.

## Verification

`npx playwright test tests/e2e/campaign-signup.spec.ts tests/e2e/home-media-performance.spec.ts`

Checks callback campaign survival, first-touch preservation, signup deduplication across reloads, returning-login exclusion, later photo event attribution, and existing identity/auth behavior. Umami script requests are blocked and the tracker is mocked; these tests send no analytics to production.

`npx tsc --noEmit`

Targeted ESLint checks cover changed source and test files. Production delivery must be verified after deployment; this change is not deployed.

## First-experience instrumentation checks

Event definitions and denominator rules live in the [measurement checklist](https://app.notion.com/p/3ed920d3d9998190bb80f4d0b125a724), not in this test guide.

Build safely against the mocked API and mark custom events as internal:

```sh
NEXT_PUBLIC_API_BASE=http://localhost:8000 NEXT_PUBLIC_ANALYTICS_INTERNAL=true npm run build
E2E_PRODUCTION=true npx playwright test tests/e2e/anonymous-first-experience.spec.ts --project=chromium
```

The default suite blocks the real tracker. It covers both GIF-clear controls, aggregate consent readiness and save failures, frame-confirmation cancel/continue under the same attempt, unrelated 422 errors, and the home-to-result flow. Cross-browser checks use `E2E_CROSS_BROWSER=true` with `--project=firefox --project=webkit`.

Only run the following with authorization to send synthetic QA events to the configured Umami website:

```sh
E2E_PRODUCTION=true LIVE_UMAMI=true npx playwright test tests/e2e/anonymous-first-experience.spec.ts --grep 'live Umami receives' --project=chromium --workers=1 --output=./test-results/umami-live
```

The opt-in test leaves the real Umami script active but fulfills all backend/synthesis calls locally. It uses a synthetic user, `traffic_type=internal`, a unique `qa_measurement_...` campaign and a localhost hostname; custom events without the internal marker are blocked. Browser metadata and QA events are sent to Umami. Native pageviews do not carry the custom traffic marker: exclude the local hostname as well as internal events when reading real user traffic. Do not rebuild/deploy a public release with `NEXT_PUBLIC_ANALYTICS_INTERNAL=true`.

HTTP acceptance and dashboard appearance are separate checks. The test reports the QA campaign, flow ID and accepted event count, and attaches sanitized receipts to reporters that preserve attachments. Check the dashboard's Events and Properties tabs separately; raw event or visitor counts are not a deduplicated `flow_id` funnel.
