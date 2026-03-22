import express from "express";

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

interface ResearchResult {
  branchId: string;
  branchName: string;
  difficulty: "easy" | "medium" | "hard";
  searchResults: string[];
  recommendation: string;
  sources: string[];
}

async function webSearch(query: string, numResults: number = 5): Promise<{ title: string; url: string; snippet: string }[]> {
  const results: { title: string; url: string; snippet: string }[] = [];
  
  try {
    const encodedQuery = encodeURIComponent(query);
    const response = await fetch(`https://duckduckgo.com/?q=${encodedQuery}&format=json&no_html=1`, {
      headers: {
        'Accept': 'application/json',
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.Results) {
        for (const result of data.Results.slice(0, numResults)) {
          results.push({
            title: result.Text || result.Title || "",
            url: result.FirstURL || result.URL || "",
            snippet: result.Text || ""
          });
        }
      }
      if (data.RelatedTopics) {
        for (const topic of data.RelatedTopics.slice(0, numResults - results.length)) {
          if (topic.Text) {
            results.push({
              title: topic.Text.substring(0, 50),
              url: topic.FirstURL || "",
              snippet: topic.Text
            });
          }
        }
      }
    }
  } catch (error) {
    console.error("Web search error:", error);
  }
  
  return results;
}

function parseMermaidTree(mermaidCode: string): GenealogyTree {
  const nodes: Record<string, GenealogyNode> = {};
  const rootIds: string[] = [];
  
  const lines = mermaidCode.split("\n").filter(line => line.trim());
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed.startsWith("graph") || trimmed.startsWith("flowchart")) continue;
    
    const edgeMatch = trimmed.match(/^(\w+)\s*-->\s*(\w+)$/);
    if (edgeMatch) {
      const [, parentId, childId] = edgeMatch;
      
      if (!nodes[parentId]) {
        nodes[parentId] = { id: parentId, name: parentId, generation: 0, children: [], parents: [] };
      }
      if (!nodes[childId]) {
        nodes[childId] = { id: childId, name: childId, generation: 0, children: [], parents: [] };
      }
      
      nodes[parentId].children.push(childId);
      nodes[childId].parents.push(parentId);
    }
    
    const labelMatch = trimmed.match(/^(\w+)\s*\[\s*"([^"]+)"\s*\](?:\s*-->\s*(\w+))?$/);
    if (labelMatch) {
      const [, id, name, childId] = labelMatch;
      
      if (!nodes[id]) {
        nodes[id] = { id, name, generation: 0, children: [], parents: [] };
      } else {
        nodes[id].name = name;
      }
      
      if (childId) {
        if (!nodes[childId]) {
          nodes[childId] = { id: childId, name: childId, generation: 0, children: [], parents: [] };
        }
        nodes[id].children.push(childId);
        nodes[childId].parents.push(id);
      }
    }
  }
  
  for (const [id, node] of Object.entries(nodes)) {
    if (node.parents.length === 0) {
      rootIds.push(id);
    }
    node.generation = calculateGeneration(id, nodes);
  }
  
  return { nodes, rootIds };
}

function calculateGeneration(nodeId: string, nodes: Record<string, GenealogyNode>): number {
  const node = nodes[nodeId];
  if (!node || node.parents.length === 0) return 0;
  
  let maxParentGen = 0;
  for (const parentId of node.parents) {
    const parentGen = calculateGeneration(parentId, nodes);
    maxParentGen = Math.max(maxParentGen, parentGen);
  }
  return maxParentGen + 1;
}

function getAllDescendants(nodeId: string, nodes: Record<string, GenealogyNode>): string[] {
  const descendants: string[] = [];
  const queue = [nodeId];
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    const node = nodes[current];
    if (!node) continue;
    
    for (const childId of node.children) {
      if (!descendants.includes(childId)) {
        descendants.push(childId);
        queue.push(childId);
      }
    }
  }
  
  return descendants;
}

function analyzeBranches(tree: GenealogyTree): { branchId: string; branchName: string; size: number; depth: number }[] {
  const branches: { branchId: string; branchName: string; size: number; depth: number }[] = [];
  
  for (const rootId of tree.rootIds) {
    const descendants = getAllDescendants(rootId, tree.nodes);
    const rootNode = tree.nodes[rootId];
    
    const getDepth = (nodeId: string): number => {
      const node = tree.nodes[nodeId];
      if (!node || node.children.length === 0) return 1;
      return 1 + Math.max(...node.children.map(getDepth));
    };
    
    branches.push({
      branchId: rootId,
      branchName: rootNode?.name || rootId,
      size: descendants.length + 1,
      depth: getDepth(rootId)
    });
  }
  
  return branches;
}

async function researchBranch(branchName: string): Promise<ResearchResult> {
  const searchQuery = `${branchName} genealogy family history records`;
  
  try {
    const results = await webSearch(searchQuery, 5);
    
    const searchableNames = branchName.split(" ").filter(n => n.length > 2);
    let difficulty: "easy" | "medium" | "hard" = "medium";
    let recommendation = "";
    const sources: string[] = [];
    
    const resultTexts = results.map(r => `${r.title} ${r.snippet || ""}`.toLowerCase());
    const hasRecords = resultTexts.some(t => 
      t.includes("census") || t.includes("vital") || t.includes("records") || t.includes("archives")
    );
    const hasGenealogy = resultTexts.some(t => 
      t.includes("genealogy") || t.includes("familysearch") || t.includes("ancestry")
    );
    const hasWikipedia = resultTexts.some(t => t.includes("wikipedia"));
    
    if (hasRecords && hasGenealogy) {
      difficulty = "easy";
      recommendation = "Excellent online record availability. Start with genealogical databases.";
    } else if (hasWikipedia || hasGenealogy) {
      difficulty = "medium";
      recommendation = "Moderate research difficulty. Some online presence but may require archival work.";
    } else {
      difficulty = "hard";
      recommendation = "Limited online presence. May require线下 archives and specialized research.";
    }
    
    for (const result of results.slice(0, 3)) {
      sources.push(result.url);
    }
    
    return {
      branchId: branchName.toLowerCase().replace(/\s+/g, "-"),
      branchName,
      difficulty,
      searchResults: results.map(r => r.title),
      recommendation,
      sources
    };
  } catch (error) {
    return {
      branchId: branchName.toLowerCase().replace(/\s+/g, "-"),
      branchName,
      difficulty: "hard",
      searchResults: [],
      recommendation: "Unable to assess. Manual research required.",
      sources: []
    };
  }
}

export function createGenealogyRouter() {
  const router = express.Router();
  
  let currentTree: GenealogyTree | null = null;
  let researchResults: ResearchResult[] = [];
  let isResearching = false;
  
  router.post("/parse", express.json(), (req, res) => {
    const { mermaid } = req.body;
    
    if (!mermaid) {
      return res.status(400).json({ success: false, error: "Mermaid diagram required" });
    }
    
    try {
      currentTree = parseMermaidTree(mermaid);
      const branches = analyzeBranches(currentTree);
      
      res.json({
        success: true,
        tree: currentTree,
        branches,
        rootCount: currentTree.rootIds.length
      });
    } catch (error) {
      res.status(400).json({ success: false, error: "Failed to parse mermaid diagram" });
    }
  });
  
  router.post("/research", express.json(), async (req, res) => {
    const { branchIds } = req.body;
    
    if (!currentTree) {
      return res.status(400).json({ success: false, error: "No tree parsed. Send mermaid diagram first." });
    }
    
    if (isResearching) {
      return res.status(409).json({ success: false, error: "Research already in progress" });
    }
    
    isResearching = true;
    researchResults = [];
    
    try {
      const branchesToResearch = branchIds?.length > 0 
        ? branchIds.map((id: string) => currentTree!.nodes[id]).filter(Boolean)
        : currentTree.rootIds.map(id => currentTree!.nodes[id]);
      
      for (const branch of branchesToResearch) {
        const result = await researchBranch(branch.name);
        researchResults.push(result);
      }
      
      researchResults.sort((a, b) => {
        const difficultyOrder = { easy: 0, medium: 1, hard: 2 };
        return difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty];
      });
      
      res.json({
        success: true,
        results: researchResults,
        recommended: researchResults[0]
      });
    } catch (error) {
      res.status(500).json({ success: false, error: "Research failed" });
    } finally {
      isResearching = false;
    }
  });
  
  router.get("/results", (_req, res) => {
    res.json({
      tree: currentTree,
      results: researchResults,
      isResearching
    });
  });
  
  return router;
}
