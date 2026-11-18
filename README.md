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
