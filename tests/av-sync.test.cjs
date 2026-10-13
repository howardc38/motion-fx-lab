const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const deliver = path.join(__dirname, '..', 'video', 'deliver.py');

// Deliverables keep no edit list, so the first frame starts after B-frame reordering while AAC adds
// priming. encode_hq must delay the sound to meet the picture, and check() must be able to see it.
test('delivered sound starts with the first frame', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fx-sync-'));
  try {
    const master = path.join(dir, 'master.mkv'), mix = path.join(dir, 'mix.wav');
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=s=320x240:r=30:d=3', '-c:v', 'ffv1', master]);
    // Irregular bursts give the level envelope one clear alignment.
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i',
      "aevalsrc='0.5*sin(2*PI*660*t)*(between(t,0.31,0.42)+between(t,0.97,1.03)+between(t,1.58,1.81)+between(t,2.4,2.46))':s=48000:d=3.5",
      '-ac', '2', mix]);
    const result = execFileSync('python3', ['-c', `
import importlib.util, json, sys
spec = importlib.util.spec_from_file_location("d", sys.argv[1]); d = importlib.util.module_from_spec(spec); spec.loader.exec_module(d)
master, mix, out_dir = sys.argv[2:5]
aligned = out_dir + "/aligned.mp4"; plain = out_dir + "/plain.mp4"
d.encode_hq(master, mix, aligned)
d.run("ffmpeg", "-y", "-loglevel", "error", "-i", master, "-i", mix, "-map", "0:v", "-map", "1:a", "-c:v", "libx264", *d.COMMON_OUT, plain)
print(json.dumps({"aligned": d.sync_offset(aligned, mix), "plain": d.sync_offset(plain, mix),
                  "editlist": d.moov_first_without_editlist(aligned)[0]}))
`, deliver, master, mix, dir], { encoding: 'utf8' });
    const { aligned, plain, editlist } = JSON.parse(result.trim().split('\n').pop());
    assert.ok(Math.abs(aligned) <= 0.005, `aligned offset ${aligned}`);
    assert.ok(plain < -0.02, `unaligned encode should measure the sound leading, got ${plain}`);
    assert.equal(editlist, true);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
