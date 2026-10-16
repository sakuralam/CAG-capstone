// src/api/api.js
// Every API call the dashboard makes lives here.
// Components and hooks import these functions, never client.js or fetch directly.
// When FastAPI is ready, these stay the same as long as the paths match.

import { client } from "./client";

// ---------- Scenarios ----------
// A scenario = one test case, e.g. LPBD / wet soil / lightning

// Optional filters: { component: "LPBD", eventType: "lightning", status: "done" }
export const getScenarios = (filters) =>
  client.get("/scenarios", { params: filters });

export const getScenario = (scenarioId) =>
  client.get(`/scenarios/${scenarioId}`);

// ---------- Runs ----------
// A run = one XGSLab result for a scenario (a scenario can have several runs)

// Optional filters: { scenarioId: 3, source: "simulated" }
export const getRuns = (filters) =>
  client.get("/runs", { params: filters });

// Full detail for one run: metadata, results, and pass/fail checks
export const getRun = (runId) =>
  client.get(`/runs/${runId}`);

// Time-series data for charts, e.g. strap current over time.
// Optional: { metric: "strap_current" } to fetch one series only
export const getRunResults = (runId, options) =>
  client.get(`/runs/${runId}/results`, { params: options });

// ---------- Comparison ----------
// Prototype vs CAG baseline, for the Compare page

export const compareRuns = (prototypeRunId, baselineRunId) =>
  client.get("/compare", {
    params: { prototype: prototypeRunId, baseline: baselineRunId },
  });

// Limits 
// CAG's pass/fail thresholds (placeholder values for now)

export const getLimits = () =>
  client.get("/limits");

// Later, admin only. The backend must enforce who can do this.
export const updateLimit = (limitId, changes) =>
  client.put(`/limits/${limitId}`, changes);

// ---------- Summary ----------
// Counts for the Overview page: total scenarios, passed, failed, waiting

export const getSummary = () =>
  client.get("/summary");