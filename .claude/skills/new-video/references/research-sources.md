# Where to research

The web tools can't watch video. They read pages: write-ups, case studies, breakdowns, interviews, stills and transcripts. So aim searches at **pages that describe or dissect** work, not just host it. When one specific video matters a lot, break it down with `ev reference <url>` (needs yt-dlp).

How to search well:
- Run several searches in one turn: `site:` queries for the curated sources, plus open queries for breakdowns.
- Search by **device and genre**, not just topic: "kinetic typography title sequence breakdown", "documentary archival parallax technique", "speed ramp transition tutorial", "award-winning explainer motion design case study".
- Add the year for trends ("2026"). Use WebSearch `extended` mode for niche or very recent queries.
- Prefer sources that explain the *why* (designer interviews, case studies, editor breakdowns) over listicles.
- For each useful find, record in `research.md`: link, one line on the device that makes it work, and which treatment it informs. Never copy a design; extract the principle.

## 1. Curated, award-level work (start here)

| Source | What it's for | Search pattern |
|---|---|---|
| Art of the Title (artofthetitle.com) | Film/TV title sequences with long designer interviews | `site:artofthetitle.com <genre or mood>` |
| Watch the Titles (watchthetitles.com) | More title sequences, credits design | `site:watchthetitles.com` |
| Motionographer (motionographer.com) | Best of motion design, studio features, case studies | `site:motionographer.com <topic>` |
| Stash (stashmedia.tv) | Curated motion, VFX, ads, music videos with credits | `site:stashmedia.tv` |
| Vimeo Staff Picks / Vimeo channels | Best short films, motion reels, title work | `site:vimeo.com staff pick <topic>` |
| Behance Motion Graphics gallery | Full project case studies with styleframes and process | `site:behance.net motion <topic>` |
| Dribbble (motion and animation tags) | Short motion studies, UI animation, type and layout ideas | `site:dribbble.com <topic> animation` |
| The Brand Identity, It's Nice That, Creative Review | Design-led brand and motion work, typography | `site:itsnicethat.com motion <topic>` |
| Shots, Ads of the World, The Drum, LBB Online | Advertising craft, director/editor credits | `site:lbbonline.com edit <topic>` |
| Awards: D&AD, Cannes Lions, The One Show, ADC, Ciclope, Webby, Annecy, Berlin Commercial, AICE | Winners lists = the bar; jury write-ups explain why | `<award> <year> motion design winner` |
| Annual "best of": Vimeo Best of the Year, Motionographer year-end, School of Motion "Motion Awards" | Trends of the year | |

## 2. Shot and technique libraries (cinematography and editing references)

| Source | What it's for |
|---|---|
| Eyecannndy (eyecannndy.com) | Visual technique library: camera moves and in-camera effects as short loops, each with the films that use it |
| ShotDeck (shotdeck.com) | Huge searchable database of film stills tagged by shot size, lighting, colour, framing (subscription; search results and articles are still useful) |
| FILMGRAB (film-grab.com), MovieStillsDB | Free film stills by film, for composition and colour reference |
| StudioBinder blog and YouTube | Clear write-ups on every shot size, angle, camera move, transition and editing term |
| No Film School, PremiumBeat, Frame.io Insider, Filmmaker IQ, Art of the Cut (Steve Hullfish, ProVideo Coalition) | Editors' interviews and technique articles from working professionals |
| Every Frame a Painting, Nerdwriter1, Thomas Flight, Lessons from the Screenplay, Patrick (H) Willems | Video essays on why editing and framing choices work (search their transcripts and write-ups) |
| Walter Murch "In the Blink of an Eye", Bordwell & Thompson "Film Art" (davidbordwell.net blog) | The canon: rule of six, continuity, rhythm |

## 3. Motion design craft and tutorials

| Source | What it's for |
|---|---|
| School of Motion (blog, podcast) | Principles, techniques, industry interviews |
| Ben Marriott, Jake in Motion, Motion Design School, ECAbrams, Video Copilot (Andrew Kramer), Evan Abrams, Mt. Mograph | After Effects technique breakdowns: kinetic type, transitions, camera, shape animation |
| Adobe: After Effects and Premiere Pro tutorials and Help pages, Adobe Blog, Adobe MAX sessions | Official technique explanations (graph editor, speed ramps, track mattes, Essential Graphics) |
| Premiere Gal, Justin Odisho, Peter McKinnon, Film Riot, Cinecom | Editing tricks and transitions for creator video |
| Remotion docs and showcase (remotion.dev) | How to implement it in our stack: interpolate, spring, sequences, transitions |
| Lottiefiles featured, CodePen motion collections, GSAP showcase | Web motion ideas that translate to code-driven video |

## 4. What's working on social right now

| Source | What it's for |
|---|---|
| TikTok Creative Center (ads.tiktok.com/business/creativecenter) | Top ads, trending hashtags, songs and creators by region and industry |
| YouTube trending, YouTube Shorts, top channels in the niche | Formats and hooks that hold attention; read comments for what viewers respond to |
| Instagram Reels (creators in the niche), Meta Ad Library | Hooks, caption styles, what brands run at scale |
| Pinterest (search "motion graphics", "kinetic typography", "editorial layout", "<topic> moodboard") | Moodboards: colour, type, layout, texture |
| Savee (savee.com), Are.na, Cosmos | Designer-curated moodboards |
| Reddit: r/MotionDesign, r/editors, r/VideoEditing, r/AfterEffects, r/Filmmakers | Practitioner discussion, critiques, "how was this made?" threads |
| Creator analysts: Paddy Galloway, Colin and Samir, Think Media | Retention, hooks, packaging for YouTube |

## 5. Typography and design systems

| Source | What it's for |
|---|---|
| Google Fonts (fonts.google.com) | Free, loads in one line via `@remotion/google-fonts` (add to `src/video/fonts.ts`). First choice. |
| Fontshare (Indian Type Foundry, free licence), Velvetyne, Collletttivo, The League of Moveable Type | Free distinctive display faces (need a local font file; use only when clearly better than Google options) |
| Fonts In Use (fontsinuse.com), Typewolf (typewolf.com) | Real-world pairings by genre and mood; "what font is this" for famous work |
| Fontjoy, Google Fonts "pairings" | Pairing ideas (judge by eye) |
| Coolors, Adobe Color (trends), Realtime Colors | Palettes; Adobe Color "Trends" pulls palettes from Behance by field |
| Grid systems (Müller-Brockmann), Swiss/International style, Bauhaus, editorial magazine layouts | Layout discipline for type-led motion |

## 6. Subject research (facts, quotes, data)

- Primary sources first: official sites, papers, government and statistics bodies (World Bank, OECD, national statistics offices), company filings and press releases, museum and archive records.
- Reputable secondary: Reuters, AP, BBC, FT, The Economist, Nature, peer-reviewed reviews, Encyclopaedia Britannica. Wikipedia is a map to sources: follow its citations rather than citing it.
- Record every on-screen fact with its URL and date in `research.md`.

## 7. Asset sources

Covered in `assets.md` (images, logos, people, books, footage, music, SFX).
