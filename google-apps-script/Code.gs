// STOPTIME application delivery. Deploy as Web app: Execute as Me; access Anyone.
// Only MailApp permission is needed. No Drive files or spreadsheet rows are created.
const RECIPIENT = 'gribudejot_stoptime@inbox.lv';
const ORIGINS = ['https://stoptime.lv', 'https://www.stoptime.lv', 'https://emilsluksha.github.io', 'http://127.0.0.1:4173', 'http://localhost:4173'];
const MAX_BYTES = 5 * 1024 * 1024;

function doGet() {
  return HtmlService.createHtmlOutput('STOPTIME pieteikumu nosūtīšanas pakalpojums darbojas.');
}

function doPost(e) {
  let p = {}, result = {type: 'stoptime-result', ok: false};
  try {
    const raw = e && e.parameter && e.parameter.payload;
    if (!raw || raw.length > 7100000) throw new Error('Nederīgs vai pārāk liels pieteikums.');
    p = JSON.parse(raw);
    if (ORIGINS.indexOf(p.origin) < 0) throw new Error('Nederīga vietne.');
    if (!/^[a-f0-9-]{36}$/i.test(p.requestId)) throw new Error('Nederīgs pieteikuma numurs.');
    result.requestId = p.requestId;
    processApplication_(p);
    result.ok = true;
  } catch (err) {
    // Never echo uploaded contents or internal Google errors to the public page.
    result.message = err && err.publicMessage || 'Neizdevās nosūtīt iesniegumu. Pārbaudi datus vai mēģini vēlāk.';
  }
  const origin = ORIGINS.indexOf(p.origin) >= 0 ? p.origin : ORIGINS[0];
  const json = JSON.stringify(result).replace(/</g, '\\u003c');
  // HTML-service responses are nested inside Google's iframe. top is the website.
  return HtmlService.createHtmlOutput('<!doctype html><meta charset="utf-8"><script>window.top.postMessage(' + json + ',' + JSON.stringify(origin) + ');</script>')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function fail_(message) { const e = new Error(message); e.publicMessage = message; throw e; }

function processApplication_(p) {
  const first = String(p.firstName || '').trim(), last = String(p.lastName || '').trim();
  if (!first || first.length > 60 || !last || last.length > 80 || /[\r\n\x00-\x1f]/.test(first + last)) fail_('Norādi vārdu un uzvārdu.');
  if (!/^[+0-9() .-]{7,30}$/.test(String(p.phone || '')) || String(p.phone).replace(/\D/g, '').length < 7) fail_('Pārbaudi tālruņa numuru.');
  if (p.consent !== true || p.website || !(Number(p.elapsed) >= 2000)) fail_('Pārbaudi anketu un piekrišanu.');
  const ext = String(p.fileName || '').toLowerCase().match(/\.(docx|doc|pdf)$/);
  if (!ext || typeof p.fileBase64 !== 'string' || p.fileBase64.length > 6990508 || !/^[A-Za-z0-9+/]+={0,2}$/.test(p.fileBase64)) fail_('Pievieno DOCX, DOC vai PDF failu līdz 5 MB.');
  const bytes = Utilities.base64Decode(p.fileBase64);
  if (!bytes.length || bytes.length > MAX_BYTES) fail_('Fails nedrīkst būt tukšs vai lielāks par 5 MB.');
  const signature = bytes.slice(0, 8).map(b => (b + 256) % 256);
  const matches = ext[1] === 'pdf' ? signature.slice(0,5).join(',') === '37,80,68,70,45' :
    ext[1] === 'docx' ? signature.slice(0,4).join(',') === '80,75,3,4' : signature.join(',') === '208,207,17,224,161,177,26,225';
  if (!matches) fail_('Faila saturs neatbilst DOCX, DOC vai PDF formātam.');
  const mime = {docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',doc:'application/msword',pdf:'application/pdf'}[ext[1]];
  const fileName = String(p.fileName).replace(/[\\/\r\n\x00-\x1f]/g, '_').slice(-180);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) fail_('Pakalpojums ir aizņemts. Mēģini vēlreiz.');
  try {
    const props = PropertiesService.getScriptProperties();
    const today = Utilities.formatDate(new Date(), 'Europe/Riga', 'yyyy-MM-dd');
    const all = props.getProperties();
    // Retain receipt IDs for seven days; no names, phones or documents are stored.
    const cutoff = Date.now() - 7 * 86400000;
    Object.keys(all).filter(k => k.indexOf('sent:') === 0 && Number(all[k]) < cutoff).forEach(k => props.deleteProperty(k));
    if (props.getProperty('sent:' + p.requestId)) return;
    const count = props.getProperty('day') === today ? Number(props.getProperty('count') || 0) : 0;
    if (count >= 80 || MailApp.getRemainingDailyQuota() < 1) fail_('Šodien sasniegts nosūtīšanas limits. Lūdzu, raksti uz ' + RECIPIENT + '.');
    MailApp.sendEmail({
      to: RECIPIENT,
      subject: 'STOPTIME — ' + first + ' ' + last,
      body: 'Vārds: ' + first + '\nUzvārds: ' + last,
      name: 'STOPTIME pieteikumi',
      attachments: [Utilities.newBlob(bytes, mime, fileName)]
    });
    props.setProperties({day: today, count: String(count + 1), ['sent:' + p.requestId]: String(Date.now())});
  } finally { lock.releaseLock(); }
}
