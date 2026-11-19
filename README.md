# Lichen Vivarium II — The Photorealistic Lichen Engine

A **separate** lichen art application built from the original *The Photorealistic Lichen Engine — Morphogenesis & Senescence* HTML. The source of the live application is **[index.html](index.html)**. The first Lichen Vivarium is a different project and is not affected.

## Biological morphogenesis

The five morphology engines in the supplied prototype are:

- **Areole** — *Rhizocarpon*-inspired crustose mosaics, hypothallus rims, stress cracks.
- **Lobe** — *Lobaria/Xanthoria*-inspired foliose lobes, veins, curling.
- **Thallus Axis** — *Cladonia/Ramalina*-inspired dendritic fruticose branching.
- **Squamule / Soralium** — *Cladonia pyxidata*-inspired scales, scyphi (pixie cups), and powdery soredia.
- **Hydra / Umbilicus** — *Lasallia/Enchylium*-inspired umbilicate pleats, pustules, hydration swelling.

The grid-based simulation tracks biomass, age, water, nutrients, tissue stress, fracture, fruiting, and necrosis over accelerated years. Species can share the same rock, compete, grow old, die, and recolonize. The shader approximates macro-photography relief and tissue optics; pigmentation is deliberately fantastical.

## Motion engine — continuous biological growth

The original attached prototype used a stochastic binary frontier step: when a random threshold passed, a bare grid cell jumped from biomass `0` to `0.14` in a single update. It also ran `simSpeed` ticks *per rendered frame*, so a 30 Hz phone grew at a different rate from a 60 Hz device.

**Lichen Vivarium II now uses:**

- **Continuous front accumulation:** the existing species-specific radial lobe geometry, hydration, nutrients, substrate affinity and curvature determine a small, bounded growth increment every biological tick. Colony ownership locks once a microscopic front starts, preventing species/color flicker at boundaries.
- **Time-based growth:** fixed-step accumulator set to 20 biological ticks per second per growth-speed unit (e.g. 3× → about 60 ticks/s at normal 30/60 Hz). The scheduler caps work to six ticks per drawn frame to avoid freezing slow phones instead of dumping a large catch-up burst.
- **Temporal rendering interpolation:** 256×256 GPU-bound biological RGBA fields (biomass, tissue age, fracture, necrosis) and fruiting intensity visually ease toward the authoritative simulation state. Species, polar angles and colony identifiers are never blended (that would produce anatomical artifacts).
- **Independent motion controls:** the new **Motion** tab exposes Growth Fluidity (default 75%), Living Edge Creep (default 1.25×), Silky Growing and Raw Comparison presets. Fluidity 0 disables visual easing while preserving the continuous biological growth model.
- **Export parity:** PNG shows the current authoritative state; GIF/MP4 feed the same live biological renderer with the exact selected frame duration for consistent optical smoothing, regardless of preview FPS.

A deliberately evolving lichen colony does **not** form a mathematically seamless video loop by default: the growth is real, not reverse-played or boomeranged.

### Anatomical morphogenesis — next phase

**Motion → Anatomical Morphogenesis** adds a *biological-stage-driven* 2.5D relief engine, using existing GPU anatomy without expensive new per-pixel noise loops:

- **Foliose lobe unfolding:** cortex thickens, free tips lift and expose pale medulla, then develop hydration-sensitive curl with tissue maturity.
- **Fruticose branching:** primary canopy tubes emerge first, secondary branches fill in later and tertiary fine filaments emerge last; branch tips are raised as living biomass approaches the growing front.
- **Scyphi / pixie cups:** developing stalks rise before the hollow funnel flares and produces marginal fruiting nodules. Cup radius, height and coloring now have a gradual reproductive stage instead of a binary near-mature appearance.
- **Gelatinous/umbilicate swell:** relief responds gradually to both hydration and the age of the living tissue. Rehydration and desiccation have different relaxation speeds, so swelling and contraction read as changes to physical volume rather than flickering.
- **Shared apothecia:** gradual reproductive-stage emergence on the remaining lichen classes.
- **Spore germination:** windborne colonies now begin below the visible cortex threshold, establishing and thickening progressively. Manual brush placement still offers an immediately visible seed.

Controls: **Developmental Unfolding** 0–100% (0 uses original shape staging), **Lobe edge lift & curl**, **Pixie cup stalk → hollow flare**, **Branch tip extension**, and **Hydration blisters & jelly swell** (each 0–2×). Presets: **Subtle Biology** and **Dramatic Unfolding**.

This is **dynamic heightfield/parallax morphogenesis**, not generated overhanging polygonal meshes. It preserves the renderer's WebGL2/iPhone architecture while improving the physically apparent motion. It intentionally uses simulated tissue age, biomass, fruiting and lagged hydration rather than decorative periodic sine animations, and the exact same shader runs for on-screen preview, GIF and MP4.

## New: MATHEMAGICAL! Color Vault

The **Color Lab** tab retains Gemini's six anatomical material modes and adds **69 genuine named color palettes** from the user's existing MATHEMAGICAL! and Slimekimi projects. Source files: `magnetic_art_app/src/core/palette-catalog.js` (57 source-authored presets) and `slimekimiapp/src/lib/palettes.ts` (12 presets). Original palette stop counts are preserved: 12-stop originals remain 12-stop editable ramps.

- Select by source family or search by name.
- Random named palette; independently randomize any individual stop or all stops.
- Shuffle, reverse or rotate the stop order; add/remove colors; edit each hexadecimal swatch.
- Color mapping is attached to anatomical cortex/rims/cups/soredia **before** biological shading, SSS and thin-film color, so geometry and lifecycle never get flattened into a generic color filter.

The **Export** tab includes:

- **PNG:** exact current scene, redrawn to a selected 512–2048 square resolution.
- **GIF:** real accelerated-growth animation, selectable 2–30 seconds at 10/15/24/30 FPS, frame-by-frame encoded, infinite playback loop. GIF is 256-color indexed; the animation is not necessarily seamless between end and start because living colonies grow forward.
- **MP4:** high-resolution H.264/AVC video in a genuine MP4 container, selectable bitrate 8/16/30/50 Mbps. Prefers WebCodecs + `mp4-muxer` for fixed timestamp frames; falls back to a native MP4-capable browser MediaRecorder where available. If H.264 encoding is unsupported, it reports the browser limitation instead of mislabeling WebM.
- Select **biological growth steps per frame** separately from live simulation speed. Exporting advances the scene from its current state, then resumes interactive growth. A cancel button stops long captures.

Browser-only encoders `gifenc` and `mp4-muxer` are loaded on demand from public CDNs, with no backend or paid service. Browser GPU/encoder limits and iPhone memory may constrain 1536–2048px animated capture; begin with 512–1024px on a phone.

## Mobile UI

On phone-sized screens the macro canvas is **pinned in the top viewport**, while the editing controls **scroll separately beneath** a draggable resize handle. The compact Species / Color Lab / Motion / Life/Death / Optics/3D / Export tab bar remains accessible while editing. The transport toolbar scrolls horizontally and the original WebGL2 canvas stays visible throughout. Desktop retains the side-by-side laboratory layout.

## Deployment

`.github/workflows/deploy-pages.yml` copies `index.html`, `palette-library.js`, `studio-runtime.js` and `studio-layout.css` to GitHub Pages. No Vite build, server, tokens, or Netlify credits are necessary. The source is tracked separately from the original Lichen Vivarium.

## How to play

1. Open the app. It starts with five colonies on weathered slate.
2. Choose a species and use **Inoculate Thallus**, **Local Mist**, or **Scrape / Weather** on the canvas.
3. Alter hydration and environmental stress under **Life/Death**; use rain, drought, decade jumps, and lifecycle presets.
4. Under **Pigments**, choose neon/opaline/acid/hydrothermal/Aerochrome or natural herbarium colors and mutate the pigment genome.
5. Under **Optics/3D**, move raking light, relief, microscopic grain, scattering, parallax, and zoom. Export the canvas as a PNG.

The controls are touch-friendly; the canvas accepts pointer interaction. Use the zoom slider on a phone.

## Run free

This is a **standalone HTML/WebGL2 app**. No paid hosting, backend, keys, or API is required. The repository keeps an unused Google AI Studio / Vite starter scaffold; it does not power the simulation. The HTML loads Tailwind's browser CDN and Google Fonts, so the visual interface benefits from an internet connection.

For a quick local test, open `index.html` in a modern WebGL2 browser. Alternatively, `npm run dev` uses the existing Vite scaffold.

The GitHub Pages workflow in `.github/workflows/deploy-pages.yml` publishes the standalone HTML without an npm build. If Pages is not enabled, in **Settings → Pages** select **GitHub Actions** under Build and deployment; the workflow also requests first-run enablement.

Expected URL *once Pages deployment succeeds*:

https://merrypranxter.github.io/lichen_vivarium_2/

## Implementation note

The 256×256 coupled growth grid is CPU-driven and its packed fields feed a WebGL2 fragment shader. The biological rules are artistically motivated approximations, **not** a scientifically validated species-growth predictor. Runtime and shader behavior should be tested on the actual target iPhone/Safari device; high simulation speeds may require lowering the ticks-per-frame slider.
