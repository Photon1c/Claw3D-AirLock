import { useEffect, useState } from "react";

const API_BASE = "";

interface ScrumSession {
  id: string;
  timestamp: string;
  topic: string;
  participants: string[];
  currentStage: string;
  results: Array<{
    stage: string;
    agent: string;
    valid: boolean;
    output: any;
  }>;
  finalStatus: string;
}

interface ScrumStatus {
  active: boolean;
  session: ScrumSession | null;
  currentStage: string | null;
  complete: boolean;
}

interface ExportResult {
  path: string;
  sessionId: string;
  mode: string;
  preview?: string;
  localSuccess?: boolean;
  githubSuccess?: boolean;
  githubUrl?: string;
  error?: string;
  errorCode?: string;
}

interface GitHubStatus {
  configured: boolean;
  repo: string | null;
  branch: string;
  message: string;
}

type ExportMode = "preview" | "localReport" | "localNotes" | "githubReport" | "githubNotes";

export default function ScrumPanel() {
  const [status, setStatus] = useState<ScrumStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [exportMode, setExportMode] = useState<ExportMode>("localReport");
  const [githubStatus, setGithubStatus] = useState<GitHubStatus | null>(null);

  useEffect(() => {
    fetchStatus();
    fetchGitHubStatus();
  }, []);

  async function fetchStatus() {
    try {
      const res = await fetch(`${API_BASE}/api/scrum/status`);
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      console.error("Failed to fetch SCRUM status:", err);
    }
  }

  async function fetchGitHubStatus() {
    try {
      const res = await fetch(`${API_BASE}/api/scrum/github/status`);
      const data = await res.json();
      setGithubStatus(data);
    } catch (err) {
      console.error("Failed to fetch GitHub status:", err);
    }
  }

  async function startScrum() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/scrum/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: "Daily standup",
          participants: ["clerk", "specialist", "executive", "archivist"]
        })
      });
      const data = await res.json();
      setStatus(data);
      await fetchStatus();
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  }

  async function advanceScrum() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/scrum/advance`, { method: "POST" });
      const data = await res.json();
      setStatus(data);
      await fetchStatus();
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  }

  async function handleExport(mode: ExportMode) {
    setLoading(true);
    setError(null);
    setExportResult(null);
    setPreviewContent(null);

    try {
      if (mode === "preview") {
        if (!status?.session?.id) {
          setError("No active session to preview");
          setLoading(false);
          return;
        }
        const res = await fetch(`${API_BASE}/api/scrum/export/preview/${status.session.id}`);
        const data = await res.json();
        if (data.error) {
          setError(data.error);
        } else {
          setPreviewContent(data.preview);
        }
      } else {
        const res = await fetch(`${API_BASE}/api/scrum/export`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: status?.session?.id || null,
            mode
          })
        });
        const data = await res.json();
        if (data.error) {
          setError(`${data.error} (${data.code})`);
        } else {
          setExportResult(data);
        }
      }
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  }

  const stageLabels: Record<string, string> = {
    check: "CHECK",
    report: "REPORT",
    review: "REVIEW",
    decide: "DECIDE",
    execute: "EXECUTE",
    log: "LOG"
  };

  const modeLabels: Record<ExportMode, string> = {
    preview: "Preview Only",
    localReport: "Local Report",
    localNotes: "Local Notes",
    githubReport: "GitHub Report",
    githubNotes: "GitHub Notes"
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>SCRUM</h3>
        {githubStatus && (
          <span style={{
            ...styles.githubBadge,
            background: githubStatus.configured ? "#26de81" : "#888"
          }}>
            {githubStatus.configured ? "GH" : "Local"}
          </span>
        )}
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.content}>
        {status && (
          <div style={styles.statusSection}>
            <div style={styles.stageIndicator}>
              <span style={styles.stageLabel}>Stage:</span>
              <span style={styles.stageValue}>
                {status.session ? stageLabels[status.currentStage || "check"] || status.currentStage : "None"}
              </span>
            </div>
            <div style={styles.statusBadge}>
              <span style={{
                ...styles.badge,
                background: status.complete ? "#26de81" : status.active ? "#feca57" : "#888"
              }}>
                {status.complete ? "Complete" : status.active ? "In Progress" : "Idle"}
              </span>
            </div>
          </div>
        )}

        <div style={styles.buttonGroup}>
          {!status?.active && (
            <button
              style={styles.button}
              onClick={startScrum}
              disabled={loading}
            >
              {loading ? "Starting..." : "Start SCRUM"}
            </button>
          )}
          
          {status?.active && !status.complete && (
            <button
              style={{...styles.button, background: "#4ecdc4"}}
              onClick={advanceScrum}
              disabled={loading}
            >
              {loading ? "Advancing..." : "Advance Stage"}
            </button>
          )}
        </div>

        <div style={styles.divider} />

        <h4 style={styles.sectionTitle}>Export Mode</h4>
        
        <div style={styles.modeSelector}>
          {([
            { mode: "preview" as ExportMode, tooltip: "Generate markdown report without saving - useful for review" },
            { mode: "localReport" as ExportMode, tooltip: "Save report to docs/reports/ locally - no GitHub" },
            { mode: "localNotes" as ExportMode, tooltip: "Append summary to PIXEL_OFFICE_SCRUM_NOTES.md locally" },
            { mode: "githubReport" as ExportMode, tooltip: "Save locally + push report file to GitHub safe repo" },
            { mode: "githubNotes" as ExportMode, tooltip: "Save locally + push notes summary to GitHub safe repo" }
          ] as { mode: ExportMode; tooltip: string }[]).map((item) => {
            const mode = item.mode;
            const isGitHub = mode === "githubReport" || mode === "githubNotes";
            const disabled = isGitHub && !githubStatus?.configured;
            
            return (
              <label
                key={mode}
                title={item.tooltip}
                style={{...styles.modeOption, opacity: disabled ? 0.5 : 1, cursor: disabled ? "not-allowed" : "pointer"}}
              >
                <input
                  type="radio"
                  name="exportMode"
                  value={mode}
                  checked={exportMode === mode}
                  onChange={() => !disabled && setExportMode(mode)}
                  disabled={disabled}
                />
                <span style={{...styles.modeLabel, color: disabled ? "#666" : "#fff"}}>
                  {modeLabels[mode]}
                </span>
                {isGitHub && (
                  <span style={styles.modeRepo}>
                    {githubStatus?.repo ? `→ ${githubStatus.repo.split("/")[1]}` : ""}
                  </span>
                )}
              </label>
            );
          })}
        </div>

        <div style={styles.modeDescriptions}>
          <p style={styles.modeDesc}><strong>Preview:</strong> View without saving</p>
          <p style={styles.modeDesc}><strong>Local Report:</strong> docs/reports/*.md</p>
          <p style={styles.modeDesc}><strong>Local Notes:</strong> PIXEL_OFFICE_SCRUM_NOTES.md</p>
          <p style={styles.modeDesc}><strong>GitHub Report:</strong> Push report to safe repo</p>
          <p style={styles.modeDesc}><strong>GitHub Notes:</strong> Push notes to safe repo</p>
        </div>

        <button
          style={{...styles.exportButton, opacity: !status?.session ? 0.5 : 1}}
          onClick={() => handleExport(exportMode)}
          disabled={loading || !status?.session}
        >
          {loading ? "Processing..." : 
            exportMode === "preview" ? "Preview Report" :
            exportMode === "localReport" ? "Export to Local" :
            exportMode === "localNotes" ? "Append Local Notes" :
            exportMode === "githubReport" ? "Push Report to GitHub" :
            "Push Notes to GitHub"}
        </button>

        {previewContent && (
          <div style={styles.previewContainer}>
            <h4 style={styles.previewTitle}>Report Preview</h4>
            <pre style={styles.previewContent}>{previewContent}</pre>
            <button
              style={{...styles.button, marginTop: 8}}
              onClick={() => setPreviewContent(null)}
            >
              Close
            </button>
          </div>
        )}

        {exportResult && (
          <div style={{
            ...styles.success,
            background: exportResult.githubSuccess === false ? "#3d2f1f" : "#1a3d1a"
          }}>
            <p>
              {exportResult.localSuccess ? "Local export successful" : "Local export failed"}
            </p>
            <p style={styles.pathLabel}>Path: {exportResult.path}</p>
            {exportResult.githubSuccess !== undefined && (
              <p>
                {exportResult.githubSuccess
                  ? "GitHub push successful"
                  : "GitHub push failed"}
              </p>
            )}
            {exportResult.githubUrl && (
              <a href={exportResult.githubUrl} target="_blank" rel="noopener noreferrer" style={styles.commitLink}>
                View commit →
              </a>
            )}
            {exportResult.error && (
              <p style={{ color: "#ff6b6b" }}>Error: {exportResult.error}</p>
            )}
          </div>
        )}

        {!githubStatus?.configured && (
          <div style={styles.configHint}>
            <p>GitHub not configured. To enable:</p>
            <code style={styles.code}>SAFE_SCRUM_REPO=owner/repo</code>
            <code style={styles.code}>SAFE_SCRUM_BRANCH=main</code>
            <code style={styles.code}>GITHUB_TOKEN=ghp_...</code>
          </div>
        )}

        {status?.session && (
          <div style={styles.sessionInfo}>
            <h4 style={styles.sectionTitle}>Current Session</h4>
            <p><strong>ID:</strong> {status.session.id}</p>
            <p><strong>Topic:</strong> {status.session.topic}</p>
            <p><strong>Participants:</strong> {status.session.participants.join(", ")}</p>
            <p><strong>Results:</strong> {status.session.results.length} stages</p>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "fixed",
    right: 0,
    top: 0,
    bottom: 0,
    width: 340,
    background: "#0a0a12",
    borderLeft: "1px solid #1a1a2e",
    display: "flex",
    flexDirection: "column",
    zIndex: 1001,
  },
  header: {
    padding: "12px 16px",
    borderBottom: "1px solid #1a1a2e",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    margin: 0,
    fontSize: 14,
    color: "#fff",
  },
  githubBadge: {
    padding: "2px 6px",
    borderRadius: 4,
    color: "#000",
    fontSize: 10,
    fontWeight: "bold",
  },
  content: {
    flex: 1,
    overflow: "auto",
    padding: 12,
  },
  error: {
    padding: "8px 12px",
    background: "#3d1f1f",
    color: "#ff6b6b",
    fontSize: 12,
    margin: 8,
    borderRadius: 4,
  },
  statusSection: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  stageIndicator: {
    display: "flex",
    gap: 8,
  },
  stageLabel: {
    color: "#888",
    fontSize: 12,
  },
  stageValue: {
    color: "#4ecdc4",
    fontWeight: "bold",
    fontSize: 12,
  },
  statusBadge: {},
  badge: {
    padding: "4px 8px",
    borderRadius: 4,
    color: "#000",
    fontSize: 10,
    fontWeight: "bold",
  },
  buttonGroup: {
    display: "flex",
    gap: 8,
  },
  button: {
    flex: 1,
    padding: "8px 12px",
    background: "#4ecdc4",
    border: "none",
    borderRadius: 6,
    color: "#000",
    fontWeight: "bold",
    fontSize: 12,
    cursor: "pointer",
  },
  divider: {
    height: 1,
    background: "#1a1a2e",
    margin: "16px 0",
  },
  sectionTitle: {
    margin: "0 0 8px",
    color: "#888",
    fontSize: 11,
    textTransform: "uppercase",
  },
  modeSelector: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    marginBottom: 8,
  },
  modeOption: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  modeLabel: {
    fontSize: 12,
  },
  modeRepo: {
    color: "#666",
    fontSize: 10,
    marginLeft: "auto",
  },
  modeDescriptions: {
    marginBottom: 12,
  },
  modeDesc: {
    margin: "4px 0",
    color: "#666",
    fontSize: 10,
  },
  exportButton: {
    width: "100%",
    padding: "10px 12px",
    background: "#a55eea",
    border: "none",
    borderRadius: 6,
    color: "#fff",
    fontWeight: "bold",
    fontSize: 12,
    cursor: "pointer",
  },
  previewContainer: {
    marginTop: 12,
    padding: 8,
    background: "#1a1a2e",
    borderRadius: 6,
  },
  previewTitle: {
    margin: "0 0 8px",
    color: "#4ecdc4",
    fontSize: 11,
  },
  previewContent: {
    margin: 0,
    padding: 8,
    background: "#0a0a12",
    borderRadius: 4,
    color: "#aaa",
    fontSize: 10,
    whiteSpace: "pre-wrap",
    fontFamily: "monospace",
    maxHeight: 200,
    overflow: "auto",
  },
  success: {
    marginTop: 12,
    padding: 8,
    borderRadius: 6,
    color: "#26de81",
    fontSize: 12,
  },
  pathLabel: {
    margin: "4px 0 0",
    color: "#888",
    fontSize: 10,
    wordBreak: "break-all",
  },
  commitLink: {
    display: "block",
    marginTop: 8,
    color: "#4ecdc4",
    fontSize: 11,
  },
  configHint: {
    marginTop: 12,
    padding: 8,
    background: "#1a1a2e",
    borderRadius: 6,
    fontSize: 10,
    color: "#888",
  },
  code: {
    display: "block",
    margin: "4px 0",
    padding: "4px 8px",
    background: "#0a0a12",
    borderRadius: 4,
    color: "#4ecdc4",
    fontSize: 10,
    fontFamily: "monospace",
  },
  sessionInfo: {
    marginTop: 12,
    padding: 8,
    background: "#1a1a2e",
    borderRadius: 6,
  },
};
