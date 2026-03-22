import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isRepoQuestion,
  extractRepoInfo,
  generateReadmeAnswer,
  generateStatusAnswer,
  generateFilesAnswer,
  formatAnswerForOffice,
  type RepoQuestionResult,
} from "../repoQuestionHandler";

describe("isRepoQuestion", () => {
  const testCases: Array<{ message: string; expected: { isQuestion: boolean; type: string | null } }> = [
    { message: "What is on this repo's README?", expected: { isQuestion: true, type: "readme" } },
    { message: "What's in the README?", expected: { isQuestion: true, type: "readme" } },
    { message: "Read me the repository info", expected: { isQuestion: true, type: "readme" } },
    { message: "Show me the README", expected: { isQuestion: true, type: "readme" } },
    { message: "What's the repo status?", expected: { isQuestion: true, type: "status" } },
    { message: "What changes are in the repo?", expected: { isQuestion: true, type: "status" } },
    { message: "Check the repository status", expected: { isQuestion: true, type: "status" } },
    { message: "What files are in this repo?", expected: { isQuestion: true, type: "files" } },
    { message: "List the repository files", expected: { isQuestion: true, type: "files" } },
    { message: "What's the repo structure?", expected: { isQuestion: true, type: "structure" } },
    { message: "What are the branches?", expected: { isQuestion: true, type: "branches" } },
    { message: "Show me the issues", expected: { isQuestion: true, type: "issues" } },
    { message: "Who are the contributors?", expected: { isQuestion: true, type: "contributors" } },
    { message: "Tell me about this project", expected: { isQuestion: true, type: "general" } },
    { message: "What's the weather like?", expected: { isQuestion: false, type: null } },
    { message: "How do I fix this bug?", expected: { isQuestion: false, type: null } },
    { message: "Hello there!", expected: { isQuestion: false, type: null } },
  ];

  for (const { message, expected } of testCases) {
    it(`"${message}" -> isQuestion: ${expected.isQuestion}, type: ${expected.type}`, () => {
      const result = isRepoQuestion(message);
      assert.equal(result.isQuestion, expected.isQuestion);
      assert.equal(result.type, expected.type);
    });
  }
});

describe("extractRepoInfo", () => {
  it("uses provided values when given", () => {
    const info = extractRepoInfo({ owner: "test-owner", repo: "test-repo", branch: "develop" });
    assert.equal(info.owner, "test-owner");
    assert.equal(info.repo, "test-repo");
    assert.equal(info.branch, "develop");
  });

  it("falls back to env vars when not provided", () => {
    const info = extractRepoInfo({});
    assert.equal(info.owner, "unknown");
    assert.equal(info.repo, "unknown");
    assert.equal(info.branch, "main");
  });

  it("merges partial inputs correctly", () => {
    const info = extractRepoInfo({ owner: "custom-owner" });
    assert.equal(info.owner, "custom-owner");
    assert.equal(info.repo, "unknown");
    assert.equal(info.branch, "main");
  });
});

describe("generateReadmeAnswer", () => {
  it("returns content when available", () => {
    const content = "# Test Project\n\nThis is a test.";
    const answer = generateReadmeAnswer(content, { owner: "test", repo: "repo" });
    assert.ok(answer.includes("# Test Project"));
    assert.ok(answer.includes("test/repo"));
  });

  it("returns helpful message when content is null", () => {
    const answer = generateReadmeAnswer(null, { owner: "test", repo: "repo" });
    assert.ok(answer.includes("couldn't fetch"));
    assert.ok(answer.includes("github.com"));
  });

  it("truncates long content", () => {
    const longContent = "a".repeat(3000);
    const answer = generateReadmeAnswer(longContent, { owner: "test", repo: "repo" });
    assert.ok(answer.includes("truncated"));
  });
});

describe("generateStatusAnswer", () => {
  it("returns formatted status when available", () => {
    const status = {
      owner: "test",
      repo: "repo",
      branch: "main",
      defaultBranch: "main",
      openIssues: 5,
      watchers: 10,
      forks: 3,
      description: "A test repo",
    };
    const answer = generateStatusAnswer(status, { owner: "test", repo: "repo" });
    assert.ok(answer.includes("Repository Status"));
    assert.ok(answer.includes("Open Issues: 5"));
    assert.ok(answer.includes("Watchers: 10"));
    assert.ok(answer.includes("A test repo"));
  });

  it("returns helpful message when status is null", () => {
    const answer = generateStatusAnswer(null, { owner: "test", repo: "repo" });
    assert.ok(answer.includes("couldn't fetch"));
    assert.ok(answer.includes("GitHub integration"));
  });
});

describe("generateFilesAnswer", () => {
  it("formats file list correctly", () => {
    const fileList = {
      files: ["index.ts", "package.json", "README.md"],
      dirs: ["src/", "tests/"],
    };
    const answer = generateFilesAnswer(fileList, { owner: "test", repo: "repo" });
    assert.ok(answer.includes("index.ts"));
    assert.ok(answer.includes("package.json"));
    assert.ok(answer.includes("src/"));
    assert.ok(answer.includes("tests/"));
  });

  it("handles empty repo", () => {
    const answer = generateFilesAnswer({ files: [], dirs: [] }, { owner: "test", repo: "repo" });
    assert.ok(answer.includes("empty"));
  });

  it("returns helpful message when list is null", () => {
    const answer = generateFilesAnswer(null, { owner: "test", repo: "repo" });
    assert.ok(answer.includes("couldn't list"));
  });

  it("handles many files gracefully", () => {
    const files = Array.from({ length: 30 }, (_, i) => `file${i}.ts`);
    const answer = generateFilesAnswer({ files, dirs: [] }, { owner: "test", repo: "repo" });
    assert.ok(answer.includes("and 10 more files"));
  });
});

describe("formatAnswerForOffice", () => {
  it("formats repo question result for office display", () => {
    const result: RepoQuestionResult = {
      isRepoQuestion: true,
      questionType: "readme",
      answer: "# README\n\nContent here",
    };
    const formatted = formatAnswerForOffice(result, "clerk");
    assert.ok(formatted.includes("[clerk"));
    assert.ok(formatted.includes("README"));
  });

  it("returns empty string for non-repo questions", () => {
    const result: RepoQuestionResult = {
      isRepoQuestion: false,
      questionType: null,
      answer: "",
    };
    const formatted = formatAnswerForOffice(result);
    assert.equal(formatted, "");
  });

  it("uses default agent name", () => {
    const result: RepoQuestionResult = {
      isRepoQuestion: true,
      questionType: "status",
      answer: "Status info",
    };
    const formatted = formatAnswerForOffice(result);
    assert.ok(formatted.includes("[clerk"));
  });
});
