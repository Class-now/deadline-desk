// Input schemas and descriptions of the reads that the page (site-actions.js) and the
// action bridge (bridge/bridge-actions.js) both register, so an agent sees one tool with
// one meaning wherever it runs.
import { CALLS, CATEGORIES } from "./calls-data.js";

export const FILTER_PROPERTIES = {
  category: { type: "string", enum: ["any", ...CATEGORIES], description: "Kind of call. Default any." },
  language: { type: "string", enum: ["any", "English", "Japanese"], description: "Entry language. Default any." },
  aiPolicy: { type: "string", enum: ["any", "allowed", "not-forbidden"], description: "allowed = rules allow generative AI; not-forbidden = drops calls that ban it." },
  minPrizeUsd: { type: "integer", minimum: 0, maximum: 1000000, description: "Smallest top prize in USD." },
  deadlineFrom: { type: "string", format: "date", description: "Earliest deadline day, YYYY-MM-DD (Japan time)." },
  deadlineTo: { type: "string", format: "date", description: "Latest deadline day, YYYY-MM-DD (Japan time)." },
  keyword: { type: "string", maxLength: 60, description: "Word to match in title, organizer, format, prize or eligibility." },
};

export const FIND_CALLS = {
  name: "find_calls",
  description: "Search open calls (prize contests, hackathons, writing and film prizes) by filters. Returns matching calls sorted by deadline with prize, eligibility, language, AI policy, days left and the official link. Changes nothing. Eligibility details beyond openTo are not checked: say to confirm on the official page.",
  inputSchema: { type: "object", additionalProperties: false, properties: FILTER_PROPERTIES },
};

export const PLAN_CALLS = {
  name: "plan_calls",
  description: "Work back from the deadlines of the named calls to start, draft and submit dates (Japan time), using typical preparation days per category, and list clashes where submit dates fall within 2 days. Takes ids from website_find_calls; the calls need not be on a shortlist. Changes nothing.",
  inputSchema: {
    type: "object", additionalProperties: false, required: ["ids"],
    properties: {
      ids: { type: "array", minItems: 1, maxItems: 12, items: { type: "string", enum: CALLS.map(c => c.id) }, description: "Call ids from website_find_calls." },
      bufferDays: { type: "integer", minimum: 0, maximum: 7, description: "Days to submit before the real deadline. Default 2." },
    },
  },
};
