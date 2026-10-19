const loginScreen = document.querySelector('#login-screen');
const dashboard = document.querySelector('#dashboard');
const toast = document.querySelector('#toast');
let toastTimer;
let refreshTimer;
let latestStatus;

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && url !== '/api/login') {
    showLogin();
    throw new Error('A munkamenet lejart. Jelentkezz be ujra.');
  }
  if (!response.ok) throw new Error(data.error || 'A muvelet nem sikerult.');
  return data;
}

function notify(message, isError = false) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.classList.add('visible');
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 3000);
}

function showLogin() {
  clearInterval(refreshTimer);
  loginScreen.hidden = false;
  dashboard.hidden = true;
  document.querySelector('#password').focus();
}

function showDashboard() {
  loginScreen.hidden = true;
  dashboard.hidden = false;
  refreshStatus();
  clearInterval(refreshTimer);
  refreshTimer = setInterval(refreshStatus, 3000);
}

function setDot(element, mode) {
  element.classList.toggle('online', mode === 'online');
  element.classList.toggle('live', mode === 'live');
}

function renderStatus(status) {
  latestStatus = status;
  const mode = status.live ? 'live' : status.running ? 'online' : 'offline';
  const serverTitle = status.live ? 'Élő adás fut' : status.running ? 'Szerver fut' : 'Szerver leállítva';
  const serverDetail = status.live ? 'A stream jelenleg fogadja a közvetítést.' : status.running ? 'Várakozás a közvetítő csatlakozására.' : 'Indítsd el a szervert a közvetítés fogadásához.';

  document.querySelector('#status-title').textContent = serverTitle;
  document.querySelector('#status-detail').textContent = serverDetail;
  document.querySelector('#toggle-label').textContent = status.running ? 'Leállítás' : 'Indítás';
  document.querySelector('#rtmp-port').textContent = status.rtmpPort;
  document.querySelector('#metric-live').textContent = status.live ? 'Élő' : 'Offline';
  document.querySelector('#metric-live-note').textContent = status.live ? 'Közvetítés érkezik' : status.running ? 'Várakozás a közvetítőre' : 'A szerver jelenleg áll';
  document.querySelector('#metric-host').textContent = status.publicHost || 'Nincs megadva';
  document.querySelector('#server-url').textContent = status.serverUrl || 'Állíts be publikus hostnevet';
  document.querySelector('#stream-key').textContent = status.streamKey;
  if (document.activeElement !== document.querySelector('#public-host')) {
    document.querySelector('#public-host').value = status.publicHost;
  }
  document.querySelector('#live-indicator').classList.toggle('active', status.live);
  document.querySelector('#live-indicator').innerHTML = status.live ? '<i></i> ÉLŐ' : '<i></i> NINCS ADÁS';
  document.querySelector('#status-icon').classList.toggle('online', status.running && !status.live);
  document.querySelector('#status-icon').classList.toggle('live', status.live);
  document.querySelector('#health-label').textContent = status.live ? 'Élő közvetítés' : status.running ? 'Szerver aktív' : 'Szerver inaktív';
  document.querySelector('#header-status').textContent = status.running ? 'AKTÍV' : 'LEÁLLÍTVA';
  document.querySelector('#header-status').classList.toggle('online', status.running);
  document.querySelector('#sidebar-status').textContent = status.running ? status.live ? 'Élő közvetítés' : 'Szerver aktív' : 'Szerver leállítva';
  setDot(document.querySelector('#health-dot'), mode);
  setDot(document.querySelector('#sidebar-status-dot'), mode);
}

async function refreshStatus() {
  try {
    renderStatus(await api('/api/status'));
  } catch (error) {
    if (dashboard.hidden) return;
    document.querySelector('#health-label').textContent = 'Nem érhető el';
    notify(error.message, true);
  }
}

document.querySelector('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button');
  const errorMessage = document.querySelector('#login-error');
  button.disabled = true;
  errorMessage.textContent = '';
  try {
    await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({ password: document.querySelector('#password').value }),
    });
    document.querySelector('#password').value = '';
    showDashboard();
  } catch (error) {
    errorMessage.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

document.querySelector('#server-toggle').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    await api(latestStatus.running ? '/api/server/stop' : '/api/server/start', { method: 'POST' });
    await refreshStatus();
    notify(latestStatus.running ? 'Az RTMP szerver elindult.' : 'Az RTMP szerver leállt.');
  } catch (error) {
    notify(error.message, true);
  } finally {
    button.disabled = false;
  }
});

document.querySelector('#host-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await api('/api/settings', {
      method: 'POST',
      body: JSON.stringify({ publicHost: document.querySelector('#public-host').value }),
    });
    await refreshStatus();
    notify('A publikus hostnév elmentve.');
  } catch (error) {
    notify(error.message, true);
  }
});

document.querySelector('#rotate-key').addEventListener('click', async () => {
  if (!window.confirm('Biztosan új streamkulcsot generálsz? A régi kulcs azonnal érvénytelenné válik.')) return;
  try {
    await api('/api/stream-key/regenerate', { method: 'POST' });
    await refreshStatus();
    notify('Új streamkulcs készült.');
  } catch (error) {
    notify(error.message, true);
  }
});

document.querySelectorAll('[data-copy]').forEach((button) => {
  button.addEventListener('click', async () => {
    const value = document.querySelector(`#${button.dataset.copy}`).textContent;
    if (!value || value.startsWith('Állíts be')) return notify('Előbb adj meg egy publikus hostnevet.', true);
    try {
      await navigator.clipboard.writeText(value);
      notify(button.dataset.copy === 'stream-key' ? 'Streamkulcs másolva.' : 'Szervercím másolva.');
    } catch {
      notify('A vágólap nem érhető el ezen a kapcsolaton.', true);
    }
  });
});

document.querySelector('#logout-button').addEventListener('click', async () => {
  try {
    await api('/api/logout', { method: 'POST' });
  } finally {
    showLogin();
  }
});

api('/api/session')
  .then((session) => session.authenticated ? showDashboard() : showLogin())
  .catch(() => showLogin());
