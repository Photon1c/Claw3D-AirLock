/**
 * Phase D Bind Patch: Repo Question Handler
 * 
 * Minimal integration to enable repo questions like "What is on this repo's README?"
 * through the existing chat interface.
 * 
 * This module:
 * - Classifies if a message is a repo question
 * - Parses the question type (README, status, files, etc.)
 * - Fetches repo info via GitHub API (or provides helpful fallback)
 * - Optionally creates tasks from interactions
 */

export interface RepoQuestionResult {
  isRepoQuestion: boolean;
  questionType: RepoQuestionType | null;
  answer: string;
  metadata?: {
    fileContent?: string;
    fileName?: string;
    repoStatus?: RepoStatus;
  };
  taskCreated?: boolean;
}

export type RepoQuestionType = 
  | "readme"
  | "status" 
  | "files"
  | "structure"
  | "issues"
  | "branches"
  | "contributors"
  | "general";

export interface RepoStatus {
  owner: string;
  repo: string;
  branch: string;
  defaultBranch: string;
  openIssues: number;
  watchers: number;
  forks: number;
  description: string | null;
}

const REPO_QUESTION_PATTERNS = [
  /\b(readme|read me|what('?s| is) on)\b.*\b(readme|repo|repository)\b/i,
  /\bwhat('?s| is) (in|on|inside)\b.*\b(repo|repository)\b/i,
  /\b(repo|repository)\b.*\b(readme|status|files|structure)\b/i,
  /\bwhat('?s| is) the (repo|repository)\b/i,
  /\bcheck\s+(the\s+)?(repo|repository|github)\b/i,
  /\blist\s+(the\s+)?(files|branches|issues)\b/i,
  /\bshow\s+(me\s+)?(readme|repo|repository)\b/i,
  /\bREADME\b/i,
  /\bgit(hub|lab)?\s+(status|info|info)\b/i,
];

export function isRepoQuestion(message: string): { isQuestion: boolean; type: RepoQuestionType | null } {
  const lower = message.toLowerCase();
  
  if (/\breadme\b/i.test(lower) || /\b(read me|read me up)\b/i.test(lower)) {
    return { isQuestion: true, type: "readme" };
  }
  
  if (/\b(status|state|changes|modified|untracked)\b.*\b(repo|repository|github|git)\b/i.test(lower) ||
      /\b(repo|repository|github|git)\b.*\b(status|state|changes|modified)\b/i.test(lower)) {
    return { isQuestion: true, type: "status" };
  }
  
  if (/\bfiles?\b/i.test(lower) && /\b(repo|repository|github|this project|project)\b/i.test(lower)) {
    return { isQuestion: true, type: "files" };
  }
  
  if (/\b(structure|tree|directories?|folders?)\b.*\b(repo|repository|this project)\b/i.test(lower) ||
      /\b(repo|repository)\b.*\b(structure|tree|directories?|folders?)\b/i.test(lower)) {
    return { isQuestion: true, type: "structure" };
  }
  
  if (/\bissues?\b/i.test(lower)) {
    return { isQuestion: true, type: "issues" };
  }
  
  if (/\bbranches?\b/i.test(lower)) {
    return { isQuestion: true, type: "branches" };
  }
  
  if (/\bcontributors?\b/i.test(lower)) {
    return { isQuestion: true, type: "contributors" };
  }
  
  if (/\b(about|info|details)\b.*\b(this project|the project|repo|repository)\b/i.test(lower) ||
      /\b(what's|what is|describe)\b.*\b(this|the)\b.*\b(project|repo|repository)\b/i.test(lower)) {
    return { isQuestion: true, type: "general" };
  }
  
  for (const pattern of REPO_QUESTION_PATTERNS) {
    if (pattern.test(lower)) {
      return { isQuestion: true, type: "general" };
    }
  }
  
  return { isQuestion: false, type: null };
}

export function extractRepoInfo(config: {
  owner?: string;
  repo?: string;
  branch?: string;
}): { owner: string; repo: string; branch: string } {
  return {
    owner: config.owner || process.env.SAFE_SCRUM_REPO?.split("/")[0] || "unknown",
    repo: config.repo || process.env.SAFE_SCRUM_REPO?.split("/")[1] || "unknown",
    branch: config.branch || process.env.SAFE_SCRUM_BRANCH || "main",
  };
}

export async function fetchRepoStatus(config: {
  owner: string;
  repo: string;
  token?: string;
}): Promise<RepoStatus | null> {
  const token = config.token || process.env.GITHUB_TOKEN;
  
  if (!token || config.owner === "unknown" || config.repo === "unknown") {
    return null;
  }
  
  try {
    const response = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "PixelOffice-RepoQuestionHandler",
      },
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json() as {
      default_branch: string;
      open_issues_count: number;
      watchers_count: number;
      forks_count: number;
      description: string | null;
    };
    
    return {
      owner: config.owner,
      repo: config.repo,
      branch: data.default_branch,
      defaultBranch: data.default_branch,
      openIssues: data.open_issues_count,
      watchers: data.watchers_count,
      forks: data.forks_count,
      description: data.description,
    };
  } catch {
    return null;
  }
}

export async function fetchFileContent(config: {
  owner: string;
  repo: string;
  branch: string;
  path: string;
  token?: string;
}): Promise<string | null> {
  const token = config.token || process.env.GITHUB_TOKEN;
  
  if (!token || config.owner === "unknown" || config.repo === "unknown") {
    return null;
  }
  
  try {
    const response = await fetch(
      `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.path}?ref=${config.branch}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "PixelOffice-RepoQuestionHandler",
        },
      }
    );
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json() as { content?: string; encoding?: string };
    
    if (data.encoding === "base64" && data.content) {
      return Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf8");
    }
    
    return null;
  } catch {
    return null;
  }
}

export async function fetchFileList(config: {
  owner: string;
  repo: string;
  branch: string;
  path?: string;
  token?: string;
}): Promise<{ files: string[]; dirs: string[] } | null> {
  const token = config.token || process.env.GITHUB_TOKEN;
  
  if (!token || config.owner === "unknown" || config.repo === "unknown") {
    return null;
  }
  
  try {
    const path = config.path || "";
    const response = await fetch(
      `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}?ref=${config.branch}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "PixelOffice-RepoQuestionHandler",
        },
      }
    );
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json() as Array<{ name: string; type: string }>;
    
    const files: string[] = [];
    const dirs: string[] = [];
    
    for (const item of data) {
      if (item.type === "file") {
        files.push(item.name);
      } else if (item.type === "dir") {
        dirs.push(item.name + "/");
      }
    }
    
    return { files, dirs };
  } catch {
    return null;
  }
}

export function generateReadmeAnswer(fileContent: string | null, repoInfo: { owner: string; repo: string }): string {
  if (!fileContent) {
    return `I couldn't fetch the README for ${repoInfo.owner}/${repoInfo.repo}. ` +
           `This might mean:\n` +
           `- The repository doesn't have a README file\n` +
           `- The GitHub token isn't configured\n` +
           `- The repository is private\n\n` +
           `You can check manually at: https://github.com/${repoInfo.owner}/${repoInfo.repo}`;
  }
  
  const truncated = fileContent.length > 2000 
    ? fileContent.substring(0, 2000) + "\n\n*[truncated]*"
    : fileContent;
  
  return `Here's what's in the README for **${repoInfo.owner}/${repoInfo.repo}**:\n\n${truncated}`;
}

export function generateStatusAnswer(status: RepoStatus | null, repoInfo: { owner: string; repo: string }): string {
  if (!status) {
    return `I couldn't fetch the status for ${repoInfo.owner}/${repoInfo.repo}. ` +
           `GitHub integration may not be configured. ` +
           `Set GITHUB_TOKEN in your .env file to enable repo status.`;
  }
  
  return [
    `## Repository Status: ${status.owner}/${status.repo}`,
    ``,
    `**Default Branch:** ${status.defaultBranch}`,
    `**Description:** ${status.description || "(no description)"}`,
    ``,
    `**Stats:**`,
    `- Open Issues: ${status.openIssues}`,
    `- Watchers: ${status.watchers}`,
    `- Forks: ${status.forks}`,
    ``,
    `**Link:** https://github.com/${status.owner}/${status.repo}`,
  ].join("\n");
}

export function generateFilesAnswer(fileList: { files: string[]; dirs: string[] } | null, repoInfo: { owner: string; repo: string }): string {
  if (!fileList) {
    return `I couldn't list files for ${repoInfo.owner}/${repoInfo.repo}. ` +
           `GitHub integration may not be configured.`;
  }
  
  const { files, dirs } = fileList;
  
  if (files.length === 0 && dirs.length === 0) {
    return `The repository ${repoInfo.owner}/${repoInfo.repo} appears to be empty.`;
  }
  
  const lines = [`## Files in ${repoInfo.owner}/${repoInfo.repo}`, ""];
  
  if (dirs.length > 0) {
    lines.push("**Directories:**");
    for (const dir of dirs.slice(0, 10)) {
      lines.push(`- 📁 ${dir}`);
    }
    if (dirs.length > 10) {
      lines.push(`- ... and ${dirs.length - 10} more directories`);
    }
    lines.push("");
  }
  
  if (files.length > 0) {
    lines.push("**Files:**");
    for (const file of files.slice(0, 20)) {
      lines.push(`- 📄 ${file}`);
    }
    if (files.length > 20) {
      lines.push(`- ... and ${files.length - 20} more files`);
    }
  }
  
  return lines.join("\n");
}

export async function handleRepoQuestion(
  message: string,
  options?: {
    createTask?: boolean;
    token?: string;
  }
): Promise<RepoQuestionResult> {
  const { isQuestion, type } = isRepoQuestion(message);
  
  if (!isQuestion || !type) {
    return {
      isRepoQuestion: false,
      questionType: null,
      answer: "",
    };
  }
  
  const repoInfo = extractRepoInfo({});
  const token = options?.token || process.env.GITHUB_TOKEN;
  
  switch (type) {
    case "readme": {
      const content = await fetchFileContent({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        branch: repoInfo.branch,
        path: "README.md",
        token,
      });
      
      return {
        isRepoQuestion: true,
        questionType: "readme",
        answer: generateReadmeAnswer(content, repoInfo),
        metadata: content ? { fileContent: content, fileName: "README.md" } : undefined,
      };
    }
    
    case "status": {
      const status = await fetchRepoStatus({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        token,
      });
      
      return {
        isRepoQuestion: true,
        questionType: "status",
        answer: generateStatusAnswer(status, repoInfo),
        metadata: status ? { repoStatus: status } : undefined,
      };
    }
    
    case "files":
    case "structure": {
      const fileList = await fetchFileList({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        branch: repoInfo.branch,
        token,
      });
      
      return {
        isRepoQuestion: true,
        questionType: type,
        answer: generateFilesAnswer(fileList, repoInfo),
      };
    }
    
    default: {
      const status = await fetchRepoStatus({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        token,
      });
      
      return {
        isRepoQuestion: true,
        questionType: "general",
        answer: generateStatusAnswer(status, repoInfo),
        metadata: status ? { repoStatus: status } : undefined,
      };
    }
  }
}

export function formatAnswerForOffice(result: RepoQuestionResult, agentName: string = "clerk"): string {
  if (!result.isRepoQuestion) {
    return "";
  }
  
  return [
    `*[${agentName} checks the repository and responds]*`,
    "",
    result.answer,
  ].join("\n");
}
