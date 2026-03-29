import mapping from "../model_role_mapping.json";

export type RoleId = "custodian" | "clerk" | "specialist" | "executive" | "office_assistant" | "workload_planner";

export interface RoleModelConfig {
  role: RoleId;
  provider: "ollama" | "llama_cpp" | "remote";
  modelName: string;        // e.g., "physics-assistant"
  endpoint: string;         // e.g., "http://localhost:11434" or socket path
  params?: {
    temperature?: number;
    max_tokens?: number;
  };
}

export function getRoleModelConfig(role: RoleId): RoleModelConfig {
  const entry = (mapping as any)[role] || (mapping as any)["clerk"]; // Fallback to clerk if role not found
  if (!entry) {
    throw new Error(`No model mapping defined for role: ${role}`);
  }

  // Map provider/model_name to a usable runtime config.
  return {
    role,
    provider: entry.provider || "ollama",
    modelName: entry.model_name,
    endpoint: process.env.OLLAMA_ENDPOINT || "http://localhost:11434",
    params: {
      temperature: 0.2,
      max_tokens: 1024,
    },
  };
}

export async function callModelForRole(role: RoleId, prompt: string, options: any = {}): Promise<any> {
  const config = getRoleModelConfig(role);
  
  if (config.provider === "ollama") {
    const url = `${config.endpoint}/api/generate`;
    const payload = {
      model: config.modelName,
      prompt: prompt,
      stream: false,
      options: {
        temperature: options.temperature ?? config.params?.temperature ?? 0.2,
        num_predict: options.max_tokens ?? config.params?.max_tokens ?? 1024,
      },
    };

    const startTime = Date.now();
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      console.error(`[Office-Model] Role=${config.role}, Model=${config.modelName}, Latency=${latencyMs}ms, Success=False, Error=${response.statusText}`);
      throw new Error(`Ollama call failed: ${response.statusText}`);
    }

    const result = await response.json();
    console.log(`[Office-Model] Role=${config.role}, Model=${config.modelName}, Latency=${latencyMs}ms, Success=True`);
    
    return {
      success: true,
      role: config.role,
      model: config.modelName,
      provider: config.provider,
      response: result.response,
      raw_response: result,
      latency_ms: latencyMs,
    };
  } else {
    throw new Error(`Provider ${config.provider} not supported in JS client yet`);
  }
}

export async function callChatModelForRole(role: RoleId, messages: any[], options: any = {}): Promise<any> {
  const config = getRoleModelConfig(role);
  
  if (config.provider === "ollama") {
    const url = `${config.endpoint}/api/chat`;
    const payload = {
      model: config.modelName,
      messages: messages,
      stream: false,
      options: {
        temperature: options.temperature ?? config.params?.temperature ?? 0.2,
        num_predict: options.max_tokens ?? config.params?.max_tokens ?? 1024,
      },
    };

    const startTime = Date.now();
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      console.error(`[Office-Chat] Role=${config.role}, Model=${config.modelName}, Latency=${latencyMs}ms, Success=False, Error=${response.statusText}`);
      throw new Error(`Ollama chat call failed: ${response.statusText}`);
    }

    const result = await response.json();
    console.log(`[Office-Chat] Role=${config.role}, Model=${config.modelName}, Latency=${latencyMs}ms, Success=True`);
    
    return {
      success: true,
      role: config.role,
      model: config.modelName,
      provider: config.provider,
      response: result.message.content,
      raw_response: result,
      latency_ms: latencyMs,
    };
  } else {
    throw new Error(`Provider ${config.provider} not supported in JS client yet`);
  }
}
