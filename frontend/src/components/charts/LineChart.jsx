export function LineChart({ data, color }) {
  const max = Math.max(...data, 1);
  const w = 260;
  const h = 80;
  const pad = 4;
  const pts = data.map((value, index) => ({
    x: pad + (index / (data.length - 1)) * (w - pad * 2),
    y: pad + (1 - value / max) * (h - pad * 2),
  }));
  const path = pts.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
  const area = `${path} L${pts[pts.length - 1].x},${h} L${pts[0].x},${h} Z`;
  const gradientId = `grad-${color.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <div className="line-chart">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gradientId})`} />
        <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((point, index) => (
          <circle key={index} cx={point.x} cy={point.y} r="2.5" fill={color} />
        ))}
      </svg>
    </div>
  );
}
