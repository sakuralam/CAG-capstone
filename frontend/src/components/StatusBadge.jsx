// Small coloured pill showing pass / fail / waiting etc.
import "./components.css";

const LABELS = {
  pass: "Pass",
  fail: "Fail",
  waiting: "Waiting",
  running: "Running",
  error: "Error",
};

export default function StatusBadge({ status }) {
  const key = LABELS[status] ? status : "waiting";
  return <span className={`badge badge--${key}`}>{LABELS[key]}</span>;
}