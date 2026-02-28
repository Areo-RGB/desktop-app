import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Youtube,
  Settings as SettingsIcon,
  Upload,
  Download,
  Scissors,
  ListVideo,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Clipboard,
} from 'lucide-react';
import { TabContent } from '@/components/ui/TabContent';
import { SubTabs } from '@/components/ui/SubTabs';
import { DetailCard } from '@/components/ui/DetailCard';
import { youtubeApi, type ChannelVideo, type Playlist, type YoutubeConfig } from '@/lib/youtubeApi';

const SUB_TABS = ['Download', 'Fetch', 'Upload', 'Edit', 'Settings'] as const;
type SubTab = (typeof SUB_TABS)[number];

const DEFAULT_TIMESTAMPS = '[{"drillName":"Clip 1","start":"00:00:03","end":"00:00:06"}]';

const EMPTY_CONFIG: YoutubeConfig = {
  credentialsPath: '',
  tokenPath: '',
  downloadDirectory: '',
  ytDlpPath: 'yt-dlp',
  ffmpegPath: 'ffmpeg',
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error || 'Unknown error.');
}

export default function YoutubeTab({ onBack }: { onBack: () => void }) {
  const [activeYoutubeTab, setActiveYoutubeTab] = useState<SubTab>('Download');
  const [busyKey, setBusyKey] = useState<string>('');
  const [errorText, setErrorText] = useState<string>('');
  const [infoText, setInfoText] = useState<string>('Ready.');

  const [backendInfo, setBackendInfo] = useState<string>('Not checked.');
  const [authStatus, setAuthStatus] = useState<string>('Unknown.');
  const [config, setConfig] = useState<YoutubeConfig>(EMPTY_CONFIG);

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>('');
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('');
  const [newPlaylistDescription, setNewPlaylistDescription] = useState('');
  const [newPlaylistPrivacy, setNewPlaylistPrivacy] = useState('unlisted');

  const [channelVideos, setChannelVideos] = useState<ChannelVideo[]>([]);
  const [selectedChannelVideoId, setSelectedChannelVideoId] = useState<string>('');

  const [uploadFilePath, setUploadFilePath] = useState('');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadResult, setUploadResult] = useState('');

  const [downloadUrlsText, setDownloadUrlsText] = useState('');
  const [downloadLog, setDownloadLog] = useState<string[]>([]);

  const [fetchChannelUrl, setFetchChannelUrl] = useState('');
  const [fetchSummary, setFetchSummary] = useState('');

  const [editSourcePath, setEditSourcePath] = useState('');
  const [editSourceUrl, setEditSourceUrl] = useState('');
  const [editOutputDir, setEditOutputDir] = useState('');
  const [editTimestampsText, setEditTimestampsText] = useState(DEFAULT_TIMESTAMPS);
  const [editResult, setEditResult] = useState('');

  const isBusy = (key: string) => busyKey === key;
  const playlistOptions = useMemo(() => [{ id: '', title: '(none)' }, ...playlists], [playlists]);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      setBusyKey('bootstrap');
      setErrorText('');
      setInfoText('Connecting to YouTube backend...');
      try {
        const maxAttempts = 8;
        let lastError: unknown = null;

        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
          try {
            const [health, auth, loadedConfig, loadedPlaylists] = await Promise.all([
              youtubeApi.health(),
              youtubeApi.getAuthStatus(),
              youtubeApi.getConfig(),
              youtubeApi.listPlaylists(),
            ]);

            if (!active) {
              return;
            }

            setBackendInfo(`Backend OK • ${health.python}`);
            setAuthStatus(auth.message);
            setConfig(loadedConfig);
            setPlaylists(loadedPlaylists);
            setInfoText('YouTube backend connected.');
            return;
          } catch (error) {
            lastError = error;
            if (attempt < maxAttempts) {
              await sleep(600);
              continue;
            }
          }
        }

        if (!active) {
          return;
        }
        setErrorText(formatError(lastError));
      } finally {
        if (active) {
          setBusyKey('');
        }
      }
    };

    void bootstrap();
    return () => {
      active = false;
    };
  }, []);

  const runTask = async (key: string, task: () => Promise<void>) => {
    if (busyKey) {
      return;
    }

    setBusyKey(key);
    setErrorText('');
    try {
      await task();
    } catch (error) {
      setErrorText(formatError(error));
    } finally {
      setBusyKey('');
    }
  };

  const refreshCoreData = async () => {
    await runTask('refresh-core', async () => {
      const [health, auth, loadedConfig] = await Promise.all([
        youtubeApi.health(),
        youtubeApi.getAuthStatus(),
        youtubeApi.getConfig(),
      ]);
      setBackendInfo(`Backend OK • ${health.python}`);
      setAuthStatus(auth.message);
      setConfig(loadedConfig);
      setInfoText('Core YouTube status refreshed.');
    });
  };

  const refreshPlaylists = async () => {
    await runTask('refresh-playlists', async () => {
      const items = await youtubeApi.listPlaylists();
      setPlaylists(items);
      if (!items.some((item) => item.id === selectedPlaylistId)) {
        setSelectedPlaylistId('');
      }
      setInfoText(`Loaded ${items.length} playlist(s).`);
    });
  };

  const refreshChannelVideos = async () => {
    await runTask('refresh-channel', async () => {
      const items = await youtubeApi.listChannelVideos();
      setChannelVideos(items);
      if (!items.some((item) => item.videoId === selectedChannelVideoId)) {
        setSelectedChannelVideoId('');
      }
      setInfoText(`Loaded ${items.length} channel video(s).`);
    });
  };

  const saveConfig = async () => {
    await runTask('save-config', async () => {
      const saved = await youtubeApi.saveConfig(config);
      setConfig(saved);
      setInfoText('YouTube config saved.');
    });
  };

  const launchOAuth = async () => {
    await runTask('oauth', async () => {
      const result = await youtubeApi.runOAuth();
      setInfoText(result.message || 'OAuth flow completed.');
      const auth = await youtubeApi.getAuthStatus();
      setAuthStatus(auth.message);
    });
  };

  const refreshToken = async () => {
    await runTask('refresh-token', async () => {
      const result = await youtubeApi.refreshToken();
      setInfoText(result.message || 'Token refreshed.');
      const auth = await youtubeApi.getAuthStatus();
      setAuthStatus(auth.message);
    });
  };

  const createPlaylist = async () => {
    await runTask('create-playlist', async () => {
      if (!newPlaylistTitle.trim()) {
        throw new Error('Playlist title is required.');
      }

      const created = await youtubeApi.createPlaylist({
        title: newPlaylistTitle.trim(),
        description: newPlaylistDescription.trim(),
        privacyStatus: newPlaylistPrivacy,
      });

      setNewPlaylistTitle('');
      setNewPlaylistDescription('');
      setNewPlaylistPrivacy('unlisted');
      await refreshPlaylists();
      setSelectedPlaylistId(created.id);
      setInfoText(`Playlist created: ${created.title}`);
    });
  };

  const deleteSelectedPlaylist = async () => {
    await runTask('delete-playlist', async () => {
      if (!selectedPlaylistId) {
        throw new Error('Select a playlist first.');
      }

      await youtubeApi.deletePlaylist(selectedPlaylistId);
      await refreshPlaylists();
      setInfoText('Playlist deleted.');
    });
  };

  const deleteSelectedChannelVideo = async () => {
    await runTask('delete-channel-video', async () => {
      if (!selectedChannelVideoId) {
        throw new Error('Select a channel video first.');
      }

      await youtubeApi.deleteChannelVideo(selectedChannelVideoId);
      await refreshChannelVideos();
      setInfoText('Channel video deleted.');
    });
  };

  const uploadVideo = async () => {
    await runTask('upload-video', async () => {
      if (!uploadFilePath.trim()) {
        throw new Error('Video file path is required.');
      }

      const uploaded = await youtubeApi.uploadFile({
        filePath: uploadFilePath.trim(),
        title: uploadTitle.trim() || undefined,
        playlistId: selectedPlaylistId || undefined,
      });
      setUploadResult(uploaded.url);
      setInfoText(`Upload complete: ${uploaded.url}`);
    });
  };

  const downloadUrls = async () => {
    await runTask('download-urls', async () => {
      const urls = downloadUrlsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

      if (!urls.length) {
        throw new Error('Paste at least one URL.');
      }

      setDownloadLog([]);
      for (const [index, url] of urls.entries()) {
        setDownloadLog((prev) => [...prev, `[${index + 1}/${urls.length}] Downloading ${url}`]);
        const result = await youtubeApi.downloadBestMp4(url);
        setDownloadLog((prev) => [...prev, `Saved: ${result.outputPath}`]);
      }
      setInfoText(`Downloaded ${urls.length} video(s).`);
    });
  };

  const fetchChannelReport = async () => {
    await runTask('fetch-channel', async () => {
      if (!fetchChannelUrl.trim()) {
        throw new Error('Channel URL is required.');
      }

      const result = await youtubeApi.fetchChannelReport(fetchChannelUrl.trim());
      setFetchSummary(
        `${result.channelTitle} • ${result.videos.length} videos • ${result.markdownPath}`,
      );
      setInfoText('Channel report generated.');
    });
  };

  const loadChaptersIntoJson = async () => {
    await runTask('load-chapters', async () => {
      if (!editSourceUrl.trim()) {
        throw new Error('Source URL is required.');
      }

      const result = await youtubeApi.fetchChapters(editSourceUrl.trim());
      const timestamps = result.chapters.map((chapter) => ({
        drillName: chapter.title,
        start: chapter.start,
        end: chapter.end,
      }));
      setEditTimestampsText(JSON.stringify(timestamps, null, 2));
      setInfoText(`Loaded ${timestamps.length} chapter clip timestamps.`);
    });
  };

  const copyTranscript = async () => {
    await runTask('copy-transcript', async () => {
      if (!editSourceUrl.trim()) {
        throw new Error('Source URL is required.');
      }

      const result = await youtubeApi.fetchTranscript(editSourceUrl.trim());
      await navigator.clipboard.writeText(result.markdown);
      setInfoText(`Transcript copied (${result.entryCount} line(s)).`);
    });
  };

  const createClips = async () => {
    await runTask('create-clips', async () => {
      if (!editSourcePath.trim()) {
        throw new Error('Source file path is required.');
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(editTimestampsText);
      } catch {
        throw new Error('Timestamps must be valid JSON.');
      }

      const result = await youtubeApi.cutClips({
        sourcePath: editSourcePath.trim(),
        timestamps: parsed,
        outputDir: editOutputDir.trim() || undefined,
      });
      setEditResult(result.paths.join('\n'));
      setInfoText(`Created ${result.count} clip(s).`);
    });
  };

  return (
    <TabContent title="YouTube" onBack={onBack} icon={Youtube}>
      <SubTabs
        tabs={[...SUB_TABS]}
        activeTab={activeYoutubeTab}
        onChange={(tab) => setActiveYoutubeTab(tab as SubTab)}
        layoutIdPrefix="yt"
      />

      {(errorText || infoText) && (
        <div className="acrylic-card p-4 mb-6 text-sm">
          <p className="text-gray-300">{infoText}</p>
          {errorText && <p className="text-red-400 mt-1">{errorText}</p>}
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={activeYoutubeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeYoutubeTab === 'Download' && (
            <div className="grid grid-cols-1 gap-6">
              <DetailCard title="Batch Download" icon={Download}>
                <div className="space-y-3">
                  <textarea
                    value={downloadUrlsText}
                    onChange={(event) => setDownloadUrlsText(event.target.value)}
                    placeholder="Paste YouTube URLs, one per line."
                    rows={6}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-sm p-3 text-sm focus:outline-none focus:border-blue-400"
                  />
                  <button
                    onClick={downloadUrls}
                    disabled={Boolean(busyKey)}
                    className="px-4 py-2 text-xs border border-white/10 hover:bg-white/5 transition-colors disabled:opacity-50"
                  >
                    {isBusy('download-urls') ? 'Downloading...' : 'Download MP4'}
                  </button>
                  {!!downloadLog.length && (
                    <pre className="text-xs bg-black/30 border border-white/10 p-3 rounded-sm whitespace-pre-wrap">
                      {downloadLog.join('\n')}
                    </pre>
                  )}
                </div>
              </DetailCard>
            </div>
          )}

          {activeYoutubeTab === 'Fetch' && (
            <div className="grid grid-cols-1 gap-6">
              <DetailCard title="Channel Fetch" icon={ListVideo}>
                <div className="space-y-3">
                  <input
                    value={fetchChannelUrl}
                    onChange={(event) => setFetchChannelUrl(event.target.value)}
                    placeholder="https://www.youtube.com/@channel-handle"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-sm p-3 text-sm focus:outline-none focus:border-blue-400"
                  />
                  <button
                    onClick={fetchChannelReport}
                    disabled={Boolean(busyKey)}
                    className="px-4 py-2 text-xs border border-white/10 hover:bg-white/5 transition-colors disabled:opacity-50"
                  >
                    {isBusy('fetch-channel') ? 'Fetching...' : 'Fetch Videos + Export MD'}
                  </button>
                  {fetchSummary && (
                    <p className="text-xs text-gray-300 bg-white/[0.03] border border-white/10 p-3 rounded-sm">
                      {fetchSummary}
                    </p>
                  )}
                </div>
              </DetailCard>
            </div>
          )}

          {activeYoutubeTab === 'Upload' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <DetailCard title="Upload Video" icon={Upload}>
                <div className="space-y-3">
                  <input
                    value={uploadFilePath}
                    onChange={(event) => setUploadFilePath(event.target.value)}
                    placeholder="C:\\videos\\example.mp4"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-sm p-3 text-sm focus:outline-none focus:border-blue-400"
                  />
                  <input
                    value={uploadTitle}
                    onChange={(event) => setUploadTitle(event.target.value)}
                    placeholder="Title (optional)"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-sm p-3 text-sm focus:outline-none focus:border-blue-400"
                  />
                  <select
                    value={selectedPlaylistId}
                    onChange={(event) => setSelectedPlaylistId(event.target.value)}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-sm p-3 text-sm focus:outline-none focus:border-blue-400"
                  >
                    {playlistOptions.map((playlist) => (
                      <option key={playlist.id || 'none'} value={playlist.id}>
                        {playlist.title}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button
                      onClick={refreshPlaylists}
                      disabled={Boolean(busyKey)}
                      className="px-4 py-2 text-xs border border-white/10 hover:bg-white/5 transition-colors disabled:opacity-50"
                    >
                      {isBusy('refresh-playlists') ? 'Refreshing...' : 'Refresh Playlists'}
                    </button>
                    <button
                      onClick={uploadVideo}
                      disabled={Boolean(busyKey)}
                      className="px-4 py-2 text-xs border border-white/10 hover:bg-white/5 transition-colors disabled:opacity-50"
                    >
                      {isBusy('upload-video') ? 'Uploading...' : 'Upload'}
                    </button>
                  </div>
                  {uploadResult && (
                    <a
                      href={uploadResult}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-300 underline"
                    >
                      {uploadResult}
                    </a>
                  )}
                </div>
              </DetailCard>

              <DetailCard title="Playlist Management" icon={ListVideo}>
                <div className="space-y-3">
                  <input
                    value={newPlaylistTitle}
                    onChange={(event) => setNewPlaylistTitle(event.target.value)}
                    placeholder="Playlist title"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-sm p-3 text-sm focus:outline-none focus:border-blue-400"
                  />
                  <input
                    value={newPlaylistDescription}
                    onChange={(event) => setNewPlaylistDescription(event.target.value)}
                    placeholder="Description (optional)"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-sm p-3 text-sm focus:outline-none focus:border-blue-400"
                  />
                  <select
                    value={newPlaylistPrivacy}
                    onChange={(event) => setNewPlaylistPrivacy(event.target.value)}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-sm p-3 text-sm focus:outline-none focus:border-blue-400"
                  >
                    <option value="private">private</option>
                    <option value="unlisted">unlisted</option>
                    <option value="public">public</option>
                  </select>
                  <div className="flex gap-2">
                    <button
                      onClick={createPlaylist}
                      disabled={Boolean(busyKey)}
                      className="px-4 py-2 text-xs border border-white/10 hover:bg-white/5 transition-colors disabled:opacity-50"
                    >
                      {isBusy('create-playlist') ? 'Creating...' : 'Create Playlist'}
                    </button>
                    <button
                      onClick={deleteSelectedPlaylist}
                      disabled={Boolean(busyKey)}
                      className="px-4 py-2 text-xs border border-red-500/30 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    >
                      {isBusy('delete-playlist') ? 'Deleting...' : 'Delete Selected'}
                    </button>
                  </div>
                </div>
              </DetailCard>
            </div>
          )}

          {activeYoutubeTab === 'Edit' && (
            <div className="grid grid-cols-1 gap-6">
              <DetailCard title="Clip Builder" icon={Scissors}>
                <div className="space-y-3">
                  <input
                    value={editSourcePath}
                    onChange={(event) => setEditSourcePath(event.target.value)}
                    placeholder="Source file path (local video)"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-sm p-3 text-sm focus:outline-none focus:border-blue-400"
                  />
                  <input
                    value={editOutputDir}
                    onChange={(event) => setEditOutputDir(event.target.value)}
                    placeholder="Output directory (optional)"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-sm p-3 text-sm focus:outline-none focus:border-blue-400"
                  />
                  <input
                    value={editSourceUrl}
                    onChange={(event) => setEditSourceUrl(event.target.value)}
                    placeholder="Source URL (for chapter/transcript tools)"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-sm p-3 text-sm focus:outline-none focus:border-blue-400"
                  />
                  <textarea
                    value={editTimestampsText}
                    onChange={(event) => setEditTimestampsText(event.target.value)}
                    rows={8}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-sm p-3 text-sm font-mono focus:outline-none focus:border-blue-400"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={loadChaptersIntoJson}
                      disabled={Boolean(busyKey)}
                      className="px-4 py-2 text-xs border border-white/10 hover:bg-white/5 transition-colors disabled:opacity-50"
                    >
                      {isBusy('load-chapters') ? 'Loading...' : 'Load Chapters into JSON'}
                    </button>
                    <button
                      onClick={copyTranscript}
                      disabled={Boolean(busyKey)}
                      className="px-4 py-2 text-xs border border-white/10 hover:bg-white/5 transition-colors disabled:opacity-50"
                    >
                      {isBusy('copy-transcript') ? 'Copying...' : 'Copy Transcript MD'}
                    </button>
                    <button
                      onClick={createClips}
                      disabled={Boolean(busyKey)}
                      className="px-4 py-2 text-xs border border-white/10 hover:bg-white/5 transition-colors disabled:opacity-50"
                    >
                      {isBusy('create-clips') ? 'Creating...' : 'Create Clips'}
                    </button>
                  </div>
                  {!!editResult && (
                    <pre className="text-xs bg-black/30 border border-white/10 p-3 rounded-sm whitespace-pre-wrap">
                      {editResult}
                    </pre>
                  )}
                </div>
              </DetailCard>
            </div>
          )}

          {activeYoutubeTab === 'Settings' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <DetailCard title="Backend + Auth" icon={ShieldCheck}>
                <div className="space-y-3 text-sm">
                  <p className="text-gray-300">{backendInfo}</p>
                  <p className="text-gray-300">{authStatus}</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={refreshCoreData}
                      disabled={Boolean(busyKey)}
                      className="px-3 py-2 text-xs border border-white/10 hover:bg-white/5 transition-colors disabled:opacity-50"
                    >
                      <span className="inline-flex items-center gap-1">
                        <RefreshCw className="w-3 h-3" />
                        {isBusy('refresh-core') ? 'Refreshing...' : 'Refresh'}
                      </span>
                    </button>
                    <button
                      onClick={launchOAuth}
                      disabled={Boolean(busyKey)}
                      className="px-3 py-2 text-xs border border-white/10 hover:bg-white/5 transition-colors disabled:opacity-50"
                    >
                      {isBusy('oauth') ? 'Running OAuth...' : 'Launch OAuth'}
                    </button>
                    <button
                      onClick={refreshToken}
                      disabled={Boolean(busyKey)}
                      className="px-3 py-2 text-xs border border-white/10 hover:bg-white/5 transition-colors disabled:opacity-50"
                    >
                      {isBusy('refresh-token') ? 'Refreshing...' : 'Force Refresh Token'}
                    </button>
                  </div>
                </div>
              </DetailCard>

              <DetailCard title="Config" icon={SettingsIcon}>
                <div className="space-y-2">
                  <input
                    value={config.credentialsPath}
                    onChange={(event) =>
                      setConfig((prev) => ({ ...prev, credentialsPath: event.target.value }))
                    }
                    placeholder="Credentials path"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-sm p-2.5 text-xs focus:outline-none focus:border-blue-400"
                  />
                  <input
                    value={config.tokenPath}
                    onChange={(event) =>
                      setConfig((prev) => ({ ...prev, tokenPath: event.target.value }))
                    }
                    placeholder="Token path"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-sm p-2.5 text-xs focus:outline-none focus:border-blue-400"
                  />
                  <input
                    value={config.downloadDirectory}
                    onChange={(event) =>
                      setConfig((prev) => ({ ...prev, downloadDirectory: event.target.value }))
                    }
                    placeholder="Download directory"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-sm p-2.5 text-xs focus:outline-none focus:border-blue-400"
                  />
                  <input
                    value={config.ytDlpPath}
                    onChange={(event) =>
                      setConfig((prev) => ({ ...prev, ytDlpPath: event.target.value }))
                    }
                    placeholder="yt-dlp executable"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-sm p-2.5 text-xs focus:outline-none focus:border-blue-400"
                  />
                  <input
                    value={config.ffmpegPath}
                    onChange={(event) =>
                      setConfig((prev) => ({ ...prev, ffmpegPath: event.target.value }))
                    }
                    placeholder="ffmpeg executable"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-sm p-2.5 text-xs focus:outline-none focus:border-blue-400"
                  />
                  <button
                    onClick={saveConfig}
                    disabled={Boolean(busyKey)}
                    className="px-3 py-2 text-xs border border-white/10 hover:bg-white/5 transition-colors disabled:opacity-50"
                  >
                    {isBusy('save-config') ? 'Saving...' : 'Save Config'}
                  </button>
                </div>
              </DetailCard>

              <DetailCard title="Channel Videos" icon={Youtube}>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <button
                      onClick={refreshChannelVideos}
                      disabled={Boolean(busyKey)}
                      className="px-3 py-2 text-xs border border-white/10 hover:bg-white/5 transition-colors disabled:opacity-50"
                    >
                      {isBusy('refresh-channel') ? 'Refreshing...' : 'Refresh Videos'}
                    </button>
                    <button
                      onClick={deleteSelectedChannelVideo}
                      disabled={Boolean(busyKey)}
                      className="px-3 py-2 text-xs border border-red-500/30 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    >
                      <span className="inline-flex items-center gap-1">
                        <Trash2 className="w-3 h-3" />
                        {isBusy('delete-channel-video') ? 'Deleting...' : 'Delete Selected'}
                      </span>
                    </button>
                  </div>
                  <select
                    value={selectedChannelVideoId}
                    onChange={(event) => setSelectedChannelVideoId(event.target.value)}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-sm p-3 text-xs focus:outline-none focus:border-blue-400"
                  >
                    <option value="">Select a channel video</option>
                    {channelVideos.map((video) => (
                      <option key={video.videoId} value={video.videoId}>
                        {video.title}
                      </option>
                    ))}
                  </select>
                </div>
              </DetailCard>

              <DetailCard title="Quick Setup" icon={Clipboard}>
                <div className="space-y-3 text-xs text-gray-300">
                  <p>1. Run `npm run backend` (or `npm run dev:all`).</p>
                  <p>2. Save valid credentials/token paths in Config.</p>
                  <p>3. Use Upload/Download/Fetch/Edit tabs for YouTube operations.</p>
                </div>
              </DetailCard>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </TabContent>
  );
}
