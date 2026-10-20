---
name: ashtel-studios-ad-builder
description: Ashtel Studios ad builder (EVO, Get ARU, Get YAYA, Smart Care). Daily check and Thursday build for the Ashtel Studios control sheet. Organizes creative drops in Drive, matches them to rows, writes copy into the COPY tab, logs hooks, builds PAUSED Meta ads through AdManage, and posts progress and blockers to Slack. Use for any Ashtel Studios ad check, build, "fixed, build them", "continue" or "check" request.
---

# Ashtel Studios Ad Builder

This skill turns rows in a client's control sheet into built, **paused** Meta ads.

It has two modes:
- **DAILY CHECK** runs every day except build day. It organizes new creative drops in Drive and matches them to briefs (section 3), checks every row and reports. It **never creates anything in Ads Manager**.
- **BUILD** runs on build day (Thursday by default) and when the user says "build" in the client's chat. It does everything: copy, hooks, ad sets, ads.

**Golden rule: anything a human has to do goes to Slack, tagged.** Missing or wrong Z, empty AO–AQ, a campaign that doesn't exist, a creative that can't be matched to a brief, a missing ad account, a broken integration: post it in the client's Slack thread with the exact cell(s) to fill and tag the CLAUDE SETUP people. Never leave a blocker only in the chat report. This applies in BUILD, DAILY CHECK *and* manual runs in the client chat.

**"Published" always means published PAUSED.** Every ad, ad set and campaign is created PAUSED. Never ACTIVE.

**Every run starts with the COMMANDS tab (section 15)**: requests the team sent from the Ad Builder app. Run those, then the mode for today.

It usually runs unattended. **Never stall waiting for an answer.** Make the safest reasonable call, build only what is clearly specified, skip anything ambiguous, and **ask in Slack** (tagged, with the exact rows and cells) for everything a person has to decide. Then keep going with the other rows.

### Hard rules: check these on every run, whatever started it

The Ad Builder app repeats this list at the end of every request it sends ("Remember (hard rules of the skill)"). Follow it even when a request arrives without it.

1. **Read first:** read CLAUDE SETUP and the COMMANDS row, then follow this skill's rules for the mode.
2. **Use the right ad account:** each brand (AF) must map to exactly one `act_` in CLAUDE SETUP, and that account's name in AdManage (`list_ad_accounts` / `get_active_connection`) must match the brand. If not, skip that brand and ask in Slack.
3. **PAUSED only:** never turn anything on, never delete, never change budgets on live ads.
4. **Leave formulas and people's input alone:** re-read the rows before writing. Never write C, D, E, G–U, W, AE or AT. Never overwrite what a person typed.
5. **Destinations are looked up live** in Ads Manager (all statuses, exact names). `USE` creates nothing, and `CREATE` creates exactly that, once. Never guess.
6. **Drive:** Z is the creative's own folder. Use real pixel dimensions. Never trash or overwrite a file.
   - **Rows sharing one Drive link:** organize the folder first, then make one row per creative, whatever the number of rows (section 3, 5b).
   - **If Z is only digits** (e.g. `17890123456789012`, or `123456789_987654321`), it is a **creator's post ID**. That row is a **partnership ad** (section 9b), not a Drive creative.
7. **Copy (section 6):**
   - Research the live ads in AdManage and the sheet first.
   - Read the creative, and read the row's 📝 COPY NOTES (AV). If AV is blank, write from the creative alone.
   - Only make claims that appear on the landing page (Y), the brand's site, or in the creative.
   - If Y is empty, propose a URL from the creative and the site, or use the homepage (5b), and include it in the review.
   - Build PAUSED.
   - **Send the copy for review (section 6b).**
8. **Ask the people:** anything a person must do or decide goes in the Slack thread, tagged, and in the chat.
9. **Close the loop:** update the COMMANDS row (G, I, J, K) and post the result in today's Slack thread.

## Ashtel Studios: fixed config (use when CLAUDE SETUP is missing)

The CLAUDE SETUP tab wins if it exists. Until it does, use this:

| Item | Value |
|---|---|
| Control sheet | `18Bl7y3ZU1QdHZHUYQN3H7XW_wlIm8_VtDbyvPQHCEDE` (tab AD APPROVALS) |
| Creative Drive root | `1J9mLeMCbpo4BqAR3fGLXq6Z0lyt_BqPD`, one subfolder per brand |
| Build day / timezone | Thursday · America/Bogota |
| Slack channel | #ad-building-thursday · `C0C9S4EKJ3E` |
| Tag on blockers | `<@U0C24G9D2EP> <@U031L23RUE7>` |
| Status after build (B) | Ask once if unknown; until confirmed, leave B and log in AU only |

| Brand (col X) | Meta ad account | Drive folder | FB Page | Instagram | Default URL |
|---|---|---|---|---|---|
| EVO | `act_970523986836813` | `1muqCs6VxVUnrr_WwnM2r58-lMou0-SAv` | `102774025520539` (EVO) | `17841447370572005` | product pages on getevo.net |
| Get ARU | `act_1494497458618520` ("Aru Toothbrushes") | `12roJRbvim9JPh7cGrJ6R3MAxp8zsht0i` | `355311594330758` (Get ARU) | `17841460838300003` | getaru.com/products/starterkit |
| Get YAYA | `act_2223108644688034` | `1amRXSOWpw7nbzhBKSN_darZhevBW26JL` | find via `get_ad_debug_data` on a live ad | same | — |
| Smart Care US | **unconfirmed:** `act_887644237727522` or `act_1747646876235061` (same name) | `1dAiN6GKkicw-bX1h5n-sGgfNmSjPDkn3` | — | — | — |

Known destinations (verify live before each build, names can change):
- **EVO:** `[MM][Prospecting] ADV+ | Toothbrushes` (`23859928502590058`), source ad set `[MM][Prospecting] ADV+ Ad set` (`23859928502580058`, ABO $96/day). New-briefs ad set `MM_PROSPECTING_NEWBRIEFS` = `120261042138390059`. EVO has ~105 old paused campaigns; the active one is on campaign page 2.
- **Get ARU:** `TOF_STANDARD_STARTERKIT_ABO` (`120249028925860423`), source ad set `StarterKit_Benefits_LearnMoreLP` (`120249583582170423`). New-briefs ad set `MM_PROSPECTING_NEWBRIEFS` = `120249599594590423`. Also live: `TOF_ASC_BROAD`.

Products seen in EVO creatives: Spider-Man kit (`spm-1`, red/black web box), Iron Man kit (`irm-1`, red handle), Black Panther kit (`blp-1-rechargeable-sonic-toothbrush`, black/purple). Use AL = `SpiderManKit` / `IronManKit` / `BlackPantherKit`. EVO has no live ads, so EVO copy comes from the sheet history (strip promo/discount lines).
Copy claims allowed for ARU (from live ads): 15x better plaque removal than manual, 4x less gumline bleeding in 28 days, bristles 20x slimmer, extra-soft, 3 modes, 3 intensities, 45+ days battery, ADA Accepted, travel case.
Copy claims allowed for EVO (from sheet history): sonic toothbrush, multiple modes, waterproof, travel case, lifetime toothbrush warranty, Collector's Edition / Marvel detailing.

---

## The pipeline, per row (BUILD)

Every row goes through these steps in this order. Each one feeds the next:

1. **Drive:** put each creative in its own folder, renamed (section 3) → **update Z** with that folder link. Fill AM so the row is identifiable.
2. **Analyze the creative:** transcript / on-screen text, hook, angle, product (section 5).
3. **Write the copy** from the live ads in the account + the analysis (section 6) → **write it in the COPY tab** → **set F** to its label. Hook → HOOKS tab → **set V** (section 7).
4. **Fill the blank tags** AF–AN, AC, AD and compute the **ad name** (section 8).
5. **Select the destination in AdManage** from AO–AQ (section 4).
6. **Launch in AdManage, PAUSED,** with all four pieces together: **ad name + creative (from the Z folder) + copy (from F) + final URL (Y)** (section 9).
7. **Write back** and post the result in the Slack thread (sections 10–11).

If a step can't finish for a row, stop that row, post the fix in Slack, and keep going with the other rows.

---

## 0 · Where the config lives

Everything client-specific lives **in the sheet**, on the **CLAUDE SETUP** tab. The only thing you need from the user is the sheet link.

| CLAUDE SETUP field | Use |
|---|---|
| Client name | The Slack header and the report title |
| Build day | The weekday that runs BUILD mode. Every other day runs DAILY CHECK. |
| Timezone | Use it for "today" and for the weekday |
| Status after Claude builds | Set column B to this value after a successful build |
| Slack channel ID | Where every post goes |
| Tag on roadblocks | Slack mentions to put on every roadblock message |
| Claude chat to reply in | The link to end roadblock messages with |
| META AD ACCOUNTS | One row per brand: brand name (as in column AF) → `act_…` |
| Skill | This skill's name (the app puts it in its Slack tags) |
| Command check interval (minutes) | How often the scheduled task runs; used to spot COMMANDS that Slack missed |

If CLAUDE SETUP is missing or a field is empty, use what the user gave in the chat, and add "CLAUDE SETUP tab missing / field <x> empty" to the Slack blockers. If a brand name doesn't match exactly one ad account (e.g. two accounts share a name), skip that brand and post both IDs in Slack so a human picks one. If a brand has no ad account, skip its rows and report "No ad account for brand <X> in CLAUDE SETUP".

---

## 1 · Read the sheet

Don't read it with Drive `read_file_content`, because it only returns a sample. Use one of these:
- **Google Sheets connector** (preferred): `get_values` on `'AD APPROVALS'!A4:AU400`, `COPY!A5:AA305`, `HOOKS!A5:Q305`, `META_LIST!A1:E3000` and `'CLAUDE SETUP'!A1:B60` and `'COMMANDS'!A2:L500`.
- **Fallback:** Drive `download_file_content` with `exportMimeType = application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`. Decode the base64 to a file and parse it with openpyxl (`data_only=True` gives you values). Large results are saved to a file, so read the JSON from there.

### AD APPROVALS columns
Row 4 is the header row, row 5 is the EXAMPLE row, and the data starts at row 6. Rows whose A–E cells are merged are section labels. Skip them.

```
A PREVIEW · B STATUS · C Brand(f) · D Ad ID(f) · E Ad name(f)
F COPY SET (pick from COPY) · G–K HEADLINE 1–5(f) · L–P PRIMARY TEXT 1–5(f) · Q–U DESCRIPTION 1–5(f)
V HOOK (pick from HOOKS) · W HOOK TEXT(f)
X CALL TO ACTION · Y WEBSITE URL · Z ASSET LINK / DRIVE · AA BRIEF · AB BRIEF STATUS · AC START DATE · AD END DATE
AE AD NAME(f)
AF Brand · AG Funnel · AH Promo/Activation · AI Offer · AJ Angle/Concept · AK Ad Type · AL Product · AM Differentiation · AN Landing Page
AO ① WHAT DOES CLAUDE DO · AP ② CAMPAIGN · AQ ③ AD SET · AR ④ COPY SETTINGS FROM · AS ⑤ DAILY BUDGET · AT ✓ CHECK(f) · AU BUILD LOG
AV 📝 COPY NOTES
```
- **AR** is the name of an existing **ad set** whose settings get copied. It's only used when AO is CREATE.
- **AS** is only used when creating. Leave it blank on CBO campaigns, where the budget lives on the campaign. If AS has a number and the campaign is CBO, ignore it and say so.
- **AV (📝 COPY NOTES)** holds the team's instructions for that ad's copy. Blank means writing the copy from the creative alone. Older sheets may not have AV yet; treat it as blank.
(f) = formula. **Never write into C, D, E, G–U, W, AE or AT.** Legacy rows have typed copy in G/L/Q and no COPY SET. Leave them alone.

### COPY tab (copy library)
Row 5 is the header row and the data starts at row 6. The columns are: A CODE (`CP001`…, pre-filled) · B COPY NAME · C BRAND · D ANGLE · E STATUS (`Active`/`Retired`/`Legacy`) · F–J results (formulas) · K–O HEADLINE 1–5 · P–T PRIMARY TEXT 1–5 · U–Y DESCRIPTION 1–5 · AA LABEL (formula, `CP001 · name`).
A row is "free" when B is empty. Column F in AD APPROVALS holds the **label**, and its first 5 characters are the code.

### HOOKS tab
Row 5 is the header row and the data starts at row 6. The columns are: A CODE (`H001`…) · B HOOK (exact first line) · C BRAND · D TYPE (the list in Q6:Q30) · E STATUS (`Idea`/`Testing`/`Winner`/`Loser`/`Retired`) · F–J results · K ON-SCREEN TEXT · L VISUAL HOOK · M NOTES · O LABEL (formula, `H001 · text`).
Column V in AD APPROVALS holds the label, and its first 4 characters are the code.

### META_LIST tab
This tab is formulas only. It lists every campaign › ad set pair that has delivered in RAW_META, and it feeds the dropdowns. **Ads Manager is always the source of truth**, because RAW_META misses anything that hasn't spent.

---

## 2 · Which rows are in scope

- **Intake scope** (both modes): rows where B = `Creative Delivered` or `Building in ads manager`, Z holds a Drive link, and AU has no `ORGANIZED:` entry yet. These go through section 3.
- **Build scope**: rows where B = `Building in ads manager` and AU has no `AD_ID:` yet.

In DAILY CHECK mode, also count the pipeline: rows in `BRIEF`, `Creative In Progress` and `Creative Delivered`. Flag any rows that are new since the last report (compare against the previous Slack post in the channel).

---

## 3 · Intake: organize the Drive and match it to the briefs (both modes)

Creatives rarely arrive clean. **Before checking or building, make every row point to exactly one organized creative folder.**

**The target shape:** one folder per creative, holding every dimension of that creative, with the files renamed:
```
<Brand>_<YYYY-MM>_Creative-Drop/
  01_<Differentiation>_<Product>_<Angle>/
      01_<Differentiation>_<Product>_<Angle>_1x1.mp4
      01_<Differentiation>_<Product>_<Angle>_4x5.mp4
      01_<Differentiation>_<Product>_<Angle>_9x16.mp4
  02_.../
```
The standard dimensions are **1x1 (square), 4x5 (feed) and 9x16 (stories/reels)**. Creator and UGC content is often 9x16 only. That's fine: note it, but don't block on it. A file that is actually 4:3 or 16:9 gets labelled `4x3` / `16x9` and flagged in the report.

**Step 1: read what's in the Z link.** List it recursively (AdManage `browse_google_drive`, or Drive `search_files` with `parentId`). For every media file, record its name, its size and its **real pixel dimensions**. Get those from the AdManage listing, or download and run `ffprobe` (video) or PIL (image). **Never trust the filename for the dimension.** Map aspect ratios to labels: 1.0 → `1x1`, 0.8 → `4x5`, 0.5625 → `9x16`, 1.78 → `16x9`, 1.33 → `4x3`, with ±2% tolerance.

**Brand folders:** Z often points to a whole brand folder (e.g. `EVO/` with every video for every brief), shared by many rows. Treat it as a dump: match each file to its row (step 5) and, once matched, point that row's Z at its own creative subfolder. If any file can't be matched with confidence, post the exact list in Slack ("Brief X, rows a–b: is it file1 / file2 / file3?") and skip those rows.

**Step 2: decide what the link is.**
- **Already organized**: one creative, every file the same footage in different dimensions. If the names already follow the target pattern, leave them. Otherwise rename them (step 4).
- **A single file**: one creative with one dimension.
- **A dump**: loose files that are clearly more than one creative (different stems, different footage or durations, different creators), or nested folders that aren't one-per-creative. Organize it (steps 3–4).

**Step 3: group a dump into creatives.** Same creative = same content in different dimensions. Work through these signals in order:
1. The same filename stem once you strip the dimension, version, "final" and "copy" tokens.
2. The same duration (±0.5 s) and a matching transcript or first frame.
3. The same creator, setting and hook.
A different hook, a different edit or a different length counts as a different creative, even from the same creator.

**Step 4: organize in Drive. Never delete anything.**
- In the dump's parent (or the dump itself), create a folder named `<Brand>_<YYYY-MM>_Creative-Drop` if it doesn't exist yet. Inside it, create one subfolder per creative, numbered `01_`, `02_`, ….
- **Drive tools:** create folders with `create_file` (`title`, `parentId`, `contentMimeType = application/vnd.google-apps.folder`). Move and rename in one call with `update_file` (`fileId`, `title = <subfolder name>_<dim>.<ext>`, `parentId = <subfolder id>`). If the move is refused (no edit rights on someone else's file), use `copy_file` with the same `title` and `parentId`, leave the original in place, and note "copied, not moved".
- Then point Z at the **subfolder** link (`https://drive.google.com/drive/folders/<id>`). Make sure it's shared the same way as its parent.
- **Never trash, delete or overwrite a file.** If a name already exists, add `_b`.
- Name each subfolder from what you can see: the creator's name, the product, and a short angle (CamelCase, no spaces).

**Step 5: match the creatives to rows. Decide yourself, never ask.**

**5a. Count creatives, not files.** After step 3, count the *creatives* in the folder (files with the same content in different formats = 1 creative). Example: 4 files where 3 are the same video in 1x1/4x5/9x16 and 1 is a different video = **2 creatives**.

**5b. Rows that share a Drive link: the Drive decides, not the row count.**

**Order matters:** organize the folder first (steps 1–4), then count, then decide the rows. Never decide the rows from how many already exist.

1. **Find the group.** Take every in-scope row whose Z points to the same link, or to that folder's parent or one of its subfolders. Example: rows 81, 82 and 83 all point to the same folder.
2. **Treat the rows as placeholders.** Three rows doesn't mean three ads: the team often copies a row without knowing how many creatives are inside. Work from the creatives the organized folder actually holds (5a).
3. **Assign one creative per row**, in this order:
   - Give each creative to the row whose identifiers match it (5c).
   - Fill the remaining rows of the group in row order.
4. **More creatives than rows in the group:** insert one new row per extra creative, directly below the last row of the group (5e).
5. **Fewer creatives than rows:** the leftover rows get no creative.
   - Don't build them, delete them or clear them.
   - Write `ORGANIZED: no creative left (same Drive as rows <a–b>)` in AU.
   - Slack: "Rows <r>: same Drive as <a–b>, only <n> creatives. Set B to something else or remove the row."

Example: rows 81–83 share a folder that, once organized, holds 5 creatives.
- 81, 82 and 83 get creatives 1–3.
- Two new rows go in below 83 for creatives 4–5.
- If the folder held only 2 creatives, 81 and 82 get them and 83 is reported.

Never ask a human how to split it; only ask when a creative can't be told apart from another brand or product (5e).

**5c. How to assign.** Look for an identifier in every column of the row and match it against the filename, the folder name and what the creative shows/says (section 5 analysis):
AA brief (code, name, angle) · AJ angle · AL product · AM differentiation · Y URL (product handle, e.g. `spm-1`) · AN landing page · AK ad type (video/static).
Use the strongest signal first (brief code/name in the filename > creator name > product in URL/AL vs product seen on screen > angle vs transcript). Each creative goes to exactly one row.
**If nothing tells two rows apart** (same brief, same product, no identifier), assign them in order and that's fine: the row's identity comes from AM (5d).

**5d. Fill AM so every row is identifiable.** If AM is blank or generic (e.g. just `EVO_001`), set it to `<existing AM or Brand_###>_<ShortCreativeDescriptor>`: what makes this creative unique, from the analysis (creator, hook, setting). **No spaces, underscores only, CamelCase words, max ~30 characters.**
Examples: `EVO_001_GabeBathroomRoutine`, `EVO_003_DavidBoringBrushJoke`, `ARU_UGC_VictoriaBleedingGums`.
Never overwrite a specific AM a person typed; only extend a generic one.

**5e. Then:**
- **One creative per row**: set **Z** to that creative's own subfolder link (step 4).
- **One brief row, several creatives** (the team tested several formats, cuts or creators): the first creative stays on the original row. **Insert one new row for each extra creative, directly below the row (or below the last row of the group when several rows share the link, 5b).** Copy B, X, Y, AA, AB, AC, AD and AF–AL from the original row. Set AM per 5d. Set Z to that creative's folder and AO to `SAME AS ROW ABOVE`. Leave F and V empty, so each creative gets its own copy and hook.
- **A creative that truly matches no row in that folder's set** (e.g. a different brand or product): list it in Slack as "Unmatched creative: <file>" and leave it out.

**Step 6: log it.** Write `ORGANIZED:<n> creatives | dims:<…> | <date>` into AU on every row you touched.

Without a Sheets write tool, the Drive work still happens (Drive tools can do it). Then give the new and changed rows as paste blocks, and say exactly **where to insert** them ("insert 2 rows below row 117").

---

## 3b · Check every in-scope row (both modes)

Run these checks in order and stop at the first failure for each row. (Intake, section 3, runs first.) Every failure becomes a Slack roadblock with the exact fix.

1. **AT (CHECK) starts with ✗.** Use AT's text, word for word, as the roadblock.
2. **Z is a Google Drive link** (`drive.google.com`). If it's SharePoint or anything else, report "Assets not in Drive".
   - **Exception:** if Z is only digits, it's a creator post ID. The row is a partnership ad (section 9b). Skip checks 2–3 and the Drive intake (section 3) for it.
   - AT's formula may still show ✗ for Z on these rows. Ignore that one ✗.
3. **The Drive folder can be opened, and it's organized** (section 3 already ran). If it's empty, can't be opened or isn't shared, report it. Dimensions always come from the real pixel size. Note any missing dimension, but don't block on it.
4. **AF (brand), AC (start date) and AN (landing page) are filled.** A brand must have an ad account in CLAUDE SETUP. **An empty Y (URL) is not a blocker:** Claude proposes one on build day (section 5b). In DAILY CHECK, report it as "Y empty: Claude will propose a URL".
5. **The destination resolves live in Ads Manager.** See section 4. In DAILY CHECK mode, only look names up. Never create anything.
6. **Copy.** If F is filled, the COPY row must exist and be Active. If F is empty, that's fine: Claude writes the copy on build day. Say so in the daily report.

---

## 4 · What Claude does: AO ① (USE or CREATE)

Look up every name **live** with `list_campaigns` / `list_adsets` on the brand's account, **including every status (paused too)**. Match on the exact name after trimming spaces and ignoring case. Never use a fuzzy match. If a name matches more than one object, report "More than one '<name>'" with their IDs and skip the row.

| ① AO | ② AP | ③ AQ | ④ AR | What to do |
|---|---|---|---|---|
| **`USE EXISTING AD SET`** | existing campaign | existing ad set | — | **Create nothing.** Find AQ inside AP and launch into it. If it's not found, report "Not found in Ads Manager: '<name>'". |
| **`CREATE NEW AD SET`** | existing campaign | **name of the ad set to CREATE** | ad set to copy | `duplicate_adset` AR → `targetCampaignId` = AP's ID, `newName` = AQ, `deepCopy=false`, `initialStatus=PAUSED`. If AS is a number and the campaign isn't CBO, also pass `newBudget` = AS × 100 and `budgetType=daily`. |
| **`CREATE NEW CAMPAIGN + NEW AD SET`** | **name of the campaign to CREATE** | **name of the ad set to CREATE** | ad set to copy | `duplicate_campaign` on AR's parent campaign with `copyDepth="campaign"`, `newName` = AP, `initialStatus=PAUSED`. Wait 6–10 s, then `duplicate_adset` AR into the new campaign, as in the row above. |
| **`SAME AS ROW ABOVE`** | — | — | — | **Create nothing.** Use the ad set resolved for the nearest row above with the **same brand** (AF). |

**Empty AO–AQ, or the campaign/ad set doesn't exist:** never guess and never create on your own. Post in Slack per brand: what exists live (active campaigns with their ad sets, names exactly as in Ads Manager) and what the human needs to fill (AO + AP + AQ, rows a–b). If the brand has **no active campaign at all**, say so explicitly ("<Brand> has no active campaign. Pick one or set CREATE NEW CAMPAIGN + NEW AD SET").

**AO tells you exactly what to do: USE means create nothing, CREATE means create exactly what it says, and nothing else.** Rows where Claude creates something have orange cells in AO/AP/AQ.

Rules:
- **Create each new object once.** Before creating, check whether an object with that exact name already exists. If it does and its build log or creation time shows it came from an earlier run of this skill, reuse it. Otherwise skip, and report "'<name>' already exists. Pick USE EXISTING AD SET or rename it".
- Write `CAMPAIGN_CREATED:<id>` / `ADSET_CREATED:<id>` into AU on the row that created it.
- **Pace Meta writes:** 6–10 s between create, duplicate and launch calls, never in parallel. On Meta error 10 / 2859015 or "account is restricted", stop **all** writes immediately, post in Slack, and end the run.

---

## 5 · Analyze the creative (BUILD mode)

Get the files into AdManage first:
1. Preferred: `import_google_drive_folder` with the folder URL. This needs Google Drive connected inside AdManage. On an auth error (`CLOUD_NOT_CONNECTED`), post in Slack "AdManage → Integrations → Google Drive → Connect" and fall back to step 2.
2. Fallback: download each file with Drive `download_file_content`, then `get_upload_url` → PUT the bytes with curl → `confirm_upload`. Keep the width and height of every file.

Then analyze:
- **Images:** read the on-image copy word for word. Note the product, packaging, person, setting and any badge or price flash.
- **Videos:** transcribe them (ffmpeg extracts the audio, plus any available transcriber such as whisper). If that fails, sample about 8 frames and read the on-screen text. Note which method you used.

For each creative, write down what it shows, what it claims, the **angle** (the argument it makes) and the **hook**: the first spoken line, or the first on-screen text.

### 5b · Empty URL (Y): propose one

**Never change a Y that someone filled in.** Only do this when Y is empty:

1. **From the analysis:** use the product, collection or offer the creative shows or talks about.
2. **Find the page on the brand's site** (web fetch), for example the product page or the collection page. Start from the domain the brand's other rows use in Y (e.g. `https://shopmissa.com`). If that doesn't give one, use the brand's site from the config table.
3. **Confident match** (the page is clearly the product or collection in the creative): write that URL into Y.
4. **No confident match:** write the **homepage**, the domain root (e.g. `https://shopmissa.com/`).
5. **Log it** in AU as `Y_PROPOSED:<url> (<product page|homepage>)`, and fill AN with a nickname for that URL if AN is blank.
6. **Ask for a check:** list it in the copy review message (6b): "Row <r>: no URL, I used <url> (<why>). OK?"

The copy is then grounded on that page, as section 6 requires.

If the brand's site can't be found at all, skip the row and post "Row <r>: Y empty and no site for <brand>. Paste the URL in Y."

---

## 6 · Copy (BUILD mode, only when F is empty)

**Never write copy from scratch. Base it on the ads already in the ad account.** Always, in this order:
1. Pull the live copy from the brand's ad account through AdManage: `list_ads` (`status=ACTIVE`, and the top spenders via `get_top_ads` for the last 30 days) and `get_source_ad_setup` (`fields=lightweight`) on 5–10 of them. These are the main reference: length, tone, emoji, structure, CTA.
2. Then read the brand's COPY rows (Active and Legacy, same BRAND) and its last 10–20 rows in AD APPROVALS.
3. **Open the landing page (Y)** and the brand's site (web fetch). Note the claims, product names, offers and wording on that page. This is the list of what the copy may say.
4. Write the new copy as a variation of what is already running, adapted to what *this* creative shows and says.

5. **Read AV (📝 COPY NOTES)** for the row and follow it, within the grounding rules below. You still analyze the creative (section 5) and read the landing page either way. If AV is blank, write from the creative alone.

If the account has no live ads, say so in the Slack thread and use the sheet history only. If Y can't be opened, write only claims that appear in the creative and in the brand's existing copy, and flag "Couldn't open <Y>" in the review message.

Match:
- **Length:** use the same word count as their recent primary texts. Get YAYA, for example, runs 1–3 short sentences of about 20–30 words with one emoji after the hook. Only fall back to 40–80 words when there's no history.
- **Emoji, title case and punctuation:** do whatever their copy does.
- **The CTA (X):** keep it if it's filled. Otherwise use the brand's most common CTA, usually `Shop Now`.

Write **one new COPY row** in the first free row:
- B: `<Angle> · <short idea>`, C: the brand, D: the angle, E: `Active`.
- **HEADLINE 1–3** (K–M): each 40 characters or fewer, no full stop, no brand name. Each one carries the strongest point of *this* creative, said three different ways.
- **PRIMARY TEXT 1–2** (P–Q): the hook in the first 125 characters, a light push at the end, never "BUY NOW".
- **DESCRIPTION 1–2** (U–V): each 60 characters or fewer, and each must add something the headline doesn't say.

Then set AD APPROVALS **F** to that row's label (`CPxxx · <name>`).

**Grounding (never break these):**
- The copy must be about this creative.
- **Never say anything that isn't on the landing page (Y), on the brand's site, or in the creative itself.** A claim that only appears in older ads still needs the page or the creative to back it.
- No prices, discounts, shipping promises, ingredient/clinical/results claims, guarantees, return terms, "#1" or "best-selling" unless the page says it.
- List anything you left out in the report.
- Don't reuse sentences from earlier copy.

If F is already filled, use that copy set as it is.

### 6b · Copy review (every run that wrote copy)

The ads are built PAUSED with the new copy. Then, **before closing the run**, ask for a review:
- **Slack thread** (tagged): `📝 Copy for review · rows <ranges> · CPxxx–CPyyy`. Under it, for each copy set, give the headlines, primary texts and descriptions, plus the page each claim came from, plus any URL you proposed for an empty Y (5b). End with "Reply OK, or tell me what to change."
- **The chat:** the same review, as a table (Row · Copy set · Headline 1 · Primary text 1 · Description 1 · Source).

Nothing is turned on by this skill, and the team only turns the ads on after the OK. When they ask for changes, run `REWRITE_COPY` for those rows, update the ads' copy (still PAUSED) and ask for review again.

---

## 7 · Hook (BUILD mode, Video only)

If AK = `Video` and V is empty: take the hook from section 5. If a HOOKS row for the same brand has the same line, use its label. Otherwise write a new HOOKS row in the first free row: B = the exact first line, C = the brand, D = the closest TYPE from Q6:Q30, E = `Testing`, K = the on-screen text if there is any. Then set **V** to its label.

---

## 8 · Fill the blank tags (AF–AN, AC, AD)

Only fill blanks. **Never overwrite something a person typed.** There must be **no spaces** in AF–AN except the brand, which must be spelled exactly as in INPUTS. Use CamelCase everywhere else.

| Col | Rule |
|---|---|
| AC / AD | `(MM/DD/YY` and `MM/DD/YY)`, or `TBD`. Keep both parentheses. |
| AG | Funnel: `TOF`/`MOF`/`BOF`/`ASC`. Default to the brand's recent rows. |
| AH | `Promo`/`Evergreen`/`Partnership` |
| AI | `NoOffer` or one token, e.g. `30%OffSitewide` |
| AJ | The angle, e.g. `SpillProof` or `UGC_PainFirst` |
| AK | `Static`/`Carousel`/`GIF`/`Video`/… |
| AL | The product, or `MultipleProducts` |
| AM | What makes this row unique (the creator name or ad code). Add `_02` for a second cut. |
| AN | The nickname the sheet already uses for that URL |

**Ad name:** recompute AE's formula yourself, character for character:
`AC_AD_AF_AG_AH_AI_AJ_AK_AL_AM` + (`_` + the first 5 characters of F, if F is set) + (`_` + the first 4 characters of V, if V is set **and** AK = `Video`) + `_to_` + AN.
Use that exact string as `adName`.

---

## 9 · Build (BUILD mode)

Do this once per account: `get_active_connection`, then `get_launch_defaults(accountId)` for the Page and Instagram IDs, names, UTMs and URL tags. If the defaults are missing, copy the identity from a recent live ad (`get_source_ad_setup`).

First, run `list_ads` with `names: [<ad name>]` on the account. **If an ad with that exact name already exists, skip the row** as "Already built" and log its ID.

Then `launch_ads`:
- `platform: "facebook"`, `adAccountId`, `adSets: [{ value: <ad set id> }]`, `adName`
- `title` = Headline 1, `description` = Primary text 1, `adDescription` = Description 1, `cta` = X in the platform enum (e.g. `SHOP_NOW`), `link` = Y
- **Text variations:** if the copy set has more than one headline, primary text or description, check `get_launch_reference` (topic `formats`). If multiple text options are supported, pass all the non-empty ones. Otherwise use variant 1 and note that in the report.
- `media`: every dimension, each with `url`, `type`, `width` and `height`. Use `type: "multi"` when there are 2 or more dimensions (feed gets 1x1/4x5, stories and reels get 9x16), or `single` for one file.
- **ALWAYS PAUSED.** Never launch anything ACTIVE.

Poll `get_batch_status` (`waitSeconds=25`) until it returns success or error. Record the `adId` and `adsManagerUrl` for each ad.

### 9b · Partnership ads (Z = creator post ID)

When Z holds only digits, it's the ID of a creator's post. The ad runs on that post as a partnership ad, not on an uploaded file.

1. **Check the permission:** run `list_partnership_permissions` and `list_partnership_media` on the brand's account. The post must be listed there, which means the creator has given the brand partnership access.
   - **If it isn't listed:** skip the row and ask in Slack: "Row <r>: creator post <id> isn't shared for partnership ads. Ask the creator to approve the partnership, or check the ID."
2. **Analyze the post** (section 5): use its caption, thumbnail and transcript where available. Hook and copy rules are the same.
3. **Launch with the post, PAUSED.** Use the partnership/post option in AdManage. Check `get_launch_reference` for the partnership-ad format, or use `launch_meta_post_ids` with the post ID.
   - The ad name, the destination (AO–AQ), the link (Y) and the CTA follow the normal rules.
   - Use the creator's caption or the COPY set, as the partnership format allows. Say which one you used in the report.
4. **Fill AK** with `Partnership` if it's blank. Set AH to `Partnership` if it's blank, as the dropdown allows.
5. **Log in AU:** `AD_ID:<id> | PARTNERSHIP:<post id> | <date>`.

Never move or re-upload the creator's content to Drive for these rows.

---

## 10 · Write back

**With a Google Sheets write tool:** write values as plain text, so nothing turns into a date or number. Only touch:
- the new COPY / HOOKS rows
- F and V on built rows
- any blank AC, AD, AF–AN
- Y, only when it was empty (section 5b)
- A (the Ads Manager link)
- B (the "Status after Claude builds" value, only after a successful launch)
- AU: `CAMPAIGN_CREATED:<id> | ADSET_CREATED:<id> | AD_ID:<id> | <date> | <note>`

On a failure, leave B as it is and write `FAILED: <reason>` in AU.

**Without a Sheets write tool:** never upload a modified file over the client's sheet. Put paste blocks in the report instead, one block per tab and range (COPY row, HOOKS row, AD APPROVALS F, V, AC–AD, AF–AN, AU). Add a "Row" column that's only for reading, and never produce a single block spanning formula columns.

---

## 11 · Slack

All posts go to the CLAUDE SETUP channel. **Keep them short, specific and scannable.** Group roadblocks by cause and give row ranges (`113–122`), not one line per row.

**Structure: one parent message per client per day, short progress updates in its thread.**

**1. Parent message (one per client per day).** Read the channel from midnight today (local timezone). If this client's parent from today exists, reply under it. Otherwise post:
- BUILD: `*<CLIENT IN CAPS> · Building · <Day, Mon D>*` + newline + `Updates in the thread 👇`
- Other days: `*<CLIENT IN CAPS> · Daily check · <Day, Mon D>*` + newline + `Updates in the thread 👇`

**2. Progress updates in the thread, as each step happens.** One line each, brief, numbers not prose. Skip a step if it did nothing. Merge steps that finish together into one message so the thread stays under ~6 messages.
```
🟢 Starting. <N> rows in "Building in ads manager" (<n> <Brand>, …)
📁 Drive organized. <n> creatives → rows <ranges> (<n> new rows added)
🎬 Creative analysis ready. <n> videos transcribed, <n> statics read
✍️ Writing copy. Based on <n> live ads from <Brand> account
📄 Copy in COPY tab. CPxxx–CPyyy · hooks H0xx–H0yy in HOOKS
🎯 Selected in AdManage. <Brand> → <campaign> › <ad set> (rows <ranges>)
✅ Built PAUSED. <n> ads · <Brand> · <ad set> · <Ads Manager link>
📝 Copy for review. rows <ranges> · CPxxx–CPyyy, reply OK or what to change (tagged, section 6b)
```
DAILY CHECK only uses the lines that apply (Starting, Drive, tags filled, what's ready for build day).

**3. Blockers: always a separate thread message, always tagged. Keep it SHORT.**
Only actions, no explanations. Max 4 numbered lines, one action each, ~10 words. Say which column and which rows. No sub-bullets, no IDs lists, no background. Details (live campaigns, file names, account IDs) go in the chat report, not in Slack.
```
*<n> things to do before <Build day>* 👇

1. *<Short label>:* <action>, rows <ranges>
2. *<Short label>:* <action>
3. …

That's it. Say "fixed" in Claude and I build 🚀
<tags>
```
In DAILY CHECK, if nothing is new, ready or blocked, post nothing at all.

**Standard fixes:**
- Assets not in Drive → "Move to Drive and paste the folder link in Z."
- AT shows ✗ → use AT's text.
- Not found in Ads Manager: '<name>' → "Fix the name in AP/AQ/AR. Pick it from the dropdown or paste it exactly."
- Missing dimension → "Row X has no 9x16. Add it to the Drive folder." (A note only. Creator content can be 9x16 only.)
- Unmatched creative → "Unmatched creative: <folder>. Which brief is it? Put the brief name in its row (AA), or tell me in the chat."
- Brief with no creative → "No creative yet for <brief>, row <r>."
- No ad account for a brand → "Add it in CLAUDE SETUP."
- RAW_META shows a Supermetrics error → "RAW_META isn't refreshing: <error>. The dropdowns are stale." Keep building anyway.
- Meta or AdManage error → `<short message>`
- AO–AQ empty → "Rows <ranges>: fill AO + AP + AQ. Live in <Brand>: <campaign> (<ad sets>)."
- Brand has no active campaign → "<Brand> has no active campaign. Pick one or set CREATE NEW CAMPAIGN + NEW AD SET (names + AR)."
- Can't match files to briefs → "Brief <X>, rows <a–b>: is it <file1> / <file2>? Put the filename in AA."
- AdManage Drive not connected → "AdManage → Integrations → Google Drive → Connect."
- Two ad accounts with the same name → "<Brand>: which one, <act_1> or <act_2>? Add it in CLAUDE SETUP." 

**Resume:** when the user writes in the client's chat that something is fixed ("assets are in Drive, build them"), run BUILD mode for that client right away. Then reply **in the same Slack thread** as that day's post with the result.

---

## 12 · Final report (every run)

End every run with a `SendUserMessage` to the user that covers:
1. **Summary:** the mode, rows found, built and skipped, and objects created.
2. **Built:** a table of Row · Ad name · Ad set · Ad ID · Ads Manager link · copy method (transcript or frames).
3. **Paste blocks:** only when there's no Sheets write tool.
4. **Copy for review:** the section 6b table, ending with "Reply OK, or tell me what to change."
5. **Needs you:** every roadblock, every claim you left out, and every assumption.

## 13 · Troubleshooting: what to do when something breaks

Every one of these ends with a short Slack message (max 4 lines, tagged) unless it says otherwise.

| What happens | Do this |
|---|---|
| **AdManage tools don't load at all** (tool not found / "not available in this turn") | Stop all AdManage steps. Slack: "⚠️ AdManage isn't connected to Claude. Reconnect it in Claude → Settings → Connectors, then say 'check' in Claude." Tag people. Never guess results of earlier writes. |
| AdManage `CLOUD_NOT_CONNECTED` on Drive import | Slack: "AdManage → Integrations → Google Drive → Connect." Skip import; nothing else can build for those rows. |
| A write returns `isAsync` / `state: processing` | **Never resubmit.** Poll `get_mutation_status` (ad sets) or `get_batch_status` (ads, use this, not `get_batch`) with the operationKey/batch ID. If you can't poll this turn, report the ID and check first next turn. |
| Run stops mid-build (tool budget) | Report exactly what's done and what's left with all IDs, so "continue" resumes without redoing anything. Next run: check the last ad set / batch before writing anything new. |
| `get_launch_defaults` says account not found | Pull page + Instagram from a live ad with `get_ad_debug_data` (one call, several sources). Save them in the config table above. Suggest saving launch defaults in AdManage. |
| Google Drive connector gives no pixel dimensions | Import into AdManage first; the import returns width/height/duration. Use those for the `_<ratio>` file suffix. |
| Can't watch/transcribe video | Use the AdManage import thumbnail (`view_image`, up to 5 per call): it shows the on-screen hook text and the product. Log the on-screen hook in HOOKS. |
| Huge account (100+ campaigns / 200+ ad sets) | Don't page through everything. Use `list_campaigns` with `status=ACTIVE` first; if the named campaign isn't there, it's usually on the newest page. Then `list_adsets` with `campaignId`. |
| Every row in a batch says CREATE NEW AD SET with the same name | Create it **once** (first row), reuse it for all the others. Log `ADSET_CREATED <id>` on the first row only. |
| Video product ≠ product URL in Y | Build as-is (PAUSED), put `⚠ video <X>, URL <Y>` in AU, and add it to the Slack "check before turning on" list. Never change Y. |
| CLAUDE SETUP tab missing | Use the Ashtel config above; mention "CLAUDE SETUP tab missing" once in the Slack blockers. Don't change B until the after-build status is known. |
| Two ad accounts with the same name | Skip that brand, put both IDs in Slack, wait for a human to pick. |
| Section label rows between data rows (e.g. "New August Creatives - EVO") | Not in scope. Always verify row numbers by reading column D for the exact range before writing. |

## 14 · Saving tool calls (builds are long)

- One `get_values` for the whole in-scope block (`Z:AU`), not one per column.
- Batch sheet writes by contiguous range (F113:F122, V113:V122…), never cell by cell.
- One `launch_ads` call per brand with all its ads.
- One `get_ad_debug_data` call with several sources for page/IG identities.
- Draft all copy in one bash step, check lengths (headline ≤40, description ≤60, hook in first 125 chars), then write.
- Slack: merge steps so a build thread has ~6 messages, not 15.

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
4. Run it. The message ends with a "Remember (hard rules of the skill)" list: go through it, because those rules are the same as the hard rules at the top of this skill.

| C command | What to do |
|---|---|
| `BUILD` | BUILD mode (sections 2–11). If D starts with `rows …` (e.g. `rows 79–81, 83`), build **only those rows**. A `note: …` part in D is extra instructions from the team for this build; follow it within this skill's rules. |
| `CHECK` | DAILY CHECK mode. Never create anything in Ads Manager. |
| `FIX_ROWS` | D is `rows <ranges>: <problem>` (plus an optional `note: …`). Fix those rows **in the sheet** when the answer is clear from the sheet or Drive, e.g. a Drive folder link typed in AA (BRIEF) or Y instead of Z → put it in Z; a blank tag you can fill per section 8. Never guess a destination (AO–AQ) or a URL, never create anything in Ads Manager. K = what you fixed and what still needs a person. |
| `REWRITE_COPY` | D is `row 118` or `rows 113–122`. Run section 6 for those rows even if F is filled: write a **new** COPY row and point F at it. Never edit the old COPY row. Nothing in Ads Manager. |
| `RECHECK_BUILD` | D is a date (`2026-10-16`). For rows whose AU has that date: confirm each ad exists and is PAUSED, re-check video product vs Y, update the ⚠ part of AU. Create nothing. |
| `STATUS` | Post today's status in the client's Slack thread (section 11 format). |
| `ASK` | D is free text from the team. Do it within this skill's rules. If it asks for something outside them (turn ads on, delete, change spend), don't: set `failed` with the reason. |

5. Finish: **G = `done`** or **`failed`**, **J = now (ISO)**, **K = one line, max ~200 characters**: the result (`15 of 15 built, paused. Rows 118, 120: check link`) or, on failure, the reason and the fix. Write as plain text.
6. Post the result in the Slack thread as usual (section 11). If the command came from a Slack tag, reply under that tag.

Rules: never delete, reorder or clear COMMANDS rows. Only write G, I, J and K. The app reads COMMANDS every 30–60 s while a command is open and shows K to the team, so keep K short and specific.

The app also edits these AD APPROVALS cells for people: **B, Y, Z, AO–AS and AV (copy notes)** (it never writes formulas, F, V or AU). Always re-read the rows before acting, as the skill already does.

**When you insert rows** (section 3, step 5e, extra creatives), the new row must get the formula cells of the row above: copy **C, D, E, G–U, W, AE and AT** from the row above (copy the formula, so the row references shift), then fill the inputs. A row without them has no ad name and no ✓/✗ check. If there are empty template rows already set up below (status blank, formulas in place), you may use those instead of inserting.

### CLAUDE SETUP layout the app writes

Label in A, value in B, read by label from `'CLAUDE SETUP'!A1:B60`:

```
Client name · Build day · Timezone · Status after Claude builds · Slack channel ID · Tag on roadblocks
Claude chat to reply in · Skill · Command check interval (minutes)
META AD ACCOUNTS            ← header row
<Brand as in AF> | act_…    ← one row per brand; anything other than exactly one act_ id is unconfirmed
```
