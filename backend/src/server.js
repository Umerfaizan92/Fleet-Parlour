import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { z } from 'zod';
import { createDb } from './db.js';
import { sendEnquiryNotification } from './mailer.js';
import { createSocialStatsService } from './social-stats.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..');
const siteRoot = path.resolve(backendRoot, '..');
dotenv.config({ path: path.join(backendRoot, '.env') });

const env = process.env;
const port = Number(env.PORT || 3000);

const databasePath = path.isAbsolute(env.DATABASE_PATH || '')
  ? env.DATABASE_PATH
  : path.resolve(
      backendRoot,
      env.DATABASE_PATH || './data/fleet-parlour.sqlite'
    );

const db = createDb(databasePath);
const socialStats = createSocialStatsService(env, backendRoot);

const uploadRoot = path.isAbsolute(env.UPLOAD_DIR || '')
  ? env.UPLOAD_DIR
  : path.resolve(
      backendRoot,
      env.UPLOAD_DIR || './data/uploads'
    );

const maxFileMb = Number(env.MAX_FILE_MB || 8);
const maxFiles = Number(env.MAX_FILES || 10);

fs.mkdirSync(uploadRoot, { recursive: true });

const allowedOrigins = String(env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(v => v.trim())
  .filter(Boolean);

/*
|--------------------------------------------------------------------------
| TikTok Login Kit / OAuth
|--------------------------------------------------------------------------
|
| Add these values to backend/.env:
|
| TIKTOK_CLIENT_KEY=
| TIKTOK_CLIENT_SECRET=
| TIKTOK_REDIRECT_URI=https://YOUR-PUBLIC-HTTPS-DOMAIN/api/tiktok/callback
| TIKTOK_SCOPES=user.info.basic,user.info.stats
|
| Tokens are saved privately in:
| backend/data/tiktok-oauth.json
|
*/

const tiktokTokenPath =
  path.join(backendRoot, 'data', 'tiktok-oauth.json');

const tiktokOauthStates = new Map();

const TIKTOK_AUTHORIZE_URL =
  'https://www.tiktok.com/v2/auth/authorize/';

const TIKTOK_TOKEN_URL =
  'https://open.tiktokapis.com/v2/oauth/token/';

const TIKTOK_REFRESH_EARLY_MS =
  20 * 60 * 1000;

const TIKTOK_STATE_TTL_MS =
  10 * 60 * 1000;

function readTikTokTokenState() {
  try {
    if (!fs.existsSync(tiktokTokenPath)) {
      return null;
    }

    const parsed = JSON.parse(
      fs.readFileSync(tiktokTokenPath, 'utf8')
    );

    return parsed && typeof parsed === 'object'
      ? parsed
      : null;

  } catch (err) {
    console.error(
      '[tiktok-oauth] Unable to read token store:',
      err.message
    );

    return null;
  }
}

let tiktokTokenState =
  readTikTokTokenState();

if (tiktokTokenState?.access_token) {
  env.TIKTOK_ACCESS_TOKEN =
    tiktokTokenState.access_token;
}

function saveTikTokTokenState(tokenResponse) {
  const now = Date.now();

  const previous =
    tiktokTokenState || {};

  const expiresIn =
    Number(tokenResponse.expires_in || 0);

  const refreshExpiresIn =
    Number(tokenResponse.refresh_expires_in || 0);

  const next = {
    access_token:
      tokenResponse.access_token ||
      previous.access_token ||
      '',

    refresh_token:
      tokenResponse.refresh_token ||
      previous.refresh_token ||
      '',

    open_id:
      tokenResponse.open_id ||
      previous.open_id ||
      '',

    scope:
      tokenResponse.scope ||
      previous.scope ||
      '',

    token_type:
      tokenResponse.token_type ||
      previous.token_type ||
      'Bearer',

    expires_at:
      expiresIn > 0
        ? now + expiresIn * 1000
        : previous.expires_at || null,

    refresh_expires_at:
      refreshExpiresIn > 0
        ? now + refreshExpiresIn * 1000
        : previous.refresh_expires_at || null,

    updated_at:
      new Date(now).toISOString()
  };

  fs.mkdirSync(
    path.dirname(tiktokTokenPath),
    { recursive: true }
  );

  fs.writeFileSync(
    tiktokTokenPath,
    JSON.stringify(next, null, 2),
    { mode: 0o600 }
  );

  try {
    fs.chmodSync(
      tiktokTokenPath,
      0o600
    );
  } catch {}

  tiktokTokenState = next;

  if (next.access_token) {
    env.TIKTOK_ACCESS_TOKEN =
      next.access_token;
  }

  return next;
}

function cleanupTikTokOauthStates() {
  const now = Date.now();

  for (
    const [state, expiresAt]
    of tiktokOauthStates.entries()
  ) {
    if (expiresAt <= now) {
      tiktokOauthStates.delete(state);
    }
  }
}

function tiktokConfig() {
  return {
    clientKey:
      String(
        env.TIKTOK_CLIENT_KEY || ''
      ).trim(),

    clientSecret:
      String(
        env.TIKTOK_CLIENT_SECRET || ''
      ).trim(),

    redirectUri:
      String(
        env.TIKTOK_REDIRECT_URI || ''
      ).trim(),

    scopes:
      String(
        env.TIKTOK_SCOPES ||
        'user.info.basic,user.info.stats'
      )
        .split(',')
        .map(v => v.trim())
        .filter(Boolean)
  };
}

function assertTikTokOauthConfigured() {
  const cfg = tiktokConfig();

  if (
    !cfg.clientKey ||
    !cfg.clientSecret ||
    !cfg.redirectUri
  ) {
    const err = new Error(
      'TikTok OAuth is not configured. Set TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET and TIKTOK_REDIRECT_URI in backend/.env.'
    );

    err.statusCode = 503;

    throw err;
  }

  return cfg;
}

async function postTikTokToken(body) {
  const response =
    await fetch(
      TIKTOK_TOKEN_URL,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/x-www-form-urlencoded',

          'Cache-Control':
            'no-cache'
        },

        body:
          new URLSearchParams(body)
      }
    );

  let data;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (
    !response.ok ||
    !data?.access_token
  ) {
    const message =
      data?.error_description ||
      data?.error ||
      `TikTok token request failed with HTTP ${response.status}`;

    const err =
      new Error(message);

    err.statusCode = 502;

    throw err;
  }

  return data;
}

async function refreshTikTokAccessToken() {
  const cfg =
    assertTikTokOauthConfigured();

  const refreshToken =
    tiktokTokenState?.refresh_token;

  if (!refreshToken) {
    return null;
  }

  const data =
    await postTikTokToken({
      client_key:
        cfg.clientKey,

      client_secret:
        cfg.clientSecret,

      grant_type:
        'refresh_token',

      refresh_token:
        refreshToken
    });

  saveTikTokTokenState(data);

  console.log(
    '[tiktok-oauth] Access token refreshed successfully.'
  );

  return data.access_token;
}

async function ensureTikTokAccessToken() {
  if (
    !tiktokTokenState?.access_token
  ) {
    return (
      env.TIKTOK_ACCESS_TOKEN ||
      null
    );
  }

  const expiresAt =
    Number(
      tiktokTokenState.expires_at || 0
    );

  if (
    !expiresAt ||
    Date.now() <
      expiresAt -
        TIKTOK_REFRESH_EARLY_MS
  ) {
    env.TIKTOK_ACCESS_TOKEN =
      tiktokTokenState.access_token;

    return (
      tiktokTokenState.access_token
    );
  }

  try {
    return await
      refreshTikTokAccessToken();

  } catch (err) {
    console.error(
      '[tiktok-oauth] Token refresh failed:',
      err.message
    );

    env.TIKTOK_ACCESS_TOKEN =
      tiktokTokenState.access_token;

    return (
      tiktokTokenState.access_token
    );
  }
}

/*
|--------------------------------------------------------------------------
| Express
|--------------------------------------------------------------------------
*/

const app = express();

app.set('trust proxy', 1);

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: 'cross-origin'
    },

    contentSecurityPolicy: {
      directives: {

        defaultSrc: [
          "'self'"
        ],

        baseUri: [
          "'self'"
        ],

        fontSrc: [
          "'self'",
          'data:',
          'https://fonts.gstatic.com',
          'https://cdnjs.cloudflare.com'
        ],

        formAction: [
          "'self'",
          'https://www.tiktok.com'
        ],

        frameAncestors: [
          "'self'"
        ],

        frameSrc: [
          "'self'",
          'https://www.youtube.com',
          'https://youtube.com'
        ],

        imgSrc: [
          "'self'",
          'data:',
          'blob:',
          'https://i.ytimg.com',
          'https://img.youtube.com'
        ],

        objectSrc: [
          "'none'"
        ],

        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://cdn.jsdelivr.net'
        ],

        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://cdn.jsdelivr.net',
          'https://fonts.googleapis.com',
          'https://cdnjs.cloudflare.com'
        ],

        connectSrc: [
          "'self'",
          'https://api.fleetparlour.com.au'
        ],

        upgradeInsecureRequests:
          null
      }
    }
  })
);

app.use(
  cors({
    origin(origin, cb) {

      if (
        !origin ||
        allowedOrigins.length === 0 ||
        allowedOrigins.includes(origin)
      ) {
        return cb(null, true);
      }

      return cb(
        new Error(
          'Origin not allowed'
        )
      );
    },

    methods: [
      'GET',
      'POST',
      'OPTIONS'
    ]
  })
);

app.use(
  express.json({
    limit: '1mb'
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: '1mb'
  })
);

app.use(
  '/api/',
  rateLimit({
    windowMs:
      15 * 60 * 1000,

    limit:
      40,

    standardHeaders:
      true,

    legacyHeaders:
      false
  })
);

/*
|--------------------------------------------------------------------------
| Static website
|--------------------------------------------------------------------------
*/

app.use(
  express.static(
    siteRoot,
    {
      extensions: ['html'],
      index: 'index.html'
    }
  )
);

/*
|--------------------------------------------------------------------------
| Upload configuration
|--------------------------------------------------------------------------
*/

const storage =
  multer.diskStorage({

    destination(
      req,
      file,
      cb
    ) {
      const enquiryId =
        req.enquiryId ||
        crypto.randomUUID();

      req.enquiryId =
        enquiryId;

      const dir =
        path.join(
          uploadRoot,
          enquiryId
        );

      fs.mkdirSync(
        dir,
        {
          recursive: true
        }
      );

      cb(
        null,
        dir
      );
    },

    filename(
      req,
      file,
      cb
    ) {
      const ext =
        path
          .extname(
            file.originalname || ''
          )
          .toLowerCase()
          .slice(0, 10);

      cb(
        null,
        `${crypto.randomUUID()}${ext}`
      );
    }
  });

const upload =
  multer({
    storage,

    limits: {
      fileSize:
        maxFileMb *
        1024 *
        1024,

      files:
        maxFiles
    },

    fileFilter(
      req,
      file,
      cb
    ) {
      const allowed = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/heic',
        'image/heif'
      ];

      if (
        !allowed.includes(
          file.mimetype
        )
      ) {
        return cb(
          new Error(
            'Only JPG, PNG, WEBP, HEIC or HEIF images are allowed.'
          )
        );
      }

      cb(
        null,
        true
      );
    }
  });

/*
|--------------------------------------------------------------------------
| Enquiry validation
|--------------------------------------------------------------------------
*/

const schema =
  z.object({

    full_name:
      z.string()
        .trim()
        .min(2)
        .max(120),

    phone:
      z.string()
        .trim()
        .min(6)
        .max(40),

    email:
      z.string()
        .trim()
        .email()
        .max(160),

    suburb_postcode:
      z.string()
        .trim()
        .min(2)
        .max(120),

    service_address:
      z.string()
        .trim()
        .max(220)
        .optional()
        .default(''),

    vehicle_type:
      z.string()
        .trim()
        .min(2)
        .max(120),

    make_model:
      z.string()
        .trim()
        .max(120)
        .optional()
        .default(''),

    registration:
      z.string()
        .trim()
        .max(40)
        .optional()
        .default(''),

    service_required:
      z.string()
        .trim()
        .min(2)
        .max(160),

    parts_to_polish:
      z.string()
        .trim()
        .min(2)
        .max(500),

    condition:
      z.string()
        .trim()
        .min(2)
        .max(160),

    preferred_date:
      z.string()
        .trim()
        .max(40)
        .optional()
        .default(''),

    job_details:
      z.string()
        .trim()
        .max(4000)
        .optional()
        .default(''),

    power_available:
      z.string()
        .trim()
        .min(2)
        .max(80),

    covered_work_area:
      z.string()
        .trim()
        .max(120)
        .optional()
        .default(''),

    privacy_consent:
      z.union([
        z.literal('Yes'),
        z.literal('on'),
        z.literal('true')
      ]),

    website:
      z.string()
        .max(0)
        .optional()
        .default('')
  });

function cleanupUploaded(
  files = []
) {
  for (const f of files) {
    try {
      fs.unlinkSync(f.path);
    } catch {}
  }
}

/*
|--------------------------------------------------------------------------
| Health
|--------------------------------------------------------------------------
*/

app.get(
  '/api/health',
  (req, res) => {

    res.json({
      ok: true,

      service:
        'fleet-parlour-enquiries',

      time:
        new Date()
          .toISOString()
    });
  }
);

/*
|--------------------------------------------------------------------------
| TikTok OAuth login
|--------------------------------------------------------------------------
*/

app.get(
  '/api/tiktok/login',
  (req, res) => {

    try {
      const cfg =
        assertTikTokOauthConfigured();

      cleanupTikTokOauthStates();

      const state =
        crypto
          .randomBytes(32)
          .toString('hex');

      tiktokOauthStates.set(
        state,
        Date.now() +
          TIKTOK_STATE_TTL_MS
      );

      const url =
        new URL(
          TIKTOK_AUTHORIZE_URL
        );

      url.searchParams.set(
        'client_key',
        cfg.clientKey
      );

      url.searchParams.set(
        'scope',
        cfg.scopes.join(',')
      );

      url.searchParams.set(
        'response_type',
        'code'
      );

      url.searchParams.set(
        'redirect_uri',
        cfg.redirectUri
      );

      url.searchParams.set(
        'state',
        state
      );

      return res.redirect(
        url.toString()
      );

    } catch (err) {

      console.error(
        '[tiktok-oauth] Login start failed:',
        err.message
      );

      return res
        .status(
          err.statusCode || 500
        )
        .send(
          `TikTok authorization could not start: ${err.message}`
        );
    }
  }
);

/*
|--------------------------------------------------------------------------
| TikTok OAuth callback
|--------------------------------------------------------------------------
*/

app.get(
  '/api/tiktok/callback',
  async (req, res) => {

    try {
      const cfg =
        assertTikTokOauthConfigured();

      cleanupTikTokOauthStates();

      if (req.query.error) {

        const detail =
          String(
            req.query.error_description ||
            req.query.error ||
            'TikTok authorization was declined.'
          );

        return res
          .status(400)
          .send(
            `TikTok authorization failed: ${detail}`
          );
      }

      const code =
        String(
          req.query.code || ''
        );

      const state =
        String(
          req.query.state || ''
        );

      const expiresAt =
        tiktokOauthStates.get(
          state
        );

      if (!code) {
        return res
          .status(400)
          .send(
            'TikTok authorization failed: missing authorization code.'
          );
      }

      if (
        !state ||
        !expiresAt ||
        expiresAt <= Date.now()
      ) {
        if (state) {
          tiktokOauthStates.delete(
            state
          );
        }

        return res
          .status(400)
          .send(
            'TikTok authorization failed: invalid or expired state. Please start the login again.'
          );
      }

      tiktokOauthStates.delete(
        state
      );

      const data =
        await postTikTokToken({

          client_key:
            cfg.clientKey,

          client_secret:
            cfg.clientSecret,

          code,

          grant_type:
            'authorization_code',

          redirect_uri:
            cfg.redirectUri
        });

      const saved =
        saveTikTokTokenState(
          data
        );

      console.log(
        `[tiktok-oauth] Connected open_id=${saved.open_id || 'unknown'} scopes=${saved.scope || 'unknown'}`
      );

      return res
        .status(200)
        .type('html')
        .send(`
<!doctype html>

<html lang="en">

<head>

<meta charset="utf-8">

<meta
name="viewport"
content="width=device-width,initial-scale=1"
>

<title>
TikTok Connected - Fleet Parlour
</title>

<style>

body {
  font-family: Arial, sans-serif;
  background: #111;
  color: #fff;
  display: grid;
  place-items: center;
  min-height: 100vh;
  margin: 0;
  padding: 24px;
}

main {
  max-width: 620px;
  background: #1c1c1c;
  border: 1px solid #444;
  border-radius: 16px;
  padding: 32px;
  text-align: center;
}

h1 {
  margin-top: 0;
}

a {
  color: #fff;
}

</style>

</head>

<body>

<main>

<h1>
TikTok connected successfully
</h1>

<p>
Fleet Parlour has authorized TikTok Login Kit.
</p>

<p>
You can now close this page or check the social statistics endpoint.
</p>

<p>
<a href="/api/social-stats?refresh=1">
Check social statistics
</a>
</p>

</main>

</body>

</html>
        `);

    } catch (err) {

      console.error(
        '[tiktok-oauth] Callback failed:',
        err
      );

      return res
        .status(
          err.statusCode || 500
        )
        .send(
          `TikTok authorization failed: ${err.message}`
        );
    }
  }
);

/*
|--------------------------------------------------------------------------
| TikTok connection status
|--------------------------------------------------------------------------
*/

app.get(
  '/api/tiktok/status',
  (req, res) => {

    const cfg =
      tiktokConfig();

    const state =
      tiktokTokenState;

    res.set(
      'Cache-Control',
      'no-store'
    );

    res.json({

      ok: true,

      oauth_configured:
        Boolean(
          cfg.clientKey &&
          cfg.clientSecret &&
          cfg.redirectUri
        ),

      connected:
        Boolean(
          state?.access_token ||
          env.TIKTOK_ACCESS_TOKEN
        ),

      scope:
        state?.scope ||
        null,

      access_token_expires_at:
        state?.expires_at
          ? new Date(
              state.expires_at
            ).toISOString()
          : null,

      refresh_token_expires_at:
        state?.refresh_expires_at
          ? new Date(
              state.refresh_expires_at
            ).toISOString()
          : null
    });
  }
);

/*
|--------------------------------------------------------------------------
| Social statistics
|--------------------------------------------------------------------------
*/

app.get(
  '/api/social-stats',
  async (req, res) => {

    try {

      await ensureTikTokAccessToken();

      const force =
        req.query.refresh === '1' ||
        req.query.refresh === 'true';

      const stats =
        await socialStats.get({
          force
        });

      res.set(
        'Cache-Control',
        'no-store'
      );

      return res.json(
        stats
      );

    } catch (err) {

      console.error(
        '[social-stats]',
        err
      );

      return res
        .status(503)
        .json({
          ok: false,
          error:
            'Social statistics are temporarily unavailable.'
        });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Enquiries
|--------------------------------------------------------------------------
*/

app.post(
  '/api/enquiries',
  (req, res) => {

    req.enquiryId =
      crypto.randomUUID();

    console.log(
      `[enquiry] Incoming request ${req.enquiryId} from ${req.get('origin') || 'same-origin/direct'}`
    );

    upload.array(
      'job_photos',
      maxFiles
    )(
      req,
      res,
      async uploadErr => {

        if (uploadErr) {

          console.error(
            `[enquiry] Upload rejected ${req.enquiryId}:`,
            uploadErr.message
          );

          cleanupUploaded(
            req.files
          );

          return res
            .status(400)
            .json({
              ok: false,
              error:
                uploadErr.message
            });
        }

        const parsed =
          schema.safeParse(
            req.body
          );

        if (!parsed.success) {

          console.error(
            `[enquiry] Validation failed ${req.enquiryId}:`,
            parsed.error
              .flatten()
              .fieldErrors
          );

          cleanupUploaded(
            req.files
          );

          return res
            .status(400)
            .json({
              ok: false,

              error:
                'Please check the form fields.',

              details:
                parsed.error
                  .flatten()
                  .fieldErrors
            });
        }

        if (
          !req.files ||
          req.files.length < 1
        ) {

          console.error(
            `[enquiry] No photos ${req.enquiryId}`
          );

          return res
            .status(400)
            .json({
              ok: false,
              error:
                'Please attach at least one job photo.'
            });
        }

        const id =
          req.enquiryId;

        const referenceCode =
          `FP-${id
            .replaceAll('-', '')
            .slice(0, 8)
            .toUpperCase()}`;

        const createdAt =
          new Date()
            .toISOString();

        const e =
          parsed.data;

        const insertEnquiry =
          db.prepare(`
            INSERT INTO enquiries (
              id,
              reference_code,
              created_at,
              source,
              full_name,
              phone,
              email,
              suburb_postcode,
              service_address,
              vehicle_type,
              make_model,
              registration,
              service_required,
              parts_to_polish,
              condition,
              preferred_date,
              job_details,
              power_available,
              covered_work_area,
              privacy_consent
            )
            VALUES (
              @id,
              @reference_code,
              @created_at,
              'website',
              @full_name,
              @phone,
              @email,
              @suburb_postcode,
              @service_address,
              @vehicle_type,
              @make_model,
              @registration,
              @service_required,
              @parts_to_polish,
              @condition,
              @preferred_date,
              @job_details,
              @power_available,
              @covered_work_area,
              1
            )
          `);

        const insertPhoto =
          db.prepare(`
            INSERT INTO enquiry_photos (
              enquiry_id,
              original_name,
              stored_name,
              mime_type,
              size_bytes,
              relative_path,
              created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `);

        const transaction =
          db.transaction(
            () => {

              insertEnquiry.run({
                id,

                reference_code:
                  referenceCode,

                created_at:
                  createdAt,

                ...e
              });

              for (
                const file
                of req.files
              ) {

                const relative =
                  path
                    .relative(
                      uploadRoot,
                      file.path
                    )
                    .replaceAll(
                      '\\',
                      '/'
                    );

                insertPhoto.run(
                  id,
                  file.originalname,
                  file.filename,
                  file.mimetype,
                  file.size,
                  relative,
                  createdAt
                );
              }
            }
          );

        try {

          transaction();

          const mail =
            await sendEnquiryNotification(
              env,
              {
                id,

                reference_code:
                  referenceCode,

                ...e
              },

              req.files
            )
            .catch(
              err => ({
                sent: false,
                reason:
                  err.message
              })
            );

          console.log(
            `[enquiry] Saved ${id} with ${req.files.length} photo(s). Email: ${
              mail.sent === true
                ? 'sent'
                : 'not sent (' +
                  (
                    mail.reason ||
                    'unknown'
                  ) +
                  ')'
            }`
          );

          return res
            .status(201)
            .json({

              ok: true,

              enquiry_id:
                id,

              reference_code:
                referenceCode,

              email_notification:
                mail.sent === true
            });

        } catch (err) {

          cleanupUploaded(
            req.files
          );

          console.error(
            err
          );

          return res
            .status(500)
            .json({

              ok: false,

              error:
                'Unable to save your enquiry right now. Please call or WhatsApp Fleet Parlour.'
            });
        }
      }
    );
  }
);

/*
|--------------------------------------------------------------------------
| Admin authentication
|--------------------------------------------------------------------------
*/

function requireAdmin(
  req,
  res,
  next
) {

  const expected =
    env.ADMIN_API_KEY;

  const provided =
    req.get(
      'x-admin-key'
    );

  if (
    !expected ||
    !provided
  ) {
    return res
      .status(401)
      .json({
        ok: false,
        error:
          'Unauthorized'
      });
  }

  const a =
    Buffer.from(
      provided
    );

  const b =
    Buffer.from(
      expected
    );

  if (
    a.length !== b.length ||
    !crypto.timingSafeEqual(
      a,
      b
    )
  ) {
    return res
      .status(401)
      .json({
        ok: false,
        error:
          'Unauthorized'
      });
  }

  next();
}

/*
|--------------------------------------------------------------------------
| Admin enquiry routes
|--------------------------------------------------------------------------
*/

app.get(
  '/api/admin/enquiries',
  requireAdmin,
  (req, res) => {

    const rows =
      db.prepare(`
        SELECT *
        FROM enquiries
        ORDER BY created_at DESC
        LIMIT 200
      `)
      .all();

    res.json({
      ok: true,
      enquiries: rows
    });
  }
);

app.get(
  '/api/admin/enquiries/:id',
  requireAdmin,
  (req, res) => {

    const enquiry =
      db.prepare(`
        SELECT *
        FROM enquiries
        WHERE id = ?
      `)
      .get(
        req.params.id
      );

    if (!enquiry) {

      return res
        .status(404)
        .json({
          ok: false,
          error:
            'Not found'
        });
    }

    const photos =
      db.prepare(`
        SELECT
          id,
          original_name,
          mime_type,
          size_bytes,
          created_at
        FROM enquiry_photos
        WHERE enquiry_id = ?
        ORDER BY id
      `)
      .all(
        req.params.id
      );

    res.json({
      ok: true,
      enquiry,
      photos
    });
  }
);

app.get(
  '/api/admin/enquiries/:id/photos/:photoId',
  requireAdmin,
  (req, res) => {

    const photo =
      db.prepare(`
        SELECT *
        FROM enquiry_photos
        WHERE id = ?
        AND enquiry_id = ?
      `)
      .get(
        req.params.photoId,
        req.params.id
      );

    if (!photo) {

      return res
        .status(404)
        .json({
          ok: false,
          error:
            'Not found'
        });
    }

    const full =
      path.join(
        uploadRoot,
        photo.relative_path
      );

    if (
      !fs.existsSync(full)
    ) {

      return res
        .status(404)
        .json({
          ok: false,
          error:
            'File missing'
        });
    }

    res
      .type(
        photo.mime_type
      )
      .sendFile(
        full
      );
  }
);

/*
|--------------------------------------------------------------------------
| Start server
|--------------------------------------------------------------------------
*/

app.listen(
  port,
  () => {

    console.log(
      `Fleet Parlour website + enquiry backend running on http://localhost:${port}`
    );

    console.log(
      `Open the contact form at http://localhost:${port}/contact.html`
    );

    console.log(
      `TikTok OAuth status: http://localhost:${port}/api/tiktok/status`
    );
  }
);