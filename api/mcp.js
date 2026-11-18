// Deadline Desk's public MCP endpoint (JSON-RPC 2.0 over HTTP POST, stateless).
//
// The page's assistant reads the board through website_* tools, which exist only on this
// site's own page. When another agent website runs this site's network in its visitor's
// browser, those tools are absent. This endpoint gives that copy of the network, and any
// other MCP client, the same read-only board: the same data file and the same Board
// methods the page uses. It reads nothing about the caller and stores nothing.
import { Board } from "../js/board.js";
import { CALLS, CATEGORIES, SNAPSHOT_DATE } from "../js/calls-data.js";

const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const DAY = 86400000;
const JST_OFFSET = 9 * 3600000;
const SITE = "https://deadline-desk-agent.vercel.app/";

const FILTER_PROPERTIES = {
  category: { type: "string", enum: ["any", ...CATEGORIES], description: "Kind of call. Default any." },
  language: { type: "string", enum: ["any", "English", "Japanese"], description: "Entry language. Default any." },
  aiPolicy: { type: "string", enum: ["any", "allowed", "not-forbidden"], description: "allowed = rules allow generative AI; not-forbidden = drops calls that ban it." },
  minPrizeUsd: { type: "integer", minimum: 0, maximum: 1000000, description: "Smallest top prize in USD." },
  withinDays: { type: "integer", minimum: 1, maximum: 366, description: "Only calls that close within this many days from today (Japan time). Use it for 'next four weeks' (28) or 'this month'." },
  deadlineFrom: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "Earliest deadline day, YYYY-MM-DD (Japan time)." },
  deadlineTo: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "Latest deadline day, YYYY-MM-DD (Japan time)." },
  keyword: { type: "string", maxLength: 60, description: "Word to match in title, organizer, format, prize or eligibility." },
  limit: { type: "integer", minimum: 1, maximum: 50, description: "Most calls to return. Default 12." },
};

const TOOLS = [
  {
    name: "find_open_calls",
    title: "Find open calls",
    description: "Search Deadline Desk's board of open prize contests and hackathons (writing, poetry, essay, film, design, business-idea, data-science). Returns today's date in Japan time and the matching open calls sorted by deadline, each with deadline, days left, prize, eligibility, language, AI policy and the organizer's official link. Read-only. Eligibility beyond openTo is not checked.",
    inputSchema: { type: "object", additionalProperties: false, properties: FILTER_PROPERTIES },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "plan_deadlines",
    title: "Plan backwards from deadlines",
    description: "For up to 12 call ids from find_open_calls, work back from each deadline to start, draft and submit dates (Japan time) using typical preparation days per category, and list clashes where submit dates fall within 2 days. Read-only; nothing is saved.",
    inputSchema: {
      type: "object", additionalProperties: false, required: ["ids"],
      properties: {
        ids: { type: "array", minItems: 1, maxItems: 12, items: { type: "string" }, description: "Call ids from find_open_calls." },
        bufferDays: { type: "integer", minimum: 0, maximum: 7, description: "Days to submit before the real deadline. Default 2." },
      },
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
];

/** The board's read-only operations, as MCP tools. */
export class BoardTools {
  /** :return: "YYYY-MM-DD" of the instant in Japan time. */
  static jstDay(ms) {
    return new Date(ms + JST_OFFSET).toISOString().slice(0, 10);
  }

  /** :return: the search result, or {ok: false, reason}. */
  static findOpenCalls(args = {}) {
    const { withinDays, limit, ...filters } = args;
    const now = Board.now();
    if (withinDays !== undefined) {
      if (!Number.isInteger(withinDays) || withinDays < 1 || withinDays > 366) return { ok: false, reason: "withinDays must be a whole number from 1 to 366." };
      const last = BoardTools.jstDay(now + withinDays * DAY);
      if (!filters.deadlineTo || filters.deadlineTo > last) filters.deadlineTo = last;
    }
    const max = limit === undefined ? 12 : limit;
    if (!Number.isInteger(max) || max < 1 || max > 50) return { ok: false, reason: "limit must be a whole number from 1 to 50." };
    const board = new Board();
    const result = board.findCalls(filters);
    if (!result.ok) return result;
    const state = board.getState();
    return {
      ok: true,
      today: state.today,
      todayLabel: state.todayLabel,
      timeZone: state.timeZone,
      snapshotDate: SNAPSHOT_DATE,
      filters: result.filters,
      count: result.count,
      returned: Math.min(result.count, max),
      calls: result.calls.slice(0, max),
      note: "A hand-checked snapshot. Confirm rules, eligibility and deadlines on each official link.",
      site: SITE,
    };
  }

  /** :return: the plan, or {ok: false, reason}. */
  static planDeadlines(args = {}) {
    const ids = Array.isArray(args.ids) ? args.ids : [];
    if (ids.length < 1 || ids.length > 12) return { ok: false, reason: "Give 1 to 12 call ids." };
    const unknown = ids.filter(id => !CALLS.some(c => c.id === id));
    if (unknown.length) return { ok: false, reason: `No call with id ${unknown.map(id => `"${String(id).slice(0, 40)}"`).join(", ")}. Read ids from find_open_calls.` };
    const board = new Board();
    board.shortlist = [...new Set(ids)];
    const plan = board.planShortlist(args.bufferDays === undefined ? 2 : args.bufferDays);
    if (!plan.ok) return plan;
    return { ...plan, note: "Preparation days are rough defaults per category. Nothing was saved.", site: SITE };
  }

  static call(name, args) {
    if (name === "find_open_calls") return BoardTools.findOpenCalls(args);
    if (name === "plan_deadlines") return BoardTools.planDeadlines(args);
    return null;
  }
}

/** One JSON-RPC message in, one response object (or null for a notification) out. */
export class McpServer {
  static handle(message) {
    if (!message || typeof message !== "object" || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
      return { jsonrpc: "2.0", id: message?.id ?? null, error: { code: -32600, message: "Invalid Request" } };
    }
    const { id, method, params } = message;
    if (id === undefined || id === null) return null; // a notification
    const ok = result => ({ jsonrpc: "2.0", id, result });
    if (method === "initialize") {
      const asked = params?.protocolVersion;
      return ok({
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "deadline-desk", title: "Deadline Desk board", version: "1.0.0" },
        instructions: "Read-only board of open prize contests and hackathons. Call find_open_calls first; it returns today's date in Japan time. Give visitors the official link of every call you mention.",
      });
    }
    if (method === "ping") return ok({});
    if (method === "tools/list") return ok({ tools: TOOLS });
    if (method === "tools/call") {
      const name = params?.name;
      const args = params?.arguments ?? {};
      if (typeof args !== "object" || Array.isArray(args)) return { jsonrpc: "2.0", id, error: { code: -32602, message: "arguments must be an object" } };
      const result = BoardTools.call(name, args);
      if (result === null) return { jsonrpc: "2.0", id, error: { code: -32602, message: `Unknown tool: ${String(name).slice(0, 60)}` } };
      return ok({ content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result, isError: result.ok === false });
    }
    return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method.slice(0, 60)}` } };
  }
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, MCP-Protocol-Version, Mcp-Session-Id, Last-Event-ID",
  "Access-Control-Max-Age": "86400",
  "Cache-Control": "no-store",
};

/** Vercel Node.js function. No cookies, no credentials, no state. */
export default function handler(req, res) {
  for (const [key, value] of Object.entries(CORS)) res.setHeader(key, value);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ error: "This is an MCP endpoint. Send JSON-RPC 2.0 with POST.", tools: TOOLS.map(t => t.name), site: SITE });
  }
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = undefined; }
  }
  if (body === undefined || body === null) return res.status(400).json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
  if (Array.isArray(body)) {
    const answers = body.slice(0, 20).map(McpServer.handle).filter(Boolean);
    return answers.length ? res.status(200).json(answers) : res.status(202).end();
  }
  const answer = McpServer.handle(body);
  return answer ? res.status(200).json(answer) : res.status(202).end();
}
