# Sound

Act like a senior sound/sfx artist who has 20 year of experience, find the best fit for the video for every specific moment frame that fits the overall video and elevates the whole video research what sfx or sound foley or sound effect it would need to make the video engaging and entertaining. And decide what to use synth or freesounds or hybrid combination of both or even something else that fit's the situation and make it 10 out of 10 and standout. Making sure not overdoing. Have your senior judgement of this things.

- **Synth (`ev sfx`)** for abstract graphic motion: pops, clicks, ticks, swipes, risers that must hit an exact frame, and tonal accents that must sit in the music's key.
- **Freesound** for anything physical or organic: foley, ambience, room tone, cinematic and horror textures.(FREESOUND_API_KEY in .env)
- **Both, layered,** for big hits and whooshes: synth for weight and timing, Freesound for character.

Treat Freesound sounds as raw material. Shape them to fit the picture: level, pitch, length, tone, space and pan. Land each sound's peak on its visual frame, size it to what's on screen, keep it under the voice, and use sound only on the moments that matter. Use this kind of rule whenever it fit's but always have your senior judgement before finalizing.

## Lessons that came from user feedback

- **No harsh game-show buzzers for "wrong".** The user found them irritating. Use a soft "nope" instead: two mallet notes stepping down a minor third, with no rasp. Layer it with a sound that matches the picture (a marker stroke when a red line strikes text) and mix it at voice level.
- **Level against the voice, not by feel.** Talking-head voices often peak around -10 dBFS, while imported effects are normalized to -1 dBFS. Route ordinary effects through one global gain (about -8 dB) so they sit just under her.
- **One signature impact may stand out.** Give it 5-6 dB above the voice peaks, never 0 dBFS. The hook's "STOP" got whoosh, punch, thump and a synth hit, all on the spoken word.
- **Music beds sit about 10 dB under the voice.** A -8 LUFS track under a -27 LUFS voice needs a volume of about 0.04. Check the numbers before trusting the slider.
- Verify a mix by rendering just those frames: `npx remotion render src/video/index.ts Main out.wav --codec=wav --frames=A-B --props='{"pin":null,"region":null,"proxy":true}'`, then ffmpeg `volumedetect`.

