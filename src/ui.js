// Tampilan seluruh layar. Gaya mengikuti desain v5 (oranye, biru tua, krem).
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import {
  S, save, replaceAll, DAYS, DAYS3, MONTHS, MON3, PRAYERS, COLORS, CITIES, dkey, parseKey, addDays, mondayOf, hm, uid, fmtKg, esc,
  getLog, peekLog, habitsOn, streak, bestStreak, weekClasses, classesOn, saveClass, deleteClass, nearestCity,
} from './store.js';
import { timesFor, METHODS } from './prayer.js';
import { snooze, testNow, isNative, exactAlarmOk, openExactAlarmSettings, ensurePermissions, rescheduleAll } from './notify.js';

// ---------- ikon
const svg = (p, s = 22, sw = 2.2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const shuri = (s, cls = '') => `<svg class="${cls}" width="${s}" height="${s}" viewBox="0 0 100 100" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M50 2 L61 39 L98 50 L61 61 L50 98 L39 61 L2 50 L39 39 Z M50 42 a8 8 0 1 0 0.01 0 Z"/></svg>`;
const rings = (s = 120) => `<svg class="rings" width="${s}" height="${s}" viewBox="0 0 100 100" aria-hidden="true" fill="none" stroke="#101B3A" stroke-width="3"><circle cx="50" cy="50" r="14"/><circle cx="50" cy="50" r="28"/><circle cx="50" cy="50" r="42"/></svg>`;
const I = {
  check: (s = 18) => svg('<path d="M5 12.5l4.5 4.5L19 7"/>', s, 3.2),
  back: svg('<path d="M15 6l-6 6 6 6"/>', 20, 2.6),
  next: svg('<path d="M9 6l6 6-6 6"/>', 20, 2.6),
  chev: svg('<path d="M9 6l6 6-6 6"/>', 20, 2.4),
  plus: (s = 20) => svg('<path d="M12 5v14M5 12h14"/>', s, 2.6),
  x: svg('<path d="M6 6l12 12M18 6L6 18"/>', 20, 2.6),
  edit: svg('<path d="M4 20h4L19 9l-4-4L4 16v4z"/>', 20),
  trash: svg('<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/>', 20),
  up: svg('<path d="M6 15l6-6 6 6"/>', 18, 2.6),
  down: svg('<path d="M6 9l6 6 6-6"/>', 18, 2.6),
  habit: svg('<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>', 24),
  tasks: svg('<path d="M10 6h10M10 12h10M10 18h10"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>', 24),
  cal: svg('<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>', 24),
  set: svg('<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>', 24),
  grid: svg('<rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/>', 18, 2.4),
  scale: svg('<rect x="4" y="4" width="16" height="16" rx="4.5"/><path d="M8.5 10a5 5 0 0 1 7 0"/><path d="M12 11.5l1.8-1.8"/>', 18, 2.4),
  pin: svg('<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>', 22),
  lock: svg('<rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', 22, 2.4),
  down2: svg('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', 22),
};

// ---------- keadaan layar
let R = { name: 'home' };
let M = null; // modal
let toastTimer = null;
let EX = { ok: true };
const $ = (s) => document.querySelector(s);

export const go = (name, p = {}) => { R = { name, ...p }; M = null; render(true); };
export function toast(msg) {
  document.querySelectorAll('.toast').forEach((n) => n.remove());
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.remove(), 3200);
}
export const showAlarm = (idx, date) => go('alarm', { idx, date });
export function setExactState(ok) { EX.ok = ok; }

const themeIsDark = () => S.settings.theme === 'dark' || (S.settings.theme === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
const applyTheme = () => { document.documentElement.dataset.theme = themeIsDark() ? 'dark' : 'light'; };

const sw = (on, act, extra = '', label = '') => `<button class="sw ${on ? 'on' : ''}" role="switch" aria-checked="${on}" aria-label="${esc(label)}" data-act="${act}" ${extra}><span><i></i></span></button>`;
const fmtT = (t) => t.replace(':', '.');
const todayDate = () => new Date();
const timeLeft = (d) => (d.getHours() === 23 && d.getMinutes() === 59 ? '23.59' : hm(d));

function relDate(d) {
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  const d0 = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((d0 - t0) / 86400000);
  if (diff === 0) return 'Hari ini';
  if (diff === 1) return 'Besok';
  if (diff === -1) return 'Kemarin';
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MON3[d.getMonth()]}`;
}

// ---------- navigasi bawah
const NAV_MAP = { home: 'home', recap: 'home', weight: 'home', tasks: 'tasks', schedule: 'schedule', settings: 'settings', reminders: 'settings', habits: 'settings' };
function nav() {
  const a = NAV_MAP[R.name];
  const b = (r, ic, label) => `<button class="${a === r ? 'on' : ''}" aria-label="${label}" ${a === r ? 'aria-current="page"' : ''} data-act="go" data-r="${r}">${ic}</button>`;
  return `<nav class="bottom">${b('home', I.habit, 'Habit')}${b('tasks', I.tasks, 'Tugas')}${b('schedule', I.cal, 'Jadwal')}${b('settings', I.set, 'Pengaturan')}</nav>`;
}
const backBtn = (r, cls = 'navy') => `<button class="ic ${cls}" aria-label="Kembali" data-act="go" data-r="${r}">${I.back}</button>`;

// ---------- layar: HOME (habit + ibadah)
function home() {
  const now = todayDate(); const k = dkey(now); const lg = getLog(k);
  const hs = habitsOn(now);
  const done = lg.p.filter(Boolean).length + hs.filter((h) => lg.h[h.id]).length; const total = 5 + hs.length;
  const pct = Math.round((done / total) * 100);
  const times = timesFor(now); const hl = S.settings.highlight;
  const prayers = PRAYERS.map((n, i) => {
    const on = !!lg.p[i]; const late = hl && !on && times[i] < now;
    return `<button class="prayer ${on ? 'on' : ''} ${late ? 'pending' : ''}" aria-label="${n}, ${on ? 'sudah' : 'belum'}" data-act="tgl-prayer" data-i="${i}"><span>${on ? I.check(18) : ''}</span><b>${n}</b><small>${hm(times[i])}</small></button>`;
  }).join('');
  const tiles = hs.map((h) => {
    const c = COLORS[h.color] || COLORS[0]; const on = !!lg.h[h.id]; const late = hl && !on;
    return `<div class="tile ${c.dark ? 'dk' : ''} ${late ? 'pending' : ''}" style="background:${c.bg};${c.dark ? 'color:var(--cream)' : ''}">
      <div class="row sb"><button class="chk ${on ? 'on' : ''}" aria-label="${esc(h.name)}, ${on ? 'sudah' : 'belum'}" data-act="tgl-habit" data-id="${h.id}"><span>${on ? I.check(17) : ''}</span></button><span class="chip streak">${streak(h)} hari</span></div>
      <div class="col"><span class="nm">${esc(h.name)}</span><span class="sub" style="color:${c.sub}">${esc(h.target)}</span></div></div>`;
  }).join('');
  return `
  <div class="hero">
    ${shuri(170, 'deco')}${rings()}
    <div class="row sb"><div class="col"><b style="font-size:14px">Halo, ${esc(S.settings.name)}</b><span style="font-size:13px;font-weight:500">${DAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]}</span></div><div class="avatar"><img src="face.jpg" alt=""></div></div>
    <h1 class="t1" style="margin-top:4px">Misi hari ini</h1>
    <div class="row" style="align-items:baseline;gap:6px"><span class="bigNum">${done}</span><span class="fred" style="font-size:22px;font-weight:600">/ ${total} misi selesai</span></div>
    <div class="col g6"><div class="bar"><i style="width:${pct}%"></i></div><span style="font-size:12px;font-weight:700">Chakra harian ${pct}%</span></div>
  </div>
  <div class="pad col g14">
    <div class="ncard col g6">
      <div class="row sb" style="padding:0 6px"><span class="t2" style="font-size:19px">Ibadah harian</span><span class="chip" style="background:var(--orange);color:var(--navy)">${lg.p.filter(Boolean).length}/5</span></div>
      <div class="row">${prayers}</div>
    </div>
    <div class="col g8">
      <div class="row g10"><button class="pill flex" data-act="go" data-r="recap">${I.grid}Rekap bulanan</button><button class="pill flex" data-act="go" data-r="weight">${I.scale}Berat badan</button></div>
      <div class="row sb" style="margin-top:6px"><span class="t2">Kebiasaan</span><button class="pill dark" data-act="habit-new">+ Tambah</button></div>
      ${hs.length ? `<div class="hits">${tiles}</div>` : '<div class="card empty">Belum ada kebiasaan untuk hari ini. Tekan "+ Tambah" untuk membuat yang baru.</div>'}
    </div>
  </div>`;
}

// ---------- layar: REKAP BULANAN
function recap() {
  const now = new Date(); const todayK = dkey(now);
  const ym = R.ym || todayK.slice(0, 7); const [y, m] = ym.split('-').map(Number);
  const first = new Date(y, m - 1, 1); const n = new Date(y, m, 0).getDate(); const off = (first.getDay() + 6) % 7;
  const cellsN = Math.ceil((off + n) / 7) * 7;
  const grid = (fn) => {
    let s = '';
    for (let i = 0; i < cellsN; i++) {
      const dnum = i - off + 1;
      if (dnum < 1 || dnum > n) { s += '<i></i>'; continue; }
      const date = new Date(y, m - 1, dnum); const k = dkey(date);
      s += `<i style="background:${fn(date, k)};${k === todayK ? 'box-shadow:inset 0 0 0 2px #fff' : ''}"></i>`;
    }
    return `<div class="hm">${s}</div>`;
  };
  // ibadah
  let full = 0;
  const ibadah = grid((d, k) => {
    if (d > now) return 'rgba(255,243,224,.05)';
    const c = peekLog(k).p.filter(Boolean).length; if (c === 5) full++;
    return c === 0 ? 'rgba(255,243,224,.12)' : c <= 2 ? '#7C4A1E' : c <= 4 ? '#D9660A' : '#FF9A3D';
  });
  // habit
  let sumDone = 0; let sumAll = 0;
  const cards = S.habits.map((h) => {
    const c = COLORS[h.color] || COLORS[0]; let dn = 0; let all = 0;
    const doneC = c.dark ? '#FFF3E0' : '#101B3A'; const missC = c.dark ? 'rgba(255,243,224,.14)' : 'rgba(16,27,58,.14)'; const futC = c.dark ? 'rgba(255,243,224,.05)' : 'rgba(16,27,58,.06)';
    const g = grid((d, k) => {
      if (d > now) return futC;
      if (!h.days.includes(d.getDay()) || k < h.created) return 'transparent';
      all++; if (peekLog(k).h[h.id]) { dn++; return doneC; } return missC;
    });
    sumDone += dn; sumAll += all;
    return `<div class="rc" style="background:${c.bg};${c.dark ? 'color:var(--cream)' : ''}"><span style="font-size:14px;font-weight:800">${esc(h.name)}</span>${g}<div class="ft" ${c.dark ? 'style="background:rgba(255,122,0,.28)"' : ''}>${dn} / ${all} hari</div></div>`;
  }).join('');
  const cons = sumAll ? Math.round((sumDone / sumAll) * 100) + '%' : '-';
  let best = { n: 0, name: '-' };
  for (const h of S.habits) { const b = bestStreak(h); if (b > best.n) best = { n: b, name: h.name }; }
  const isCur = ym === todayK.slice(0, 7);
  return `
  <div class="hero">
    ${shuri(170, 'deco')}
    <div class="row g10">${backBtn('home')}<h1 class="t1" style="font-size:30px">Rekap bulanan</h1></div>
    <div class="row sb"><button class="ic soft" aria-label="Bulan sebelumnya" data-act="ym" data-d="-1">${I.back}</button><span class="fred" style="font-size:19px;font-weight:600;background:var(--navy);color:var(--cream);padding:8px 22px;border-radius:22px">${MONTHS[m - 1]} ${y}</span><button class="ic soft" aria-label="Bulan berikutnya" data-act="ym" data-d="1">${I.next}</button></div>
    <div class="row g10" style="align-items:baseline"><span class="bigNum" style="font-size:54px">${cons}</span><span style="font-size:14px;font-weight:700;line-height:1.3">konsisten ${isCur ? 'bulan ini' : 'di bulan ini'}<br><span style="font-weight:500">rata-rata semua kebiasaan</span></span></div>
  </div>
  <div class="pad col g12">
    <div class="hits">
      <div class="rc nv"><span style="font-size:14px;font-weight:800">Ibadah harian</span>${ibadah}<div class="ft">Lengkap ${full} hari</div></div>
      ${cards}
      <div class="rc" style="background:var(--orange);justify-content:space-between;min-height:100px"><span style="font-size:14px;font-weight:800">Streak terbaik</span><div class="col"><span class="fred" style="font-size:56px;font-weight:700;line-height:1">${best.n}</span><span style="font-size:13px;font-weight:700">hari berturut-turut</span></div><span class="chip" style="background:var(--navy);color:var(--cream);align-self:flex-start;padding:6px 12px;border-radius:14px">${esc(best.name)}</span></div>
    </div>
    <p class="muted" style="font-size:12px;font-weight:600;text-align:center;padding:0 8px">Tiap kotak = 1 hari. Kolom dari Sen sampai Min. Kotak pekat = tercapai, pudar = terlewat, hampir hilang = belum tiba. Cincin putih = hari ini.</p>
  </div>`;
}

// ---------- layar: BERAT BADAN
function weight() {
  const ws = [...S.weights].sort((a, b) => a.d.localeCompare(b.d));
  const last = ws[ws.length - 1]; const firstAll = ws[0];
  const range = R.range || 30;
  const cut = range === 0 ? '0000-00-00' : dkey(addDays(new Date(), -(range - 1)));
  const pts = ws.filter((w) => w.d >= cut);
  const cur = last ? last.kg : null;
  const draft = R.draft ?? (cur ?? 60);
  const start = firstAll ? firstAll.kg : null; const goal = S.goalWeight;
  let pctG = 0; let leftTxt = '';
  if (cur !== null && start !== null && goal) {
    const tot = goal - start;
    pctG = tot === 0 ? 100 : Math.max(0, Math.min(100, Math.round(((cur - start) / tot) * 100)));
    leftTxt = `Target ${fmtKg(goal)} kg, tinggal ${fmtKg(Math.abs(goal - cur))} kg`;
  }
  const delta = cur !== null && start !== null ? cur - start : null;
  // grafik
  let chart = '<div class="empty">Belum ada catatan. Simpan berat hari ini di bawah.</div>';
  let axis = '';
  if (pts.length) {
    const vals = pts.map((p) => p.kg); let mn = Math.min(...vals); let mx = Math.max(...vals);
    if (mx - mn < 0.6) { const mid = (mx + mn) / 2; mn = mid - 0.3; mx = mid + 0.3; }
    mn -= 0.1; mx += 0.1;
    const t0 = parseKey(pts[0].d).getTime(); const t1 = parseKey(pts[pts.length - 1].d).getTime();
    const X = (d) => (t1 === t0 ? 165 : 10 + ((parseKey(d).getTime() - t0) / (t1 - t0)) * 310);
    const Y = (v) => 20 + ((mx - v) / (mx - mn)) * 110;
    const line = pts.map((p) => `${X(p.d).toFixed(1)},${Y(p.kg).toFixed(1)}`).join(' ');
    const lp = pts[pts.length - 1];
    const area = pts.length > 1 ? `<path d="M${line.split(' ').join(' L')} L${X(lp.d).toFixed(1)},130 L${X(pts[0].d).toFixed(1)},130 Z" fill="#C9D3FF" opacity=".6"/>` : '';
    chart = `<svg viewBox="0 0 330 150" width="100%" role="img" aria-label="Grafik berat badan" style="display:block">
      <g stroke="var(--line)" stroke-width="1.5" stroke-dasharray="4 5"><line x1="10" y1="20" x2="320" y2="20"/><line x1="10" y1="75" x2="320" y2="75"/><line x1="10" y1="130" x2="320" y2="130"/></g>
      ${area}<polyline points="${line}" fill="none" stroke="var(--ink)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${X(lp.d).toFixed(1)}" cy="${Y(lp.kg).toFixed(1)}" r="7" fill="#FF7A00" stroke="var(--ink)" stroke-width="3"/>
      <g font-size="10" font-weight="700" fill="var(--muted)"><text x="10" y="14">${fmtKg(mx)}</text><text x="10" y="69">${fmtKg((mx + mn) / 2)}</text><text x="10" y="124">${fmtKg(mn)}</text></g></svg>`;
    const f = parseKey(pts[0].d); const l = parseKey(lp.d);
    axis = `<div class="row sb muted" style="font-size:12px;font-weight:700;padding:0 4px"><span>${f.getDate()} ${MON3[f.getMonth()]}</span><span>${l.getDate()} ${MON3[l.getMonth()]}</span></div>`;
  }
  const hist = [...ws].reverse().slice(0, 6).map((w, i, arr) => {
    const older = ws[ws.length - 1 - i - 1]; const dl = older ? w.kg - older.kg : null; const d = parseKey(w.d);
    const chip = dl === null ? '' : `<span class="chip" style="background:${dl <= 0 ? '#BEE8D5;color:#0F4A35' : '#FFD9B8;color:#7A2E00'}">${dl > 0 ? '+' : ''}${fmtKg(dl)}</span>`;
    return `<div class="card row sb" style="border-radius:22px;min-height:60px;padding:0 16px"><div class="col"><b style="font-size:15px;font-weight:800">${fmtKg(w.kg)} kg</b><span class="muted" style="font-size:12px;font-weight:600">${DAYS[d.getDay()]}, ${d.getDate()} ${MON3[d.getMonth()]}</span></div>${chip}</div>`;
  }).join('');
  const seg = (v, t) => `<button class="pill ${range === v ? 'dark' : ''}" style="${range === v ? '' : 'background:var(--soft)'}" data-act="wrange" data-v="${v}">${t}</button>`;
  return `
  <div class="hero yellow">
    ${shuri(170, 'deco')}
    <div class="row g10">${backBtn('home')}<h1 class="t1" style="font-size:30px">Berat badan</h1></div>
    <div class="row sb" style="align-items:flex-end"><div class="row" style="align-items:baseline;gap:6px"><span class="bigNum" style="font-size:56px">${cur === null ? '-' : fmtKg(cur)}</span><span class="fred" style="font-size:22px;font-weight:600">kg</span></div>
      ${delta !== null ? `<span class="chip" style="background:var(--navy);color:var(--cream);font-size:13px;padding:6px 12px;border-radius:14px">${delta > 0 ? '+' : ''}${fmtKg(delta)} kg sejak awal</span>` : ''}</div>
    <div class="col g6"><div class="bar"><i style="width:${pctG}%"></i></div>
      <button class="row sb" style="font-size:12px;font-weight:700;text-align:left;min-height:32px" data-act="goal-edit"><span>${start !== null ? 'Awal ' + fmtKg(start) + ' kg' : 'Belum ada data'}</span><span>${leftTxt || 'Atur target'} (ubah)</span></button></div>
  </div>
  <div class="pad col g12">
    <div class="card col g10" style="border-radius:28px;padding:14px 14px 12px"><div class="row g8">${seg(7, '7 hari')}${seg(30, '30 hari')}${seg(0, 'Semua')}</div>${chart}${axis}</div>
    <div class="ncard row sb" style="padding:12px 12px 12px 18px;border-radius:28px;gap:10px">
      <div class="col"><span style="font-size:12px;font-weight:700;color:#AEB8E0">Catat hari ini</span>
        <div class="row g6"><button class="ic" style="background:rgba(255,243,224,.15);color:var(--cream);font-size:22px;font-weight:800" aria-label="Kurangi 0,1 kg" data-act="wstep" data-d="-0.1">-</button><span class="fred" style="font-size:24px;font-weight:600;min-width:84px;text-align:center">${fmtKg(draft)} kg</span><button class="ic" style="background:rgba(255,243,224,.15);color:var(--cream);font-size:22px;font-weight:800" aria-label="Tambah 0,1 kg" data-act="wstep" data-d="0.1">+</button></div></div>
      <button class="pill orange" style="min-height:52px;border-radius:26px;padding:0 22px;font-size:14px" data-act="wsave">Simpan</button>
    </div>
    <div class="col g8"><span class="t2">Riwayat</span>${hist || '<div class="card empty">Riwayat akan muncul di sini.</div>'}</div>
  </div>`;
}

// ---------- layar: TUGAS
function tasks() {
  const f = R.filter || 'all'; const now = new Date();
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()); const t1 = addDays(t0, 1); const t2 = addDays(t0, 2); const t7 = addDays(t0, 7);
  const open = S.tasks.filter((t) => !t.done).sort((a, b) => a.due.localeCompare(b.due));
  const dueD = (t) => new Date(t.due);
  const cToday = open.filter((t) => dueD(t) < t1).length;
  const cTom = open.filter((t) => dueD(t) >= t1 && dueD(t) < t2).length;
  const cWeek = open.filter((t) => dueD(t) >= t2 && dueD(t) < t7).length;
  let list = open;
  if (f === 'today') list = open.filter((t) => dueD(t) < t1);
  if (f === 'upcoming') list = open.filter((t) => dueD(t) >= t1);
  if (f === 'done') list = S.tasks.filter((t) => t.done).sort((a, b) => b.due.localeCompare(a.due));
  const PRI = { h: ['Tinggi', 'h'], m: ['Sedang', 'm'], l: ['Rendah', 'l'] };
  const row = (t, i) => {
    const d = dueD(t); const late = !t.done && d < now;
    const urgent = !t.done && f === 'all' && i === 0;
    const p = PRI[t.pri] || PRI.m;
    return `<div class="trow ${t.done ? 'done' : ''} ${urgent ? 'urgent' : ''}"><button class="tc" aria-label="${t.done ? 'Batalkan selesai' : 'Tandai selesai'}: ${esc(t.title)}" data-act="tgl-task" data-id="${t.id}"><span>${t.done ? I.check(16) : ''}</span></button>
      <button class="col" style="flex:1;gap:2px;text-align:left" data-act="task-edit" data-id="${t.id}">${urgent ? '<span style="font-size:11px;font-weight:800;letter-spacing:.5px">PALING MENDESAK</span>' : ''}<span class="tn" ${urgent ? 'style="font-family:Fredoka,sans-serif;font-size:19px;font-weight:600"' : ''}>${esc(t.title)}</span><span class="td" ${late ? 'style="color:#C0391F;font-weight:800"' : ''}>${late ? 'Terlambat, ' : ''}${relDate(d)}, ${timeLeft(d)}</span></button>
      <span class="pri ${p[1]}">${p[0]}</span></div>`;
  };
  const chip = (v, t) => `<button class="pill ${f === v ? 'dark' : ''}" data-act="tfilter" data-v="${v}">${t}</button>`;
  const stat = (n, t, bg, sub) => `<div style="flex:1;background:${bg};border-radius:20px;padding:10px 12px;color:var(--navy);display:flex;flex-direction:column"><span class="fred" style="font-size:28px;font-weight:700;line-height:1.1">${n}</span><span style="font-size:12px;font-weight:700;color:${sub}">${t}</span></div>`;
  return `
  <div class="hero navy">
    ${shuri(150, 'deco')}
    <div class="col" style="gap:2px"><span style="font-size:14px;font-weight:600;color:#AEB8E0">${open.length} misi belum selesai</span><h1 class="t1" style="font-size:32px">Daftar misi</h1></div>
    <div class="row g10">${stat(cToday, 'Hari ini', '#C9D3FF', '#2B3A78')}${stat(cTom, 'Besok', '#FFD66B', '#5C4400')}${stat(cWeek, 'Minggu ini', '#FFC2A1', '#6B2A00')}</div>
  </div>
  <div class="pad col g12">
    <div class="row g8" style="overflow-x:auto">${chip('all', 'Semua')}${chip('today', 'Hari ini')}${chip('upcoming', 'Mendatang')}${chip('done', 'Selesai')}</div>
    <div class="col g10">${list.length ? list.map(row).join('') : '<div class="card empty">Belum ada misi di sini. Tekan tombol + untuk menambah.</div>'}</div>
  </div>
  <button class="ic orange" style="position:fixed;right:calc(50% - min(50%,260px) + 20px);bottom:calc(98px + var(--safe-bottom));width:56px;height:56px;border-radius:28px;box-shadow:0 6px 14px rgba(16,27,58,.3);z-index:15" aria-label="Tambah tugas" data-act="task-new">${I.plus(26)}</button>`;
}

// ---------- layar: JADWAL KULIAH
function schedule() {
  const now = new Date(); const curWs = mondayOf(now);
  const ws = R.week ? parseKey(R.week) : curWs; const wsK = dkey(ws);
  const dow = R.day ?? now.getDay(); const idx = (dow + 6) % 7; const date = addDays(ws, idx);
  const list = classesOn(date);
  const order = [1, 2, 3, 4, 5, 6, 0];
  const isCur = dkey(ws) === dkey(curWs); const we = addDays(ws, 6);
  const label = `${isCur ? 'Minggu ini, ' : ''}${ws.getDate()} - ${we.getDate()} ${MON3[we.getMonth()]}`;
  const cards = list.map((c) => {
    const col = COLORS[c.color] || COLORS[0];
    return `<div class="cls ${col.dark ? 'dark' : ''}" style="${col.dark ? '' : 'background:' + col.bg}"><div class="col g6" style="flex:1;align-items:flex-start"><div class="row g6" style="flex-wrap:wrap"><span class="tm">${fmtT(c.start)} - ${fmtT(c.end)}</span>${c.exc ? '<span class="tag">Hanya minggu ini</span>' : ''}</div><span class="cn">${esc(c.name)}</span>${c.room ? `<span class="cr" style="color:${col.sub}">${esc(c.room)}</span>` : ''}</div><button class="edit" aria-label="Ubah ${esc(c.name)}" data-act="class-edit" data-id="${c.id}">${I.edit}</button></div>`;
  }).join('');
  return `
  <div style="position:relative;overflow:hidden;padding:calc(var(--safe-top) + 24px) 20px 0" class="col g14">
    ${shuri(190, 'deco').replace('class="deco"', 'style="position:absolute;right:-50px;top:-40px;color:var(--orange);opacity:.22;pointer-events:none"')}
    <div class="col" style="gap:2px;position:relative"><span class="muted" style="font-size:14px;font-weight:600">${list.length} kelas, ${DAYS[dow]}</span><h1 class="t1" style="font-size:34px">Jadwal kuliah</h1></div>
    <div class="weekbar" style="position:relative"><button class="ic cream" aria-label="Minggu sebelumnya" data-act="wk" data-d="-7">${I.back}</button><b>${label}</b><button class="ic cream" aria-label="Minggu berikutnya" data-act="wk" data-d="7">${I.next}</button></div>
    <div class="days act" style="position:relative">${order.map((d) => `<button class="${d === dow ? 'on' : ''}" data-act="sday" data-d="${d}">${DAYS3[d]}</button>`).join('')}</div>
    <div class="col g10" style="position:relative">${cards || '<div class="card empty">Tidak ada kelas di hari ini.</div>'}</div>
    <button class="btn-big dashed" style="min-height:56px;border-radius:28px;position:relative" data-act="class-new">${I.plus()}Tambah kelas</button>
    <p class="muted" style="font-size:12px;font-weight:600;text-align:center;position:relative">Ketuk tombol pensil untuk ubah jam, ruang, atau pindah hari. Kamu bisa pilih berlaku minggu ini saja atau seterusnya.</p>
  </div>`;
}

// ---------- layar: PENGATURAN
function settings() {
  const th = S.settings.theme;
  const row = (label, sub, act, extra = '') => `<button class="lrow" data-act="${act}" ${extra}><span class="col"><span class="m">${label}</span>${sub ? `<span class="s">${sub}</span>` : ''}</span>${I.chev}</button>`;
  return `
  <div class="hero navy">${shuri(150, 'deco')}<span style="font-size:14px;font-weight:600;color:#AEB8E0">Atur sesukamu</span><h1 class="t1" style="font-size:34px">Pengaturan</h1></div>
  <div class="pad col g12">
    <div class="col g8"><span class="lbl" style="letter-spacing:.4px">DATA</span>
      <div class="card" style="padding:4px 0;border-radius:26px">${row('Backup data', 'Simpan semua data jadi satu file', 'backup')}${row('Pulihkan dari backup', 'Pilih file backup sebelumnya', 'restore')}</div></div>
    <div class="col g8"><span class="lbl" style="letter-spacing:.4px">UMUM</span>
      <div class="card" style="padding:4px 0;border-radius:26px">${row('Kelola daftar habit', 'Tambah, ubah, atau hapus kebiasaan', 'go', 'data-r="habits"')}${row('Pengingat dan alarm', 'Alarm sholat, tugas, kuliah, timbang', 'go', 'data-r="reminders"')}${row('Namamu', esc(S.settings.name), 'name-edit')}</div></div>
    <div class="card col g10" style="border-radius:26px"><span class="t2" style="font-size:17px;padding:0 4px">Tampilan</span>
      <div class="seg"><button class="${th === 'light' ? 'on' : ''}" data-act="theme" data-v="light">Terang</button><button class="${th === 'dark' ? 'on' : ''}" data-act="theme" data-v="dark">Gelap</button><button class="${th === 'auto' ? 'on' : ''}" data-act="theme" data-v="auto">Ikut hape</button></div></div>
    <div class="card row sb g12" style="border-radius:26px;background:var(--yellow);color:var(--navy);min-height:72px"><span class="col" style="gap:2px"><span style="font-size:15px;font-weight:800">Sorot yang belum dicentang</span><span style="font-size:12px;font-weight:600;color:#5C4400">Tampil di dalam aplikasi</span></span>${sw(S.settings.highlight, 'tgl-hl', '', 'Sorot yang belum dicentang')}</div>
    <p class="muted" style="font-size:12px;font-weight:600;text-align:center">Misiku 1.0. Semua data tersimpan di hapemu saja.</p>
  </div>`;
}

// ---------- layar: PENGINGAT & ALARM
function reminders() {
  const st = S.settings; const rem = st.rem; const times = timesFor(new Date());
  const prow = PRAYERS.map((n, i) => `<div class="row sb" style="padding:0 4px 0 12px;min-height:52px"><span style="font-size:15px;font-weight:700">${n}</span><div class="row" style="gap:2px"><span class="fred" style="font-size:20px;font-weight:600;color:${st.prayerOn[i] ? 'var(--orange)' : '#AEB8E0'}">${hm(times[i])}</span>${sw(st.prayerOn[i], 'tgl-prayer-on', `data-i="${i}"`, 'Alarm ' + n)}</div></div>`).join('');
  const orow = (title, sub, key, act) => `<div class="lrow"><span class="col"><span class="m" style="font-weight:800">${title}</span><span class="s">${sub}</span></span>${act ? `<button class="pill sm" style="background:var(--soft)" data-act="${act}">Ubah</button>` : ''}${sw(rem[key], 'tgl-rem', `data-k="${key}"`, title)}</div>`;
  const dist = nearestCity(st.lat, st.lng);
  const locTxt = st.useLocation ? `${esc(st.city)}. Dihitung ulang tiap hari.` : `${esc(st.city)} (kota pilihan sendiri)`;
  return `
  <div class="hero navy">${shuri(150, 'deco')}
    <div class="row g10">${backBtn('settings', 'orange')}<h1 class="t1" style="color:var(--cream);font-size:30px">Pengingat</h1></div>
    <div class="seg"><button class="${st.alarmMode === 'alarm' ? 'on' : ''}" data-act="amode" data-v="alarm">Alarm berbunyi</button><button class="${st.alarmMode === 'notif' ? 'on' : ''}" data-act="amode" data-v="notif">Notifikasi biasa</button></div>
  </div>
  <div class="pad col g12">
    ${!EX.ok ? `<div class="card col g8" style="background:#FFD9B8;color:#7A2E00"><b style="font-weight:800">Izin alarm tepat waktu belum aktif</b><span style="font-size:13px;font-weight:600">Tanpa izin ini alarm bisa telat. Tekan tombol di bawah, lalu aktifkan "Alarm dan pengingat" untuk Misiku.</span><button class="pill dark" data-act="exact">Buka pengaturan izin</button></div>` : ''}
    <div class="card col g10" style="background:var(--peri);color:var(--navy);border-radius:28px;padding:14px 8px 14px 16px">
      <div class="row sb g8"><div class="row g12"><div class="ic navy" style="color:var(--orange)">${I.pin}</div><div class="col" style="gap:2px"><span style="font-size:15px;font-weight:800">Pakai lokasi hape</span><span style="font-size:12px;font-weight:600;color:#2B3A78">${locTxt}</span></div></div>${sw(st.useLocation, 'tgl-loc', '', 'Pakai lokasi hape untuk waktu sholat')}</div>
      <div class="row g8" style="flex-wrap:wrap;padding-right:8px"><button class="pill sm" style="background:rgba(255,255,255,.75);color:var(--navy)" data-act="method">Metode: ${METHODS[st.method].name}</button><button class="pill sm" style="background:rgba(255,255,255,.75);color:var(--navy)" data-act="safety">Pengaman: +${st.safety} menit</button><button class="pill sm out" style="color:var(--navy);border-color:var(--navy)" data-act="city">Pilih kota manual</button></div>
      <span style="font-size:11px;font-weight:600;color:#2B3A78;padding-right:8px">Koordinat tersimpan: ${st.lat.toFixed(2)}, ${st.lng.toFixed(2)}. Terdekat: ${dist.name}.</span>
    </div>
    <div class="ncard nv col"><div class="col" style="padding:2px 12px 6px;gap:2px"><span class="t2" style="font-size:20px">Sholat 5 waktu</span><span style="font-size:12px;font-weight:600;color:#AEB8E0">Waktu hari ini, mengikuti lokasi hapemu.</span></div>${prow}</div>
    <div class="card" style="border-radius:28px;padding:6px 8px">
      ${orow('Habit harian', 'Jam pengingat diatur per habit', 'habit', '')}
      ${orow('Deadline tugas', `${rem.taskMin >= 60 ? rem.taskMin / 60 + ' jam' : rem.taskMin + ' menit'} sebelum deadline`, 'task', 'rem-task')}
      ${orow('Jadwal kuliah', `${rem.clsMin} menit sebelum kelas mulai`, 'cls', 'rem-cls')}
      ${orow('Timbang berat badan', `Setiap ${DAYS[rem.weightDay]}, ${fmtT(rem.weightTime)}`, 'weight', 'rem-weight')}
    </div>
    <button class="btn-big" data-act="test-alarm">Coba bunyikan pengingat</button>
    <div class="card col g6" style="border-radius:24px"><b style="font-weight:800">Supaya alarm tidak telat</b><span class="muted" style="font-size:13px;font-weight:600;line-height:1.45">Di Oppo/ColorOS: buka Pengaturan hape, Baterai, cari Misiku, lalu pilih "Izinkan aktivitas latar belakang" dan "Izinkan aktivitas otomatis". Tanpa ini sistem bisa menghentikan alarm saat aplikasi tertutup.</span></div>
  </div>`;
}

// ---------- layar: KELOLA HABIT
function habits() {
  const rows = S.habits.map((h, i) => {
    const c = COLORS[h.color] || COLORS[0]; const fg = c.dark ? 'var(--cream)' : 'var(--navy)';
    const days = h.days.length === 7 ? 'setiap hari' : [1, 2, 3, 4, 5, 6, 0].filter((d) => h.days.includes(d)).map((d) => DAYS3[d]).join(' ');
    return `<div class="row g6" style="background:${c.bg};color:${fg};border-radius:24px;padding:6px 6px 6px 12px;min-height:68px">
      <div class="col"><button class="ic" style="width:32px;height:26px" aria-label="Naikkan" data-act="h-up" data-i="${i}">${I.up}</button><button class="ic" style="width:32px;height:26px" aria-label="Turunkan" data-act="h-down" data-i="${i}">${I.down}</button></div>
      <div class="col" style="flex:1"><span style="font-size:15px;font-weight:800">${esc(h.name)}</span><span style="font-size:12px;font-weight:600;color:${c.sub}">${esc(h.target)}, ${days}${h.remind ? ', alarm ' + fmtT(h.time) : ''}</span></div>
      <button class="ic navy" style="${c.dark ? 'background:var(--orange);color:var(--navy)' : ''}" aria-label="Ubah ${esc(h.name)}" data-act="habit-edit" data-id="${h.id}">${I.edit}</button>
      <button class="ic" style="background:rgba(255,255,255,.7);color:var(--navy)" aria-label="Hapus ${esc(h.name)}" data-act="habit-del" data-id="${h.id}">${I.trash}</button></div>`;
  }).join('');
  return `
  <div class="hero">${shuri(160, 'deco')}<div class="row g10">${backBtn('settings')}<h1 class="t1" style="font-size:30px">Kelola habit</h1></div><span style="font-size:13px;font-weight:700;padding-left:54px">Tambah, ubah, atau hapus sesukamu</span></div>
  <div class="pad col g12">
    <div class="ncard row g12" style="padding:14px 16px"><div class="ic orange">${I.lock}</div><div class="col" style="gap:2px"><span style="font-size:15px;font-weight:800">Sholat 5 waktu (tetap)</span><span style="font-size:12px;font-weight:600;color:#AEB8E0">Subuh, Zuhur, Asar, Magrib, Isya</span></div></div>
    <span class="t2">Kebiasaan kamu</span>
    <div class="col g8">${rows || '<div class="card empty">Belum ada kebiasaan.</div>'}</div>
    <button class="btn-big dashed" style="min-height:56px;border-radius:28px" data-act="habit-new">${I.plus()}Tambah habit baru</button>
  </div>`;
}

// ---------- layar: ALARM PENUH
function alarm() {
  const idx = R.idx ?? 2; const t = timesFor(new Date())[idx];
  return `<div class="alarm">
    <svg class="rings" width="560" height="560" viewBox="0 0 100 100" aria-hidden="true" fill="none" stroke="#FF7A00" stroke-width="0.5"><circle cx="50" cy="50" r="12"/><circle cx="50" cy="50" r="24"/><circle cx="50" cy="50" r="36"/><circle cx="50" cy="50" r="48"/></svg>
    <div class="col" style="align-items:center;gap:8px;margin-top:calc(var(--safe-top) + 100px);position:relative">
      <span class="chip" style="background:var(--orange);color:var(--navy);font-size:13px;padding:6px 16px;border-radius:16px">Alarm sholat</span>
      <span style="font-size:16px;font-weight:600;color:#AEB8E0;margin-top:14px">Waktunya sholat</span>
      <h1 class="big">${PRAYERS[idx]}</h1><span class="clock">${hm(t)}</span></div>
    <div class="col g12" style="margin-top:auto;width:100%;position:relative">
      <button class="btn-big fred" style="min-height:68px;border-radius:34px;font-size:22px" data-act="alarm-done">Sudah sholat</button>
      <button class="btn-big out" style="min-height:56px;border-radius:28px;color:var(--cream);border-color:var(--cream)" data-act="alarm-snooze">Tunda 10 menit</button>
      <button class="row" style="justify-content:center;min-height:44px;font-size:14px;font-weight:700;color:#AEB8E0" data-act="go" data-r="home">Tutup</button>
      <span style="font-size:12px;font-weight:600;color:#AEB8E0;text-align:center">Menekan "Sudah sholat" otomatis mencentang checklist ibadah hari ini.</span></div></div>`;
}

const screens = { home, recap, weight, tasks, schedule, settings, reminders, habits, alarm };

// ---------- modal
const sheet = (title, body) => `<div class="mb ${M && M.shown ? '' : 'in'}" data-act="close-bg"><div class="sheet" role="dialog" aria-label="${esc(title)}"><div class="row sb"><h2>${esc(title)}</h2><button class="ic cream" aria-label="Tutup" data-act="close">${I.x}</button></div>${body}</div></div>`;
const dayBtns = (sel, act, multi = false) => `<div class="days">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<button class="${(multi ? sel.includes(d) : sel === d) ? 'on' : ''}" aria-pressed="${multi ? sel.includes(d) : sel === d}" data-act="${act}" data-d="${d}">${DAYS3[d]}</button>`).join('')}</div>`;
const colorBtns = (sel) => `<div class="colors">${COLORS.map((c, i) => `<button class="${sel === i ? 'on' : ''}" style="background:${c.bg}" aria-label="${c.name}${sel === i ? ', dipilih' : ''}" data-act="mcolor" data-i="${i}"></button>`).join('')}</div>`;
const field = (id, label, val, type = 'text', extra = '') => `<div class="field"><label for="f-${id}">${label}</label><input id="f-${id}" data-f="${id}" type="${type}" value="${esc(val)}" ${extra}></div>`;

function modalHtml() {
  const d = M.data;
  switch (M.type) {
    case 'habit':
      return sheet(M.base ? 'Ubah habit' : 'Habit baru', `
        ${field('name', 'Nama habit', d.name, 'text', 'placeholder="Contoh: Minum air" maxlength="40"')}
        ${field('target', 'Target', d.target, 'text', 'placeholder="Contoh: 8 gelas" maxlength="40"')}
        <div class="col g6"><span class="lbl">Ulangi pada hari</span>${dayBtns(d.days, 'mday', true)}</div>
        <div class="col g6"><span class="lbl">Warna kartu</span>${colorBtns(d.color)}</div>
        <div class="card row sb" style="padding:0 6px 0 16px;min-height:52px;border-radius:20px"><span style="font-size:14px;font-weight:700">Alarm pengingat</span>${sw(d.remind, 'mremind', '', 'Alarm pengingat habit ini')}</div>
        ${d.remind ? field('time', 'Jam alarm', d.time, 'time') : ''}
        <button class="btn-big" data-act="habit-save">Simpan</button>`);
    case 'task':
      return sheet(M.base ? 'Ubah misi' : 'Misi baru', `
        ${field('title', 'Apa yang harus dikerjakan?', d.title, 'text', 'placeholder="Contoh: Laporan praktikum" maxlength="80"')}
        <div class="row g10"><div style="flex:1">${field('date', 'Tanggal', d.date, 'date')}</div><div style="flex:1">${field('time', 'Jam', d.time, 'time')}</div></div>
        <div class="col g6"><span class="lbl">Prioritas</span><div class="seg"><button class="${d.pri === 'h' ? 'on' : ''}" data-act="mpri" data-v="h">Tinggi</button><button class="${d.pri === 'm' ? 'on' : ''}" data-act="mpri" data-v="m">Sedang</button><button class="${d.pri === 'l' ? 'on' : ''}" data-act="mpri" data-v="l">Rendah</button></div></div>
        <button class="btn-big" data-act="task-save">Simpan</button>
        ${M.base ? '<button class="btn-big out" data-act="task-del">Hapus misi ini</button>' : ''}`);
    case 'class':
      return sheet(M.base ? 'Ubah kelas' : 'Kelas baru', `
        ${field('name', 'Nama matkul', d.name, 'text', 'placeholder="Contoh: Elektronika Analog" maxlength="50"')}
        <div class="col g6"><span class="lbl">Hari</span>${dayBtns(d.day, 'mdayone')}</div>
        <div class="row g10"><div style="flex:1">${field('start', 'Mulai', d.start, 'time')}</div><div style="flex:1">${field('end', 'Selesai', d.end, 'time')}</div></div>
        ${field('room', 'Ruang / keterangan', d.room, 'text', 'placeholder="Contoh: Ruang A-101" maxlength="40"')}
        <div class="col g6"><span class="lbl">Warna kartu</span>${colorBtns(d.color)}</div>
        <div class="col g6"><span class="lbl" id="berlaku">Perubahan berlaku untuk</span><div class="row g10" role="radiogroup" aria-labelledby="berlaku">
          <button class="radio ${d.scope === 'week' ? 'on' : ''}" role="radio" aria-checked="${d.scope === 'week'}" data-act="mscope" data-v="week"><b><i>${d.scope === 'week' ? I.check(12) : ''}</i>Minggu ini saja</b><span>Minggu depan kembali seperti semula</span></button>
          <button class="radio ${d.scope === 'forever' ? 'on' : ''}" role="radio" aria-checked="${d.scope === 'forever'}" data-act="mscope" data-v="forever"><b><i>${d.scope === 'forever' ? I.check(12) : ''}</i>Seterusnya</b><span>Berlaku mulai minggu ini ke depan</span></button></div></div>
        <button class="btn-big" data-act="class-save">Simpan</button>
        ${M.base ? '<button class="btn-big out" data-act="class-del">Hapus kelas ini</button>' : ''}`);
    case 'goal':
      return sheet('Target berat badan', `${field('goal', 'Target (kg)', d.goal, 'number', 'step="0.1" inputmode="decimal"')}<button class="btn-big" data-act="goal-save">Simpan</button>`);
    case 'name':
      return sheet('Namamu', `${field('name', 'Nama panggilan', d.name, 'text', 'maxlength="30"')}<button class="btn-big" data-act="name-save">Simpan</button>`);
    case 'city':
      return sheet('Pilih kota', `<div class="col g6" style="max-height:52vh;overflow-y:auto">${CITIES.map((c, i) => `<button class="lrow card" style="border-radius:18px;min-height:48px;padding:0 16px" data-act="city-pick" data-i="${i}"><span class="m">${c[0]}</span>${S.settings.city === c[0] && !S.settings.useLocation ? I.check(18) : ''}</button>`).join('')}</div>`);
    case 'taskmin':
      return sheet('Pengingat deadline', `<div class="col g8">${[30, 60, 120, 180, 1440].map((v) => `<button class="radio ${S.settings.rem.taskMin === v ? 'on' : ''}" style="min-height:52px" data-act="set-taskmin" data-v="${v}"><b>${v >= 60 ? v / 60 + ' jam sebelum deadline' : v + ' menit sebelum deadline'}</b></button>`).join('')}</div>`);
    case 'clsmin':
      return sheet('Pengingat kuliah', `<div class="col g8">${[5, 10, 15, 30, 60].map((v) => `<button class="radio ${S.settings.rem.clsMin === v ? 'on' : ''}" style="min-height:52px" data-act="set-clsmin" data-v="${v}"><b>${v} menit sebelum kelas mulai</b></button>`).join('')}</div>`);
    case 'weightrem':
      return sheet('Pengingat timbang', `<div class="col g6"><span class="lbl">Hari</span>${dayBtns(d.day, 'mdayone')}</div>${field('time', 'Jam', d.time, 'time')}<button class="btn-big" data-act="weightrem-save">Simpan</button>`);
    case 'confirm':
      return sheet(d.title, `<p class="muted" style="font-size:14px;font-weight:600;line-height:1.5">${esc(d.text)}</p><button class="btn-big" data-act="confirm-yes">${esc(d.yes)}</button><button class="btn-big out" data-act="close">Batal</button>`);
    default: return '';
  }
}

function captureForm() {
  if (!M) return;
  document.querySelectorAll('.sheet [data-f]').forEach((el) => { M.data[el.dataset.f] = el.value; });
}
const open = (type, data, base = null, extra = {}) => { M = { type, data, base, ...extra }; render(); };
const close = () => { M = null; render(); };
const confirmBox = (title, text, yes, fn) => open('confirm', { title, text, yes }, null, { fn });

// ---------- lokasi
export async function fixLocation(silent = false) {
  try {
    if (isNative()) await Geolocation.requestPermissions().catch(() => {});
    const p = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 });
    S.settings.lat = p.coords.latitude; S.settings.lng = p.coords.longitude;
    const n = nearestCity(S.settings.lat, S.settings.lng);
    S.settings.city = n.km < 60 ? n.name : `Dekat ${n.name}`;
    S.settings.useLocation = true; save();
    if (!silent) toast(`Lokasi diperbarui: ${S.settings.city}`);
    render();
    return true;
  } catch (e) {
    if (!silent) toast('Lokasi tidak bisa dibaca. Pilih kota manual ya.');
    return false;
  }
}

// ---------- backup
async function doBackup() {
  const data = JSON.stringify(S, null, 1); const name = `misiku-backup-${dkey(new Date())}.json`;
  try {
    if (isNative()) {
      const r = await Filesystem.writeFile({ path: name, data, directory: Directory.Cache, encoding: Encoding.UTF8 });
      await Share.share({ title: 'Backup Misiku', url: r.uri, dialogTitle: 'Simpan backup ke mana?' });
    } else {
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' })); a.download = name; a.click();
    }
  } catch (e) { toast('Backup dibatalkan atau gagal.'); }
}
function doRestore() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = () => {
    const f = inp.files && inp.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const obj = JSON.parse(rd.result);
        if (!obj || !Array.isArray(obj.habits) || typeof obj.logs !== 'object') throw new Error('format');
        confirmBox('Pulihkan data?', 'Semua data di aplikasi sekarang akan diganti dengan isi file backup ini.', 'Ya, pulihkan', () => { replaceAll(obj); toast('Data berhasil dipulihkan'); go('home'); });
      } catch (e) { toast('File backup tidak valid.'); }
    };
    rd.readAsText(f);
  };
  inp.click();
}

// ---------- aksi
function onClick(e) {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const a = el.dataset.act; const ds = el.dataset;
  if (a === 'close-bg') { if (e.target === el) close(); return; }
  switch (a) {
    case 'go': go(ds.r); break;
    case 'close': close(); break;
    case 'tgl-prayer': { const lg = getLog(dkey(new Date())); lg.p[+ds.i] = lg.p[+ds.i] ? 0 : 1; save(); render(); break; }
    case 'tgl-habit': { const lg = getLog(dkey(new Date())); if (lg.h[ds.id]) delete lg.h[ds.id]; else lg.h[ds.id] = 1; save(); render(); break; }
    case 'ym': { const k = R.ym || dkey(new Date()).slice(0, 7); const [y, m] = k.split('-').map(Number); const n = new Date(y, m - 1 + +ds.d, 1); R.ym = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`; render(); break; }
    // berat
    case 'wrange': R.range = +ds.v; render(); break;
    case 'wstep': { const ws = [...S.weights].sort((x, y) => x.d.localeCompare(y.d)); const cur = R.draft ?? (ws.length ? ws[ws.length - 1].kg : 60); R.draft = Math.round((cur + +ds.d) * 10) / 10; render(); break; }
    case 'wsave': {
      const ws = [...S.weights].sort((x, y) => x.d.localeCompare(y.d)); const v = R.draft ?? (ws.length ? ws[ws.length - 1].kg : 60); const k = dkey(new Date());
      S.weights = S.weights.filter((w) => w.d !== k); S.weights.push({ d: k, kg: v }); save(); toast(`Tersimpan: ${fmtKg(v)} kg`); render(); break;
    }
    case 'goal-edit': open('goal', { goal: S.goalWeight }); break;
    case 'goal-save': { captureForm(); const v = parseFloat(String(M.data.goal).replace(',', '.')); if (!(v > 20 && v < 300)) { toast('Isi target antara 20 sampai 300 kg'); break; } S.goalWeight = v; save(); close(); break; }
    // tugas
    case 'tfilter': R.filter = ds.v; render(); break;
    case 'tgl-task': { const t = S.tasks.find((x) => x.id === ds.id); if (t) { t.done = !t.done; save(); render(); } break; }
    case 'task-new': { const d = new Date(); open('task', { title: '', date: dkey(d), time: '23:59', pri: 'm' }); break; }
    case 'task-edit': { const t = S.tasks.find((x) => x.id === ds.id); if (!t) break; const d = new Date(t.due); open('task', { title: t.title, date: dkey(d), time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`, pri: t.pri }, t); break; }
    case 'mpri': captureForm(); M.data.pri = ds.v; render(); break;
    case 'task-save': {
      captureForm(); const d = M.data; if (!d.title.trim()) { toast('Isi dulu nama misinya'); break; }
      const [yy, mm, dd] = d.date.split('-').map(Number); const [h, mi] = (d.time || '23:59').split(':').map(Number); const due = new Date(yy, mm - 1, dd, h, mi);
      if (isNaN(due.getTime())) { toast('Tanggal belum benar'); break; }
      if (M.base) Object.assign(M.base, { title: d.title.trim(), due: due.toISOString(), pri: d.pri }); else S.tasks.push({ id: uid(), title: d.title.trim(), due: due.toISOString(), pri: d.pri, done: false });
      save(); close(); break;
    }
    case 'task-del': { const id = M.base.id; confirmBox('Hapus misi?', 'Misi ini akan dihapus.', 'Ya, hapus', () => { S.tasks = S.tasks.filter((t) => t.id !== id); save(); close(); }); break; }
    // jadwal
    case 'wk': { const ws = R.week ? parseKey(R.week) : mondayOf(new Date()); R.week = dkey(addDays(ws, +ds.d)); render(); break; }
    case 'sday': R.day = +ds.d; render(); break;
    case 'class-new': { const dow = R.day ?? new Date().getDay(); open('class', { name: '', room: '', day: dow, start: '07:30', end: '09:10', color: 0, scope: 'forever' }); break; }
    case 'class-edit': { const ws = R.week ? parseKey(R.week) : mondayOf(new Date()); const c = weekClasses(ws).find((x) => x.id === ds.id); if (!c) break; open('class', { name: c.name, room: c.room || '', day: c.day, start: c.start, end: c.end, color: c.color, scope: 'week' }, c); break; }
    case 'mdayone': captureForm(); M.data.day = +ds.d; render(); break;
    case 'mscope': captureForm(); M.data.scope = ds.v; render(); break;
    case 'mcolor': captureForm(); M.data.color = +ds.i; render(); break;
    case 'class-save': {
      captureForm(); const d = M.data; if (!d.name.trim()) { toast('Isi dulu nama matkulnya'); break; }
      if (!d.start || !d.end || d.end <= d.start) { toast('Jam selesai harus setelah jam mulai'); break; }
      const ws = R.week ? parseKey(R.week) : mondayOf(new Date());
      saveClass(M.base, { ...d, name: d.name.trim(), room: d.room.trim() }, ws, d.scope); save(); close(); break;
    }
    case 'class-del': {
      const base = M.base; const scope = M.data.scope; const ws = R.week ? parseKey(R.week) : mondayOf(new Date());
      confirmBox('Hapus kelas?', scope === 'week' ? 'Kelas ini hanya dihapus untuk minggu ini. Minggu depan tetap ada.' : 'Kelas ini dihapus mulai minggu ini ke depan.', 'Ya, hapus', () => { deleteClass(base, ws, scope); save(); close(); });
      break;
    }
    // habit
    case 'habit-new': open('habit', { name: '', target: '', days: [0, 1, 2, 3, 4, 5, 6], color: S.habits.length % 4, remind: false, time: '20:00' }); break;
    case 'habit-edit': { const h = S.habits.find((x) => x.id === ds.id); if (h) open('habit', { name: h.name, target: h.target, days: [...h.days], color: h.color, remind: h.remind, time: h.time }, h); break; }
    case 'mday': { captureForm(); const d = +ds.d; const arr = M.data.days; M.data.days = arr.includes(d) ? arr.filter((x) => x !== d) : [...arr, d]; render(); break; }
    case 'mremind': captureForm(); M.data.remind = !M.data.remind; render(); break;
    case 'habit-save': {
      captureForm(); const d = M.data; if (!d.name.trim()) { toast('Isi dulu nama habitnya'); break; }
      if (!d.days.length) { toast('Pilih minimal satu hari'); break; }
      const obj = { name: d.name.trim(), target: d.target.trim(), days: d.days, color: d.color, remind: d.remind, time: d.time || '20:00' };
      if (M.base) Object.assign(M.base, obj); else S.habits.push({ id: uid(), created: dkey(new Date()), ...obj });
      save(); close(); break;
    }
    case 'habit-del': { const id = ds.id; const h = S.habits.find((x) => x.id === id); confirmBox('Hapus habit?', `"${h ? h.name : ''}" dan riwayatnya di rekap akan hilang.`, 'Ya, hapus', () => { S.habits = S.habits.filter((x) => x.id !== id); for (const k of Object.keys(S.logs)) delete S.logs[k].h[id]; save(); close(); }); break; }
    case 'h-up': { const i = +ds.i; if (i > 0) { [S.habits[i - 1], S.habits[i]] = [S.habits[i], S.habits[i - 1]]; save(); render(); } break; }
    case 'h-down': { const i = +ds.i; if (i < S.habits.length - 1) { [S.habits[i + 1], S.habits[i]] = [S.habits[i], S.habits[i + 1]]; save(); render(); } break; }
    // pengaturan
    case 'theme': S.settings.theme = ds.v; save(); render(); break;
    case 'tgl-hl': S.settings.highlight = !S.settings.highlight; save(); render(); break;
    case 'backup': doBackup(); break;
    case 'restore': doRestore(); break;
    case 'name-edit': open('name', { name: S.settings.name }); break;
    case 'name-save': { captureForm(); const n = M.data.name.trim(); if (n) { S.settings.name = n; save(); } close(); break; }
    case 'confirm-yes': { const fn = M.fn; M = null; fn && fn(); break; }
    // pengingat
    case 'amode': S.settings.alarmMode = ds.v; save(); render(); break;
    case 'tgl-prayer-on': S.settings.prayerOn[+ds.i] = !S.settings.prayerOn[+ds.i]; save(); render(); break;
    case 'tgl-rem': S.settings.rem[ds.k] = !S.settings.rem[ds.k]; save(); render(); break;
    case 'tgl-loc': if (S.settings.useLocation) { S.settings.useLocation = false; save(); render(); } else fixLocation(); break;
    case 'method': { const keys = Object.keys(METHODS); S.settings.method = keys[(keys.indexOf(S.settings.method) + 1) % keys.length]; save(); render(); break; }
    case 'safety': S.settings.safety = (S.settings.safety + 1) % 6; save(); render(); break;
    case 'city': open('city', {}); break;
    case 'city-pick': { const c = CITIES[+ds.i]; S.settings.useLocation = false; S.settings.city = c[0]; S.settings.lat = c[1]; S.settings.lng = c[2]; save(); close(); break; }
    case 'rem-task': open('taskmin', {}); break;
    case 'rem-cls': open('clsmin', {}); break;
    case 'set-taskmin': S.settings.rem.taskMin = +ds.v; save(); close(); break;
    case 'set-clsmin': S.settings.rem.clsMin = +ds.v; save(); close(); break;
    case 'rem-weight': open('weightrem', { day: S.settings.rem.weightDay, time: S.settings.rem.weightTime }); break;
    case 'weightrem-save': captureForm(); S.settings.rem.weightDay = M.data.day; S.settings.rem.weightTime = M.data.time || '07:00'; save(); close(); break;
    case 'exact': openExactAlarmSettings(); break;
    case 'test-alarm': (async () => {
      if (!isNative()) { toast('Tes bunyi hanya jalan di aplikasi Android.'); return; }
      const ok = await ensurePermissions(); if (!ok) { toast('Izin notifikasi belum diberikan. Aktifkan di pengaturan hape.'); return; }
      const sent = await testNow(); toast(sent ? 'Tunggu 5 detik, pengingat akan berbunyi. Boleh tutup aplikasinya.' : 'Gagal memasang tes pengingat.');
    })(); break;
    // alarm
    case 'alarm-done': { const lg = getLog(R.date || dkey(new Date())); lg.p[R.idx] = 1; save(); toast(`${PRAYERS[R.idx]} tercentang`); go('home'); break; }
    case 'alarm-snooze': snooze(R.idx, 10); toast('Diingatkan lagi 10 menit lagi'); go('home'); break;
    default: break;
  }
}

// ---------- render
// ---------- animasi perubahan kecil (saklar geser, centang melonjak, bar tumbuh)
const keyOf = (el) => `${el.dataset.act}|${el.dataset.id ?? el.dataset.i ?? el.dataset.d ?? el.dataset.v ?? el.dataset.r ?? ''}`;
const isOn = (el) => el.classList.contains('on') || !!el.closest('.trow.done');
const reduceMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
function snapshot(app) {
  const st = new Map();
  app.querySelectorAll('[data-act]').forEach((el) => st.set(keyOf(el), isOn(el)));
  return { st, bars: [...app.querySelectorAll('.bar>i')].map((e) => e.style.width) };
}
// Dipanggil tepat setelah layar digambar ulang: kembalikan keadaan lama dulu, lalu geser ke keadaan baru di frame berikutnya
function prepChanges(app, snap) {
  if (reduceMotion()) return null;
  const c = { sws: [], fxs: [], bars: [] };
  app.querySelectorAll('[data-act]').forEach((el) => {
    const was = snap.st.get(keyOf(el)); if (was === undefined) return;
    const now = isOn(el); if (was === now) return;
    if (el.classList.contains('sw')) { el.classList.toggle('on', was); c.sws.push([el, now]); }
    else if (now) c.fxs.push(el);
  });
  app.querySelectorAll('.bar>i').forEach((el, i) => {
    const old = snap.bars[i]; const cur = el.style.width; if (!old || old === cur) return;
    el.style.width = old; c.bars.push([el, cur]);
  });
  return c;
}
function runChanges(c) {
  if (!c) return;
  c.fxs.forEach((el) => el.classList.add('fx'));
  requestAnimationFrame(() => {
    c.sws.forEach(([el, now]) => el.classList.toggle('on', now));
    c.bars.forEach(([el, cur]) => { el.style.transition = 'width .6s cubic-bezier(.2,.8,.2,1)'; el.style.width = cur; });
  });
}

export function render(top = false) {
  const app = $('#app'); if (!app) return;
  applyTheme();
  const prev = app.querySelector('.screen'); const sc = prev && !top ? prev.scrollTop : 0;
  const snap = !top && app.dataset.screen === R.name ? snapshot(app) : null;
  const body = screens[R.name] ? screens[R.name]() : '';
  app.innerHTML = (R.name === 'alarm' ? body : `<main class="screen">${body}</main>${nav()}`) + (M ? modalHtml() : '');
  app.dataset.screen = R.name;
  const chg = snap ? prepChanges(app, snap) : null;
  const n = app.querySelector('.screen'); if (n) { n.scrollTop = sc; if (top) n.classList.add('enter'); }
  if (M) M.shown = true;
  runChanges(chg);
  if (R.name === 'reminders') exactAlarmOk().then((ok) => { if (ok !== EX.ok) { EX.ok = ok; if (R.name === 'reminders' && !M) render(); } });
}

export function handleBack() {
  if (M) { close(); return true; }
  if (R.name !== 'home') { go({ recap: 'home', weight: 'home', habits: 'settings', reminders: 'settings' }[R.name] || 'home'); return true; }
  return false;
}

export function initUI() {
  $('#app').addEventListener('click', onClick);
  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (S.settings.theme === 'auto') render(); });
  render(true);
}
