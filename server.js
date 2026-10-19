const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const NodeMediaServer = require('node-media-server');

const app = express();
const port = Number(process.env.PORT || 3000);
const rtmpPort = Number(process.env.RTMP_PORT || 1935);
const httpFlvPort = Number(process.env.HTTP_FLV_PORT || 8000);
const dashboardOrigin = (process.env.DASHBOARD_ORIGIN || '').replace(/\/$/, '');
const cookieSameSite = process.env.DASHBOARD_COOKIE_SAME_SITE || 'Strict';
const httpFlvPublicUrl = (process.env.HTTP_FLV_PUBLIC_URL || '').replace(/\/$/, '');
const dataDirectory = path.join(__dirname, 'data');
const statePath = path.join(dataDirectory, 'state.json');
const sessions = new Set();
const loginAttempts = new Map();
const dashboardPassword = process.env.DASHBOARD_PASSWORD || crypto.randomBytes(18).toString('base64url');

if (!['Strict', 'Lax', 'None'].includes(cookieSameSite)) {
  throw new Error('DASHBOARD_COOKIE_SAME_SITE must be Strict, Lax, or None.');
}

fs.mkdirSync(dataDirectory, { recursive: true });

let savedState = {};
try {
  savedState = JSON.parse(fs.readFileSync(statePath, 'utf8'));
} catch {
  savedState = {};
}

const state = {
  streamKey: savedState.streamKey || crypto.randomBytes(18).toString('base64url'),
  publicHost: process.env.PUBLIC_HOST || savedState.publicHost || '',
  running: false,
  live: false,
  startedAt: null,
  lastError: null,
};

function persistState() {
  fs.writeFileSync(statePath, JSON.stringify({
    streamKey: state.streamKey,
    publicHost: state.publicHost,
  }, null, 2));
}

function cookieValue(request, name) {
  const cookies = request.headers.cookie || '';
  const entry = cookies.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : '';
}

function isAuthenticated(request) {
  return sessions.has(cookieValue(request, 'rtmp_session'));
}

function requireAuthentication(request, response, next) {
  if (!isAuthenticated(request)) {
    return response.status(401).json({ error: 'Bejelentkezes szukseges.' });
  }
  next();
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function createMediaServer() {
  const mediaServer = new NodeMediaServer({
    logType: 2,
    rtmp: {
      port: rtmpPort,
      chunk_size: 60000,
      gop_cache: true,
      ping: 30,
      ping_timeout: 60,
    },
    http: {
      port: httpFlvPort,
      allow_origin: '*',
    },
  });

  mediaServer.on('prePublish', (id, streamPath) => {
    if (streamPath !== `/live/${state.streamKey}`) {
      mediaServer.getSession(id)?.reject();
      console.warn(`Rejected RTMP publish attempt for ${streamPath}`);
    }
  });
  mediaServer.on('postPublish', () => { state.live = true; });
  mediaServer.on('donePublish', () => { state.live = false; });

  mediaServer.run();
  state.running = true;
  state.startedAt = new Date().toISOString();
  state.lastError = null;
  return mediaServer;
}

let mediaServer;

function startMediaServer() {
  if (state.running) return;
  mediaServer = createMediaServer();
}

function stopMediaServer() {
  if (!state.running || !mediaServer) return;
  mediaServer.stop();
  mediaServer = null;
  state.running = false;
  state.live = false;
  state.startedAt = null;
}

app.use(express.json({ limit: '10kb' }));
app.use('/api', (request, response, next) => {
  const origin = request.get('Origin');
  if (dashboardOrigin && origin === dashboardOrigin) {
    response.setHeader('Access-Control-Allow-Origin', dashboardOrigin);
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Vary', 'Origin');
  } else if (dashboardOrigin && origin) {
    return response.status(403).json({ error: 'Ez a weboldal nem jogosult az API elérésére.' });
  }

  if (request.method === 'OPTIONS') {
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return response.sendStatus(204);
  }
  next();
});
app.get('/vendor/flv.min.js', (request, response) => {
  response.sendFile(path.join(__dirname, 'node_modules/flv.js/dist/flv.min.js'));
});
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/session', (request, response) => {
  response.json({ authenticated: isAuthenticated(request) });
});

app.post('/api/login', (request, response) => {
  const address = request.ip;
  const now = Date.now();
  const attempt = loginAttempts.get(address);
  if (attempt && attempt.blockedUntil > now) {
    return response.status(429).json({ error: 'Tul sok probalkozas. Probald ujra 15 perc mulva.' });
  }

  const submittedPassword = typeof request.body?.password === 'string' ? request.body.password : '';
  if (!safeEqual(submittedPassword, dashboardPassword)) {
    const failures = (attempt?.failures || 0) + 1;
    loginAttempts.set(address, {
      failures: failures >= 5 ? 0 : failures,
      blockedUntil: failures >= 5 ? now + 15 * 60 * 1000 : 0,
    });
    return response.status(401).json({ error: 'Hibas jelszo.' });
  }

  loginAttempts.delete(address);
  const sessionId = crypto.randomBytes(32).toString('base64url');
  sessions.add(sessionId);
  const secure = process.env.DASHBOARD_COOKIE_SECURE === 'true' || cookieSameSite === 'None' ? '; Secure' : '';
  response.setHeader('Set-Cookie', `rtmp_session=${sessionId}; HttpOnly; SameSite=${cookieSameSite}; Path=/; Max-Age=43200${secure}`);
  response.json({ authenticated: true });
});

app.post('/api/logout', (request, response) => {
  sessions.delete(cookieValue(request, 'rtmp_session'));
  const secure = process.env.DASHBOARD_COOKIE_SECURE === 'true' || cookieSameSite === 'None' ? '; Secure' : '';
  response.setHeader('Set-Cookie', `rtmp_session=; HttpOnly; SameSite=${cookieSameSite}; Path=/; Max-Age=0${secure}`);
  response.json({ authenticated: false });
});

app.use('/api', requireAuthentication);

app.get('/api/status', (request, response) => {
  response.json({
    running: state.running,
    live: state.live,
    startedAt: state.startedAt,
    lastError: state.lastError,
    rtmpPort,
    httpFlvPort,
    publicHost: state.publicHost,
    streamKey: state.streamKey,
    serverUrl: state.publicHost ? `rtmp://${state.publicHost}:${rtmpPort}/live` : '',
    previewUrl: `${httpFlvPublicUrl || `http://${state.publicHost || request.hostname}:${httpFlvPort}`}/live/${state.streamKey}.flv`,
  });
});

app.post('/api/server/start', (request, response) => {
  try {
    startMediaServer();
    response.json({ running: state.running });
  } catch (error) {
    state.lastError = error.message;
    response.status(500).json({ error: `Nem sikerult elinditani az RTMP szervert: ${error.message}` });
  }
});

app.post('/api/server/stop', (request, response) => {
  try {
    stopMediaServer();
    response.json({ running: state.running });
  } catch (error) {
    response.status(500).json({ error: `Nem sikerult leallitani az RTMP szervert: ${error.message}` });
  }
});

app.post('/api/stream-key/regenerate', (request, response) => {
  state.streamKey = crypto.randomBytes(18).toString('base64url');
  persistState();
  response.json({ streamKey: state.streamKey });
});

app.post('/api/settings', (request, response) => {
  const publicHost = typeof request.body?.publicHost === 'string' ? request.body.publicHost.trim() : '';
  const validHost = /^(?=.{1,253}$)[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/;
  if (publicHost && !validHost.test(publicHost)) {
    return response.status(400).json({ error: 'Adj meg ervenyes publikus hostnevet vagy IPv4 cimet, port es protokoll nelkul.' });
  }

  state.publicHost = publicHost;
  persistState();
  response.json({ publicHost: state.publicHost });
});

persistState();

const webServer = app.listen(port, '0.0.0.0', () => {
  console.log(`RTMP Control Room: http://localhost:${port}`);
  if (!process.env.DASHBOARD_PASSWORD) {
    console.log(`Dashboard password: ${dashboardPassword}`);
  }
});

try {
  startMediaServer();
} catch (error) {
  state.lastError = error.message;
  console.error(`RTMP server failed to start: ${error.message}`);
}

function shutdown() {
  stopMediaServer();
  webServer.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
