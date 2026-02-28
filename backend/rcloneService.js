import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { youtuneRoot } from './shared.js';

const RCLONE_APPDATA_DIR = path.join(youtuneRoot(), '.appdata', 'rclone');
const RCLONE_CONFIG_PATH = path.join(RCLONE_APPDATA_DIR, 'rclone.conf');
const SPACES_CONFIG_PATH = path.join(RCLONE_APPDATA_DIR, 'digitalocean-spaces.json');
const GOOGLE_DRIVE_AUTH_DIR = path.join(youtuneRoot(), '.appdata', 'google-drive');
const CLOUDFLARE_R2_AUTH_DIR = path.join(youtuneRoot(), '.appdata', 'cloudflare-r2');

const mountProcesses = new Map();

export class RCloneError extends Error {
  constructor(message, code = null, stderr = '') {
    super(message);
    this.name = 'RCloneError';
    this.code = code;
    this.stderr = stderr;
  }
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

function ensureRcloneAvailable() {
  const cmd = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(cmd, ['rclone'], { encoding: 'utf-8' });

  if (result.status !== 0) {
    throw new RCloneError(
      'rclone executable not found in PATH. Install rclone from https://rclone.org/',
    );
  }

  const exePath = String(result.stdout || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find(Boolean);

  if (!exePath) {
    throw new RCloneError('rclone executable not found in PATH.');
  }

  return exePath;
}

function runRcloneCommand(args, { expectJson = false } = {}) {
  ensureRcloneAvailable();

  const rcloneArgs = ['--config', RCLONE_CONFIG_PATH, ...args];
  const result = spawnSync('rclone', rcloneArgs, {
    encoding: 'utf-8',
    windowsHide: true,
  });

  if (result.status !== 0) {
    const stderr = String(result.stderr || '').trim();
    const message = stderr || `rclone command failed with code ${result.status}`;
    throw new RCloneError(message, result.status, stderr);
  }

  const stdout = String(result.stdout || '').trim();

  if (expectJson && stdout) {
    try {
      return JSON.parse(stdout);
    } catch {
      throw new RCloneError('rclone returned invalid JSON output.');
    }
  }

  return stdout;
}

export function listRemotes() {
  ensureRcloneAvailable();
  fs.mkdirSync(RCLONE_APPDATA_DIR, { recursive: true });

  const output = runRcloneCommand(['listremotes']);
  const remotes = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => line.endsWith(':') ? line.slice(0, -1) : line)
    .filter((line) => line && !line.startsWith('#'));

  return remotes;
}

export function createOrReplaceRemote(name, type, options = {}) {
  if (!name || typeof name !== 'string') {
    throw new RCloneError('Remote name is required.');
  }

  if (name.includes(':')) {
    throw new RCloneError('Remote name cannot contain a colon (:).');
  }

  if (!type || typeof type !== 'string') {
    throw new RCloneError('Remote type is required.');
  }

  fs.mkdirSync(RCLONE_APPDATA_DIR, { recursive: true });

  const existingRemotes = listRemotes();
  if (existingRemotes.includes(name)) {
    try {
      runRcloneCommand(['config', 'delete', name]);
    } catch {
      // Ignore delete errors
    }
  }

  const configArgs = ['config', 'create', name, type, '--non-interactive'];

  for (const [key, value] of Object.entries(options)) {
    const strValue = String(value);
    if (value === undefined || value === null || strValue === '') continue;
    const argValue = typeof value === 'boolean' ? (value ? 'true' : 'false') : strValue;
    configArgs.push(key, argValue);
  }

  runRcloneCommand(configArgs);

  return { name, type, created: true };
}

export function listRemoteEntries(remoteName, remotePath = '') {
  if (!remoteName || typeof remoteName !== 'string') {
    throw new RCloneError('Remote name is required.');
  }

  if (remoteName.includes(':')) {
    throw new RCloneError('Remote name cannot contain a colon (:).');
  }

  const remote = `${remoteName}:`;
  const target = remotePath ? path.posix.join(remote, remotePath) : remote;

  const result = runRcloneCommand(['lsjson', target], { expectJson: true });

  if (!Array.isArray(result)) return [];

  return result.map((row) => ({
    name: row.Name || '',
    path: row.Path || '',
    size: Math.max(0, Number(row.Size) || 0),
    modTime: row.ModTime || null,
    isDir: Boolean(row.IsDir),
    isBucket: Boolean(row.IsBucket),
  }));
}

export function uploadLocalFolderToRemote(
  remoteName,
  { localFolder, remotePath = '' } = {},
) {
  if (!remoteName || typeof remoteName !== 'string') {
    throw new RCloneError('Remote name is required.');
  }

  if (!localFolder || typeof localFolder !== 'string') {
    throw new RCloneError('Local folder path is required.');
  }

  const resolvedLocal = path.resolve(localFolder);
  if (!fs.existsSync(resolvedLocal)) {
    throw new RCloneError(`Local folder does not exist: ${localFolder}`);
  }

  if (!fs.statSync(resolvedLocal).isDirectory()) {
    throw new RCloneError(`Path is not a directory: ${localFolder}`);
  }

  const colonIndex = remoteName.indexOf(':');
  const remote =
    colonIndex === -1 ? `${remoteName}:` : remoteName;
  const target = remotePath ? path.posix.join(remote, remotePath) : remote;

  runRcloneCommand([
    'copy',
    resolvedLocal,
    target,
    '--create-empty-src-dirs',
  ]);

  return { uploaded: true, source: resolvedLocal, target };
}

export function deleteRemotePath(remoteName, remotePath, { isDir = false } = {}) {
  if (!remoteName || typeof remoteName !== 'string') {
    throw new RCloneError('Remote name is required.');
  }

  if (!remotePath || typeof remotePath !== 'string') {
    throw new RCloneError('Remote path is required.');
  }

  const colonIndex = remoteName.indexOf(':');
  const remote =
    colonIndex === -1 ? `${remoteName}:` : remoteName;
  const target = path.posix.join(remote, remotePath);

  const command = isDir ? 'purge' : 'delete';
  runRcloneCommand([command, target]);

  return { deleted: true, path: target, method: isDir ? 'purge' : 'delete' };
}

export function bootstrapGoogleDriveRemote() {
  fs.mkdirSync(RCLONE_APPDATA_DIR, { recursive: true });

  const authDir = GOOGLE_DRIVE_AUTH_DIR;
  if (!fs.existsSync(authDir)) {
    throw new RCloneError(
      `Google Drive auth directory not found: ${authDir}`,
    );
  }

  const tokenPath = path.join(authDir, 'token.json');
  if (!fs.existsSync(tokenPath)) {
    throw new RCloneError(`Google Drive token file not found: ${tokenPath}`);
  }

  const token = readJsonSafe(tokenPath);
  if (!token || !token.refresh_token) {
    throw new RCloneError('Invalid token.json: missing refresh_token');
  }

  const credentialsFiles = fs.readdirSync(authDir).filter((file) =>
    file.startsWith('client_secret_') && file.endsWith('.json'),
  );

  const credentialsFile =
    credentialsFiles.find((f) => f.includes('apps.googleusercontent.com')) ||
    credentialsFiles[0];

  if (!credentialsFile) {
    throw new RCloneError(
      `No client_secret_*.apps.googleusercontent.com.json found in ${authDir}`,
    );
  }

  const credentialsPath = path.join(authDir, credentialsFile);
  const credentials = readJsonSafe(credentialsPath);

  if (!credentials || !credentials.installed && !credentials.web) {
    throw new RCloneError('Invalid credentials file format');
  }

  const clientConfig = credentials.installed || credentials.web;
  const clientId = clientConfig.client_id;
  const clientSecret = clientConfig.client_secret;

  if (!clientId || !clientSecret) {
    throw new RCloneError('Credentials missing client_id or client_secret');
  }

  return createOrReplaceRemote('gdrive', 'drive', {
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'drive',
    token: JSON.stringify(token),
  });
}

export function bootstrapCloudflareR2Remote() {
  fs.mkdirSync(RCLONE_APPDATA_DIR, { recursive: true });

  const configPath = path.join(CLOUDFLARE_R2_AUTH_DIR, 'config.json');
  if (!fs.existsSync(configPath)) {
    throw new RCloneError(
      `Cloudflare R2 config not found: ${configPath}`,
    );
  }

  const config = readJsonSafe(configPath);
  if (!config) {
    throw new RCloneError('Invalid Cloudflare R2 config.json');
  }

  const {
    accessKeyId,
    secretAccessKey,
    endpoint,
  } = config;

  if (!accessKeyId || !secretAccessKey || !endpoint) {
    throw new RCloneError(
      'Cloudflare R2 config missing required fields (accessKeyId, secretAccessKey, endpoint)',
    );
  }

  return createOrReplaceRemote('r2', 's3', {
    provider: 'Cloudflare',
    access_key_id: accessKeyId,
    secret_access_key: secretAccessKey,
    endpoint,
    region: 'auto',
    env_auth: 'false',
  });
}

export function bootstrapDigitalOceanSpacesRemote(config) {
  if (!config || typeof config !== 'object') {
    throw new RCloneError('Spaces config is required');
  }

  const {
    name = 'spaces',
    accessKeyId,
    secretAccessKey,
    endpoint,
    region,
    locationConstraint,
  } = config;

  if (!accessKeyId || !secretAccessKey || !endpoint) {
    throw new RCloneError(
      'Spaces config missing required fields (accessKeyId, secretAccessKey, endpoint)',
    );
  }

  const options = {
    provider: 'DigitalOcean',
    access_key_id: accessKeyId,
    secret_access_key: secretAccessKey,
    endpoint,
    env_auth: 'false',
  };

  if (region) {
    options.region = region;
  }

  if (locationConstraint) {
    options.location_constraint = locationConstraint;
  }

  return createOrReplaceRemote(name, 's3', options);
}

function defaultSpacesConfig() {
  return {
    accessKeyId: '',
    secretAccessKey: '',
    endpoint: '',
    bucketName: '',
    keyPrefix: '',
    region: '',
    locationConstraint: '',
  };
}

function sanitizeSpacesConfig(config) {
  const defaults = defaultSpacesConfig();
  const merged = { ...defaults };

  if (config && typeof config === 'object') {
    for (const key of Object.keys(defaults)) {
      const value = config[key];
      merged[key] = value == null ? '' : String(value).trim();
    }
  }

  return merged;
}

export function loadSpacesConfig() {
  fs.mkdirSync(RCLONE_APPDATA_DIR, { recursive: true });
  const config = readJsonSafe(SPACES_CONFIG_PATH);
  return sanitizeSpacesConfig(config || {});
}

export function saveSpacesConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new RCloneError('Config must be an object');
  }

  const sanitized = sanitizeSpacesConfig(config);
  writeJsonPretty(SPACES_CONFIG_PATH, sanitized);
  return sanitized;
}

export function startMount(remoteName, remotePath = '', mountPoint) {
  if (!remoteName || typeof remoteName !== 'string') {
    throw new RCloneError('Remote name is required.');
  }

  ensureRcloneAvailable();
  fs.mkdirSync(RCLONE_APPDATA_DIR, { recursive: true });

  const colonIndex = remoteName.indexOf(':');
  const remote =
    colonIndex === -1 ? `${remoteName}:` : remoteName;
  const source = remotePath ? path.posix.join(remote, remotePath) : remote;

  if (!mountPoint || typeof mountPoint !== 'string') {
    throw new RCloneError('Mount point path is required.');
  }

  const resolvedMount = path.resolve(mountPoint);

  try {
    fs.mkdirSync(resolvedMount, { recursive: true });
  } catch (err) {
    throw new RCloneError(`Failed to create mount point: ${resolvedMount}`);
  }

  const existingProcess = mountProcesses.get(remoteName);
  if (existingProcess && existingProcess.exitCode === null) {
    throw new RCloneError(`Mount for '${remoteName}' is already active.`);
  }

  const args = [
    'mount',
    source,
    resolvedMount,
    '--config',
    RCLONE_CONFIG_PATH,
    '--vfs-cache-mode',
    'minimal',
  ];

  const child = spawn('rclone', args, {
    windowsHide: true,
    detached: process.platform !== 'win32',
  });

  child.stdout?.pipe(process.stdout);
  child.stderr?.pipe(process.stderr);

  child.on('error', () => {
    mountProcesses.delete(remoteName);
  });

  child.on('exit', () => {
    mountProcesses.delete(remoteName);
  });

  mountProcesses.set(remoteName, child);

  return {
    remoteName,
    mountPoint: resolvedMount,
    pid: child.pid,
    started: true,
  };
}

export function stopMount(remoteName) {
  if (!remoteName || typeof remoteName !== 'string') {
    throw new RCloneError('Remote name is required.');
  }

  const child = mountProcesses.get(remoteName);

  if (!child) {
    return { stopped: false, message: `No active mount found for '${remoteName}'` };
  }

  try {
    child.kill();
  } catch {
    // Ignore errors during kill
  }

  mountProcesses.delete(remoteName);

  return { stopped: true, remoteName };
}

export function listActiveMounts() {
  const mounts = [];

  for (const [name, child] of mountProcesses.entries()) {
    if (child.exitCode === null) {
      mounts.push({
        remoteName: name,
        pid: child.pid,
        active: true,
      });
    }
  }

  return mounts;
}

export function getPaths() {
  return {
    RCLONE_APPDATA_DIR,
    RCLONE_CONFIG_PATH,
    SPACES_CONFIG_PATH,
    GOOGLE_DRIVE_AUTH_DIR,
    CLOUDFLARE_R2_AUTH_DIR,
  };
}

function normalizeRemotePath(value) {
  const trimmed = String(value ?? '').trim();
  const forwardSlashes = trimmed.replace(/\\/g, '/');
  const stripped = forwardSlashes.replace(/^\/+|\/+$/g, '');
  return stripped;
}

export function buildS3RemotePath(bucketName, keyPrefix = '') {
  if (!bucketName || typeof bucketName !== 'string') {
    throw new RCloneError('Bucket name is required.');
  }

  const normalizedBucket = normalizeRemotePath(bucketName);
  if (!normalizedBucket) {
    throw new RCloneError('Bucket name cannot be empty after normalization.');
  }

  if (!keyPrefix) {
    return normalizedBucket;
  }

  const normalizedPrefix = normalizeRemotePath(keyPrefix);
  return normalizedPrefix ? `${normalizedBucket}/${normalizedPrefix}` : normalizedBucket;
}

export async function runRcloneOperation(operation, payload = {}) {
  switch (operation) {
    case 'health':
      ensureRcloneAvailable();
      return {
        ok: true,
        rcloneInstalled: true,
        paths: getPaths(),
      };

    case 'list_remotes':
      return listRemotes();

    case 'create_remote':
      return createOrReplaceRemote(
        payload.name,
        payload.type,
        payload.options || {},
      );

    case 'list_entries':
      return listRemoteEntries(
        payload.remoteName,
        payload.remotePath || '',
      );

    case 'upload_folder':
      return uploadLocalFolderToRemote(payload.remoteName, {
        localFolder: payload.localFolder,
        remotePath: payload.remotePath || '',
      });

    case 'delete_path':
      return deleteRemotePath(
        payload.remoteName,
        payload.remotePath,
        { isDir: Boolean(payload.isDir) },
      );

    case 'bootstrap_google_drive':
      return bootstrapGoogleDriveRemote();

    case 'bootstrap_cloudflare_r2':
      return bootstrapCloudflareR2Remote();

    case 'bootstrap_spaces':
      return bootstrapDigitalOceanSpacesRemote(payload.config || payload);

    case 'load_spaces_config':
      return loadSpacesConfig();

    case 'save_spaces_config':
      return saveSpacesConfig(payload.config || payload);

    case 'start_mount':
      return startMount(
        payload.remoteName,
        payload.remotePath || '',
        payload.mountPoint,
      );

    case 'stop_mount':
      return stopMount(payload.remoteName);

    case 'list_mounts':
      return listActiveMounts();

    case 'get_paths':
      return getPaths();

    case 'build_s3_path':
      return buildS3RemotePath(
        payload.bucketName,
        payload.keyPrefix || '',
      );

    default:
      throw new RCloneError(`Unsupported operation: ${operation}`);
  }
}
