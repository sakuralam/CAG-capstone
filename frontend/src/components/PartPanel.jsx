// Readings panels for the CAD page.
//   PartPanel   – readings for the selected part in the selected run
//   SystemPanel – whole-system readings (partId: null), e.g. earth resistance
import StatusBadge from "./StatusBadge";
import TimeSeriesChart from "./TimeSeriesChart";

function ChecksTable({ checks }) {
  return (
    <table className="table">
      <thead>
        <tr><th>Check</th><th>Value</th><th>Limit</th><th>Margin</th><th>Result</th></tr>
      </thead>
      <tbody>
        {checks.map((c) => (
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
  );
}

function Readings({ checks, series, limits }) {
  const limitsFor = (metric) => (limits || []).filter((l) => l.metric === metric);
  return (
    <>
      {checks.length > 0 && <ChecksTable checks={checks} />}
      {series.map((s) => (
        <TimeSeriesChart key={s.id ?? s.metric} title={s.label} series={s}
                         limits={limitsFor(s.metric)} timeUnit={s.timeUnit} />
      ))}
    </>
  );
}

export default function PartPanel({ partId, parts, run, series, limits }) {
  if (!partId) {
    return <p className="muted">Click a part on the model, or pick one from the list, to see its readings.</p>;
  }

  const checks = (run?.checks || []).filter((c) => c.partId === partId);
  const partSeries = (series || []).filter((s) => s.partId === partId);

  return (
    <div className="part-panel">
      <h2>{parts[partId]?.label ?? partId}</h2>
      {checks.length === 0 && partSeries.length === 0 ? (
        <p className="muted">No readings for this part in this run.</p>
      ) : (
        <Readings checks={checks} series={partSeries} limits={limits} />
      )}
    </div>
  );
}

export function SystemPanel({ run, series, limits }) {
  const checks = (run?.checks || []).filter((c) => !c.partId);
  const systemSeries = (series || []).filter((s) => !s.partId);
  if (checks.length === 0 && systemSeries.length === 0) return null;

  return (
    <div className="part-panel">
      <h2>System readings</h2>
      <p className="muted small">The whole earthing system, not tied to one part.</p>
      <Readings checks={checks} series={systemSeries} limits={limits} />
    </div>
  );
}
