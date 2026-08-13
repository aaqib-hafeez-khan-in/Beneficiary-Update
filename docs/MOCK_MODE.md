# Offline Mock Mode

Mock mode lets the Beneficiary Update UI run without a reachable Pega environment.

## Enable it

Copy `.env.example` to `.env` and set:

```env
VITE_MOCK_MODE=true
```

Restart Vite after changing environment variables because Vite exposes them at build/start time.

## What it mocks

Mock mode intercepts browser `fetch` calls before the React application starts and provides an in-memory replacement for the normal API workflow:

1. OAuth client-credentials token request
2. Worklist / case list
3. Case details
4. Assignment view metadata and dynamic form configuration
5. Attachment upload
6. Assignment PATCH submission

The mock token is `mock-access-token-beneficiary-update` and protected mock endpoints require that bearer token, so the authentication path is exercised rather than bypassed.

## Sample workflow

The mock worklist contains one case:

- Case: `MOCK-CASE-1001`
- Assignment: `MOCK-ASG-1001`
- Action: `CollectClaimantDetails`

Opening the case renders a claimant form using mock Pega-style `uiResources`. Editing the fields and submitting the form returns a successful mock response and moves the UI to the existing success state.

Attachments also receive deterministic mock IDs such as `MOCK-ATTACH-<timestamp>`.

## Returning to live APIs

Set:

```env
VITE_MOCK_MODE=false
```

Then restart the development server. The application returns to the normal Pega token and API endpoints without any code changes.

## Safety

Mock mode is frontend-only. It never contacts the configured Pega token, case, assignment, or attachment endpoints while `VITE_MOCK_MODE=true`. It is intended for local development, demonstrations, UI work, and API-outage fallback testing. It must not be treated as a production replacement for the real backend.
