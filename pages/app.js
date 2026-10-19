const roomStorageKey = 'signalroom-phone-room';
const preview = document.querySelector('#preview');
const previewEmpty = document.querySelector('#preview-empty');
const toast = document.querySelector('#toast');
let toastTimer;

function createRoomId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function roomId() {
  let id = sessionStorage.getItem(roomStorageKey);
  if (!id) {
    id = createRoomId();
    sessionStorage.setItem(roomStorageKey, id);
  }
  return id;
}

function urlsFor(id) {
  return {
    phone: `https://vdo.ninja/?push=${id}`,
    obs: `https://vdo.ninja/?view=${id}&cleanoutput`,
  };
}

function renderLinks() {
  const urls = urlsFor(roomId());
  document.querySelector('#phone-link').textContent = urls.phone;
  document.querySelector('#obs-link').textContent = urls.obs;
  document.querySelector('#open-phone').href = urls.phone;
  if (!preview.hidden) preview.src = urls.obs;
}

function notify(message, isError = false) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.classList.add('visible');
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2600);
}

document.querySelector('#preview-toggle').addEventListener('click', (event) => {
  const button = event.currentTarget;
  if (preview.hidden) {
    preview.src = urlsFor(roomId()).obs;
    preview.hidden = false;
    previewEmpty.hidden = true;
    button.setAttribute('aria-label', 'Előnézet bezárása');
    button.title = 'Előnézet bezárása';
    button.innerHTML = '<span aria-hidden="true">×</span>';
  } else {
    preview.src = 'about:blank';
    preview.hidden = true;
    previewEmpty.hidden = false;
    button.setAttribute('aria-label', 'Előnézet megnyitása');
    button.title = 'Előnézet megnyitása';
    button.innerHTML = '<span aria-hidden="true">↗</span>';
  }
});

document.querySelector('#new-room').addEventListener('click', () => {
  if (!window.confirm('Új kapcsolatot hozol létre? A régi telefonos és OBS-linkek érvényüket vesztik.')) return;
  sessionStorage.setItem(roomStorageKey, createRoomId());
  renderLinks();
  notify('Új privát kapcsolat létrehozva.');
});

document.querySelector('#share-phone').addEventListener('click', async () => {
  const phoneUrl = urlsFor(roomId()).phone;
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Telefonkamera kapcsolat', url: phoneUrl });
    } else {
      await navigator.clipboard.writeText(phoneUrl);
      notify('A telefonos link a vágólapra került.');
    }
  } catch (error) {
    if (error.name !== 'AbortError') notify('Nem sikerült megosztani a linket.', true);
  }
});

document.querySelectorAll('[data-copy]').forEach((button) => {
  button.addEventListener('click', async () => {
    const value = document.querySelector(`#${button.dataset.copy}`).textContent;
    try {
      await navigator.clipboard.writeText(value);
      notify(button.dataset.copy === 'phone-link' ? 'Telefonos link másolva.' : 'OBS-link másolva.');
    } catch {
      notify('A vágólap nem érhető el ezen a kapcsolaton.', true);
    }
  });
});

renderLinks();