// video/deliver.py takes the poster from the delivered web file. Those files carry no edit list, so the
// first frame is stamped 0.0667 s while the sound starts at 0, and a plain -ss seek landed two frames
// early. This builds a tiny film with the same layout (B-frames, AAC from 0, no edit list) whose frame n
// has luma 16 + 3n, and checks that the poster is the frame the film shows at the requested time.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const DELIVER = path.resolve(__dirname, '../video/deliver.py');
const ffmpeg = (...args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { maxBuffer: 1 << 24 });
// Mean grey level of an image file, as the decoder would show it (full range).
const grey = file => { const px = ffmpeg('-i', file, '-f', 'rawvideo', '-pix_fmt', 'gray', '-'); return px.reduce((a, b) => a + b, 0) / px.length; };
const frameIndex = level => level * 219 / 255 / 3;

test('the poster is the frame shown at the requested time, not two frames earlier', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'poster-frame-'));
  try {
    const film = path.join(dir, 'film.mp4');
    ffmpeg('-f', 'lavfi', '-i', "color=c=black:s=64x64:r=30:d=2,geq=lum='16+N*3':cb=128:cr=128,format=yuv420p",
      '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono', '-map', '0:v', '-map', '1:a',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '4', '-c:a', 'aac', '-shortest', '-use_editlist', '0', film);
    const starts = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,start_time', '-of', 'csv=p=0', film], { encoding: 'utf8' });
    // The layout that caused the bug: the picture starts after the sound.
    assert.match(starts, /video,0\.0666/);
    assert.match(starts, /audio,0\.000000/);
    const seekPoster = path.join(dir, 'seek.jpg');
    ffmpeg('-ss', '1', '-i', film, '-frames:v', '1', '-q:v', '3', seekPoster);
    assert.equal(Math.round(frameIndex(grey(seekPoster))), 28, 'a plain -ss seek lands two frames early on this layout');
    const driver = path.join(dir, 'driver.py');
    fs.writeFileSync(driver, `
import importlib.util, sys
spec = importlib.util.spec_from_file_location("delivery", sys.argv[1])
delivery = importlib.util.module_from_spec(spec)
spec.loader.exec_module(delivery)
film, out_dir = sys.argv[2:4]
fps = delivery.frame_rate(delivery.probe(film))
for seconds in (0, 1, 1.5, 59 / 30):
    delivery.poster_frame(film, seconds, fps, f"{out_dir}/poster-{seconds:.4f}.jpg")
`);
    execFileSync('python3', [driver, DELIVER, film, dir]);
    for (const [seconds, frame] of [[0, 0], [1, 30], [1.5, 45], [59 / 30, 59]]) {
      const got = frameIndex(grey(path.join(dir, `poster-${seconds.toFixed(4)}.jpg`)));
      assert.ok(Math.abs(got - frame) < 0.4, `${seconds} s should give frame ${frame}, got ${got.toFixed(2)}`);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
