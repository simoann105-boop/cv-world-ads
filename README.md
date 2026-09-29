# CV World Ads Engine

External GitHub Actions growth engine for CV World Facebook posts.

## Image Quality

The engine uses a hybrid image system:

- `auto` (default): generate a premium AI campaign image when `GEMINI_API_KEY` or `OPENAI_API_KEY` exists, otherwise fall back to the premium local renderer.
- `svg`: skip AI and use the premium local renderer.
- `ai`: require AI image generation and fail if both AI keys are missing or image generation fails.

Add this GitHub Actions secret to enable premium AI visuals. Gemini is used first because it is the preferred image provider for this engine:

- `GEMINI_API_KEY`

Optional fallback secret:

- `OPENAI_API_KEY`

Optional repository variables:

- `IMAGE_MODE=auto`
- `GEMINI_IMAGE_MODEL=gemini-2.5-flash-image`

The AI flow generates a realistic background only, then the engine overlays the CV World logo and exact marketing text itself. This keeps text readable, preserves the real CV World branding, and avoids AI misspellings.

If AI credits or rate limits are unavailable, the engine now uses a premium local renderer instead of a basic fallback. It creates a cinematic office/job-market scene locally with Sharp, then applies the same CV World campaign overlay. This keeps scheduled posts visually strong even when AI providers are down.

## Daily Content Mix

The workflow runs three times per day in Qatar time:

- 09:00: fresh live jobs post.
- 15:00: career advice image, such as interview questions, answer frameworks, CV mistakes, ATS tips, and hiring preparation.
- 21:00: fresh live jobs post.

Career advice posts are rendered as shareable images, not only text, so followers can save and share them. This is designed to build trust while attracting job seekers back to CV World.
