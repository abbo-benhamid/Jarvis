# Vidéo explicative Koudmen

- **Résultat :** `koudmen-explainer.mp4` (1 min 43, 1080p60, narration en français).
- **Animation :** Manim (style 3Blue1Brown) → `koudmen_explainer.py`.
- **Voix :** Piper TTS, voix `fr-siwis-medium`, gratuite et locale.
- **Script :** `narration.json` (7 scènes). Modifie le texte ici.

## Régénérer

1. Installe : `python3 -m venv vv && vv/bin/pip install manim piper-tts` (+ `libpango1.0-dev` sous Linux).
2. Télécharge la voix : `voice-fr-siwis-medium.tar.gz` (releases GitHub de rhasspy/piper v0.0.2).
3. Synthétise chaque scène de `narration.json` en `<scène>.wav`, et note les durées dans `durations.json`.
4. Rends : `KOUDMEN_DURATIONS=durations.json manim -qh koudmen_explainer.py Koudmen`.
5. Assemble : concatène les `.wav` (1 s de silence entre chaque), puis `ffmpeg -i video.mp4 -i narr.wav -c:v copy -c:a aac out.mp4`.

Pour une voix plus naturelle : ElevenLabs (clé API requise) remplace l'étape 3.
