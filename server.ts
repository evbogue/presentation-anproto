const encoder = new TextEncoder();

function contentType(path: string): string {
  const ext = path.toLowerCase().split(".").pop() || "";
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    case "html":
      return "text/html; charset=utf-8";
    case "md":
    case "markdown":
      return "text/markdown; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseTable(markdown: string): string | null {
  const logoMap: Record<string, { src: string; alt: string }> = {
    SSB: { src: "/hermies.png", alt: "SSB logo" },
    ActivityPub: { src: "/activitypub-logo.png", alt: "ActivityPub logo" },
    ANProto: { src: "/anproto-logo.png", alt: "ANProto logo" },
    ATProto: { src: "/atproto.jpeg", alt: "ATProto logo" },
    Nostr: { src: "/nostr.png", alt: "Nostr logo" },
    Farcaster: { src: "/farcaster.jpeg", alt: "Farcaster logo" },
  };

  const lines = markdown.split(/\r?\n/);
  for (let i = 0; i < lines.length - 1; i++) {
    const header = lines[i].trim();
    const divider = lines[i + 1].trim();
    if (!header.includes("|") || !divider.includes("|")) continue;
    if (!/^\|?\s*[:\-]+/.test(divider)) continue;

    const headerCells = header.split("|").map((c) => c.trim()).filter(Boolean);
    const dividerCells = divider.split("|").map((c) => c.trim()).filter(Boolean);
    if (headerCells.length === 0 || dividerCells.length === 0) continue;

    const rows: string[][] = [];
    let j = i + 2;
    for (; j < lines.length; j++) {
      const rowLine = lines[j].trim();
      if (!rowLine.includes("|")) break;
      const rowCells = rowLine.split("|").map((c) => c.trim()).filter(Boolean);
      if (rowCells.length === 0) break;
      rows.push(rowCells);
    }

    const headerHtml = headerCells
      .map((c) => {
        const logo = logoMap[c];
        if (!logo) {
          return `<th>${escapeHtml(c)}</th>`;
        }
        return `
          <th>
            <div class="table-head">
              <img class="table-logo" src="${logo.src}" alt="${logo.alt}" />
              <span>${escapeHtml(c)}</span>
            </div>
          </th>
        `;
      })
      .join("");
    const bodyHtml = rows
      .map((row) => `<tr>${row.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`)
      .join("");
    return `<table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`;
  }

  return null;
}

function formatInline(text: string): string {
  const escaped = escapeHtml(text);
  return escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function parseRisksMarkdown(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  let html = "";
  let listOpen = false;
  let listMode = false;

  const closeList = () => {
    if (listOpen) {
      html += "</ul>";
      listOpen = false;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      closeList();
      listMode = false;
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      closeList();
      const level = headingMatch[1].length;
      const content = formatInline(headingMatch[2]);
      html += `<h${level}>${content}</h${level}>`;
      listMode = level >= 3;
      continue;
    }

    const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
    const listItem = bulletMatch ? bulletMatch[1] : trimmed;
    if (listMode || bulletMatch) {
      if (!listOpen) {
        html += "<ul>";
        listOpen = true;
      }
      html += `<li>${formatInline(listItem)}</li>`;
      continue;
    }

    closeList();
    html += `<p>${formatInline(trimmed)}</p>`;
  }

  closeList();
  return html;
}

function renderRisksColumns(markdown: string): string {
  const sections: Record<string, string[]> = { Actors: [], Methods: [] };
  let current: string | null = null;

  for (const line of markdown.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const headingMatch = trimmed.match(/^###\s+(.+)$/);
    if (headingMatch) {
      const title = headingMatch[1].trim();
      current = title in sections ? title : null;
      continue;
    }

    const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
    const item = bulletMatch ? bulletMatch[1].trim() : trimmed;
    if (current && item) {
      sections[current].push(item);
    }
  }

  const hasActors = sections.Actors.length > 0;
  const hasMethods = sections.Methods.length > 0;
  if (!hasActors || !hasMethods) {
    return `<div class="risks-fallback">${parseRisksMarkdown(markdown)}</div>`;
  }

  const renderList = (items: string[]) =>
    items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");

  return `
    <div class="risks-grid">
      <div>
        <h3>Actors</h3>
        <ul>${renderList(sections.Actors)}</ul>
      </div>
      <div>
        <h3>Methods</h3>
        <ul>${renderList(sections.Methods)}</ul>
      </div>
    </div>
  `;
}

async function renderSlideDeck(): Promise<string> {
  const tablePath = `${Deno.cwd()}/table.md`;
  const risksPath = `${Deno.cwd()}/risks.md`;
  let tableMd = "";
  let risksMd = "";

  try {
    tableMd = await Deno.readTextFile(tablePath);
  } catch {
    tableMd = "| Column A | Column B |\n| --- | --- |\n| Example 1 | Example 2 |\n";
  }

  try {
    risksMd = await Deno.readTextFile(risksPath);
  } catch {
    risksMd = "# Risks\n\nNo risks provided yet.\n";
  }

  const tableHtml = parseTable(tableMd) ?? `<pre>${escapeHtml(tableMd)}</pre>`;
  const risksHtml = renderRisksColumns(risksMd);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ANProto Slide Deck</title>
  <style>
    @import url("https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap");

    :root {
      color-scheme: dark;
      --bg: #01040a;
      --bg-2: #020b16;
      --ink: #f4fbff;
      --muted: #a8bad0;
      --accent: #31f0ff;
      --accent-2: #ff5cbb;
      --card: #0b111d;
      --shadow: rgba(0, 0, 0, 0.55);
      --border: #31f0ff;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      font-family: "Inter", "Segoe UI", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at 20% 20%, rgba(49, 240, 255, 0.15), transparent 40%),
        radial-gradient(circle at 80% 15%, rgba(255, 92, 187, 0.14), transparent 45%),
        linear-gradient(145deg, var(--bg), var(--bg-2));
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 5px;
    }

    main {
      width: min(1100px, 92vw);
      position: relative;
    }

    .slide {
      display: none;
      padding: 3em;
      background: var(--card);
      border-radius: 28px;
      box-shadow: 0 22px 50px var(--shadow);
      border: 1px solid var(--border);
      position: relative;
      overflow: hidden;
      animation: fadeIn 500ms ease;
      transition: border-color 200ms ease, transform 150ms ease;
    }

    .slide:hover {
      border-color: var(--accent-2);
      transform: translateY(-4px);
    }

    .slide::after {
      content: "";
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at 80% 85%, rgba(194, 70, 43, 0.15), transparent 50%);
      pointer-events: none;
    }

    .slide.active { display: block; }

    h1, h2, h3 {
      font-family: "Inter", "Segoe UI", sans-serif;
      letter-spacing: 0.02em;
      margin-top: 0;
    }

    h1 { font-size: clamp(2.6rem, 4vw, 3.8rem); }
    h2 { font-size: clamp(2rem, 3vw, 2.8rem); margin-bottom: 16px; }
    h3 { font-size: clamp(1.2rem, 2vw, 1.6rem); margin-bottom: 8px; }

    p { font-size: 1.1rem; line-height: 1.6; color: var(--muted); }

    .kicker {
      font-family: "Inter", "Segoe UI", sans-serif;
      text-transform: uppercase;
      letter-spacing: 0.2em;
      font-size: 0.85rem;
      color: var(--accent);
      margin-bottom: 18px;
      display: inline-block;
    }

    .hero {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 18px;
    }

    .logos-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 24px;
      flex-wrap: wrap;
    }

    .logo {
      width: clamp(120px, 22vw, 200px);
      height: auto;
      filter: drop-shadow(0 12px 18px rgba(194, 70, 43, 0.25));
    }

    .logo-flicker {
      position: relative;
      width: clamp(120px, 22vw, 200px);
    }

    .logo-flicker img {
      width: 100%;
      height: auto;
      display: block;
      filter: drop-shadow(0 12px 18px rgba(194, 70, 43, 0.25));
    }

    .logo-flicker-b {
      position: absolute;
      inset: 0;
      opacity: 1;
      transition: opacity 90ms linear;
      will-change: opacity;
    }

    .logo-invert {
      filter: invert(1) drop-shadow(0 12px 18px rgba(194, 70, 43, 0.25));
    }

    /* Makes black pixels effectively disappear against the slide background. */
    .logo-screen {
      mix-blend-mode: screen;
    }

    .hero-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 8px 18px;
      border-radius: 999px;
      border: 1px solid rgba(194, 70, 43, 0.35);
      background: rgba(194, 70, 43, 0.08);
      color: var(--accent-2);
      font-weight: 600;
      text-decoration: none;
      transition: transform 150ms ease, box-shadow 150ms ease;
    }

    .hero-link:hover,
    .hero-link:focus-visible {
      transform: translateY(-1px);
      box-shadow: 0 8px 18px rgba(31, 26, 23, 0.15);
    }

    .event-flag {
      font-size: 0.95rem;
      text-transform: uppercase;
      letter-spacing: 0.25em;
      color: var(--accent-2);
      border: 1px solid rgba(44, 93, 125, 0.35);
      border-radius: 999px;
      padding: 6px 14px;
      background: rgba(44, 93, 125, 0.08);
      margin: 0;
    }

    .grid {
      display: grid;
      gap: 24px;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    }

    .pill {
      padding: 16px 18px;
      border-radius: 18px;
      background: rgba(44, 93, 125, 0.08);
      border: 1px solid rgba(44, 93, 125, 0.2);
    }

    .structure-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 20px;
      margin-top: 20px;
    }

    .structure-card {
      padding: 18px;
      border-radius: 20px;
      background: rgba(4, 9, 20, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
    }

    .structure-card h3 {
      margin-top: 0;
      margin-bottom: 10px;
      color: var(--accent);
    }

    .structure-card p {
      margin: 0;
      color: var(--muted);
      line-height: 1.4;
    }

    .structure-card pre {
      margin: 12px 0 8px;
      padding: 12px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.05);
      overflow: auto;
      max-height: 180px;
      font-size: 0.82rem;
      line-height: 1.25;
    }

    .structure-card code {
      font-family: "JetBrains Mono", "Source Code Pro", monospace;
      color: var(--ink);
      display: block;
      white-space: pre-wrap;
    }

    .callout {
      margin-top: 18px;
      padding: 14px 16px;
      border-radius: 16px;
      background: rgba(194, 70, 43, 0.16);
      border: 1px solid rgba(194, 70, 43, 0.35);
      color: var(--ink);
      font-weight: 600;
      font-size: 1.5em;
    }

    .callout.final-cta {
      position: absolute;
      right: 36px;
      bottom: 40px;
      margin: 0;
      max-width: 320px;
      font-size: 1.35rem;
      background: rgba(46, 125, 50, 0.18);
      border-color: rgba(46, 125, 50, 0.45);
    }

    .accent-block {
      background: rgba(194, 70, 43, 0.08);
      border: 1px solid rgba(194, 70, 43, 0.2);
    }

    ul { padding-left: 20px; margin: 0 0 16px; }
    li { margin-bottom: 8px; color: var(--muted); }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.95rem;
      background: rgba(15, 24, 37, 0.85);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
    }
    th, td { padding: 10px 12px; text-align: left; color: var(--ink); }
    th {
      background: rgba(255, 255, 255, 0.05);
      font-weight: 600;
      color: var(--accent);
    }
    th:first-child {
      text-align: left;
    }
    tr:nth-child(even) td { background: rgba(255, 255, 255, 0.03); }
    tr:nth-child(odd) td { background: rgba(255, 255, 255, 0.01); }

    .table-gray-ssb th:nth-child(2),
    .table-gray-ssb td:nth-child(2) {
      background: rgba(31, 26, 23, 0.08);
      color: rgba(31, 26, 23, 0.4);
    }

    .table-gray-ssb th:nth-child(2) {
      font-weight: 500;
    }

    .table-gray-activitypub th:nth-child(3),
    .table-gray-activitypub td:nth-child(3),
    .table-gray-nostr th:nth-child(6),
    .table-gray-nostr td:nth-child(6),
    .table-gray-farcaster th:nth-child(7),
    .table-gray-farcaster td:nth-child(7) {
      background: rgba(31, 26, 23, 0.08);
      color: rgba(31, 26, 23, 0.4);
    }

    .table-gray-activitypub th:nth-child(3),
    .table-gray-nostr th:nth-child(6),
    .table-gray-farcaster th:nth-child(7) {
      font-weight: 500;
    }

    .table-stamps {
      position: relative;
    }

    .table-head {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      margin: 0 auto;
      text-align: center;
      line-height: 1.1;
    }

    .table-logo {
      width: 26px;
      height: 26px;
      border-radius: 6px;
      border: 1px solid rgba(31, 26, 23, 0.15);
      background: var(--card);
      object-fit: cover;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4);
    }

    .table-stamps table {
      position: relative;
      z-index: 1;
    }

    .stamp {
      position: absolute;
      padding: 6px 14px;
      border: 2px solid var(--border);
      border-radius: 6px;
      color: var(--accent-2);
      font-weight: 700;
      text-transform: uppercase;
      background: rgba(4, 9, 20, 0.85);
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.55);
      pointer-events: none;
      white-space: pre;
      line-height: 1.1;
      text-align: center;
      z-index: 3;
    }

    .stamp-ssb {
      top: 22px;
      left: 16%;
      transform: translateX(-50%) rotate(-10deg);
      letter-spacing: 0.14em;
    }

    .stamp-activitypub {
      top: 24px;
      left: 34%;
      transform: translateX(-50%) rotate(-8deg);
      letter-spacing: 0.14em;
    }

    .stamp-nostr-farcaster {
      top: 28px;
      left: 84%;
      transform: translateX(-50%) rotate(5deg);
      letter-spacing: 0.08em;
    }

    .footer {
      position: absolute;
      right: 28px;
      bottom: 24px;
      font-size: 0.9rem;
      color: var(--muted);
    }

    .nav {
      position: fixed;
      bottom: 22px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 10px;
      z-index: 10;
    }

    .risks-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 28px;
    }

    .risks-grid h3 {
      margin-top: 0;
    }

    .risks-fallback h3 {
      margin-top: 0;
    }

    .embed-frame {
      width: 100%;
      height: clamp(420px, 72vh, 720px);
      border: 1px solid rgba(31, 26, 23, 0.12);
      border-radius: 18px;
      background: var(--card);
      box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45);
    }

    .embed-frame.half {
      height: clamp(240px, 45vh, 420px);
    }

    .demo-layout {
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
      gap: 24px;
      align-items: start;
    }

    .demo-layout.one-col {
      grid-template-columns: minmax(0, 1fr);
    }

    .ssb-layout {
      grid-template-columns: minmax(0, 1fr) minmax(0, 3fr);
    }

    .ssb-left {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: flex-start;
      text-align: left;
      gap: 14px;
    }

    /* qr-panel styles removed (QR codes are now shown without surrounding UI) */

    .demo-copy h2 {
      margin-top: 0;
    }

    .demo-copy ul {
      margin: 0 0 16px;
    }

    .demo-quote {
      margin: 0;
      padding: 14px 16px;
      border-left: 4px solid rgba(194, 70, 43, 0.6);
      background: rgba(44, 93, 125, 0.08);
      color: var(--ink);
      font-size: 1rem;
      line-height: 1.5;
    }

    .demo-quote a {
      color: var(--accent);
      text-decoration: none;
      border-bottom: 1px solid rgba(194, 70, 43, 0.4);
      font-weight: 600;
    }

    .iframe-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 18px;
    }

    .risk-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(280px, 0.9fr);
      gap: 24px;
      align-items: start;
    }

    .image-card {
      background: var(--card);
      border-radius: 18px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45);
      padding: 14px;
    }

    .image-stack {
      display: grid;
      gap: 18px;
    }

    .image-card img {
      width: 100%;
      height: auto;
      display: block;
      border-radius: 12px;
    }

    .img-square-centered {
      width: min(320px, 40vw);
      aspect-ratio: 1;
      object-fit: cover;
      display: block;
      margin: 0 auto;
    }

    .anproto-share-snippet {
      width: min(720px, 86vw);
      margin: 0 auto 18px;
      padding: 16px 18px;
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(255, 255, 255, 0.04);
    }

    .anproto-share-snippet pre {
      margin: 0 0 12px;
      padding: 12px 14px;
      border-radius: 14px;
      border: 1px solid rgba(255, 255, 255, 0.10);
      background: rgba(0, 0, 0, 0.28);
      overflow: auto;
      max-height: 240px;
    }

    .anproto-share-snippet code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.92rem;
      color: rgba(244, 251, 255, 0.92);
      white-space: pre;
    }

    .wiredove-share {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      color: var(--ink);
      font-weight: 650;
      cursor: pointer;
    }

    .wiredove-share-purple {
      background: linear-gradient(90deg, #7c3aed, #a855f7);
      border-color: rgba(255, 255, 255, 0.18);
      box-shadow: 0 12px 26px rgba(124, 58, 237, 0.35);
    }

    .wiredove-share img {
      width: 22px;
      height: 22px;
      border-radius: 6px;
    }

    .baran-card img {
      filter: none;
    }

    .comparison-card img {
      filter: invert(1) hue-rotate(160deg) saturate(1.2);
      mix-blend-mode: screen;
    }

    .comparison-card.uninvert img {
      filter: none;
      mix-blend-mode: normal;
    }

    .comparison-card {
      background: #000;
      border-radius: 18px;
      border: 1px solid rgba(255, 255, 255, 0.25);
      padding: 12px;
      box-shadow: 0 30px 60px rgba(0, 0, 0, 0.7);
      position: relative;
      isolation: isolate;
    }

    .comparison-card::after {
      content: "";
      position: absolute;
      inset: 0;
      border: 1px solid rgba(255, 255, 255, 0.1);
      pointer-events: none;
    }


    .bio {
      display: grid;
      grid-template-columns: 33% 1fr;
      gap: 28px;
      align-items: center;
    }

    .asks-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr);
      gap: 24px;
      margin-top: 24px;
    }

    .asks-card {
      padding: 8px 0;
    }

    .asks-card h3 {
      margin: 0 0 12px;
    }

    .asks-card ul {
      margin: 0;
    }

    .asks-side {
      text-align: left;
    }

    .asks-link {
      display: inline-block;
      margin-top: 10px;
      font-weight: 600;
      color: var(--accent-2);
    }

    .qr-code {
      display: block;
      width: 225px;
      height: 225px;
      margin-top: 10px;
      border-radius: 12px;
      border: 1px solid rgba(31, 26, 23, 0.12);
    }

    .bio-photo {
      width: 100%;
      border-radius: 22px;
      border: 1px solid rgba(31, 26, 23, 0.12);
      box-shadow: 0 18px 40px rgba(31, 26, 23, 0.15);
      object-fit: cover;
    }

    .topology-figure {
      margin: 0;
    }

    .topology-layout {
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
      gap: 28px;
      align-items: center;
    }

    .topology-image {
      width: min(860px, 65%);
      height: auto;
      display: block;
      margin: 12px auto 0;
      border-radius: 18px;
      border: 1px solid rgba(31, 26, 23, 0.12);
      box-shadow: 0 18px 40px rgba(31, 26, 23, 0.15);
    }

    .topology-caption {
      text-align: center;
      font-size: 0.9rem;
      color: var(--muted);
      margin-top: 12px;
    }

    .source-line {
      margin-top: 12px;
      font-size: 0.95rem;
      color: var(--muted);
    }

    .source-line a {
      color: var(--accent);
      text-decoration: none;
      border-bottom: 1px solid rgba(194, 70, 43, 0.4);
    }

    .dot {
      width: 12px;
      height: 12px;
      border-radius: 999px;
      border: 1px solid rgba(31, 26, 23, 0.25);
      background: transparent;
      cursor: pointer;
      transition: transform 200ms ease, background 200ms ease;
    }

    .dot.active {
      background: var(--accent);
      border-color: var(--accent);
      transform: scale(1.2);
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @media (max-width: 720px) {
      .slide { padding: 3em; }
      table { font-size: 0.8rem; }
      .embed-frame { height: clamp(340px, 58vh, 480px); }
      .embed-frame.half { height: clamp(220px, 38vh, 360px); }
      .demo-layout { grid-template-columns: 1fr; }
      .structure-grid { grid-template-columns: 1fr; }
      .risks-grid { grid-template-columns: 1fr; }
      .risk-layout { grid-template-columns: 1fr; }
      .topology-layout { grid-template-columns: 1fr; }
      .bio { grid-template-columns: 1fr; }
      .asks-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main>
    







<section class="slide active">
      <div class="hero">
        <img class="logo" src="/anproto-logo.png" alt="ANProto logo" />
        <h1>ANProto</h1>
        <p>Authenticated Non-networked Protocol</p>
        <p class="event-flag">Web 3 Weekends · Feb 27 2026</p>
        <a class="hero-link" href="https://anproto.com">anproto.com</a>
      </div>
      <div class="footer">Slide 1 / 17</div>
    </section>

<section class="slide">
      <div class="bio">
        <img class="bio-photo" src="/IMG_6743.jpg" alt="Portrait photo" />
        <div>
          <h2>Everett Bogue</h2>
          <p>Professional kayaker by summer, protocol dev by winter.</p>
        </div>
      </div>
      <div class="footer">Slide 2 / 17</div>
    </section>

<section class="slide">
      <span class="kicker">Centralized Social Risks</span>
      <div class="risk-layout">
        <div>
          <p><strong>What is Centralized Social</strong>? Facebook/Instagram, LinkedIn, X</p>
          ${risksHtml}
          <figure class="image-card baran-card">
            <img src="https://berty.tech/blog/decentralized-distributed-centralized/decentralized2_huce764145a0a4ba92d2f6009192c4da0f_86406_857x0_resize_q100_lanczos_3.webp" alt="Diagram comparing centralized, decentralized, and distributed networks" />
            <figcaption class="topology-caption">Baran, P. (1964). On Distributed Communications, Memorandum RM-3420-PR.</figcaption>
          </figure>
        </div>
        <div class="image-stack">
          <figure class="image-card">
            <img class="img-square-centered" src="https://i.ibb.co/23HQ6Mvr/image.png" alt="Personal flotation device" />
            <figcaption class="topology-caption">Ann Marie made me a better logo</figcaption>
          </figure>
          <p class="callout">No one cares about decentralization until something happens.</p>
        </div>
      </div>
      <div class="footer">Slide 3 / 17</div>
    </section>

<section class="slide">
      <span class="kicker">AnProto Demo</span>
      <div class="demo-layout">
        <iframe class="embed-frame" src="https://try.anproto.com/" title="ANProto demo" loading="lazy"></iframe>
        <div class="demo-copy">
          <h2>What is ANProto?</h2>
          <ul>
            <li><strong>Authenticated.</strong> ed25519 signs the timestamp and message hash.</li>
            <li><strong>Non-networked.</strong> Bring any transport: URL bar, email, texting, USB stick, Bluetooth, NFC, LoRa, WebSockets, Fetch API, ATProto, Chaching.social, LinkedIn, messenger pigeon (?). Works offline.</li>
            <li><strong>Protocol.</strong> A structured way of doing things, so implementation is not a running target.</li>
          </ul>
          <p class="demo-quote">"I do not know of anybody yet, who has realized that, at the very least, every object should have a URL, because, what the heck are they if they aren't these things, and I believe that every object on the Internet should have an IP address" - <a href="https://www.youtube.com/watch?v=aYT2se94eU0">Alan Kay [OOPSLA 1997]</a></p>
        </div>
      </div>
      <div class="footer">Slide 4 / 17</div>
    </section>

<section class="slide">
      <span class="kicker">A brief history...</span>
      <div class="hero">
        <img class="logo" src="/google-plus.svg" alt="Google+ logo" />
        <p>2012: shadowbanned on Google+ for posting about open source.</p>
        <div class="logos-row">
          <img class="logo" style="width: clamp(160px, 26vw, 260px);" src="/urbit-logo.png" alt="Urbit logo" />
          <!-- tent.io logo removed -->
          <img class="logo logo-invert" style="width: clamp(130px, 20vw, 200px);" src="/diaspora-logo.svg" alt="Diaspora logo" />
          <img class="logo logo-invert" style="width: clamp(140px, 20vw, 220px);" src="/cjdns-logo.png" alt="cjdns logo" />
          <img class="logo logo-invert" style="width: clamp(90px, 14vw, 140px);" src="/yggdrasil-logo.svg" alt="Yggdrasil logo" />
        </div>
        <p>2013+: quit Google, hung out on tent.io, tried diaspora, and listened to lectures from ~sorreg-namtyv — also did some mesh networking on cjdns and yggdrasil</p>
      </div>
      <div class="footer">Slide 5 / 17</div>
    </section>

<section class="slide">
      <span class="kicker">Discovered Secure-Scuttlebot circa 2014</span>
      <div class="demo-layout one-col">
        <iframe class="embed-frame" src="https://scuttlebot.io/" title="Scuttlebot" loading="lazy"></iframe>
      </div>
      <div class="footer">Slide 6 / 17</div>
    </section>

<section class="slide">
      <span class="kicker">try ssb right now</span>
      <div class="demo-layout ssb-layout">
        <div class="ssb-left">
          <a href="https://ssb.evbogue.com/" aria-label="SSB demo link">
            <img class="qr-code" style="width: 225px; height: 225px;" src="https://api.qrserver.com/v1/create-qr-code/?size=225x225&data=https%3A%2F%2Fssb.evbogue.com%2F" alt="QR code for SSB demo" />
          </a>
        </div>
        <iframe class="embed-frame" src="https://ssb.evbogue.com/" title="Secure Scuttlebot" loading="lazy"></iframe>
      </div>
      <div class="footer">Slide 7 / 17</div>
    </section>

<section class="slide">
      <span class="kicker">How ANProto compares to 10+ years of protocols</span>
      <div class="table-stamps">
        ${tableHtml}
      </div>
      <div class="footer">Slide 8 / 17</div>
    </section>

<section class="slide">
      <span class="kicker">How ANProto compares to 10+ years of protocols</span>
      <div class="table-gray-ssb table-stamps">
        ${tableHtml}
        <div class="stamp stamp-ssb">SCUTTLED&#10;circa 2019</div>
      </div>
      <div class="footer">Slide 9 / 17</div>
    </section>

<section class="slide">
      <span class="kicker">How ANProto compares to 10+ years of protocols</span>
      <div class="table-gray-ssb table-gray-activitypub table-stamps">
        ${tableHtml}
        <div class="stamp stamp-ssb">SCUTTLED&#10;circa 2019</div>
        <div class="stamp stamp-activitypub">INSECURE</div>
      </div>
      <div class="footer">Slide 10 / 17</div>
    </section>

<section class="slide">
      <span class="kicker">How ANProto compares to 10+ years of protocols</span>
      <div class="table-gray-ssb table-gray-activitypub table-gray-nostr table-gray-farcaster table-stamps">
        ${tableHtml}
        <div class="stamp stamp-ssb">SCUTTLED&#10;circa 2019</div>
        <div class="stamp stamp-activitypub">INSECURE</div>
        <div class="stamp stamp-nostr-farcaster">Bitcoiners, YUCK!</div>
      </div>
      <div class="footer">Slide 11 / 17</div>
    </section>

<section class="slide">
      <span class="kicker">How centralized is Bluesky?</span>
      <iframe class="embed-frame" src="https://arewedecentralizedyet.online/" title="Are We Decentralized Yet" loading="lazy"></iframe>
      <p class="source-line">Source: <a href="https://arewedecentralizedyet.online/">arewedecentralizedyet.online</a> by <a href="https://ricci.io">Rob Ricci</a></p>
      <div class="footer">Slide 12 / 17</div>
    </section>

<section class="slide">
      <span class="kicker">Data structures across protocols</span>
      <div class="structure-grid">
        <div class="structure-card">
          <h3>SSB</h3>
<!-- removed -->
        </div>
        <div class="structure-card">
          <h3>ActivityPub</h3>
          <pre><code>{
  "@context": "https://www.w3.org/ns/activitystreams",
  "type": "Create",
  "id": "https://social.example/alyssa/posts/a29a6843-9feb-4c74-a7f7-081b9c9201d3",
  "to": ["https://chatty.example/ben/"],
  "actor": "https://social.example/alyssa/",
  "object": {
    "type": "Note",
    "id": "https://social.example/alyssa/posts/49e2d03d-b53a-4c4c-a95c-94a6abf45a19",
    "attributedTo": "https://social.example/alyssa/",
    "to": ["https://chatty.example/ben/"],
    "content": "Want to kayak this weekend? I’ll bring the PFDs."
  }
}</code></pre>
          <!-- removed -->
        </div>
        <div class="structure-card">
          <h3>ANProto</h3>
          <pre><code>evZSi/glsKR0c3xkOTYronA7Dxta07Ye/IeNw0+8oxg=Z8EjTyfVX/hijd9/L5CLnXrG2xeFN3Sbuo1rcXLomfgtMPEWDRrmef0Uuneo+/PHzMElBYPHD8F5UOpYGW4+AzE3MzYzMjExNDgyMDhtdW5EMUd0VDZQRXQyOFdYTFFIRVNub09vcVd2bFpsbXhVenpiZ0ZYK3dvPQ==

1736321148208wZaEerzK06sAAjBrFAWtfDeOOdxwaOpaw0o7gg6jFHew=

---
name: ev
previous: ZaEerzK06sAAjBrFAWtfDeOOdxwaOpaw0o7gg6jFHew=
---
kayak meetup at 6pm</code></pre>
          <!-- removed -->
        </div>
        <div class="structure-card">
          <h3>ATProto</h3>
          <pre><code>{
  "uri": "at://did:plc:abcd1234.../app.bsky.feed.post/3kxyz...",
  "cid": "bafyreib...",
  "value": {
    "$type": "app.bsky.feed.post",
    "text": "Hello from the kayak.",
    "createdAt": "2026-02-21T17:50:00.000Z"
  }
}</code></pre>
          <!-- removed -->
        </div>
        <div class="structure-card">
          <h3>Nostr</h3>
          <pre><code>{
  "id": "5c83da77af1dec6d7289834998ad7aafbd9e2191396d75ec3cc27f5a77226f36",
  "pubkey": "f7234bd4c1394dda46d09f35bd384dd30cc552ad5541990f98844fb06676e9ca",
  "created_at": 1736321276,
  "kind": 1,
  "tags": [
    ["e", "620de8079ea9c55988cfda4858728fdd7c6e4e8b40a34b0698a36d5dfc973c17", "wss://nostr.example.com"],
    ["p", "73ae7bacc102822d17ecdbb981fb8089e7b3afc3a9e41d0e54a6bb4562e9f058"]
  ],
  "content": "Sunset kayak paddle",
  "sig": "5b76507b808e24ed8ecb94b987c58684069dabd646328cedbef3bbb5e32fb2e2d237f5ff4dd7058703c3fe9b4467221d92a81adc0f86696846db77047ea90903"
}</code></pre>
          <!-- removed -->
        </div>
        <div class="structure-card">
          <h3>Farcaster</h3>
          <pre><code>{
  "data": {
    "fid": 1234,
    "timestamp": 1736321276,
    "network": "FARCASTER_NETWORK_MAINNET",
    "castAddBody": {
      "text": "Day 3 kayak log",
      "mentions": [],
      "mentionsPositions": [],
      "embeds": []
    }
  },
  "hash": "0a1b...",
  "signature": "...",
  "signer": "0x..."
}</code></pre>
          <!-- removed -->
        </div>
      </div>
      <div class="footer">Slide 13 / 17</div>
    </section>

<section class="slide">
      <span class="kicker">The future of ANProto</span>
      <div class="demo-layout" style="grid-template-columns: minmax(0, 1.25fr) minmax(0, 0.75fr);">
        <div>
          <h2>Agentic Neural-networked Protocol</h2>
          <ul>
            <li>Make AI Web 3</li>
            <li>Agents need pubkeys: stable, portable identities.</li>
            <li>Signed outputs make agents accountable (who said what, when).</li>
            <li>Public output creates a shared corpus: cache, reuse, and cite.</li>
            <li>Prefer proofs + links over re-running models (avoid duplicated inference).</li>
            <li>Sustainable compute: fewer redundant runs means less “ocean-boiling.”</li>
          </ul>
          <p style="margin-top: 28px; font-weight: 650; color: var(--ink);">And now we're announcing ANProto's partnership with OpenClaw! 🦞 <a href="https://wiredove.net/">Click here</a></p>
        </div>
        <figure class="image-card" style="margin: 0;">
          <img src="/agent-neural.png" alt="Agentic Neural-networked Protocol illustration" style="width: 100%; height: auto; display: block; border-radius: 12px;" />
        </figure>
      </div>
      <div class="footer">Slide 14 / 17</div>
    </section>

<section class="slide">
      <span class="kicker">Integration: Chaching Social</span>
      <div class="demo-layout one-col">
        <div class="anproto-share-snippet">

          <button class="wiredove-share wiredove-share-purple" id="anprotoShareButton" type="button">
            Share
            <img src="https://wiredove.net/favicon.ico" alt="Wiredove logo" />
          </button>

          <script type="module">
            import { attachWiredoveShareButton } from 'https://pub.wiredove.net/share/share-button.js'
            attachWiredoveShareButton(
              document.querySelector('#anprotoShareButton'),
              {
                text: 'Founder Fridays on Chaching.social',
                title: document.title,
                url: 'https://chaching.social/communities/founder-fridays?id=vpgFBQLBuhv6Wehlfwky'
              }
            )
          </script>
        </div>

        <iframe class="embed-frame" src="https://chaching.social/communities/founder-fridays?id=vpgFBQLBuhv6Wehlfwky" title="Chaching.social" loading="lazy"></iframe>
      </div>
      <div class="footer">Slide 15 / 17</div>
    </section>

<section class="slide">
      <span class="kicker">Proof of concept app: Wiredove</span>
      <div class="demo-layout">
        <iframe class="embed-frame" src="https://wiredove.net/#ev" title="Wiredove" loading="lazy"></iframe>
        <a href="https://wiredove.net/#ev" aria-label="Wiredove link">
          <img class="qr-code" src="https://api.qrserver.com/v1/create-qr-code/?size=225x225&data=https%3A%2F%2Fwiredove.net%2F%23ev" alt="QR code for Wiredove" />
        </a>
      </div>
      <div class="footer">Slide 16 / 17</div>
    </section>

<section class="slide">
      <span class="kicker">So how can we keep offline first social networks from failing?</span>
      <div class="hero">
        <h1>The Rise and Fall of Offline Social Networks</h1>
        <div class="logo-flicker" style="margin-top: 18px;">
          <img class="logo-flicker-a" src="/final-logo-a.png" alt="Logo" />
          <img class="logo-flicker-b" src="/final-logo-b.png" alt="Logo" />
        </div>
      </div>
      <div class="footer">Slide 17 / 17</div>
    </section>









  </main>

  <div class="nav" aria-label="Slide navigation"></div>

  <script>
    const slides = Array.from(document.querySelectorAll(".slide"));
    const nav = document.querySelector(".nav");

    const renderDots = () => {
      nav.innerHTML = "";
      slides.forEach((_, idx) => {
        const dot = document.createElement("button");
        dot.className = "dot" + (idx === 0 ? " active" : "");
        dot.addEventListener("click", () => goTo(idx));
        nav.appendChild(dot);
      });
    };

    const goTo = (index) => {
      const safe = Math.max(0, Math.min(slides.length - 1, index));
      slides.forEach((slide, idx) => slide.classList.toggle("active", idx === safe));
      nav.querySelectorAll(".dot").forEach((dot, idx) => {
        dot.classList.toggle("active", idx === safe);
      });
      current = safe;
    };

    let current = 0;
    renderDots();

    const advance = (dir) => goTo(current + dir);
    window.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight" || event.key === "PageDown") {
        advance(1);
      } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
        advance(-1);
      }
    });

    let touchStartX = 0;
    let touchStartY = 0;
    const swipeThreshold = 60;

    window.addEventListener("touchstart", (event) => {
      const touch = event.changedTouches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
    });

    window.addEventListener("touchend", (event) => {
      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > swipeThreshold) {
        advance(deltaX < 0 ? 1 : -1);
      }
    });

    // Random neon flicker on the final slide logo.
    (function startLogoFlicker() {
      const el = document.querySelector('.logo-flicker-b');
      if (!el) return;

      // Weighted random opacity: mostly on, sometimes dim/off.
      const pickOpacity = () => {
        const r = Math.random();
        if (r < 0.72) return 1;
        if (r < 0.84) return 0.75;
        if (r < 0.92) return 0.35;
        if (r < 0.975) return 0.12;
        return 0;
      };

      const loop = () => {
        // Mostly calm, with occasional rapid bursts.
        const burst = Math.random() < 0.18;
        const delay = burst
          ? (25 + Math.random() * 120)
          : (120 + Math.random() * 900);

        el.style.opacity = String(pickOpacity());
        window.setTimeout(loop, delay);
      };

      loop();
    })();
  </script>
</body>
</html>`;
}

Deno.serve({ port: 8099 }, async (req) => {
  const url = new URL(req.url);
  const pathname = decodeURIComponent(url.pathname);

  if (pathname === "/" || pathname === "/index.html") {
    const html = await renderSlideDeck();
    return new Response(encoder.encode(html), {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  const fsPath = `${Deno.cwd()}${pathname}`;
  try {
    const file = await Deno.readFile(fsPath);
    return new Response(file, { headers: { "content-type": contentType(fsPath) } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
});
