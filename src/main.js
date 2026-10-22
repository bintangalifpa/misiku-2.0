import { App } from '@capacitor/app';
import { S, save, onSave, dkey, getLog } from './store.js';
import { initNotifications, ensurePermissions, rescheduleAll, exactAlarmOk, isNative, snooze } from './notify.js';
import { initUI, render, go, toast, fixLocation, showAlarm, setExactState, handleBack } from './ui.js';

let timer = null;
const schedSoon = () => { clearTimeout(timer); timer = setTimeout(() => rescheduleAll(), 1200); };
onSave(schedSoon);

// Dipanggil saat notifikasi/tombol aksinya ditekan
function onAction(ev) {
  const ex = (ev.notification && ev.notification.extra) || {};
  const act = ev.actionId;
  if (ex.type === 'test') { showAlarm(ex.idx ?? 2, ex.date); return; }
  if (ex.type === 'prayer') {
    if (act === 'DONE') { getLog(ex.date || dkey(new Date())).p[ex.idx] = 1; save(); toast('Sholat tercentang'); go('home'); return; }
    if (act === 'SNOOZE') { snooze(ex.idx, 10); toast('Diingatkan lagi 10 menit lagi'); go('home'); return; }
    showAlarm(ex.idx, ex.date); return;
  }
  if (ex.type === 'habit') {
    if (act === 'CHECK') { getLog(ex.date || dkey(new Date())).h[ex.habitId] = 1; save(); toast('Habit tercentang'); }
    go('home'); return;
  }
  if (ex.type === 'weight') { go('weight'); return; }
  if (ex.type === 'task') { go('tasks'); return; }
  if (ex.type === 'class') { go('schedule'); return; }
}

async function refreshState() {
  if (!isNative()) return;
  setExactState(await exactAlarmOk());
  if (S.settings.useLocation) await fixLocation(true);
  schedSoon();
}

// Intro animasi: foto muncul, riak, sapaan; ketuk untuk melewati
function runSplash() {
  const sp = document.getElementById('splash'); if (!sp) return;
  const nm = document.getElementById('sp-name'); if (nm) nm.textContent = `Halo, ${S.settings.name || 'kamu'}`;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let gone = false;
  const hide = () => {
    if (gone) return; gone = true; clearTimeout(timer);
    sp.classList.add('out'); render(true); // layar depan "masuk" bersamaan dengan intro keluar
    setTimeout(() => sp.remove(), 700);
  };
  const timer = setTimeout(hide, reduce ? 600 : 2500);
  sp.addEventListener('click', hide);
}

async function start() {
  runSplash();
  initUI();
  await initNotifications(onAction);
  if (isNative()) {
    await ensurePermissions();
    if (!S.settings.locAsked) { S.settings.locAsked = true; save(); }
    await refreshState();
    render();
    App.addListener('appStateChange', ({ isActive }) => { if (isActive) { refreshState().then(() => render()); } });
    App.addListener('backButton', () => { if (!handleBack()) App.exitApp(); });
  }
}
start();
