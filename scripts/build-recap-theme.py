#!/usr/bin/env python3
"""
Gera a trilha do recap (`public/audio/recap-theme.mp3`).

A trilha é sintetizada aqui, do zero, de propósito: o vídeo do recap é servido
publicamente e uma faixa de terceiro traria licenciamento junto. Nada aqui é
amostrado de gravação nenhuma — são osciladores e envelopes.

O trecho é um loop exato de 8 compassos, então o `<Audio loop>` da composição
emenda sem costura, seja qual for a duração do vídeo.

    python3 scripts/build-recap-theme.py

Para trocar por uma faixa licenciada, basta substituir o mp3 de saída.
"""

import subprocess
import numpy as np

SR = 44100
BPM = 88
BEAT = 60.0 / BPM
BAR = BEAT * 4
BARS = 8
LOOP = BAR * BARS
TAIL = 3.0  # cauda que volta para o começo, para o loop não ter emenda

N = int(LOOP * SR)
NT = int((LOOP + TAIL) * SR)
t = np.arange(NT) / SR


def note(semitones_from_a4: float) -> float:
    return 440.0 * 2 ** (semitones_from_a4 / 12)


# Am - F - C - G, dois compassos cada.
CHORDS = [
    {"root": -12, "notes": [0, 3, 7, 12]},    # Am
    {"root": -16, "notes": [0, 4, 7, 12]},    # F
    {"root": -21, "notes": [0, 4, 7, 12]},    # C
    {"root": -14, "notes": [0, 4, 7, 11]},    # G
]

left = np.zeros(NT)
right = np.zeros(NT)


def add(buffer_l, buffer_r, start: float, samples: np.ndarray, pan: float = 0.0):
    """Soma `samples` na posição `start` (segundos), com pan em [-1, 1]."""
    i = int(start * SR)
    end = min(NT, i + len(samples))
    if i >= NT:
        return
    chunk = samples[: end - i]
    gain_l = np.sqrt((1 - pan) / 2)
    gain_r = np.sqrt((1 + pan) / 2)
    buffer_l[i:end] += chunk * gain_l
    buffer_r[i:end] += chunk * gain_r


def pad(freq: float, duration: float, amp: float) -> np.ndarray:
    """Voz de pad: fundamental mais harmônicos suaves, ataque lento."""
    n = int(duration * SR)
    x = np.arange(n) / SR
    voice = np.zeros(n)
    for detune, weight in ((-0.04, 0.5), (0.0, 1.0), (0.05, 0.5)):
        f = freq * 2 ** (detune / 12)
        voice += weight * np.sin(2 * np.pi * f * x)
        voice += weight * 0.22 * np.sin(2 * np.pi * f * 2 * x)
        voice += weight * 0.08 * np.sin(2 * np.pi * f * 3 * x)
    # Vibrato lento dá vida sem soar sintetizado demais.
    voice *= 1 + 0.015 * np.sin(2 * np.pi * 0.7 * x)
    attack = np.clip(x / 0.9, 0, 1) ** 2
    release = np.clip((duration - x) / 1.4, 0, 1)
    return voice * attack * release * amp


def pluck(freq: float, duration: float, amp: float) -> np.ndarray:
    """Nota percutida tipo marimba: decaimento exponencial e batida curta."""
    n = int(duration * SR)
    x = np.arange(n) / SR
    body = (
        np.sin(2 * np.pi * freq * x) * np.exp(-x * 4.2)
        + 0.45 * np.sin(2 * np.pi * freq * 2 * x) * np.exp(-x * 7.5)
        + 0.18 * np.sin(2 * np.pi * freq * 3.01 * x) * np.exp(-x * 12)
    )
    click = np.exp(-x * 260) * 0.25 * np.sin(2 * np.pi * freq * 6 * x)
    return (body + click) * amp


def sub(freq: float, duration: float, amp: float) -> np.ndarray:
    n = int(duration * SR)
    x = np.arange(n) / SR
    tone = np.sin(2 * np.pi * freq * x) + 0.12 * np.sin(2 * np.pi * freq * 2 * x)
    envelope = np.clip(x / 0.15, 0, 1) * np.clip((duration - x) / 0.5, 0, 1)
    return tone * envelope * amp


# --- pad e baixo, um par de compassos por acorde -------------------------
for index, chord in enumerate(CHORDS):
    start = index * BAR * 2
    for voice_index, semitone in enumerate(chord["notes"]):
        freq = note(chord["root"] + semitone)
        pan = -0.5 + voice_index * 0.33
        add(left, right, start, pad(freq, BAR * 2 + 0.6, 0.085), pan)
    add(left, right, start, sub(note(chord["root"] - 12), BAR * 2, 0.16), 0.0)

# --- arpejo em colcheias, pentatônica sobre o acorde ---------------------
PATTERN = [0, 2, 1, 3, 2, 1, 3, 2]
for bar_index in range(BARS):
    chord = CHORDS[bar_index // 2]
    for step in range(8):
        # Deixa o padrão respirar: um passo de cada compasso fica em silêncio.
        if step == (5 if bar_index % 2 else 7):
            continue
        degree = PATTERN[(step + bar_index) % len(PATTERN)]
        octave = 12 if step % 4 == 3 else 0
        freq = note(chord["root"] + chord["notes"][degree] + 12 + octave)
        # Acentua o tempo forte; o resto fica atrás.
        amp = 0.12 if step % 2 == 0 else 0.075
        start = bar_index * BAR + step * (BEAT / 2)
        pan = -0.35 if step % 2 == 0 else 0.35
        add(left, right, start, pluck(freq, 1.2, amp), pan)

# --- delay pontuado, só o suficiente para dar espaço ---------------------
delay_samples = int(BEAT * 0.75 * SR)
for repeat, gain in ((1, 0.32), (2, 0.12)):
    shift = delay_samples * repeat
    left[shift:] += left[:-shift] * gain * 0.9
    right[shift:] += right[:-shift] * gain

# --- ar: ruído filtrado bem baixo ----------------------------------------
rng = np.random.default_rng(7)
noise = rng.standard_normal(NT)
kernel = np.hanning(2048)
kernel /= kernel.sum()
air = np.convolve(noise, kernel, mode="same") * 0.02
air *= 0.6 + 0.4 * np.sin(2 * np.pi * 0.11 * t)
left += air
right += np.roll(air, 977)

# --- fecha o loop: a cauda volta para o começo ---------------------------
for buffer in (left, right):
    buffer[: NT - N] += buffer[N:]
left = left[:N]
right = right[:N]

stereo = np.stack([left, right], axis=1)
peak = np.max(np.abs(stereo))
# Sobra de headroom: a trilha entra por baixo da narrativa, não por cima.
stereo = stereo / peak * 0.5
pcm = (stereo * 32767).astype("<i2")

subprocess.run(
    [
        "ffmpeg", "-y", "-loglevel", "error",
        "-f", "s16le", "-ar", str(SR), "-ac", "2", "-i", "pipe:0",
        "-codec:a", "libmp3lame", "-b:a", "128k",
        "public/audio/recap-theme.mp3",
    ],
    input=pcm.tobytes(),
    check=True,
)
print(f"loop de {LOOP:.2f}s gravado em public/audio/recap-theme.mp3")
