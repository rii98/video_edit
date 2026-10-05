# Sourcing assets: real, high quality, credited

A studio never fakes what it can get for real. When the video shows a logo, a person, a book, a building, a painting or a historical moment, find the real thing at the best quality available. Generated lookalikes, blurry thumbnails and clip-art are the fastest way to look cheap.

## Order of preference

1. **The user's own media** (always used first; ask if a key asset is missing and they might have it).
2. **Official sources:** the brand's press kit or brand-guidelines page, the publisher's page, the institution's media page, an official press photo.
3. **Open-licence and public-domain libraries** (below): Wikimedia Commons, museum open access, NASA, Openverse, stock libraries.
4. **Coded** (SVG, CSS, Remotion shapes) when that's the best fit (see the last section).
5. **Never:** AI-generated images of real people, real brands' products or logos, or fake "photos" of real events. Never watermarked images, never images ripped from Getty, Shutterstock or news photo agencies.

## Quality bar

- **Resolution ≥ 2× the size it appears on screen** (full-frame 1080p → ≥ 2160 px wide is ideal, 1920 the minimum; a half-frame card → ≥ 1100 px). For push-ins, add the zoom factor.
- No watermarks, no visible JPEG blocks, no upscaled softness, no crops that cut heads or text awkwardly.
- **Read every downloaded image** before ingesting. Check sharpness at the crop you'll use, colour cast and whether the subject is right (correct person, correct edition of a book, current logo).
- **Consistency:** images in one sequence should share a treatment (all colour or all mono, similar contrast, the same frame style). Grade or treat them in the scene to unify.
- Logos as **SVG** whenever possible; otherwise a large transparent PNG.

## Where to look, by asset type

### Logos
- The brand's own press, media or brand page (search `<brand> press kit` / `<brand> brand guidelines logo svg`). Use their colours and clear-space rules.
- Wikimedia Commons (`<brand> logo svg`): usually the official vector; check that it's the current version.
- Simple Icons (CC0 monochrome brand marks): `https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/<slug>.svg`; the brand hex is listed on simpleicons.org. Good for small marks in UI-like lists.
- Rules: never stretch, recolour, outline or add effects to a logo; keep the brand's clear space; using a logo to refer to the company is normal, but don't imply endorsement or partnership.

### People (public figures, historical figures)
- Wikimedia Commons (most Wikipedia portraits are there with a licence), official press photos (company leadership pages, government portraits, university pages), Library of Congress and national archives for historical figures, the Met/Smithsonian for historical portraits.
- Pick a well-lit, high-resolution, flattering, period-appropriate image. For a cut-out over a background, prefer a clean or plain background.
- Credit as the licence requires. Never generate or alter a real person's face.

### Books, films, albums, products
- Book covers: the publisher's page (largest image), Open Library (`https://covers.openlibrary.org/b/isbn/<ISBN>-L.jpg?default=false`; check the size, L can be small), Google Books.
- Product shots: the manufacturer's press or newsroom page.
- Covers and product shots are copyrighted; showing them to discuss or review the work is common practice, but mention it to the user in `credits.md` if the video is commercial.

### Art, history, places, science
- **The Met Open Access** (CC0): search `https://collectionapi.metmuseum.org/public/collection/v1.1/search?hasImages=true&q=<query>` (the old `v1/search` was retired 2026-10-01), then `.../v1/objects/<id>` → `primaryImage` when `isPublicDomain` is true.
- **Smithsonian Open Access** (CC0): si.edu/openaccess (API needs a free api.data.gov key).
- **Rijksmuseum, Art Institute of Chicago (api.artic.edu), Cleveland Museum of Art, Europeana, National Gallery of Art:** large CC0 collections.
- **NASA** (generally public domain): `https://images-api.nasa.gov/search?q=<query>&media_type=image` (or `video`).
- **Library of Congress** (loc.gov/photos, many public domain): the JSON API sits behind a bot check, so browse with WebFetch or ask the user to download.
- **Wikimedia Commons** for nearly everything else (places, buildings, events, maps, flags, diagrams).

### General photos and footage
- **Openverse** (CC licences across Flickr and others): `https://api.openverse.org/v1/images/?q=<query>&license_type=commercial&page_size=20` (`/v1/audio/` too). Check each result's licence: CC BY needs credit, BY-SA and NC have conditions.
- **Unsplash** (key set: `UNSPLASH_ACCESS_KEY` in `.env`; recipe below). High-quality photography of places, nature, objects, moods. Not for specific real people, products or events.
- **Pixabay** (free licence, photos and **video**): the API needs `PIXABAY_API_KEY` in `.env` (videos at `https://pixabay.com/api/videos/?key=…&q=<query>`). Without a key, find clips through search and download from the page, or ask the user.
- **Pexels** paused new API keys (October 2026). Use `PEXELS_API_KEY` only if one is already in `.env`; otherwise find clips through search and ask the user to download the ones you pick.
- **Footage without a key:** NASA (`media_type=video`), Wikimedia Commons video (`filetype:video` in the search below), Prelinger Archives and other public-domain film on archive.org (`https://archive.org/advancedsearch.php?q=<query>+AND+mediatype:movies&fl[]=identifier,title,licenseurl&rows=20&output=json`, then files from `https://archive.org/metadata/<identifier>`). Archival and science footage is a strength here; generic modern B-roll is not.
- **Footage with a key or by hand:** Pixabay Videos (key), Pexels Videos, Coverr, Mixkit (download from the page). British Pathé needs licensing for commercial use.
- **No stock clip fits?** A designed motion-graphics scene or a parallax still often beats a generic stock clip.

### Fonts, music, SFX
- Fonts: see `research-sources.md` §5.
- Music and SFX: read `SOUND.md`; `ev sfx`, `ev sfx-find`, `ev sfx-get`, `ev sfx-credits`.

## Wikimedia Commons search (no key needed)

Always send a descriptive User-Agent (Wikimedia blocks anonymous clients):

```bash
UA="EasyVideo/1.0 (personal video editor)"
curl -s -A "$UA" "https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=10&gsrsearch=<query>%20filetype:bitmap&prop=imageinfo&iiprop=url|size|extmetadata&iiextmetadatafilter=LicenseShortName|Artist|AttributionRequired"
```

Use `filetype:drawing` for SVGs. Each result gives `url` (the original), `width`/`height`, the licence and the artist. Prefer the largest suitable original.

## Unsplash search (key in `.env`)

Only the **Access Key** is used (`Client-ID`); the secret key is never needed. Never print the key. Demo mode allows **50 requests per hour**: search with `per_page=10–30` and pick carefully rather than paging through.

```bash
set -a; source .env; set +a
H=(-H "Authorization: Client-ID $UNSPLASH_ACCESS_KEY" -H "Accept-Version: v1")
curl -s "${H[@]}" "https://api.unsplash.com/search/photos?query=<query>&per_page=20&orientation=<landscape|portrait|squarish>&content_filter=high" > <scratchpad>/unsplash.json
```

Each result gives `id`, `width`/`height`, `alt_description`, `user.name`, `links.html` (photo page), `links.download_location`, and `urls.raw`. Then, for each photo you **use**:
1. **Report the download** (required by the API guidelines): `curl -s "${H[@]}" "<links.download_location>" > /dev/null`.
2. **Download at the size you need** from `urls.raw` plus imgix parameters: `"<urls.raw>&w=2160&q=85&fm=jpg"` (set `w` to 2× the display width; add `&h=…&fit=crop&crop=entropy` for a fixed crop).
3. Credit "Photo by <user.name> on Unsplash" with the photo page URL in `credits.md` (credit needed: yes, by the API guidelines).

## Download → check → ingest → credit

```bash
UA="EasyVideo/1.0 (personal video editor)"
curl -sL -A "$UA" -o "<scratchpad>/assets/<descriptive-name>.<ext>" "<original URL>"
```

1. Download into the session scratchpad (`<scratchpad>/assets/`) with a descriptive file name (it becomes the asset id's prefix).
2. **Read the image.** Reject and find another if it fails the quality bar.
3. `npm run ev -- ingest <file>` (or a whole folder). Use the printed asset id in scenes (`<Picture id />`, `<Footage id />`).
4. Add a row to `project/intake/credits.md`:

```markdown
| Asset id | What | Source URL | Author | Licence | Credit needed |
|---|---|---|---|---|---|
| ada-portrait-1a2b3c4d | Ada Lovelace portrait, 1836 (Chalon) | https://commons.wikimedia.org/wiki/File:… | Alfred Edward Chalon | Public domain | no |
```

When the video is finished, tell the user which assets need on-screen or description credits.

## When to code it instead

Code it (SVG paths, CSS, Remotion shapes, `interpolate`) when:
- It's a **diagram, process, chart, map, timeline or UI**: clarity beats photorealism, and it animates precisely.
- It's an **abstract concept** with no honest photo (inflation, an algorithm, a feeling): a designed metaphor is better than a stock cliché.
- You need an **icon system** or graphic devices that must share stroke, radius and colour with the theme.
- The style calls for it (flat, line, Swiss, collage made of real cut-outs).

How to code it so it looks designed, not generated:
- One stroke weight, one corner radius, the theme's palette only; align to the grid.
- Draw purposeful, simple shapes; animate them with stroke-dash draw-ons, masks and staggered builds.
- Maps: real geography from a vector source (Natural Earth, world-atlas TopoJSON) projected to SVG paths, not hand-drawn blobs.
- Combine with real material when it helps: a real photo cut-out on a coded background, real data in a coded chart.
- Never mix clip-art styles, emoji as decoration, or generic "AI blob" gradients (see `ai-tells.md`).
