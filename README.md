# Beneficiary Update

Beneficiary Update is a React application for handling a beneficiary information workflow. It provides a frontend for working with case data, collecting additional requirements, updating beneficiary-related information, and submitting changes through backend APIs.

The application is built with React and Vite and is designed to work with a Pega-based API environment.

## What the application does

The application supports a case-driven workflow that includes:

- Loading a beneficiary-related case
- Retrieving case and UI metadata from the backend
- Displaying requirements and beneficiary information dynamically
- Rendering form fields based on backend configuration
- Supporting selectable fields and datasource-backed options
- Handling attachments and uploads
- Submitting updated information
- Handling API errors and displaying useful error messages
- Showing loading, error, and completion states throughout the workflow

Much of the form behaviour is driven by metadata returned from the backend rather than being hard-coded into individual screens.

## Technology stack

- React 19
- Vite 8
- JavaScript (ES modules)
- Vitest for automated tests
- Oxlint for linting
- Docker and Nginx for production builds
- Pega APIs for authentication, case data, assignments, and application metadata

## Requirements

Before running the project locally, make sure you have:

- Node.js 20 or a compatible modern Node.js version
- npm
- Access to the Pega environment used by the application
- Valid API credentials and endpoint configuration

The Docker build uses Node.js 20 Alpine for the build stage, so Node.js 20 is a good local baseline as well.

## Getting started

Clone the repository and install the dependencies:

```bash
git clone https://github.com/aaqib-hafeez-khan-in/Beneficiary-Update.git
cd Beneficiary-Update
npm install
```

Create a local environment file from the example:

```bash
cp .env.example .env
```

On Windows, you can copy the file manually or use:

```powershell
Copy-Item .env.example .env
```

Update `.env` with the values for your environment before starting the application.

Start the development server:

```bash
npm run dev
```

Vite will print the local development URL in the terminal.

## Environment variables

The application reads its configuration from Vite environment variables. The available variables are:

| Variable | Purpose |
| --- | --- |
| `VITE_CLIENT_ID` | OAuth client ID used to authenticate with the backend |
| `VITE_CLIENT_SECRET` | OAuth client secret used by the application configuration |
| `VITE_TOKEN_URL` | OAuth token endpoint |
| `VITE_API_BASE` | Base URL for the main application API |
| `VITE_ASSIGNMENT_API_BASE` | Base URL for assignment-related API calls |
| `VITE_CASE_ID` | Case ID used by the application workflow |

Do not commit real credentials, tokens, client secrets, or environment-specific private configuration to Git. Keep local values in `.env` and use the repository's `.env.example` only as a template.

## Available commands

### Start development

```bash
npm run dev
```

Starts the Vite development server with hot module replacement.

### Create a production build

```bash
npm run build
```

Creates the production bundle in the `dist` directory.

### Preview the production build

```bash
npm run preview
```

Serves the production build locally for verification.

### Run linting

```bash
npm run lint
```

Runs Oxlint against the project.

### Run tests

```bash
npm test
```

Runs the automated test suite once using Vitest.

### Run tests in watch mode

```bash
npm run test:watch
```

Keeps Vitest running and reruns affected tests while files are changed.

### Run the complete local check

```bash
npm run check
```

Runs linting, tests, and the production build in sequence. This is the recommended command to run before opening a pull request.

## Project structure

The project is intentionally kept relatively small, with the main application currently centred around `src/App.jsx`.

```text
Beneficiary-Update/
├── public/                 Static public assets
├── src/
│   ├── App.jsx             Main application and workflow
│   ├── App.css             Application-specific styles
│   ├── index.css           Global styles
│   ├── main.jsx            React entry point
│   ├── components/         Reusable UI components
│   ├── utils/              Reusable application helpers
│   └── test/               Test setup and test utilities
├── tests/                  Automated tests
├── .env.example            Environment variable template
├── Dockerfile              Production container definition
├── index.html              Vite HTML entry point
├── package.json             Scripts and dependencies
└── vite.config.js           Vite configuration
```

Some directories may contain fewer files depending on the current development state of the project.

## Testing approach

Tests focus on behaviour that can be verified independently of the live Pega environment.

The test suite covers reusable application logic such as:

- Case ID encoding
- Status classification
- Status label resolution
- Field metadata lookup
- Field label resolution
- Field option resolution
- Datasource-backed options
- Default claimant type options
- Default relationship options
- API success and error handling
- Requirement row normalization

The project uses Vitest so tests can run quickly without requiring a connection to the external application APIs.

When adding new functionality, prefer testing the behaviour and expected result rather than implementation details.

## Working with the API

The application communicates with backend services configured through the environment variables described above. The exact API behaviour depends on the Pega environment and the case configuration being used.

For local development, make sure the configured OAuth endpoint and API endpoints are reachable from your browser and that the supplied credentials have the permissions required by the application.

If an API call fails, first check:

1. The values in `.env`.
2. Whether the configured Pega environment is available.
3. Whether the OAuth client is valid.
4. Whether the configured case ID exists and is accessible.
5. The browser developer console and network tab for the failing request.

## Docker

The repository includes a multi-stage Dockerfile.

The first stage installs dependencies and creates the Vite production build. The second stage serves the generated files with Nginx.

Build the image with:

```bash
docker build -t beneficiary-update .
```

Run the container with:

```bash
docker run --rm -p 8080:80 beneficiary-update
```

The application can then be accessed through the local port exposed by Docker.

Because Vite environment variables are normally embedded during the frontend build, make sure the required configuration is available at build time when creating a deployment image. Do not assume that changing `.env` after the image has been built will change the already-generated frontend bundle.

## Development guidelines

Keep changes focused and avoid mixing unrelated refactoring with feature work.

When changing form or API behaviour:

- Keep reusable logic in `src/utils/` where practical.
- Avoid duplicating API response handling.
- Prefer small, testable functions for data transformation and metadata handling.
- Add tests for new branches and edge cases.
- Do not depend on live backend responses for unit tests.
- Keep secrets and environment-specific configuration out of source control.

Before submitting a change, run:

```bash
npm run check
```

If the change affects the user interface, also verify the main workflow manually in the development environment.

## Troubleshooting

### Dependencies fail to install

Remove the existing installation and reinstall:

```bash
rm -rf node_modules package-lock.json
npm install
```

On Windows, remove `node_modules` and `package-lock.json` manually if the shell does not support `rm -rf`.

### The application starts but API requests fail

Check the `.env` values and make sure the configured endpoints are correct for the environment you are using. Then inspect the failed request in the browser's Network tab.

### Tests fail locally

Run the test suite directly to see the failing test:

```bash
npm test
```

For a single test file:

```bash
npx vitest run tests/path/to/test-file.test.js
```

### The production build fails

Run linting and the build separately to identify the source of the failure:

```bash
npm run lint
npm run build
```

## Pull requests

Before opening a pull request:

1. Create a branch from the latest `main`.
2. Make the smallest reasonable set of changes.
3. Add or update tests for behavioural changes.
4. Run `npm run check`.
5. Verify important UI flows manually when applicable.
6. Describe the reason for the change and any configuration required to test it.

Pull requests should be reviewable without requiring unrelated changes to be understood first.

## Security

This application uses authentication credentials and communicates with backend services. Never commit real OAuth client secrets or other sensitive credentials to the repository.

If a credential is accidentally committed, treat it as compromised and rotate it rather than simply removing it from the latest commit.
