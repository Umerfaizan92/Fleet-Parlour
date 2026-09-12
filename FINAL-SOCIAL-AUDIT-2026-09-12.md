# Fleet Parlour Final Social/API Audit — 12 Sep 2026

This build was reviewed as a complete project.

## Confirmed
- Facebook and Instagram use separate environment variables/tokens.
- Instagram uses `https://graph.instagram.com`.
- TikTok API v2 uses `TIKTOK_ACCESS_TOKEN` only for the `/v2/user/info/` call; a TikTok ID/open_id is not required for request authentication. The token must have `user.info.stats`.
- YouTube uses `YOUTUBE_API_KEY` + `YOUTUBE_CHANNEL_ID`.
- `/api/social-stats?refresh=1` forces a fresh social API check for setup/testing.
- Browser caching was disabled for the social-stats API because the backend already manages its own refresh cache.
- The first social-stats request after a backend restart refreshes the APIs instead of blindly serving an old disk cache.
- TikTok API-body errors are now detected even if TikTok returns an HTTP-success response.
- Null social values are no longer accidentally converted to zero.

## Credentials
The ZIP intentionally does not manufacture or replace credentials. Enter the real private credentials only in `backend/.env`. Do not put tokens/keys in public HTML or JavaScript.

## Facebook
If Facebook reports `Session has expired`, the code is correctly reaching Meta but the Facebook token itself needs to be renewed/replaced. This cannot be fixed by JavaScript code alone.
