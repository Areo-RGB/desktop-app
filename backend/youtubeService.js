import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { google } from 'googleapis';
import open from 'open';
import { YoutubeTranscript } from 'youtube-transcript';
import { youtuneRoot } from './shared.js';

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/youtube.force-ssl',
];

function nowMs() {
  return Date.now();
}

function ensureText(value, fieldName) {
  const text = String(value ?? '').trim();
  if (!text) {
    throw new Error(`Missing required field: ${fieldName}`);
  }
  return text;
}

function sanitizeFilename(raw) {
  const text = String(raw ?? '').trim();
  const cleaned = text
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || 'item';
}

function appDataPaths() {
  const root = youtuneRoot();
  const appDataDir = path.join(root, '.appdata', 'youtube');
  const authDir = path.join(appDataDir, 'youtube-auth');
  const configPath = path.join(appDataDir, 'video-manager-config.json');
  return { root, appDataDir, authDir, configPath };
}

function readJsonSafe(filePath) {
  try {
    const text = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function writeJsonPretty(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
}

function whichExecutable(name) {
  const exeName =
    process.platform === 'win32' && !name.toLowerCase().endsWith('.exe') ? `${name}.exe` : name;
  const cmd = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(cmd, [exeName], { encoding: 'utf-8' });
  if (result.status === 0) {
    const line = String(result.stdout || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find(Boolean);
    return line || '';
  }
  return '';
}

function detectFfmpegPath() {
  const hit = whichExecutable('ffmpeg');
  if (hit) {
    return hit;
  }

  const candidates = [
    'C:\\Program Files\\FFmpeg\\bin\\ffmpeg.exe',
    'C:\\ffmpeg\\bin\\ffmpeg.exe',
    'C:\\ProgramData\\chocolatey\\bin\\ffmpeg.exe',
  ];

  const localAppData = String(process.env.LOCALAPPDATA || '').trim();
  if (localAppData) {
    const wingetRoot = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages');
    try {
      if (fs.existsSync(wingetRoot)) {
        const top = fs.readdirSync(wingetRoot, { withFileTypes: true });
        for (const entry of top) {
          if (!entry.isDirectory() || !entry.name.toLowerCase().startsWith('gyan.ffmpeg_')) {
            continue;
          }
          const base = path.join(wingetRoot, entry.name);
          const inner = fs.readdirSync(base, { withFileTypes: true });
          for (const innerEntry of inner) {
            if (
              !innerEntry.isDirectory() ||
              !innerEntry.name.toLowerCase().startsWith('ffmpeg-')
            ) {
              continue;
            }
            candidates.push(path.join(base, innerEntry.name, 'bin', 'ffmpeg.exe'));
          }
        }
      }
    } catch {
      // ignore
    }
  }

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    } catch {
      // ignore
    }
  }
  return '';
}

function defaultCredentialsPath(authDir) {
  const fallback = path.join(authDir, 'client_secret.json');
  try {
    if (!fs.existsSync(authDir)) {
      return fallback;
    }
    const entries = fs.readdirSync(authDir, { withFileTypes: true });
    const files = entries
      .filter((e) => e.isFile())
      .map((e) => e.name)
      .filter((name) => {
        if (name === 'client_secret.json') return true;
        return /^client_secret_.+\.apps\.googleusercontent\.com\.json$/i.test(name);
      })
      .sort((a, b) => {
        const aFirst = a === 'client_secret.json' ? 0 : 1;
        const bFirst = b === 'client_secret.json' ? 0 : 1;
        if (aFirst !== bFirst) return aFirst - bFirst;
        return a.localeCompare(b);
      });
    return files.length ? path.join(authDir, files[0]) : fallback;
  } catch {
    return fallback;
  }
}

function defaultConfig() {
  const { authDir, configPath } = appDataPaths();
  const ffmpegPath = detectFfmpegPath() || 'ffmpeg';
  return {
    configPath,
    cfg: {
      credentialsPath: defaultCredentialsPath(authDir),
      tokenPath: path.join(authDir, 'token.json'),
      downloadDirectory: 'D:\\videos4app',
      ytDlpPath: 'yt-dlp',
      ffmpegPath,
    },
  };
}

function normalizePath(rawPath) {
  return String(rawPath ?? '').trim();
}

function loadConfig() {
  const { cfg: defaults, configPath } = defaultConfig();
  const parsed = readJsonSafe(configPath);
  if (!parsed) return defaults;

  const raw = parsed;
  const rawFfmpeg = String(raw.ffmpegPath ?? '').trim();
  const ffmpegPath =
    !rawFfmpeg || rawFfmpeg.toLowerCase() === 'ffmpeg'
      ? detectFfmpegPath() || defaults.ffmpegPath
      : rawFfmpeg;

  return {
    credentialsPath: normalizePath(raw.credentialsPath ?? defaults.credentialsPath) || defaults.credentialsPath,
    tokenPath: normalizePath(raw.tokenPath ?? defaults.tokenPath) || defaults.tokenPath,
    downloadDirectory:
      normalizePath(raw.downloadDirectory ?? defaults.downloadDirectory) || defaults.downloadDirectory,
    ytDlpPath: String(raw.ytDlpPath ?? defaults.ytDlpPath).trim() || defaults.ytDlpPath,
    ffmpegPath,
  };
}

function ensureDirectories(config) {
  const { appDataDir, authDir } = appDataPaths();
  fs.mkdirSync(appDataDir, { recursive: true });
  fs.mkdirSync(authDir, { recursive: true });
  fs.mkdirSync(config.downloadDirectory, { recursive: true });
}

function saveConfig(nextConfig) {
  const { configPath } = defaultConfig();
  ensureDirectories(nextConfig);
  writeJsonPretty(configPath, nextConfig);
  return nextConfig;
}

function loadClientCredentials(credentialsPath) {
  if (!fs.existsSync(credentialsPath)) {
    throw new Error(`Credentials file not found: ${credentialsPath}`);
  }
  const raw = readJsonSafe(credentialsPath);
  if (!raw) {
    throw new Error('credentials.json is invalid.');
  }
  const details = raw.installed || raw.web || raw;
  const clientId = String(details.client_id || '').trim();
  const clientSecret = String(details.client_secret || '').trim();
  if (!clientId || !clientSecret) {
    throw new Error('credentials.json missing client_id/client_secret.');
  }
  return { clientId, clientSecret };
}

function parseExpiryDate(value) {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = String(value).trim();
  if (!text) return null;
  if (/^\d+$/.test(text)) return Number(text);
  const iso = text.endsWith('Z') ? text.slice(0, -1) + '+00:00' : text;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : null;
}

function readTokenFile(tokenPath) {
  if (!fs.existsSync(tokenPath)) return null;
  const token = readJsonSafe(tokenPath);
  if (!token) {
    throw new Error('token.json is invalid JSON.');
  }
  return token;
}

function getAuthStatus(config) {
  if (!fs.existsSync(config.credentialsPath)) {
    return { ready: false, message: 'Credentials file not found.' };
  }
  try {
    loadClientCredentials(config.credentialsPath);
  } catch {
    return { ready: false, message: 'credentials.json is invalid.' };
  }
  if (!fs.existsSync(config.tokenPath)) {
    return { ready: false, message: 'Token file not found.' };
  }
  let token;
  try {
    token = readTokenFile(config.tokenPath);
  } catch {
    return { ready: false, message: 'token.json is invalid JSON.' };
  }
  const refreshToken = String(token.refresh_token || '').trim();
  if (!refreshToken) {
    return { ready: false, message: 'refresh_token missing in token.json.' };
  }
  return { ready: true, message: 'Auth files are ready.' };
}

async function ensureToken(config, forceRefresh) {
  const tokenJson = readTokenFile(config.tokenPath);
  if (!tokenJson) throw new Error('Token file not found.');
  const refreshToken = String(tokenJson.refresh_token || '').trim();
  if (!refreshToken) throw new Error('refresh_token missing. Run OAuth flow first.');

  const { clientId, clientSecret } = loadClientCredentials(config.credentialsPath);
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, 'http://localhost');

  const accessToken = String(tokenJson.access_token || '').trim();
  const expiryDateMs = parseExpiryDate(tokenJson.expiry_date);
  const refreshAt = nowMs() + 60_000;

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
    access_token: accessToken || undefined,
    expiry_date: expiryDateMs ?? undefined,
    token_type: String(tokenJson.token_type || 'Bearer'),
  });

  if (!forceRefresh && accessToken && expiryDateMs && expiryDateMs > refreshAt) {
    return { oauth2Client, tokenJson };
  }

  const access = await oauth2Client.getAccessToken();
  const newToken = typeof access === 'string' ? access : access?.token || '';
  if (!newToken) throw new Error('Token refresh response missing access_token.');

  const merged = {
    ...tokenJson,
    access_token: newToken,
    token_type: oauth2Client.credentials.token_type || tokenJson.token_type || 'Bearer',
    expiry_date: oauth2Client.credentials.expiry_date ?? tokenJson.expiry_date,
  };
  if (!merged.refresh_token) merged.refresh_token = refreshToken;

  writeJsonPretty(config.tokenPath, merged);
  oauth2Client.setCredentials({
    refresh_token: merged.refresh_token,
    access_token: merged.access_token,
    expiry_date: parseExpiryDate(merged.expiry_date) ?? undefined,
    token_type: merged.token_type || 'Bearer',
  });

  return { oauth2Client, tokenJson: merged };
}

async function youtubeClient(config) {
  ensureDirectories(config);
  const { oauth2Client } = await ensureToken(config, false);
  return google.youtube({ version: 'v3', auth: oauth2Client });
}

async function forceRefreshToken(config) {
  await ensureToken(config, true);
  return { message: 'Token refresh successful.' };
}

async function runOAuthFlow(config) {
  ensureDirectories(config);
  const { clientId, clientSecret } = loadClientCredentials(config.credentialsPath);

  const server = http.createServer();
  const port = await new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        reject(new Error('Failed to open local OAuth server.'));
        return;
      }
      resolve(addr.port);
    });
  });

  const redirectUri = `http://127.0.0.1:${port}`;
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });

  const codePromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('OAuth timed out. Please retry.'));
      server.close();
    }, 5 * 60_000);

    server.on('request', (req, res) => {
      try {
        const url = new URL(req.url || '/', redirectUri);
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');
        if (error) {
          res.statusCode = 400;
          res.end(`OAuth failed: ${error}`);
          clearTimeout(timeout);
          reject(new Error(`OAuth failed: ${error}`));
          server.close();
          return;
        }
        if (!code) {
          res.statusCode = 200;
          res.end('Waiting for OAuth code...');
          return;
        }
        res.statusCode = 200;
        res.end('OAuth complete. You can close this tab.');
        clearTimeout(timeout);
        resolve(code);
        server.close();
      } catch (err) {
        clearTimeout(timeout);
        reject(err);
        server.close();
      }
    });
  });

  let opened = false;
  try {
    await open(authUrl);
    opened = true;
  } catch {
    opened = false;
  }

  const code = await codePromise;
  const tokenResponse = await oauth2Client.getToken(String(code));

  const existing = readJsonSafe(config.tokenPath) || {};
  const refreshToken = String(
    tokenResponse.tokens.refresh_token || existing.refresh_token || '',
  ).trim();
  const merged = { ...existing, ...tokenResponse.tokens, refresh_token: refreshToken };
  writeJsonPretty(config.tokenPath, merged);

  const hint = opened ? 'OAuth completed.' : `Authorize manually: ${authUrl}`;
  return { ok: 'true', message: `OAuth completed. Token saved to ${config.tokenPath}. ${hint}` };
}

function extractVideoId(source) {
  const raw = String(source ?? '').trim();
  if (!raw) return '';
  const m1 = raw.match(/[?&]v=([a-zA-Z0-9_-]{6,})/);
  if (m1) return m1[1];
  const m2 = raw.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/);
  if (m2) return m2[1];
  const m3 = raw.match(/\/shorts\/([a-zA-Z0-9_-]{6,})/);
  if (m3) return m3[1];
  return '';
}

function canonicalVideoUrl(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function runCommand(cmd, args, { timeoutMs = 15 * 60_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Command timed out: ${cmd}`));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, stdout, stderr });
    });
  });
}

function stripAnsi(text) {
  return String(text ?? '').replace(/\x1B\[[0-9;]*[A-Za-z]/g, '');
}

function extractOutputPath(stdoutText) {
  const lines = stripAnsi(stdoutText)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const candidates = [];
  const addCandidate = (value) => {
    const candidate = String(value || '').trim().replace(/^"+|"+$/g, '');
    if (!candidate) return;
    candidates.push(candidate);
  };

  for (const line of lines) {
    addCandidate(line);

    const quoted = line.match(/"([A-Za-z]:\\[^"]+)"/g) || [];
    for (const item of quoted) {
      addCandidate(item.slice(1, -1));
    }

    const drivePath = line.match(/[A-Za-z]:\\[^<>:"|?*\r\n]+/g) || [];
    for (const item of drivePath) {
      addCandidate(item);
    }
  }

  for (let idx = candidates.length - 1; idx >= 0; idx -= 1) {
    const candidate = candidates[idx];
    if (fs.existsSync(candidate)) {
      try {
        if (fs.statSync(candidate).isFile()) {
          return candidate;
        }
      } catch {
        // ignore and continue
      }
    }
  }

  for (let idx = lines.length - 1; idx >= 0; idx -= 1) {
    const candidate = lines[idx];
    if (fs.existsSync(candidate)) {
      try {
        if (fs.statSync(candidate).isFile()) {
          return candidate;
        }
      } catch {
        // ignore and continue
      }
    }
  }

  throw new Error('Could not locate downloaded output file.');
}

function snapshotMp4Files(downloadDir) {
  const stack = [downloadDir];
  const map = new Map();
  while (stack.length) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.mp4') {
        continue;
      }
      try {
        map.set(full, fs.statSync(full).mtimeMs);
      } catch {
        // ignore
      }
    }
  }
  return map;
}

function detectRecentOutputFile(downloadDir, beforeMap, startMs) {
  const afterMap = snapshotMp4Files(downloadDir);
  let bestFile = '';
  let bestMtime = 0;
  for (const [filePath, mtime] of afterMap.entries()) {
    const beforeMtime = beforeMap.get(filePath);
    const changed = beforeMtime == null || mtime > beforeMtime + 1;
    if (!changed) {
      continue;
    }
    if (mtime < startMs - 5000) {
      continue;
    }
    if (mtime > bestMtime) {
      bestMtime = mtime;
      bestFile = filePath;
    }
  }
  return bestFile;
}

function ffmpegLocation(config) {
  const raw = String(config.ffmpegPath || '').trim().replace(/^"+|"+$/g, '');
  if (!raw) return '';
  try {
    if (fs.existsSync(raw)) {
      const st = fs.statSync(raw);
      if (st.isFile()) return path.dirname(raw);
      if (st.isDirectory()) return raw;
    }
  } catch {
    // ignore
  }
  return '';
}

async function listPlaylists(config) {
  const youtube = await youtubeClient(config);
  const res = await youtube.playlists.list({
    part: 'snippet,status,contentDetails',
    mine: true,
    maxResults: 50,
  });
  const items = Array.isArray(res.data.items) ? res.data.items : [];
  return items.map((item) => ({
    id: item.id || '',
    title: item.snippet?.title || 'Untitled',
    privacyStatus: item.status?.privacyStatus || 'private',
    itemCount: item.contentDetails?.itemCount || 0,
  }));
}

async function createPlaylist(config, { title, description = '', privacyStatus = 'unlisted' }) {
  const safePrivacy = ['private', 'public', 'unlisted'].includes(privacyStatus)
    ? privacyStatus
    : 'unlisted';
  const youtube = await youtubeClient(config);
  const res = await youtube.playlists.insert({
    part: 'snippet,status,contentDetails',
    requestBody: {
      snippet: {
        title: String(title).trim(),
        ...(String(description).trim() ? { description: String(description).trim() } : {}),
      },
      status: { privacyStatus: safePrivacy },
    },
  });
  return {
    id: res.data.id || '',
    title: res.data.snippet?.title || String(title).trim(),
    privacyStatus: res.data.status?.privacyStatus || safePrivacy,
    itemCount: res.data.contentDetails?.itemCount || 0,
  };
}

async function deletePlaylist(config, playlistId) {
  const youtube = await youtubeClient(config);
  await youtube.playlists.delete({ id: playlistId });
  return { deleted: true };
}

async function listPlaylistVideos(config, playlistId) {
  const youtube = await youtubeClient(config);
  const res = await youtube.playlistItems.list({
    part: 'snippet,contentDetails',
    playlistId,
    maxResults: 50,
  });
  const items = Array.isArray(res.data.items) ? res.data.items : [];
  return items.map((item) => {
    const videoId = item.contentDetails?.videoId || '';
    return {
      id: item.id || '',
      videoId,
      title: item.snippet?.title || 'Untitled',
      publishedAt: item.contentDetails?.videoPublishedAt || '',
      url: videoId ? `https://youtu.be/${videoId}` : '',
    };
  });
}

async function addVideoToPlaylist(config, playlistId, videoId) {
  const youtube = await youtubeClient(config);
  await youtube.playlistItems.insert({
    part: 'snippet',
    requestBody: {
      snippet: {
        playlistId,
        resourceId: { kind: 'youtube#video', videoId },
      },
    },
  });
  return { added: true };
}

async function listChannelVideos(config) {
  const youtube = await youtubeClient(config);
  const res = await youtube.search.list({
    part: 'snippet',
    forMine: true,
    type: 'video',
    maxResults: 50,
    order: 'date',
  });
  const items = Array.isArray(res.data.items) ? res.data.items : [];
  return items.map((item) => ({
    videoId: item.id?.videoId || '',
    title: item.snippet?.title || 'Untitled',
    publishedAt: item.snippet?.publishedAt || '',
  }));
}

async function deleteChannelVideo(config, videoId) {
  const youtube = await youtubeClient(config);
  await youtube.videos.delete({ id: videoId });
  return { deleted: true };
}

async function validateUploadAccess(config) {
  const youtube = await youtubeClient(config);
  await youtube.channels.list({
    part: 'id',
    mine: true,
    maxResults: 1,
  });
}

async function uploadFile(config, { filePath, title, playlistId }) {
  await validateUploadAccess(config);
  const youtube = await youtubeClient(config);
  const stream = fs.createReadStream(filePath);

  const res = await youtube.videos.insert({
    part: 'id,snippet,status',
    requestBody: {
      snippet: {
        title: String(title || path.parse(filePath).name),
        description: '',
        categoryId: '17',
      },
      status: { privacyStatus: 'unlisted' },
    },
    media: { body: stream },
  });

  const videoId = String(res.data.id || '').trim();
  if (!videoId) {
    throw new Error('Upload completed without video ID.');
  }

  if (playlistId) {
    await addVideoToPlaylist(config, playlistId, videoId);
  }

  return { videoId, url: `https://youtu.be/${videoId}` };
}

async function downloadBestMp4(config, { url }) {
  const folder = config.downloadDirectory;
  await fsp.mkdir(folder, { recursive: true });
  const beforeMap = snapshotMp4Files(folder);
  const startedAt = Date.now();

  const ytDlp = String(config.ytDlpPath || 'yt-dlp').trim() || 'yt-dlp';
  const outputTemplate = path.join(folder, '%(title)s', '%(title)s.%(ext)s');
  const ffmpegDir = ffmpegLocation(config);

  const args = [
    '-4',
    '-f',
    'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best',
    '--no-playlist',
    '--merge-output-format',
    'mp4',
    '--remux-video',
    'mp4',
    '--force-overwrites',
    '-o',
    outputTemplate,
    '--print',
    'after_move:filepath',
  ];
  if (ffmpegDir) {
    args.push('--ffmpeg-location', ffmpegDir);
  }
  args.push(url);

  const result = await runCommand(ytDlp, args);
  if (result.code !== 0) {
    const stderr = String(result.stderr || '').trim();
    const last =
      stderr.split(/\r?\n/).filter(Boolean).slice(-1)[0] || 'yt-dlp failed.';
    throw new Error(last);
  }

  let outputPath = '';
  try {
    outputPath = extractOutputPath(`${result.stdout || ''}\n${result.stderr || ''}`);
  } catch {
    outputPath = '';
  }
  if (!outputPath || !fs.existsSync(outputPath)) {
    outputPath = detectRecentOutputFile(folder, beforeMap, startedAt);
  }
  if (!outputPath || !fs.existsSync(outputPath)) {
    throw new Error('Downloaded file path not found on disk.');
  }

  const parsed = path.parse(outputPath);
  const safe = sanitizeFilename(parsed.name);
  const targetDir = path.join(folder, safe);
  const targetFile = path.join(targetDir, `${safe}.mp4`);
  await fsp.mkdir(targetDir, { recursive: true });

  if (path.resolve(outputPath) !== path.resolve(targetFile)) {
    try {
      await fsp.rename(outputPath, targetFile);
    } catch {
      await fsp.copyFile(outputPath, targetFile);
    }
  }

  return { outputPath: targetFile };
}

function normalizeChapters(rawChapters, durationSeconds) {
  const prepared = [];
  const list = Array.isArray(rawChapters) ? rawChapters : [];
  for (let idx = 0; idx < list.length; idx += 1) {
    const item = list[idx];
    if (!item || typeof item !== 'object') continue;
    const title = String(item.title || '').trim() || `Chapter ${idx + 1}`;
    const startSeconds = Number(item.start_time);
    const endSeconds = item.end_time == null ? null : Number(item.end_time);
    if (!Number.isFinite(startSeconds) || startSeconds < 0) continue;
    prepared.push({ title, startSeconds, endSeconds });
  }

  const toHHMMSS = (sec) => {
    const total = Math.max(0, Math.floor(sec));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const out = [];
  for (let idx = 0; idx < prepared.length; idx += 1) {
    const startSeconds = prepared[idx].startSeconds;
    let endSeconds = prepared[idx].endSeconds;
    if (endSeconds == null && idx < prepared.length - 1) {
      endSeconds = prepared[idx + 1].startSeconds;
    }
    if (endSeconds == null) {
      endSeconds = durationSeconds;
    }
    if (!Number.isFinite(endSeconds) || endSeconds <= startSeconds) continue;
    out.push({
      index: out.length + 1,
      title: prepared[idx].title,
      startSeconds,
      endSeconds,
      start: toHHMMSS(startSeconds),
      end: toHHMMSS(endSeconds),
    });
  }
  return out;
}

async function fetchVideoChapters(config, { sourceUrl }) {
  const ytDlp = String(config.ytDlpPath || 'yt-dlp').trim() || 'yt-dlp';
  const videoId = extractVideoId(sourceUrl);
  const canonical = videoId ? canonicalVideoUrl(videoId) : sourceUrl;

  const args = ['--skip-download', '--no-playlist', '--dump-single-json', canonical];
  const result = await runCommand(ytDlp, args, { timeoutMs: 60_000 });
  if (result.code !== 0) {
    const stderr = String(result.stderr || '').trim();
    const last =
      stderr.split(/\r?\n/).filter(Boolean).slice(-1)[0] ||
      'yt-dlp chapter fetch failed.';
    throw new Error(last);
  }

  const stdout = String(result.stdout || '').trim();
  if (!stdout) {
    throw new Error('yt-dlp returned empty metadata output.');
  }

  let payload;
  try {
    payload = JSON.parse(stdout);
  } catch {
    throw new Error('yt-dlp returned invalid JSON metadata.');
  }

  const durationSeconds = Number(payload.duration);
  const normalizedDuration =
    Number.isFinite(durationSeconds) && durationSeconds >= 0 ? durationSeconds : null;
  const chapters = normalizeChapters(payload.chapters, normalizedDuration);
  const title = String(payload.title || '').trim() || (videoId || 'video');

  return {
    videoId: videoId || '',
    videoTitle: title,
    sourceUrl: videoId ? canonical : String(sourceUrl).trim(),
    chapters,
  };
}

async function buildTranscriptMarkdown(_config, { source, languages }) {
  const videoId = extractVideoId(source);
  if (!videoId) {
    throw new Error('Invalid YouTube video ID.');
  }

  const sourceUrl = canonicalVideoUrl(videoId);
  const requested = Array.isArray(languages)
    ? languages.map((l) => String(l).trim()).filter(Boolean)
    : [];
  const langList = requested.length ? requested : ['en', 'en-US', 'en-GB'];

  let entries;
  try {
    entries = await YoutubeTranscript.fetchTranscript(videoId, { lang: langList[0] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(message || 'Transcript extraction failed.');
  }

  const normalized = Array.isArray(entries) ? entries : [];
  if (!normalized.length) {
    throw new Error('Transcript extraction returned no content.');
  }

  const fmt = (sec) => {
    const total = Math.max(0, Math.floor(Number(sec) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const markdownLines = [`# Transcript - ${videoId}`, '', `Source: ${sourceUrl}`, ''];
  const outEntries = [];
  for (const item of normalized) {
    const text = String(item.text || '').trim().replace(/\s+/g, ' ');
    const start = Number(item.offset ?? item.start ?? 0);
    if (!text) continue;
    const ts = fmt(start);
    const seconds = Math.max(0, Math.floor(start));
    markdownLines.push(`- [${ts}](${sourceUrl}&t=${seconds}s) ${text}`);
    outEntries.push({ timestamp: ts, seconds, text });
  }

  if (!outEntries.length) {
    throw new Error('Transcript entries were empty after formatting.');
  }

  return {
    videoId,
    sourceUrl,
    entryCount: outEntries.length,
    entries: outEntries,
    markdown: `${markdownLines.join('\n').trim()}\n`,
  };
}

function parseChannelReference(channelUrl) {
  const raw = String(channelUrl ?? '').trim();
  if (!raw) throw new Error('Channel URL is required.');

  if (raw.startsWith('@')) {
    const handle = raw.slice(1).trim().replace(/\/+$/, '');
    if (!handle) throw new Error('Channel handle is empty.');
    return {
      key: 'forHandle',
      value: handle,
      canonicalUrl: `https://www.youtube.com/@${handle}`,
    };
  }

  const candidate = raw.includes('://') ? raw : `https://${raw.replace(/^\/+/, '')}`;
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error(
      'Provide a YouTube channel URL, for example https://www.youtube.com/@yourhandle.',
    );
  }

  const host = parsed.hostname.toLowerCase();
  if (!['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host)) {
    throw new Error(
      'Provide a YouTube channel URL, for example https://www.youtube.com/@yourhandle.',
    );
  }

  const segments = parsed.pathname.split('/').filter(Boolean);
  if (!segments.length) {
    throw new Error(
      'Provide a channel URL like https://www.youtube.com/@yourhandle or /channel/UC...',
    );
  }

  const first = segments[0];
  if (first.startsWith('@')) {
    const handle = first.slice(1).trim();
    if (!handle) throw new Error('Channel handle is empty.');
    return {
      key: 'forHandle',
      value: handle,
      canonicalUrl: `https://www.youtube.com/@${handle}`,
    };
  }

  if (first === 'channel' && segments.length >= 2) {
    const id = segments[1].trim();
    if (!id) throw new Error('Channel id is empty.');
    return {
      key: 'id',
      value: id,
      canonicalUrl: `https://www.youtube.com/channel/${id}`,
    };
  }

  if ((first === 'user' || first === 'c') && segments.length >= 2) {
    const username = segments[1].trim();
    if (!username) throw new Error('Channel username is empty.');
    return {
      key: 'forUsername',
      value: username,
      canonicalUrl: `https://www.youtube.com/${first}/${username}`,
    };
  }

  throw new Error(
    'Unsupported channel URL. Use one of: /@handle, /channel/<id>, /user/<name>.',
  );
}

function parseIso8601DurationSeconds(text) {
  const raw = String(text ?? '').trim();
  if (!raw) return 0;
  const match = raw.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/);
  if (!match) return 0;
  const days = Number(match[1] || 0);
  const hours = Number(match[2] || 0);
  const minutes = Number(match[3] || 0);
  const seconds = Number(match[4] || 0);
  const total = (days * 86400) + (hours * 3600) + (minutes * 60) + Math.floor(seconds);
  return Number.isFinite(total) && total >= 0 ? total : 0;
}

function formatDuration(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = Math.floor(safe % 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

async function fetchChannelReport(config, { channelUrl }) {
  const youtube = await youtubeClient(config);
  const ref = parseChannelReference(channelUrl);

  const res = await youtube.channels.list({
    part: 'snippet,contentDetails',
    maxResults: 1,
    [ref.key]: ref.value,
  });
  const items = Array.isArray(res.data.items) ? res.data.items : [];
  if (!items.length) {
    throw new Error(`Channel not found for: ${channelUrl}`);
  }

  const channel = items[0];
  const channelId = String(channel.id || '').trim();
  const channelTitle = String(channel.snippet?.title || '').trim() || 'Unknown Channel';
  const uploadsPlaylistId = String(channel.contentDetails?.relatedPlaylists?.uploads || '').trim();
  if (!uploadsPlaylistId) {
    throw new Error('Could not resolve channel uploads playlist.');
  }

  const videos = [];
  let pageToken = '';
  while (true) {
    const page = await youtube.playlistItems.list({
      part: 'snippet,contentDetails',
      playlistId: uploadsPlaylistId,
      maxResults: 50,
      ...(pageToken ? { pageToken } : {}),
    });
    const pageItems = Array.isArray(page.data.items) ? page.data.items : [];
    for (const item of pageItems) {
      const videoId = String(item.contentDetails?.videoId || '').trim();
      if (!videoId) continue;
      videos.push({
        videoId,
        title: String(item.snippet?.title || 'Untitled'),
        publishedAt: String(item.contentDetails?.videoPublishedAt || item.snippet?.publishedAt || ''),
      });
    }
    const next = String(page.data.nextPageToken || '').trim();
    if (!next) break;
    pageToken = next;
  }

  const metricsById = new Map();
  for (let start = 0; start < videos.length; start += 50) {
    const chunk = videos.slice(start, start + 50).map((v) => v.videoId).filter(Boolean);
    if (!chunk.length) continue;
    const vres = await youtube.videos.list({
      part: 'statistics,contentDetails',
      id: chunk.join(','),
      maxResults: 50,
    });
    const vitems = Array.isArray(vres.data.items) ? vres.data.items : [];
    for (const item of vitems) {
      const id = String(item.id || '').trim();
      if (!id) continue;
      const views = Number(item.statistics?.viewCount || 0);
      const durSec = parseIso8601DurationSeconds(item.contentDetails?.duration);
      metricsById.set(id, {
        views: Number.isFinite(views) && views >= 0 ? views : 0,
        length: formatDuration(durSec),
      });
    }
  }

  const enriched = videos.map((v) => {
    const m = metricsById.get(v.videoId) || { views: 0, length: '00:00:00' };
    return {
      videoId: v.videoId,
      title: v.title,
      publishedAt: v.publishedAt,
      views: m.views,
      length: m.length,
      url: `https://www.youtube.com/watch?v=${v.videoId}`,
    };
  });

  const stamp = new Date();
  const generatedAt = stamp.toISOString().replace('T', ' ').slice(0, 19);
  const lines = [
    '# YouTube Channel Video Report',
    '',
    `- Channel: ${channelTitle}`,
    `- Channel ID: ${channelId || 'unknown'}`,
    `- Channel URL: ${ref.canonicalUrl}`,
    `- Generated At (UTC): ${generatedAt}`,
    `- Video Count: ${enriched.length}`,
    '',
    '| # | Title | Date | Views | Length | URL |',
    '| --- | --- | --- | --- | --- | --- |',
  ];

  const escape = (val) => String(val ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
  const fmtDate = (val) => {
    const raw = String(val ?? '').trim();
    if (!raw) return '';
    const parsed = Date.parse(raw);
    if (!Number.isFinite(parsed)) return raw.slice(0, 10);
    return new Date(parsed).toISOString().slice(0, 10);
  };

  if (!enriched.length) {
    lines.push('| - | No videos found | - | - | - | - |');
  } else {
    enriched.forEach((video, idx) => {
      lines.push(
        `| ${idx + 1} | ${escape(video.title)} | ${fmtDate(video.publishedAt) || '-'} | ${Number(video.views) || 0} | ${escape(video.length)} | ${escape(video.url)} |`,
      );
    });
  }

  const markdown = `${lines.join('\n').trim()}\n`;
  const safeTitle = sanitizeFilename(channelTitle);
  const safeId = sanitizeFilename(channelId || 'channel');
  const fileName = `youtube_channel_report_${safeTitle}_${safeId}_${stamp
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..+$/, '')
    .replace('T', '_')}.md`;
  const outPath = path.join(config.downloadDirectory, fileName);
  await fsp.mkdir(config.downloadDirectory, { recursive: true });
  await fsp.writeFile(outPath, markdown, 'utf-8');

  return {
    channelId,
    channelTitle,
    channelUrl: ref.canonicalUrl,
    videos: enriched,
    markdownPath: outPath,
  };
}

function normalizeTimestampValue(value) {
  if (value == null) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  if (/^\d+(\.\d+)?$/.test(raw)) return raw;
  const parts = raw.split(':');
  if (parts.length === 2) {
    const [mm, ss] = parts;
    return `00:${String(mm).padStart(2, '0')}:${ss}`;
  }
  if (parts.length === 3) {
    const [hh, mm, ss] = parts;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${ss}`;
  }
  return raw;
}

function parseTimestampSeconds(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    if (raw < 0) throw new Error('Timestamp must be >= 0.');
    return raw;
  }
  const value = String(raw ?? '').trim();
  if (!value) throw new Error('Timestamp is required.');
  const secMatch = value.match(/^(\d+(?:\.\d+)?)(?:s)?$/i);
  if (secMatch) {
    const sec = Number(secMatch[1]);
    if (sec < 0) throw new Error('Timestamp must be >= 0.');
    return sec;
  }
  const parts = value.split(':');
  if (parts.length === 2 || parts.length === 3) {
    const nums = parts.map((p) => Number(p));
    if (nums.some((n) => !Number.isFinite(n))) {
      throw new Error(`Invalid timestamp value: ${value}`);
    }
    const total =
      parts.length === 2
        ? nums[0] * 60 + nums[1]
        : nums[0] * 3600 + nums[1] * 60 + nums[2];
    if (total < 0) throw new Error('Timestamp must be >= 0.');
    return total;
  }
  throw new Error(`Invalid timestamp '${value}'. Use seconds like 3s or HH:MM:SS.`);
}

function parseTimestamps(timestampsRaw) {
  if (Array.isArray(timestampsRaw)) {
    const parsed = [];
    for (const entry of timestampsRaw) {
      if (!entry || typeof entry !== 'object') continue;
      const drillNameRaw = entry.drill_name || entry.drillName || entry.name || '';
      const startRaw = entry.start_time || entry.startTime || entry.start || '';
      const endRaw = entry.end_time || entry.endTime || entry.end || '';
      const drillName = sanitizeFilename(String(drillNameRaw)).replace(/_/g, ' ');
      const start = normalizeTimestampValue(startRaw);
      const end = normalizeTimestampValue(endRaw);
      if (!drillName || !start || !end) continue;
      parsed.push({ drillName, start, end });
    }
    return parsed;
  }

  const text = String(timestampsRaw ?? '').trim();
  if (text.startsWith('[') && text.endsWith(']')) {
    try {
      return parseTimestamps(JSON.parse(text));
    } catch {
      return [];
    }
  }

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out = [];
  const re = /^(\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?)[\s]*-[\s]*(\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?)[\s]+(.+)$/;
  for (const line of lines) {
    const m = line.match(re);
    if (!m) continue;
    const start = normalizeTimestampValue(m[1]);
    const end = normalizeTimestampValue(m[2]);
    const drillName = sanitizeFilename(m[3]).replace(/_/g, ' ');
    if (!drillName || !start || !end) continue;
    out.push({ drillName, start, end });
  }
  return out;
}

async function cutClipsLocalMp4(config, { sourcePath, timestamps, outputDir }) {
  const ffmpeg = String(config.ffmpegPath || 'ffmpeg').trim() || 'ffmpeg';
  const normalized = parseTimestamps(timestamps);
  if (!normalized.length) {
    throw new Error('No valid timestamps found.');
  }

  const source = path.resolve(sourcePath);
  if (!fs.existsSync(source) || !fs.statSync(source).isFile()) {
    throw new Error('Source video file does not exist.');
  }

  const outDir = outputDir ? path.resolve(outputDir) : path.dirname(source);
  await fsp.mkdir(outDir, { recursive: true });

  const outputs = [];
  for (let idx = 0; idx < normalized.length; idx += 1) {
    const clip = normalized[idx];
    const startSeconds = parseTimestampSeconds(clip.start);
    const endSeconds = parseTimestampSeconds(clip.end);
    if (endSeconds <= startSeconds) {
      throw new Error(`Invalid clip range for '${clip.drillName}': end must be after start.`);
    }
    const safeClipName = sanitizeFilename(clip.drillName);
    const outPath = path.join(outDir, `${String(idx + 1).padStart(3, '0')}_${safeClipName}.mp4`);

    const args = [
      '-hide_banner',
      '-loglevel',
      'warning',
      '-i',
      source,
      '-ss',
      `${startSeconds.toFixed(3)}`,
      '-to',
      `${endSeconds.toFixed(3)}`,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-movflags',
      '+faststart',
      '-y',
      outPath,
    ];

    const result = await runCommand(ffmpeg, args, { timeoutMs: 30 * 60_000 });
    if (result.code !== 0 || !fs.existsSync(outPath)) {
      const stderr = String(result.stderr || '').trim();
      const last =
        stderr.split(/\r?\n/).filter(Boolean).slice(-1)[0] || 'ffmpeg clipping failed.';
      throw new Error(last);
    }
    outputs.push(outPath);
  }

  return { count: outputs.length, paths: outputs };
}

export async function runYouTubeOperation(operation, payload = {}) {
  const config = loadConfig();
  ensureDirectories(config);

  switch (operation) {
    case 'health': {
      const { root } = appDataPaths();
      return {
        ok: true,
        root,
        node: process.version,
        platform: `${os.platform()} ${os.release()}`,
      };
    }
    case 'get_config':
      return config;
    case 'save_config': {
      const merged = {
        ...config,
        ...(payload && typeof payload === 'object' ? payload : {}),
      };
      merged.credentialsPath = String(merged.credentialsPath || config.credentialsPath).trim();
      merged.tokenPath = String(merged.tokenPath || config.tokenPath).trim();
      merged.downloadDirectory = String(merged.downloadDirectory || config.downloadDirectory).trim();
      merged.ytDlpPath = String(merged.ytDlpPath || config.ytDlpPath).trim() || 'yt-dlp';
      merged.ffmpegPath = String(merged.ffmpegPath || config.ffmpegPath).trim() || 'ffmpeg';
      return saveConfig(merged);
    }
    case 'auth_status':
      return getAuthStatus(config);
    case 'auth_oauth':
      return runOAuthFlow(config);
    case 'auth_refresh':
      return forceRefreshToken(config);

    case 'list_channel_videos':
      return listChannelVideos(config);
    case 'delete_channel_video':
      return deleteChannelVideo(config, ensureText(payload.videoId, 'videoId'));

    case 'list_playlists':
      return listPlaylists(config);
    case 'create_playlist':
      return createPlaylist(config, {
        title: ensureText(payload.title, 'title'),
        description: String(payload.description || '').trim(),
        privacyStatus: String(payload.privacyStatus || 'unlisted').trim() || 'unlisted',
      });
    case 'delete_playlist':
      return deletePlaylist(config, ensureText(payload.playlistId, 'playlistId'));
    case 'list_playlist_videos':
      return listPlaylistVideos(config, ensureText(payload.playlistId, 'playlistId'));
    case 'add_video_to_playlist':
      return addVideoToPlaylist(
        config,
        ensureText(payload.playlistId, 'playlistId'),
        ensureText(payload.videoId, 'videoId'),
      );

    case 'upload_file':
      return uploadFile(config, {
        filePath: ensureText(payload.filePath, 'filePath'),
        title: String(payload.title || '').trim() || undefined,
        playlistId: String(payload.playlistId || '').trim() || undefined,
      });
    case 'download_best_mp4':
      return downloadBestMp4(config, { url: ensureText(payload.url, 'url') });
    case 'fetch_video_chapters':
      return fetchVideoChapters(config, { sourceUrl: ensureText(payload.sourceUrl, 'sourceUrl') });
    case 'build_transcript_markdown':
      return buildTranscriptMarkdown(config, {
        source: ensureText(payload.source, 'source'),
        languages: payload.languages,
      });
    case 'fetch_channel_report':
      return fetchChannelReport(config, { channelUrl: ensureText(payload.channelUrl, 'channelUrl') });
    case 'cut_clips_local_mp4':
      return cutClipsLocalMp4(config, {
        sourcePath: ensureText(payload.sourcePath, 'sourcePath'),
        timestamps: payload.timestamps,
        outputDir: String(payload.outputDir || '').trim() || undefined,
      });
    default:
      throw new Error(`Unsupported operation: ${operation}`);
  }
}
