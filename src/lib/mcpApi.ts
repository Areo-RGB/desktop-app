type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

export type McpServer = {
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  tools?: Array<{ name: string }>;
};

const MCP_BACKEND_BASE_URL = 'http://localhost:8787';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${MCP_BACKEND_BASE_URL}${path}`, init);
  const payload = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || `Request failed (${response.status}).`);
  }

  return payload.data as T;
}

export async function startMcpHub() {
  return request<{ ok: boolean; alreadyRunning?: boolean }>('/api/mcp/start', {
    method: 'POST',
  });
}

export async function stopMcpHub() {
  return request<{ ok: boolean }>('/api/mcp/stop', {
    method: 'POST',
  });
}

export async function getMcpStatus() {
  return request<{ running: boolean }>('/api/mcp/status');
}

export async function getMcpServers(): Promise<McpServer[]> {
  return request<McpServer[]>('/api/mcp/servers');
}
