# Mock Mode

Mock mode lets you run the beneficiary workflow without a Pega environment, OAuth client, or real case data.

## Enable it

Set this in `.env`:

```env
VITE_MOCK_MODE=true
```

Then restart the Vite development server:

```bash
npm run dev
```

Vite environment variables are evaluated when the application is built, so changing `.env` requires a restart.

## What it mocks

When `VITE_MOCK_MODE=true`, the application replaces the browser `fetch` implementation with a local Pega-compatible adapter. The normal React workflow is still used.

The mock adapter covers:

1. OAuth client-credentials authentication and a bearer access token.
2. The `D_GetWorkListOnAssignment` worklist request.
3. Case-detail retrieval.
4. Assignment/view metadata retrieval.
5. Form submission.
6. Attachment uploads.

## Demo flow

The mock workflow uses case `MOCK-BEN-1001` and opens a claimant form populated with sample values. You can edit the fields and submit the assignment without any external API calls.

The mock token is deliberately synthetic and must never be treated as a real credential.

## Disable it

Set:

```env
VITE_MOCK_MODE=false
```

or remove the variable. The application then uses the configured Pega OAuth and API endpoints normally.

## Tests

The mock adapter has Vitest coverage for token generation, worklist retrieval, case details, assignment metadata, attachment uploads, successful submission, and unknown endpoints.
