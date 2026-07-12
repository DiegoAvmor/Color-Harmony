# Color Harmony Analyzer

A browser-based tool that extracts the dominant colors from any photo, plots them on a segmented color wheel, and identifies which classic color-harmony scheme (if any) the image follows — along with its temperature, mood, and proportion balance.

Everything runs client-side. No image is ever uploaded to a server.

## Files

```
index.html    Markup and layout
styles.css    All visual styling
app.js        Color extraction, harmony detection, and rendering logic
```

Keep all three files in the same folder — `index.html` loads the other two via relative paths (`styles.css`, `app.js`). To run it, just open `index.html` in a browser; no build step or server required.

## What it does

**Palette extraction** — the uploaded image is downsampled onto a hidden canvas and clustered with a k-means++ algorithm to find its 5 most dominant colors, weighted by how much of the frame each one covers.

**Color wheel** — a 12-segment wheel (the classic red/orange/yellow/green/blue/violet layout). Segments matching a detected color pop outward and brighten with a gold highlight; the rest recede. Each color is also plotted as an exact dot, positioned by hue (angle) and saturation (distance from center).

**Harmony detection** — the detected hues are tested against classic color-scheme templates:

- Monochromatic
- Complementary
- Analogous
- Triadic
- Split-Complementary
- Square (Tetradic)
- Rectangle (Tetradic)
- Discordant (Clash)

The app finds the best-fitting scheme automatically and reports a fit percentage, or you can pick a specific scheme from the dropdown to see how well the image matches it. Dashed guide points on the wheel show where the "ideal" positions for that scheme would sit.

**Composition notes** —

- **Temperature**: whether the palette leans warm, cool, or balanced, based on hue and saturation.
- **Mood**: a short descriptor (e.g. "Playful & Energetic," "Soothing & Reserved") derived from saturation and temperature.
- **Proportion**: each color is tagged Dominant, Subordinate, or Accent based on how much area it covers, shown as small hoverable color chips (hover or tab to a chip to see its hex value).

## Browser support

Works in any modern browser (Chrome, Firefox, Safari, Edge). Uses the Canvas API for pixel sampling and inline SVG for the wheel — no external JS libraries or frameworks required.

## Known limitations

- Very low-resolution or heavily compressed images may yield noisier clusters.
- Harmony matching is a heuristic (nearest-fit against angular templates), not a formal colorimetric standard — treat the fit percentage as a useful guide rather than an exact score.
- Cross-origin images loaded via URL (rather than local upload) may fail to read due to canvas security restrictions.
