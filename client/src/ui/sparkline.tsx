
function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

export function Sparkline({
  values,
  width = 240,
  height = 64,
}: {
  values: number[];
  width?: number;
  height?: number;
}) {
  if (values.length < 2) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <rect x="0" y="0" width={width} height={height} fill="transparent" />
      </svg>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);

  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / span) * height;
    return [x, clamp(y, 2, height - 2)] as const;
  });

  const d = `M ${pts.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(" L ")}`;
  const area = `${d} L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.8" />
          <stop offset="100%" stopColor="hsl(var(--primary-2))" stopOpacity="0.8" />
        </linearGradient>
        <linearGradient id="a" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.25" />
          <stop offset="100%" stopColor="hsl(var(--primary-2))" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      <path d={area} fill="url(#a)" />
      <path d={d} fill="none" stroke="url(#g)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3.5" fill="hsl(var(--text))" />
    </svg>
  );
}

