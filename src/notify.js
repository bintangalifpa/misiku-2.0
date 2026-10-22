// Alarm & notifikasi terjadwal (Android). Di browser biasa semua fungsi ini diam saja.
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { S, PRAYERS, DAYS, addDays, dkey, parseKey, classesOn, peekLog, habitsOn, hm } from './store.js';
import { timesFor } from './prayer.js';

export const isNative = () => Capacitor.isNativePlatform();
const WINDOW_DAYS = 10; // alarm dipasang untuk 10 hari ke depan; dipasang ulang tiap aplikasi dibuka
const SNOOZE_BASE = 900000;
const MAX_ITEMS = 380;

export async function initNotifications(onAction) {
  if (!isNative()) return;
  try {
    await LocalNotifications.createChannel({
      id: 'misi-alarm', name: 'Alarm Misiku', description: 'Alarm sholat, jadwal, dan pengingat yang berbunyi keras',
      importance: 5, visibility: 1, sound: 'alarm_misi.wav', vibration: true, lights: true, lightColor: '#FF7A00',
    });
    await LocalNotifications.createChannel({
      id: 'misi-notif', name: 'Notifikasi Misiku', description: 'Notifikasi biasa',
      importance: 4, visibility: 1, vibration: true,
    });
    await LocalNotifications.registerActionTypes({
      types: [
        { id: 'PRAYER', actions: [{ id: 'DONE', title: 'Sudah' }, { id: 'SNOOZE', title: 'Tunda 10 mnt' }] },
        { id: 'HABIT', actions: [{ id: 'CHECK', title: 'Centang' }] },
        { id: 'WEIGHT', actions: [{ id: 'LOG', title: 'Catat' }] },
      ],
    });
    await LocalNotifications.addListener('localNotificationActionPerformed', (e) => onAction && onAction(e));
  } catch (e) { console.warn('init notif gagal', e); }
}

export async function ensurePermissions() {
  if (!isNative()) return true;
  try {
    let p = await LocalNotifications.checkPermissions();
    if (p.display !== 'granted') p = await LocalNotifications.requestPermissions();
    return p.display === 'granted';
  } catch (e) { return false; }
}

export async function exactAlarmOk() {
  if (!isNative()) return true;
  try { return (await LocalNotifications.checkExactNotificationSetting()).exact_alarm !== 'denied'; } catch (e) { return true; }
}
export async function openExactAlarmSettings() {
  try { await LocalNotifications.changeExactNotificationSetting(); } catch (e) { /* abaikan */ }
}

const at = (dateKey, time) => {
  const [h, m] = time.split(':').map(Number);
  const d = parseKey(dateKey); d.setHours(h, m, 0, 0); return d;
};

function build() {
  const now = new Date(); const list = []; let id = 1000;
  const ch = S.settings.alarmMode === 'alarm' ? 'misi-alarm' : 'misi-notif';
  const push = (when, title, body, actionTypeId, extra, channelId = ch) => {
    if (when <= now || list.length >= MAX_ITEMS) return;
    const n = { id: id++, title, body, channelId, schedule: { at: when, allowWhileIdle: true }, extra, autoCancel: true, smallIcon: 'ic_stat_misi', iconColor: '#FF7A00' };
    if (actionTypeId) n.actionTypeId = actionTypeId;
    list.push(n);
  };

  for (let i = 0; i < WINDOW_DAYS; i++) {
    const day = addDays(now, i); const k = dkey(day);

    // sholat 5 waktu
    const times = timesFor(day);
    times.forEach((t, idx) => {
      if (!S.settings.prayerOn[idx]) return;
      push(t, `Waktunya sholat ${PRAYERS[idx]}`, `${hm(t)}, jangan lupa dicentang ya`, 'PRAYER', { type: 'prayer', idx, date: k });
    });

    // habit harian
    if (S.settings.rem.habit) {
      for (const h of habitsOn(day)) {
        if (!h.remind) continue;
        if (i === 0 && peekLog(k).h[h.id]) continue;
        push(at(k, h.time), `${h.name} belum dicentang`, h.target ? `Target: ${h.target}` : 'Yuk selesaikan hari ini', 'HABIT', { type: 'habit', habitId: h.id, date: k });
      }
    }

    // jadwal kuliah
    if (S.settings.rem.cls) {
      for (const c of classesOn(day)) {
        const start = at(k, c.start);
        const when = new Date(start.getTime() - S.settings.rem.clsMin * 60000);
        push(when, `${c.name} mulai ${S.settings.rem.clsMin} menit lagi`, `${c.room ? c.room + ', ' : ''}${c.start.replace(':', '.')}`, null, { type: 'class', date: k });
      }
    }

    // timbang berat badan mingguan
    if (S.settings.rem.weight && day.getDay() === S.settings.rem.weightDay) {
      push(at(k, S.settings.rem.weightTime), 'Waktunya timbang berat badan', 'Catat sebelum sarapan', 'WEIGHT', { type: 'weight', date: k });
    }
  }

  // deadline tugas
  if (S.settings.rem.task) {
    for (const t of S.tasks) {
      if (t.done || !t.due) continue;
      const due = new Date(t.due);
      const lead = new Date(due.getTime() - S.settings.rem.taskMin * 60000);
      const label = S.settings.rem.taskMin >= 60 ? `${Math.round(S.settings.rem.taskMin / 60)} jam lagi` : `${S.settings.rem.taskMin} menit lagi`;
      if (lead > now) push(lead, `${t.title}, ${label}`, `Deadline ${DAYS[due.getDay()]} ${hm(due)}`, null, { type: 'task', taskId: t.id });
      else push(due, `${t.title}: sekarang deadline`, 'Segera selesaikan', null, { type: 'task', taskId: t.id });
    }
  }
  return list;
}

// Pasang ulang semua alarm sesuai data & pengaturan terbaru.
export async function rescheduleAll() {
  if (!isNative()) return 0;
  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') return -1;
    const pending = await LocalNotifications.getPending();
    const old = (pending.notifications || []).filter((n) => n.id < SNOOZE_BASE);
    if (old.length) await LocalNotifications.cancel({ notifications: old.map((n) => ({ id: n.id })) });
    const list = build();
    for (let i = 0; i < list.length; i += 60) {
      await LocalNotifications.schedule({ notifications: list.slice(i, i + 60) });
    }
    S.settings.lastSched = dkey(new Date());
    return list.length;
  } catch (e) { console.warn('jadwal alarm gagal', e); return -2; }
}

export async function snooze(idx, minutes = 10) {
  if (!isNative()) return;
  const ch = S.settings.alarmMode === 'alarm' ? 'misi-alarm' : 'misi-notif';
  try {
    await LocalNotifications.schedule({
      notifications: [{
        id: SNOOZE_BASE + Math.floor(Math.random() * 90000), title: `Waktunya sholat ${PRAYERS[idx]}`, body: 'Pengingat tunda, sudah siap?',
        channelId: ch, actionTypeId: 'PRAYER', schedule: { at: new Date(Date.now() + minutes * 60000), allowWhileIdle: true },
        extra: { type: 'prayer', idx, date: dkey(new Date()) }, smallIcon: 'ic_stat_misi', iconColor: '#FF7A00',
      }],
    });
  } catch (e) { console.warn(e); }
}

export async function testNow() {
  if (!isNative()) return false;
  const ch = S.settings.alarmMode === 'alarm' ? 'misi-alarm' : 'misi-notif';
  try {
    await LocalNotifications.schedule({
      notifications: [{
        id: SNOOZE_BASE + 99999, title: 'Tes pengingat Misiku', body: 'Kalau ini berbunyi, alarmmu siap dipakai',
        channelId: ch, actionTypeId: 'PRAYER', schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true },
        extra: { type: 'test', idx: 2, date: dkey(new Date()) }, smallIcon: 'ic_stat_misi', iconColor: '#FF7A00',
      }],
    });
    return true;
  } catch (e) { return false; }
}
