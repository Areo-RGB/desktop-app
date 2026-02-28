import cors from 'cors';
import express from 'express';
import { runYouTubeOperation } from './youtubeService.js';

const app = express();
const port = Number(process.env.YOUTUBE_BACKEND_PORT || 8787);

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

app.listen(port, () => {
  console.log(`YouTube backend listening on http://localhost:${port}`);
});
