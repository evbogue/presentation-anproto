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
    SSB: { src: "/hermies-256.png", alt: "SSB logo" },
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
      color-scheme: light;
      --bg: #f6f1e9;
      --bg-2: #f2e6d7;
      --ink: #1f1a17;
      --muted: #6a5f57;
      --accent: #c2462b;
      --accent-2: #2c5d7d;
      --card: #fbf7f0;
      --shadow: rgba(31, 26, 23, 0.18);
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      font-family: "Inter", "Segoe UI", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at 15% 20%, rgba(194, 70, 43, 0.18), transparent 55%),
        radial-gradient(circle at 85% 25%, rgba(44, 93, 125, 0.2), transparent 50%),
        linear-gradient(135deg, var(--bg), var(--bg-2));
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
      border: 1px solid rgba(31, 26, 23, 0.08);
      position: relative;
      overflow: hidden;
      animation: fadeIn 500ms ease;
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

    .logo {
      width: clamp(120px, 22vw, 200px);
      height: auto;
      filter: drop-shadow(0 12px 18px rgba(194, 70, 43, 0.25));
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

    .callout {
      margin-top: 18px;
      padding: 14px 16px;
      border-radius: 16px;
      background: rgba(194, 70, 43, 0.16);
      border: 1px solid rgba(194, 70, 43, 0.35);
      color: var(--ink);
      font-weight: 600;
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
      background: #fff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: inset 0 0 0 1px rgba(31, 26, 23, 0.08);
    }
    th, td { padding: 10px 12px; text-align: left; }
    th {
      background: rgba(44, 93, 125, 0.12);
      font-weight: 600;
    }
    th:first-child {
      text-align: left;
    }
    tr:nth-child(even) td { background: rgba(31, 26, 23, 0.03); }

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
      background: #fff;
      object-fit: cover;
      box-shadow: 0 4px 10px rgba(31, 26, 23, 0.12);
    }

    .table-stamps table {
      position: relative;
      z-index: 1;
    }

    .stamp {
      position: absolute;
      padding: 6px 14px;
      border: 2px solid rgba(194, 70, 43, 0.7);
      border-radius: 6px;
      color: rgba(194, 70, 43, 0.85);
      font-weight: 700;
      text-transform: uppercase;
      background: rgba(251, 247, 240, 0.9);
      box-shadow: 0 8px 18px rgba(31, 26, 23, 0.18);
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
      background: #fff;
      box-shadow: 0 18px 40px rgba(31, 26, 23, 0.12);
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
      background: #fff;
      border-radius: 18px;
      border: 1px solid rgba(31, 26, 23, 0.12);
      box-shadow: 0 18px 40px rgba(31, 26, 23, 0.12);
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
        <p>Authenticated Non-networked Protocol<br />or ANother Protocol</p>
        <a class="hero-link" href="https://anproto.com">anproto.com</a>
      </div>
      <div class="footer">Slide 1 / 12</div>
    </section>

    <section class="slide">
      <div class="bio">
        <img class="bio-photo" src="/IMG_6743.jpg" alt="Portrait photo" />
        <div>
          <h2>Everett Bogue</h2>
          <p>Professional kayaker by summer, protocol dev by winter.</p>
        </div>
      </div>
      <div class="footer">Slide 2 / 12</div>
    </section>

    <section class="slide">
      <span class="kicker">Centralized Social Risks</span>
      <div class="risk-layout">
        <div>
          <p><strong>What is Centralized Social</strong>? Facebook/Instagram, LinkedIn, X</p>
          ${risksHtml}
          <figure class="image-card">
            <img src="https://berty.tech/blog/decentralized-distributed-centralized/decentralized2_huce764145a0a4ba92d2f6009192c4da0f_86406_857x0_resize_q100_lanczos_3.webp" alt="Diagram comparing centralized, decentralized, and distributed networks" />
            <figcaption class="topology-caption">Baran, P. (1964). On Distributed Communications, Memorandum RM-3420-PR.</figcaption>
          </figure>
        </div>
        <div class="image-stack">
          <figure class="image-card">
            <img src="/pfd.jpg" alt="Personal flotation device" />
            <figcaption class="topology-caption">No one wants to wear their PFD.</figcaption>
          </figure>
          <p class="callout">No one cares about decentralization until something happens.</p>
        </div>
      </div>
      <div class="footer">Slide 3 / 12</div>
    </section>

    <section class="slide">
      <figure class="image-card">
        <img src="/comparison.png" alt="Boating decentralization comparison" />
      </figure>
      <div class="footer">Slide 4 / 12</div>
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
      <div class="footer">Slide 5 / 12</div>
    </section>

    <section class="slide">
      <span class="kicker">How ANProto compares to 10+ years of protocols</span>
      <div class="table-stamps">
        ${tableHtml}
      </div>
      <div class="footer">Slide 6 / 12</div>
    </section>

    <section class="slide">
      <span class="kicker">How ANProto compares to 10+ years of protocols</span>
      <div class="table-gray-ssb table-stamps">
        ${tableHtml}
        <div class="stamp stamp-ssb">SCUTTLED&#10;circa 2019</div>
      </div>
      <div class="footer">Slide 7 / 12</div>
    </section>

    <section class="slide">
      <span class="kicker">How ANProto compares to 10+ years of protocols</span>
      <div class="table-gray-ssb table-gray-activitypub table-stamps">
        ${tableHtml}
        <div class="stamp stamp-ssb">SCUTTLED&#10;circa 2019</div>
        <div class="stamp stamp-activitypub">INSECURE</div>
      </div>
      <div class="footer">Slide 8 / 12</div>
    </section>

    <section class="slide">
      <span class="kicker">How ANProto compares to 10+ years of protocols</span>
      <div class="table-gray-ssb table-gray-activitypub table-gray-nostr table-gray-farcaster table-stamps">
        ${tableHtml}
        <div class="stamp stamp-ssb">SCUTTLED&#10;circa 2019</div>
        <div class="stamp stamp-activitypub">INSECURE</div>
        <div class="stamp stamp-nostr-farcaster">Bitcoiners, YUCK!</div>
      </div>
      <div class="footer">Slide 9 / 12</div>
    </section>

    <section class="slide">
      <span class="kicker">Bluesky is actually THE TITANIC?</span>
      <iframe class="embed-frame" src="https://arewedecentralizedyet.online/" title="Are We Decentralized Yet" loading="lazy"></iframe>
      <p class="source-line">Source: <a href="https://arewedecentralizedyet.online/">arewedecentralizedyet.online</a> by <a href="https://ricci.io">Rob Ricci</a></p>
      <div class="footer">Slide 10 / 12</div>
    </section>

    <section class="slide">
      <span class="kicker">Wiredove</span>
      <iframe class="embed-frame" src="https://wiredove.net/#ev" title="Wiredove" loading="lazy"></iframe>
      <div class="footer">Slide 11 / 12</div>
    </section>

    <section class="slide">
      <div class="asks-grid">
        <div>
          <div class="asks-card">
            <h3>What's working</h3>
            <ul>
              <li>Coding agents</li>
              <li>The protocol is done</li>
              <li>Bandwidth and compute</li>
              <li>Implemented in JS, Rust, Go, and now Python!</li>
            </ul>
          </div>
          <div class="asks-card">
            <h3>What's not</h3>
            <ul>
              <li>Social media fatigue</li>
              <li>Network effect</li>
              <li><a href="https://moxie.org/2016/03/04/ecosystem.html">The Ecosystem Is Moving</a> by Moxie Marlinspike?</li>
            </ul>
          </div>
        </div>
        <div class="asks-side">
          <div class="asks-card">
            <h3>Asks</h3>
            <ul>
              <li>Free kayaking! Try ANProto today for a chance to win! *terms and conditions apply.</li>
              <li>Looking for five app devs, influencers, and event organizers to build relationships with this year.</li>
              <li>What do you need to know to explore decentralized social media?</li>
            </ul>
            <a class="asks-link" href="https://wiredove.net/#ev">https://wiredove.net/#ev</a>
            <a href="https://wiredove.net/#ev" aria-label="Wiredove link">
              <img class="qr-code" src="https://api.qrserver.com/v1/create-qr-code/?size=225x225&data=https%3A%2F%2Fwiredove.net%2F%23ev" alt="QR code for Wiredove" />
            </a>
          </div>
        </div>
      </div>
      <div class="footer">Slide 12 / 12</div>
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
