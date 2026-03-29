import { useState, useEffect } from "react";

type AdminTableSummary = {
  name: string;
  rowCount?: number;
  error?: string;
};

type AdminSummaryResponse = {
  tables: AdminTableSummary[];
};

interface ActivityEvent {
  id: number;
  created_at: string;
  type: string;
  description?: string;
  details?: { evaluated?: number; errors?: number; [key: string]: any } | null;
}

type AdminActivityResponse = {
  events: ActivityEvent[];
  message?: string;
};

interface ChartPoint {
  date: string;
  evaluatedSum: number;
}

const API_BASE = "";
const ADMIN_TOKEN = (import.meta as any).env?.VITE_ADMIN_ACCESS_TOKEN || "";

function adminHeaders(): HeadersInit {
  const headers: Record<string, string> = {};
  if (ADMIN_TOKEN) headers["x-admin-token"] = ADMIN_TOKEN;
  return headers;
}

function buildEvaluationTimeline(events: ActivityEvent[]): ChartPoint[] {
  const byDate: Record<string, number> = {};

  for (const ev of events) {
    if (ev.type !== "stock_forecast_evaluated") continue;
    const d = ev.created_at.split("T")[0];
    const evaluated = (ev.details && typeof ev.details.evaluated === "number")
      ? ev.details.evaluated
      : 0;
    byDate[d] = (byDate[d] || 0) + evaluated;
  }

  return Object.entries(byDate)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, evaluatedSum]) => ({ date, evaluatedSum }));
}

function EvaluationTimeline({ data }: { data: ChartPoint[] }) {
  if (data.length === 0) {
    return (
      <p style={{ color: "#6b7280", fontSize: "14px" }}>
        No stock forecast evaluations yet. Run an evaluation to start the timeline.
      </p>
    );
  }

  const width = 600;
  const height = 200;
  const padL = 50;
  const padR = 20;
  const padT = 20;
  const padB = 40;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  const maxVal = Math.max(...data.map(d => d.evaluatedSum), 1);
  const barWidth = Math.max(Math.min(chartW / data.length - 4, 40), 8);

  return (
    <svg width={width} height={height} style={{ display: "block", maxWidth: "100%" }}>
      <line x1={padL} y1={padT} x2={padL} y2={padT + chartH} stroke="#e5e7eb" strokeWidth={1} />
      <line x1={padL} y1={padT + chartH} x2={padL + chartW} y2={padT + chartH} stroke="#e5e7eb" strokeWidth={1} />

      {[0, 0.25, 0.5, 0.75, 1].map(frac => {
        const y = padT + chartH - frac * chartH;
        const val = Math.round(frac * maxVal);
        return (
          <g key={frac}>
            <line x1={padL} y1={y} x2={padL + chartW} y2={y} stroke="#f3f4f6" strokeWidth={0.5} />
            <text x={padL - 8} y={y + 4} textAnchor="end" fontSize={10} fill="#9ca3af">{val}</text>
          </g>
        );
      })}

      {data.map((point, i) => {
        const x = padL + (i + 0.5) * (chartW / data.length) - barWidth / 2;
        const barH = (point.evaluatedSum / maxVal) * chartH;
        const y = padT + chartH - barH;
        return (
          <g key={point.date}>
            <rect x={x} y={y} width={barWidth} height={barH} fill="#3b82f6" rx={2} />
            <text
              x={x + barWidth / 2}
              y={padT + chartH + 14}
              textAnchor="middle"
              fontSize={9}
              fill="#9ca3af"
              transform={`rotate(-30, ${x + barWidth / 2}, ${padT + chartH + 14})`}
            >
              {point.date.slice(5)}
            </text>
            <text x={x + barWidth / 2} y={y - 4} textAnchor="middle" fontSize={10} fill="#6b7280">
              {point.evaluatedSum}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function AdminAssistant({ onNavigate }: { onNavigate: (view: string) => void }) {
  const [summary, setSummary] = useState<AdminSummaryResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [activity, setActivity] = useState<AdminActivityResponse | null>(null);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState<string | null>(null);

  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchSummary();
    fetchActivity();
  }, []);

  async function fetchSummary() {
    try {
      setSummaryLoading(true);
      const res = await fetch(`${API_BASE}/api/admin/summary`, { headers: adminHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSummary(data);
    } catch (err: any) {
      setSummaryError(err.message);
    } finally {
      setSummaryLoading(false);
    }
  }

  async function fetchActivity() {
    try {
      setActivityLoading(true);
      const res = await fetch(`${API_BASE}/api/admin/activity`, { headers: adminHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setActivity(data);
    } catch (err: any) {
      setActivityError(err.message);
    } finally {
      setActivityLoading(false);
    }
  }

  async function runEvaluation() {
    try {
      setActionLoading(true);
      setActionStatus(null);
      const res = await fetch(`${API_BASE}/api/admin/actions/evaluate-stock-forecasts`, {
        method: "POST",
        headers: adminHeaders(),
      });
      const data = await res.json();
      setActionStatus(data.message || JSON.stringify(data));
      fetchActivity();
      fetchSummary();
    } catch (err: any) {
      setActionStatus(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  }

  const timelineData = activity ? buildEvaluationTimeline(activity.events) : [];

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: "bold" }}>Assistant Cockpit</h1>
        <button
          onClick={() => onNavigate("main")}
          style={{
            padding: "8px 16px",
            background: "#e5e7eb",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Back to Office
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        <div style={{ background: "#f9fafb", padding: "16px", borderRadius: "8px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px" }}>Database Overview</h2>
          
          {summaryLoading && <p>Loading...</p>}
          {summaryError && <p style={{ color: "red" }}>Error: {summaryError}</p>}
          
          {summary && (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ textAlign: "left", padding: "8px" }}>Table</th>
                  <th style={{ textAlign: "right", padding: "8px" }}>Row count</th>
                </tr>
              </thead>
              <tbody>
                {summary.tables.map((table) => (
                  <tr key={table.name} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "8px" }}>{table.name}</td>
                    <td style={{ textAlign: "right", padding: "8px" }}>
                      {table.error ? (
                        <span style={{ color: "red", fontSize: "12px" }}>{table.error}</span>
                      ) : (
                        table.rowCount?.toLocaleString()
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ background: "#f9fafb", padding: "16px", borderRadius: "8px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px" }}>Recent Activity</h2>
          
          {activityLoading && <p>Loading...</p>}
          {activityError && <p style={{ color: "red" }}>Error: {activityError}</p>}
          
          {activity && activity.events.length === 0 && (
            <p style={{ color: "#6b7280" }}>
              {activity.message || "No activity recorded yet."}
            </p>
          )}
          
          {activity && activity.events.length > 0 && (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {activity.events.map((event) => (
                <li key={event.id} style={{ padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
                  <div style={{ fontSize: "12px", color: "#6b7280" }}>
                    {new Date(event.created_at).toLocaleString()}
                  </div>
                  <div>
                    <strong>{event.type}</strong>
                    {event.description && <span> — {event.description}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div style={{ marginTop: "24px", background: "#f9fafb", padding: "16px", borderRadius: "8px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px" }}>Quick Actions</h2>
        
        <button
          onClick={runEvaluation}
          disabled={actionLoading}
          style={{
            padding: "10px 20px",
            background: actionLoading ? "#9ca3af" : "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: actionLoading ? "not-allowed" : "pointer",
            fontSize: "14px",
          }}
        >
          {actionLoading ? "Running..." : "Evaluate due stock forecasts"}
        </button>
        
        {actionStatus && (
          <p style={{ marginTop: "12px", padding: "8px", background: "#fff", borderRadius: "4px", fontSize: "13px" }}>
            {actionStatus}
          </p>
        )}
      </div>

      <div style={{ marginTop: "24px", background: "#f9fafb", padding: "16px", borderRadius: "8px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px" }}>Stock Forecast Evaluation Timeline</h2>
        <EvaluationTimeline data={timelineData} />
      </div>
    </div>
  );
}
