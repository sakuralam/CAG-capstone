// Side panel: readings for the selected part in the selected run.
import StatusBadge from "./StatusBadge";
import TimeSeriesChart from "./TimeSeriesChart";

export default function PartPanel({ partId, parts, run, series, limits }) {
  if (!partId) {
    return <p className="muted">Click a part on the model, or pick one from the list, to see its readings.</p>;
  }

  const checks = (run?.checks || []).filter((c) => c.partId === partId);
  const partSeries = (series || []).filter((s) => s.partId === partId);
  const limitsFor = (metric) => (limits || []).filter((l) => l.metric === metric);

  return (
    <div className="part-panel">
      <h2>{parts[partId]?.label ?? partId}</h2>

      {checks.length === 0 && partSeries.length === 0 && (
        <p className="muted">No readings for this part in this run.</p>
      )}

      {checks.length > 0 && (
        <table className="table">
          <thead>
            <tr><th>Check</th><th>Value</th><th>Limit</th><th>Margin</th><th>Result</th></tr>
          </thead>
          <tbody>
            {checks.map((c) => (
              <tr key={c.limitId}>
                <td>{c.label}</td>
                <td>{c.value} {c.unit}</td>
                <td>{c.limit} {c.unit}</td>
                <td>{c.margin > 0 ? "+" : ""}{c.margin}%</td>
                <td><StatusBadge status={c.result} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {partSeries.map((s) => (
        <TimeSeriesChart key={s.metric} title={s.label} series={s}
                         limits={limitsFor(s.metric)} timeUnit={s.timeUnit} />
      ))}
    </div>
  );
}
