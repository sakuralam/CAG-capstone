// One card per scenario on the Overview page.
// Clicking it opens the latest run (if there is one).
import { Link } from "react-router-dom";
import StatusBadge from "./StatusBadge";
import "./components.css";

export default function ScenarioCard({ scenario }) {
  const { name, component, eventType, condition, status, result, latestRunId, margin } = scenario;

  // Show pass/fail once done, otherwise the progress status
  const badgeStatus = status === "done" ? result : status;

  const content = (
    <>
      <div className="card__header">
        <h3 className="card__title">{name}</h3>
        <StatusBadge status={badgeStatus} />
      </div>
      <dl className="card__meta">
        <div><dt>Component</dt><dd>{component}</dd></div>
        <div><dt>Event</dt><dd>{eventType}</dd></div>
        <div><dt>Condition</dt><dd>{condition}</dd></div>
        {margin != null && (
          <div><dt>Margin</dt><dd>{margin > 0 ? "+" : ""}{margin}%</dd></div>
        )}
      </dl>
    </>
  );

  // Only clickable when there's a result to open
  return latestRunId ? (
    <Link to={`/runs/${latestRunId}`} className="card card--link">{content}</Link>
  ) : (
    <div className="card card--disabled">{content}</div>
  );
}