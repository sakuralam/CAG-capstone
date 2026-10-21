// Fake API. Answers the same paths FastAPI will serve later (/api/...).
// All numbers are MOCK values for building the UI, not real results or real limits.
//
// v4: readings follow each device's conduction path, so every part the current
//     or charge passes through has readings.
//   - Receptacle: bonding bridge -> pin -> body -> earth; the metal lid is bonded to the body.
//   - LPBD: bracket -> straps (most current) + body/sliding rod (small share) -> wheel -> ground.
//   - Every check/series has a `partId` (a CAD part name), or `partId: null` for
//     whole-system readings (earth resistance, LPBD touch voltage).
//   - Every check/series has a unique `id`, since one limit can apply to several parts.
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

// ---------- Which CAD part each reading belongs to ----------
// Part names must match the object names in the .glb files and src/config/models.js.
// Receptacle names come from the real CAD. LPBD names are placeholders until its CAD arrives.
const PARTS = {
  Receptacle: { lid: "Lif", pin: "Removable Pin", body: "BODY" },
  LPBD: { bracket: "bracket", strap1: "strap_1", strap2: "strap_2", body: "body", rod: "sliding_rod", wheel: "wheel" },
};

// Short names used in labels, e.g. "Max temperature rise – strap 2"
const PART_LABELS = {
  Lif: "lid",
  "Removable Pin": "pin",
  BODY: "body",
  bracket: "bracket",
  strap_1: "strap 1",
  strap_2: "strap 2",
  body: "body",
  sliding_rod: "sliding rod",
  wheel: "wheel",
};
const nameOf = (partId) => PART_LABELS[partId] ?? partId;
const capitalise = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const SYSTEM = null; // partId for whole-system readings
const readingId = (key, partId) => `${key}:${partId ?? "system"}`;

// ---------- Limits (PLACEHOLDERS, not real values) ----------

let LIMITS = [
  { id: "lim-1", metric: "strap_current", label: "Max strap current", value: 120, unit: "kA", version: 1 },
  { id: "lim-2", metric: "temp_rise", label: "Max temperature rise", value: 150, unit: "°C", version: 1 },
  { id: "lim-3", metric: "touch_voltage", label: "Max touch voltage", value: 1000, unit: "V", version: 1 },
  { id: "lim-4", metric: "earth_resistance", label: "Max earth resistance", value: 10, unit: "Ω", version: 1 },
  { id: "lim-5", metric: "static_voltage", label: "Max residual voltage at 100 ms", value: 500, unit: "V", version: 1 },
  { id: "lim-6", metric: "bond_resistance", label: "Max bonding resistance (lid–body)", value: 10, unit: "mΩ", version: 1 },
  // The straps exist so lightning current bypasses the sliding joint; too much current there risks arcing.
  { id: "lim-7", metric: "rod_current", label: "Max current through sliding joint", value: 15, unit: "kA", version: 1 },
];
const limitById = (id) => LIMITS.find((l) => l.id === id);

// Limits whose label already says which part they're about
const SELF_NAMED = new Set(["bond_resistance", "rod_current"]);

// Value <= limit passes. Margin = how much headroom is left, as % of the limit.
function check(limitId, value, partId) {
  const l = limitById(limitId);
  return {
    id: readingId(limitId, partId),
    limitId,
    partId,
    label: partId && !SELF_NAMED.has(l.metric) ? `${l.label} – ${nameOf(partId)}` : l.label,
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
    id: readingId(metric, partId),
    metric, label, unit, partId, timeUnit: "µs",
    points: LIGHTNING_TIMES.map((t) => ({ t, value: round((peak * lightningShape(t)) / SHAPE_PEAK) })),
  };
}

// Temperature rise builds up with the energy dumped in (∝ ∫ i² dt), so it climbs then flattens
function temperatureSeries(finalRise, partId) {
  let sum = 0;
  const cumulative = LIGHTNING_TIMES.map((t) => (sum += lightningShape(t) ** 2));
  return {
    id: readingId("temp_rise", partId),
    metric: "temp_rise", label: `${capitalise(nameOf(partId))} temperature rise`, unit: "°C", partId, timeUnit: "µs",
    points: LIGHTNING_TIMES.map((t, i) => ({ t, value: round((finalRise * cumulative[i]) / sum) })),
  };
}

// Static: charge bleeding off exponentially (time in ms)
const STATIC_TIMES = range(0, 200, 2);
function staticSeries(v0, tauMs, partId) {
  return {
    id: readingId("static_voltage", partId),
    metric: "static_voltage", label: `Static potential at ${nameOf(partId)}`, unit: "V", partId, timeUnit: "ms",
    points: STATIC_TIMES.map((t) => ({ t, value: round(v0 * Math.exp(-t / tauMs)) })),
  };
}

// ---------- Conduction paths ----------
// Every part the current or charge passes through gets readings.
//
// Lightning: each part gets its current and its temperature rise. Heating ∝ I² (I²t),
//   scaled by how easily the part heats up (thin rod heats fast, thick bracket barely warms).
// Static: every bonded part sits at nearly the same potential while the charge drains,
//   so each part gets a potential curve and a residual-voltage check.

// Relative heating per part (strap = 1). Mock values.
const LPBD_HEATING = { bracket: 0.06, strap_1: 1, strap_2: 1, body: 0.25, sliding_rod: 2.0, wheel: 0.12 };
// Receptacle heating: temperature rise in °C at 100 kA. Mock values.
const RECEPTACLE_HEAT_AT_100KA = { "Removable Pin": 30, BODY: 4 };

// Static: potential at each part relative to the point where charge enters (1.0). Mock values.
const STATIC_PATH = {
  Receptacle: { "Removable Pin": 1.0, BODY: 0.97, Lif: 0.97 },
  LPBD: { bracket: 1.0, strap_1: 0.99, strap_2: 0.99, body: 0.99, sliding_rod: 0.98, wheel: 0.95 },
};

// One part's lightning readings: current curve + temperature curve + temperature check
function lightningPart(partId, currentKA, tempRise, currentMetric = "part_current") {
  return {
    series: [
      lightningSeries(currentMetric, `${capitalise(nameOf(partId))} current`, "kA", currentKA, partId),
      temperatureSeries(tempRise, partId),
    ],
    checks: [check("lim-2", tempRise, partId)],
  };
}

function merge(...groups) {
  return {
    series: groups.flatMap((g) => g.series ?? []),
    checks: groups.flatMap((g) => g.checks ?? []),
  };
}

// ---------- Scenarios ----------
// LPBD lightning:  `totalKA` enters at the bracket and leaves through the wheel.
//                  `rodKA` goes through the body + sliding rod; the rest is split between the straps,
//                  with `share` going to strap 1. `tempRise` = strap 1 temperature rise.
// Receptacle:      `currentKA` flows through pin and body into earth. `touchV` = touch voltage on the lid,
//                  `bondMilliohm` = lid–body bonding resistance.
// Static:          `v0` = starting potential, `tauMs` = how fast it drains.

const SCENARIO_DEFS = [
  { id: 1, variant: "Prototype", component: "LPBD", eventType: "lightning", condition: "dry", status: "done",
    p: { totalKA: 210, rodKA: 10, share: 0.55, tempRise: 95, touchV: 720, earthR: 4.2 } },
  { id: 2, variant: "Prototype", component: "LPBD", eventType: "lightning", condition: "wet", status: "done",
    p: { totalKA: 210, rodKA: 10, share: 0.63, tempRise: 162, touchV: 640, earthR: 2.8 } },
  { id: 3, variant: "Prototype", component: "LPBD", eventType: "static", condition: "dry", status: "done",
    p: { v0: 5000, tauMs: 18 } },
  { id: 4, variant: "Prototype", component: "LPBD", eventType: "static", condition: "wet", status: "waiting" },
  { id: 5, variant: "Prototype", component: "Receptacle", eventType: "lightning", condition: "dry", status: "done",
    p: { currentKA: 200, touchV: 1180, earthR: 8.9, bondMilliohm: 2.1 } },
  { id: 6, variant: "Prototype", component: "Receptacle", eventType: "lightning", condition: "wet", status: "done",
    p: { currentKA: 200, touchV: 860, earthR: 3.1, bondMilliohm: 2.4 } },
  { id: 7, variant: "Prototype", component: "Receptacle", eventType: "static", condition: "dry", status: "done",
    p: { v0: 5000, tauMs: 45, bondMilliohm: 2.1 } },
  { id: 8, variant: "Prototype", component: "Receptacle", eventType: "static", condition: "wet", status: "running" },
  // Current setup, for the Compare page: weaker strap split, more current through the sliding joint
  { id: 9, variant: "Baseline", component: "LPBD", eventType: "lightning", condition: "dry", status: "done",
    p: { totalKA: 210, rodKA: 18, share: 0.7, tempRise: 180, touchV: 900, earthR: 6.5 } },
];

const scenarioName = (d) => `${d.variant} – ${d.component} – ${d.condition} – ${d.eventType}`;

function lpbdLightning(p) {
  const P = PARTS.LPBD;
  const strapsKA = p.totalKA - p.rodKA;
  const s1 = strapsKA * p.share;
  const s2 = strapsKA - s1;
  // Heating coefficient calibrated so strap 1 hits `tempRise` at current s1
  const k = p.tempRise / s1 ** 2;
  const temp = (partId, kA) => k * kA ** 2 * LPBD_HEATING[partId];

  const strap1 = lightningPart(P.strap1, s1, temp(P.strap1, s1), "strap_current");
  const strap2 = lightningPart(P.strap2, s2, temp(P.strap2, s2), "strap_current");
  strap1.checks.unshift(check("lim-1", s1, P.strap1));
  strap2.checks.unshift(check("lim-1", s2, P.strap2));
  const rod = lightningPart(P.rod, p.rodKA, temp(P.rod, p.rodKA), "rod_current");
  rod.checks.unshift(check("lim-7", p.rodKA, P.rod));

  return merge(
    lightningPart(P.bracket, p.totalKA, temp(P.bracket, p.totalKA)),
    strap1,
    strap2,
    lightningPart(P.body, p.rodKA, temp(P.body, p.rodKA)),
    rod,
    lightningPart(P.wheel, p.totalKA, temp(P.wheel, p.totalKA)),
    {
      series: [lightningSeries("touch_voltage", "Touch voltage", "V", p.touchV, SYSTEM)],
      checks: [check("lim-3", p.touchV, SYSTEM), check("lim-4", p.earthR, SYSTEM)],
    },
  );
}

function receptacleLightning(p) {
  const P = PARTS.Receptacle;
  const temp = (partId) => RECEPTACLE_HEAT_AT_100KA[partId] * (p.currentKA / 100) ** 2;
  return merge(
    lightningPart(P.pin, p.currentKA, temp(P.pin)),
    lightningPart(P.body, p.currentKA, temp(P.body)),
    {
      // The lid isn't in the current path, but it's the metal people touch
      series: [lightningSeries("touch_voltage", "Touch voltage at lid", "V", p.touchV, P.lid)],
      checks: [
        check("lim-3", p.touchV, P.lid),
        check("lim-6", p.bondMilliohm, P.lid),
        check("lim-4", p.earthR, SYSTEM),
      ],
    },
  );
}

function staticRun(component, p) {
  const out = { series: [], checks: [] };
  for (const [partId, factor] of Object.entries(STATIC_PATH[component])) {
    const v0 = p.v0 * factor;
    out.series.push(staticSeries(v0, p.tauMs, partId));
    out.checks.push(check("lim-5", v0 * Math.exp(-100 / p.tauMs), partId));
  }
  if (component === "Receptacle") out.checks.push(check("lim-6", p.bondMilliohm, PARTS.Receptacle.lid));
  return out;
}

// Build a run (series + checks) for each finished scenario
function buildRun(d) {
  const { series, checks } =
    d.eventType === "static" ? staticRun(d.component, d.p)
    : d.component === "LPBD" ? lpbdLightning(d.p)
    : receptacleLightning(d.p);

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
    parserVersion: "mock-0.4",
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

    // Compare checks both runs have: same limit on the same part (or both system-level)
    const metrics = proto.checks
      .map((pc) => {
        const bc = base.checks.find((c) => c.id === pc.id);
        if (!bc) return null;
        const l = limitById(pc.limitId);
        return {
          metric: pc.id, // unique per limit + part
          label: pc.label,
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
