// Read-only for now. Editing comes later, once the backend can check who's allowed.
import { useLimits } from "../hooks/useRuns";

export default function Limits() {
  const limits = useLimits();

  return (
    <div className="page">
      <h1>Limits</h1>
      <p className="muted">
        Pass/fail thresholds. Placeholder values until CAG confirms the real ones.
      </p>

      {limits.loading && <p className="muted">Loading limits…</p>}
      {limits.error && <p className="error">Could not load limits: {limits.error.message}</p>}

      {limits.data && (
        <table className="table">
          <thead>
            <tr><th>Check</th><th>Metric</th><th>Limit</th><th>Version</th></tr>
          </thead>
          <tbody>
            {limits.data.map((l) => (
              <tr key={l.id}>
                <td>{l.label}</td>
                <td className="mono">{l.metric}</td>
                <td>{l.value} {l.unit}</td>
                <td>{l.version ?? "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}