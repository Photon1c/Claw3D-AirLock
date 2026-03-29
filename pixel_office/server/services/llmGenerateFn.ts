import type { GenerateFn } from "../conversation/api.js";
import { openai } from "../../src/llm/client.js";
import { tryLocalModel, isLocalModelAvailable } from "../../src/llm/localClient.js";

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const MAX_TOKENS = 40;
const TEMPERATURE = 0.7;

let localModelAvailable: boolean | null = null;

/**
 * Check if local model is available (cached)
 */
async function checkLocalAvailability(): Promise<boolean> {
  if (localModelAvailable === null) {
    localModelAvailable = await isLocalModelAvailable();
    if (localModelAvailable) {
      console.log("[generateFn] Local model available, will use local-first strategy");
    } else {
      console.log("[generateFn] Local model unavailable, using OpenAI directly");
    }
  }
  return localModelAvailable;
}

/**
 * Generate using OpenAI (fallback)
 */
async function generateWithOpenAI(prompt: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
    });
    
    const content = response.choices[0].message.content;
    console.log(`[generateFn] OpenAI: ${content?.substring(0, 50) || "(empty)"}...`);
    
    return content ?? "";
  } catch (error) {
    console.error("[generateFn] OpenAI API error:", error);
    return "I'm having trouble thinking right now. Let's try again.";
  }
}

/**
 * GenerateFn implementation for CoolerSession engine
 * 
 * Uses a tiered strategy:
 * 1. Try local Ollama model first (if available)
 * 2. Fall back to OpenAI if local fails or times out
 */
export const generateFn: GenerateFn = async (prompt: string): Promise<string> => {
  // Check availability on first call
  const localAvailable = await checkLocalAvailability();
  
  if (localAvailable) {
    // Try local model first
    const localResult = await tryLocalModel(prompt);
    
    if (localResult !== null && localResult.length > 0) {
      return localResult;
    }
    
    // Local failed, fall back to OpenAI
    console.log("[generateFn] Local model failed/empty, falling back to OpenAI");
    return await generateWithOpenAI(prompt);
  }
  
  // Local not available, use OpenAI directly
  return await generateWithOpenAI(prompt);
};

/**
 * Reset the local model availability cache
 * Useful for testing or when Ollama is restarted
 */
export function resetLocalModelCache(): void {
  localModelAvailable = null;
}
