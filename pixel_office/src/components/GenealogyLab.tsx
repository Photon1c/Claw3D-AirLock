import { useState, useEffect, useRef } from "react";

interface GenealogyNode {
  id: string;
  name: string;
  generation: number;
  children: string[];
  parents: string[];
}

interface GenealogyTree {
  nodes: Record<string, GenealogyNode>;
  rootIds: string[];
}

interface Branch {
  branchId: string;
  branchName: string;
  size: number;
  depth: number;
}

interface ResearchResult {
  branchId: string;
  branchName: string;
  difficulty: "easy" | "medium" | "hard";
  searchResults: string[];
  recommendation: string;
  sources: string[];
}

interface GenealogyLabProps {
  onNavigate?: (view: "main" | "genealogy") => void;
}

const DEFAULT_MERMAID = `graph TD
    A[John Smith] --> B[William Smith]
    A --> C[Mary Johnson]
    B --> D[Thomas Smith]
    B --> E[Jane Doe]
    C --> F[Robert Johnson]
    C --> G[Sarah Williams]`;

export default function GenealogyLab({ onNavigate }: GenealogyLabProps) {
  const [mermaidCode, setMermaidCode] = useState(DEFAULT_MERMAID);
  const [tree, setTree] = useState<GenealogyTree | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [results, setResults] = useState<ResearchResult[]>([]);
  const [recommended, setRecommended] = useState<ResearchResult | null>(null);
  const [isResearching, setIsResearching] = useState(false);
  const [activeTab, setActiveTab] = useState<"input" | "tree" | "results">("input");
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const mermaidRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab === "tree" && mermaidRef.current && tree) {
      renderMermaid();
    }
  }, [activeTab, tree]);

  const renderMermaid = async () => {
    if (!mermaidRef.current) return;
    
    try {
      const { default: mermaid } = await import("mermaid");
      mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
        securityLevel: "loose",
      });
      
      mermaidRef.current.innerHTML = "";
      const { svg } = await mermaid.render("genealogy-diagram", mermaidCode);
      mermaidRef.current.innerHTML = svg;
    } catch (error) {
      console.error("Mermaid render error:", error);
    }
  };

  const parseTree = async () => {
    try {
      const response = await fetch("/api/genealogy/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mermaid: mermaidCode }),
      });
      
      const data = await response.json();
      if (data.success) {
        setTree(data.tree);
        setBranches(data.branches);
        setActiveTab("tree");
      }
    } catch (error) {
      console.error("Parse error:", error);
    }
  };

  const runResearch = async () => {
    setIsResearching(true);
    try {
      const response = await fetch("/api/genealogy/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchIds: selectedBranches }),
      });
      
      const data = await response.json();
      if (data.success) {
        setResults(data.results);
        setRecommended(data.recommended);
        setActiveTab("results");
      }
    } catch (error) {
      console.error("Research error:", error);
    } finally {
      setIsResearching(false);
    }
  };

  const toggleBranchSelection = (branchId: string) => {
    setSelectedBranches(prev => 
      prev.includes(branchId) 
        ? prev.filter(id => id !== branchId)
        : [...prev, branchId]
    );
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "easy": return "#22c55e";
      case "medium": return "#eab308";
      case "hard": return "#ef4444";
      default: return "#6b7280";
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
      color: "#e2e8f0",
      padding: "20px",
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    }}>
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center",
          marginBottom: "24px",
          borderBottom: "1px solid #334155",
          paddingBottom: "16px"
        }}>
          <div>
            <h1 style={{ 
              fontSize: "2rem", 
              fontWeight: "bold",
              background: "linear-gradient(90deg, #06b6d4, #8b5cf6)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              margin: 0
            }}>
              🕵️ Criminology Genealogy Lab
            </h1>
            <p style={{ color: "#94a3b8", marginTop: "4px" }}>
              Analyze family trees and identify research pathways
            </p>
          </div>
          {onNavigate && (
            <button
              onClick={() => onNavigate("main")}
              style={{
                background: "#334155",
                border: "none",
                color: "#e2e8f0",
                padding: "8px 16px",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "14px"
              }}
            >
              ← Back to Office
            </button>
          )}
        </div>

        <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
          {(["input", "tree", "results"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: activeTab === tab ? "#06b6d4" : "#1e293b",
                border: "none",
                color: activeTab === tab ? "#0f172a" : "#94a3b8",
                padding: "12px 24px",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "600",
                textTransform: "capitalize",
                transition: "all 0.2s",
              }}
            >
              {tab === "input" ? "📥 Input" : tab === "tree" ? "🌳 Tree" : "📊 Results"}
            </button>
          ))}
        </div>

        {activeTab === "input" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
            <div style={{ 
              background: "#1e293b", 
              borderRadius: "12px", 
              padding: "20px",
              border: "1px solid #334155"
            }}>
              <h3 style={{ marginTop: 0, marginBottom: "16px", color: "#06b6d4" }}>
                Mermaid.js Diagram
              </h3>
              <textarea
                value={mermaidCode}
                onChange={(e) => setMermaidCode(e.target.value)}
                style={{
                  width: "100%",
                  height: "400px",
                  background: "#0f172a",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  color: "#e2e8f0",
                  padding: "16px",
                  fontFamily: "monospace",
                  fontSize: "14px",
                  resize: "vertical",
                }}
                placeholder="Enter Mermaid.js graph definition..."
              />
              <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
                <button
                  onClick={parseTree}
                  style={{
                    background: "linear-gradient(90deg, #06b6d4, #0891b2)",
                    border: "none",
                    color: "white",
                    padding: "12px 24px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "600",
                    flex: 1,
                  }}
                >
                  🔍 Parse Tree
                </button>
                <button
                  onClick={() => setMermaidCode(DEFAULT_MERMAID)}
                  style={{
                    background: "#334155",
                    border: "none",
                    color: "#94a3b8",
                    padding: "12px 24px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "14px",
                  }}
                >
                  Reset
                </button>
              </div>
            </div>

            <div style={{ 
              background: "#1e293b", 
              borderRadius: "12px", 
              padding: "20px",
              border: "1px solid #334155"
            }}>
              <h3 style={{ marginTop: 0, marginBottom: "16px", color: "#8b5cf6" }}>
                Detected Branches
              </h3>
              {branches.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {branches.map((branch, index) => (
                    <div
                      key={branch.branchId}
                      onClick={() => toggleBranchSelection(branch.branchId)}
                      style={{
                        background: selectedBranches.includes(branch.branchId) ? "#1e3a5f" : "#0f172a",
                        border: selectedBranches.includes(branch.branchId) ? "2px solid #06b6d4" : "1px solid #334155",
                        borderRadius: "8px",
                        padding: "16px",
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: "600", color: "#e2e8f0" }}>
                          {index + 1}. {branch.branchName}
                        </span>
                        <span style={{ 
                          background: "#334155", 
                          padding: "4px 12px", 
                          borderRadius: "12px",
                          fontSize: "12px",
                          color: "#94a3b8"
                        }}>
                          {branch.size} nodes • depth {branch.depth}
                        </span>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={runResearch}
                    disabled={isResearching || selectedBranches.length === 0}
                    style={{
                      background: isResearching ? "#334155" : "linear-gradient(90deg, #8b5cf6, #7c3aed)",
                      border: "none",
                      color: "white",
                      padding: "16px 24px",
                      borderRadius: "8px",
                      cursor: isResearching ? "not-allowed" : "pointer",
                      fontSize: "16px",
                      fontWeight: "600",
                      marginTop: "16px",
                      opacity: isResearching ? 0.6 : 1,
                    }}
                  >
                    {isResearching ? "🔬 Researching..." : "🚀 Run Branch Analysis"}
                  </button>
                </div>
              ) : (
                <div style={{ color: "#64748b", textAlign: "center", padding: "40px" }}>
                  <p>Parse a tree to see branches</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "tree" && (
          <div style={{ 
            background: "#1e293b", 
            borderRadius: "12px", 
            padding: "20px",
            border: "1px solid #334155",
            minHeight: "500px"
          }}>
            <h3 style={{ marginTop: 0, marginBottom: "16px", color: "#22c55e" }}>
              Genealogy Tree Visualization
            </h3>
            <div 
              ref={mermaidRef} 
              style={{ 
                display: "flex", 
                justifyContent: "center", 
                overflow: "auto",
                padding: "20px"
              }}
            />
          </div>
        )}

        {activeTab === "results" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "24px" }}>
            <div>
              {recommended && (
                <div style={{ 
                  background: "linear-gradient(135deg, #065f46, #047857)", 
                  borderRadius: "12px", 
                  padding: "20px",
                  border: "2px solid #10b981",
                  marginBottom: "16px"
                }}>
                  <h3 style={{ marginTop: 0, color: "#6ee7b7", fontSize: "14px", textTransform: "uppercase", letterSpacing: "1px" }}>
                    ⭐ Recommended Branch
                  </h3>
                  <div style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "8px" }}>
                    {recommended.branchName}
                  </div>
                  <div style={{ 
                    display: "inline-block", 
                    background: getDifficultyColor(recommended.difficulty),
                    padding: "4px 12px", 
                    borderRadius: "12px",
                    fontSize: "12px",
                    fontWeight: "600",
                    textTransform: "uppercase",
                    color: "#0f172a",
                    marginBottom: "12px"
                  }}>
                    {recommended.difficulty}
                  </div>
                  <p style={{ color: "#a7f3d0", margin: 0, fontSize: "14px" }}>
                    {recommended.recommendation}
                  </p>
                </div>
              )}

              <div style={{ 
                background: "#1e293b", 
                borderRadius: "12px", 
                padding: "20px",
                border: "1px solid #334155"
              }}>
                <h3 style={{ marginTop: 0, marginBottom: "16px", color: "#f59e0b" }}>
                  All Branches Ranked
                </h3>
                {results.map((result, index) => (
                  <div
                    key={result.branchId}
                    style={{
                      background: "#0f172a",
                      borderRadius: "8px",
                      padding: "12px",
                      marginBottom: "8px",
                      border: index === 0 ? "2px solid #10b981" : "1px solid #334155",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: "600" }}>#{index + 1} {result.branchName}</span>
                      <span style={{ 
                        color: getDifficultyColor(result.difficulty),
                        fontWeight: "600",
                        fontSize: "12px"
                      }}>
                        {result.difficulty.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ 
              background: "#1e293b", 
              borderRadius: "12px", 
              padding: "20px",
              border: "1px solid #334155"
            }}>
              <h3 style={{ marginTop: 0, marginBottom: "16px", color: "#06b6d4" }}>
                Research Details
              </h3>
              {results.map((result, index) => (
                <div
                  key={result.branchId}
                  style={{
                    background: "#0f172a",
                    borderRadius: "8px",
                    padding: "20px",
                    marginBottom: "16px",
                    border: "1px solid #334155",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <h4 style={{ margin: 0, color: "#e2e8f0" }}>
                      {index + 1}. {result.branchName}
                    </h4>
                    <span style={{ 
                      background: getDifficultyColor(result.difficulty),
                      padding: "4px 12px", 
                      borderRadius: "12px",
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "#0f172a"
                    }}>
                      {result.difficulty.toUpperCase()}
                    </span>
                  </div>
                  <p style={{ color: "#94a3b8", marginBottom: "16px" }}>
                    {result.recommendation}
                  </p>
                  {result.searchResults.length > 0 && (
                    <div>
                      <h5 style={{ color: "#64748b", fontSize: "12px", textTransform: "uppercase", marginBottom: "8px" }}>
                        Search Results
                      </h5>
                      <ul style={{ color: "#94a3b8", fontSize: "13px", paddingLeft: "20px", margin: 0 }}>
                        {result.searchResults.map((sr, i) => (
                          <li key={i} style={{ marginBottom: "4px" }}>{sr}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.sources.length > 0 && (
                    <div style={{ marginTop: "12px" }}>
                      <h5 style={{ color: "#64748b", fontSize: "12px", textTransform: "uppercase", marginBottom: "8px" }}>
                        Sources
                      </h5>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                        {result.sources.map((source, i) => (
                          <a
                            key={i}
                            href={source}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              background: "#1e293b",
                              padding: "6px 12px",
                              borderRadius: "6px",
                              fontSize: "12px",
                              color: "#06b6d4",
                              textDecoration: "none",
                            }}
                          >
                            Source {i + 1}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
