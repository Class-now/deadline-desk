// Registers Deadline Desk's operations with the agent runtime. Each action wraps a
// method of the page's one Board object, so the assistant and the page's own controls
// follow the same rules. Only names in agent-manifest.json actions.agentTools become
// model tools (website_<name>). The reads that other agent sites may also use are
// registered a second time in bridge/bridge-actions.js, with the same names and input.
import { App, Board } from "./js/board.js";
import { FILTER_PROPERTIES, FIND_CALLS, PLAN_CALLS } from "./js/action-schemas.js";

class SiteActions {
  static registerActions(actions) {
    actions.register({
      name: "get_board_state",
      description: "Read today's date (Japan time), the board's snapshot date, the categories, the filters on the page and the visitor's shortlist with days left. Changes nothing. Call it first in a turn that needs today's date or the shortlist.",
      effect: "read",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      execute: () => App.page.getState(),
    });
    actions.register({
      ...FIND_CALLS,
      effect: "read",
      execute: args => App.page.findCalls(args),
    });
    actions.register({
      name: "show_calls",
      description: "Call it only when the visitor asks to show or filter the list on the page. Applies the same filters as website_find_calls to that list, replacing what the visitor sees. Returns the result and the new version.",
      effect: "write",
      inputSchema: { type: "object", additionalProperties: false, properties: FILTER_PROPERTIES },
      execute: args => App.page.showCalls(args),
    });
    actions.register({
      name: "add_to_shortlist",
      description: "Call it only when the visitor asks. Adds one open call to the visitor's shortlist on this page (kept in this browser). Refuses closed calls, duplicates and a full list (12). Returns the updated state.",
      effect: "write",
      inputSchema: {
        type: "object", additionalProperties: false, required: ["id"],
        properties: { id: { type: "string", enum: Board.callIds(), description: "Call id from website_find_calls." } },
      },
      execute: args => App.page.addToShortlist(args.id),
    });
    actions.register({
      name: "remove_from_shortlist",
      description: "Call it only when the visitor asks. Removes one call from the visitor's shortlist. Returns the updated state.",
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
    actions.register({
      ...PLAN_CALLS,
      effect: "read",
      execute: args => Board.planCalls(args.ids, args.bufferDays ?? 2),
    });
  }
}

export const registerActions = SiteActions.registerActions;
