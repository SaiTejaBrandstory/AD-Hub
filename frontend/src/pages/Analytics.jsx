import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

export default function Analytics() {
  const { activeWorkspaceId } = useAuth();
  const [series, setSeries] = useState([]);
  const [days, setDays] = useState(30);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    api.get("/analytics/timeseries", { params: { workspace_id: activeWorkspaceId, days } })
      .then(({ data }) => setSeries(data));
  }, [activeWorkspaceId, days]);

  return (
    <div className="space-y-5" data-testid="analytics-page">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-ink-400">Time-series</div>
          <h2 className="font-display font-bold text-xl mt-0.5">Performance trend</h2>
        </div>
        <div className="inline-flex bg-white border border-ink-200 rounded-lg p-0.5">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`text-xs px-3 py-1 rounded-md ${days === d ? "bg-ink text-white" : "text-ink-400 hover:text-ink"}`}
              data-testid={`range-${d}d`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-ink-200 rounded-xl p-5">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEC" vertical={false} />
              <XAxis dataKey="date" stroke="#A0A0A5" fontSize={11} tickFormatter={(d) => d.slice(5)} />
              <YAxis stroke="#A0A0A5" fontSize={11} />
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E2E2E6", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="spend" stroke="#0A0A0B" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="revenue" stroke="#30A46C" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="conversions" stroke="#0090FF" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
