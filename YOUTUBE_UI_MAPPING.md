# YouTube Mapping (desktop-app)

## What Mapped Directly To Existing UI

- `Download` subtab: maps to `download_best_mp4`.
- `Fetch` subtab: maps to `fetch_and_export_channel_videos_markdown`.
- `Upload` subtab: maps to `upload_file` and playlist operations.
- `Edit` subtab: maps to local clipping (`cut_clips_local_mp4`) plus chapter/transcript helpers.
- `Settings` subtab: maps to auth/config/channel-management operations.

The existing YouTube subtab structure (`Download`, `Fetch`, `Upload`, `Edit`, `Settings`) already matched the Python feature split, so no navigation changes were required.

## UI Gaps That Needed To Be Added

- Real forms/inputs for each operation (previously placeholders).
- Backend connectivity status and error display.
- Playlist create/delete controls.
- Channel video refresh/delete controls.
- Config path editing + save.
- Auth actions (`Refresh`, `Launch OAuth`, `Force Refresh Token`).
- Download/fetch/edit result output areas.

## Backend Surface Added

The JS backend now exposes `/api/youtube/*` routes backed by the Python feature set:

- Health/config/auth
- Channel video list/delete
- Playlist list/create/delete/add video
- Upload
- Download
- Chapter fetch
- Transcript markdown
- Channel fetch + markdown export
- Local clip creation

## Still Missing (Future UI Enhancements)

- Multi-file batch upload picker (currently file path input).
- Playlist video URL viewer in React UI.
- Rich chapter multi-select UI for clip creation (current UI converts all fetched chapters to JSON payload).
- Download sidecar metadata log presentation similar to the Qt app.
