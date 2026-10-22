import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.argv[2] ?? 'http://127.0.0.1:5193';
const out = process.argv[3] ?? 'test-results/music';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  await page.goto(`${base}/dev/audio-review.html?qa=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.audioReview, undefined, { timeout: 30000 });
  const report = [];
  for (let n = 1; n <= 16; n++) {
    const id = `t${n}`;
    const result = await page.evaluate(async (id) => {
      const api = window.audioReview,
        buffer = await api.renderSong(id, 36),
        l = buffer.getChannelData(0),
        r = buffer.getChannelData(1),
        rate = buffer.sampleRate;
      let peak = 0,
        sum = 0,
        stereo = 0,
        invalid = 0,
        jump = 0;
      const windows = [];
      for (let i = 0; i < l.length; i++) {
        peak = Math.max(peak, Math.abs(l[i]), Math.abs(r[i]));
        sum += l[i] * l[i] + r[i] * r[i];
        stereo += (l[i] - r[i]) ** 2;
        if (!Number.isFinite(l[i] + r[i])) invalid++;
        if (i) jump = Math.max(jump, Math.abs(l[i] - l[i - 1]), Math.abs(r[i] - r[i - 1]));
      }
      for (let start = rate * 4; start < l.length - rate * 3; start += rate / 2) {
        let power = 0;
        for (let j = start; j < start + rate / 2; j++) power += l[j] ** 2 + r[j] ** 2;
        windows.push(Math.sqrt(power / rate));
      }
      const song = api.songs[id];
      api.music.play(id, 0.02);
      const connected = api.music.current === id && api.music.song?.id === id;
      api.music.stop(0.01);
      // Keep a compact stereo WAV audition of the main theme, after its two-bar intro.
      const start = Math.round(((2 * 240) / song.bpm) * rate),
        frames = Math.min(rate * 16, l.length - start);
      const bytes = new Uint8Array(44 + frames * 4),
        view = new DataView(bytes.buffer);
      const str = (o, s) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
      str(0, 'RIFF');
      view.setUint32(4, bytes.length - 8, true);
      str(8, 'WAVE');
      str(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 2, true);
      view.setUint32(24, rate, true);
      view.setUint32(28, rate * 4, true);
      view.setUint16(32, 4, true);
      view.setUint16(34, 16, true);
      str(36, 'data');
      view.setUint32(40, frames * 4, true);
      for (let i = 0; i < frames; i++) {
        view.setInt16(44 + i * 4, Math.max(-1, Math.min(1, l[start + i])) * 32767, true);
        view.setInt16(46 + i * 4, Math.max(-1, Math.min(1, r[start + i])) * 32767, true);
      }
      let binary = '';
      for (let i = 0; i < bytes.length; i += 8192)
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      return {
        id,
        name: song.name,
        bpm: song.bpm,
        peak,
        rms: Math.sqrt(sum / (l.length * 2)),
        stereoRms: Math.sqrt(stereo / l.length),
        invalid,
        maxSampleJump: jump,
        minHalfSecondRms: Math.min(...windows),
        connected,
        wav: btoa(binary),
      };
    }, id);
    await writeFile(`${out}/${id}.wav`, Buffer.from(result.wav, 'base64'));
    delete result.wav;
    report.push(result);
    console.log(JSON.stringify(result));
  }
  await writeFile(`${out}/report.json`, JSON.stringify({ report, errors }, null, 2));
  if (
    errors.length ||
    report.some(
      (r) => !r.connected || r.invalid || r.peak >= 0.98 || r.minHalfSecondRms < 0.003 || r.stereoRms < 0.001,
    )
  )
    process.exitCode = 1;
} finally {
  await browser.close();
}
