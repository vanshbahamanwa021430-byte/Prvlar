// Short how-to for installing the Android APK by hand. Used on the website
// download page and in About › App updates, so the wording stays in sync.
export function androidInstallFileName(version = '') {
  const v = String(version || '').replace(/^v/, '').replace(/[^0-9A-Za-z.-]/g, '');
  return v ? `Prvlar-${v}.apk` : 'Prvlar-<version>.apk';
}

export function androidInstallListHTML(version = '') {
  const file = androidInstallFileName(version);
  return `<ol class="android-install">
<li>Download the APK in <b>Chrome</b> (not from Gmail or the GitHub app).</li>
<li>Open it from the Files app: <b>Files by Google › Downloads › ${file}</b>.</li>
<li>If Android asks, tap <b>Settings</b> and turn on <b>Allow from this source</b> for Chrome or Files, then go back and tap <b>Install</b>.</li>
<li>If tapping the file does nothing: <b>Settings › Apps › Special app access › Install unknown apps</b>, allow Files by Google and Chrome, then try again.</li>
<li>If an older Prvlar is already installed, this upgrades it in place and keeps your data.</li>
</ol>`;
}
