import { useState, useEffect, useCallback } from "react";

interface StockForecast {
  id: number;
  user_id: number;
  ticker_id: number;
  ticker_symbol: string;
  created_at: string;
  target_date: string;
  horizon_days: number;
  prediction_type: string;
  predicted_price: number | null;
  predicted_return_pct: number | null;
  predicted_direction: string | null;
  baseline_price: number | null;
  status: string;
  evaluated_at: string | null;
  actual_price: number | null;
  actual_return_pct: number | null;
  absolute_error_price: number | null;
  absolute_error_pct: number | null;
  notes: string | null;
}

interface ForecastStats {
  totalForecasts: number;
  evaluatedCount: number;
  meanAbsoluteErrorPrice: number | null;
  meanAbsoluteErrorPct: number | null;
  directionHitRate: number | null;
}

const API_BASE = "";
const PAGE_SIZE = 20;

export default function StockForecasts() {
  const [forecasts, setForecasts] = useState<StockForecast[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ForecastStats | null>(null);
  const [selectedForecast, setSelectedForecast] = useState<StockForecast | null>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSymbol, setFilterSymbol] = useState("");
  const [formSymbol, setFormSymbol] = useState("");
  const [formHorizon, setFormHorizon] = useState(14);
  const [formTargetDate, setFormTargetDate] = useState("");
  const [formPredictionType, setFormPredictionType] = useState("price");
  const [formPredictedPrice, setFormPredictedPrice] = useState("");
  const [formDirection, setFormDirection] = useState("up");
  const [formNotes, setFormNotes] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<"forecasts" | "tasks" | "dailyplan">("forecasts");

  const [tasks, setTasks] = useState<any[]>([]);
  const [taskLoading, setTaskLoading] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState(3);
  const [newTaskEstMinutes, setNewTaskEstMinutes] = useState(12);
  const [newTaskDueDate, setNewTaskDueDate] = useState("");

  const [dailyPlan, setDailyPlan] = useState<any>(null);
  const [planLoading, setPlanLoading] = useState(false);

  const fetchForecasts = useCallback(async (reset = false) => {
    try {
      setLoading(true);
      setError(null);
      const o = reset ? 0 : offset;
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (filterSymbol) params.set("symbol", filterSymbol.toUpperCase());
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(o));
      const res = await fetch(`${API_BASE}/api/stocks/forecasts?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (reset || o === 0) {
        setForecasts(data.forecasts || []);
      } else {
        setForecasts(prev => [...prev, ...(data.forecasts || [])]);
      }
      setTotal(data.total || 0);
      if (reset) setOffset(0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [offset, filterStatus, filterSymbol]);

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/stocks/forecasts/stats?user_id=1`);
      const data = await res.json();
      setStats(data);
    } catch {}
  };

  const loadMore = () => {
    const next = offset + PAGE_SIZE;
    setOffset(next);
    fetchForecasts(false);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formSymbol.trim()) return;
    setFormSubmitting(true);
    setError(null);

    const body: any = {
      symbol: formSymbol.toUpperCase(),
      horizon_days: formHorizon,
      target_date: formTargetDate,
      prediction_type: formPredictionType,
      notes: formNotes || undefined,
      user_id: 1,
    };

    if (formPredictionType === "price" && formPredictedPrice) {
      body.predicted_price = parseFloat(formPredictedPrice);
    }
    if (formPredictionType === "direction") {
      body.predicted_direction = formDirection;
    }

    try {
      const res = await fetch(`${API_BASE}/api/stocks/forecasts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setFormSymbol("");
      setFormPredictedPrice("");
      setFormNotes("");
      setShowForm(false);
      fetchForecasts(true);
      fetchStats();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setFormSubmitting(false);
    }
  }

  async function viewDetail(id: number) {
    try {
      const res = await fetch(`${API_BASE}/api/stocks/forecasts/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSelectedForecast(data.forecast);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function deleteForecast(id: number) {
    if (!confirm("Delete this forecast?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/stocks/forecasts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      fetchForecasts(true);
      fetchStats();
    } catch (err: any) {
      setError(err.message);
    }
  }

  const fetchTasks = async () => {
    try {
      setTaskLoading(true);
      const res = await fetch("/api/tasks");
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
    } finally {
      setTaskLoading(false);
    }
  };

  const createTask = async () => {
    if (!newTaskTitle.trim()) return;
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTaskTitle,
          description: newTaskDesc,
          priority: newTaskPriority,
          estimated_minutes: newTaskEstMinutes,
          due_date: newTaskDueDate || null,
        }),
      });
      if (res.ok) {
        setNewTaskTitle("");
        setNewTaskDesc("");
        fetchTasks();
      }
    } catch (err) {
      console.error("Failed to create task:", err);
    }
  };

  const updateTaskStatus = async (id: number, status: string) => {
    try {
      await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      fetchTasks();
    } catch (err) {
      console.error("Failed to update task:", err);
    }
  };

  const deleteTask = async (id: number) => {
    try {
      await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      fetchTasks();
    } catch (err) {
      console.error("Failed to delete task:", err);
    }
  };

  const generateDailyPlan = async () => {
    try {
      setPlanLoading(true);
      const res = await fetch("/api/daily_plan", { method: "POST" });
      const data = await res.json();
      if (data.plan_date) {
        setDailyPlan(data);
      }
    } catch (err) {
      console.error("Failed to generate plan:", err);
    } finally {
      setPlanLoading(false);
    }
  };

  const fetchDailyPlan = async () => {
    try {
      setPlanLoading(true);
      const res = await fetch("/api/daily_plan");
      const data = await res.json();
      setDailyPlan(data.plan);
    } catch (err) {
      console.error("Failed to fetch plan:", err);
    } finally {
      setPlanLoading(false);
    }
  };

  useEffect(() => {
    fetchForecasts(true);
    fetchStats();
  }, []);

  useEffect(() => {
    if (activeTab === "tasks") fetchTasks();
    if (activeTab === "dailyplan") fetchDailyPlan();
  }, [activeTab]);

  const containerStyle: React.CSSProperties = {
    padding: "20px",
    maxWidth: "1200px",
    margin: "0 auto",
    fontFamily: "system-ui, sans-serif",
    background: "#111",
    minHeight: "100vh",
    color: "#e0e0e0",
  };

  const cardStyle: React.CSSProperties = {
    background: "#1a1a2e",
    padding: "16px",
    borderRadius: "8px",
    marginBottom: "16px",
  };

  const inputStyle: React.CSSProperties = {
    padding: "8px 12px",
    background: "#2a2a3e",
    color: "#e0e0e0",
    border: "1px solid #3a3a4e",
    borderRadius: "4px",
    fontSize: "14px",
    width: "100%",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: "4px",
    fontSize: "13px",
    color: "#aaa",
  };

  const primaryBtn: React.CSSProperties = {
    padding: "10px 24px",
    background: "#4ecdc4",
    color: "#111",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "14px",
  };

  const secondaryBtn: React.CSSProperties = {
    padding: "8px 16px",
    background: "#2a2a3e",
    color: "#e0e0e0",
    border: "1px solid #3a3a4e",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "13px",
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "10px 20px",
    background: active ? "#4ecdc4" : "#2a2a3e",
    color: active ? "#111" : "#aaa",
    border: "none",
    borderRadius: "4px 4px 0 0",
    cursor: "pointer",
    fontWeight: "600",
    marginRight: "4px",
  });

  if (selectedForecast) {
    return (
      <div style={containerStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h1 style={{ fontSize: "24px", fontWeight: "bold", color: "#4ecdc4" }}>
            Forecast #{selectedForecast.id} — {selectedForecast.ticker_symbol}
          </h1>
          <button onClick={() => setSelectedForecast(null)} style={secondaryBtn}>Back to Dashboard</button>
        </div>
        <div style={cardStyle}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div><span style={{ color: "#888" }}>Status:</span> <span style={{ color: selectedForecast.status === "evaluated" ? "#4ade80" : "#fbbf24" }}>{selectedForecast.status}</span></div>
            <div><span style={{ color: "#888" }}>Type:</span> {selectedForecast.prediction_type}</div>
            <div><span style={{ color: "#888" }}>Created:</span> {new Date(selectedForecast.created_at).toLocaleDateString()}</div>
            <div><span style={{ color: "#888" }}>Target Date:</span> {selectedForecast.target_date}</div>
            <div><span style={{ color: "#888" }}>Horizon:</span> {selectedForecast.horizon_days} days</div>
            <div><span style={{ color: "#888" }}>Baseline Price:</span> {selectedForecast.baseline_price != null ? `$${Number(selectedForecast.baseline_price).toFixed(2)}` : "--"}</div>
            {selectedForecast.predicted_price != null && <div><span style={{ color: "#888" }}>Predicted Price:</span> ${Number(selectedForecast.predicted_price).toFixed(2)}</div>}
            {selectedForecast.predicted_return_pct != null && <div><span style={{ color: "#888" }}>Predicted Return:</span> {Number(selectedForecast.predicted_return_pct).toFixed(2)}%</div>}
            {selectedForecast.predicted_direction && <div><span style={{ color: "#888" }}>Predicted Direction:</span> {selectedForecast.predicted_direction}</div>}
          </div>
          {selectedForecast.status === "evaluated" && (
            <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #3a3a4e" }}>
              <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "12px" }}>Evaluation Results</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div><span style={{ color: "#888" }}>Actual Price:</span> {selectedForecast.actual_price != null ? `$${Number(selectedForecast.actual_price).toFixed(2)}` : "--"}</div>
                <div><span style={{ color: "#888" }}>Actual Return:</span> {selectedForecast.actual_return_pct != null ? `${Number(selectedForecast.actual_return_pct).toFixed(2)}%` : "--"}</div>
                <div><span style={{ color: "#888" }}>Abs Error (Price):</span> {selectedForecast.absolute_error_price != null ? `$${Number(selectedForecast.absolute_error_price).toFixed(2)}` : "--"}</div>
                <div><span style={{ color: "#888" }}>Abs Error (%):</span> {selectedForecast.absolute_error_pct != null ? `${Number(selectedForecast.absolute_error_pct).toFixed(2)}%` : "--"}</div>
              </div>
            </div>
          )}
          {selectedForecast.notes && <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #3a3a4e" }}><span style={{ color: "#888" }}>Notes:</span> {selectedForecast.notes}</div>}
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={{ marginBottom: "20px", borderBottom: "1px solid #3a3a4e" }}>
        <button style={tabStyle(activeTab === "forecasts")} onClick={() => setActiveTab("forecasts")}>Forecasts</button>
        <button style={tabStyle(activeTab === "tasks")} onClick={() => setActiveTab("tasks")}>Task Manager</button>
        <button style={tabStyle(activeTab === "dailyplan")} onClick={() => setActiveTab("dailyplan")}>Daily Plan</button>
      </div>

      {activeTab === "forecasts" && (
      <>
      <div style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: "24px", fontWeight: "bold" }}>Stock Forecasts</h1>
        <button style={primaryBtn} onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ New Forecast"}
        </button>
      </div>

      {showForm && (
        <div style={cardStyle}>
          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "16px" }}>
              <div>
                <label style={labelStyle}>Symbol *</label>
                <input style={inputStyle} value={formSymbol} onChange={e => setFormSymbol(e.target.value)} placeholder="AAPL" required />
              </div>
              <div>
                <label style={labelStyle}>Prediction Type *</label>
                <select style={inputStyle} value={formPredictionType} onChange={e => setFormPredictionType(e.target.value)}>
                  <option value="price">Price</option>
                  <option value="percentage_return">Percentage Return</option>
                  <option value="direction">Direction</option>
                </select>
              </div>
              {formPredictionType === "price" && (
                <div>
                  <label style={labelStyle}>Predicted Price</label>
                  <input style={inputStyle} type="number" step="0.01" value={formPredictedPrice} onChange={e => setFormPredictedPrice(e.target.value)} placeholder="210.50" />
                </div>
              )}
              {formPredictionType === "direction" && (
                <div>
                  <label style={labelStyle}>Direction</label>
                  <select style={inputStyle} value={formDirection} onChange={e => setFormDirection(e.target.value)}>
                    <option value="up">Up</option>
                    <option value="down">Down</option>
                    <option value="flat">Flat</option>
                  </select>
                </div>
              )}
              <div>
                <label style={labelStyle}>Horizon (days)</label>
                <input style={inputStyle} type="number" value={formHorizon} onChange={e => setFormHorizon(Number(e.target.value))} />
              </div>
              <div>
                <label style={labelStyle}>Target Date</label>
                <input style={inputStyle} type="date" value={formTargetDate} onChange={e => setFormTargetDate(e.target.value)} />
              </div>
            </div>
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>Notes</label>
              <textarea style={{ ...inputStyle, minHeight: "60px" }} value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Optional notes..." />
            </div>
            <button type="submit" style={primaryBtn} disabled={formSubmitting}>
              {formSubmitting ? "Creating..." : "Create Forecast"}
            </button>
          </form>
        </div>
      )}

      {error && <div style={{ ...cardStyle, background: "#2a1a1a", color: "#f87171" }}>{error}</div>}

      <div style={cardStyle}>
        <div style={{ marginBottom: "16px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <select style={{ ...inputStyle, width: "auto" }} value={filterStatus} onChange={e => { setFilterStatus(e.target.value); fetchForecasts(true); }}>
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="evaluated">Evaluated</option>
          </select>
          <input style={{ ...inputStyle, width: "150px" }} placeholder="Filter by symbol..." value={filterSymbol} onChange={e => setFilterSymbol(e.target.value)} onKeyDown={e => e.key === "Enter" && fetchForecasts(true)} />
          <button style={secondaryBtn} onClick={() => fetchForecasts(true)}>Apply</button>
        </div>

        {loading && forecasts.length === 0 ? (
          <p style={{ color: "#888" }}>Loading...</p>
        ) : forecasts.length === 0 ? (
          <p style={{ color: "#888" }}>No forecasts yet. Create one above!</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #3a3a4e" }}>
                  <th style={{ textAlign: "left", padding: "8px", color: "#888" }}>Ticker</th>
                  <th style={{ textAlign: "left", padding: "8px", color: "#888" }}>Created</th>
                  <th style={{ textAlign: "left", padding: "8px", color: "#888" }}>Target Date</th>
                  <th style={{ textAlign: "left", padding: "8px", color: "#888" }}>Type</th>
                  <th style={{ textAlign: "left", padding: "8px", color: "#888" }}>Prediction</th>
                  <th style={{ textAlign: "left", padding: "8px", color: "#888" }}>Status</th>
                  <th style={{ textAlign: "left", padding: "8px", color: "#888" }}>Result</th>
                  <th style={{ padding: "8px" }}></th>
                </tr>
              </thead>
              <tbody>
                {forecasts.map((f) => {
                  let predSummary = "--";
                  if (f.prediction_type === "price" && f.predicted_price != null) predSummary = `$${Number(f.predicted_price).toFixed(2)}`;
                  else if (f.prediction_type === "percentage_return" && f.predicted_return_pct != null) predSummary = `${Number(f.predicted_return_pct).toFixed(2)}%`;
                  else if (f.predicted_direction) predSummary = f.predicted_direction;

                  let result = "--";
                  if (f.status === "evaluated") {
                    if (f.actual_price != null) result = `$${Number(f.actual_price).toFixed(2)}`;
                    if (f.absolute_error_price != null) result += ` (err: $${Number(f.absolute_error_price).toFixed(2)})`;
                    else if (f.absolute_error_pct != null) result += ` (err: ${Number(f.absolute_error_pct).toFixed(2)}%)`;
                  }

                  return (
                    <tr key={f.id} style={{ borderBottom: "1px solid #2a2a3e" }}>
                      <td style={{ padding: "8px", fontWeight: "600", color: "#4ecdc4" }}>{f.ticker_symbol}</td>
                      <td style={{ padding: "8px" }}>{new Date(f.created_at).toLocaleDateString()}</td>
                      <td style={{ padding: "8px" }}>{f.target_date}</td>
                      <td style={{ padding: "8px" }}>{f.prediction_type}</td>
                      <td style={{ padding: "8px" }}>{predSummary}</td>
                      <td style={{ padding: "8px" }}>
                        <span style={{
                          padding: "2px 8px", borderRadius: "12px", fontSize: "12px",
                          background: f.status === "evaluated" ? "#1a2e1a" : f.status === "pending" ? "#2e2a1a" : "#2a1a1e",
                          color: f.status === "evaluated" ? "#4ade80" : f.status === "pending" ? "#fbbf24" : "#f87171",
                        }}>{f.status}</span>
                      </td>
                      <td style={{ padding: "8px", fontSize: "13px" }}>{result}</td>
                      <td style={{ padding: "8px" }}>
                        <button onClick={() => viewDetail(f.id)} style={{ ...secondaryBtn, padding: "4px 12px", fontSize: "12px", color: "#4ecdc4" }}>View</button>
                        <button onClick={() => deleteForecast(f.id)} style={{ ...secondaryBtn, padding: "4px 8px", fontSize: "12px", color: "#f87171" }}>×</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {forecasts.length < total && (
          <div style={{ marginTop: "12px", textAlign: "center" }}>
            <button onClick={loadMore} disabled={loading} style={{ ...secondaryBtn, color: "#4ecdc4" }}>
              {loading ? "Loading..." : `Load more (${forecasts.length} of ${total})`}
            </button>
          </div>
        )}
      </div>

      {stats && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "12px" }}>Accuracy Overview</h2>
          <p style={{ fontSize: "14px", color: "#ccc", marginBottom: "16px" }}>
            You've made <strong>{stats.totalForecasts}</strong> forecast{stats.totalForecasts !== 1 ? "s" : ""};{" "}
            <strong>{stats.evaluatedCount}</strong> evaluated so far.{" "}
            {stats.meanAbsoluteErrorPrice != null && <>Mean abs error: <strong>${stats.meanAbsoluteErrorPrice.toFixed(2)}</strong>{" "}</>}
            {stats.meanAbsoluteErrorPct != null && <>(<strong>{stats.meanAbsoluteErrorPct.toFixed(2)}%</strong>).{" "}</>}
            {stats.directionHitRate != null && <>Direction hit-rate: <strong>{stats.directionHitRate.toFixed(1)}%</strong>.</>}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "16px" }}>
            <StatCard label="Total Forecasts" value={String(stats.totalForecasts)} />
            <StatCard label="Evaluated" value={String(stats.evaluatedCount)} />
            <StatCard label="Avg Error (Price)" value={stats.meanAbsoluteErrorPrice != null ? `$${stats.meanAbsoluteErrorPrice.toFixed(2)}` : "--"} />
            <StatCard label="Avg Error (%)" value={stats.meanAbsoluteErrorPct != null ? `${stats.meanAbsoluteErrorPct.toFixed(2)}%` : "--"} />
            <StatCard label="Direction Hit Rate" value={stats.directionHitRate != null ? `${stats.directionHitRate.toFixed(1)}%` : "--"} />
          </div>
        </div>
      )}
      </>
      )}

      {activeTab === "tasks" && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px" }}>Task Manager</h2>
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
            <input style={{ ...inputStyle, width: "200px" }} placeholder="Task title" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} />
            <input style={{ ...inputStyle, width: "200px" }} placeholder="Description" value={newTaskDesc} onChange={e => setNewTaskDesc(e.target.value)} />
            <select style={{ ...inputStyle, width: "100px" }} value={newTaskPriority} onChange={e => setNewTaskPriority(Number(e.target.value))}>
              <option value={1}>High</option>
              <option value={2}>Med</option>
              <option value={3}>Low</option>
            </select>
            <input style={{ ...inputStyle, width: "120px" }} type="number" placeholder="Minutes" value={newTaskEstMinutes} onChange={e => setNewTaskEstMinutes(Number(e.target.value))} />
            <input style={{ ...inputStyle, width: "130px" }} type="date" value={newTaskDueDate} onChange={e => setNewTaskDueDate(e.target.value)} />
            <button style={primaryBtn} onClick={createTask}>Add Task</button>
          </div>
          {taskLoading ? <p>Loading...</p> : (
            <div style={{ maxHeight: "400px", overflowY: "auto" }}>
              {tasks.length === 0 ? <p style={{ color: "#888" }}>No tasks yet. Add one above.</p> : tasks.map(task => (
                <div key={task.id} style={{ display: "flex", alignItems: "center", padding: "8px", borderBottom: "1px solid #3a3a4e", gap: "12px" }}>
                  <button onClick={() => updateTaskStatus(task.id, task.status === "done" ? "open" : "done")} style={{ ...secondaryBtn, padding: "4px 8px", background: task.status === "done" ? "#1a2e1a" : "#2a2a3e" }}>
                    {task.status === "done" ? "✓" : "○"}
                  </button>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: "600", textDecoration: task.status === "done" ? "line-through" : "none", color: task.status === "done" ? "#888" : "#e0e0e0" }}>{task.title}</div>
                    {task.description && <div style={{ fontSize: "12px", color: "#888" }}>{task.description}</div>}
                  </div>
                  <span style={{ fontSize: "12px", color: task.priority <= 1 ? "#f87171" : task.priority <= 2 ? "#fbbf24" : "#888" }}>
                    {task.priority <= 1 ? "High" : task.priority <= 2 ? "Med" : "Low"}
                  </span>
                  <span style={{ fontSize: "12px", color: "#666" }}>{task.estimated_minutes}m</span>
                  <button onClick={() => deleteTask(task.id)} style={{ ...secondaryBtn, padding: "4px 8px", color: "#f87171" }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "dailyplan" && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px" }}>Daily Plan</h2>
          <button style={primaryBtn} onClick={generateDailyPlan} disabled={planLoading}>
            {planLoading ? "Generating..." : "Generate Today's Plan"}
          </button>
          {dailyPlan && (
            <div style={{ marginTop: "16px" }}>
              <div style={{ marginBottom: "8px", color: "#aaa" }}>{dailyPlan.plan_date} — {dailyPlan.total_allocated_minutes} minutes allocated</div>
              {dailyPlan.summary && <p style={{ marginBottom: "16px" }}>{dailyPlan.summary}</p>}
              {dailyPlan.items && dailyPlan.items.length > 0 && (
                <div>
                  {dailyPlan.items.map((item: any, idx: number) => (
                    <div key={idx} style={{ display: "flex", padding: "8px", borderBottom: "1px solid #3a3a4e", gap: "12px" }}>
                      <span style={{ color: "#4ecdc4", fontWeight: "600" }}>{idx + 1}.</span>
                      <span style={{ flex: 1 }}>{item.title || item.task_id}</span>
                      <span style={{ color: "#888" }}>{item.allocated_minutes}m</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: "12px", color: "#888" }}>{label}</div>
      <div style={{ fontSize: "22px", fontWeight: "bold" }}>{value}</div>
    </div>
  );
}
