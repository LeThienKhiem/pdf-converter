"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/* Palette: validated categorical slots 1–3 + status pair (see dataviz skill).
   Light aqua sits under 3:1, so every chart ships visible labels (relief rule). */
const VIZ_CSS = `
.viz-root {
  color-scheme: light;
  --plane: #f9f9f7; --surface: #fcfcfb;
  --ink: #0b0b0b; --ink-2: #52514e; --muted: #898781;
  --grid: #e1e0d9; --axis: #c3c2b7; --hairline: rgba(11,11,11,0.10);
  --s1: #2a78d6; --s2: #eb6834; --s3: #1baf7a;
  --good: #0ca30c; --critical: #d03b3b;
  --up: #006300;
  --ord-1: #86b6ef; --ord-2: #5598e7; --ord-3: #2a78d6; --ord-4: #256abf; --ord-5: #184f95;
}
@media (prefers-color-scheme: dark) {
  :root:where(:not([data-theme="light"])) .viz-root {
    color-scheme: dark;
    --plane: #0d0d0d; --surface: #1a1a19;
    --ink: #ffffff; --ink-2: #c3c2b7; --muted: #898781;
    --grid: #2c2c2a; --axis: #383835; --hairline: rgba(255,255,255,0.10);
    --s1: #3987e5; --s2: #d95926; --s3: #199e70;
    --up: #0ca30c;
    --ord-1: #184f95; --ord-2: #256abf; --ord-3: #2a78d6; --ord-4: #3987e5; --ord-5: #5598e7;
  }
}
:root[data-theme="dark"] .viz-root {
  color-scheme: dark;
  --plane: #0d0d0d; --surface: #1a1a19;
  --ink: #ffffff; --ink-2: #c3c2b7; --muted: #898781;
  --grid: #2c2c2a; --axis: #383835; --hairline: rgba(255,255,255,0.10);
  --s1: #3987e5; --s2: #d95926; --s3: #199e70;
  --up: #0ca30c;
  --ord-1: #184f95; --ord-2: #256abf; --ord-3: #2a78d6; --ord-4: #3987e5; --ord-5: #5598e7;
}
`;

type Daily = {
  date: string;
  success: number;
  failed: number;
  excel: number;
  bank: number;
  gsheet: number;
  signups: number;
  impressions: number;
  clicks: number;
};

type Metrics = {
  days: number;
  daily: Daily[];
  totals: {
    extractions: { now: number; prev: number };
    success: { now: number; prev: number };
    failed: { now: number; prev: number };
    successRate: { now: number | null; prev: number | null };
    signups: { now: number; prev: number };
    impressions: number;
    clicks: number;
    revenueUsd: number;
    paidUsers: number;
    totalUsers: number;
  };
  funnel: { stage: string; count: number }[];
  errors: { code: string; count: number }[];
  latency: { p50: number | null; p95: number | null; samples: number };
  cost: { usd: number; samples: number; perExtraction: number | null };
  powerUsers: { email: string; count: number }[];
  gscConnected: boolean;
};

const W = 720;
const H = 200;
const PAD = { top: 14, right: 12, bottom: 26, left: 38 };

function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}

function niceMax(v: number): number {
  if (v <= 5) return 5;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / mag) * mag;
}

/* ── Stat tile ─────────────────────────────────────────────────────────── */
function StatTile({
  label,
  value,
  delta,
  spark,
  suffix,
  note,
}: {
  label: string;
  value: string;
  delta?: number | null;
  spark?: number[];
  suffix?: string;
  note?: string;
}) {
  const max = spark && spark.length > 0 ? Math.max(...spark, 1) : 1;
  const pts =
    spark && spark.length > 1
      ? spark
          .map((v, i) => `${(i / (spark.length - 1)) * 100},${28 - (v / max) * 24}`)
          .join(" ")
      : null;

  return (
    <div
      className="rounded-xl border p-4"
      style={{ background: "var(--surface)", borderColor: "var(--hairline)" }}
    >
      <p className="text-xs font-medium" style={{ color: "var(--ink-2)" }}>
        {label}
      </p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight" style={{ color: "var(--ink)" }}>
          {value}
          {suffix && <span className="ml-0.5 text-base font-semibold">{suffix}</span>}
        </span>
        {delta != null && Number.isFinite(delta) && (
          <span
            className="text-xs font-semibold"
            style={{ color: delta >= 0 ? "var(--up)" : "var(--critical)" }}
          >
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}%
          </span>
        )}
      </div>
      {pts && (
        <svg viewBox="0 0 100 30" className="mt-2 h-7 w-full" preserveAspectRatio="none" aria-hidden>
          <polyline points={pts} fill="none" stroke="var(--s1)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg>
      )}
      {note && (
        <p className="mt-1 text-[11px]" style={{ color: "var(--muted)" }}>
          {note}
        </p>
      )}
    </div>
  );
}

/* ── Stacked bar chart ─────────────────────────────────────────────────── */
function StackedBars({
  title,
  subtitle,
  data,
  series,
}: {
  title: string;
  subtitle?: string;
  data: Daily[];
  series: { key: keyof Daily; label: string; color: string }[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const totals = data.map((d) => series.reduce((a, s) => a + Number(d[s.key]), 0));
  const max = niceMax(Math.max(...totals, 1));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const slot = plotW / Math.max(data.length, 1);
  const barW = Math.max(3, Math.min(22, slot - 3));
  const ticks = [0, max / 2, max];
  const anyData = totals.some((t) => t > 0);

  return (
    <figure
      className="rounded-xl border p-4"
      style={{ background: "var(--surface)", borderColor: "var(--hairline)" }}
    >
      <figcaption className="mb-1">
        <h3 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{title}</h3>
        {subtitle && <p className="text-xs" style={{ color: "var(--muted)" }}>{subtitle}</p>}
      </figcaption>

      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
        {series.map((s) => {
          const sum = data.reduce((a, d) => a + Number(d[s.key]), 0);
          return (
            <span key={String(s.key)} className="inline-flex items-center gap-1.5 text-xs" style={{ color: "var(--ink-2)" }}>
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />
              {s.label}
              <span className="font-semibold tabular-nums" style={{ color: "var(--ink)" }}>{sum}</span>
            </span>
          );
        })}
      </div>

      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={title}>
          {ticks.map((t, i) => {
            const y = PAD.top + plotH - (t / max) * plotH;
            return (
              <g key={i}>
                <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke={i === 0 ? "var(--axis)" : "var(--grid)"} strokeWidth={1} />
                <text x={PAD.left - 6} y={y + 3} textAnchor="end" fontSize={10} fill="var(--muted)" className="tabular-nums">
                  {Math.round(t)}
                </text>
              </g>
            );
          })}

          {data.map((d, i) => {
            const cx = PAD.left + slot * i + slot / 2;
            let yCursor = PAD.top + plotH;
            const stackTotal = totals[i]!;
            return (
              <g key={d.date}>
                {series.map((s) => {
                  const v = Number(d[s.key]);
                  if (v <= 0) return null;
                  const h = (v / max) * plotH;
                  yCursor -= h;
                  const isTop = yCursor <= PAD.top + plotH - (stackTotal / max) * plotH + 0.5;
                  return (
                    <rect
                      key={String(s.key)}
                      x={cx - barW / 2}
                      y={yCursor}
                      width={barW}
                      height={Math.max(h - 2, 1)} /* 2px surface gap between segments */
                      rx={isTop ? 4 : 0}
                      fill={s.color}
                      opacity={hover === null || hover === i ? 1 : 0.35}
                    />
                  );
                })}
                <rect
                  x={PAD.left + slot * i}
                  y={PAD.top}
                  width={slot}
                  height={plotH}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                />
              </g>
            );
          })}

          {data.map((d, i) =>
            i % Math.ceil(data.length / 8) === 0 ? (
              <text
                key={d.date}
                x={PAD.left + slot * i + slot / 2}
                y={H - 8}
                textAnchor="middle"
                fontSize={10}
                fill="var(--muted)"
              >
                {shortDate(d.date)}
              </text>
            ) : null
          )}

          {!anyData && (
            <text x={W / 2} y={H / 2} textAnchor="middle" fontSize={12} fill="var(--muted)">
              No data in this range
            </text>
          )}
        </svg>

        {hover != null && data[hover] && (
          <div
            className="pointer-events-none absolute top-1 rounded-lg border px-2.5 py-1.5 text-xs shadow-sm"
            style={{
              background: "var(--surface)",
              borderColor: "var(--hairline)",
              color: "var(--ink)",
              left: `${Math.min(80, (hover / Math.max(data.length - 1, 1)) * 100)}%`,
            }}
          >
            <div className="font-semibold">{data[hover]!.date}</div>
            {series.map((s) => (
              <div key={String(s.key)} className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-sm" style={{ background: s.color }} aria-hidden />
                <span style={{ color: "var(--ink-2)" }}>{s.label}</span>
                <span className="ml-auto font-semibold tabular-nums">{Number(data[hover]![s.key])}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </figure>
  );
}

/* ── Single-series area/line ───────────────────────────────────────────── */
function AreaChart({
  title,
  subtitle,
  data,
  valueKey,
  empty,
}: {
  title: string;
  subtitle?: string;
  data: Daily[];
  valueKey: keyof Daily;
  empty?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const values = data.map((d) => Number(d[valueKey]));
  const max = niceMax(Math.max(...values, 1));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (i / Math.max(data.length - 1, 1)) * plotW;
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const line = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
  const area = `${line} L${x(values.length - 1)},${PAD.top + plotH} L${x(0)},${PAD.top + plotH} Z`;
  const hasData = values.some((v) => v > 0);

  return (
    <figure
      className="rounded-xl border p-4"
      style={{ background: "var(--surface)", borderColor: "var(--hairline)" }}
    >
      <figcaption className="mb-2">
        <h3 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{title}</h3>
        {subtitle && <p className="text-xs" style={{ color: "var(--muted)" }}>{subtitle}</p>}
      </figcaption>

      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={title}>
          {[0, max / 2, max].map((t, i) => {
            const yy = y(t);
            return (
              <g key={i}>
                <line x1={PAD.left} x2={W - PAD.right} y1={yy} y2={yy} stroke={i === 0 ? "var(--axis)" : "var(--grid)"} strokeWidth={1} />
                <text x={PAD.left - 6} y={yy + 3} textAnchor="end" fontSize={10} fill="var(--muted)" className="tabular-nums">
                  {Math.round(t)}
                </text>
              </g>
            );
          })}

          {hasData && (
            <>
              <path d={area} fill="var(--s1)" opacity={0.12} />
              <path d={line} fill="none" stroke="var(--s1)" strokeWidth={2} strokeLinejoin="round" />
              {hover != null && (
                <>
                  <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} stroke="var(--axis)" strokeWidth={1} />
                  <circle cx={x(hover)} cy={y(values[hover]!)} r={4.5} fill="var(--s1)" stroke="var(--surface)" strokeWidth={2} />
                </>
              )}
            </>
          )}

          {!hasData && (
            <text x={W / 2} y={H / 2} textAnchor="middle" fontSize={12} fill="var(--muted)">
              {empty ?? "No data in this range"}
            </text>
          )}

          {data.map((d, i) => (
            <rect
              key={d.date}
              x={PAD.left + (i / Math.max(data.length, 1)) * plotW}
              y={PAD.top}
              width={plotW / Math.max(data.length, 1)}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}

          {data.map((d, i) =>
            i % Math.ceil(data.length / 8) === 0 ? (
              <text key={d.date} x={x(i)} y={H - 8} textAnchor="middle" fontSize={10} fill="var(--muted)">
                {shortDate(d.date)}
              </text>
            ) : null
          )}
        </svg>

        {hover != null && data[hover] && (
          <div
            className="pointer-events-none absolute top-1 rounded-lg border px-2.5 py-1.5 text-xs shadow-sm"
            style={{
              background: "var(--surface)",
              borderColor: "var(--hairline)",
              color: "var(--ink)",
              left: `${Math.min(80, (hover / Math.max(data.length - 1, 1)) * 100)}%`,
            }}
          >
            <div className="font-semibold">{data[hover]!.date}</div>
            <div className="tabular-nums">{Number(data[hover]![valueKey])}</div>
          </div>
        )}
      </div>
    </figure>
  );
}

/* ── Funnel (ordered stages → ordinal ramp) ────────────────────────────── */
function Funnel({ stages }: { stages: { stage: string; count: number }[] }) {
  const max = Math.max(...stages.map((s) => s.count), 1);
  const ramp = ["var(--ord-1)", "var(--ord-2)", "var(--ord-3)", "var(--ord-4)", "var(--ord-5)"];

  return (
    <figure
      className="rounded-xl border p-4"
      style={{ background: "var(--surface)", borderColor: "var(--hairline)" }}
    >
      <figcaption className="mb-3">
        <h3 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Conversion funnel</h3>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          Step-to-step rate on the right — the smallest one is the bottleneck
        </p>
      </figcaption>
      <div className="space-y-2.5">
        {stages.map((s, i) => {
          const prev = i > 0 ? stages[i - 1]!.count : null;
          const stepRate = prev && prev > 0 ? (s.count / prev) * 100 : null;
          const pct = (s.count / max) * 100;
          return (
            <div key={s.stage}>
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span style={{ color: "var(--ink-2)" }}>{s.stage}</span>
                <span className="flex items-baseline gap-2">
                  <span className="font-semibold tabular-nums" style={{ color: "var(--ink)" }}>
                    {s.count.toLocaleString()}
                  </span>
                  {stepRate != null && (
                    <span className="tabular-nums" style={{ color: stepRate < 5 ? "var(--critical)" : "var(--muted)" }}>
                      {stepRate < 0.1 && stepRate > 0 ? "<0.1" : stepRate.toFixed(1)}%
                    </span>
                  )}
                </span>
              </div>
              <div className="mt-1 h-3 w-full overflow-hidden rounded" style={{ background: "var(--grid)" }}>
                <div
                  className="h-full rounded"
                  style={{ width: `${Math.max(pct, s.count > 0 ? 1.5 : 0)}%`, background: ramp[i] ?? ramp[4] }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </figure>
  );
}

/* ── Dashboard ─────────────────────────────────────────────────────────── */
export default function AdminDashboard({ email }: { email: string }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (d: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/metrics?days=${d}`);
      if (!res.ok) throw new Error(res.status === 403 ? "Forbidden" : `Request failed (${res.status})`);
      setData((await res.json()) as Metrics);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load metrics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(days);
  }, [days, load]);

  const pctDelta = useCallback((now: number, prev: number): number | null => {
    if (!prev) return null;
    return Math.round(((now - prev) / prev) * 100);
  }, []);

  const successSpark = useMemo(() => data?.daily.map((d) => d.success) ?? [], [data]);
  const signupSpark = useMemo(() => data?.daily.map((d) => d.signups) ?? [], [data]);

  return (
    <div className="viz-root min-h-screen" style={{ background: "var(--plane)" }}>
      <style dangerouslySetInnerHTML={{ __html: VIZ_CSS }} />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--ink)" }}>
              Performance
            </h1>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Signed in as {email}
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-lg border p-1" style={{ borderColor: "var(--hairline)", background: "var(--surface)" }}>
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className="rounded px-3 py-1.5 text-sm font-medium transition-colors"
                style={{
                  background: days === d ? "var(--s1)" : "transparent",
                  color: days === d ? "#fff" : "var(--ink-2)",
                }}
              >
                {d}d
              </button>
            ))}
          </div>
        </header>

        {error && (
          <p className="rounded-xl border px-4 py-3 text-sm" style={{ borderColor: "var(--critical)", color: "var(--critical)" }}>
            {error}
          </p>
        )}

        {loading && !data && (
          <p className="text-sm" style={{ color: "var(--muted)" }}>Loading…</p>
        )}

        {data && (
          <div className="space-y-5">
            {/* KPI row */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatTile
                label={`Conversions (${days}d)`}
                value={String(data.totals.success.now)}
                delta={pctDelta(data.totals.success.now, data.totals.success.prev)}
                spark={successSpark}
                note={`${data.totals.failed.now} failed`}
              />
              <StatTile
                label={`New users (${days}d)`}
                value={String(data.totals.signups.now)}
                delta={pctDelta(data.totals.signups.now, data.totals.signups.prev)}
                spark={signupSpark}
                note={`${data.totals.totalUsers} total`}
              />
              <StatTile
                label="Success rate"
                value={data.totals.successRate.now == null ? "—" : String(data.totals.successRate.now)}
                suffix={data.totals.successRate.now == null ? undefined : "%"}
                delta={
                  data.totals.successRate.now != null && data.totals.successRate.prev
                    ? Math.round(data.totals.successRate.now - data.totals.successRate.prev)
                    : null
                }
                note={
                  data.latency.p50 != null
                    ? `p50 ${(data.latency.p50 / 1000).toFixed(1)}s · p95 ${((data.latency.p95 ?? 0) / 1000).toFixed(1)}s`
                    : "latency: no samples yet"
                }
              />
              <StatTile
                label={`Revenue (${days}d)`}
                value={`$${data.totals.revenueUsd.toFixed(2)}`}
                note={
                  data.cost.perExtraction != null
                    ? `${data.totals.paidUsers} paid · AI cost $${data.cost.usd.toFixed(2)}`
                    : `${data.totals.paidUsers} paid users`
                }
              />
            </div>

            {/* Funnel + impressions */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Funnel stages={data.funnel} />
              <AreaChart
                title="Daily search impressions"
                subtitle={data.gscConnected ? "Google Search Console" : undefined}
                data={data.daily}
                valueKey="impressions"
                empty={data.gscConnected ? "No impressions in this range" : "Search Console not connected yet"}
              />
            </div>

            {/* Conversions by tool + success/fail */}
            <StackedBars
              title="Daily conversions by tool"
              subtitle="Successful extractions only"
              data={data.daily}
              series={[
                { key: "excel", label: "PDF → Excel", color: "var(--s1)" },
                { key: "bank", label: "Bank statement", color: "var(--s2)" },
                { key: "gsheet", label: "Google Sheets", color: "var(--s3)" },
              ]}
            />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <StackedBars
                title="Success vs failed"
                subtitle="Every extraction attempt"
                data={data.daily}
                series={[
                  { key: "success", label: "✓ Success", color: "var(--good)" },
                  { key: "failed", label: "✕ Failed", color: "var(--critical)" },
                ]}
              />
              <AreaChart title="Daily new users" data={data.daily} valueKey="signups" />
            </div>

            {/* Tables */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--hairline)" }}>
                <h3 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Failure reasons</h3>
                <p className="mb-3 text-xs" style={{ color: "var(--muted)" }}>
                  Only rows logged after the telemetry rollout carry a reason
                </p>
                {data.errors.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--good)" }}>No failures in this range 🎉</p>
                ) : (
                  <table className="w-full text-sm">
                    <tbody>
                      {data.errors.map((e) => (
                        <tr key={e.code} className="border-t" style={{ borderColor: "var(--hairline)" }}>
                          <td className="py-1.5" style={{ color: "var(--ink-2)" }}>{e.code}</td>
                          <td className="py-1.5 text-right font-semibold tabular-nums" style={{ color: "var(--ink)" }}>{e.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--hairline)" }}>
                <h3 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Power users</h3>
                <p className="mb-3 text-xs" style={{ color: "var(--muted)" }}>
                  Most successful conversions — your manual-outreach list
                </p>
                {data.powerUsers.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--muted)" }}>No signed-in conversions yet</p>
                ) : (
                  <table className="w-full text-sm">
                    <tbody>
                      {data.powerUsers.map((u) => (
                        <tr key={u.email} className="border-t" style={{ borderColor: "var(--hairline)" }}>
                          <td className="truncate py-1.5" style={{ color: "var(--ink-2)" }}>{u.email}</td>
                          <td className="py-1.5 text-right font-semibold tabular-nums" style={{ color: "var(--ink)" }}>{u.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <p className="pt-2 text-xs" style={{ color: "var(--muted)" }}>
              Impressions and clicks come from Search Console; everything else is server-side
              telemetry from the extraction log. Deltas compare with the previous {days}-day window.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
