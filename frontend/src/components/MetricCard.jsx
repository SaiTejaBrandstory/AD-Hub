import { ArrowUpRight, ArrowDownRight } from "@phosphor-icons/react";

export default function MetricCard({ label, value, delta, deltaType = "up", unit = "", testid }) {
  const positive = deltaType === "up";
  return (
    <div
      className="bg-white border border-ink-200 rounded-xl p-4 sm:p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition-all"
      data-testid={testid}
    >
      <div className="text-[10px] uppercase tracking-[0.2em] text-ink-400 font-medium">{label}</div>
      <div className="mt-2.5 flex items-baseline gap-1">
        <span className="font-num font-bold text-2xl text-ink leading-none tracking-tight">{value}</span>
        {unit && <span className="font-num text-sm text-ink-400">{unit}</span>}
      </div>
      {delta !== undefined && delta !== null && (
        <div className={`mt-2 inline-flex items-center gap-1 text-[11px] font-medium ${positive ? "text-success" : "text-danger"}`}>
          {positive ? <ArrowUpRight size={12} weight="bold" /> : <ArrowDownRight size={12} weight="bold" />}
          <span className="font-num">{delta}</span>
        </div>
      )}
    </div>
  );
}
