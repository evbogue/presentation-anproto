# ANProto Slide Deck

This repo contains a lightweight Deno server that renders a slideshow presentation about ANProto. The deck is served as a single HTML page generated from `table.md`, `risks.md`, and static assets like `anproto-logo.png`.

## Prerequisites

- Deno (https://deno.com/runtime)

## Start the presentation

```bash
deno run --allow-read --allow-net server.ts
```

Then open `http://localhost:8099` in your browser.

## Content sources

- `table.md` drives the comparison table slide.
- `risks.md` drives the risks slide.
- `anproto-logo.png` is used on the title slide.

## Notes

- The deck embeds a few external iframes and images; an internet connection is required to load those.
