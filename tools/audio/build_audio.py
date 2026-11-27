"""PrintFarm Tycoon: procedural sound-effect & music synthesis (AUDIO brief, docs/specs/AUDIO.md).

Run:   python3 tools/audio/build_audio.py [name ...]
Output public/assets/audio/<name>.ogg  +  docs/qa/audio_sheet.png (spectrograms) + a peak/loop report.

Every sound is built from layered oscillators, filtered noise, resonators and envelopes.
Loops are made seamless with an equal-power crossfade of the tail into the head.
"""
from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 44100
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public/assets/audio"
QA = ROOT / "docs/qa"
OUT.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(42)


# ----------------------------------------------------------------------------- primitives
def t_(dur):
    return np.arange(int(dur * SR)) / SR


def noise(dur, color="white"):
    n = rng.standard_normal(int(dur * SR))
    if color == "pink":
        b, a = [0.049922035, -0.095993537, 0.050612699, -0.004408786], [1, -2.494956002, 2.017265875, -0.522189400]
        n = signal.lfilter(b, a, n)
    elif color == "brown":
        n = np.cumsum(n)
        n = signal.lfilter([1, -1], [1, -0.995], n)
    return n / (np.max(np.abs(n)) + 1e-9)


def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], btype="bandpass", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def lp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype="lowpass", fs=SR, output="sos"), x)


def hp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype="highpass", fs=SR, output="sos"), x)


def reson(x, f, q=20.0):
    """Resonant peak (2nd-order bandpass with high Q)."""
    b, a = signal.iirpeak(f, q, fs=SR)
    return signal.lfilter(b, a, x)


def env(n, a=0.005, d=0.1, s=0.0, r=0.05, hold=0.0):
    """ADSR-ish envelope for n samples (times in seconds)."""
    A, D, H, R = int(a * SR), int(d * SR), int(hold * SR), int(r * SR)
    e = np.zeros(n)
    i = 0
    seg = np.linspace(0, 1, max(A, 1))
    e[i:i + len(seg)] = seg[: n - i]
    i += len(seg)
    if i < n:
        seg = np.linspace(1, s, max(D, 1))
        e[i:i + len(seg)] = seg[: n - i]
        i += len(seg)
    if i < n and H:
        e[i:i + H] = s
        i += H
    if i < n:
        seg = np.linspace(s, 0, max(R, 1))
        e[i:i + len(seg)] = seg[: n - i]
        i += len(seg)
    return e


def expdecay(n, tau):
    return np.exp(-np.arange(n) / (tau * SR))


def square(f, dur, duty=0.5):
    return signal.square(2 * np.pi * np.cumsum(np.broadcast_to(f, t_(dur).shape)) / SR, duty)


def sine(f, dur, phase=0.0):
    return np.sin(2 * np.pi * np.cumsum(np.broadcast_to(f, t_(dur).shape)) / SR + phase)


def saw(f, dur):
    return signal.sawtooth(2 * np.pi * np.cumsum(np.broadcast_to(f, t_(dur).shape)) / SR)


def place(buf, x, at):
    i = int(at * SR)
    j = min(len(buf), i + len(x))
    if i < len(buf):
        buf[i:j] += x[: j - i]
    return buf


def mix(*xs):
    n = max(len(x) for x in xs)
    out = np.zeros(n)
    for x in xs:
        out[: len(x)] += x
    return out


def loopify(x, xfade=0.5):
    """Make a seamless loop: crossfade the last xfade seconds into the start (equal power)."""
    n = int(xfade * SR)
    head, body, tail = x[:n], x[n:-n] if n else x, x[-n:]
    w = np.linspace(0, np.pi / 2, n)
    blended = tail * np.cos(w) + head * np.sin(w)
    return np.concatenate([blended, body])


def norm(x, peak_db=-1.0):
    p = np.max(np.abs(x)) + 1e-9
    return x / p * (10 ** (peak_db / 20))


def fade(x, fin=0.002, fout=0.01):
    a, b = int(fin * SR), int(fout * SR)
    if a:
        x[:a] *= np.linspace(0, 1, a)
    if b:
        x[-b:] *= np.linspace(1, 0, b)
    return x


REPORT = []


def save(name, x, peak_db=-1.0, loop=False, stereo=None):
    x = np.asarray(x, dtype=np.float64)
    if not loop:
        x = fade(x)
    x = norm(x, peak_db)
    data = x if stereo is None else np.stack([x, stereo * (np.max(np.abs(x)) / (np.max(np.abs(stereo)) + 1e-9))], 1)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        wavfile.write(f.name, SR, (data * 32767).astype(np.int16))
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", f.name, "-c:a", "libvorbis", "-q:a", "5",
                        str(OUT / f"{name}.ogg")], check=True)
    seam = abs(x[0] - x[-1]) if loop else 0.0
    REPORT.append((name, len(x) / SR, 20 * np.log10(np.max(np.abs(x)) + 1e-9), 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9), seam))
    SPECS.append((name, x))


SPECS: list = []


# ----------------------------------------------------------------------------- printer sounds
def printer_steppers_loop():
    """Stepper 'singing': several axes stepping at changing rates (stepper whine + frame resonance)."""
    dur = 8.0
    out = np.zeros(int(dur * SR))
    for voice, (lo, hi, gain) in enumerate([(260, 1400, 1.0), (180, 900, 0.7), (90, 320, 0.5)]):
        tpos = 0.0
        f_prev = rng.uniform(lo, hi)
        while tpos < dur:
            seg = rng.uniform(0.06, 0.35) if voice < 2 else rng.uniform(0.3, 1.2)
            f = rng.uniform(lo, hi)
            n = int(seg * SR)
            # accelerate from previous rate to new one (trapezoid move profile)
            ramp = np.concatenate([np.linspace(f_prev * 0.6, f, n // 4), np.full(n - n // 4, f)])
            ph = 2 * np.pi * np.cumsum(ramp) / SR
            w = np.sign(np.sin(ph)) * 0.6 + np.sin(ph * 2) * 0.25 + np.sin(ph * 3) * 0.12
            e = np.ones(n)
            e[: n // 8] = np.linspace(0.2, 1, n // 8)
            if rng.random() < 0.25:  # short pause between moves
                e[-n // 5:] = 0
            place(out, w * e * gain, tpos)
            tpos += seg
            f_prev = f
    out = bp(out, 120, 5000)
    body = reson(out, 185, 6) * 0.6 + reson(out, 430, 8) * 0.4 + reson(out, 1250, 10) * 0.2
    out = out * 0.35 + body
    out += bp(noise(dur, "pink"), 300, 6000) * 0.04
    save("printer_steppers_loop", loopify(out, 0.4), -6, loop=True)


def printer_fan_loop():
    dur = 5.0
    n = noise(dur, "pink")
    air = bp(n, 400, 7000) * 0.7
    blade = reson(noise(dur), 232, 30) * 0.5 + reson(noise(dur), 464, 40) * 0.25
    hum = sine(232, dur) * 0.04 + sine(116, dur) * 0.03
    save("printer_fan_loop", loopify(air + blade + hum, 0.4), -8, loop=True)


def printer_home():
    dur = 1.6
    out = np.zeros(int(dur * SR))
    for i, (f0, f1, at, ln) in enumerate([(300, 1200, 0.0, 0.45), (1200, 200, 0.5, 0.3), (200, 900, 0.85, 0.4)]):
        n = int(ln * SR)
        f = np.linspace(f0, f1, n)
        w = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * env(n, 0.01, ln * 0.8, 0.6, 0.05)
        place(out, w * 0.5, at)
    for at in (0.46, 0.82, 1.27):
        click = hp(noise(0.012), 2000) * expdecay(int(0.012 * SR), 0.002)
        place(out, click * 1.5, at)
    out = bp(out, 150, 6000)
    out = out + reson(out, 185, 6) * 0.5
    save("printer_home", out, -4)


def beep(f, dur, vol=1.0):
    n = int(dur * SR)
    w = signal.square(2 * np.pi * f * np.arange(n) / SR) * 0.6 + np.sin(2 * np.pi * f * np.arange(n) / SR) * 0.4
    return lp(w, 6000) * env(n, 0.003, 0.02, 0.8, 0.02, hold=dur - 0.05) * vol


def printer_done():
    out = np.zeros(int(1.3 * SR))
    for i, f in enumerate((1568, 1976, 2349)):  # G6 B6 D7 (piezo melody)
        place(out, beep(f, 0.16), i * 0.18)
    place(out, beep(3136, 0.35, 0.8), 0.6)
    save("printer_done", out, -3)


def printer_alarm():
    out = np.zeros(int(1.2 * SR))
    for i in range(4):
        place(out, beep(2730 if i % 2 == 0 else 2300, 0.12), i * 0.22)
    save("printer_alarm", out, -3)


def bed_flex_pop():
    dur = 0.9
    n = int(dur * SR)
    thump = sine(np.linspace(140, 60, n), dur) * expdecay(n, 0.05)
    click = hp(noise(dur), 2500) * expdecay(n, 0.004)
    ring = (reson(noise(dur), 620, 60) + reson(noise(dur), 1350, 80) * 0.6) * expdecay(n, 0.18) * 6
    flex = bp(noise(dur), 400, 2000) * env(n, 0.02, 0.15, 0.0, 0.05) * 0.3
    out = place(np.zeros(n), flex, 0.0)
    out = place(out, thump + click * 0.9 + ring * 0.3, 0.12)
    save("bed_flex_pop", out, -2)


def spaghetti_rip():
    dur = 1.4
    n = int(dur * SR)
    out = np.zeros(n)
    for _ in range(260):
        at = rng.uniform(0, dur * 0.9)
        ln = rng.uniform(0.002, 0.012)
        m = int(ln * SR)
        c = hp(noise(ln), rng.uniform(1500, 4000)) * expdecay(m, ln / 3) * rng.uniform(0.2, 1.0)
        place(out, c, at)
    body = bp(noise(dur, "pink"), 500, 3000) * env(n, 0.05, 0.6, 0.3, 0.6) * 0.25
    out = out * env(n, 0.01, 0.5, 0.6, 0.6) + body
    save("spaghetti_rip", out, -2)


def plastic_click(f1, f2, at, out, vol=1.0):
    m = int(0.08 * SR)
    x = noise(0.08) * expdecay(m, 0.004)
    y = reson(x, f1, 25) * 3 + reson(x, f2, 30) * 2 + hp(x, 3000) * 0.5
    place(out, y * vol, at)


def spool_swap():
    out = np.zeros(int(1.0 * SR))
    plastic_click(900, 2300, 0.0, out)
    plastic_click(1100, 2600, 0.18, out, 0.7)
    for k in range(6):
        plastic_click(rng.uniform(1500, 3000), rng.uniform(3000, 5000), 0.3 + k * 0.06, out, 0.25)
    plastic_click(800, 1900, 0.7, out, 0.9)
    save("spool_swap", out, -2)


def footsteps():
    for i in range(4):
        dur = 0.35
        n = int(dur * SR)
        heel = sine(np.linspace(110 + i * 8, 55, n), dur) * expdecay(n, 0.03)
        grit = bp(noise(dur), 900 + i * 150, 5000) * expdecay(n, 0.018) * 0.5
        scuff = bp(noise(dur), 2000, 8000) * env(n, 0.02, 0.06, 0, 0.02) * 0.15
        out = mix(heel, grit, place(np.zeros(n), scuff, 0.05 + i * 0.01))
        save(f"footstep_concrete_{i + 1}", out, -6 - rng.uniform(0, 2))


def cardboard(dur, lo=250, hi=2500):
    n = int(dur * SR)
    x = bp(noise(dur, "pink"), lo, hi)
    x = x + reson(x, rng.uniform(300, 500), 8) * 0.4
    return x


def box_fold():
    dur = 1.1
    n = int(dur * SR)
    out = cardboard(dur) * env(n, 0.05, 0.3, 0.5, 0.4)
    for at in (0.25, 0.6, 0.9):
        m = int(0.15 * SR)
        place(out, cardboard(0.15, 150, 1200) * expdecay(m, 0.03) * 2.5, at)
    save("box_fold", out, -3)


def tape_rip():
    dur = 0.9
    n = int(dur * SR)
    x = noise(dur)
    flutter = 0.6 + 0.4 * np.sign(np.sin(2 * np.pi * np.linspace(40, 90, n) * np.arange(n) / SR))
    sweep = np.zeros(n)
    for f0 in (1800, 3200):
        fc = np.linspace(f0, f0 * 1.6, n)
        seg = 2048
        for k in range(0, n, seg):
            c = fc[k]
            sweep[k:k + seg] += bp(x[k:k + seg], c * 0.8, min(c * 1.25, 20000))
    out = sweep * flutter * env(n, 0.02, 0.2, 0.8, 0.15, hold=0.4)
    out += bp(noise(dur), 150, 600) * env(n, 0.01, 0.1, 0.3, 0.3) * 0.3
    save("tape_rip", out, -3)


def paper_crinkle():
    dur = 1.0
    n = int(dur * SR)
    out = np.zeros(n)
    for _ in range(180):
        ln = rng.uniform(0.003, 0.025)
        m = int(ln * SR)
        c = bp(noise(ln), rng.uniform(1500, 3500), rng.uniform(5000, 11000)) * expdecay(m, ln / 2) * rng.uniform(0.1, 1)
        place(out, c, rng.uniform(0, dur * 0.92))
    out *= env(n, 0.05, 0.4, 0.7, 0.4)
    save("paper_crinkle", out, -4)


def label_print():
    dur = 1.0
    n = int(dur * SR)
    motor = bp(saw(np.full(n, 140.0) + 8 * np.sin(np.arange(n) / SR * 30), dur), 100, 3000) * env(n, 0.03, 0.1, 0.7, 0.05, hold=0.6)
    whine = sine(np.full(n, 2100.0), dur) * env(n, 0.03, 0.1, 0.5, 0.05, hold=0.6) * 0.1
    cut = np.zeros(n)
    plastic_click(1800, 4200, 0.85, cut, 1.5)
    save("label_print", motor + whine + cut, -4)


def thud(dur, f0, f1, tau, grit=0.3, bright=2000):
    n = int(dur * SR)
    return sine(np.linspace(f0, f1, n), dur) * expdecay(n, tau) + bp(noise(dur), 200, bright) * expdecay(n, tau * 0.5) * grit


def handling():
    save("box_place", mix(thud(0.4, 160, 70, 0.05, 0.5, 1500), cardboard(0.4) * expdecay(int(0.4 * SR), 0.04) * 0.6), -4)
    out = np.zeros(int(0.3 * SR))
    plastic_click(700, 1800, 0.0, out, 0.7)
    save("item_pickup", mix(out, bp(noise(0.3), 800, 4000) * env(int(0.3 * SR), 0.02, 0.1, 0, 0.05) * 0.3), -6)
    out = np.zeros(int(0.35 * SR))
    plastic_click(500, 1400, 0.0, out, 1.0)
    save("item_place", mix(out, thud(0.35, 200, 90, 0.03, 0.2)), -5)


def door_open():
    dur = 1.4
    n = int(dur * SR)
    latch = np.zeros(n)
    plastic_click(1200, 3400, 0.0, latch, 1.2)
    plastic_click(900, 2500, 0.08, latch, 0.8)
    f = 300 + 120 * np.sin(np.linspace(0, 6, n)) + np.linspace(0, 200, n)
    creak = saw(f, dur) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 38 * np.arange(n) / SR)))
    creak = bp(creak, 250, 2500) * env(n, 0.15, 0.4, 0.4, 0.5) * 0.35
    save("door_open", latch + place(np.zeros(n), creak, 0.2)[:n], -3)


def courier_van():
    dur = 6.0
    n = int(dur * SR)
    tt = np.arange(n) / SR
    approach = np.clip(tt / 2.5, 0, 1)
    leave = np.clip((dur - tt) / 1.5, 0, 1)
    rpm = 38 + 10 * approach - 6 * (tt > 3.0)
    engine = sum(np.sin(2 * np.pi * np.cumsum(rpm * k) / SR) / k for k in (1, 2, 3, 4, 6))
    engine = lp(engine + bp(noise(dur, "brown"), 30, 300) * 0.8, 900) * approach * leave
    horn = np.zeros(n)
    for at in (3.2, 3.55):
        m = int(0.25 * SR)
        hn = (saw(np.full(m, 392.0), 0.25) + saw(np.full(m, 494.0), 0.25)) * env(m, 0.01, 0.05, 0.8, 0.05, hold=0.15)
        place(horn, bp(hn, 300, 3000) * 0.35, at)
    slam = np.zeros(n)
    place(slam, thud(0.5, 90, 40, 0.08, 0.8, 1200) * 1.5, 4.3)
    save("courier_van", lp(engine * 0.6 + horn + slam, 6000), -3)


# ----------------------------------------------------------------------------- UI
def ui():
    n = int(0.03 * SR)
    save("ui_hover", sine(np.full(n, 2400.0), 0.03) * expdecay(n, 0.006) * 0.5, -14)
    n = int(0.09 * SR)
    c = sine(np.linspace(1400, 900, n), 0.09) * expdecay(n, 0.02) + hp(noise(0.09), 4000) * expdecay(n, 0.002) * 0.4
    save("ui_click", c, -8)
    n = int(0.12 * SR)
    save("ui_back", sine(np.linspace(900, 500, n), 0.12) * expdecay(n, 0.03), -9)
    n = int(0.1 * SR)
    save("ui_toggle", mix(sine(np.full(n, 1200.0), 0.1) * expdecay(n, 0.015), place(np.zeros(n), sine(np.full(n // 2, 1800.0), 0.05) * expdecay(n // 2, 0.01), 0.04)), -9)
    n = int(0.3 * SR)
    save("ui_error", square(np.full(n, 180.0), 0.3) * env(n, 0.005, 0.05, 0.6, 0.05, hold=0.15) * 0.5 + square(np.full(n, 190.0), 0.3) * 0.3 * env(n, 0.005, 0.05, 0.6, 0.05, hold=0.15), -10)


def bell(f, dur, partials=((1, 1), (2.0, 0.5), (3.01, 0.25), (4.2, 0.12)), tau=0.4):
    n = int(dur * SR)
    return sum(sine(np.full(n, f * k), dur) * a * expdecay(n, tau / k ** 0.5) for k, a in partials)


def notifications():
    out = np.zeros(int(1.0 * SR))
    place(out, bell(1046.5, 0.9, tau=0.35), 0.0)
    place(out, bell(1568, 0.8, tau=0.35), 0.12)
    save("notif_mail", out, -6)
    out = np.zeros(int(0.8 * SR))
    place(out, bell(1760, 0.7, tau=0.25), 0)
    place(out, bell(2637, 0.6, tau=0.2), 0.08)
    save("notif_order", out, -6)
    out = np.zeros(int(1.3 * SR))
    place(out, bell(2093, 1.0, ((1, 1), (2.76, 0.6), (5.4, 0.3)), tau=0.5), 0.05)
    for k in range(10):
        m = int(0.05 * SR)
        place(out, bp(noise(0.05), 4000, 12000) * expdecay(m, 0.01) * rng.uniform(0.2, 0.6), 0.25 + k * 0.04 + rng.uniform(0, 0.02))
    place(out, thud(0.2, 300, 120, 0.02, 0.4), 0.0)
    save("cash", out, -4)
    dur = 0.6
    n = int(dur * SR)
    x = noise(dur, "pink")
    w = np.zeros(n)
    seg = 1024
    fc = np.concatenate([np.linspace(300, 3000, n // 2), np.linspace(3000, 1200, n - n // 2)])
    for k in range(0, n, seg):
        w[k:k + seg] = bp(x[k:k + seg], fc[k] * 0.7, fc[k] * 1.4)
    save("laptop_open", w * env(n, 0.08, 0.2, 0.4, 0.3), -10)
    out = np.zeros(int(0.4 * SR))
    place(out, beep(3000, 0.06, 0.7), 0)
    save("printer_beep", out, -8)


# ----------------------------------------------------------------------------- ambience & music
def room_tone_loop():
    dur = 12.0
    n = int(dur * SR)
    base = lp(noise(dur, "brown"), 300) * 0.6
    hum = (sine(np.full(n, 60.0), dur) * 0.05 + sine(np.full(n, 120.0), dur) * 0.03) * (1 + 0.2 * np.sin(np.arange(n) / SR * 0.7))
    traffic = lp(noise(dur, "pink"), 900) * (0.3 + 0.7 * np.clip(np.sin(np.arange(n) / SR * 2 * np.pi / 6.0), 0, 1) ** 2) * 0.25
    birds = np.zeros(n)
    for _ in range(5):
        at = rng.uniform(0.5, dur - 1)
        for k in range(rng.integers(2, 5)):
            m = int(0.09 * SR)
            f = rng.uniform(3000, 4500)
            chirp = sine(np.linspace(f, f * 1.3, m), 0.09) * env(m, 0.01, 0.05, 0.2, 0.02)
            place(birds, chirp * 0.04, at + k * 0.12)
    save("room_tone_loop", loopify(base + hum + traffic + lp(birds, 6000), 1.0), -14, loop=True)


def epiano(f, dur, vel=1.0):
    """FM electric piano (Rhodes-ish)."""
    n = int(dur * SR)
    tt = np.arange(n) / SR
    mod = np.sin(2 * np.pi * f * 1.0 * tt) * 1.2 * np.exp(-tt * 3)
    car = np.sin(2 * np.pi * f * tt + mod)
    bellp = np.sin(2 * np.pi * f * 14 * tt) * 0.04 * np.exp(-tt * 20)
    return (car + bellp) * np.exp(-tt * 1.2) * vel * np.clip(tt * 200, 0, 1)


def music_lofi_loop():
    bpm = 78
    beat = 60 / bpm
    bars = 8
    dur = bars * 4 * beat
    n = int(dur * SR)
    out = np.zeros(n)
    midi = lambda m: 440 * 2 ** ((m - 69) / 12)
    prog = [[48, 52, 55, 59], [45, 48, 52, 55], [50, 53, 57, 60], [43, 47, 50, 53]]  # Cmaj7 Am7 Dm7 G7
    for bar in range(bars):
        chord = prog[bar % 4]
        t0 = bar * 4 * beat
        for hit, length in ((0, 1.6), (1.75, 0.7), (2.5, 1.4)):
            for k, m in enumerate(chord):
                place(out, epiano(midi(m + 12), length * beat + 0.6, 0.16) , t0 + hit * beat + k * 0.012)
        # bass
        place(out, lp(saw(np.full(int(beat * 1.9 * SR), midi(chord[0] - 12)), beat * 1.9), 400) * env(int(beat * 1.9 * SR), 0.01, 0.4, 0.5, 0.2) * 0.3, t0)
        place(out, lp(saw(np.full(int(beat * 1.4 * SR), midi(chord[0] - 12 + 7)), beat * 1.4), 400) * env(int(beat * 1.4 * SR), 0.01, 0.3, 0.5, 0.2) * 0.25, t0 + 2.5 * beat)
        # melody sprinkle
        if bar % 2 == 1:
            for j, m in enumerate([chord[3] + 12, chord[2] + 12, chord[1] + 24]):
                place(out, epiano(midi(m), 0.6, 0.08), t0 + (0.5 + j * 0.75) * beat)
    drums = np.zeros(n)
    for b in range(bars * 4):
        t0 = b * beat
        swing = 0.04 if b % 2 else 0
        if b % 4 in (0, 2) or (b % 8 == 7):
            m = int(0.35 * SR)
            place(drums, sine(np.linspace(110, 40, m), 0.35) * expdecay(m, 0.07) * 0.9, t0 + (0.5 * beat if b % 8 == 7 else 0))
        if b % 4 in (1, 3):
            m = int(0.3 * SR)
            sn = bp(noise(0.3), 800, 6000) * expdecay(m, 0.06) * 0.35 + sine(np.full(m, 190.0), 0.3) * expdecay(m, 0.04) * 0.3
            place(drums, sn, t0)
        for h in (0, 0.5):
            m = int(0.06 * SR)
            place(drums, hp(noise(0.06), 7000) * expdecay(m, 0.012) * (0.12 if h == 0 else 0.07), t0 + h * beat + (swing if h else 0))
    crackle = np.zeros(n)
    for _ in range(int(dur * 14)):
        m = int(0.004 * SR)
        place(crackle, hp(noise(0.004), 2000) * rng.uniform(0.02, 0.12), rng.uniform(0, dur))
    full = lp(out, 3800) + lp(drums, 9000) * 0.8 + crackle + lp(noise(dur, "pink"), 3000) * 0.01
    # tape wobble
    wob = 1 + 0.002 * np.sin(2 * np.pi * 0.6 * np.arange(n) / SR)
    idx = np.clip(np.cumsum(wob) - 1, 0, n - 1)
    full = np.interp(idx, np.arange(n), full)
    save("music_lofi_loop", loopify(full, 0.25), -3, loop=True)



# ----------------------------------------------------------------------------- M2: incidents, dryers, multi-material
def power_down():
    """Mains drops: relay clunk, every fan and transformer spinning down, fluorescent tick."""
    dur = 2.6
    n = int(dur * SR)
    tt = np.arange(n) / SR
    clunk = (sine(np.linspace(90, 45, n), dur) * expdecay(n, 0.06) + hp(noise(dur), 1500) * expdecay(n, 0.005) * 0.6)
    f = 120 * np.exp(-tt * 1.4) + 8
    hum = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 1.1) * 0.25
    fans = bp(noise(dur, "pink"), 300, 5000) * np.exp(-tt * 1.6) * 0.6
    fb = reson(noise(dur), 232, 30) * np.exp(-tt * 2.5) * 0.4
    out = clunk + hum + fans + fb
    for at in (0.05, 0.11):
        place(out, hp(noise(0.01), 3000) * expdecay(int(0.01 * SR), 0.002) * 0.5, at)
    save("power_down", out, -3)


def power_up():
    """Mains back: relay clack, transformer hum swelling in, fans spinning up, a few printer chirps."""
    dur = 2.4
    n = int(dur * SR)
    tt = np.arange(n) / SR
    clack = hp(noise(dur), 1200) * expdecay(n, 0.006) + sine(np.linspace(140, 70, n), dur) * expdecay(n, 0.04) * 0.6
    rise = np.clip(tt / 1.2, 0, 1)
    hum = (sine(np.full(n, 60.0), dur) * 0.2 + sine(np.full(n, 120.0), dur) * 0.12) * rise
    fans = bp(noise(dur, "pink"), 300, 5000) * rise ** 2 * 0.35
    out = clack + hum + fans
    for i, at in enumerate((0.9, 1.25, 1.5)):
        place(out, beep(2600 + i * 300, 0.08, 0.35), at)
    save("power_up", out, -4)


def dryer_hum_loop():
    """Filament dryer: small PTC heater fan, slightly rattly housing."""
    dur = 6.0
    n = int(dur * SR)
    air = bp(noise(dur, "pink"), 250, 4000) * 0.5
    blade = reson(noise(dur), 180, 35) * 0.35 + reson(noise(dur), 360, 40) * 0.18
    hum = sine(np.full(n, 100.0), dur) * 0.03
    rattle = reson(noise(dur), 1800, 12) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.5 * np.arange(n) / SR)) * 0.03
    save("dryer_hum_loop", loopify(air + blade + hum + rattle, 0.5), -12, loop=True)


def ams_feed():
    """AMS lite filament change: gear motor whirr retracting, click of the buffer, feed again."""
    dur = 2.2
    out = np.zeros(int(dur * SR))
    for at, ln, f0, f1 in ((0.0, 0.8, 900, 1300), (1.05, 0.9, 1300, 900)):
        m = int(ln * SR)
        f = np.linspace(f0, f1, m)
        ph = 2 * np.pi * np.cumsum(f) / SR
        w = (np.sign(np.sin(ph)) * 0.4 + np.sin(ph * 3) * 0.2) * env(m, 0.05, ln * 0.7, 0.8, 0.1)
        w = bp(w, 300, 6000) + bp(noise(ln), 2000, 8000) * env(m, 0.05, ln, 0.6, 0.1) * 0.08
        place(out, w * 0.6, at)
    plastic_click(1400, 3100, 0.88, out, 0.8)
    plastic_click(1100, 2500, 2.0, out, 0.6)
    save("ams_feed", out, -4)


def toolchange():
    """Toolchanger (Prusa XL / Snapmaker U1): carriage dash, magnetic clack on park, pick-up clack."""
    dur = 1.3
    out = np.zeros(int(dur * SR))
    m = int(0.35 * SR)
    f = np.linspace(500, 1600, m)
    dash = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * env(m, 0.01, 0.3, 0.5, 0.05) * 0.35
    place(out, bp(dash, 200, 5000), 0.0)
    for at, vol in ((0.38, 1.0), (0.78, 0.8)):
        k = int(0.1 * SR)
        hit = noise(0.1) * expdecay(k, 0.005)
        y = reson(hit, 720, 20) * 3 + reson(hit, 2400, 30) * 1.5 + sine(np.linspace(150, 80, k), 0.1) * expdecay(k, 0.02)
        place(out, y * vol, at)
    m2 = int(0.3 * SR)
    f2 = np.linspace(1400, 600, m2)
    place(out, bp(np.sign(np.sin(2 * np.pi * np.cumsum(f2) / SR)) * env(m2, 0.01, 0.25, 0.4, 0.05) * 0.3, 200, 5000), 0.9)
    save("toolchange", out, -3)


def error_alarm():
    """Printer error: insistent two-tone piezo triple, repeated."""
    out = np.zeros(int(1.6 * SR))
    for r in range(2):
        for i in range(3):
            place(out, beep(3100, 0.09), r * 0.75 + i * 0.13)
        place(out, beep(2100, 0.22), r * 0.75 + 0.42)
    save("error_alarm", out, -3)


def rain_loop():
    """Rain on the garage roof and gutter: dense drops + hiss + occasional drip."""
    dur = 10.0
    n = int(dur * SR)
    hiss = bp(noise(dur, "pink"), 800, 9000) * 0.35
    roof = lp(noise(dur, "brown"), 500) * 0.3
    drops = np.zeros(n)
    for _ in range(int(dur * 180)):
        m = int(0.006 * SR)
        place(drops, hp(noise(0.006), rng.uniform(1500, 5000)) * expdecay(m, 0.0015) * rng.uniform(0.05, 0.4), rng.uniform(0, dur - 0.01))
    drip = np.zeros(n)
    for k in range(int(dur * 1.3)):
        m = int(0.08 * SR)
        f = rng.uniform(900, 1500)
        place(drip, sine(np.linspace(f, f * 1.6, m), 0.08) * expdecay(m, 0.015) * 0.15, rng.uniform(0, dur - 0.1))
    save("rain_loop", loopify(hiss + roof + drops + drip, 0.8), -10, loop=True)


# ----------------------------------------------------------------------------- spectrogram QA sheet
def qa_sheet():
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    cols = 5
    rows = (len(SPECS) + cols - 1) // cols
    fig, axes = plt.subplots(rows, cols, figsize=(cols * 3.2, rows * 2.2), facecolor="#111")
    for ax in axes.flat:
        ax.axis("off")
    for ax, (name, x) in zip(axes.flat, SPECS):
        ax.specgram(x[: SR * 6], NFFT=1024, Fs=SR, noverlap=512, cmap="magma")
        ax.set_ylim(0, 12000)
        ax.set_title(name, color="w", fontsize=8)
    plt.tight_layout()
    fig.savefig(QA / "audio_sheet.png", dpi=70, facecolor="#111")


ALL = [printer_steppers_loop, printer_fan_loop, printer_home, printer_done, printer_alarm, bed_flex_pop, spaghetti_rip,
       spool_swap, box_fold, tape_rip, paper_crinkle, label_print, handling, door_open, courier_van, ui,
       notifications, room_tone_loop, music_lofi_loop, power_down, power_up, dryer_hum_loop, ams_feed, toolchange,
       error_alarm, rain_loop]

if __name__ == "__main__":
    only = set(sys.argv[1:])
    for fn in ALL:
        if only and fn.__name__ not in only:
            continue
        fn()
    print(f"{'sound':28s} {'sec':>5s} {'peak dB':>8s} {'rms dB':>7s} {'loop seam':>9s}")
    bad = 0
    for name, dur, pk, rms, seam in REPORT:
        flag = "  CLIP!" if pk > -0.5 else ""
        flag += "  SEAM!" if seam > 0.05 else ""
        bad += bool(flag)
        print(f"{name:28s} {dur:5.2f} {pk:8.1f} {rms:7.1f} {seam:9.3f}{flag}")
    try:
        qa_sheet()
        print("spectrogram sheet → docs/qa/audio_sheet.png")
    except Exception as e:  # matplotlib optional
        print("no spectrogram sheet:", e)
    sys.exit(1 if bad else 0)
