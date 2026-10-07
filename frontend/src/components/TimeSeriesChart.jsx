// Line chart for one result series (e.g. strap current over time),
// with optional limit lines drawn on top.
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from "recharts";
import { limitLine } from "./LimitLine";
import "./components.css";

export default function TimeSeriesChart({ title, series, limits = [], timeUnit = "µs" }) {
  if (!series || !series.points?.length) {
    return (
      <div className="chart chart--empty">
        <h3 className="chart__title">{title}</h3>
        <p>No data yet.</p>
      </div>
    );
  }

  const { unit, points } = series;

  return (
    <div className="chart">
      <h3 className="chart__title">{title}</h3>
      {/* ResponsiveContainer needs a parent with a fixed height (set in CSS) */}
      <div className="chart__body">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
            <XAxis
              dataKey="t"
              label={{ value: `Time (${timeUnit})`, position: "insideBottom", offset: -10 }}
            />
            <YAxis label={{ value: unit, angle: -90, position: "insideLeft" }} />
            <Tooltip
              formatter={(value) => [`${value} ${unit}`, series.label]}
              labelFormatter={(t) => `t = ${t} ${timeUnit}`}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--accent)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            {limits.map(limitLine)}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}