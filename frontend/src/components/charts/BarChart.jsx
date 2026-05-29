export function BarChart({ data, color }) {
  const max = Math.max(...data.map((item) => item.v), 1);

  return (
    <div className="bar-chart">
      {data.map((item, index) => (
        <div key={index} className="bar-wrap">
          <div className="bar-stage">
            <div className="bar" style={{ height: `${(item.v / max) * 100}%`, background: color }} />
          </div>
          <span className="bar-label">{item.l}</span>
        </div>
      ))}
    </div>
  );
}
