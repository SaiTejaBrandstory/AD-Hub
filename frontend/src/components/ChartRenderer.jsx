import { AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

const COLORS = ["#0A0A0B", "#30A46C", "#0090FF", "#F5901A", "#E5484D", "#A0A0A5"];

export default function ChartRenderer({ spec, digest }) {
  const source = spec.data_source === "top_campaigns" ? digest.top_campaigns : digest.timeseries;
  if (!source || source.length === 0) {
    return (
      <div className="text-center text-xs text-ink-400 h-full flex items-center justify-center">
        No data for this chart
      </div>
    );
  }
  const xKey = spec.x || (spec.data_source === "top_campaigns" ? "campaign" : "date");
  const yKeys = Array.isArray(spec.y) ? spec.y : [spec.y];

  const common = {
    data: source,
    margin: { top: 5, right: 10, bottom: 0, left: -15 },
  };

  if (spec.type === "area") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart {...common}>
          <defs>
            {yKeys.map((k, i) => (
              <linearGradient key={k} id={`grad-${spec.title}-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS[i]} stopOpacity={0.22} />
                <stop offset="95%" stopColor={COLORS[i]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEC" vertical={false} />
          <XAxis dataKey={xKey} stroke="#A0A0A5" fontSize={10}
                 tickFormatter={(d) => typeof d === "string" && d.length > 10 ? d.slice(5) : d} />
          <YAxis stroke="#A0A0A5" fontSize={10} />
          <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E2E2E6", borderRadius: 8, fontSize: 12 }} />
          {yKeys.map((k, i) => (
            <Area key={k} type="monotone" dataKey={k} stroke={COLORS[i]} strokeWidth={2}
                  fill={`url(#grad-${spec.title}-${i})`} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  if (spec.type === "line") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart {...common}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEC" vertical={false} />
          <XAxis dataKey={xKey} stroke="#A0A0A5" fontSize={10} />
          <YAxis stroke="#A0A0A5" fontSize={10} />
          <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E2E2E6", borderRadius: 8, fontSize: 12 }} />
          {yKeys.map((k, i) => (
            <Line key={k} type="monotone" dataKey={k} stroke={COLORS[i]} strokeWidth={2} dot={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (spec.type === "pie") {
    const pieData = source.map((d) => ({ name: d[xKey], value: d[yKeys[0]] || 0 }));
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={75} paddingAngle={2}>
            {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E2E2E6", borderRadius: 8, fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  // default: bar
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart {...common}>
        <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEC" vertical={false} />
        <XAxis dataKey={xKey} stroke="#A0A0A5" fontSize={9}
               interval={0} angle={source.length > 6 ? -20 : 0} textAnchor={source.length > 6 ? "end" : "middle"}
               height={source.length > 6 ? 60 : 30} />
        <YAxis stroke="#A0A0A5" fontSize={10} />
        <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E2E2E6", borderRadius: 8, fontSize: 12 }} />
        {yKeys.map((k, i) => (
          <Bar key={k} dataKey={k} fill={COLORS[i]} radius={[6, 6, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
