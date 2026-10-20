"""
TURBO RALLY character voice generator (§9.4, 2nd tier).

  MeloTTS-Korean (MIT) -> Praat PSOLA pitch/formant profile per character (moderate, to keep
  pronunciation natural) -> loudness normalise -> MP3 + OGG.
  Every line is rendered as several candidates; each candidate is transcribed back with
  Whisper large-v3 and the one with the lowest character error rate (CER) vs. the script wins.
  Clips whose best CER is still high are reported so they can be rewritten.

Usage: tools/audio/.venv/Scripts/python tools/audio/voicegen.py [charId ...]
"""
import os, re, json, sys, random
import torch

os.add_dll_directory(os.path.join(os.path.dirname(torch.__file__), "lib"))
os.environ["PATH"] = os.path.join(os.path.dirname(torch.__file__), "lib") + os.pathsep + os.environ["PATH"]

import numpy as np
import soundfile as sf
import librosa
import parselmouth
from parselmouth.praat import call
from faster_whisper import WhisperModel
from melo.api import TTS

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "public", "audio", "voice")
CANDIDATES = 6

# Script: what is said in game (display text) and the text fed to TTS (pronunciation-friendly).
def load_lines():
    src = open(os.path.join(ROOT, "src", "data", "characters.ts"), encoding="utf8").read()
    out = {}
    for m in re.finditer(r"id: '(\w+)', name: '([^']+)'.*?lines: \{(.*?)\},\n  \}", src, re.S):
        cid = m.group(1)
        lines = dict(re.findall(r"(\w+): '([^']*)'", m.group(3)))
        out[cid] = lines
    return out

# Moderate per-character profiles (semitones, formant ratio, speed). Kept small on purpose:
# large shifts make Korean sound slurred ("어눌").
PROFILES = {
    "momo":    dict(st=+3.0, formant=1.06, speed=1.08, range=1.35),
    "mungchi": dict(st=-4.5, formant=0.90, speed=0.90, range=1.1),
    "piyo":    dict(st=+3.5, formant=1.07, speed=1.1, range=1.35),
    "lulu":    dict(st=+1.5, formant=1.04, speed=1.0, range=1.25),
    "toto":    dict(st=+0.5, formant=1.0, speed=1.12, range=1.35),
    "piko":    dict(st=+2.0, formant=1.03, speed=0.96, range=1.3),
    "kkang":   dict(st=-2.5, formant=0.94, speed=1.04, range=1.3),
    "hana":    dict(st=+1.0, formant=1.03, speed=1.02, range=1.3),
}

def tts_text(s: str) -> str:
    s = s.replace("~", ",").replace("…", ",")
    s = re.sub(r",\s*([!?.])", r"\1", s)
    s = re.sub(r",+", ",", s).strip(" ,")
    return s

def norm(s: str) -> str:
    s = s.replace("1등", "일등")
    return re.sub(r"[^가-힣a-zA-Z0-9]", "", s)

def cer(ref: str, hyp: str) -> float:
    r, h = norm(ref), norm(hyp)
    if not r:
        return 0.0
    d = list(range(len(h) + 1))
    for i in range(1, len(r) + 1):
        prev, d[0] = d[0], i
        for j in range(1, len(h) + 1):
            cur = d[j]
            d[j] = min(d[j] + 1, d[j - 1] + 1, prev + (r[i - 1] != h[j - 1]))
            prev = cur
    return d[len(h)] / len(r)

def profile_audio(wav: np.ndarray, sr: int, p: dict) -> np.ndarray:
    snd = parselmouth.Sound(wav.astype(np.float64), sampling_frequency=sr)
    pitch = call(snd, "To Pitch", 0.0, 75, 600)
    median = call(pitch, "Get quantile", 0, 0, 0.5, "Hertz")
    if not median or np.isnan(median):
        median = 220.0
    new_median = median * (2 ** (p["st"] / 12))
    out = call(snd, "Change gender", 75, 600, p["formant"], new_median, p["range"], 1.0)
    y = out.values[0].astype(np.float32)
    # gentle polish: trim, fade, peak/RMS normalise
    y, _ = librosa.effects.trim(y, top_db=38)
    fade = int(sr * 0.012)
    if len(y) > 2 * fade:
        y[:fade] *= np.linspace(0, 1, fade)
        y[-fade:] *= np.linspace(1, 0, fade)
    rms = np.sqrt(np.mean(y ** 2)) + 1e-9
    y = y * (0.12 / rms)
    peak = np.max(np.abs(y))
    if peak > 0.89:
        y = y * (0.89 / peak)
    pad = np.zeros(int(sr * 0.04), dtype=np.float32)
    return np.concatenate([pad, y, pad])

def main():
    only = set(a for a in sys.argv[1:] if '/' not in a)
    keys = set(a for a in sys.argv[1:] if '/' in a)
    if keys:
        only = set(k.split('/')[0] for k in keys)
    lines = load_lines()
    assert len(lines) == 8, f"parsed {len(lines)} characters"
    model = TTS(language="KR", device="cuda")
    spk = model.hps.data.spk2id["KR"]
    sr = model.hps.data.sampling_rate
    asr = WhisperModel("large-v3", device="cuda", compute_type="float16")
    manifest = {}
    mpath = os.path.join(OUT, "manifest.json")
    if os.path.exists(mpath):
        manifest = json.load(open(mpath, encoding="utf8"))
    bad = []
    tmp = os.path.join(os.path.dirname(__file__), "_tmp.wav")
    for cid, ls in lines.items():
        if only and cid not in only:
            continue
        p = PROFILES[cid]
        os.makedirs(os.path.join(OUT, cid), exist_ok=True)
        for key, text in ls.items():
            if keys and f"{cid}/{key}" not in keys:
                continue
            best = None
            for k in range(CANDIDATES):
                random.seed(k * 7 + 3)
                torch.manual_seed(k * 7 + 3)
                model.tts_to_file(tts_text(text), spk, tmp, speed=p["speed"], sdp_ratio=0.25 + 0.1 * k, noise_scale=0.55 + 0.05 * k, noise_scale_w=0.7, quiet=True)
                wav, _ = librosa.load(tmp, sr=sr)
                y = profile_audio(wav, sr, p)
                a16 = librosa.resample(y, orig_sr=sr, target_sr=16000)
                segs, _ = asr.transcribe(a16, language="ko", beam_size=5)
                hyp = "".join(s.text for s in segs).strip()
                c = cer(text, hyp)
                if best is None or c < best[0]:
                    best = (c, y, hyp)
                if c == 0:
                    break
            c, y, hyp = best
            base = os.path.join(OUT, cid, key)
            sf.write(base + ".mp3", y, sr, format="MP3")
            sf.write(base + ".ogg", y, sr, format="OGG", subtype="VORBIS")
            manifest.setdefault(cid, {})[key] = {"text": text, "asr": hyp, "cer": round(c, 3), "dur": round(len(y) / sr, 2)}
            flag = "  <-- CHECK" if c > 0.15 else ""
            print(f"{cid}/{key}: cer={c:.2f} '{text}' -> '{hyp}'{flag}", flush=True)
            if c > 0.15:
                bad.append(f"{cid}/{key}")
    json.dump(manifest, open(mpath, "w", encoding="utf8"), ensure_ascii=False, indent=1)
    print("BAD:", bad)

if __name__ == "__main__":
    main()
