# CV World Ads Engine

External GitHub Actions growth engine for CV World Facebook posts.

## Image Quality

The engine uses two image modes:

- `auto` (default): generate a premium AI campaign image when `GEMINI_API_KEY` exists, otherwise fall back to the built-in SVG renderer.
- `svg`: always use the local SVG renderer.
- `ai`: require AI image generation and fail if `GEMINI_API_KEY` is missing or image generation fails.

Add this GitHub Actions secret to enable premium AI visuals:

- `GEMINI_API_KEY`

Optional repository variable:

- `IMAGE_MODE=auto`

The AI flow generates a realistic background only, then the engine overlays the CV World logo and exact marketing text itself. This keeps text readable and avoids AI misspellings.
