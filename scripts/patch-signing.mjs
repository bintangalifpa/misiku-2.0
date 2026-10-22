// Memakai kunci tanda tangan tetap supaya APK versi baru bisa dipasang menimpa versi lama (data tidak hilang).
import fs from 'fs';

const file = 'android/app/build.gradle';
let g = fs.readFileSync(file, 'utf8');
if (!g.includes('signingConfigs.misiku')) {
  const block = `    signingConfigs {
        misiku {
            storeFile file("\${rootProject.projectDir}/../misiku-debug.keystore")
            storePassword 'misiku123'
            keyAlias 'misiku'
            keyPassword 'misiku123'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.misiku
        }`;
  if (!g.includes('    buildTypes {')) throw new Error('blok buildTypes tidak ditemukan di build.gradle');
  g = g.replace('    buildTypes {', block);
  fs.writeFileSync(file, g);
}
console.log('Penandatanganan tetap dipasang');
