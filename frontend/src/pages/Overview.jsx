// Home page: summary counts + grid of all scenarios with pass/fail.
import { useState } from "react";
import ScenarioCard from "../components/ScenarioCard";
import { useScenarios, useSummary } from "../hooks/useRuns";
import { useLiveUpdates } from "../hooks/useLiveUpdates";

const COMPONENTS = ["All", "LPBD", "Receptacle"];
const EVENTS = ["All", "lightning", "static"];

export default function Overview() {
  const [component, setComponent] = useState("All");
  const [eventType, setEventType] = useState("All");

  // Only send filters that are actually set
  const filters = {
    ...(component !== "All" && { component }),
    ...(eventType !== "All" && { eventType }),
  };

  const scenarios = useScenarios(filters);
  const summary = useSummary();

  const { connected } = useLiveUpdates(() => {
    scenarios.refetch();
    summary.refetch();
  });

  return (
    <div className="page">
      <div className="page__header">
        <h1>Overview</h1>
        <span className={`live ${connected ? "live--on" : ""}`}>
          {connected ? "● Live" : "○ Offline"}
        </span>
      </div>

      {summary.data && (
        <div className="stats">
          <Stat label="Scenarios" value={summary.data.total} />
          <Stat label="Passed" value={summary.data.passed} tone="pass" />
          <Stat label="Failed" value={summary.data.failed} tone="fail" />
          <Stat label="Waiting" value={summary.data.waiting} />
        </div>
      )}

      <div className="filters">
        <label>
          Component
          <select value={component} onChange={(e) => setComponent(e.target.value)}>
            {COMPONENTS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label>
          Event
          <select value={eventType} onChange={(e) => setEventType(e.target.value)}>
            {EVENTS.map((e) => <option key={e}>{e}</option>)}
          </select>
        </label>
      </div>

      {scenarios.loading && <p className="muted">Loading scenarios…</p>}
      {scenarios.error && <p className="error">Could not load scenarios: {scenarios.error.message}</p>}
      {scenarios.data && scenarios.data.length === 0 && <p className="muted">No scenarios match these filters.</p>}

      {scenarios.data && (
        <div className="grid">
          {scenarios.data.map((s) => <ScenarioCard key={s.id} scenario={s} />)}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className={`stat ${tone ? `stat--${tone}` : ""}`}>
      <span className="stat__value">{value ?? "–"}</span>
      <span className="stat__label">{label}</span>
    </div>
  );
}