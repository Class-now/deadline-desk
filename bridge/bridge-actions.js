// The reads Deadline Desk shares with other agent sites, through its action bridge.
// The build names this file in bridge/agent-manifest.json. When another site's assistant
// calls this site's network, the bridge loads it in a hidden frame on this site's origin,
// which has no board page. Each action has the name and input of the page's own action
// (site-actions.js), so the network's instructions fit both.
import { Board } from "../js/board.js";
import { FIND_CALLS, PLAN_CALLS } from "../js/action-schemas.js";

/**
 * Shares three reads: the board's date and categories, the search over open calls, and
 * the back-plan for named calls.
 *
 * A partner's agent calls them from the partner's page, and each call runs here with the
 * site's own Board rules and data. Nothing here reads a visitor's shortlist or the filters
 * on anyone's page: those belong to one visitor and stay on the page.
 */
class BridgeActions {
  /**
   * Every site may call these reads. They return only what the public page already shows
   * to everyone: open calls, their deadlines, prizes and official links.
   */
  static CALLERS = ["*"];

  /**
   * Register the shared reads with the bridge's registry.
   *
   * :param actions: The runtime registry facade with a register(definition) method.
   */
  static registerActions(actions) {
    actions.register({
      name: "get_board_state",
      description: "Read today's date (Japan time), the board's snapshot date, how many calls are open and the categories. Changes nothing. Call it first in a turn that needs today's date.",
      effect: "read",
      availability: "bridge",
      callerOrigins: BridgeActions.CALLERS,
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      execute: () => Board.publicState(),
    });
    actions.register({
      ...FIND_CALLS,
      effect: "read",
      availability: "bridge",
      callerOrigins: BridgeActions.CALLERS,
      // A fresh board: the search reads the data file only, never a shortlist.
      execute: args => BridgeActions.freshBoard().findCalls(args),
    });
    actions.register({
      ...PLAN_CALLS,
      effect: "read",
      availability: "bridge",
      callerOrigins: BridgeActions.CALLERS,
      execute: args => Board.planCalls(args.ids, args.bufferDays ?? 2),
    });
  }

  /**
   * :return: A board with no shortlist, as a first-time visitor's page has.
   */
  static freshBoard() {
    const board = new Board();
    board.shortlist = [];
    return board;
  }
}

// The bridge calls the module's registerActions export.
export const registerActions = BridgeActions.registerActions;
