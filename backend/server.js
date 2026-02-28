import cors from 'cors';
import express from 'express';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { runYouTubeOperation } from './youtubeService.js';

const app = express();
const port = Number(process.env.YOUTUBE_BACKEND_PORT || 8787);

const MCP_HUB_PORT = 3000;
const MCP_HUB_CONFIG = path.resolve(process.cwd(), '.vscode/mcp.json');
const MCP_HUB_START_TIMEOUT_MS = 8000;
const MCP_HUB_POLL_INTERVAL_MS = 250;
let mcpHubProcess = null;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

function asyncRoute(handler) {
  return async (req, res) => {
    try {
      const data = await handler(req, res);
      res.json({ ok: true, data });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown server error.';
      res.status(400).json({ ok: false, error: message });
    }
  };
}

function isMcpHubRunning() {
  return Boolean(mcpHubProcess && mcpHubProcess.exitCode === null);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForMcpHubStartup(processHandle) {
  const deadline = Date.now() + MCP_HUB_START_TIMEOUT_MS;
  let startupError = null;

  const onError = (error) => {
    startupError = `Failed to start mcp-hub: ${error.message}. Ensure mcp-hub is installed and available in PATH.`;
  };

  const onExit = (code, signal) => {
    startupError = `mcp-hub exited before becoming ready (code: ${code ?? 'null'}, signal: ${signal ?? 'none'}).`;
  };

  processHandle.once('error', onError);
  processHandle.once('exit', onExit);

  try {
    while (Date.now() < deadline) {
      if (startupError) {
        throw new Error(startupError);
      }

      try {
        const healthResponse = await fetch(`http://localhost:${MCP_HUB_PORT}/api/health`);
        if (healthResponse.ok) {
          return;
        }
      } catch {
        // Continue polling until timeout or process failure.
      }

      await sleep(MCP_HUB_POLL_INTERVAL_MS);
    }
  } finally {
    processHandle.off('error', onError);
    processHandle.off('exit', onExit);
  }

  throw new Error(
    `Timed out waiting for mcp-hub readiness on http://localhost:${MCP_HUB_PORT}/api/health. Check ${MCP_HUB_CONFIG}.`,
  );
}

app.get('/api/youtube/health', asyncRoute(() => runYouTubeOperation('health')));
app.get('/api/youtube/config', asyncRoute(() => runYouTubeOperation('get_config')));
app.put(
  '/api/youtube/config',
  asyncRoute((req) => runYouTubeOperation('save_config', req.body ?? {})),
);

app.get('/api/youtube/auth/status', asyncRoute(() => runYouTubeOperation('auth_status')));
app.post('/api/youtube/auth/oauth', asyncRoute(() => runYouTubeOperation('auth_oauth')));
app.post('/api/youtube/auth/refresh', asyncRoute(() => runYouTubeOperation('auth_refresh')));

app.get('/api/youtube/channel/videos', asyncRoute(() => runYouTubeOperation('list_channel_videos')));
app.delete(
  '/api/youtube/channel/videos/:videoId',
  asyncRoute((req) =>
    runYouTubeOperation('delete_channel_video', {
      videoId: req.params.videoId,
    }),
  ),
);

app.get('/api/youtube/playlists', asyncRoute(() => runYouTubeOperation('list_playlists')));
app.post(
  '/api/youtube/playlists',
  asyncRoute((req) => runYouTubeOperation('create_playlist', req.body ?? {})),
);
app.delete(
  '/api/youtube/playlists/:playlistId',
  asyncRoute((req) =>
    runYouTubeOperation('delete_playlist', {
      playlistId: req.params.playlistId,
    }),
  ),
);
app.get(
  '/api/youtube/playlists/:playlistId/videos',
  asyncRoute((req) =>
    runYouTubeOperation('list_playlist_videos', {
      playlistId: req.params.playlistId,
    }),
  ),
);
app.post(
  '/api/youtube/playlists/:playlistId/videos',
  asyncRoute((req) =>
    runYouTubeOperation('add_video_to_playlist', {
      playlistId: req.params.playlistId,
      videoId: req.body?.videoId,
    }),
  ),
);

app.post(
  '/api/youtube/upload',
  asyncRoute((req) => runYouTubeOperation('upload_file', req.body ?? {})),
);
app.post(
  '/api/youtube/download',
  asyncRoute((req) => runYouTubeOperation('download_best_mp4', req.body ?? {})),
);
app.post(
  '/api/youtube/chapters',
  asyncRoute((req) => runYouTubeOperation('fetch_video_chapters', req.body ?? {})),
);
app.post(
  '/api/youtube/transcript',
  asyncRoute((req) => runYouTubeOperation('build_transcript_markdown', req.body ?? {})),
);
app.post(
  '/api/youtube/fetch/channel',
  asyncRoute((req) => runYouTubeOperation('fetch_channel_report', req.body ?? {})),
);
app.post(
  '/api/youtube/cut',
  asyncRoute((req) => runYouTubeOperation('cut_clips_local_mp4', req.body ?? {})),
);

app.post(
  '/api/mcp/start',
  asyncRoute(async () => {
    if (isMcpHubRunning()) {
      return { ok: true, alreadyRunning: true };
    }

    mcpHubProcess = spawn('mcp-hub', ['--config', MCP_HUB_CONFIG, '--port', String(MCP_HUB_PORT)]);

    mcpHubProcess.stdout?.pipe(process.stdout);
    mcpHubProcess.stderr?.pipe(process.stderr);

    mcpHubProcess.on('error', () => {
      mcpHubProcess = null;
    });

    mcpHubProcess.on('exit', () => {
      mcpHubProcess = null;
    });

    try {
      await waitForMcpHubStartup(mcpHubProcess);
    } catch (error) {
      if (isMcpHubRunning()) {
        mcpHubProcess.kill();
      }
      mcpHubProcess = null;
      throw error;
    }

    return { ok: true };
  }),
);

app.post(
  '/api/mcp/stop',
  asyncRoute(() => {
    if (isMcpHubRunning()) {
      mcpHubProcess.kill();
    }
    mcpHubProcess = null;
    return { ok: true };
  }),
);

app.get(
  '/api/mcp/status',
  asyncRoute(() => ({
    running: isMcpHubRunning(),
  })),
);

app.get(
  '/api/mcp/servers',
  asyncRoute(async () => {
    if (!isMcpHubRunning()) {
      throw new Error('Hub not running');
    }

    try {
      const response = await fetch(`http://localhost:${MCP_HUB_PORT}/api/servers`);
      if (!response.ok) {
        throw new Error('Hub not running');
      }
      const payload = await response.json();
      const servers = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.servers)
          ? payload.servers
          : null;

      if (!servers) {
        throw new Error('Invalid mcp-hub servers payload');
      }

      return servers;
    } catch {
      throw new Error('Hub not running');
    }
  }),
);

app.listen(port, () => {
  console.log(`YouTube backend listening on http://localhost:${port}`);
});
