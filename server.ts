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
      .map((c) => `<th>${escapeHtml(c)}</th>`)
      .join("");
    const bodyHtml = rows
      .map((row) => `<tr>${row.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`)
      .join("");
    return `<table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`;
  }

  return null;
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
      const content = escapeHtml(headingMatch[2]);
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
      html += `<li>${escapeHtml(listItem)}</li>`;
      continue;
    }

    closeList();
    html += `<p>${escapeHtml(trimmed)}</p>`;
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
      padding: 32px 20px 72px;
    }

    main {
      width: min(1100px, 92vw);
      position: relative;
    }

    .slide {
      display: none;
      min-height: 72vh;
      padding: 48px 56px;
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
    tr:nth-child(even) td { background: rgba(31, 26, 23, 0.03); }

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
      height: clamp(360px, 60vh, 560px);
      border: 1px solid rgba(31, 26, 23, 0.12);
      border-radius: 18px;
      background: #fff;
      box-shadow: 0 18px 40px rgba(31, 26, 23, 0.12);
    }

    .iframe-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 18px;
    }

    .topology-figure {
      margin: 0;
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
      .slide { padding: 32px 28px; min-height: 70vh; }
      table { font-size: 0.8rem; }
      .embed-frame { height: clamp(300px, 50vh, 420px); }
      .risks-grid { grid-template-columns: 1fr; }
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
      </div>
      <div class="footer">Slide 1 / 7</div>
    </section>

    <section class="slide">
      <span class="kicker">Network Architectures</span>
      <figure class="topology-figure">
        <img class="topology-image" src="https://berty.tech/blog/decentralized-distributed-centralized/decentralized2_huce764145a0a4ba92d2f6009192c4da0f_86406_857x0_resize_q100_lanczos_3.webp" alt="Diagram comparing centralized, decentralized, and distributed networks" />
        <figcaption class="topology-caption">Baran, P. (1964). On Distributed Communications, Memorandum RM-3420-PR.</figcaption>
      </figure>
      <div class="footer">Slide 2 / 7</div>
    </section>

    <section class="slide">
      <span class="kicker">Risks in Centralized Social Media</span>
      ${risksHtml}
      <div class="footer">Slide 3 / 7</div>
    </section>

    <section class="slide">
      <span class="kicker">AnProto Demo</span>
      <iframe class="embed-frame" src="https://try.anproto.com/" title="ANProto demo" loading="lazy"></iframe>
      <div class="footer">Slide 4 / 7</div>
    </section>

    <section class="slide">
      <span class="kicker">How ANProto compares</span>
      ${tableHtml}
      <div class="footer">Slide 5 / 7</div>
    </section>

    <section class="slide">
      <span class="kicker">Apps</span>
      <div class="iframe-grid">
        <iframe class="embed-frame" src="https://wiredove.net/" title="Wiredove" loading="lazy"></iframe>
        <iframe class="embed-frame" src="https://in.anproto.com/" title="In ANProto" loading="lazy"></iframe>
      </div>
      <div class="footer">Slide 6 / 7</div>
    </section>

    <section class="slide">
      <span class="kicker">Asks</span>
      <h2>What are my asks?</h2>
      <div class="footer">Slide 7 / 7</div>
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
