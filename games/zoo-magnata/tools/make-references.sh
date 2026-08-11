#!/usr/bin/env bash
# Downloads the reference recordings the spectrogram comparators use.
# They do NOT go into git (see .gitignore): they are third-party material and
# the repo is a single HTML file. Run this before opening compare.html / animals.html.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p ref && cd ref

# --- the human voice: macOS' own TTS, no network ---
if command -v say >/dev/null 2>&1; then
  diz() { say -v "$1" -o "$2.wav" --data-format=LEI16@22050 --channels=1 "$3"; }
  diz Daniel   h_ah    "ah"
  diz Daniel   h_oi    "oh"
  diz Daniel   h_frase "hello there"
  diz Luciana  m_ah    "ah"
  diz Luciana  m_oi    "oi"
  diz Luciana  m_uau   "uau"
  echo "voz humana: ok"
else
  echo "warning: 'say' only exists on macOS — compare.html will have no reference"
fi

# --- animals: Wikimedia Commons (free licences, see each file's page) ---
command -v ffmpeg >/dev/null 2>&1 || { echo "error: ffmpeg is required"; exit 1; }
baixa() {  # apelido, url
  sleep 2   # o Commons responde 429 em rajada
  curl -sL -A "zoo-audio-ref/1.0 (research)" -o /tmp/_zooref "$2"
  ffmpeg -v error -y -i /tmp/_zooref -ac 1 -ar 22050 -t 3 "a_$1.wav" </dev/null
  echo "  a_$1.wav"
}
C=https://upload.wikimedia.org/wikipedia/commons
baixa leao     "$C/7/7d/Lion_raring-sound1TamilNadu178.ogg"
baixa tigre    "$C/2/29/439280_schots_angry-tiger.wav"
baixa urso     "$C/4/4e/Bear_growl.ogg"
baixa lobo     "$C/8/87/Wolf_howls.ogg"
baixa elefante "$C/4/40/Elephant_voice_-_trumpeting.ogg"
baixa primata  "$C/5/56/Pant-hoot_call_made_by_a_male_chimpanzee.ogg"
baixa ave      "$C/c/c5/Rooster_crowing.ogg"
baixa anfibio  "$C/9/9f/Single_Frog_Croak.oga"
baixa bovino   "$C/a/a5/Single_Cow_Moo.ogg"
baixa equino   "$C/d/db/Wiehern.ogg"
baixa ungulado "$C/b/bc/Herd_of_goats_bleating.ogg"
baixa pinguim  "$C/2/2c/Little_Penguin_%28Eudyptula_minor%29.ogg"
baixa peixe    "$C/5/5a/161691_felixblume_dolphin-screaming-underwater-in-caribbean-sea-mexico.wav"
baixa suino    "$C/a/ac/Pig_grunt_-_Erdie.ogg"
rm -f /tmp/_zooref
echo "done. Serve the repo (python3 -m http.server) and open tools/compare.html and tools/animals.html"
