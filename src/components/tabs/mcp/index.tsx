import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Server, CheckCircle2, XCircle, HardDrive } from 'lucide-react';
import { TabContent } from '@/components/ui/TabContent';
import {
  getMcpServers,
  getMcpStatus,
  startMcpHub,
  stopMcpHub,
  type McpServer,
} from '@/lib/mcpApi';

function ServerCard({ name, status, toolCount }: { name: string; status: string; toolCount: number }) {
  const normalizedStatus = status === 'connected' || status === 'error' ? status : 'disconnected';
  const statusDotClass =
    normalizedStatus === 'connected'
      ? 'bg-green-500'
      : normalizedStatus === 'error'
        ? 'bg-red-500'
        : 'bg-gray-500';
  const statusLabel =
    normalizedStatus === 'connected'
      ? 'Connected'
      : normalizedStatus === 'error'
        ? 'Error'
        : 'Disconnected';

  return (
    <div className="acrylic-card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Server className="w-5 h-5 text-blue-400" />
        <span className="text-xs rounded-full bg-white/10 px-2 py-1 text-gray-300">
          {toolCount} tool{toolCount === 1 ? '' : 's'}
        </span>
      </div>
      <div className="space-y-1">
        <h4 className="text-sm font-medium break-words">{name}</h4>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className={`w-2 h-2 rounded-full ${statusDotClass}`} />
          <span>{statusLabel}</span>
        </div>
      </div>
    </div>
  );
}

export default function McpTab({
  onBack,
  onHubStatusChange,
}: {
  onBack: () => void;
  onHubStatusChange?: (running: boolean) => void;
}) {
  const [hubRunning, setHubRunning] = useState(false);
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshHubData = useCallback(async () => {
    const status = await getMcpStatus();
    const running = Boolean(status.running);
    setHubRunning(running);
    onHubStatusChange?.(running);

    if (!running) {
      setServers([]);
      return;
    }

    const fetchedServers = await getMcpServers();
    setServers(fetchedServers);
  }, [onHubStatusChange]);

  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      setLoading(true);
      try {
        await refreshHubData();
      } catch {
        if (isMounted) {
          setHubRunning(false);
          setServers([]);
          onHubStatusChange?.(false);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadInitialData();

    const intervalId = window.setInterval(async () => {
      try {
        await refreshHubData();
      } catch {
        if (isMounted) {
          setHubRunning(false);
          setServers([]);
          onHubStatusChange?.(false);
        }
      }
    }, 5000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [refreshHubData]);

  const handleStart = async () => {
    setLoading(true);
    try {
      await startMcpHub();
      await refreshHubData();
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      await stopMcpHub();
    } finally {
      setHubRunning(false);
      setServers([]);
      onHubStatusChange?.(false);
      setLoading(false);
    }
  };

  return (
    <TabContent
      title="MCP Server"
      onBack={onBack}
      icon={Server}
    >
      <div className="space-y-6">
        <div className="acrylic-card p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`${hubRunning ? 'bg-green-500/20' : 'bg-red-500/20'} p-3 rounded-full transition-colors`}>
              {hubRunning ? (
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              ) : (
                <XCircle className="w-8 h-8 text-red-500" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-medium">
                {hubRunning ? 'MCP Hub Running (port 3000)' : 'MCP Hub Stopped'}
              </h2>
              <p className="text-sm text-gray-400">
                {hubRunning
                  ? `${servers.length} server${servers.length === 1 ? '' : 's'} from .vscode/mcp.json`
                  : 'Start the hub to load MCP servers from .vscode/mcp.json'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-6 rounded-full p-1 transition-colors ${hubRunning ? 'bg-blue-500' : 'bg-gray-600'}`}>
              <motion.div
                className="w-4 h-4 bg-white rounded-full shadow-sm"
                animate={{ x: hubRunning ? 24 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </div>
            <button
              className={`px-6 py-2 rounded-sm text-sm font-medium transition-colors ${
                hubRunning
                  ? 'bg-red-600 hover:bg-red-500'
                  : 'bg-blue-600 hover:bg-blue-500'
              } ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
              onClick={hubRunning ? handleStop : handleStart}
              disabled={loading}
            >
              {hubRunning ? 'Stop Hub' : 'Start Hub'}
            </button>
          </div>
        </div>

        {!hubRunning && (
          <div className="acrylic-card p-6 text-sm text-gray-400">
            Start the MCP Hub to view connected servers.
          </div>
        )}

        {hubRunning && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Connected Servers</h3>

            {servers.length === 0 ? (
              <div className="acrylic-card p-8 flex flex-col items-center justify-center text-center gap-3 text-gray-400">
                <HardDrive className="w-10 h-10 text-gray-500" />
                <p className="text-sm">
                  {loading ? 'Loading MCP servers...' : 'No MCP servers configured'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {servers.map((server) => (
                  <ServerCard
                    key={server.name}
                    name={server.name}
                    status={server.status}
                    toolCount={Array.isArray(server.tools) ? server.tools.length : 0}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </TabContent>
  );
}
