// Waktu sholat dihitung langsung di hape (tanpa internet) dari koordinat lokasi.
import { Coordinates, CalculationParameters, PrayerTimes, Madhab } from 'adhan';
import { S } from './store.js';

export const METHODS = {
  kemenag: { name: 'Kemenag RI', fajr: 20, isha: 18 },
  muhammadiyah: { name: 'Muhammadiyah', fajr: 18, isha: 18 },
  mwl: { name: 'MWL (Liga Muslim Dunia)', fajr: 18, isha: 17 },
};

// Hasil: [Subuh, Zuhur, Asar, Magrib, Isya] sebagai objek Date
export function timesFor(date) {
  const st = S.settings;
  const m = METHODS[st.method] || METHODS.kemenag;
  const p = new CalculationParameters('Other', m.fajr, m.isha);
  p.madhab = Madhab.Shafi;
  const a = st.safety || 0; // pengaman (ihtiyati) dalam menit
  p.adjustments.fajr = a;
  p.adjustments.dhuhr = a;
  p.adjustments.asr = a;
  p.adjustments.maghrib = a;
  p.adjustments.isha = a;
  const t = new PrayerTimes(new Coordinates(st.lat, st.lng), date, p);
  return [t.fajr, t.dhuhr, t.asr, t.maghrib, t.isha];
}
