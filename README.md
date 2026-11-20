# Deadline Desk — an open agentic website

Deadline Desk lists prize contests and hackathons you can still enter, sorted by deadline.
Filter by category, language, generative-AI rules, prize and dates, shortlist a few, and the
desk works back from each deadline to start, draft and submit dates (with an `.ics` export).

The page has an embedded assistant built with the
[agentify-website skill](https://github.com/cognizant-ai-labs/agentic-web) of the
Worldwide Agentic Web MVP spec. It runs in your browser on your own LLM key, answers only
from the board's data, and acts through the same functions as the page's buttons.

- Live site: https://deadline-desk-agent.vercel.app/
- Network URL (what another agent site puts in its `tools`): https://deadline-desk-agent.vercel.app/deadline_desk
  (manifest: `agent-manifest.json`, network: `deadline_desk.network.json`)
- MCP endpoint (read-only, no key, CORS open): https://deadline-desk-agent.vercel.app/api/mcp

## What the assistant can do

| Action | Effect | Wraps |
| --- | --- | --- |
| `website_get_board_state` | read | `Board.getState()` — today (JST), snapshot date, filters, shortlist |
| `website_find_calls` | read | `Board.findCalls()` — search by filters, sorted by deadline |
| `website_show_calls` | write | `Board.showCalls()` — filter the list on the page |
| `website_add_to_shortlist` | write | `Board.addToShortlist()` — refuses closed calls, duplicates, a full list |
| `website_remove_from_shortlist` | write | `Board.removeFromShortlist()` |
| `website_plan_shortlist` | read | `Board.planShortlist()` — start/draft/submit dates and clashes |
| `website_plan_calls` | read | `Board.planCalls()` — the same plan for calls named by id, no shortlist needed |

It declines what the site cannot do: registering or submitting an entry, writing or judging
entries, contacting organizers, or confirming eligibility beyond what the board lists. It
then gives the call's official link. Nothing here is irreversible, so no action needs a
confirmation dialog.

## What another agent site gets

The spec runs a called site's network in the *caller's* browser, where the called site's
page does not exist. Deadline Desk still answers with real data, in two ways.

| Path | Used when | What runs |
| --- | --- | --- |
| Shared reads (`bridge/bridge-actions.js`) | the caller's runtime loads this site's action bridge | `get_board_state`, `find_calls` and `plan_calls`, in a hidden frame on this site's origin, with the page's own `Board` code |
| `board_lookup`, the second agent | the front agent has no `website_*` tools at all | this site's MCP endpoint, `/api/mcp`, with the same `Board` code on the server |

The three shared reads have the names and input of the page's own actions, so one set of
instructions fits both places. They list `"*"` as caller, because they return only what
the public page shows everyone: open calls, deadlines, prizes and official links. The
shortlist and the filters on a visitor's page belong to that visitor, so the bridge shares
neither, and no write is shared: a caller's visitor is told that shortlists are kept on
this site's page.

The caller's visitor sees one consent card, for Deadline Desk, before anything is fetched.
The caller's key goes only to the caller's router: this site receives the static file
requests, or the MCP tool arguments, and nothing else.

## Call Deadline Desk from your agent site

1. Put `"https://deadline-desk-agent.vercel.app/deadline_desk"` in the calling agent's `tools`.
2. Put `"https://deadline-desk-agent.vercel.app"` in your manifest's `allowed_peers`.
3. Label it in your `.hocon`: `"link_labels": {"https://deadline-desk-agent.vercel.app/deadline_desk": "Deadline Desk"}`.
4. Tell your agent when to ask, for example: "For contests, hackathons or prize deadlines,
   ask deadline_desk which open calls match."

Check it from your side with the spec repository's script:

```shell
node skills/agentify-website/scripts/check_partner.mjs https://deadline-desk-agent.vercel.app/deadline_desk --origin <your origin>
```

## Use the board from any MCP client

`POST https://deadline-desk-agent.vercel.app/api/mcp` speaks JSON-RPC 2.0 (MCP, stateless,
plain JSON answers). Two read-only tools, backed by the same `js/board.js` the page runs:

- `find_open_calls`: filters `category`, `language`, `aiPolicy`, `minPrizeUsd`,
  `withinDays`, `deadlineFrom`, `deadlineTo`, `keyword`, `limit`. Returns today's date in
  Japan time and the open calls sorted by deadline.
- `plan_deadlines`: `ids` (1 to 12) and `bufferDays`. Returns start, draft and submit dates
  and clashes. Nothing is stored.

```shell
curl -s https://deadline-desk-agent.vercel.app/api/mcp -H "Content-Type: application/json"   -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"find_open_calls","arguments":{"category":"hackathon","withinDays":28}}}'
```

This site calls no partner sites.

## Privacy

The assistant sends your messages, and the page data it reads, to the LLM provider you
choose in **⚙ AI model settings**. Your key stays in this site's browser storage. To stop,
select **Delete setup** under **Advanced settings (optional)** and close the tab. The
shortlist is kept in your browser's local storage only.

## Run it locally

From the root of a clone of `cognizant-ai-labs/agentic-web`, with Node.js 22 or newer:

```shell
node skills/agentify-website/scripts/serve_site.mjs <path to this folder> --port 8080
```

Then open http://127.0.0.1:8080/. Tests (no LLM is called):

```shell
node skills/agentify-website/scripts/build_network.mjs <this folder>/deadline_desk.hocon --manifest <this folder>/agent-manifest.json --check
node --test <this folder>/tests/agentified.test.mjs <this folder>/tests/mcp.test.mjs
```

## Files

- `index.html`, `styles.css`, `js/board.js` (page logic), `js/calls-data.js` (the board snapshot)
- `site-actions.js` (actions), `site.js` and `assistant.css` (the assistant on the page)
- `deadline_desk.hocon` (network source) → `deadline_desk.network.json` (generated)
- `agent-manifest.json`, `links.json`, `agent-mcp.json`, `.well-known/` (discovery), `bridge/` (for calling sites: the bridge page the build writes, and `bridge-actions.js`, the three reads shared with them)
- `api/mcp.js` (the MCP endpoint, a Vercel function), `vercel.json` (CORS on the public files, the sandbox worker's CSP)
- `runtime/` (the browser runtime from the skill, unchanged), `tests/` (19 tests: the page and network, the shared reads, and the MCP endpoint)

## Limits

Static files plus one stateless function, with the skill's patched copy of the nsdeploy
runtime. Write actions run without a dialog. The board is a hand-checked snapshot; always
confirm rules and deadlines on the organizer's page. The LLM provider must allow CORS. The
network file, including instructions, is public. Opened from another origin, such as a
local copy, the page's assistant still works, but `/api/mcp` is then a third-party
service and the runtime asks before contacting it.

## License

MIT (see `LICENSE`). The files under `runtime/` keep their own license, Apache 2.0 (`runtime/LICENSE.txt`).
