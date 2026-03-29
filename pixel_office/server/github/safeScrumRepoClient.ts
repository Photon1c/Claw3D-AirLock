/**
 * Phase D Governance: Pixel Office is considered stable.
 * GitHub integration for the configured repo should be straightforward.
 * This module is intentionally lightweight and should not grow additional policy/guardrail logic.
 */

import * as fs from "fs";
import * as path from "path";

export interface SafeScrumRepoClientConfig {
  owner: string;
  repo: string;
  branch: string;
  reportsDir: string;
  notesPath: string;
  token: string;
}

export interface GitHubError {
  code: string;
  message: string;
  status?: number;
}

function isValidConfig(config: Partial<SafeScrumRepoClientConfig>): config is SafeScrumRepoClientConfig {
  return !!(
    config.owner &&
    config.repo &&
    config.branch &&
    config.token &&
    config.reportsDir &&
    config.notesPath
  );
}

export class SafeScrumRepoClient {
  private config: SafeScrumRepoClientConfig;
  private baseUrl: string;

  constructor(config: Partial<SafeScrumRepoClientConfig>) {
    if (!isValidConfig(config)) {
      const missing: string[] = [];
      if (!config.owner) missing.push("owner");
      if (!config.repo) missing.push("repo");
      if (!config.branch) missing.push("branch");
      if (!config.token) missing.push("token");
      if (!config.reportsDir) missing.push("reportsDir");
      if (!config.notesPath) missing.push("notesPath");

      throw {
        code: "INVALID_CONFIG",
        message: `SafeScrumRepoClient requires: ${missing.join(", ")}`,
      } as GitHubError;
    }

    this.config = config;
    this.baseUrl = "https://api.github.com";
  }

  private async githubRequest<T>(
    method: string,
    endpoint: string,
    body?: object
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "User-Agent": "PixelOffice-SCRUM",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      throw {
        code: "GITHUB_API_ERROR",
        message: (data as any).message || "GitHub API request failed",
        status: response.status,
      } as GitHubError;
    }

    return data as T;
  }

  private async getFileSha(owner: string, repo: string, path: string): Promise<string | null> {
    try {
      const data = await this.githubRequest<{ sha: string }>(
        "GET",
        `/repos/${owner}/${repo}/contents/${path}?ref=${this.config.branch}`
      );
      return data.sha;
    } catch (error: any) {
      if (error.status === 404) return null;
      throw error;
    }
  }

  async pushReport(localPath: string, commitMessage: string): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      if (!fs.existsSync(localPath)) {
        throw {
          code: "FILE_NOT_FOUND",
          message: `Local file not found: ${localPath}`,
        } as GitHubError;
      }

      const content = fs.readFileSync(localPath, "utf8");
      const fileName = path.basename(localPath);
      const remotePath = path.posix.join(this.config.reportsDir, fileName);
      const sha = await this.getFileSha(this.config.owner, this.config.repo, remotePath);

      const body: any = {
        message: commitMessage,
        content: Buffer.from(content).toString("base64"),
        branch: this.config.branch,
      };

      if (sha) {
        body.sha = sha;
      }

      const result = await this.githubRequest<{ commit: { html_url: string } }>(
        "PUT",
        `/repos/${this.config.owner}/${this.config.repo}/contents/${remotePath}`,
        body
      );

      return { success: true, url: result.commit.html_url };
    } catch (error: any) {
      return { success: false, error: error.message || "Failed to push report" };
    }
  }

  async pushNotes(localContent: string, commitMessage: string): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      const sha = await this.getFileSha(this.config.owner, this.config.repo, this.config.notesPath);

      const body: any = {
        message: commitMessage,
        content: Buffer.from(localContent).toString("base64"),
        branch: this.config.branch,
      };

      if (sha) {
        body.sha = sha;
      }

      const result = await this.githubRequest<{ commit: { html_url: string } }>(
        "PUT",
        `/repos/${this.config.owner}/${this.config.repo}/contents/${this.config.notesPath}`,
        body
      );

      return { success: true, url: result.commit.html_url };
    } catch (error: any) {
      return { success: false, error: error.message || "Failed to push notes" };
    }
  }

  getConfig(): { owner: string; repo: string; branch: string } {
    return {
      owner: this.config.owner,
      repo: this.config.repo,
      branch: this.config.branch,
    };
  }

  isConfigured(): boolean {
    return isValidConfig(this.config);
  }
}

export function createSafeScrumRepoClient(env: Record<string, string | undefined>): SafeScrumRepoClient | null {
  const config: Partial<SafeScrumRepoClientConfig> = {
    owner: env.SAFE_SCRUM_REPO?.split("/")[0],
    repo: env.SAFE_SCRUM_REPO?.split("/")[1],
    branch: env.SAFE_SCRUM_BRANCH || "main",
    reportsDir: env.SAFE_SCRUM_REPORTS_DIR || "docs/reports",
    notesPath: env.SAFE_SCRUM_NOTES_PATH || "docs/PIXEL_OFFICE_SCRUM_NOTES.md",
    token: env.GITHUB_TOKEN,
  };

  if (!config.owner || !config.repo || !config.token) {
    return null;
  }

  try {
    return new SafeScrumRepoClient(config);
  } catch {
    return null;
  }
}
