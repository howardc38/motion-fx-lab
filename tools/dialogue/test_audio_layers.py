import hashlib, importlib.util, json, pathlib, subprocess, tempfile, unittest, wave
ROOT=pathlib.Path(__file__).resolve().parents[2]
module=importlib.util.spec_from_file_location('prepare_audio',ROOT/'video/prepare-audio.py')
audio=importlib.util.module_from_spec(module);module.loader.exec_module(audio)

class Layers(unittest.TestCase):
    def test_layer_bounds_hash_and_timeline_duration(self):
        manifest=json.loads((ROOT/'assets/dialogue/manifest.json').read_text())['films']['character-dialogue']
        src=ROOT/'assets/dialogue'/manifest['audio']['file']
        layer={'src':'/assets/dialogue/'+src.name,'sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'at':.2,'offset':.45,'duration':.5}
        with tempfile.TemporaryDirectory() as tmp:
            out=pathlib.Path(tmp)/'bed.wav'
            with wave.open(str(out),'wb') as w:
                w.setparams((2,2,48000,0,'NONE','not compressed'));w.writeframes(b'\0'*48000*4)
            audio.overlay_layers({'dur':1,'audioLayers':[layer]},ROOT/'video/intro.html',out)
            probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-of','json',out]))
            self.assertAlmostEqual(float(probe['format']['duration']),1,places=2)
            for change in [{'sha256':'0'*64},{'offset':100},{'duration':-1},{'at':.8},{'gain':float('nan')},{'src':'/../outside.wav'}]:
                with self.assertRaises(ValueError):audio.overlay_layers({'dur':1,'audioLayers':[{**layer,**change}]},ROOT/'video/intro.html',out)

if __name__=='__main__':unittest.main()
