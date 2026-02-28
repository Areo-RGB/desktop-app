type JsonRecord = Record<string, unknown>;

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

async function request<T>(
  path: string,
  init?: RequestInit & { bodyJson?: JsonRecord },
): Promise<T> {
  const { bodyJson, headers, ...rest } = init ?? {};
  const response = await fetch(path, {
    ...rest,
    headers: {
      ...(bodyJson ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: bodyJson ? JSON.stringify(bodyJson) : rest.body,
  });

  const rawText = await response.text();
  let payload: ApiEnvelope<T> | null = null;
  try {
    payload = JSON.parse(rawText) as ApiEnvelope<T>;
  } catch {
    const hint =
      rawText.includes('Error occurred while proxying request') ||
      rawText.toLowerCase().includes('econnrefused')
        ? 'Backend not reachable. Start it with `npm run backend` or `npm run dev`.'
        : '';
    throw new Error(
      [`Request failed (${response.status}) for ${path}.`, hint].filter(Boolean).join(' '),
    );
  }

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || `Request failed (${response.status}).`);
  }

  return payload.data as T;
}

export type YoutubeConfig = {
  credentialsPath: string;
  tokenPath: string;
  downloadDirectory: string;
  ytDlpPath: string;
  ffmpegPath: string;
};

export type AuthStatus = {
  ready: boolean;
  message: string;
};

export type Playlist = {
  id: string;
  title: string;
  privacyStatus: string;
  itemCount: number;
};

export type ChannelVideo = {
  videoId: string;
  title: string;
  publishedAt: string;
};

export const youtubeApi = {
  health: () => request<{ ok: boolean; root: string; python: string }>('/api/youtube/health'),

  getConfig: () => request<YoutubeConfig>('/api/youtube/config'),
  saveConfig: (config: Partial<YoutubeConfig>) =>
    request<YoutubeConfig>('/api/youtube/config', { method: 'PUT', bodyJson: config }),

  getAuthStatus: () => request<AuthStatus>('/api/youtube/auth/status'),
  runOAuth: () => request<{ message: string }>('/api/youtube/auth/oauth', { method: 'POST' }),
  refreshToken: () =>
    request<{ message: string }>('/api/youtube/auth/refresh', { method: 'POST' }),

  listChannelVideos: () => request<ChannelVideo[]>('/api/youtube/channel/videos'),
  deleteChannelVideo: (videoId: string) =>
    request<{ deleted: boolean }>(`/api/youtube/channel/videos/${encodeURIComponent(videoId)}`, {
      method: 'DELETE',
    }),

  listPlaylists: () => request<Playlist[]>('/api/youtube/playlists'),
  createPlaylist: (payload: {
    title: string;
    description?: string;
    privacyStatus?: string;
  }) => request<Playlist>('/api/youtube/playlists', { method: 'POST', bodyJson: payload }),
  deletePlaylist: (playlistId: string) =>
    request<{ deleted: boolean }>(
      `/api/youtube/playlists/${encodeURIComponent(playlistId)}`,
      { method: 'DELETE' },
    ),

  uploadFile: (payload: { filePath: string; title?: string; playlistId?: string }) =>
    request<{ videoId: string; url: string }>('/api/youtube/upload', {
      method: 'POST',
      bodyJson: payload,
    }),

  downloadBestMp4: (url: string) =>
    request<{ outputPath: string }>('/api/youtube/download', {
      method: 'POST',
      bodyJson: { url },
    }),

  fetchChapters: (sourceUrl: string) =>
    request<{
      videoId: string;
      videoTitle: string;
      sourceUrl: string;
      chapters: Array<{
        index: number;
        title: string;
        start: string;
        end: string;
        startSeconds: number;
        endSeconds: number;
      }>;
    }>('/api/youtube/chapters', {
      method: 'POST',
      bodyJson: { sourceUrl },
    }),

  fetchTranscript: (source: string) =>
    request<{ markdown: string; entryCount: number; sourceUrl: string; videoId: string }>(
      '/api/youtube/transcript',
      {
        method: 'POST',
        bodyJson: { source },
      },
    ),

  fetchChannelReport: (channelUrl: string) =>
    request<{
      channelId: string;
      channelTitle: string;
      channelUrl: string;
      markdownPath: string;
      videos: Array<Record<string, unknown>>;
    }>('/api/youtube/fetch/channel', {
      method: 'POST',
      bodyJson: { channelUrl },
    }),

  cutClips: (payload: { sourcePath: string; timestamps: unknown; outputDir?: string }) =>
    request<{ count: number; paths: string[] }>('/api/youtube/cut', {
      method: 'POST',
      bodyJson: payload,
    }),
};
