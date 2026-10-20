# Ad Builder

The visual control panel for the ad-building workflow. It is a face, not a brain: it reads and edits each client's Google Sheet control sheet and leaves commands for Claude. It **never** calls the Claude/Anthropic API, Meta or AdManage. All the work (Drive, copy, hooks, ads, Slack reports) stays in Claude, run by the client's ad-builder skill.

```
Vercel app ──reads/edits──▶ Google Sheets ◀──reads/writes── Claude (skill + connectors)
     │                     (master + control sheets)               ▲
     └──── @Claude tag in Slack ─────────────────────────────────────┘
```

## How a button reaches Claude

1. **Slack tag** (fast): the app posts `@Claude run <skill> BUILD for <client>, sheet <link> · command <id>` in the client's channel, under today's parent message when the skill has posted one.
2. **COMMANDS row** (always): the app appends `command_id, requested_at, command, args, by, via, status, slack_ts, …`. Status is `sent_to_slack` or, when Slack failed, `queued` for the scheduled task.
3. **Manual fallback**: the result card offers *Copy prompt* and *Open the Claude chat* (the CLAUDE SETUP link).

Claude sets `running` → `done` / `failed` + a note. While a command is open the app re-reads COMMANDS and the Slack thread every 30 s and refreshes the page when it finishes. If it sits longer than the interval in CLAUDE SETUP + 10 min, the app says "Claude hasn't picked this up yet" with a button to post the tag again.

The skill needs the step in [`skill/COMMANDS-section.md`](skill/COMMANDS-section.md) (add it as section 15).

## What the app reads and writes

| Where | Reads | Writes |
|---|---|---|
| Master sheet, tab `CLIENTS` | `client_id, name, control_sheet_id, drive_root_id, status, added_on, offboarded_on` | appends a row on *Add client*; `status`/`offboarded_on` on *Offboard* |
| `AD APPROVALS` | rows from 6 (row 4 header, row 5 EXAMPLE), A–AU | **B, Y, AO–AS only** (enforced in `lib/columns.ts`) |
| `COPY`, `HOOKS` | rows from 6 | nothing |
| `CLAUDE SETUP` | A1:B60 by label | value column B; appends brand rows |
| `COMMANDS` | A2:L | appends only |

Every write re-reads the cell first. If it changed since the page loaded, nothing is written and the user sees both values and picks. Formula cells and values starting with `=` are refused. The app never deletes a sheet, tab, row or Drive file, and stores nothing outside the sheets (per-request memory cache only).

Status logic (`lib/approvals.ts`) follows section 3b of the skill so the app and Claude agree:
- **Ready**: B = `Building in ads manager`, AT ✓, Z a Drive folder link, Y set, AO–AQ filled, F empty or an Active COPY set.
- **Fix**: the first failing check, or AU has `⚠` / `FAILED:`.
- **Built**: AU starts with `BUILT`, `ADSET_CREATED`, `CAMPAIGN_CREATED` or has `AD_ID:`.

Rows shown: in the build queue, or built in the last 21 days.

## Screens

Home (greeting, days to build day, Ask Claude, This week, Needs you, Last build, Claude requests, Rows) · Row detail (Drive video preview, ad preview from COPY via F, 7-step checklist, fix Y and B, destination AO–AS with the sheet's own dropdowns) · Builds (one card per AU date with ad set and ad IDs, Ads Manager links, warnings, steps) · Claude requests · Settings (CLAUDE SETUP) · Clients (add, offboard, setup checklist). ⌘K searches rows. Phone width stacks the sidebar above the content.

## Setup

1. Google Cloud project with the **Sheets** and **Drive** APIs on, and a service account. Sign-in, either:
   - **Keyless (recommended on Vercel):** a Workload Identity pool with an OIDC provider for Vercel (issuer `https://oidc.vercel.com/<team-slug>`, audience `https://vercel.com/<team-slug>`, condition `assertion.project == '<vercel-project>'`), and `roles/iam.workloadIdentityUser` on the service account for that pool. Set `GCP_PROJECT_NUMBER`, `GCP_WORKLOAD_IDENTITY_POOL_ID`, `GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID`, `GCP_SERVICE_ACCOUNT_EMAIL`. Works even where the org blocks service account keys.
   - **JSON key:** `GOOGLE_SERVICE_ACCOUNT_JSON`.
2. Create the **AD BUILDER CLIENTS** master sheet with a `CLIENTS` tab and the header row above. Share it, every client control sheet (Editor) and every Drive root (Viewer) with the service account email.
3. Optional: a template sheet with `CLAUDE SETUP` and `COMMANDS` tabs (`TEMPLATE_SHEET_ID`). Without it the app creates both tabs itself.
4. Slack app with `chat:write` and `channels:history`, installed and invited to each client channel. Find Claude's Slack user ID for `CLAUDE_SLACK_USER_ID`.
5. Confirm Claude in Slack can run the skill with the Sheets, Drive, AdManage and Slack connectors. If not, leave Slack unset and everything goes through the COMMANDS queue.
6. Add section 15 to the skill and create each client's scheduled task in Claude.
7. Deploy to Vercel with the variables in `.env.example`. `APP_PASSWORD` is required in production (Basic auth, any username; it is logged as "by" on commands). Vercel Deployment Protection can be used on top.

To add the first client, open `/clients` and use *Add client*; the app checks the tabs, adds CLAUDE SETUP and COMMANDS if missing, and shows the checklist.

## Develop

```bash
npm install
npm test            # status logic, AU parsing, CLAUDE SETUP parsing
npm run typecheck
npm run dev
```

`FAKE_SHEETS_FILE=/path/fixture.json` renders against a local JSON fixture shaped like `{ "spreadsheets": { "<id>": { "title": "", "tabs": { "<tab>": [["…"]] } } } }`, with `MASTER_SHEET_ID` set to the fixture's master id. It is ignored in production. Keep fixtures out of the repo: they must not hold client data.

## Layout

```
app/actions.ts               server actions: cell writes, commands, add/offboard client
app/api/c/[id]/commands      polled by the command tracker
app/c/[clientId]/…           Home, rows, row detail, builds, commands, settings
app/clients                  client list, add, offboard
lib/columns.ts               sheet layout and the writable-column allowlist
lib/approvals.ts             AD APPROVALS / COPY / HOOKS parsing and status (pure, tested)
lib/setup.ts, lib/commands.ts  CLAUDE SETUP and COMMANDS (pure, tested)
lib/google.ts, lib/slack.ts  REST wrappers (no SDKs)
lib/writes.ts                re-read-before-write guard
proxy.ts                     Basic-auth password gate
```
