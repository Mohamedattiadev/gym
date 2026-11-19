"""Voice clips for app/js/voice.js: every spoken piece as a small MP3 made with Microsoft Edge's online neural
voices (edge-tts, same approach as Fluent365 — owner's choice 2026-11-19). Only Gym's own public text is sent.

Usage:
  uvx --with edge-tts python tools/voice/gen.py            # only clips whose text or voice changed
  uvx --with edge-tts python tools/voice/gen.py --all      # everything again
  uvx --with edge-tts python tools/voice/gen.py --list     # print the clip count, generate nothing
  ... gen.py --lang tr|ar [--only p/go,kg/40]               # another language / just a few sample clips

Every sentence comes from app/data/voice.<lang>.json (voice, rate, whole phrases with {n}/{m}/{d}/{s}, plural forms keyed
by Intl.PluralRules categories zero/one/two/few/many/other) — app/js/voice.js reads the same file, so text and clips match.
"names": "en" = this language reuses media/voice/en/x/* for exercise names (the UI keeps English names).

Output: media/voice/<lang>/<key>.mp3 (mono 24 kHz, 32 kbit/s, silence trimmed at both ends) and
tools/voice/index.<lang>.json (key -> hash of text + voice, for regeneration). Keys (app/js/voice.js builds the same):
  p/<id>              fixed phrases (rest-<sec>, ten, n1..n3, go, set-<n>-of-<m>, round-<n>-of-<m>, ...)
  kg/<w>              "<w> kilos" for 0.5 .. 300 in 0.5 steps and whole kilos up to 400 (w like 40 or 42.5)
  r/<n>, fr/<n>       "<n> reps." and "for <n> reps." (1 .. 50)
  x/<slug>            exercise name
  f/<family>-s<i>     "Step i+1. <step>"   f/<family>-c<i>  cue
After regenerating: bump VOICE_V in app/sw.js AND app/js/voice.js (phones keep old clips in the media cache otherwise).
Anything without a clip (pounds, 41.25 kg, ...) falls back to the browser voice for that sentence.
Licence: the Edge read-aloud service has no published licence for its output (same owner-accepted risk as
Fluent365); fallback = regenerate with an open model (Kokoro-82M, Apache-2.0) through this script.
"""
import asyncio
import hashlib
import json
import os
import subprocess
import sys
import tempfile

import edge_tts

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
LANG = sys.argv[sys.argv.index("--lang") + 1] if "--lang" in sys.argv else "en"
V = json.load(open(os.path.join(ROOT, "app", "data", f"voice.{LANG}.json")))
VOICE, RATE = V["voice"], V["rate"]  # owner 2026-11-19: -5% was "way too fast" -> -20%
OUT = os.path.join(ROOT, "media", "voice", LANG)
IDX = os.path.join(ROOT, "tools", "voice", f"index.{LANG}.json")


def cat(n):
    """Intl.PluralRules category (en/tr: one/other; ar: zero/one/two/few/many/other)"""
    if not float(n).is_integer():
        return "other"
    n = int(n)
    if LANG == "ar":
        return "zero" if n == 0 else "one" if n == 1 else "two" if n == 2 else "few" if 3 <= n % 100 <= 10 else "many" if 11 <= n % 100 <= 99 else "other"
    return "one" if n == 1 else "other"


def num(w):
    return str(int(w)) if float(w).is_integer() else str(w).replace(".", V["dec"])


def pl(key, n):
    f = V[key]
    return f.get(cat(n), f["other"]).replace("{n}", num(n))


def fill(key, **kv):
    s = V[key]
    for k, v in kv.items():
        s = s.replace("{" + k + "}", str(v))
    return s


def duration(sec):
    m, s = divmod(sec, 60)
    if not m:
        return pl("sec", s)
    return fill("minsec", m=pl("min", m), s=pl("sec", s)) if s else pl("min", m)


def clips():
    c = {}
    for sec in range(15, 601, 15):
        c[f"p/rest-{sec}"] = fill("rest", d=duration(sec))  # owner: "Set done" was hard to hear
    c.update({"p/ten": V["ten"], "p/n1": "1", "p/n2": "2", "p/n3": "3", "p/go": V["go"], "p/rest": V["ivrest"],
              "p/restover": V["restover"], "p/timeup": V["timeup"], "p/ivdone": V["ivdone"], "p/work": V["work"],
              "p/warm": V["warm"], "p/last": V["last"], "p/cues": V["cues"], "p/voiceon": V["voiceon"]})
    for sec in range(10, 181, 5):  # Q21 timed sets: "Hold for 60 seconds." (voice.js holdKey)
        c[f"p/hold-{sec}"] = fill("hold", d=duration(sec))
    for m in range(1, 13):
        for n in range(1, m + 1):
            c[f"p/set-{n}-of-{m}"] = fill("set", n=n, m=m)
    for m in range(1, 31):
        for n in range(1, m + 1):
            c[f"p/round-{n}-of-{m}"] = fill("round", n=n, m=m)
    ws = {x / 2 for x in range(1, 601)} | set(range(1, 401))
    for w in sorted(ws):
        c[f"kg/{w:g}"] = pl("kg", w)
    for n in range(1, 51):
        c[f"r/{n}"] = pl("reps", n)
        c[f"fr/{n}"] = pl("forReps", n)
    if V["names"] == "own":
        for e in json.load(open(os.path.join(ROOT, "app", "data", "exercises.json"))):
            c[f"x/{e['slug']}"] = e["name"].strip() + "."
    fam = json.load(open(os.path.join(ROOT, "app", "data", f"families.{LANG}.json")))["families"]
    for k, f in fam.items():
        for i, s in enumerate(f.get("steps") or []):
            c[f"f/{k}-s{i}"] = fill("step", n=i + 1, s=s)
        for i, s in enumerate(f.get("cues") or []):
            c[f"f/{k}-c{i}"] = s if s.rstrip()[-1:] in ".!?" else s + "."
    return c


def key_hash(text):
    return hashlib.sha1(f"{VOICE}|{RATE}|{text}".encode()).hexdigest()[:12]


async def make(key, text, sem):
    path = os.path.join(OUT, key + ".mp3")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    async with sem:
        for attempt in range(6):
            try:
                with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
                    async for ch in edge_tts.Communicate(text, VOICE, rate=RATE).stream():
                        if ch["type"] == "audio":
                            tmp.write(ch["data"])
                if os.path.getsize(tmp.name) > 0:
                    break
            except Exception as error:  # network hiccups: try again
                print("  retry", key, repr(error)[:100], flush=True)
            await asyncio.sleep(2 * (attempt + 1))
        else:
            raise RuntimeError(f"no audio for {key}")
        # trim leading/trailing silence so pieces join tightly; 24 kHz mono 32 kbit/s
        af = "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse"
        p = await asyncio.create_subprocess_exec("ffmpeg", "-loglevel", "error", "-y", "-i", tmp.name, "-af", af, "-ac", "1", "-ar", "24000",
                                                 "-b:a", "32k", "-metadata", "comment=Gym, Microsoft Edge neural voice", path)
        await p.wait()
        os.unlink(tmp.name)
        if p.returncode:
            raise RuntimeError(f"ffmpeg failed for {key}")


async def main():
    c = clips()
    if "--only" in sys.argv:  # sample clips, e.g. to pick a voice: --only p/go,p/rest-150,kg/42.5
        keep = sys.argv[sys.argv.index("--only") + 1].split(",")
        c = {k: v for k, v in c.items() if k in keep}
    if "--list" in sys.argv:
        print(len(c), "clips,", sum(map(len, c.values())), "characters")
        return
    idx = {} if "--all" in sys.argv or not os.path.exists(IDX) else json.load(open(IDX))
    todo = [(k, t) for k, t in c.items() if idx.get(k) != key_hash(t) or not os.path.exists(os.path.join(OUT, k + ".mp3"))]
    print(f"{len(c)} clips, {len(todo)} to make", flush=True)
    sem = asyncio.Semaphore(8)
    done = 0
    for i in range(0, len(todo), 200):
        batch = todo[i:i + 200]
        await asyncio.gather(*(make(k, t, sem) for k, t in batch))
        for k, t in batch:
            idx[k] = key_hash(t)
        done += len(batch)
        json.dump(dict(sorted(idx.items())), open(IDX, "w"), indent=0)
        print(f"  {done}/{len(todo)}", flush=True)
    for k in list(idx):  # clips whose text is gone
        if k not in c and "--only" not in sys.argv:
            idx.pop(k)
            try:
                os.unlink(os.path.join(OUT, k + ".mp3"))
            except FileNotFoundError:
                pass
    json.dump(dict(sorted(idx.items())), open(IDX, "w"), indent=0)


asyncio.run(main())
