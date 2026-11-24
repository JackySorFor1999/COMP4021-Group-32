"""Generate the project's original SVG sprites and five PCM WAV sound files.

All outputs are committed/delivered with the game; this script is optional and
requires only Python's standard library. No build step is needed to play.
"""
from pathlib import Path
import math
import struct
import wave

ROOT = Path(__file__).resolve().parents[1] / 'public' / 'assets'
ROOT.mkdir(parents=True, exist_ok=True)


def svg(content, width=256, height=64):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">{content}</svg>'


def courier(color, dark):
    frames = []
    for frame in range(4):
        bob = [0, -1, 0, -1][frame]
        left = [0, -3, 0, 3][frame]
        right = -left
        frames.append(f'''<g transform="translate({frame*64} {bob})">
          <rect x="19" y="{45+left}" width="10" height="10" rx="3" fill="#293f38"/>
          <rect x="36" y="{45+right}" width="10" height="10" rx="3" fill="#293f38"/>
          <rect x="13" y="28" width="38" height="22" rx="11" fill="{dark}"/>
          <rect x="18" y="28" width="29" height="22" rx="9" fill="{color}"/>
          <path d="M19 30L43 48" stroke="#ead5ac" stroke-width="5"/>
          <rect x="35" y="36" width="14" height="13" rx="3" fill="#b98249"/>
          <path d="M36 39H48" stroke="#e7c18a" stroke-width="2"/>
          <rect x="21" y="13" width="23" height="23" rx="10" fill="#efc69f"/>
          <path d="M21 21V19Q21 9 32 9Q45 9 45 21" fill="{dark}"/>
          <rect x="19" y="15" width="27" height="9" rx="4" fill="{color}"/>
          <rect x="36" y="21" width="13" height="4" rx="2" fill="{dark}"/>
          <circle cx="28" cy="27" r="1.5" fill="#37463a"/><circle cx="38" cy="27" r="1.5" fill="#37463a"/>
          <path d="M30 31Q33 33 36 31" fill="none" stroke="#bd896c" stroke-width="1.5"/>
        </g>''')
    return svg(''.join(frames))


for name, color, dark in [('blue', '#6faac5', '#397a9e'), ('coral', '#e89d83', '#bd705d')]:
    sheet = courier(color, dark)
    (ROOT / f'courier-{name}.svg').write_text(sheet)
    (ROOT / f'courier-{name}-icon.svg').write_text(sheet.replace('width="256"', 'width="64"').replace('viewBox="0 0 256 64"', 'viewBox="0 0 64 64"'))

robots = []
parcels = []
boosts = []
for frame in range(4):
    bob = [0, -2, 0, 2][frame]
    eye = ['#7eadba', '#e8a268', '#7eadba', '#8bad73'][frame]
    robots.append(f'''<g transform="translate({frame*64} {bob})">
      <rect x="12" y="33" width="8" height="15" rx="3" fill="#456255"/>
      <rect x="44" y="33" width="8" height="15" rx="3" fill="#456255"/>
      <rect x="16" y="21" width="32" height="29" rx="9" fill="#74967e"/>
      <rect x="19" y="20" width="26" height="25" rx="7" fill="#e5edda"/>
      <rect x="23" y="26" width="18" height="10" rx="4" fill="#3e5e50"/>
      <circle cx="28" cy="31" r="2" fill="{eye}"/><circle cx="36" cy="31" r="2" fill="{eye}"/>
      <path d="M32 21V14" stroke="#4c6f58" stroke-width="2"/><circle cx="32" cy="12" r="3" fill="#f2bc65"/>
      <path d="M27 40H37" stroke="#8da48b" stroke-width="2"/>
    </g>''')
    parcels.append(f'''<g transform="translate({frame*64} {bob})">
      <path d="M13 22L32 13L51 22L32 32Z" fill="#f5d48a" stroke="#ba8b41" stroke-width="1.5"/>
      <path d="M13 22V43L32 53V32Z" fill="#d7a557" stroke="#ba8b41" stroke-width="1.5"/>
      <path d="M32 32V53L51 43V22Z" fill="#e9bb6b" stroke="#ba8b41" stroke-width="1.5"/>
      <path d="M22 18L42 27V38L37 40V29L17 20Z" fill="#fff0c3"/>
      <rect x="17" y="32" width="9" height="6" rx="1" fill="#f8e2af"/>
      <path d="M53 12V20M49 16H57" stroke="#fff1c1" stroke-width="2" opacity="{[1,.4,.2,.7][frame]}"/>
    </g>''')
    boosts.append(f'''<g transform="translate({frame*64} {bob})">
      <circle cx="32" cy="33" r="23" fill="#97bd73" opacity=".22"/>
      <path d="M32 8L53 20V44L32 56L11 44V20Z" fill="#72a269" stroke="#507c4a" stroke-width="2"/>
      <path d="M35 17L22 35H31L28 48L43 29H33Z" fill="#f4edb4"/>
    </g>''')
(ROOT / 'robot.svg').write_text(svg(''.join(robots)))
(ROOT / 'parcel.svg').write_text(svg(''.join(parcels)))
(ROOT / 'boost.svg').write_text(svg(''.join(boosts)))
(ROOT / 'icon.svg').write_text(svg('''<rect width="48" height="48" rx="12" fill="#f36c3d"/>
  <path d="M13 17L25 11L37 17L25 23Z" fill="#ffe7c6"/>
  <path d="M13 19V32L24 38V25Z" fill="#ffd5a3"/>
  <path d="M26 25V38L37 32V19Z" fill="#fff1d6"/>
  <path d="M8 24H15M6 29H13" stroke="#ffe9ca" stroke-width="2" stroke-linecap="round"/>''', 48, 48))

sounds = ROOT / 'sounds'
sounds.mkdir(exist_ok=True)
RATE = 22050


def tone_file(name, notes, length, kind='sine'):
    samples = []
    for i in range(int(RATE * length)):
        time = i / RATE
        slot = min(int(time / length * len(notes)), len(notes) - 1)
        frequency = notes[slot]
        local = (time / length * len(notes)) % 1
        envelope = min(1, local * 20) * (1 - local) ** 1.4
        tone = math.sin(2 * math.pi * frequency * time)
        if kind == 'noise':
            tone = .55 * tone + .45 * math.sin(i * 7.345) * math.cos(i * 3.17)
        samples.append(struct.pack('<h', int(10000 * envelope * tone)))
    with wave.open(str(sounds / name), 'wb') as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(RATE)
        output.writeframes(b''.join(samples))


tone_file('pickup.wav', [660, 990], .17)
tone_file('collision.wav', [160, 110, 75], .28, 'noise')
tone_file('delivery.wav', [523, 659, 784, 1047], .5)
tone_file('dash.wav', [280, 220, 160], .15, 'noise')
tone_file('finish.wav', [523, 659, 784, 659, 1047], .85)
print('Generated original SVG artwork and five distinct WAV files.')
