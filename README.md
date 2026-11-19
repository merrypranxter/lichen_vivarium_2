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

## Phase 6: cortical micromorphology and physical tip fibrils

The **Motion → True 3D Geometry → Microscopic Cortex & Tip Anatomy** controls now texture the *actual 3D fruticose branch surfaces*, rather than scattering generic noise in screen space:

- **Axial cortical striae and cross-wrinkles:** coordinates follow the cylindrical surface's circumference and branch direction, with true per-vertex elliptical/cylindrical surface normals. Cladonia-style tubes and flattened Ramalina-style straps receive different ridge frequencies.
- **Powdery soralia / pale cortical patches:** seeded stable granules and patch clusters develop with local tissue age, including broader pseudocyphella-like pale patches on the Ramalina-style material. These are surface-shader microtextures, not a claim of physically simulated spore reproduction.
- **Aged, dry fissures:** fine longitudinal irregular cracks darken along the cortex as tissue matures and hydration falls; they respond to the viscoelastic water level supplied by the living biology.
- **Microscopic tip fibrils:** actual small tapering *triangular tube meshes* grow from genuine skeleton terminal nodes, with birth stages linked to existing biological growth. No re-randomizing between frames. Hard cap: 20 fibrils in Lite, 48 in Rich. Setting fibrils to zero eliminates their geometry.
- **Material/lighting connection:** real analytic tube normals and UVs are packed with every branch vertex (19 floats instead of 14) and affect the same real directional light and user palette ramp used for cups and foliage.
- **Controls and presets:** independent **Cortex ridges**, **Powdery soralia**, **Dry fissures**, and **3D fibrils** sliders (0–2×); presets **Velvet & Bloom** and **Ancient Cortex**. Changing material sliders updates uniforms directly; changing fibril density rebuilds only the optional mesh.
- **Performance and fallback:** existing Off / Lite / Rich geometry modes remain. On a mocked three-species scene with default fibrils, Lite built approximately 2,880 triangles and Rich approximately 11,542, drawn in a shadow pass and a surface pass. This is a geometry count, **not** a measured frame rate on iPhone.
- **Regression safety:** `node --test tests/*.test.cjs` checks 10 tests for two distinct branching grammars, deterministic seeds, finite/normalized normals, stable surface coordinates, bounded fibrils, mesh quality, and a clean Off fallback. The GitHub Pages workflow runs these tests before deploying.

**Scope:** cortex ridges, soralia, and fissures currently use geometry-attached shading plus subtle normal variation; only the stems and fine terminal fibrils add real vertices. The materials are biologically inspired and artistically controllable, not a validated species-level tissue model. Actual compilation of GLSL by an iPhone WebGL2 driver and end-to-end GIF/MP4 recording still require device testing.

## Phase 5: living fruticose skeletons

**`branch-skeletons.js`** is a pure, seeded JS grammar generating *actual tubular WebGL2 mesh triangles* for the fruticose lichen family (engine 3). It builds once per source colony and then uses biological texture values in the vertex shader to elongate each segment from its attachment point, instead of repeatedly regenerating a new random structure. All 3D mesh passes share the existing canvas and GIF/MP4/PNG export pipeline.

Two distinct biological inspirations are available in **Motion → True 3D Geometry → Branching architecture**:

- **Cladonia:** terminal dichotomous tip division, progressively tapering cylinders, irregular tufts, multiple generations of forks (inspired by Cladina/Cladonia branching dynamics).
- **Ramalina:** persistent primary axes with lateral buds emerging later from older tissue and flattened, somewhat straplike branches. This reflects *some* Ramalina growth architectures, not a claim that all species behave this way.

Controls: branching architecture, stem density (0.5–2×), branch height (0.4–2×). The previously existing **Developmental Unfolding** slider affects these meshes, too: at 0, they appear as fully extended static anatomy; at 100%, local simulated biomass/biological age gradually releases each successive tube from its parent node. Hydration and lobe/cup controls still work independently.

**Budgets:** the Lite mesh pass builds up to two independent branching systems and at most 46 tube segments per plant; Rich builds up to four systems and at most 114 tube segments per plant. There is no animation-time geometry regeneration. `Off` disables all mesh processing. In a representative three-colony mocked WebGL2 fixture, Lite assembled 2,784 total triangles (including cups and leaves) and Rich assembled 11,254. These are not device FPS measurements.

**Regression tests:** `node --test tests/branch-skeletons.test.cjs` checks seeded determinism, vertex packing, finite geometry, distinct architectures, controllable density and segment caps using only built-in Node modules. GitHub Pages workflow runs this test before publishing, with no npm install or Netlify resources.

**Scientific references** (architectural inspiration, not exact simulation validation):
- [Meristem growth dynamics and branching patterns in Cladoniaceae](https://bsapubs.onlinelibrary.wiley.com/doi/10.2307/2656683)
- [Diffuse growth in the fruticose beard lichen Ramalina usnea](https://scholarscommons.fgcu.edu/esploro/outputs/journalArticle/Diffuse-growth-in-the-fruticose-beard/99383341513406570)
- [Fruticose growth-form glossary, Consortium of Lichen Herbaria](https://lichenportal.org/portal/glossary/individual.php?term=fruticose)

Note: this is biologically *inspired* geometry driven by live simulated tissue age and biomass, not a validated reproduction of all anatomical development. Actual device shader execution and mobile export compatibility should still be tested on iPhone Safari.

## Phase 4: optional real 3D anatomy meshes

A separate `geometry-layer.js` adds **real triangulated WebGL2 geometry**, composited onto the existing macro-photographic biological shader. This is not a second canvas, another rendering engine or a paid dependency.

- **Hollow scyphi:** polygonal tubes, stalks and flared goblet rims with modeled inward-facing inner walls. Fruiting and biomass values sampled from the active biological texture drive their emergence.
- **Lifted foliose ribbons:** triangulated rosette lobes, anchored to biological colony origins, bend upward at their free margins. Biological tissue age, biomass, humidity, depth and lobe curl controls affect their raised geometry.
- **Geometry-derived shadows:** a lightweight sun-projected mesh pass casts silhouettes on top of the same rock scene before the raised surfaces are rendered.
- **Placement alignment:** sites use the same approximate Worley cellular cup-center domain as the existing procedural Cladonia shader; nearby fruiting tissue is sampled separately to animate each mesh.
- **Shared coloration:** the original color modes and 69-palette ramp are available to the mesh material; highlights and subtle microgranulation follow its actual triangle normals.
- **Mobile performance:** `Motion → True 3D Geometry` defaults to **Lite** (at most 16 hollow cups and up to 9 raised lobes per colony). **Rich** raises the budget (up to 44 cups and 16 lobes per colony, with denser triangulation); **Off** always restores the original shader only.
- **Controls:** physical mesh height and oblique macro silhouette angle. These mesh settings apply during both interactive preview and frame-by-frame PNG, GIF and MP4 export.
- **Failure isolation:** if WebGL2 does not support the geometry shader or the optional GPU layer fails to initialize or draw, the existing biological shader continues by itself and the control switches to Off.

**Scope / limitations:** This is genuine 3D *surface geometry* composited over a 2.5D rock image, using an oblique fixed macro-camera projection for alignment. It is **not yet** a freely orbitable volumetric 3D ecosystem, and its shadow projection is an approximation rather than a full physically-based shadow map. The original detailed lichen shader is intentionally unchanged to avoid breaking the application's realism, responsiveness or export workflow.

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
