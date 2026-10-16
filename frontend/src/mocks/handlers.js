// Fake API. Answers the same paths FastAPI will serve later (/api/...).
// All numbers are MOCK values for building the UI, not real results or real limits.
//
// v2: every check and series now has a `partId` (links readings to CAD parts),
//     and every run has `component` / `eventType` (so the CAD page can filter runs).
import { http, HttpResponse, delay } from "msw";

const NETWORK_DELAY_MS = 300; // makes loading states visible

// ---------- Helpers ----------

const round = (v, d = 2) => Number(v.toFixed(d));

function range(start, end, step) {
  const out = [];
  for (let t = start; t <= end; t += step) out.push(t);
  return out;
}

// Deterministic fake SHA-256-looking hash, so it stays the same on every reload
function fakeHash(seed) {
  let x = (seed * 2654435761) >>> 0;
  let hex = "";
  for (let i = 0; i < 64; i++) {
    x = (Math.imul(x, 1103515245) + 12345) >>> 0;
    hex += ((x >>> 16) & 15).toString(16);
  }
  return hex;
}

const notFound = (what) => HttpResponse.json({ detail: `${what} not found` }, { status: 404 });

// ---------- Limits (PLACEHOLDERS, not real values) ----------

let LIMITS = [
  { id: "lim-1", metric: "strap_current", label: "Max strap current", value: 120, unit: "kA", version: 1 },
  { id: "lim-2", metric: "strap_temp", label: "Max strap temperature rise", value: 150, unit: "°C", version: 1 },
  { id: "lim-3", metric: "touch_voltage", label: "Max touch voltage", value: 1000, unit: "V", version: 1 },
  { id: "lim-4", metric: "earth_resistance", label: "Max earth resistance", value: 10, unit: "Ω", version: 1 },
  { id: "lim-5", metric: "static_voltage", label: "Max residual voltage at 100 ms", value: 500, unit: "V", version: 1 },
];
const limitById = (id) => LIMITS.find((l) => l.id === id);

// Value <= limit passes. Margin = how much headroom is left, as % of the limit.
function check(limitId, value, partId) {
  const l = limitById(limitId);
  return {
    limitId,
    partId,
    label: l.label,
    value: round(value),
    limit: l.value,
    unit: l.unit,
    margin: round(((l.value - value) / l.value) * 100, 1),
    result: value <= l.value ? "pass" : "fail",
  };
}

// ---------- Waveform shapes ----------

// Lightning: double exponential, peaks around 10 µs then decays (time in µs)
const LIGHTNING_TIMES = range(0, 1000, 5);
const lightningShape = (t) => Math.exp(-t / 350) - Math.exp(-t / 2);
const SHAPE_PEAK = Math.max(...LIGHTNING_TIMES.map(lightningShape));

function lightningSeries(metric, label, unit, peak, partId) {
  return {
    metric, label, unit, partId, timeUnit: "µs",
    points: LIGHTNING_TIMES.map((t) => ({ t, value: round((peak * lightningShape(t)) / SHAPE_PEAK) })),
  };
}

// Temperature rise builds up with the energy dumped in (∝ ∫ i² dt), so it climbs then flattens
function temperatureSeries(finalRise, partId) {
  let sum = 0;
  const cumulative = LIGHTNING_TIMES.map((t) => (sum += lightningShape(t) ** 2));
  return {
    metric: "strap_temp", label: "Strap 1 temperature rise", unit: "°C", partId, timeUnit: "µs",
    points: LIGHTNING_TIMES.map((t, i) => ({ t, value: round((finalRise * cumulative[i]) / sum) })),
  };
}

// Static: charge bleeding off exponentially (time in ms)
const STATIC_TIMES = range(0, 200, 2);
function staticSeries(v0, tauMs, partId) {
  return {
    metric: "static_voltage", label: "Static potential", unit: "V", partId, timeUnit: "ms",
    points: STATIC_TIMES.map((t) => ({ t, value: round(v0 * Math.exp(-t / tauMs)) })),
  };
}

// ---------- Which CAD part each reading belongs to ----------
// Receptacle part names match src/config/models.js and the real receptacle .glb.
// LPBD names are guesses until its CAD exists.
const PARTS = {
  // Bonding bridge attaches to the pin, so static discharge readings go there.
  // Touch voltage and earth resistance are whole-system readings; shown on BODY
  // until the page has a separate "system readings" section.
  Receptacle: { static: "Removable Pin", touch: "BODY", earth: "BODY" },
  LPBD: { static: "wheel", touch: "bracket", earth: "wheel", strap: "strap_1" },
};

// ---------- Scenarios ----------

const SCENARIO_DEFS = [
  { id: 1, variant: "Prototype", component: "LPBD", eventType: "lightning", condition: "dry", status: "done",
    p: { peakKA: 200, share: 0.55, tempRise: 95, touchV: 720, earthR: 4.2 } },
  { id: 2, variant: "Prototype", component: "LPBD", eventType: "lightning", condition: "wet", status: "done",
    p: { peakKA: 200, share: 0.63, tempRise: 162, touchV: 640, earthR: 2.8 } },
  { id: 3, variant: "Prototype", component: "LPBD", eventType: "static", condition: "dry", status: "done",
    p: { v0: 5000, tauMs: 18 } },
  { id: 4, variant: "Prototype", component: "LPBD", eventType: "static", condition: "wet", status: "waiting" },
  { id: 5, variant: "Prototype", component: "Receptacle", eventType: "lightning", condition: "dry", status: "done",
    p: { peakKA: 200, touchV: 1180, earthR: 8.9 } },
  { id: 6, variant: "Prototype", component: "Receptacle", eventType: "lightning", condition: "wet", status: "done",
    p: { peakKA: 200, touchV: 860, earthR: 3.1 } },
  { id: 7, variant: "Prototype", component: "Receptacle", eventType: "static", condition: "dry", status: "done",
    p: { v0: 5000, tauMs: 45 } },
  { id: 8, variant: "Prototype", component: "Receptacle", eventType: "static", condition: "wet", status: "running" },
  // Current setup, for the Compare page
  { id: 9, variant: "Baseline", component: "LPBD", eventType: "lightning", condition: "dry", status: "done",
    p: { peakKA: 200, share: 0.7, tempRise: 180, touchV: 900, earthR: 6.5 } },
];

const scenarioName = (d) => `${d.variant} – ${d.component} – ${d.condition} – ${d.eventType}`;

// Build a run (series + checks) for each finished scenario
function buildRun(d) {
  const { p } = d;
  const part = PARTS[d.component];
  let series, checks;

  if (d.eventType === "static") {
    series = [staticSeries(p.v0, p.tauMs, part.static)];
    checks = [check("lim-5", p.v0 * Math.exp(-100 / p.tauMs), part.static)];
  } else if (d.component === "LPBD") {
    const strapPeak = p.peakKA * p.share;
    series = [
      lightningSeries("strap_current", "Strap 1 current", "kA", strapPeak, part.strap),
      temperatureSeries(p.tempRise, part.strap),
      lightningSeries("touch_voltage", "Touch voltage", "V", p.touchV, part.touch),
    ];
    checks = [
      check("lim-1", strapPeak, part.strap),
      check("lim-2", p.tempRise, part.strap),
      check("lim-3", p.touchV, part.touch),
      check("lim-4", p.earthR, part.earth),
    ];
  } else {
    series = [
      lightningSeries("earth_current", "Current into earth", "kA", p.peakKA, part.earth),
      lightningSeries("touch_voltage", "Touch voltage", "V", p.touchV, part.touch),
    ];
    checks = [check("lim-3", p.touchV, part.touch), check("lim-4", p.earthR, part.earth)];
  }

  const id = 100 + d.id;
  return {
    id,
    scenarioId: d.id,
    scenarioName: scenarioName(d),
    component: d.component,
    eventType: d.eventType,
    condition: d.condition,
    source: "simulated",
    createdAt: new Date(Date.UTC(2026, 9, 6, 2, d.id * 7)).toISOString(),
    parserVersion: "mock-0.2",
    fileHash: fakeHash(id),
    result: checks.every((c) => c.result === "pass") ? "pass" : "fail",
    checks,
    series,
  };
}

const RUNS = SCENARIO_DEFS.filter((d) => d.status === "done").map(buildRun);
const runById = (id) => RUNS.find((r) => r.id === id);

const SCENARIOS = SCENARIO_DEFS.map((d) => {
  const run = RUNS.find((r) => r.scenarioId === d.id);
  return {
    id: d.id,
    name: scenarioName(d),
    component: d.component,
    eventType: d.eventType,
    condition: d.condition,
    status: d.status,
    result: run ? run.result : null,
    latestRunId: run ? run.id : null,
    margin: run ? Math.min(...run.checks.map((c) => c.margin)) : null, // tightest check
  };
});

// Run without the heavy series data, for lists
const runSummary = ({ series, checks, ...rest }) => rest;

// ---------- Handlers ----------

export const handlers = [
  http.get("/api/scenarios", async ({ request }) => {
    await delay(NETWORK_DELAY_MS);
    const q = new URL(request.url).searchParams;
    const list = SCENARIOS.filter((s) =>
      (!q.get("component") || s.component === q.get("component")) &&
      (!q.get("eventType") || s.eventType === q.get("eventType")) &&
      (!q.get("status") || s.status === q.get("status"))
    );
    return HttpResponse.json(list);
  }),

  http.get("/api/scenarios/:id", async ({ params }) => {
    await delay(NETWORK_DELAY_MS);
    const s = SCENARIOS.find((x) => x.id === Number(params.id));
    return s ? HttpResponse.json(s) : notFound("Scenario");
  }),

  http.get("/api/runs", async ({ request }) => {
    await delay(NETWORK_DELAY_MS);
    const q = new URL(request.url).searchParams;
    const list = RUNS.filter((r) =>
      (!q.get("scenarioId") || r.scenarioId === Number(q.get("scenarioId"))) &&
      (!q.get("component") || r.component === q.get("component")) &&
      (!q.get("source") || r.source === q.get("source"))
    ).map(runSummary);
    return HttpResponse.json(list);
  }),

  http.get("/api/runs/:id", async ({ params }) => {
    await delay(NETWORK_DELAY_MS);
    const run = runById(Number(params.id));
    if (!run) return notFound("Run");
    const { series, ...detail } = run;
    return HttpResponse.json(detail);
  }),

  http.get("/api/runs/:id/results", async ({ params, request }) => {
    await delay(NETWORK_DELAY_MS);
    const run = runById(Number(params.id));
    if (!run) return notFound("Run");
    const metric = new URL(request.url).searchParams.get("metric");
    const series = metric ? run.series.filter((s) => s.metric === metric) : run.series;
    return HttpResponse.json({ series });
  }),

  http.get("/api/compare", async ({ request }) => {
    await delay(NETWORK_DELAY_MS);
    const q = new URL(request.url).searchParams;
    if (!q.get("prototype") || !q.get("baseline")) {
      return HttpResponse.json({ detail: "Both prototype and baseline are required" }, { status: 400 });
    }
    const proto = runById(Number(q.get("prototype")));
    const base = runById(Number(q.get("baseline")));
    if (!proto || !base) return notFound("Run");

    // Only compare checks both runs have
    const metrics = proto.checks
      .map((pc) => {
        const bc = base.checks.find((c) => c.limitId === pc.limitId);
        if (!bc) return null;
        const l = limitById(pc.limitId);
        return {
          metric: l.metric,
          label: l.label,
          unit: l.unit,
          limit: l.value,
          prototype: { value: pc.value, result: pc.result },
          baseline: { value: bc.value, result: bc.result },
        };
      })
      .filter(Boolean);

    return HttpResponse.json({ metrics });
  }),

  http.get("/api/limits", async () => {
    await delay(NETWORK_DELAY_MS);
    return HttpResponse.json(LIMITS);
  }),

  http.put("/api/limits/:id", async ({ params, request }) => {
    await delay(NETWORK_DELAY_MS);
    const limit = limitById(params.id);
    if (!limit) return notFound("Limit");
    const body = await request.json();
    if (typeof body.value !== "number" || !Number.isFinite(body.value) || body.value <= 0) {
      return HttpResponse.json({ detail: "value must be a positive number" }, { status: 422 });
    }
    const updated = { ...limit, value: body.value, version: limit.version + 1 };
    LIMITS = LIMITS.map((l) => (l.id === limit.id ? updated : l));
    return HttpResponse.json(updated);
  }),

  http.get("/api/summary", async () => {
    await delay(NETWORK_DELAY_MS);
    return HttpResponse.json({
      total: SCENARIOS.length,
      passed: SCENARIOS.filter((s) => s.result === "pass").length,
      failed: SCENARIOS.filter((s) => s.result === "fail").length,
      waiting: SCENARIOS.filter((s) => s.status !== "done").length,
    });
  }),
];
