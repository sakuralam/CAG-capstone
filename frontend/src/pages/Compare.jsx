// Prototype vs CAG baseline: pick two runs, compare each metric side by side.
import { useState } from "react";
import StatusBadge from "../components/StatusBadge";
import { useRuns } from "../hooks/useRuns";
import { useApi } from "../hooks/useApi";
import { compareRuns } from "../api/api";

export default function Compare() {
  const runs = useRuns();
  const [prototypeId, setPrototypeId] = useState("");
  const [baselineId, setBaselineId] = useState("");

  const ready = prototypeId && baselineId;
  const comparison = useApi(compareRuns, [Number(prototypeId), Number(baselineId)], { enabled: !!ready });

  const runOptions = (runs.data || []).map((r) => (
    <option key={r.id} value={r.id}>#{r.id} – {r.scenarioName}</option>
  ));

  return (
    <div className="page">
      <h1>Compare</h1>

      <div className="filters">
        <label>
          Prototype run
          <select value={prototypeId} onChange={(e) => setPrototypeId(e.target.value)}>
            <option value="">Select…</option>
            {runOptions}
          </select>
        </label>
        <label>
          Baseline run (current CAG setup)
          <select value={baselineId} onChange={(e) => setBaselineId(e.target.value)}>
            <option value="">Select…</option>
            {runOptions}
          </select>
        </label>
      </div>

      {!ready && <p className="muted">Pick two runs to compare.</p>}
      {comparison.loading && ready && <p className="muted">Comparing…</p>}
      {comparison.error && <p className="error">Could not compare: {comparison.error.message}</p>}

      {ready && comparison.data && (
        <table className="table">
          <thead>
            <tr><th>Metric</th><th>Prototype</th><th>Baseline</th><th>Difference</th><th>Limit</th></tr>
          </thead>
          <tbody>
            {comparison.data.metrics.map((m) => {
              const diff = m.prototype.value - m.baseline.value;
              return (
                <tr key={m.metric}>
                  <td>{m.label}</td>
                  <td>{m.prototype.value} {m.unit} <StatusBadge status={m.prototype.result} /></td>
                  <td>{m.baseline.value} {m.unit} <StatusBadge status={m.baseline.result} /></td>
                  <td>{diff > 0 ? "+" : ""}{diff.toFixed(2)} {m.unit}</td>
                  <td>{m.limit} {m.unit}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}