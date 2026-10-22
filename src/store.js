// Penyimpanan data + fungsi bantu tanggal. Semua data disimpan di hape (localStorage).
export const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export const DAYS3 = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
export const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
export const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
export const PRAYERS = ['Subuh', 'Zuhur', 'Asar', 'Magrib', 'Isya'];
export const COLORS = [
  { bg: '#C9D3FF', sub: '#2B3A78', name: 'Periwinkle' },
  { bg: '#FFD66B', sub: '#5C4400', name: 'Kuning' },
  { bg: '#FFC2A1', sub: '#6B2A00', name: 'Peach' },
  { bg: '#BEE8D5', sub: '#0F4A35', name: 'Mint' },
  { bg: '#101B3A', sub: '#AEB8E0', name: 'Biru tua', dark: true },
];

const pad = (n) => String(n).padStart(2, '0');
export const dkey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
export const mondayOf = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
export const hm = (d) => `${pad(d.getHours())}.${pad(d.getMinutes())}`;
export const uid = () => Math.random().toString(36).slice(2, 9);
export const fmtKg = (n) => (Math.round(n * 10) / 10).toFixed(1).replace('.', ',');
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const KEY = 'misiku.v1';
const today = () => dkey(new Date());

function defaults() {
  const t = today();
  return {
    v: 1,
    habits: [
      { id: uid(), name: 'Minum air', target: '8 gelas', days: [0, 1, 2, 3, 4, 5, 6], remind: true, time: '20:00', color: 0, created: t },
      { id: uid(), name: 'Olahraga', target: '20 menit', days: [0, 1, 2, 3, 4, 5, 6], remind: true, time: '17:00', color: 1, created: t },
      { id: uid(), name: 'Baca buku', target: '15 menit', days: [0, 1, 2, 3, 4, 5, 6], remind: true, time: '21:00', color: 2, created: t },
      { id: uid(), name: 'Tidur tepat waktu', target: 'Sebelum 23.00', days: [0, 1, 2, 3, 4, 5, 6], remind: false, time: '22:00', color: 3, created: t },
    ],
    logs: {},
    weights: [],
    goalWeight: 60,
    tasks: [],
    classes: [],
    exceptions: [],
    settings: {
      name: 'Bintang',
      theme: 'auto',
      highlight: true,
      alarmMode: 'alarm',
      useLocation: true,
      locAsked: false,
      lat: -7.2575,
      lng: 112.7521,
      city: 'Surabaya',
      method: 'kemenag',
      safety: 2,
      prayerOn: [true, true, true, true, true],
      rem: { habit: true, task: true, taskMin: 60, cls: true, clsMin: 10, weight: false, weightDay: 1, weightTime: '07:00' },
      lastSched: '',
    },
  };
}

function merge(base, src) {
  if (Array.isArray(base) || typeof base !== 'object' || base === null) return src ?? base;
  const out = { ...base };
  for (const k of Object.keys(src || {})) {
    out[k] = k in base && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) ? merge(base[k], src[k]) : src[k];
  }
  return out;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return merge(defaults(), JSON.parse(raw));
  } catch (e) { /* data rusak: mulai baru */ }
  return defaults();
}

export let S = load();
let listeners = [];
export const onSave = (fn) => listeners.push(fn);
export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* penyimpanan penuh/diblokir */ }
  listeners.forEach((fn) => fn());
}
export function replaceAll(obj) {
  S = merge(defaults(), obj);
  save();
}

// ---- log harian
export function getLog(k) {
  if (!S.logs[k]) S.logs[k] = { p: [0, 0, 0, 0, 0], h: {} };
  return S.logs[k];
}
export const peekLog = (k) => S.logs[k] || { p: [0, 0, 0, 0, 0], h: {} };

export const habitsOn = (date) => S.habits.filter((h) => h.days.includes(date.getDay()));

function doneOn(h, d) { return !!peekLog(dkey(d)).h[h.id]; }

// streak berjalan: hari terjadwal berurutan sampai hari ini (hari ini belum dicentang tidak memutus)
export function streak(h) {
  let d = new Date(); let n = 0; let first = true;
  for (let i = 0; i < 400; i++) {
    if (h.days.includes(d.getDay())) {
      if (doneOn(h, d)) n++;
      else if (!first) break;
      first = false;
    }
    d = addDays(d, -1);
  }
  return n;
}
export function bestStreak(h) {
  const keys = Object.keys(S.logs).sort();
  if (!keys.length) return 0;
  let d = parseKey(keys[0]); const end = new Date(); let best = 0; let cur = 0;
  while (d <= end) {
    if (h.days.includes(d.getDay())) {
      if (doneOn(h, d)) { cur++; best = Math.max(best, cur); } else if (dkey(d) !== dkey(end)) cur = 0;
    }
    d = addDays(d, 1);
  }
  return best;
}

// ---- jadwal kuliah (dengan perubahan "minggu ini saja" / "seterusnya")
export function weekClasses(ws) {
  const k = dkey(ws); const out = [];
  for (const c of S.classes) {
    if (c.from > k) continue;
    if (c.to && c.to < k) continue;
    const ex = S.exceptions.find((e) => e.classId === c.id && e.week === k);
    if (ex && ex.deleted) continue;
    out.push({ ...c, ...(ex ? ex.patch : {}), id: c.id, exc: !!ex });
  }
  return out;
}
export function classesOn(date) {
  return weekClasses(mondayOf(date)).filter((c) => c.day === date.getDay()).sort((a, b) => a.start.localeCompare(b.start));
}

// Simpan perubahan kelas. scope: 'week' (minggu ini saja) atau 'forever' (seterusnya). base = kelas lama atau null.
export function saveClass(base, data, weekStart, scope) {
  const wk = dkey(weekStart); const prev = dkey(addDays(weekStart, -7));
  const fields = { name: data.name, room: data.room, day: data.day, start: data.start, end: data.end, color: data.color };
  if (!base) {
    S.classes.push({ id: uid(), ...fields, from: wk, to: scope === 'week' ? wk : null });
    return;
  }
  const c = S.classes.find((x) => x.id === base.id);
  if (!c) return;
  if (scope === 'week') {
    S.exceptions = S.exceptions.filter((e) => !(e.classId === c.id && e.week === wk));
    S.exceptions.push({ classId: c.id, week: wk, patch: fields });
    return;
  }
  S.exceptions = S.exceptions.filter((e) => !(e.classId === c.id && e.week >= wk));
  if (c.from >= wk) Object.assign(c, fields);
  else {
    c.to = prev;
    S.classes.push({ id: uid(), ...fields, from: wk, to: null });
  }
}
export function deleteClass(base, weekStart, scope) {
  const wk = dkey(weekStart); const prev = dkey(addDays(weekStart, -7));
  const c = S.classes.find((x) => x.id === base.id);
  if (!c) return;
  if (scope === 'week') {
    S.exceptions = S.exceptions.filter((e) => !(e.classId === c.id && e.week === wk));
    S.exceptions.push({ classId: c.id, week: wk, deleted: true });
    return;
  }
  S.exceptions = S.exceptions.filter((e) => !(e.classId === c.id && e.week >= wk));
  if (c.from >= wk) S.classes = S.classes.filter((x) => x.id !== c.id);
  else c.to = prev;
}

// ---- kota (untuk tampilan nama lokasi tanpa internet)
export const CITIES = [
  ['Surabaya', -7.2575, 112.7521], ['Sidoarjo', -7.4478, 112.7183], ['Gresik', -7.1539, 112.6561], ['Malang', -7.9839, 112.6214],
  ['Kediri', -7.848, 112.0178], ['Jember', -8.1845, 113.6681], ['Banyuwangi', -8.2192, 114.3691], ['Madiun', -7.6298, 111.5239],
  ['Jakarta', -6.2088, 106.8456], ['Bandung', -6.9175, 107.6191], ['Bogor', -6.595, 106.8166], ['Cirebon', -6.732, 108.5523],
  ['Semarang', -6.9667, 110.4167], ['Solo', -7.5755, 110.8243], ['Yogyakarta', -7.7956, 110.3695], ['Denpasar', -8.6705, 115.2126],
  ['Mataram', -8.5833, 116.1167], ['Kupang', -10.1772, 123.607], ['Medan', 3.5952, 98.6722], ['Banda Aceh', 5.5483, 95.3238],
  ['Padang', -0.9471, 100.4172], ['Pekanbaru', 0.5071, 101.4478], ['Batam', 1.0456, 104.0305], ['Jambi', -1.6101, 103.6131],
  ['Palembang', -2.9761, 104.7754], ['Bengkulu', -3.8004, 102.2655], ['Bandar Lampung', -5.3971, 105.2668], ['Pontianak', -0.0263, 109.3425],
  ['Banjarmasin', -3.3194, 114.5908], ['Balikpapan', -1.2379, 116.8529], ['Samarinda', -0.5022, 117.1536], ['Makassar', -5.1477, 119.4327],
  ['Manado', 1.4748, 124.8421], ['Palu', -0.8917, 119.8707], ['Kendari', -3.9985, 122.513], ['Ambon', -3.6954, 128.1814], ['Jayapura', -2.5337, 140.7181],
];
export function nearestCity(lat, lng) {
  let best = CITIES[0]; let bd = 1e9;
  for (const c of CITIES) {
    const d = (c[1] - lat) ** 2 + ((c[2] - lng) * Math.cos((lat * Math.PI) / 180)) ** 2;
    if (d < bd) { bd = d; best = c; }
  }
  return { name: best[0], km: Math.sqrt(bd) * 111 };
}
