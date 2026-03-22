import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SafeScrumRepoClient,
  createSafeScrumRepoClient,
  type SafeScrumRepoClientConfig,
} from "../safeScrumRepoClient";

describe("SafeScrumRepoClient", () => {
  it("throws INVALID_CONFIG when owner is missing", () => {
    assert.throws(
      () => new SafeScrumRepoClient({ owner: "", repo: "test", branch: "main", token: "abc", reportsDir: "docs", notesPath: "notes.md" }),
      (error: any) => {
        assert.equal(error.code, "INVALID_CONFIG");
        assert.ok(error.message.includes("owner"));
        return true;
      }
    );
  });

  it("throws INVALID_CONFIG when repo is missing", () => {
    assert.throws(
      () => new SafeScrumRepoClient({ owner: "test", repo: "", branch: "main", token: "abc", reportsDir: "docs", notesPath: "notes.md" }),
      (error: any) => {
        assert.equal(error.code, "INVALID_CONFIG");
        assert.ok(error.message.includes("repo"));
        return true;
      }
    );
  });

  it("throws INVALID_CONFIG when token is missing", () => {
    assert.throws(
      () => new SafeScrumRepoClient({ owner: "test", repo: "repo", branch: "main", token: "", reportsDir: "docs", notesPath: "notes.md" }),
      (error: any) => {
        assert.equal(error.code, "INVALID_CONFIG");
        assert.ok(error.message.includes("token"));
        return true;
      }
    );
  });

  it("accepts valid config", () => {
    const client = new SafeScrumRepoClient({
      owner: "test-owner",
      repo: "test-repo",
      branch: "main",
      token: "ghp_test123",
      reportsDir: "docs/reports",
      notesPath: "docs/notes.md",
    });

    const config = client.getConfig();
    assert.equal(config.owner, "test-owner");
    assert.equal(config.repo, "test-repo");
    assert.equal(config.branch, "main");
  });

  it("reports isConfigured correctly", () => {
    const client1 = new SafeScrumRepoClient({
      owner: "test",
      repo: "repo",
      branch: "main",
      token: "abc",
      reportsDir: "docs",
      notesPath: "notes.md",
    });
    assert.equal(client1.isConfigured(), true);

    assert.throws(() => {
      new SafeScrumRepoClient({
        owner: "",
        repo: "",
        branch: "",
        token: "",
        reportsDir: "",
        notesPath: "",
      });
    });
  });
});

describe("createSafeScrumRepoClient", () => {
  it("returns null when GITHUB_TOKEN is missing", () => {
    const client = createSafeScrumRepoClient({
      GITHUB_TOKEN: undefined,
      SAFE_SCRUM_REPO: "owner/repo",
      SAFE_SCRUM_BRANCH: "main",
      SAFE_SCRUM_REPORTS_DIR: "docs",
      SAFE_SCRUM_NOTES_PATH: "notes.md",
    });
    assert.equal(client, null);
  });

  it("returns null when SAFE_SCRUM_REPO is missing", () => {
    const client = createSafeScrumRepoClient({
      GITHUB_TOKEN: "ghp_abc",
      SAFE_SCRUM_REPO: undefined,
      SAFE_SCRUM_BRANCH: "main",
      SAFE_SCRUM_REPORTS_DIR: "docs",
      SAFE_SCRUM_NOTES_PATH: "notes.md",
    });
    assert.equal(client, null);
  });

  it("creates client with valid env", () => {
    const client = createSafeScrumRepoClient({
      GITHUB_TOKEN: "ghp_abc123",
      SAFE_SCRUM_REPO: "my-owner/my-repo",
      SAFE_SCRUM_BRANCH: "develop",
      SAFE_SCRUM_REPORTS_DIR: "reports",
      SAFE_SCRUM_NOTES_PATH: "notes.md",
    });

    assert.notEqual(client, null);
    if (client) {
      const config = client.getConfig();
      assert.equal(config.owner, "my-owner");
      assert.equal(config.repo, "my-repo");
      assert.equal(config.branch, "develop");
    }
  });

  it("uses defaults for optional env vars", () => {
    const client = createSafeScrumRepoClient({
      GITHUB_TOKEN: "ghp_abc",
      SAFE_SCRUM_REPO: "owner/repo",
      SAFE_SCRUM_BRANCH: undefined,
      SAFE_SCRUM_REPORTS_DIR: undefined,
      SAFE_SCRUM_NOTES_PATH: undefined,
    });

    assert.notEqual(client, null);
    if (client) {
      const config = client.getConfig();
      assert.equal(config.branch, "main");
    }
  });
});
