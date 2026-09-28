# CV World Ads Engine

External GitHub Actions growth engine for CV World Facebook posts.

## Image Quality

The engine uses three image modes:

- `auto` (default): generate a premium AI campaign image when `GEMINI_API_KEY` or `OPENAI_API_KEY` exists, otherwise fall back to the built-in SVG renderer.
- `svg`: always use the local SVG renderer.
- `ai`: require AI image generation and fail if both AI keys are missing or image generation fails.

Add this GitHub Actions secret to enable premium AI visuals. Gemini is used first because it is the preferred image provider for this engine:

- `GEMINI_API_KEY`

Optional fallback secret:

- `OPENAI_API_KEY`

Optional repository variables:

- `IMAGE_MODE=auto`
- `GEMINI_IMAGE_MODEL=gemini-3.1-flash-image`

The AI flow generates a realistic background only, then the engine overlays the CV World logo and exact marketing text itself. This keeps text readable, preserves the real CV World branding, and avoids AI misspellings.
