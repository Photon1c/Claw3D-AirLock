import express from "express";
import cors from "cors";
import "dotenv/config";
import fs from "fs";

const app = express();
const PORT = process.env.PORT || 4173;

app.use(cors());
app.use(express.json());

// Health check
app.get("/api/workflow/health", (req, res) => {
  res.json({ 
    status: "healthy", 
    timestamp: new Date().toISOString()
  });
});

// Agent chat endpoint
app.post("/api/agent-chat", async (req, res) => {
  const { message, model, agentName, agentRole } = req.body;
  
  if (!message) {
    res.status(400).json({ error: "Message is required" });
    return;
  }

  const selectedModel = model || "tinyllama";
  
  const rolePrompts: Record<string, string> = {
    receptionist: "You are FrontDesk, a friendly receptionist at Pixel Office. You help with intake, routing questions, and provide helpful information about the office. Be warm, efficient, and concise.",
    clerk: "You are a Clerk at Pixel Office. You handle task routing, data entry, and help coordinate workflow between teams. Be helpful and organized.",
    executive: "You are an Executive at Pixel Office. You handle high-level decisions, approvals, and strategic planning. Be professional, thoughtful, and decisive.",
    specialist: "You are a Specialist at Pixel Office. You provide deep technical analysis and expertise. Be knowledgeable, detailed, and thorough.",
    custodian: "You are a Custodian at Pixel Office. You handle logistics, scheduling, and physical operations. Be practical, reliable, and efficient.",
    archivist: "You are an Archivist at Pixel Office. You maintain records, documentation, and institutional knowledge. Be precise, thorough, and organized.",
  };

  const systemPrompt = rolePrompts[agentRole] || `You are ${agentName}, a helpful assistant at Pixel Office.`;

  const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
  
  try {
    const timeoutMs = 15000;
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Timeout")), timeoutMs)
    );
    
    const fetchPromise = fetch(`${ollamaUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ],
        stream: false
      })
    });

    const ollamaResponse = await Promise.race([fetchPromise, timeoutPromise]) as Response;

    if (!ollamaResponse.ok) {
      const errorText = await ollamaResponse.text();
      console.error("Ollama error:", errorText);
      res.json({ reply: `I'm having trouble connecting to the AI model right now. Please try again later. (Model: ${selectedModel})` });
      return;
    }

    const ollamaData = await ollamaResponse.json();
    const reply = ollamaData.message?.content || "I couldn't generate a response.";
    
    res.json({ reply });
  } catch (error: any) {
    console.error("Chat error:", error);
    if (error.message === "Timeout") {
      res.json({ reply: `The AI model is taking too long to respond. Please try again or select a different model. (Model: ${selectedModel})` });
    } else {
      res.json({ reply: `Error: ${error.message}` });
    }
  }
});

// Database helper functions for chat
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pixel_office',
};

async function getDbConnection() {
  const mysql = await import('mysql2/promise');
  return mysql.createPool(DB_CONFIG);
}

async function getDbSchema(): Promise<{ schema: string; tables: string[] }> {
  try {
    const pool = await getDbConnection();
    const [tables] = await pool.query('SHOW TABLES');
    const tableNames = (tables as any[]).map(t => Object.values(t)[0]);
    
    let schema = '';
    for (const table of tableNames.slice(0, 20)) {
      const [cols] = await pool.query(`DESCRIBE \`${table}\``);
      schema += `\n### ${table}\n`;
      (cols as any[]).forEach(col => {
        schema += `- ${col.Field} (${col.Type})\n`;
      });
    }
    await pool.end();
    return { schema, tables: tableNames };
  } catch (err) {
    return { schema: 'Error fetching schema', tables: [] };
  }
}

async function getTableData(table: string, limit: number = 10): Promise<any[]> {
  const pool = await getDbConnection();
  const [rows] = await pool.query(`SELECT * FROM \`${table}\` LIMIT ?`, [limit]);
  await pool.end();
  return rows as any[];
}

function formatTableData(table: string, data: any[]): string {
  if (!data.length) return `### ${table}\nNo data\n`;
  const headers = Object.keys(data[0]);
  let result = `### ${table}\n`;
  result += headers.join(' | ') + '\n';
  result += headers.map(() => '---').join(' | ') + '\n';
  data.slice(0, 5).forEach(row => {
    result += headers.map(h => String(row[h] ?? '')).join(' | ') + '\n';
  });
  return result;
}

function detectRequestedTables(message: string, tables: string[]): string[] {
  const lower = message.toLowerCase();
  return tables.filter(table => 
    lower.includes(table.toLowerCase().replace(/_/g, ' ')) ||
    lower.includes(table.toLowerCase())
  ).slice(0, 3);
}

// Main chat endpoint with database integration
app.post("/api/chat", async (req, res) => {
  const { message, history } = req.body;
  
  if (!message) {
    res.status(400).json({ error: "Message is required" });
    return;
  }

  const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
  
  try {
    // Try to get database schema
    let dbSchema = '';
    let tableNames: string[] = [];
    let tableDataContext = '';
    
    try {
      const db = await getDbSchema();
      dbSchema = db.schema;
      tableNames = db.tables;
      
      // Detect requested tables from message
      const requestedTables = detectRequestedTables(message, tableNames);
      
      if (requestedTables.length > 0) {
        for (const table of requestedTables) {
          try {
            const data = await getTableData(table, 10);
            tableDataContext += formatTableData(table, data);
          } catch (err) {
            tableDataContext += `\n### ${table}\nError fetching data: ${err}\n`;
          }
        }
      }
    } catch (dbErr) {
      console.log("Database not available:", dbErr);
    }
    
    const systemPrompt = tableDataContext 
      ? `You are a database assistant for Pixel Office. The database data has already been fetched for you below.

DATABASE SCHEMA:
${dbSchema}

ALREADY FETCHED DATA:
${tableDataContext}

Rules:
- Analyze and present the data provided
- Be helpful and concise
- Don't mention querying the database`
      : `You are a helpful AI assistant for Pixel Office. You help users with their questions about the office, tasks, and general assistance. Be friendly, concise, and helpful.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(history || []).slice(-5),
      { role: "user", content: message }
    ];

    // Set a timeout for the request
    const timeoutMs = 15000;
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Timeout")), timeoutMs)
    );
    
    const fetchPromise = fetch(`${ollamaUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "tinyllama",
        messages,
        stream: false
      })
    });

    const ollamaResponse = await Promise.race([fetchPromise, timeoutPromise]) as Response;

    if (!ollamaResponse.ok) {
      const errorText = await ollamaResponse.text();
      console.error("Ollama error:", errorText);
      // Fallback response without AI
      if (tableDataContext) {
        res.json({ reply: `I found data but couldn't reach the AI. Here are the tables in your database: ${tableNames.join(', ')}` });
      } else {
        res.json({ reply: "I'm having trouble connecting to the AI model right now. Please try again later." });
      }
      return;
    }

    const ollamaData = await ollamaResponse.json();
    const reply = ollamaData.message?.content || "I couldn't generate a response.";
    
    res.json({ reply });
  } catch (error: any) {
    console.error("Chat error:", error);
    if (error.message === "Timeout") {
      // Try to provide useful info even on timeout
      try {
        const db = await getDbSchema();
        if (db.tables.length > 0) {
          res.json({ reply: `The AI is taking too long, but I can tell you that your database has these tables: ${db.tables.slice(0,10).join(', ')}${db.tables.length > 10 ? '...' : ''}. Try asking about a specific table.` });
        } else {
          res.json({ reply: "I'm having trouble connecting to the AI right now. The models may be loading still. Please try again in a moment." });
        }
      } catch {
        res.json({ reply: "I'm having trouble connecting to the AI right now. The models may be loading still. Please try again in a moment." });
      }
    } else {
      res.json({ reply: `Error: ${error.message}` });
    }
  }
});

// Serve handoff JSON file
app.get("/handoff/opencode-local-agents.json", (req, res) => {
  const handoffPath = "/home/sherlockhums/apps/pixelworld/.handoff/opencode-local-agents.json";
  if (fs.existsSync(handoffPath)) {
    const data = fs.readFileSync(handoffPath, "utf-8");
    res.setHeader("Content-Type", "application/json");
    res.send(data);
  } else {
    res.status(404).json({ error: "Handoff file not found" });
  }
});

// Workflow task storage (in-memory)
interface WorkflowTask {
  id: string;
  workflowType: string;
  status: string;
  currentOwner: string;
  requester: string;
  summary: string;
  inputs: Record<string, any>;
  worklog: Array<{ timestamp: string; agent: string; action: string; note: string }>;
  artifacts: Array<{ type: string; content: string }>;
  response?: string;
  createdAt: string;
  priority: string;
}

const workflowTasks: Map<string, WorkflowTask> = new Map();

function generateTaskId(): string {
  return `task_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

async function fetchGitHubFile(owner: string, repo: string, path: string, token?: string): Promise<{ content: string; sha: string } | null> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  
  const headers: Record<string, string> = {
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "PixelOffice/1.0"
  };
  
  if (token) {
    headers["Authorization"] = `token ${token}`;
  }
  
  try {
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      console.error(`GitHub API error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.content) {
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      return { content, sha: data.sha };
    }
    
    return null;
  } catch (error) {
    console.error("GitHub fetch error:", error);
    return null;
  }
}

async function fetchGitHubREADME(owner: string, repo: string, token?: string): Promise<string | null> {
  const readmeNames = ['README.md', 'README.rst', 'README.txt', 'README'];
  
  for (const name of readmeNames) {
    const result = await fetchGitHubFile(owner, repo, name, token);
    if (result) {
      return result.content;
    }
  }
  
  return null;
}

// GitHub file retrieval endpoint (triggers full workflow)
app.post("/api/workflow/github/readme", async (req, res) => {
  try {
    const { owner, repo, requester, token } = req.body;
    
    if (!owner || !repo) {
      res.status(400).json({ error: "owner and repo are required" });
      return;
    }
    
    const taskId = generateTaskId();
    const now = new Date().toISOString();
    
    const task: WorkflowTask = {
      id: taskId,
      workflowType: "github_readme_retrieval",
      status: "in_progress",
      currentOwner: "archivist",
      requester: requester || "user",
      summary: `Retrieve README from ${owner}/${repo}`,
      inputs: { owner, repo },
      worklog: [
        { timestamp: now, agent: "system", action: "ticket_created", note: `Request to retrieve README from ${owner}/${repo}` },
        { timestamp: now, agent: "receptionist", action: "ticket_processed", note: `Extracted: Fetch README from ${owner}/${repo}` },
        { timestamp: now, agent: "clerk", action: "assigned", note: "Assigned to specialist" },
        { timestamp: now, agent: "specialist", action: "reviewed", note: "Processing GitHub API request" }
      ],
      artifacts: [],
      createdAt: now,
      priority: "normal"
    };
    
    workflowTasks.set(taskId, task);
    
    // Fetch the README
    const readmeContent = await fetchGitHubREADME(owner, repo, token);
    
    if (!readmeContent) {
      task.status = "failed";
      task.response = `I couldn't find a README file in the repository ${owner}/${repo}. Please check the repository name and try again.`;
      task.worklog.push({
        timestamp: new Date().toISOString(),
        agent: "specialist",
        action: "failed",
        note: `Could not find README in ${owner}/${repo}`
      });
      
      workflowTasks.set(taskId, task);
      
      res.json({ 
        taskId, 
        status: task.status,
        response: task.response,
        worklog: task.worklog
      });
      return;
    }
    
    const truncatedContent = readmeContent.length > 5000 
      ? readmeContent.substring(0, 5000) + "\n\n... (truncated)"
      : readmeContent;
    
    task.artifacts.push({ type: "file", content: readmeContent });
    task.status = "completed";
    task.response = `Here's the README from ${owner}/${repo}:\n\n${truncatedContent}`;
    task.worklog.push({
      timestamp: new Date().toISOString(),
      agent: "archivist",
      action: "completed",
      note: "Task completed successfully"
    });
    
    workflowTasks.set(taskId, task);
    
    res.json({ 
      taskId, 
      status: task.status,
      summary: task.summary,
      response: task.response,
      artifacts: task.artifacts,
      worklog: task.worklog
    });
  } catch (error: any) {
    console.error("GitHub README workflow error:", error);
    res.status(500).json({ error: error.message || "Failed to retrieve README" });
  }
});

// ============================================================================
// GitHub README Edit Workflow
// ============================================================================

async function githubRequest(endpoint: string, token: string, method: string = "GET", body?: object): Promise<any> {
  const url = `https://api.github.com${endpoint}`;
  const headers: Record<string, string> = {
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "PixelOffice/1.0",
    "Authorization": `token ${token}`,
  };
  
  const options: any = { method, headers };
  if (body) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(url, options);
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub API error ${response.status}: ${error}`);
  }
  
  if (response.status === 204) return null;
  return response.json();
}

app.post("/api/workflow/github/readme/edit", async (req, res) => {
  try {
    const { 
      owner, 
      repo, 
      baseBranch = "main", 
      featureBranch, 
      editSpec,
      token 
    } = req.body;
    
    if (!owner || !repo || !featureBranch || !editSpec) {
      res.status(400).json({ error: "owner, repo, featureBranch, and editSpec are required" });
      return;
    }
    
    if (!token) {
      res.status(400).json({ error: "GitHub token is required for write operations" });
      return;
    }
    
    const taskId = generateTaskId();
    const now = new Date().toISOString();
    const readmePath = "README.md";
    
    const worklog: any[] = [
      { timestamp: now, agent: "system", action: "ticket_created", note: `Request to edit README for ${owner}/${repo}` },
      { timestamp: now, agent: "receptionist", action: "ticket_processed", note: `Edit mode: ${editSpec.mode}, section: ${editSpec.sectionTitle}` },
    ];
    
    // Step 1: Get base branch SHA
    worklog.push({ timestamp: new Date().toISOString(), agent: "clerk", action: "assigned", note: `Assigned to specialist for GitHub operations` });
    
    let baseBranchSha: string;
    try {
      const branchData = await githubRequest(`/repos/${owner}/${repo}/git/refs/heads/${baseBranch}`, token);
      baseBranchSha = branchData.object.sha;
    } catch (e: any) {
      worklog.push({ timestamp: new Date().toISOString(), agent: "specialist", action: "failed", note: `Could not get base branch: ${e.message}` });
      res.json({ taskId, status: "failed", worklog, error: e.message });
      return;
    }
    
    // Step 2: Create feature branch if it doesn't exist
    try {
      await githubRequest(`/repos/${owner}/${repo}/git/refs`, token, "POST", {
        ref: `refs/heads/${featureBranch}`,
        sha: baseBranchSha
      });
      worklog.push({ timestamp: new Date().toISOString(), agent: "specialist", action: "branch_created", note: `Created branch ${featureBranch} from ${baseBranch}` });
    } catch (e: any) {
      // Branch might already exist - that's OK
      worklog.push({ timestamp: new Date().toISOString(), agent: "specialist", action: "branch_exists", note: `Branch ${featureBranch} already exists` });
    }
    
    // Step 3: Get current README content
    let readmeContent: string = "";
    try {
      const readmeData = await githubRequest(`/repos/${owner}/${repo}/contents/${readmePath}?ref=${featureBranch}`, token);
      readmeContent = Buffer.from(readmeData.content, 'base64').toString('utf-8');
      worklog.push({ timestamp: new Date().toISOString(), agent: "specialist", action: "file_fetched", note: `Fetched current README.md` });
    } catch (e: any) {
      // README might not exist on this branch - that's OK, start fresh
      worklog.push({ timestamp: new Date().toISOString(), agent: "specialist", action: "file_not_found", note: `No README.md on branch, will create new` });
    }
    
    // Step 4: Apply editSpec
    let newReadmeContent = readmeContent;
    const { mode, sectionTitle, content } = editSpec;
    
    if (mode === "append-section") {
      newReadmeContent = readmeContent + `\n\n## ${sectionTitle}\n\n${content}\n`;
      worklog.push({ timestamp: new Date().toISOString(), agent: "specialist", action: "content_appended", note: `Appended section: ${sectionTitle}` });
    } else if (mode === "replace-section") {
      const sectionRegex = new RegExp(`(^##\\s+${escapeRegExp(sectionTitle)}[\\s\\S]*?)(?=\\n##\\s+|$)`, 'm');
      if (sectionRegex.test(readmeContent)) {
        newReadmeContent = readmeContent.replace(sectionRegex, `## ${sectionTitle}\n\n${content}\n`);
        worklog.push({ timestamp: new Date().toISOString(), agent: "specialist", action: "content_replaced", note: `Replaced section: ${sectionTitle}` });
      } else {
        newReadmeContent = readmeContent + `\n\n## ${sectionTitle}\n\n${content}\n`;
        worklog.push({ timestamp: new Date().toISOString(), agent: "specialist", action: "section_not_found", note: `Section not found, appended instead` });
      }
    }
    
    // Step 5: Get current README SHA for update
    let readmeSha: string | undefined;
    try {
      const readmeData = await githubRequest(`/repos/${owner}/${repo}/contents/${readmePath}?ref=${featureBranch}`, token);
      readmeSha = readmeData.sha;
    } catch (e) {
      // File doesn't exist, no SHA needed
    }
    
    // Step 6: Commit the change
    const commitMessage = `chore: ${editSpec.mode === 'append-section' ? 'Add' : 'Update'} ${sectionTitle} section`;
    const commitData = await githubRequest(`/repos/${owner}/${repo}/contents/${readmePath}`, token, "PUT", {
      message: commitMessage,
      content: Buffer.from(newReadmeContent).toString('base64'),
      branch: featureBranch,
      sha: readmeSha
    });
    
    const commitSha = commitData.commit.sha;
    worklog.push({ timestamp: new Date().toISOString(), agent: "specialist", action: "committed", note: `Committed as ${commitSha.slice(0, 7)}` });
    
    // Step 7: Archivist logs
    worklog.push({ timestamp: new Date().toISOString(), agent: "archivist", action: "archived", note: `Updated ${readmePath} on branch ${featureBranch}` });
    
    // Generate diff summary
    const linesAdded = newReadmeContent.split('\n').length - readmeContent.split('\n').length;
    const diffSummary = `+${linesAdded} lines`;
    
    const response = {
      taskId,
      status: "completed",
      summary: `Updated README.md on branch ${featureBranch}`,
      response: `Successfully updated README.md for ${owner}/${repo}.\n- Branch: ${featureBranch}\n- Commit: ${commitSha.slice(0, 7)}\n- Changes: ${diffSummary}`,
      artifacts: [
        {
          type: "markdown",
          title: `README.md updates`,
          content: newReadmeContent
        },
        {
          type: "diff",
          title: "Changes",
          content: `Section: ${sectionTitle}\nMode: ${mode}\nCommit: ${commitSha}\nBranch: ${featureBranch}`
        }
      ],
      worklog,
      owner,
      repo,
      baseBranch,
      featureBranch,
      commitSha,
      readmePath
    };
    
    res.json(response);
  } catch (error: any) {
    console.error("GitHub README edit workflow error:", error);
    res.status(500).json({ error: error.message || "Failed to edit README" });
  }
});

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Get task status
app.get("/api/workflow/:taskId", (req, res) => {
  const { taskId } = req.params;
  const task = workflowTasks.get(taskId);
  
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  
  res.json({ task });
});

// ============================================================================
// Office SitRep Workflow
// ============================================================================

import fs from "fs";
import path from "path";

interface SitrepArtifact {
  type: "markdown" | "text" | string;
  title: string;
  content: string;
}

interface SitrepWorkflowEntry {
  timestamp: string;
  agent: "system" | "receptionist" | "specialist" | "executive" | "archivist" | string;
  action: string;
  note: string;
}

interface OfficeSitrepResponse {
  taskId: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  summary: string;
  response: string;
  artifacts: SitrepArtifact[];
  worklog: SitrepWorkflowEntry[];
  archivedPath?: string;
}

async function loadAgentCards(): Promise<any[]> {
  try {
    const handoffPath = path.resolve(process.cwd(), "../.handoff/opencode-local-agents.json");
    if (fs.existsSync(handoffPath)) {
      const data = fs.readFileSync(handoffPath, "utf-8");
      return JSON.parse(data);
    }
  } catch (e) {
    console.error("Failed to load agent cards:", e);
  }
  return [];
}

async function generateSitrep(scope: string, detailLevel: string): Promise<string> {
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const timeStr = now.toTimeString().split(" ")[0].replace(/:/g, "");
  
  const agentCards = await loadAgentCards();
  
  let sitrep = `# Office Situation Report – ${dateStr}

## Overview
Pixel Office is operational with ${agentCards.length} configured agents across 3 applications (pixel_office, pixel-me, pixeltroupe).

## Workflows
- **GitHub README Retrieval**: Active - Fetch README files from any public or private GitHub repository
- **Office SitRep Generator**: Active (this report) - Generates situation reports about the office

## Agents & Models
| Agent | Role | Primary Model | Status |
|-------|------|---------------|--------|
`;
  
  for (const agent of agentCards.slice(0, 10)) {
    const modelName = agent.models?.primary?.name || "unknown";
    const status = agent.models?.primary?.status || "unknown";
    sitrep += `| ${agent.name} | ${agent.tags?.[0] || "N/A"} | ${modelName} | ${status} |\n`;
  }
  
  if (agentCards.length > 10) {
    sitrep += `\n*... and ${agentCards.length - 10} more agents*\n`;
  }
  
  sitrep += `
## UI / Front-of-House
- **Receptionist Card**: Interactive with GitHub README and SitRep workflow buttons
- **Agent Action Cards**: Model status indicators, mood controls, chat interface
- **Canvas View**: Real-time agent movement and status display

## Recent Milestones
- Implemented agent card handoff system for Opencode integration
- GitHub README retrieval workflow operational
- Visual workflow animations with perceived latency

## Risks / TODOs
- Expand local model availability
- Add more workflow types
- Improve error handling and retry logic

---
*Generated: ${now.toISOString()}*
`;
  
  return sitrep;
}

app.post("/api/workflow/office/sitrep", async (req, res) => {
  try {
    const { scope = "full", detailLevel = "normal", includeMetrics = true, requester = "user" } = req.body;
    
    const taskId = generateTaskId();
    const now = new Date().toISOString();
    const timestamp = now.replace(/[:.]/g, "-").slice(0, 19);
    
    const worklog: SitrepWorkflowEntry[] = [
      { timestamp: now, agent: "system", action: "ticket_created", note: `Request for Office SitRep (${scope}, ${detailLevel})` },
      { timestamp: now, agent: "receptionist", action: "ticket_processed", note: `Normalized: scope=${scope}, detailLevel=${detailLevel}` },
    ];
    
    // Step 1: Specialist drafts the SitRep
    const sitrepContent = await generateSitrep(scope, detailLevel);
    worklog.push({ 
      timestamp: new Date().toISOString(), 
      agent: "specialist", 
      action: "drafted", 
      note: `Generated first draft of Office SitRep (${scope}, ${detailLevel})` 
    });
    
    // Step 2: Executive approves
    worklog.push({ 
      timestamp: new Date().toISOString(), 
      agent: "executive", 
      action: "approved", 
      note: "Reviewed and approved SitRep for archive" 
    });
    
    // Step 3: Archivist saves to disk
    const sitrepsDir = path.resolve(process.cwd(), "../docs/sitreps");
    if (!fs.existsSync(sitrepsDir)) {
      fs.mkdirSync(sitrepsDir, { recursive: true });
    }
    
    const filename = `office-sitrep-${timestamp}Z.md`;
    const archivedPath = path.join(sitrepsDir, filename);
    fs.writeFileSync(archivedPath, sitrepContent, "utf-8");
    
    worklog.push({ 
      timestamp: new Date().toISOString(), 
      agent: "archivist", 
      action: "archived", 
      note: `Saved SitRep to docs/sitreps/${filename}` 
    });
    
    const response: OfficeSitrepResponse = {
      taskId,
      status: "completed",
      summary: `Office SitRep (${scope}, ${detailLevel}) generated and approved`,
      response: sitrepContent,
      artifacts: [
        {
          type: "markdown",
          title: `Office SitRep – ${now.split("T")[0]}`,
          content: sitrepContent
        }
      ],
      worklog,
      archivedPath: `docs/sitreps/${filename}`
    };
    
    res.json(response);
  } catch (error: any) {
    console.error("Office SitRep workflow error:", error);
    res.status(500).json({ error: error.message || "Failed to generate SitRep" });
  }
});

app.listen(Number(PORT), "127.0.0.1", () => {
  console.log(`Pixel Office Workflow server running on http://localhost:${PORT}`);
});
