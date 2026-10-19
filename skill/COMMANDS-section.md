## 15 · COMMANDS: requests from the Ad Builder app

The Ad Builder app (Vercel) never calls Claude. When someone presses a button it leaves a command in two places:

- **Slack**, in the client's channel (under today's parent message if there is one):
  `@Claude run <skill> <COMMAND> for <client>, sheet <link>: <args> · command <id> (update its row in the COMMANDS tab)`
- **The COMMANDS tab** of the control sheet, always. Row 1 is the header, data starts at row 2:

```
A command_id · B requested_at (ISO, UTC) · C command · D args · E by · F via (slack|sheet)
G status · H slack_ts · I started_at · J finished_at · K note · L slack_thread
```

`G status` is `sent_to_slack` when the Slack tag went out, `queued` when it didn't (Slack down or not set up).

**At the start of every run** (scheduled task, Slack tag, or the client chat):
1. Read `'COMMANDS'!A2:L500`.
2. Pick what to run, oldest first, one at a time:
   - From a Slack tag: the row whose `command_id` is in the message.
   - From the scheduled task: rows with `queued`, plus rows with `sent_to_slack` whose `requested_at` is older than 2× the CLAUDE SETUP "Command check interval (minutes)" (Claude in Slack missed them).
3. Re-read that row's G right before starting. If it isn't `queued` / `sent_to_slack` any more, skip it (another run took it). Otherwise set **G = `running`** and **I = now (ISO)**.
4. Run it:

| C command | What to do |
|---|---|
| `BUILD` | BUILD mode for every build-scope row (sections 2–11). |
| `CHECK` | DAILY CHECK mode. Never create anything in Ads Manager. |
| `REWRITE_COPY` | D is `row 118` or `rows 113–122`. Run section 6 for those rows even if F is filled: write a **new** COPY row and point F at it. Never edit the old COPY row. Nothing in Ads Manager. |
| `RECHECK_BUILD` | D is a date (`2026-10-16`). For rows whose AU has that date: confirm each ad exists and is PAUSED, re-check video product vs Y, update the ⚠ part of AU. Create nothing. |
| `STATUS` | Post today's status in the client's Slack thread (section 11 format). |
| `ASK` | D is free text from the team. Do it within this skill's rules. If it asks for something outside them (turn ads on, delete, change spend), don't: set `failed` with the reason. |

5. Finish: **G = `done`** or **`failed`**, **J = now (ISO)**, **K = one line, max ~200 characters**: the result (`15 of 15 built, paused. Rows 118, 120: check link`) or, on failure, the reason and the fix. Write as plain text.
6. Post the result in the Slack thread as usual (section 11). If the command came from a Slack tag, reply under that tag.

Rules: never delete, reorder or clear COMMANDS rows. Only write G, I, J and K. The app reads COMMANDS every 30–60 s while a command is open and shows K to the team, so keep K short and specific.

The app also edits these AD APPROVALS cells for people: **B, Y and AO–AS** (it never writes formulas or F, V, Z, AU). Always re-read the rows before acting, as the skill already does.

### CLAUDE SETUP layout the app writes

Label in A, value in B, read by label from `'CLAUDE SETUP'!A1:B60`:

```
Client name · Build day · Timezone · Status after Claude builds · Slack channel ID · Tag on roadblocks
Claude chat to reply in · Skill · Command check interval (minutes)
META AD ACCOUNTS            ← header row
<Brand as in AF> | act_…    ← one row per brand; anything other than exactly one act_ id is unconfirmed
```
