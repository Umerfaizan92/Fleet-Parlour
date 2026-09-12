import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_TTL_MS = 30 * 60 * 1000;

function asInt(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null;
}

function sumInts(values) {
  let total = 0;
  let found = false;

  for (const value of values) {
    const n = asInt(value);

    if (n !== null) {
      total += n;
      found = true;
    }
  }

  return found ? total : null;
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    const text = await response.text();

    let data = {};

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      const message =
        data?.error?.message ||
        data?.message ||
        `${response.status} ${response.statusText}`;

      throw new Error(message);
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

function platformResult({
  configured,
  followers = null,
  likes = null,
  extra = {},
  error = null
}) {
  return {
    configured,
    available: configured && error === null,
    followers: asInt(followers),
    likes: asInt(likes),
    ...extra,
    ...(error ? { error } : {})
  };
}

/* =========================================================
   YOUTUBE
========================================================= */

async function getYouTube(env) {
  const apiKey = String(env.YOUTUBE_API_KEY || '').trim();
  const channelId = String(env.YOUTUBE_CHANNEL_ID || '').trim();

  if (!apiKey || !channelId) {
    return platformResult({ configured: false });
  }

  try {
    const channelUrl = new URL(
      'https://www.googleapis.com/youtube/v3/channels'
    );

    channelUrl.searchParams.set('part', 'statistics,contentDetails');
    channelUrl.searchParams.set('id', channelId);
    channelUrl.searchParams.set('key', apiKey);

    const channelData = await fetchJson(channelUrl);
    const channel = channelData.items?.[0];

    if (!channel) {
      throw new Error('YouTube channel not found');
    }

    const followers = channel.statistics?.hiddenSubscriberCount
      ? null
      : channel.statistics?.subscriberCount;

    const uploadsPlaylist =
      channel.contentDetails?.relatedPlaylists?.uploads;

    let likes = 0;
    let hasLikes = false;

    if (uploadsPlaylist) {
      let pageToken = '';

      do {
        const playlistUrl = new URL(
          'https://www.googleapis.com/youtube/v3/playlistItems'
        );

        playlistUrl.searchParams.set('part', 'contentDetails');
        playlistUrl.searchParams.set(
          'playlistId',
          uploadsPlaylist
        );
        playlistUrl.searchParams.set('maxResults', '50');
        playlistUrl.searchParams.set('key', apiKey);

        if (pageToken) {
          playlistUrl.searchParams.set(
            'pageToken',
            pageToken
          );
        }

        const playlistData = await fetchJson(playlistUrl);

        const ids = (playlistData.items || [])
          .map(item => item.contentDetails?.videoId)
          .filter(Boolean);

        if (ids.length) {
          const videosUrl = new URL(
            'https://www.googleapis.com/youtube/v3/videos'
          );

          videosUrl.searchParams.set('part', 'statistics');
          videosUrl.searchParams.set('id', ids.join(','));
          videosUrl.searchParams.set('key', apiKey);

          const videosData = await fetchJson(videosUrl);

          for (const item of videosData.items || []) {
            const count = asInt(
              item.statistics?.likeCount
            );

            if (count !== null) {
              likes += count;
              hasLikes = true;
            }
          }
        }

        pageToken = playlistData.nextPageToken || '';
      } while (pageToken);
    }

    return platformResult({
      configured: true,
      followers,
      likes: hasLikes ? likes : null,
      extra: {
        followers_label: 'Subscribers',
        likes_label: 'Video Likes',
        videos: asInt(
          channel.statistics?.videoCount
        )
      }
    });
  } catch (err) {
    return platformResult({
      configured: true,
      error: err.message
    });
  }
}

/* =========================================================
   TIKTOK
========================================================= */

async function getTikTok(env) {
  const token = String(
    env.TIKTOK_ACCESS_TOKEN || ''
  ).trim();

  if (!token) {
    return platformResult({ configured: false });
  }

  try {
    const url = new URL(
      'https://open.tiktokapis.com/v2/user/info/'
    );

    url.searchParams.set(
      'fields',
      'follower_count,likes_count,video_count'
    );

    const data = await fetchJson(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const tiktokError = data?.error;
    if (tiktokError && tiktokError.code !== 'ok' && tiktokError.code !== 0) {
      throw new Error(tiktokError.message || String(tiktokError.code));
    }

    const user = data.data?.user || {};

    return platformResult({
      configured: true,
      followers: user.follower_count,
      likes: user.likes_count,
      extra: {
        followers_label: 'Followers',
        likes_label: 'Total Likes',
        videos: asInt(user.video_count)
      }
    });
  } catch (err) {
    return platformResult({
      configured: true,
      error: err.message
    });
  }
}

/* =========================================================
   META / FACEBOOK
========================================================= */

function metaBase(env) {
  const version = String(
    env.META_GRAPH_VERSION || ''
  )
    .trim()
    .replace(/^v/i, 'v');

  return version
    ? `https://graph.facebook.com/${version}`
    : 'https://graph.facebook.com';
}

/* =========================================================
   INSTAGRAM
   IMPORTANT:
   Instagram now uses INSTAGRAM_ACCESS_TOKEN separately.
========================================================= */

async function getInstagram(env) {
  const token = String(
    env.INSTAGRAM_ACCESS_TOKEN || ''
  ).trim();

  const userId = String(
    env.INSTAGRAM_USER_ID || ''
  ).trim();

  if (!token || !userId) {
    return platformResult({
      configured: false
    });
  }

  try {
    const base = 'https://graph.instagram.com';

    const profileUrl = new URL(
      `${base}/${encodeURIComponent(userId)}`
    );

    profileUrl.searchParams.set(
      'fields',
      'followers_count,media_count'
    );

    profileUrl.searchParams.set(
      'access_token',
      token
    );

    const profile = await fetchJson(profileUrl);

    let likes = 0;
    let hasLikes = false;

    let next = new URL(
      `${base}/${encodeURIComponent(userId)}/media`
    );

    next.searchParams.set(
      'fields',
      'id,like_count'
    );

    next.searchParams.set('limit', '100');

    next.searchParams.set(
      'access_token',
      token
    );

    while (next) {
      const page = await fetchJson(next);

      for (const media of page.data || []) {
        const count = asInt(
          media.like_count
        );

        if (count !== null) {
          likes += count;
          hasLikes = true;
        }
      }

      next = page.paging?.next
        ? new URL(page.paging.next)
        : null;
    }

    return platformResult({
      configured: true,
      followers: profile.followers_count,
      likes: hasLikes ? likes : null,
      extra: {
        followers_label: 'Followers',
        likes_label: 'Post Likes',
        media_count: asInt(
          profile.media_count
        )
      }
    });
  } catch (err) {
    return platformResult({
      configured: true,
      error: err.message
    });
  }
}

/* =========================================================
   FACEBOOK
========================================================= */

async function getFacebook(env) {
  const token = String(
    env.META_ACCESS_TOKEN || ''
  ).trim();

  const pageId = String(
    env.FACEBOOK_PAGE_ID || ''
  ).trim();

  if (!token || !pageId) {
    return platformResult({
      configured: false
    });
  }

  try {
    const base = metaBase(env);

    const url = new URL(
      `${base}/${encodeURIComponent(pageId)}`
    );

    url.searchParams.set(
      'fields',
      'followers_count,fan_count'
    );

    url.searchParams.set(
      'access_token',
      token
    );

    const page = await fetchJson(url);

    return platformResult({
      configured: true,
      followers:
        page.followers_count ??
        page.fan_count,
      likes: page.fan_count,
      extra: {
        followers_label: 'Followers',
        likes_label: 'Page Likes'
      }
    });
  } catch (err) {
    return platformResult({
      configured: true,
      error: err.message
    });
  }
}

/* =========================================================
   TOTALS
========================================================= */

function computeTotals(platforms) {
  return {
    followers: sumInts(
      Object.values(platforms).map(
        platform => platform.followers
      )
    ),

    likes: sumInts(
      Object.values(platforms).map(
        platform => platform.likes
      )
    )
  };
}

/* =========================================================
   SOCIAL STATS SERVICE
========================================================= */

export function createSocialStatsService(
  env,
  backendRoot
) {
  const cacheFile = path.join(
    backendRoot,
    'data',
    'social-stats-cache.json'
  );

  const ttlMs = Math.max(
    5 * 60 * 1000,
    Number(
      env.SOCIAL_STATS_CACHE_MINUTES || 30
    ) *
      60 *
      1000
  );

  let memory = null;
  let loadedFromDisk = false;

  try {
    if (fs.existsSync(cacheFile)) {
      memory = JSON.parse(
        fs.readFileSync(
          cacheFile,
          'utf8'
        )
      );
      loadedFromDisk = true;
    }
  } catch {}

  async function refresh() {
    const [
      facebook,
      instagram,
      tiktok,
      youtube
    ] = await Promise.all([
      getFacebook(env),
      getInstagram(env),
      getTikTok(env),
      getYouTube(env)
    ]);

    const platforms = {
      facebook,
      instagram,
      tiktok,
      youtube
    };

    const fresh = {
      ok: true,
      updated_at:
        new Date().toISOString(),
      cache_minutes:
        Math.round(ttlMs / 60000),
      platforms,
      totals:
        computeTotals(platforms)
    };

    const anyAvailable =
      Object.values(platforms).some(
        platform => platform.available
      );

    if (anyAvailable || !memory) {
      memory = fresh;

      try {
        fs.mkdirSync(
          path.dirname(cacheFile),
          { recursive: true }
        );

        fs.writeFileSync(
          cacheFile,
          JSON.stringify(
            fresh,
            null,
            2
          )
        );
      } catch {}
    } else if (memory) {
      return {
        ...memory,
        stale: true,
        refresh_errors: platforms
      };
    }

    return fresh;
  }

  async function get({
    force = false
  } = {}) {
    const age =
      memory?.updated_at
        ? Date.now() -
          new Date(
            memory.updated_at
          ).getTime()
        : Infinity;

    // A server restart often follows a credential/configuration change.
    // Refresh once on the first request after startup instead of blindly
    // serving an on-disk cache that may have been created with old tokens.
    if (loadedFromDisk) {
      loadedFromDisk = false;
      return refresh();
    }

    if (
      !force &&
      memory &&
      age < ttlMs
    ) {
      return {
        ...memory,
        cached: true
      };
    }

    return refresh();
  }

  return {
    get,
    refresh
  };
}