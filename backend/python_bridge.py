#!/usr/bin/env python3
"""Thin JSON bridge between Node backend and python-youtune YouTube features."""

from __future__ import annotations

import json
import os
from pathlib import Path
import sys
from typing import Any


def _resolve_root() -> Path:
    raw = os.environ.get("YOUTUNE_ROOT", r"C:\Users\paul\projects\python-youtune")
    root = Path(raw).expanduser().resolve()
    if not root.exists():
        raise RuntimeError(f"YOUTUNE_ROOT does not exist: {root}")
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))
    return root


def _load_payload() -> dict[str, Any]:
    raw = sys.stdin.read().strip()
    if not raw:
        return {}
    parsed = json.loads(raw)
    if not isinstance(parsed, dict):
        raise RuntimeError("Payload must be a JSON object.")
    return parsed


def _ensure_text(value: Any, *, field_name: str) -> str:
    text = str(value or "").strip()
    if not text:
        raise RuntimeError(f"Missing required field: {field_name}")
    return text


def _to_json_safe(value: Any) -> Any:
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, dict):
        return {str(k): _to_json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_to_json_safe(item) for item in value]
    if isinstance(value, tuple):
        return [_to_json_safe(item) for item in value]
    return value


def _config_from_payload(payload: dict[str, Any]):
    from features.youtube.config import VideoConfig, load_config

    current = load_config()
    return VideoConfig(
        credentials_path=str(payload.get("credentialsPath", current.credentials_path)).strip(),
        token_path=str(payload.get("tokenPath", current.token_path)).strip(),
        download_directory=str(payload.get("downloadDirectory", current.download_directory)).strip(),
        yt_dlp_path=str(payload.get("ytDlpPath", current.yt_dlp_path)).strip() or "yt-dlp",
        ffmpeg_path=str(payload.get("ffmpegPath", current.ffmpeg_path)).strip() or "ffmpeg",
    )


def _run(operation: str, payload: dict[str, Any]) -> Any:
    from features.youtube.auth import ensure_token, get_auth_status, run_oauth_flow
    from features.youtube.channel import (
        delete_channel_video,
        list_channel_videos,
        validate_upload_access,
    )
    from features.youtube.chapters import fetch_video_chapters
    from features.youtube.config import ensure_directories, load_config, save_config
    from features.youtube.fetch import fetch_and_export_channel_videos_markdown
    from features.youtube.pipeline import cut_clips_local_mp4, download_best_mp4
    from features.youtube.playlists import (
        add_video_to_playlist,
        create_playlist,
        delete_playlist,
        list_playlist_videos,
        list_playlists,
    )
    from features.youtube.transcript import build_transcript_markdown
    from features.youtube.upload import upload_file

    if operation == "health":
        return {
            "ok": True,
            "root": str(_resolve_root()),
            "python": sys.executable,
        }

    if operation == "get_config":
        config = load_config()
        return config.to_dict()

    if operation == "save_config":
        config = _config_from_payload(payload)
        ensure_directories(config)
        save_config(config)
        return config.to_dict()

    config = load_config()
    ensure_directories(config)

    if operation == "auth_status":
        return get_auth_status(config)
    if operation == "auth_oauth":
        return run_oauth_flow(config)
    if operation == "auth_refresh":
        ensure_token(config, force_refresh=True)
        return {"message": "Token refresh successful."}

    if operation == "list_channel_videos":
        return list_channel_videos(config)
    if operation == "delete_channel_video":
        video_id = _ensure_text(payload.get("videoId"), field_name="videoId")
        return {"deleted": bool(delete_channel_video(config, video_id))}

    if operation == "list_playlists":
        return list_playlists(config)
    if operation == "create_playlist":
        title = _ensure_text(payload.get("title"), field_name="title")
        description = str(payload.get("description", "")).strip()
        privacy = str(payload.get("privacyStatus", "unlisted")).strip() or "unlisted"
        return create_playlist(config, title=title, description=description, privacy_status=privacy)
    if operation == "delete_playlist":
        playlist_id = _ensure_text(payload.get("playlistId"), field_name="playlistId")
        return {"deleted": bool(delete_playlist(config, playlist_id))}
    if operation == "list_playlist_videos":
        playlist_id = _ensure_text(payload.get("playlistId"), field_name="playlistId")
        return list_playlist_videos(config, playlist_id)
    if operation == "add_video_to_playlist":
        playlist_id = _ensure_text(payload.get("playlistId"), field_name="playlistId")
        video_id = _ensure_text(payload.get("videoId"), field_name="videoId")
        add_video_to_playlist(config, playlist_id, video_id)
        return {"added": True}

    if operation == "upload_file":
        file_path = _ensure_text(payload.get("filePath"), field_name="filePath")
        title = str(payload.get("title", "")).strip() or Path(file_path).stem
        playlist_id = str(payload.get("playlistId", "")).strip()
        validate_upload_access(config)
        video_id = upload_file(config, file_path, title)
        if playlist_id:
            add_video_to_playlist(config, playlist_id, video_id)
        return {"videoId": video_id, "url": f"https://youtu.be/{video_id}"}

    if operation == "download_best_mp4":
        url = _ensure_text(payload.get("url"), field_name="url")
        output = download_best_mp4(config, url)
        return {"outputPath": str(output)}

    if operation == "fetch_video_chapters":
        source_url = _ensure_text(payload.get("sourceUrl"), field_name="sourceUrl")
        return fetch_video_chapters(config, source_url)

    if operation == "build_transcript_markdown":
        source = _ensure_text(payload.get("source"), field_name="source")
        languages = payload.get("languages")
        if isinstance(languages, list):
            normalized_languages = [str(item).strip() for item in languages if str(item).strip()]
        else:
            normalized_languages = None
        return build_transcript_markdown(source, normalized_languages)

    if operation == "fetch_channel_report":
        channel_url = _ensure_text(payload.get("channelUrl"), field_name="channelUrl")
        return fetch_and_export_channel_videos_markdown(config, channel_url)

    if operation == "cut_clips_local_mp4":
        source_path = _ensure_text(payload.get("sourcePath"), field_name="sourcePath")
        timestamps = payload.get("timestamps")
        if timestamps is None:
            raise RuntimeError("Missing required field: timestamps")
        output_dir = str(payload.get("outputDir", "")).strip() or None
        outputs = cut_clips_local_mp4(
            config,
            source_path,
            timestamps,
            output_dir=output_dir,
        )
        return {"count": len(outputs), "paths": [str(path) for path in outputs]}

    raise RuntimeError(f"Unsupported operation: {operation}")


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "Operation argument is required."}))
        return 1

    operation = str(sys.argv[1]).strip()
    try:
        _resolve_root()
        payload = _load_payload()
        result = _run(operation, payload)
        print(json.dumps({"ok": True, "data": _to_json_safe(result)}))
        return 0
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"ok": False, "error": str(exc)}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
