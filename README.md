# Deadline Desk — an open agentic website

Deadline Desk lists prize contests and hackathons you can still enter, sorted by deadline.
Filter by category, language, generative-AI rules, prize and dates, shortlist a few, and the
desk works back from each deadline to start, draft and submit dates (with an `.ics` export).

The page has an embedded assistant built with the
[agentify-website skill](https://github.com/cognizant-ai-labs/agentic-web) of the
Worldwide Agentic Web MVP spec. It runs in your browser on your own LLM key, answers only
from the board's data, and acts through the same functions as the page's buttons.

- Live site: https://class-now.github.io/deadline-desk/
- Network URL: https://class-now.github.io/deadline-desk/deadline_desk
  (manifest: `agent-manifest.json`, network: `deadline_desk.network.json`)

## What the assistant can do

| Action | Effect | Wraps |
| --- | --- | --- |
| `website_get_board_state` | read | `Board.getState()` — today (JST), snapshot date, filters, shortlist |
| `website_find_calls` | read | `Board.findCalls()` — search by filters, sorted by deadline |
| `website_show_calls` | write | `Board.showCalls()` — filter the list on the page |
| `website_add_to_shortlist` | write | `Board.addToShortlist()` — refuses closed calls, duplicates, a full list |
| `website_remove_from_shortlist` | write | `Board.removeFromShortlist()` |
| `website_plan_shortlist` | read | `Board.planShortlist()` — start/draft/submit dates and clashes |

It declines what the site cannot do: registering or submitting an entry, writing or judging
entries, contacting organizers, or confirming eligibility beyond what the board lists. It
then gives the call's official link. Nothing here is irreversible, so no action needs a
confirmation dialog.

Other agent websites can call this network. They get no `website_*` tools, so their
assistant answers in general terms and points to this page. This site calls no partner
sites.

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
node --test "<this folder>/tests/*.test.mjs"
```

## Files

- `index.html`, `styles.css`, `js/board.js` (page logic), `js/calls-data.js` (the board snapshot)
- `site-actions.js` (actions), `site.js` and `assistant.css` (the assistant on the page)
- `deadline_desk.hocon` (network source) → `deadline_desk.network.json` (generated)
- `agent-manifest.json`, `links.json`, `agent-mcp.json`, `.well-known/` (discovery), `bridge/` (for calling sites)
- `runtime/` (the browser runtime from the skill, unchanged), `tests/`

## Limits

Static hosting only, with the skill's patched copy of the nsdeploy runtime. Write actions
run without a dialog. The board is a hand-checked snapshot; always confirm rules and
deadlines on the organizer's page. The LLM provider must allow CORS. The network file,
including instructions, is public. GitHub Pages cannot set the Content-Security-Policy
header the skill suggests for `runtime/sandbox-worker.js`.
