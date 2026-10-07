// Draws a CAG limit as a dashed horizontal line on a chart.
//
// Note: Recharts only recognises its own components as direct children,
// so this is a function that RETURNS a ReferenceLine, not a wrapper component.
// Use it like: {limits.map(limitLine)}
import { ReferenceLine } from "recharts";

export function limitLine(limit) {
  return (
    <ReferenceLine
      key={limit.id}
      y={limit.value}
      stroke="var(--fail)"
      strokeDasharray="6 4"
      label={{
        value: `${limit.label} (${limit.value} ${limit.unit})`,
        position: "insideTopRight",
        fill: "var(--fail)",
        fontSize: 12,
      }}
    />
  );
}