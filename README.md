# Lichen Vivarium II — The Photorealistic Lichen Engine

A **separate** lichen art application built from the original *The Photorealistic Lichen Engine — Morphogenesis & Senescence* HTML. The source of the live application is **[index.html](index.html)**. The first Lichen Vivarium is a different project and is not affected.

## Material realism study

The new **Optics/3D → Material study** builds a substantial fictional foliose specimen with opaque finite-thickness lobes, differentiated undersides, local hydration, shared terrain/depth, and one linear-light display pipeline. The existing saturated palettes remain available. Load the study, compare dry/misted tissue or neutral lighting, then return to your previous artwork. A legacy-render comparison and interface-free exhibition view are included.

See [implementation, review captures, tests and remaining work](docs/material-realism.md). This is the first rendering/anatomy slice of the supplied realism guides; persistent tip development, full shadow maps and project-file saves remain future work.

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

## Phase 11: ecological succession — the rock remembers, generations compete

**`succession-ecology.js`** is a bounded, deterministic ecological-guild model that builds on the merged Codex material realism, 3D anatomy, substrate moisture and Phase 10 chemical scars. There are no new simulation arrays or hidden clocks, so **Material Study → Return to artwork** can still restore exactly the original fields and params.

- **Fresh mineral rock:** crustose and squamulose pioneer forms receive stronger settlement and early-front growth preference.
- **Weathered lichen graveyards:** etched pockets, oxide blooms and persistent organic/memory fields increasingly favor foliose, fruticose and gelatinous successor colonies. The water and nutrient fields also affect niche ranking.
- **Generational recruitment:** mature colony spores choose among five distinct ecological guild weights with the existing deterministic biological RNG, favoring the selected drawing species but still allowing different phenotypes. Habitat suitability affects settlement probability.
- **Front encounters:** newly unoccupied pixels can choose among neighboring colonies based on both surviving biomass and site suitability. Established tissue never abruptly changes its species/colony identity; physical mesh anatomy remains stable, and the previous slow suture growth/stress model remains underneath.
- **Edge competition:** neighboring colonies with different habitat fitness change their local growth pressure, without hard resetting a living colony or instantly swapping ownership.
- **Source of truth:** the model reads **original `rockField`, `waterField`, `nutrientField` and Phase 10 `rockWeathering.fields`** live. Scar resets and wet/dry cycles immediately change ecological potential. No second fake ecological texture or random process.
- **Reversibility:** Succession Influence **0** exactly disables the added recruitment/growth/competition multipliers and selects spores using the original random-species rule. The feature can be disabled at any point without destroying earlier work.
- **Controls:** in the **Substrate** tab, adjust Ecological Succession, Fresh-Rock Pioneer Advantage, Old-Rock Successor Advantage and Competing Colony Boundaries, all 0–2×. Presets: **Fresh Slate** and **Ancient Graveyard**.
- **Niche map:** **Inspect Living Terrain → Succession potential** overlays the diagnostic successor-favorability map in violet/gold over the original art; it uses the existing terrain RGBA8 texture on texture unit 3 and uploads the map only when selected. The old diagnostic maps remain unchanged.
- **Mobile budget:** analytical read-only per-cell factors, no new GL framebuffer, geometry, timer or GPU sampler; hot-loop affinity avoids repeated site allocation.
- **Regression:** `tests/succession-ecology.test.cjs` exercises guild preference, deterministic selection on fresh/old rock, asymmetric border pressure, exact zero-mode fallback, dynamic rock history, RGBA8 diagnostic mapping and Codex specimen UI integration.

These are artistic ecological rules, not quantified life-history or geochemical estimates for named lichen species. GitHub Pages publishing remains independently blocked until the site is enabled in repository settings; this phase does not change Pages permissions. Physical iPhone Safari and full GIF/MP4 encoding remain unverified.

## Phase 10: biogenic rock weathering and enduring geological memory

**`rock-weathering.js`** models slow *biologically inspired* mineral erosion and persistent chemical staining on the original 256×256 slate, independent of living biomass. A separate, persistent geological record allows one generation of lichen to change where the next generation can grow.

### A rock that remembers its tenants

- **Biogenic micro-etching:** hydrated, mature tissue gradually deposits an erosion record into a separate heightfield. Acid-inspired interaction intensity depends on growth-form traits, local water content, tissue maturity, surviving biomass, rock type and local biological cracks. Rock is *not* dissolved spontaneously in bare cells.
- **Mineral-oxide blooms:** slowly accumulated iron/oxide-like stains follow living surface contact and local mineral susceptibility. They fade extremely gradually after the organism dies, unlike permanent etched geometry.
- **Organic residue:** distinct fungal/photobiont-inspired dark stain deposits follow the living colony, survive colonization changes and only diminish with slow runoff.
- **Permanent scar memory:** a fourth 8-bit display channel stores a historical record of previous lichen occupation; old erosion and historical marks survive both `clearAllLichens()` and regular ecosystem reseeding. The only destructive operation is the explicit, confirmation-protected **Reset Geological Scars** button.
- **Feedback:** surviving shallow pits slightly increase local moisture retention; newly colonizing thalli see modified habitat suitability and mineral replenishment through `substrateEcology.attachWeathering(...)`. Terrain Influence at 0 restores the legacy biological growth multipliers even when historical scars exist.
- **Time scale:** rock changes are calculated every *fourth biological tick*, not per animation frame. The weathering record is deterministic and follows fixed biological time in preview, chronology jumps, and PNG/GIF/MP4 export.
- **Performance:** one 256² RGBA8 texture on GL unit 4 stores R=etched relief, G=oxide stain, B=organic stain, A=historical memory; it is uploaded only when the geological fields actually change. Existing palette ramp (unit 2) and environmental diagnostics (unit 3) are unchanged. Shader heightfield relief fetches are conditional, so a Before view or relief slider at zero does not pay the extra rock-height lookup cost.

### Physical-looking scar rendering

The existing macro-photographic shader now subtracts gradual etched depth from the **rock heightfield** itself, affecting parallax, multi-scale surface normals, light and shadows. The rock albedo receives mineral and organic stains only where those historical records exist. In **Natural** color mode, deposits resemble ochre oxides and desaturated organic films; psychedelic modes introduce impossible mineral bloom pigments; the **Color Vault** mode samples colors directly from the active palette ramp, so the geological stains remain coordinated with the artwork.

### Substrate Lab controls

- **Chemical weathering speed:** 0–2×. Zero freezes new erosion and stains, but never erases existing history.
- **Micro-etching**, **Oxide bloom** and **Organic staining:** independently adjustable 0–2× pathways.
- **Visible etched depth** and **Stain saturation:** independently control visual strength without rewriting the biological record.
- **Ancient Patina** and **Acid Mineral Bloom** presets.
- **Before/After · Original rock** toggles the *visual* history only; geological processes keep running underneath. **Reset Geological Scars** asks before erasing the cumulative rock record, while leaving living colonies intact.
- **Inspect Living Terrain:** existing environmental maps (water, mineral seam, cleavage, exposure) now include historical overlays: etched depth (lavender), oxide bloom (copper), organic stains (teal), and scar memory (magenta). All work in the same fixed canvas and export route.

### Safety and limits

`node --test tests/*.test.cjs` now contains **34 regression checks** across existing 3D anatomy, living substrate ecology, and chemical weathering. New tests cover distinct chemical pathways, disappearance versus persistence across colony death, history reset, optional freezing, color-data packing, deterministic progression, and habitat feedback. The workflow runs all tests before deploying all static files to **free GitHub Pages**.

**Scientific honesty:** these are *stylized artistic representations* of lichen-driven mineral dissolution, pigmentation, and succession, not empirical predictions of dissolution rates or a physically calibrated geochemical simulation. The underlying granite/slate photoreal shader and actual biology-grid rock field are related but not mathematically identical. This is a mutable 2.5D rock heightfield beneath optional real 3D lichen meshes, not a full mesh erosion / fluid-rock chemistry simulation. iPhone Safari shader performance and real MP4/GIF encoding still need physical device testing.

## Phase 9: the substrate as an ecological actor

**`substrate-ecology.js`** activates a lightweight, coupled microclimate layer over the EXISTING 256×256 slate, water and biological fields. It uses the same `rockField` and `waterField` already consumed by 3D rhizines, and does not create unrelated fake rock geometry.

### Living terrain and species response

- **Crack reservoir:** crevice retention is derived from relative rock depth and local cleavage gradients. Between rainfall and dry spells, low protected zones hold moisture while exposed ridges lose it. Four-neighbor lateral water diffusion updates at every third biological tick, retaining the fixed-step timebase and avoiding heavy simulation work on every rendered frame.
- **Mineral seams:** local mineral availability follows the rock's height discontinuities, surface exposure and a deliberately *approximate* correspondence with the visible shader's white quartz-vein trajectory. Biological nutrient replenishment now varies by mineral patch, rather than remaining spatially uniform.
- **Biological affinity:** the five morphological groups have distinct stylized responses to moisture, crack depth and mineral content. Crustose pioneers, foliose sheets, fruticose holdfasts, squamulose cups and gelatinous/umbilicate forms therefore choose and colonize different terrain. This affects advancing colony fronts and established tissue growth.
- **Drying and senescence:** local water and exposure now influence desiccation stress. Crevice refuges preserve living tissue longer in a dry spell; open ridges accumulate stress faster.
- **Spore settlement:** a windborne spore's survival chance is influenced by local growth suitability, while the existing windborne dispersal system remains intact.
- **Rhizine connection:** existing real 3D rootlet meshes continue to follow the same evolving moisture field and rock depressions, avoiding a second incompatible substrate.

### Controls and diagnostic maps

There is a separate **Substrate** tab containing Terrain Influence 0–2× (zero restores legacy biological growth multipliers and drying/leaching equations for A/B comparison), Moisture Retention 0–2×, Exposed Rock Desiccation 0–2×, Crevice Affinity 0–2×, and Mineral Leaching 0–2×. Quick presets: **Wet Crevices** and **Harsh Slate**.

The **Inspect Living Terrain** selector offers the original artwork plus four scientific-eye overlays: cyan moisture, magenta mineral richness, lime fissures and orange exposed rock. Each is sampled from the original evolving CPU field through a dedicated 256² RGBA8 GPU texture (unit 3); the extra upload is only performed while a diagnostic map is enabled. The 69-palette color ramp remains on unit 2, independent of the diagnostic texture. Heatmaps appear in both pinned preview and the existing GIF/MP4/PNG rendering route.

### Performance, tests and scope

No third-party dependencies or Netlify deployments. All new biology remains fixed-grid CPU work; the dynamic moisture field uses double buffering and updates once per 3 simulated ticks. Geometry quality, original photorealistic shader, material controls and export settings remain independent.

The regression suite (`node --test tests/*.test.cjs`) now includes **25 tests** across the full 3D/biological integration, including valley versus ridge hydration, morphological habitat preference, mineral seam effects, exact legacy growth-factor fallback, finite wet/dry cycling, map buffer fidelity, and DOM/renderer wiring. The GitHub Pages workflow runs these before publishing.

**Important modeling distinction:** substrate responses and growth-form preferences are biologically **inspired artistic approximations**, not calibrated growth-rate predictions for real species. CPU rock and GPU macro rock use related but not numerically identical procedural noise; the macro-visible quartz vein is approximated in the mineral map. Mobile Safari shader performance, iPhone pixel output and full GIF/MP4 export still need on-device verification.

## Phase 8: lithotropic rhizines and living substrate attachment

**`rhizine-network.js`** adds real, compact, triangular 3D attachment filaments beneath each branching colony's basal thallus. The pathways are anchored to its existing `colonyOriginX/Y` and sample the **same `rockField` and `waterField` arrays** already used by the simulation. The target is realistic-looking attachment to low, moisture-retaining crevices, without a second artificial rock texture.

- **Rock-seeking growth:** deterministic seeded rootlets advance with directional persistence and a radial outward bias, evaluating nearby possible tips against rock relief, water retention and turn cost. Their paths prefer low/mineral valleys and wetter cracks; a higher grip strength means stronger substrate guidance. This is a biologically inspired artist's model, not a measured account of lichen hyphal chemotropism.
- **Forking attachment network:** occasional daughter filaments branch from established rootlets. Each strand is a tiny tapering 3D tube with analytic radial normals and along-fiber coordinates, drawn by the existing GPU geometry pass. Its tips elongate according to actual colony biomass and normalized biological age, and disappear with local necrotic/absent source tissue.
- **Safety budget:** **Lite** caps at 15 primary rootlets per visible branching colony, five path steps each, plus capped daughter forks; **Rich** caps at 30 primary rootlets and eight steps. Triangle counts remain bounded by the existing max two / four branching colonies. No geometry is regenerated every animation frame.
- **Motion controls:** **Rootlet Density** 0–2× (zero removes the rootlet mesh without altering living colonies), **Crevice-Seeking Grip** 0–2×, and **Rock-Hugging Reach** 0.35–1.75×. Presets: **Crack Crawler** (focused on rock valleys) and **Hyphal Spiderweb** (a wider, denser network). Changing these parameters rebuilds only the optional mesh; root skin thickness and fusion still update via existing uniforms. When basal spread changes, rootlet paths are rebuilt to stay aligned with the moved margin.
- **Palette and shading:** darkened, mineral/fungal filament material inherits the same palette identity as the living branching thallus. It remains in the original WebGL2 canvas and consequently follows existing still-image, GIF and MP4 capture passes.
- **Critical rendering fix:** the original full-screen macro shader now binds its own persistent WebGL2 vertex array object (`quadVao`) on each preview and export frame. The optional geometry pass binds a separate VAO; previously returning to a null VAO could silently break the next full-screen frame after drawing meshes.
- **Regression tests:** `node --test tests/*.test.cjs` now executes **18 tests**. New checks cover deterministic rock attraction (higher grip leads to lower-value rock tips in a synthetic fissure scene), vertex packing, rhizine budgets, safe zero-density fallback, independent mesh rebuilds, and fullscreen VAO restoration. GitHub Pages runs the suite before deploying all static modules, without Netlify.

**Limitations:** The code follows a stylized valley-seeking rule based on the existing substrate field, not real ecological rhizine chemistry; individual species may attach with quite different microstructures. The rootlets are actual triangulated geometry, but rock shading is still a 2.5D photorealistic field. End-to-end iPhone Safari WebGL2 compilation, visual depth and GIF/MP4 encoding have not been verified on a real device.

## Phase 7: organic basal thalli & genuine attachment surfaces

The optional real-geometry pass now connects fruticose stems to their colonies with a **thin layered 3D holdfast shell** instead of visibly resting individual tubular branches on a flat rock texture.

- **Shared colony origin:** the branching skeleton and its basal cortex are created using the exact same `colonyOriginX/Y` coordinates. Each real stem grows through its root rind.
- **Physical layered shell:** a gently domed upper surface transitions through irregular cortex, a feathered expanding margin and tucked-under skirt into a thin substrate-facing underside. It is actual WebGL2 triangle geometry, not simply an image-space normal effect.
- **Anatomically attached microtexture:** the basal cortex has radial fungal striae, aged nodules, mineral mottling and a darker prothallus-like perimeter. Its base palette identity matches the stem and tip-fibril material instead of introducing unrelated color.
- **Real biological control:** root skin opacity fades according to its *local* biomass, tissue age and necrosis; radius, thickness and vertical shape respond to user controls and hydration. Dispersing/dead colonies do not leave opaque decorations behind.
- **Motion controls:** `Motion → True 3D Geometry → Living Holdfast & Basal Thallus` includes Attachment/Fusion (0–100%; zero removes the extra root shell), Radial Thallus Spread (0.5–1.6×) and Root Tissue Thickness (0.25–2×), with Tender Attachment and Ancient Holdfast presets. These material/morphological settings do not reset the living ecosystem or regenerate the mesh except when attachment goes to/from zero.
- **Optional and resource-bounded:** up to one holdfast per visible branching colony, obeying the prior Lite (2 colonies) and Rich (4 colonies) caps. The new shell adds about 216 triangles per holdfast in Lite, or 324 in Rich. In the existing three-colony fixture with one fruticose organism, Lite builds 3,096 triangles total and Rich 11,866. These are simulated geometry counts, **not** observed iPhone frame rates.
- **Safety:** the existing 2.5D photographic shader continues to render underneath and is preserved when geometry quality is Off, when attachment is zero, or if the optional mesh setup fails. PNG, GIF and MP4 capture the same composite renderer.
- **Regression coverage:** `node --test tests/*.test.cjs` now runs 13 tests, including holdfast/branch shared anchors, finite surface normals, bounded geometry, restoration after disabling root attachment, and GPU-only thickness/spread updates.

This is a **layered, finite-thickness attachment shell** and tissue-coupled mesh, not a general volumetric tissue simulation or freely orbitable 3D lichen world. Real shader compilation and high-resolution encoding on iPhone Safari remain unverified and should be tried in the device browser.

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
