# OpenHands Cold Review — operator setup

The workflow `.github/workflows/cold-review.yml` reviews non-draft, same-repo PRs
(opened / ready_for_review / synchronize / `review-this` label) as
`openhands-cold-review[bot]`. It will fail until the environment secrets and the
GitHub App below exist. Do not treat a failed run as the wet-run.

## Already prepared in this repo

- Label `review-this` (apply to an existing PR to request a review)
- Environment `openhands-review` (empty until you set the values below)

## Secrets and variables (environment `openhands-review`)

Set these on **RobotOverview → Settings → Environments → openhands-review**.
Do not put them in repository-level secrets.

| Kind | Name | Value |
| --- | --- | --- |
| Secret | `CODEX_AUTH_JSON_B64` | `base64` of `~/.codex/auth.json` after device login |
| Secret | `OPENHANDS_COLD_REVIEW_PRIVATE_KEY` | PEM private key of the GitHub App |
| Variable | `OPENHANDS_COLD_REVIEW_APP_ID` | Numeric GitHub App ID |

## 1. Codex device login + xhigh

On a trusted machine with the Codex CLI (ChatGPT subscription, not an API key):

1. `codex login --device-auth`
2. Enable **xhigh** in Codex settings. The workflow asks for `gpt-5.6-luna/xhigh`;
   without xhigh the model silently degrades.
3. Encode the auth file and paste it as the environment secret:

   ```bash
   base64 -w0 ~/.codex/auth.json
   ```

Token refresh rewrites `auth.json` on the ephemeral runner; that copy is discarded.
First auth failure on a previously-working setup means rotate `CODEX_AUTH_JSON_B64`,
not debug the workflow.

## 2. GitHub App "OpenHands Cold Review"

Create at
[New GitHub App](https://github.com/organizations/MooseGooseConsulting/settings/apps/new)
(expected slug `openhands-cold-review`, posts as `openhands-cold-review[bot]`).
No existing org app is reusable — live `cold-claude-code` is only
contents/issues/PRs, and we are not widening it.

Click path:

1. GitHub App name: `OpenHands Cold Review`. Homepage:
   `https://github.com/MooseGooseConsulting/RobotOverview`.
2. Webhook: **uncheck Active**. Leave the URL empty. Actions is event delivery.
3. Repository permissions — **38 of 39, everything except Single file**,
   nearly all **Read and write**:
   Actions, Administration, Agent secrets, Agent tasks, Agent variables,
   Checks, Codespaces (incl. lifecycle admin and secrets), Commit statuses,
   Contents, Dependabot alerts and secrets, Deployments, Discussions,
   Environments, Issues, Metadata (read), Packages, Pages, Projects: Admin,
   Pull requests, Repository security advisories, Secret scanning alerts and
   bypass/dismissal requests, Secrets, Variables, Webhooks, Workflows.
4. Organization permissions — same withhold list as the *intent* of
   `cold-claude-code` (not its live four-scope install): grant org Secrets,
   Self-hosted runners, Webhooks, custom org/repo roles, Organization
   credentials, org Projects: Admin, and Dependabot/code-scanning/secret-scanning
   dismissal and bypass (Read and write). **Withhold:** org Administration
   (member management), Members, Blocking users, personal-access-token
   management, GitHub Copilot Business, Models, API Insights,
   organization-level Codespaces/secrets management.
5. Create the app. Generate a private key. Copy the numeric App ID.
6. Install **only** on `MooseGooseConsulting/RobotOverview`. Do not install
   org-wide. GitHub will show a scary permission review — expected.
7. If GitHub shows “Permission updates requested,” approve it on the org
   installation before the wet-run.

Then paste App ID into `OPENHANDS_COLD_REVIEW_APP_ID` and the PEM into
`OPENHANDS_COLD_REVIEW_PRIVATE_KEY` on environment `openhands-review`.

Optional Doppler `homelab/dev` copy of those **names** only — do not reuse
`CODEX_GITHUB_*`.
