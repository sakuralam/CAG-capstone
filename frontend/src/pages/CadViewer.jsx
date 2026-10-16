// 3D view of a component. Pick a run, parts are coloured by pass/fail,
// click a part to see its readings. Route: /cad/:component (e.g. /cad/receptacle)
import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Bounds } from "@react-three/drei";
import CadModel, { STATUS_COLORS } from "../components/CadModel";
import PartPanel from "../components/PartPanel";
import StatusBadge from "../components/StatusBadge";
import { MODELS } from "../config/models";
import { useRuns, useRun, useRunResults, useLimits } from "../hooks/useRuns";
import "./cad.css";

// Worst result per part: any fail -> fail, otherwise pass
function statusByPart(checks = []) {
  const out = {};
  for (const c of checks) {
    if (!c.partId) continue;
    const prev = out[c.partId];
    out[c.partId] = {
      result: prev?.result === "fail" || c.result === "fail" ? "fail" : "pass",
      margin: Math.min(prev?.margin ?? Infinity, c.margin),
    };
  }
  return out;
}

export default function CadViewer() {
  const { component } = useParams();
  const config = MODELS[component];

  const runs = useRuns();
  const componentRuns = useMemo(
    () => (runs.data || []).filter((r) => r.component === config?.component),
    [runs.data, config]
  );

  const [runId, setRunId] = useState(null);
  const [selectedPart, setSelectedPart] = useState(null);

  // Default to the first run once the list arrives
  useEffect(() => {
    if (runId == null && componentRuns.length) setRunId(componentRuns[0].id);
  }, [componentRuns, runId]);

  const run = useRun(runId);
  const results = useRunResults(runId);
  const limits = useLimits();

  const partStatus = useMemo(() => statusByPart(run.data?.checks), [run.data]);

  if (!config) {
    return <div className="page"><p className="error">No CAD model configured for "{component}".</p></div>;
  }

  return (
    <div className="page">
      <div className="page__header">
        <h1>{config.title}</h1>
        {run.data && <StatusBadge status={run.data.result} />}
      </div>

      {config.placeholder && (
        <p className="notice">Placeholder model. Shapes are rough stand-ins until the real CAD arrives.</p>
      )}

      <div className="filters">
        <label>
          Simulation run
          <select value={runId ?? ""} onChange={(e) => setRunId(Number(e.target.value))}
                  disabled={!componentRuns.length}>
            {!componentRuns.length && <option value="">No runs yet</option>}
            {componentRuns.map((r) => (
              <option key={r.id} value={r.id}>#{r.id} – {r.scenarioName}</option>
            ))}
          </select>
        </label>
      </div>
      {runs.error && <p className="error">Could not load runs: {runs.error.message}</p>}

      <div className="cad">
        <div className="cad__viewport">
          <Canvas camera={{ position: [1.6, 0.8, 1.6], fov: 45 }}
                  onPointerMissed={() => setSelectedPart(null)}>
            <ambientLight intensity={0.6} />
            <directionalLight position={[3, 5, 2]} intensity={1.2} />
            <Suspense fallback={null}>
              <Bounds fit clip observe margin={1.2}>
                <CadModel url={config.url} parts={config.parts} partStatus={partStatus}
                          selectedPart={selectedPart} onSelectPart={setSelectedPart} />
              </Bounds>
            </Suspense>
            <OrbitControls makeDefault />
          </Canvas>
          <div className="cad__legend">
            <span><i style={{ background: STATUS_COLORS.pass }} /> Pass</span>
            <span><i style={{ background: STATUS_COLORS.fail }} /> Fail</span>
            <span><i style={{ background: STATUS_COLORS.none }} /> No data</span>
          </div>
        </div>

        <aside className="cad__side">
          {/* Same selection as clicking the model, and keyboard-accessible */}
          <ul className="part-list">
            {Object.entries(config.parts).map(([id, p]) => (
              <li key={id}>
                <button className={`part-list__item${selectedPart === id ? " part-list__item--active" : ""}`}
                        onClick={() => setSelectedPart(id)}>
                  <i style={{ background: STATUS_COLORS[partStatus[id]?.result ?? "none"] }} />
                  {p.label}
                </button>
              </li>
            ))}
          </ul>
          <PartPanel partId={selectedPart} parts={config.parts} run={run.data}
                     series={results.data?.series} limits={limits.data} />
        </aside>
      </div>
    </div>
  );
}
