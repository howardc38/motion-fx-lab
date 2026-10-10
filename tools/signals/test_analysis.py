import importlib.util
import json
import subprocess
import tempfile
import unittest
from pathlib import Path
import sys
import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
spec = importlib.util.spec_from_file_location('analysis', HERE/'build.py')
a = importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
spec = importlib.util.spec_from_file_location('prepare', ROOT/'video/prepare-audio.py')
p = importlib.util.module_from_spec(spec);spec.loader.exec_module(p)

class SignalsTest(unittest.TestCase):
    def test_measured_audio_has_real_amplitude_and_frequency(self):
        silence=a.audio_features(np.zeros(48000),48000)
        self.assertEqual(max(silence['envelope']),0)
        self.assertEqual(silence['onsets'],[])
        constant=a.audio_features(np.ones(48000)*.25,48000)
        self.assertAlmostEqual(constant['rms'][30],.25,places=6)
        t=np.arange(48000)/48000
        tone=a.audio_features(np.sin(2*np.pi*440*t)*.25,48000)
        peak=int(np.argmax(tone['bands'][30]));edges=tone['bandEdgesHz']
        self.assertLessEqual(edges[peak],440);self.assertGreater(edges[peak+1],440)
        self.assertLess(tone['bands'][30][-1],.05)

    def test_optical_flow_measures_known_current_frame_translation(self):
        previous=np.zeros((96,128,4),np.uint8)
        rng=np.random.default_rng(44)
        previous[22:70,30:78,:3]=rng.integers(40,250,(48,48,3),dtype=np.uint8)
        previous[22:70,30:78,3]=255
        current=np.zeros_like(previous);current[20:68,33:81]=previous[22:70,30:78]
        flow=a.current_flow(previous,current)
        dx,dy=np.median(flow[28:60,41:73].reshape(-1,2),axis=0)
        self.assertAlmostEqual(float(dx),3,delta=.35)
        self.assertAlmostEqual(float(dy),-2,delta=.35)
        self.assertLess(float(np.max(np.abs(a.current_flow(previous,previous)))),.03)
        self.assertEqual(float(np.max(np.abs(flow[:12]))),0)

    def test_export_uses_identical_analysed_pcm_from_a_nested_page(self):
        manifest=json.loads((ROOT/'assets/signals/manifest.json').read_text())
        with tempfile.TemporaryDirectory() as folder:
            work=Path(folder);cues=work/'cues.json';out=work/'mix.wav'
            cues.write_text(json.dumps({'dur':.25,'audio':{'src':'/assets/signals/score.wav','sha256':manifest['audio']['sha256']}}))
            p.prepare(cues,ROOT/'examples/nested/film.html',out)
            expected,sr=a.read_audio(ROOT/'assets/signals/score.wav');actual,_=a.read_audio(out)
            np.testing.assert_array_equal(actual[:round(.25*sr)],expected[:round(.25*sr)])
            self.assertGreaterEqual(len(actual),round(1.25*sr))
            self.assertEqual(float(np.max(np.abs(actual[round(.25*sr):]))),0)
            out.write_bytes(b'previous valid output')
            cues.write_text(json.dumps({'dur':.25,'audio':{'src':'/assets/signals/score.wav','sha256':'0'*64}}))
            with self.assertRaisesRegex(ValueError,'hash differs'):p.prepare(cues,ROOT/'examples/nested/film.html',out)
            self.assertEqual(out.read_bytes(),b'previous valid output')
            cues.write_text(json.dumps({'dur':20,'audio':{'src':'/assets/signals/score.wav','sha256':manifest['audio']['sha256']}}))
            with self.assertRaisesRegex(ValueError,'shorter'):p.prepare(cues,ROOT/'examples/nested/film.html',out)
            self.assertEqual(out.read_bytes(),b'previous valid output')

    def test_default_music_sfx_and_failed_asset_replacement(self):
        with tempfile.TemporaryDirectory() as folder:
            work=Path(folder);cues=work/'cues.json';out=work/'mix.wav'
            cues.write_text(json.dumps({'dur':.6,'cues':[],'music':[[0,'intro']]}))
            p.prepare(cues,ROOT/'examples/reel.html',out)
            pcm,sr=a.read_audio(out)
            self.assertGreaterEqual(len(pcm),round(.6*sr));self.assertGreater(float(np.max(np.abs(pcm))),.01)
            dest=work/'bundle';dest.mkdir();(dest/'sentinel').write_text('keep')
            failed=subprocess.run([sys.executable,str(HERE/'build.py'),'--source',str(work/'missing-source'),'--output',str(dest),'--replace'],capture_output=True)
            self.assertNotEqual(failed.returncode,0);self.assertEqual((dest/'sentinel').read_text(),'keep')
            self.assertEqual(sorted(x.name for x in dest.iterdir()),['sentinel'])

if __name__=='__main__':unittest.main()
