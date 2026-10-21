// One run: metadata, pass/fail checks table, and a chart per result series.
import { useParams, Link } from "react-router-dom";
import StatusBadge from "../components/StatusBadge";
import TimeSeriesChart from "../components/TimeSeriesChart";
import { useRun, useRunResults, useLimits } from "../hooks/useRuns";

export default function RunDetail() {
  const { runId } = useParams();
  const id = Number(runId);

  const run = useRun(id);
  const results = useRunResults(id);
  const limits = useLimits();

  if (run.loading) return <div className="page"><p className="muted">Loading run…</p></div>;
  if (run.error) {
    return (
      <div className="page">
        <p className="error">Could not load run {runId}: {run.error.message}</p>
        <Link to="/">Back to overview</Link>
      </div>
    );
  }
  if (!run.data) return null;

  const r = run.data;
  // Show only the limits that belong to each chart's metric
  const limitsFor = (metric) => (limits.data || []).filter((l) => l.metric === metric);

  return (
    <div className="page">
      <Link to="/" className="back">← Overview</Link>
      <div className="page__header">
        <h1>{r.scenarioName}</h1>
        <StatusBadge status={r.result} />
      </div>

      <dl className="meta">
        <div><dt>Run ID</dt><dd>{r.id}</dd></div>
        <div><dt>Source</dt><dd>{r.source}</dd></div>
        <div><dt>Ingested</dt><dd>{new Date(r.createdAt).toLocaleString()}</dd></div>
        <div><dt>Parser version</dt><dd>{r.parserVersion}</dd></div>
        <div className="meta__wide">
          <dt>File hash (SHA-256)</dt>
          <dd className="mono">{r.fileHash}</dd>
        </div>
      </dl>

      <h2>Checks</h2>
      <table className="table">
        <thead>
          <tr><th>Check</th><th>Value</th><th>Limit</th><th>Margin</th><th>Result</th></tr>
        </thead>
        <tbody>
          {r.checks.map((c) => (
            // id is unique per limit + part (one limit can apply to two straps)
            <tr key={c.id ?? c.limitId}>
              <td>{c.label}</td>
              <td>{c.value} {c.unit}</td>
              <td>{c.limit} {c.unit}</td>
              <td>{c.margin > 0 ? "+" : ""}{c.margin}%</td>
              <td><StatusBadge status={c.result} /></td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Results</h2>
      {results.loading && <p className="muted">Loading charts…</p>}
      {results.error && <p className="error">Could not load results: {results.error.message}</p>}
      <div className="charts">
        {results.data?.series.map((s) => (
          <TimeSeriesChart key={s.id ?? s.metric} title={s.label} series={s}
                           limits={limitsFor(s.metric)} timeUnit={s.timeUnit} />
        ))}
      </div>
    </div>
  );
}
