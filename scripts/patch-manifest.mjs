// Menambah izin yang dibutuhkan Misiku ke AndroidManifest.xml (aman dijalankan berulang kali).
import fs from 'fs';

const file = 'android/app/src/main/AndroidManifest.xml';
let xml = fs.readFileSync(file, 'utf8');

const lines = [
  '<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />',
  '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />',
  '<uses-permission android:name="android.permission.VIBRATE" />',
  '<uses-permission android:name="android.permission.USE_EXACT_ALARM" />',
  '<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />',
  '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />',
  '<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />',
  '<uses-feature android:name="android.hardware.location.gps" android:required="false" />',
];

const add = lines.filter((l) => !xml.includes(l.match(/android:name="([^"]+)"/)[1]));
if (add.length) {
  xml = xml.replace('</manifest>', '    ' + add.join('\n    ') + '\n</manifest>');
  fs.writeFileSync(file, xml);
}
console.log('Manifest diperbarui, izin ditambah:', add.length);
