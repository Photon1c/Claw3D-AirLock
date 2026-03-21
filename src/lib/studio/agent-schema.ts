import { fetchJson } from "@/lib/http";

export type StudioAgentSchemaEntry = {
  id: string;
  name: string;
  workspaceDir: string;
  sandbox?: {
    mode?: "off" | "non-main" | "all";
    workspaceAccess?: "none" | "ro" | "rw";
  };
};

export type StudioAgentSchemaResponse = {
  schemaPath: string;
  sandboxRootDir: string;
  exists: boolean;
  entries: StudioAgentSchemaEntry[];
};

export const fetchStudioAgentSchema = async (): Promise<StudioAgentSchemaResponse> => {
  return fetchJson<StudioAgentSchemaResponse>("/api/studio/agent-schema", {
    cache: "no-store",
  });
};
