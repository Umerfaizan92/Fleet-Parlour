# Fleet Parlour Live Social Statistics

The website now contains a live social statistics system for Facebook, Instagram, TikTok and YouTube.

## What appears on the website

- Facebook followers and Page Likes
- Instagram followers and the sum of available post/media likes
- TikTok followers and total profile likes
- YouTube subscribers and the sum of public video likes
- Total social community (followers/subscribers from connected platforms)
- Total likes (the supported like metric from each connected platform added together)

The frontend reads only `/api/social-stats`. API credentials stay on the server and are never placed in public HTML or JavaScript.

## Automatic updates

The backend refreshes social statistics every 30 minutes by default and stores the latest snapshot in `backend/data/social-stats-cache.json`. The browser itself is told not to cache `/api/social-stats`, so all requests reach the backend cache rather than an old browser copy. On the first request after a backend restart, the social APIs are refreshed once so newly changed credentials are tested immediately.

Change the refresh interval with:

`SOCIAL_STATS_CACHE_MINUTES=30`

## Required environment variables

Edit `backend/.env` and fill only the variables for platforms you want to connect.

### Facebook

```
META_GRAPH_VERSION=
META_ACCESS_TOKEN=
FACEBOOK_PAGE_ID=
```

`META_ACCESS_TOKEN` is used only for Facebook. Use a Page/Meta token that is permitted to read the Page statistics.

### Instagram

```
INSTAGRAM_ACCESS_TOKEN=
INSTAGRAM_USER_ID=
```

The Instagram adapter uses the Instagram API host (`graph.instagram.com`) and keeps its token separate from Facebook. Use the access token generated for the Instagram professional account.

### TikTok

```
TIKTOK_ACCESS_TOKEN=
```

For TikTok API v2, this social-stats endpoint does **not** need a TikTok user ID or `open_id`. The user access token is sent as a Bearer token and identifies the authorised TikTok account. The authorisation must include `user.info.stats` to read `follower_count`, `likes_count` and `video_count`.

### YouTube

```
YOUTUBE_API_KEY=
YOUTUBE_CHANNEL_ID=
```

Use a YouTube Data API v3 key and the Fleet Parlour channel ID. The backend reads subscriber statistics and walks the channel's uploads playlist to total the like counts that YouTube exposes for public videos.

## Important metric note

Different social networks define "likes" differently. The website therefore totals the closest official account/content metric exposed by each connected platform:

- Facebook: Page Likes (`fan_count` when available)
- Instagram: sum of returned media/post `like_count`
- TikTok: account `likes_count` (likes received across videos)
- YouTube: sum of public video `likeCount`

This is a combined marketing metric, not a perfectly identical measurement across platforms.

## Test

1. Start Fleet Parlour with `START-FLEET-PARLOUR.bat`.
2. Open `http://localhost:3000/api/social-stats`. To force a fresh API check during setup, use `http://localhost:3000/api/social-stats?refresh=1`.
3. Connected platforms should show `available: true`.
4. Open `http://localhost:3000/` and scroll to **Follow Fleet Parlour**.

If a platform is not configured, the website shows an em dash (`—`) instead of inventing a number.
