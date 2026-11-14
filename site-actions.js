// Registers Deadline Desk's operations with the agent runtime. Each action wraps a
// method of the page's one Board object, so the assistant and the page's own controls
// follow the same rules. Only names in agent-manifest.json actions.agentTools become
// model tools (website_<name>).
import { App, Board } from "./js/board.js";
import { CATEGORIES } from "./js/calls-data.js";

const FILTER_PROPERTIES = {
  category: { type: "string", enum: ["any", ...CATEGORIES], description: "Kind of call. Default any." },
  language: { type: "string", enum: ["any", "English", "Japanese"], description: "Entry language. Default any." },
  aiPolicy: { type: "string", enum: ["any", "allowed", "not-forbidden"], description: "allowed = rules allow generative AI; not-forbidden = drops calls that ban it." },
  minPrizeUsd: { type: "integer", minimum: 0, maximum: 1000000, description: "Smallest top prize in USD." },
  deadlineFrom: { type: "string", format: "date", description: "Earliest deadline day, YYYY-MM-DD (Japan time)." },
  deadlineTo: { type: "string", format: "date", description: "Latest deadline day, YYYY-MM-DD (Japan time)." },
  keyword: { type: "string", maxLength: 60, description: "Word to match in title, organizer, format, prize or eligibility." },
};

class SiteActions {
  static registerActions(actions) {
    actions.register({
      name: "get_board_state",
      description: "Read today's date (Japan time), the board's snapshot date, the categories, the filters on the page and the visitor's shortlist with days left. Changes nothing.",
      effect: "read",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      execute: () => App.page.getState(),
    });
    actions.register({
      name: "find_calls",
      description: "Search open calls (prize contests, hackathons, writing and film prizes) by filters. Returns matching calls sorted by deadline with prize, eligibility, language, AI policy, days left and the official link. Changes nothing on the page. Eligibility details beyond openTo are not checked: tell the visitor to confirm on the official page.",
      effect: "read",
      inputSchema: { type: "object", additionalProperties: false, properties: FILTER_PROPERTIES },
      execute: args => App.page.findCalls(args),
    });
    actions.register({
      name: "show_calls",
      description: "Apply the same filters to the list on the page, replacing what the visitor sees. Use only when the visitor asks to show or filter the page list. Returns the result and the new version.",
      effect: "write",
      inputSchema: { type: "object", additionalProperties: false, properties: FILTER_PROPERTIES },
      execute: args => App.page.showCalls(args),
    });
    actions.register({
      name: "add_to_shortlist",
      description: "Add one open call to the visitor's shortlist on this page (kept in this browser). Refuses closed calls, duplicates and a full list (12). Returns the updated state.",
      effect: "write",
      inputSchema: {
        type: "object", additionalProperties: false, required: ["id"],
        properties: { id: { type: "string", enum: Board.callIds(), description: "Call id from website_find_calls." } },
      },
      execute: args => App.page.addToShortlist(args.id),
    });
    actions.register({
      name: "remove_from_shortlist",
      description: "Remove one call from the visitor's shortlist. Returns the updated state.",
      effect: "write",
      inputSchema: {
        type: "object", additionalProperties: false, required: ["id"],
        properties: { id: { type: "string", enum: Board.callIds(), description: "Call id on the shortlist, from website_get_board_state." } },
      },
      execute: args => App.page.removeFromShortlist(args.id),
    });
    actions.register({
      name: "plan_shortlist",
      description: "Work back from each shortlisted deadline to start, draft and submit dates (Japan time) using typical preparation days per category, and list clashes where submit dates fall within 2 days. Changes nothing.",
      effect: "read",
      inputSchema: {
        type: "object", additionalProperties: false,
        properties: { bufferDays: { type: "integer", minimum: 0, maximum: 7, description: "Days to submit before the real deadline. Default 2." } },
      },
      execute: args => App.page.planShortlist(args.bufferDays ?? 2),
    });
  }
}

export const registerActions = SiteActions.registerActions;
