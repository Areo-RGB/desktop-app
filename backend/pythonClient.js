import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRIDGE_PATH = path.join(__dirname, 'python_bridge.py');

function parseBridgeOutput(stdout, stderr, exitCode) {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const lastLine = lines[lines.length - 1];

  if (!lastLine) {
    const details = stderr.trim() || `python bridge exited with code ${exitCode}`;
    throw new Error(`No JSON response from python bridge. ${details}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(lastLine);
  } catch {
    throw new Error(`Invalid JSON from python bridge: ${lastLine}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Unexpected python bridge response shape.');
  }

  if (parsed.ok === true) {
    return parsed.data;
  }

  const message = typeof parsed.error === 'string' ? parsed.error : 'Unknown Python error.';
  throw new Error(message);
}

export function runYouTubeOperation(operation, payload = {}) {
  return new Promise((resolve, reject) => {
    const pythonBin = process.env.YOUTUBE_PYTHON_BIN || 'python';
    const child = spawn(pythonBin, [BRIDGE_PATH, operation], {
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to start python process: ${err.message}`));
    });

    child.on('close', (exitCode) => {
      try {
        const data = parseBridgeOutput(stdout, stderr, exitCode ?? -1);
        resolve(data);
      } catch (err) {
        reject(err);
      }
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}
