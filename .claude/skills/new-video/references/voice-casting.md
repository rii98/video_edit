# Voice casting and voiceover

A voice is casting, not a setting. A studio picks the narrator the way it picks an actor: for the audience, the content and the feeling, then directs each line. This file covers choosing the voice, directing it, and generating it without wasting the small Gemini quota.

## The tools

- `ev tts "<text>" --voice=<Name> [--style="…"]`: Gemini 3.8 Flash TTS by default, with an automatic fallback to Deepgram Aura-2 (same gender) when Gemini isn't available.
- Several deliveries in **one request**: `"[[deep, ominous]] In a world… <short pause> [[hushed]] No templates."` Text is spoken verbatim; `[[…]]` styles and the delivery notes are never spoken.
- `ev tts --voices`: all 30 voices with gender, tone and best fits. `ev tts --usage`: today's request count.
- `--provider=deepgram` for drafts; `--provider=gemini` to fail loudly instead of falling back.
- Every new take is transcribed (Deepgram STT, which also gives the word timings for captions) and checked against the script: `✓ transcript matches`, or a warning if it spoke extra words or got cut off.

## The quota (read before generating anything)

- Gemini's free tier allows about **100 requests a day per key** (observed; not published, not raised by paying), about 10 a minute, reset at midnight Pacific.
- `ev tts` keeps a ledger shared by all projects and stops at a soft cap of **90** (`GEMINI_TTS_DAILY` in `.env`), throttles to 8 a minute, and on Google's daily refusal marks the day exhausted and falls back to Deepgram.
- Identical text + voice + styles is cached: a rerun costs nothing. Changing one word or one style note costs one request.

**Budget per video: aim for ≤ 15 Gemini requests** (one per scene plus a few retakes and at most 2 auditions). Habits that keep it there:
1. **Lock the script first.** Never generate audio for a draft script. While structure and timing are still moving, use `--provider=deepgram` for scratch VO (Aura-2 is paid per character, not capped per day).
2. **One request per scene** (5–20 s, ≤ ~60 words), with per-segment styles inside it. Not per sentence (wasteful), not the whole script (long requests ignore pauses and can be cut off).
3. **Audition cheaply:** at most 2 candidate voices, each on the same short signature line (8–15 words), only when the choice is genuinely close. Otherwise cast from the table.
4. **Retake on evidence, not hope.** Only after the transcript check warns, the user asks, or you can name what's wrong (pace, emphasis, tone). Change the style note specifically ("slower, falling pitch on 'never'"), not just "better". Max 2 retakes per scene; then rewrite the line.
5. **Never loop** `ev tts` in a script or regenerate a whole video to fix one line. Run `ev tts --usage` before a big batch.
6. If the budget is spent, finish with Deepgram (`⚠ used Deepgram` in the output), tell the user, and offer to upgrade those lines to Gemini after the reset. Lines generated later with Gemini replace them by asset id.

## Casting: choose the voice from the content

Decide in this order, and write one line of reasoning in `script.md` ("Narrator: Sadaltager, male, knowledgeable. Calm authority for a history explainer aimed at adults").

1. **Audience and platform.** Kids and family → youthful, warm, bright. Professionals → clear, even, informative. Gen-Z social → casual, lively, fast. Luxury buyers → smooth, unhurried.
2. **Genre and feeling** (table below).
3. **Brand or subject fit.** A female founder's brand story wants her register, not a generic announcer. A gritty true-crime story wants gravel, not sparkle.
4. **Gender:** the user's preference first (ask in the brief only if it matters to them). Otherwise choose by fit and contrast: if the footage is a man talking, a female narrator separates the voiceover from on-camera speech, and vice versa. Avoid defaulting to male authority for every serious topic; Gacrux and Kore carry documentary and finance well.
5. **Consistency:** one narrator per video unless there's a reason (dialogue, a second character, a quoted voice). Same voice across a series.

| Content | First choice | Alternatives | Direction to start from |
|---|---|---|---|
| Documentary, history | Sadaltager (m, knowledgeable) | Charon (m), Gacrux (f, mature) | calm authority, measured pace, slight gravity |
| Explainer, education | Autonoe (f, bright) | Rasalgethi (m), Charon (m), Kore (f) | clear and engaged, like a great teacher, crisp consonants |
| Finance, markets | Kore (f, firm) | Rasalgethi (m), Gacrux (f) | confident, precise numbers, unhurried |
| Tech, SaaS, product demo | Erinome (f, clear) | Iapetus (m), Schedar (m) | clear, modern, matter-of-fact, light energy |
| Trailer, thriller, true crime | Algenib (m, gravelly) | Alnilam (m), Gacrux (f) | low, ominous, deliberate pauses, drop to hush on reveals |
| Luxury, beauty, cars | Algieba (m, smooth) | Despina (f, smooth) | slow, intimate, velvety, never salesy |
| Hype, fitness, sports, gaming | Fenrir (m, excitable) | Sadachbia (m), Laomedeia (f) | punchy, fast, rising energy, short phrases |
| Social ad, launch, CTA | Laomedeia (f, upbeat) | Pulcherrima (f), Puck (m) | upbeat, direct, smiling, a lift on the CTA |
| Kids, family, playful | Leda (f, youthful) | Achird (m), Puck (m) | warm, playful, bouncy, simple |
| Heartfelt brand story, family moments | Sulafat (f, warm) | Achird (m) | warm, sincere, gentle smile, unhurried |
| Calm, wellness, meditation, health | Vindemiatrix (f, gentle) | Achernar (f), Enceladus (m) | soft, slow, breathy, long pauses |
| Creator-style, vlog, comedy | Zubenelgenubi (m, casual) | Umbriel (m), Callirrhoe (f) | conversational, relaxed, like talking to a friend |
| Corporate, announcement | Orus (m, firm) | Alnilam (m), Kore (f) | composed, confident, steady |
| Travel, lifestyle | Aoede (f, breezy) | Zephyr (f), Umbriel (m) | light, airy, curious |
| Moody, poetic, intimate | Enceladus (m, breathy) | Achernar (f) | close to the mic, quiet, slow |

**Language:** Gemini detects the language from the text (Hindi and many others supported). For a language you haven't used before (e.g. Nepali), test one short line first, check the transcript, and have the user listen. Deepgram can't speak most non-English languages, so the fallback won't help there.

## Directing: writing style notes

A style note is the direction an editor gives a voice actor: **emotion + energy + pace + one specific instruction**.
- Good: `"warm and encouraging, unhurried, a smile on 'you can learn'"`, `"low and ominous, slow, a long breath before the last word"`, `"fast and punchy, rising energy, hit 'today' hard"`.
- Weak: `"good"`, `"natural"`, `"professional voice"`, a paragraph of adjectives.
- Change style where the **meaning** changes (setup → reveal → payoff), not every sentence. 1–3 segments per request is typical.

Inline tags for moments (inside the text, at the exact spot):
- Pauses: `<short pause>`, `<long pause>`. Use them for emphasis and before reveals; punctuation (`…`, `—`, full stops) also shapes rhythm.
- Breath and life: `<breath>`, `<heavy breath>`, `<sigh>`.
- Reactions: `<chuckle>`, `<laugh>`, `<giggle>`, `<snicker>`, `<gasp>`.
- Big or rare ones (`<shout>`, `<scream>`, `<cry>`, `<sob>`, `<groan>`, `<cough>`, `<yawn>`…): only when the story calls for it.
- One or two tags per scene at most; tags on every line sound like a parody.

Script hygiene for a clean read:
- Write numbers as they should be spoken when it matters ("twenty twenty-six", "seven point five"), acronyms with spaces if they should be spelled ("I E L T S") or as a word if not.
- Spell out symbols (%, &, $) in the text.
- Short sentences; a full stop where the voice should land.

## Timing the edit to the voice

- Generate per scene, then set each scene's length from the take's duration (`ev media <id>`), plus breathing room (6–15 frames) where the picture needs it.
- Word timings from the transcript drive captions (`<Captions assetId offset />`), keyword pops and cuts on words.
- Duck the music under it (`<DuckedMusic voiceId voiceAt />`), and leave the voice clear of loud SFX.
