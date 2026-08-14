/* CODEX 1.3 — Workbench shell + AmigaDOS research CLI */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const state = {
    tractates: null,
    tree: null,
    xref: null,
    pins: loadPins(),
    history: [],
    histIdx: -1,
    z: 20,
    busy: 0,
    selected: null,
    selectedSef: null,
    selectedXref: null,
  };

  function loadPins() {
    try { return JSON.parse(localStorage.getItem("codex.pins") || "[]"); }
    catch { return []; }
  }
  function savePins() {
    localStorage.setItem("codex.pins", JSON.stringify(state.pins));
  }

  const pointer = $("#pointer");
  document.addEventListener("pointermove", (e) => {
    pointer.style.left = e.clientX + "px";
    pointer.style.top = e.clientY + "px";
  });

  function busy(on) {
    state.busy += on ? 1 : -1;
    if (state.busy < 0) state.busy = 0;
    document.body.classList.toggle("is-busy", state.busy > 0);
    $("#led").classList.toggle("on", state.busy > 0);
  }

  async function api(path, opts) {
    busy(true);
    try {
      const r = await fetch(path, opts);
      if (!r.ok) throw new Error(r.status + " " + r.statusText);
      return await r.json();
    } finally {
      busy(false);
    }
  }

  function clock() {
    const d = new Date();
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const pad = (n) => String(n).padStart(2, "0");
    $("#clock").textContent =
      `${days[d.getDay()]} ${pad(d.getDate())}-${mon[d.getMonth()]}-${String(d.getFullYear()).slice(2)}  ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  setInterval(clock, 1000);
  clock();

  const bootLines = [
    "CODEX KICKSTART  1.3  (40.068)",
    "A1200-class research desk",
    "",
    "Copyright 2026  local disk  SYS:Codex",
    "Not affiliated with Commodore-Amiga, Inc.",
    "",
    "Memory test ........ 8192K OK",
    "ROM checksum ....... OK",
    "CIA / custom chips .. OK",
    "",
    "Insert Workbench disk in DF0:",
    "Reading  CODEX.OS",
    "Mounting TXT:",
    "Mounting TOL:",
    "Mounting NUM:",
  ];

  function typeBoot() {
    return new Promise((resolve) => {
      const rom = $("#boot .rom");
      const bar = $("#boot .bar > i");
      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) {
        rom.textContent = bootLines.join("\n");
        bar.style.width = "100%";
        return resolve();
      }
      let i = 0;
      let acc = "";
      const tick = () => {
        if (i >= bootLines.length) return resolve();
        acc += bootLines[i] + "\n";
        rom.textContent = acc;
        bar.style.width = Math.round(((i + 1) / bootLines.length) * 100) + "%";
        i += 1;
        setTimeout(tick, i < 6 ? 70 : 110);
      };
      tick();
    });
  }

  async function finishBoot() {
    if ($("#boot").dataset.done) return;
    $("#boot").dataset.done = "1";
    $("#boot").style.display = "none";
    $("#workbench").classList.add("on");
    openWin("cli");
    openWin("tree");
    openWin("tract");
    termPrint(banner(), "ora");
    termPrint("Type  help  — or click CODEX / TREE / GEM.", "dim");
    $("#cmdline").focus();
    try {
      await refreshAll();
    } catch (err) {
      termPrint("NET: " + err.message, "err");
    }
  }

  function openWin(id) {
    const el = document.getElementById("win-" + id);
    if (!el) return;
    el.hidden = false;
    focusWin(el);
    if (id === "cli") setTimeout(() => $("#cmdline").focus(), 0);
  }
  function closeWin(el) { el.hidden = true; }
  function focusWin(el) {
    $$(".win").forEach((w) => w.classList.remove("active"));
    el.classList.add("active");
    el.style.zIndex = String(++state.z);
  }

  function wireWindows() {
    $$(".win").forEach((win) => {
      win.addEventListener("pointerdown", () => focusWin(win));
      const bar = $(".titlebar", win);
      let drag = null;
      bar.addEventListener("pointerdown", (e) => {
        if (e.target.closest(".gadget")) return;
        const r = win.getBoundingClientRect();
        drag = { x: e.clientX - r.left, y: e.clientY - r.top };
        bar.setPointerCapture(e.pointerId);
      });
      bar.addEventListener("pointermove", (e) => {
        if (!drag) return;
        win.style.left = Math.max(0, e.clientX - drag.x) + "px";
        win.style.top = Math.max(20, e.clientY - drag.y) + "px";
      });
      bar.addEventListener("pointerup", () => { drag = null; });
      $(".gadget.close", win)?.addEventListener("click", () => closeWin(win));
      $(".gadget.depth", win)?.addEventListener("click", () => {
        win.style.zIndex = "1";
        win.classList.remove("active");
      });
      $(".gadget.zoom", win)?.addEventListener("click", () => {
        if (win.dataset.zoomed) {
          win.style.left = win.dataset.l;
          win.style.top = win.dataset.t;
          win.style.width = win.dataset.w;
          win.style.height = win.dataset.h;
          delete win.dataset.zoomed;
        } else {
          win.dataset.l = win.style.left;
          win.dataset.t = win.style.top;
          win.dataset.w = win.style.width;
          win.dataset.h = win.style.height;
          win.dataset.zoomed = "1";
          win.style.left = "8px";
          win.style.top = "28px";
          win.style.width = "calc(100% - 16px)";
          win.style.height = "calc(100% - 50px)";
        }
      });
      const rz = $(".resize", win);
      if (rz) {
        let rs = null;
        rz.addEventListener("pointerdown", (e) => {
          e.stopPropagation();
          const r = win.getBoundingClientRect();
          rs = { x: e.clientX, y: e.clientY, w: r.width, h: r.height };
          rz.setPointerCapture(e.pointerId);
        });
        rz.addEventListener("pointermove", (e) => {
          if (!rs) return;
          win.style.width = Math.max(280, rs.w + (e.clientX - rs.x)) + "px";
          win.style.height = Math.max(160, rs.h + (e.clientY - rs.y)) + "px";
        });
        rz.addEventListener("pointerup", () => { rs = null; });
      }
    });
  }

  $$(".icon").forEach((ic) => {
    ic.addEventListener("click", () => {
      $$(".icon").forEach((x) => x.classList.remove("selected"));
      ic.classList.add("selected");
    });
    ic.addEventListener("dblclick", () => openWin(ic.dataset.open));
    ic.addEventListener("keydown", (e) => {
      if (e.key === "Enter") openWin(ic.dataset.open);
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "F1") { e.preventDefault(); openWin("cli"); termExec("help"); }
    if (e.key === "F2") { e.preventDefault(); openWin("tract"); }
    if (e.key === "F3") { e.preventDefault(); openWin("tree"); }
    if (e.key === "F4") { e.preventDefault(); openWin("gem"); $("#gem-in").focus(); }
    if (e.key === "F5") { e.preventDefault(); openWin("xref"); }
    if (e.key === "Escape") {
      const top = [...$$(".win")].filter((w) => !w.hidden).sort((a, b) => (+b.style.zIndex || 0) - (+a.style.zIndex || 0))[0];
      if (top && document.activeElement?.id !== "cmdline" && document.activeElement?.id !== "gem-in") closeWin(top);
    }
  });

  function weightWidth(s) {
    return { critical: 100, high: 78, medium: 52, low: 30 }[s] || 50;
  }

  function findTract(q) {
    if (!state.tractates) return null;
    const n = String(q || "").toLowerCase();
    return (state.tractates.tractates || []).find((x) =>
      x.id === n ||
      x.name.toLowerCase() === n ||
      x.name.toLowerCase().includes(n) ||
      String(x.rank) === n ||
      (x.aliases || []).some((al) => al.toLowerCase().includes(n))
    );
  }

  function findSef(q) {
    if (!state.tree) return null;
    const n = String(q || "").toLowerCase();
    return (state.tree.sefirot || []).find((s) =>
      String(s.id) === n ||
      s.key === n ||
      s.name.toLowerCase() === n ||
      s.name.toLowerCase().includes(n) ||
      (s.meaning || "").toLowerCase() === n
    );
  }

  function findPath(q) {
    if (!state.tree) return null;
    const n = String(q || "").toLowerCase();
    return (state.tree.paths || []).find((p) =>
      String(p.id) === n ||
      (p.letter || "") === q ||
      (p.letter_name || "").toLowerCase() === n ||
      (p.card || "").toLowerCase().includes(n)
    );
  }

  function renderTracts() {
    const box = $("#tract-list");
    if (!state.tractates) {
      box.innerHTML = "<p class='dim'>Mounting TXT: …</p>";
      return;
    }
    const src = state.tractates.ranking_source || {};
    $("#tract-src").innerHTML =
      `Ranking: <a href="${esc(src.url)}" target="_blank" rel="noopener">${esc(src.name)}</a>`;
    box.innerHTML = "";
    (state.tractates.tractates || []).forEach((a, i) => {
      const row = document.createElement("div");
      row.className = "shelf-row" + (state.selected === a.id ? " on" : "");
      row.tabIndex = 0;
      row.innerHTML = `
        <div class="rk">${String(a.rank).padStart(2, "0")}</div>
        <div class="who">
          <div class="nm">${esc(a.name)}</div>
          <div class="sub">${esc(a.century)} · ${esc(a.lang)}</div>
        </div>
        <div class="attr">${esc(a.tradition)}</div>
        <div class="meter"><i style="width:${weightWidth(a.weight)}%;--w:${weightWidth(a.weight)}%"></i></div>`;
      row.addEventListener("click", () => selectTract(a.id));
      row.addEventListener("keydown", (e) => { if (e.key === "Enter") selectTract(a.id); });
      box.appendChild(row);
      requestAnimationFrame(() => {
        setTimeout(() => { row.querySelector(".meter > i").style.width = weightWidth(a.weight) + "%"; }, 80 * i);
      });
    });
    if (state.selected) renderDossier(state.selected);
  }

  function selectTract(id) {
    state.selected = id;
    renderTracts();
    renderDossier(id);
    openWin("tract");
  }

  function renderDossier(id) {
    const a = findTract(id);
    const box = $("#dossier");
    if (!a) { box.classList.remove("open"); box.innerHTML = ""; return; }
    box.classList.add("open");
    box.innerHTML = `
      <h3>${String(a.rank).padStart(2, "0")}  ${esc(a.name)}</h3>
      <div class="meta">
        <span>${esc(a.tradition)}</span>
        <span>${esc(a.lang)}</span>
        <span>${esc(a.century)}</span>
      </div>
      <p>${esc(a.summary)}</p>
      <p><b>IN FILE</b>  ${esc(a.in_the_file)}</p>
      <p><b>AKA</b>  ${esc((a.aliases || []).join(" · "))}</p>
      ${a.excerpt ? `<div class="doc-excerpt">${esc(a.excerpt)}</div>` : ""}
      <p>${(a.sources || []).map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join("  ·  ")}</p>`;
  }

  function sefById(id) {
    return (state.tree?.sefirot || []).find((s) => s.id === id);
  }

  function renderTree() {
    const svg = $("#tree-svg");
    const list = $("#tree-list");
    if (!state.tree) {
      list.innerHTML = "Mounting TOL: …";
      return;
    }
    const sef = state.tree.sefirot || [];
    const paths = state.tree.paths || [];
    const onId = state.selectedSef;
    const onSef = sef.find((s) => s.key === onId || s.id === onId);
    const lines = paths.map((p) => {
      const a = sefById(p.src);
      const b = sefById(p.dst);
      if (!a || !b) return "";
      const hot = onSef && (p.src === onSef.id || p.dst === onSef.id);
      return `<line class="path${hot ? " on" : ""}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`;
    }).join("");
    const nodes = sef.map((s) => {
      const on = onSef && s.id === onSef.id;
      return `<g class="sef-hit" data-key="${esc(s.key)}">
        <circle class="sef${on ? " on" : ""}" cx="${s.x}" cy="${s.y}" r="12"/>
      </g>`;
    }).join("");
    svg.innerHTML = lines + nodes;
    svg.querySelectorAll(".sef-hit").forEach((g) => {
      g.addEventListener("click", () => selectSef(g.dataset.key));
    });
    list.innerHTML = sef.map((s) => `
      <div class="aid-item${onSef && s.id === onSef.id ? " on" : ""}" data-key="${esc(s.key)}" tabindex="0">
        <div><span class="who">${s.id}  ${esc(s.name)}</span>
          <span class="pill">${esc(s.pillar)}</span></div>
        <div>${esc(s.meaning)} · ${esc(s.planet)}</div>
      </div>`).join("");
    list.querySelectorAll(".aid-item").forEach((el) => {
      el.addEventListener("click", () => selectSef(el.dataset.key));
    });
    renderTreeDossier();
  }

  function selectSef(key) {
    state.selectedSef = key;
    renderTree();
    openWin("tree");
  }

  function renderTreeDossier() {
    const box = $("#tree-dossier");
    const s = findSef(state.selectedSef);
    if (!s) { box.classList.remove("open"); box.innerHTML = ""; return; }
    const paths = (state.tree.paths || []).filter((p) => p.src === s.id || p.dst === s.id);
    box.classList.add("open");
    box.innerHTML = `
      <h3>${s.id}  ${esc(s.name)}  ${esc(s.hebrew)}</h3>
      <div class="meta">
        <span>${esc(s.meaning)}</span>
        <span>${esc(s.pillar)}</span>
        <span>${esc(s.planet)}</span>
      </div>
      <p><b>NAME</b>  ${esc(s.divine_name)} · <b>ANGEL</b>  ${esc(s.archangel)}</p>
      <p><b>GRADE</b>  ${esc(s.grade)}</p>
      <p><b>PATHS</b>  ${paths.map((p) => `${p.id} ${p.letter} ${p.card}`).join(" · ") || "—"}</p>`;
  }

  async function runGem(text) {
    if (!text) return;
    const data = await api("/api/gematria?q=" + encodeURIComponent(text));
    const c = data.ciphers || {};
    const rows = [
      ["Hebrew", c.hebrew],
      ["Hebrew gadol", c.hebrew_gadol],
      ["Atbash", c.atbash],
      ["Greek", c.greek],
      ["Ordinal", c.ordinal],
      ["Reduction", c.reduction],
      ["Reverse", c.reverse],
    ];
    $("#gem-body").innerHTML = `
      <table class="wb" style="min-width:0">
        <thead><tr><th>CIPHER</th><th>N</th></tr></thead>
        <tbody>${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</tbody>
      </table>
      ${c.atbash_text ? `<p>Atbash text: ${esc(c.atbash_text)}</p>` : ""}
      <p>${(data.matches || []).length ? "Matches" : "No lexicon hits"}</p>
      ${(data.matches || []).map((m) =>
        `<div class="aid-item"><span class="who">${esc(m.word)}</span> ${esc(m.transliteration)} · ${esc(m.meaning)} · ${m.value}</div>`
      ).join("")}`;
    return data;
  }

  $("#gem-go").addEventListener("click", () => runGem($("#gem-in").value));
  $("#gem-in").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      runGem($("#gem-in").value);
    }
  });

  function renderXref() {
    const box = $("#xref-body");
    if (!state.xref) { box.innerHTML = "Mounting XREF: …"; return; }
    const entries = Object.entries(state.xref);
    $("#xref-meta").textContent = `Correspondences · ${entries.length} keys · hermetic / kabbalah / alchemy / tarot / astrology`;
    box.innerHTML = entries.map(([k, v]) => `
      <div class="aid-item${state.selectedXref === k ? " on" : ""}" data-key="${esc(k)}" tabindex="0">
        <div><span class="who">${esc(k)}</span></div>
        <div>${esc((v && v.kabbalah) || (v && v.hermeticism) || "")}</div>
      </div>`).join("");
    box.querySelectorAll(".aid-item").forEach((el) => {
      el.addEventListener("click", () => selectXref(el.dataset.key));
    });
    if (state.selectedXref) renderXrefDossier(state.selectedXref);
  }

  function selectXref(key) {
    state.selectedXref = key;
    renderXref();
    renderXrefDossier(key);
    openWin("xref");
  }

  function renderXrefDossier(key) {
    const box = $("#xref-dossier");
    const rec = state.xref?.[key];
    if (!rec) { box.classList.remove("open"); box.innerHTML = ""; return; }
    box.classList.add("open");
    const fields = ["hermeticism", "kabbalah", "alchemy", "tarot", "astrology"];
    box.innerHTML = `
      <h3>${esc(key)}</h3>
      ${fields.map((f) => rec[f] ? `<p><b>${f.toUpperCase()}</b>  ${esc(rec[f])}</p>` : "").join("")}`;
  }

  const term = $("#term-log");
  const cmd = $("#cmdline");

  function banner() {
    return [
      "CODEX 1.3  CLI",
      "SYS:CodexTerm  TXT:Tractate-10  TOL:Tree  NUM:Gematria  XREF:",
      "",
    ].join("\n");
  }

  function termPrint(text, cls) {
    const d = document.createElement("div");
    d.className = "out" + (cls ? " " + cls : "");
    d.textContent = text;
    term.appendChild(d);
    const body = $("#win-cli .body");
    body.scrollTop = body.scrollHeight;
  }

  cmd.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const line = cmd.value;
      cmd.value = "";
      if (line.trim()) {
        state.history.push(line);
        state.histIdx = state.history.length;
      }
      termExec(line);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!state.history.length) return;
      state.histIdx = Math.max(0, state.histIdx - 1);
      cmd.value = state.history[state.histIdx];
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      state.histIdx = Math.min(state.history.length, state.histIdx + 1);
      cmd.value = state.history[state.histIdx] || "";
    }
  });

  function termExec(line) {
    const raw = line.trim();
    termPrint("1> " + raw, "ora");
    if (!raw) return;
    const [verb, ...rest] = raw.split(/\s+/);
    const arg = rest.join(" ");
    const fn = commands[verb.toLowerCase()] || commands[aliases[verb.toLowerCase()]];
    if (!fn) {
      termPrint(`Unknown command "${verb}".  help  for the binder.`, "err");
      return;
    }
    Promise.resolve(fn(arg)).catch((err) => termPrint(String(err.message || err), "err"));
  }

  const aliases = {
    ls: "list", "?": "help", man: "help", dir: "list",
    cat: "show", type: "show", info: "show", open: "open",
    q: "search", find: "search",
    gem: "gematria", num: "gematria", sum: "gematria",
    tract: "list", tractates: "list", books: "list",
    tol: "tree", sef: "tree",
    correspond: "xref", corr: "xref",
  };

  const HELP = `CODEX 1.3 command binder

  help                 this text
  list | tract         TRACTATE-10
  show <name|#>        open a tractate
  tree [sefirah]       Tree of Life
  path <11-32|card>    a letter / tarot path
  gematria <text>      Hebrew / Greek / English ciphers
  xref <term>          correspondences
  search | find <term> tractates + tree + xref
  cite <name>          source URLs
  pin <name>           personal slips
  unpin <name>
  pins
  status
  open <tract|tree|gem|xref|cli>
  clear
  about

  F1 help   F2 TRACT   F3 TREE   F4 GEM   F5 XREF
  Double-click desktop icons.  Drag orange title bars.`;

  const commands = {
    help() { termPrint(HELP); },
    about() {
      termPrint(
        "CODEX 1.3 — Amiga Workbench-inspired research desk.\n" +
        "TRACTATE-10 is an editorial ranking of public-domain / public-record texts.\n" +
        "Tree uses the classic 10 sefirot + 22 Golden Dawn letter/tarot paths.\n" +
        "Gematria is a calculator, not an oracle. Homage — not a Commodore product."
      );
    },
    clear() { term.innerHTML = ""; },
    open(arg) {
      const map = {
        tract: "tract", tractate: "tract", codex: "tract", txt: "tract",
        tree: "tree", tol: "tree",
        gem: "gem", gematria: "gem", num: "gem",
        xref: "xref", cards: "xref",
        cli: "cli", term: "cli",
      };
      const id = map[(arg || "").toLowerCase()];
      if (!id) return termPrint("open tract | tree | gem | xref | cli", "err");
      openWin(id);
    },
    async list() {
      if (!state.tractates) await refreshAll();
      termPrint((state.tractates.tractates || []).map((a) =>
        `${String(a.rank).padStart(2, "0")}  ${a.name.padEnd(28)}  ${(a.tradition || "").padEnd(18)}  ${a.century}`
      ).join("\n"));
      openWin("tract");
    },
    show(arg) {
      if (!arg) return termPrint("show <name|#>");
      const a = findTract(arg);
      if (a) {
        selectTract(a.id);
        termPrint(
          [
            `${a.name}  [${a.tradition}]  ${a.century}`,
            `aka  ${(a.aliases || []).join(", ")}`,
            "",
            a.summary,
            "",
            "IN FILE  " + a.in_the_file,
            a.excerpt ? "\n" + a.excerpt : "",
          ].join("\n")
        );
        return;
      }
      const s = findSef(arg);
      if (s) {
        selectSef(s.key);
        termPrint(`${s.name}  ${s.hebrew}  ${s.meaning}\n${s.divine_name} · ${s.archangel} · ${s.planet}`);
        return;
      }
      termPrint("No dossier for " + arg, "err");
    },
    cite(arg) {
      if (!arg) return termPrint("cite <name|#>");
      const a = findTract(arg);
      if (!a) return termPrint("No record for " + arg, "err");
      termPrint(`${a.name}\n` + (a.sources || []).map((s) => `  ${s.label}\n      ${s.url}`).join("\n"), "ok");
    },
    tree(arg) {
      openWin("tree");
      if (arg) {
        const s = findSef(arg);
        if (!s) return termPrint("No sefirah " + arg, "err");
        selectSef(s.key);
        termPrint(`${s.id}  ${s.name}  ${s.meaning}  ${s.planet}`);
        return;
      }
      termPrint((state.tree?.sefirot || []).map((s) =>
        `${String(s.id).padStart(2, " ")}  ${s.name.padEnd(10)}  ${s.meaning.padEnd(14)}  ${s.planet}`
      ).join("\n"));
    },
    path(arg) {
      if (!arg) return termPrint("path <11-32|letter|card>");
      const p = findPath(arg);
      if (!p) return termPrint("No path " + arg, "err");
      const a = sefById(p.src);
      const b = sefById(p.dst);
      openWin("tree");
      termPrint(`Path ${p.id}  ${p.letter} ${p.letter_name}  ${p.card}\n${a?.name || p.src} → ${b?.name || p.dst}  ${p.astrology}`);
    },
    async gematria(arg) {
      if (!arg) return termPrint("gematria <text>");
      openWin("gem");
      $("#gem-in").value = arg;
      const data = await runGem(arg);
      const c = data.ciphers || {};
      termPrint(
        `${arg}\n  heb ${c.hebrew}  gadol ${c.hebrew_gadol}  greek ${c.greek}  ord ${c.ordinal}  red ${c.reduction}`
      );
    },
    xref(arg) {
      openWin("xref");
      if (!arg) {
        termPrint(Object.keys(state.xref || {}).join("  "));
        return;
      }
      const key = Object.keys(state.xref || {}).find((k) => k.toLowerCase() === arg.toLowerCase() || k.toLowerCase().includes(arg.toLowerCase()));
      if (!key) return termPrint("No xref for " + arg, "err");
      selectXref(key);
      const rec = state.xref[key];
      termPrint(`${key}\n  KAB  ${rec.kabbalah || "—"}\n  HER  ${rec.hermeticism || "—"}`);
    },
    async search(arg) {
      if (!arg) return termPrint("find <term>");
      const data = await api("/api/search?q=" + encodeURIComponent(arg));
      if (!data.hits?.length) return termPrint("No hits for " + arg, "dim");
      termPrint(data.hits.map((h) => `[${h.kind}] ${h.name}\n      ${h.detail}`).join("\n"));
    },
    pin(arg) {
      if (!arg) return termPrint("pin <name>");
      if (!state.pins.includes(arg)) state.pins.push(arg);
      savePins();
      termPrint("Pinned " + arg, "ok");
    },
    unpin(arg) {
      state.pins = state.pins.filter((p) => p.toLowerCase() !== arg.toLowerCase());
      savePins();
      termPrint("Dropped " + arg);
    },
    pins() {
      termPrint(state.pins.length ? state.pins.map((p) => "* " + p).join("\n") : "(empty slips)");
    },
    async status() {
      const st = await api("/api/status");
      termPrint(
        `CODEX ${st.version}  port ${st.port}\n` +
        `tractates: ${state.tractates?.tractates?.length ?? 0}  sefirot: ${state.tree?.sefirot?.length ?? 0}\n` +
        `pins: ${state.pins.length}`
      );
    },
    time() { termPrint(new Date().toUTCString()); },
  };

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }

  async function refreshAll() {
    const [tractates, tree, xrefWrap] = await Promise.all([
      api("/api/tractates"),
      api("/api/tree"),
      api("/api/xref"),
    ]);
    state.tractates = tractates;
    state.tree = tree;
    state.xref = xrefWrap.entries || xrefWrap;
    if (!state.selected && tractates.tractates?.[0]) state.selected = tractates.tractates[0].id;
    if (!state.selectedSef && tree.sefirot?.[0]) state.selectedSef = tree.sefirot[0].key;
    renderTracts();
    renderTree();
    renderXref();
    termPrint(
      `TXT: ${tractates.tractates.length} tractates · TOL: ${tree.sefirot.length} sefirot / ${tree.paths.length} paths · XREF: ${Object.keys(state.xref).length}`,
      "ok"
    );
  }

  wireWindows();
  $("#skip").addEventListener("click", finishBoot);
  document.addEventListener("keydown", (e) => {
    if (!$("#boot").dataset.done && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      finishBoot();
    }
  });
  typeBoot().then(() => setTimeout(finishBoot, 450));
})();
