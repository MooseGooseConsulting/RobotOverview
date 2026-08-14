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

Create an org GitHub App named **OpenHands Cold Review** (expected slug
`openhands-cold-review`, posts as `openhands-cold-review[bot]`):

- Permissions: near-blanket, same shape as `cold-claude-code` (38 of 39
  repository permissions except `Single file`, nearly all Read and write;
  org grants with the same withhold list — no member management, no PAT
  admin, no Copilot Business). The Action only *uses* PR/issue write;
  the extra scopes are so later plugin/Canvas/check-run work does not bounce.
- No webhook (GitHub Actions is the event delivery)
- No org seat
- Install **only** on `MooseGooseConsulting/RobotOverview`

Then copy the App ID into `OPENHANDS_COLD_REVIEW_APP_ID` and the generated PEM
into `OPENHANDS_COLD_REVIEW_PRIVATE_KEY`.
