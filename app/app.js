/* Sinexflix app (web) — catálogo Cinemeta, Onde assistir (TMDB/JustWatch),
   clássicos completos (Internet Archive) e TV aberta (lista iptv-org). */
"use strict";

const API = {
  cine: "https://v3-cinemeta.strem.io",
  ia: "https://archive.org",
  tmdb: "https://api.themoviedb.org/3",
  tmdbImg: "https://image.tmdb.org/t/p/w154",
  m3u: "https://iptv-org.github.io/iptv/countries/br.m3u",
};

const GENRES = [
  ["Action", "Ação"], ["Adventure", "Aventura"], ["Animation", "Animação"], ["Comedy", "Comédia"],
  ["Crime", "Crime"], ["Documentary", "Documentário"], ["Drama", "Drama"], ["Family", "Família"],
  ["Fantasy", "Fantasia"], ["Horror", "Terror"], ["Mystery", "Mistério"], ["Romance", "Romance"],
  ["Sci-Fi", "Ficção científica"], ["Thriller", "Suspense"], ["War", "Guerra"], ["Western", "Faroeste"],
  ["History", "História"], ["Biography", "Biografia"], ["Sport", "Esporte"],
];
const GENRE_PT = Object.fromEntries(GENRES);
const KIDS_GENRES = ["Animation", "Family"];
const IA_COLLECTIONS = [
  ["feature_films", "Filmes clássicos"], ["Film_Noir", "Film noir"], ["SciFi_Horror", "Ficção e terror"],
  ["Comedy_Films", "Comédias"], ["silent_films", "Cinema mudo"], ["animationandcartoons", "Desenhos"],
];
const LIVE_GROUPS = {
  News: "Notícias", General: "Variedades", Entertainment: "Entretenimento", Kids: "Infantil",
  Animation: "Animação", Movies: "Filmes", Series: "Séries", Sports: "Esportes", Music: "Música",
  Religious: "Religiosos", Education: "Educação", Culture: "Cultura", Documentary: "Documentários",
  Comedy: "Comédia", Legislative: "Legislativo", Outdoor: "Natureza", Lifestyle: "Estilo de vida",
  Cooking: "Culinária", Classic: "Clássicos", Travel: "Viagem", Family: "Família", Business: "Negócios",
  Auto: "Automóveis", Shop: "Compras", Public: "Públicos", Undefined: "Outros",
};

/* ------------------------------------------------------------------ util */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const first = (v) => (Array.isArray(v) ? v[0] : v) ?? "";
const stripHtml = (s) => String(s || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim();
const today = () => new Date().toISOString().slice(0, 10);
const ddmm = (iso) => (iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) : "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const store = {
  get(key, def) { try { const v = localStorage.getItem("sx_" + key); return v == null ? def : JSON.parse(v); } catch { return def; } },
  set(key, val) { try { localStorage.setItem("sx_" + key, JSON.stringify(val)); } catch { /* armazenamento indisponível */ } },
};

let toastTimer;
function toast(msg, ms = 2600) {
  const el = $("#toast");
  el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (el.hidden = true), ms);
}

const ICON = {
  play: '<svg viewBox="0 0 24 24"><path d="M7 4v16l13-8z"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7z"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="m9.5 16.2-4.2-4.2-1.4 1.4 5.6 5.6L21 7.5l-1.4-1.4z"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4z"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15.4 5.4 14 4l-8 8 8 8 1.4-1.4L8.8 12z"/></svg>',
  share: '<svg viewBox="0 0 24 24"><path d="M18 16a3 3 0 0 0-2.4 1.2l-6.7-3.4a3 3 0 0 0 0-1.6l6.7-3.4A3 3 0 1 0 15 7l-6.7 3.4a3 3 0 1 0 0 3.2L15 17a3 3 0 1 0 3-1z"/></svg>',
  info: '<svg viewBox="0 0 24 24"><path d="M11 10h2v7h-2zm0-4h2v2h-2zm1-4a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/></svg>',
  dice: '<svg viewBox="0 0 24 24"><path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm2.5 3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm9 9a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm-4.5-4.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"/></svg>',
};

/* ------------------------------------------------------------------ rede */
const memCache = new Map();
async function getJSON(url, { ttl = 30, headers } = {}) {
  const hit = memCache.get(url);
  if (hit && Date.now() - hit.t < ttl * 60000) return hit.v;
  const res = await fetch(url, { headers });
  if (!res.ok) throw Object.assign(new Error("HTTP " + res.status), { status: res.status });
  const v = await res.json();
  memCache.set(url, { t: Date.now(), v });
  return v;
}

/* ------------------------------------------------------------------ estado */
const state = {
  tab: "inicio",
  kids: store.get("kids", { on: false }),
  tmdbKey: store.get("tmdbKey", ""),
  region: store.get("region", "BR"),
};
const isKids = () => !!state.kids.on;

/* ------------------------------------------------------------------ Cinemeta */
const Cine = {
  async catalog(type, id = "top", { genre, search, skip } = {}) {
    const extra = [];
    if (search) extra.push("search=" + encodeURIComponent(search));
    if (genre) extra.push("genre=" + encodeURIComponent(genre));
    if (skip) extra.push("skip=" + skip);
    const url = `${API.cine}/catalog/${type}/${id}${extra.length ? "/" + extra.join("&") : ""}.json`;
    const data = await getJSON(url);
    let items = (data.metas || []).map((m) => Cine.toItem(m, type)).filter(Boolean);
    if (isKids()) items = items.filter((i) => i.genres.some((g) => KIDS_GENRES.includes(g)));
    return items;
  },
  async meta(type, id) {
    const data = await getJSON(`${API.cine}/meta/${type}/${id}.json`, { ttl: 120 });
    return data.meta || null;
  },
  toItem(m, type) {
    const id = m.imdb_id || m.id;
    if (!id) return null;
    return {
      kind: type, id, name: m.name || "", year: String(m.releaseInfo || m.year || "").slice(0, 9),
      poster: m.poster || "", background: m.background || m.poster || "", logo: m.logo || "",
      rating: parseFloat(m.imdbRating) || 0, genres: m.genres || m.genre || [],
      plot: m.description || "",
    };
  },
  trailers(meta) {
    const out = [];
    (meta.trailerStreams || []).forEach((t) => t.ytId && out.push(t.ytId));
    (meta.trailers || []).forEach((t) => t.source && !out.includes(t.source) && out.push(t.source));
    return out;
  },
};

/* ------------------------------------------------------------------ Internet Archive */
const IA = {
  img: (id) => `${API.ia}/services/img/${encodeURIComponent(id)}`,
  async search({ q, coll, sort = "downloads desc", rows = 30, page = 1, year } = {}) {
    if (isKids()) coll = "animationandcartoons";
    const parts = ["mediatype:(movies)"];
    parts.push(`collection:(${coll || IA_COLLECTIONS.map((c) => c[0]).join(" OR ")})`);
    if (q) parts.push(`title:("${q.replace(/["():\[\]{}^~*?!+\-\\]/g, " ").trim()}")`);
    if (year) parts.push(`year:[${+year - 1} TO ${+year + 1}]`);
    const p = new URLSearchParams();
    p.set("q", parts.join(" AND "));
    ["identifier", "title", "year", "description", "runtime"].forEach((f) => p.append("fl[]", f));
    p.set("sort[]", sort); p.set("rows", rows); p.set("page", page); p.set("output", "json");
    const data = await getJSON(`${API.ia}/advancedsearch.php?${p}`, { ttl: 60 });
    const r = data.response || {};
    return { total: r.numFound || 0, items: (r.docs || []).map(IA.toItem).filter(Boolean) };
  },
  toItem(d) {
    if (!d.identifier) return null;
    return {
      kind: "ia", id: d.identifier, name: first(d.title) || d.identifier,
      year: String(first(d.year) || "").slice(0, 4), poster: IA.img(d.identifier),
      background: IA.img(d.identifier), plot: stripHtml(first(d.description)), genres: [],
    };
  },
  async files(id) {
    const meta = await getJSON(`${API.ia}/metadata/${encodeURIComponent(id)}`, { ttl: 240 });
    const ext = /\.(mp4|m4v|webm|ogv|mov)$/i;
    const vids = (meta.files || []).filter((f) => ext.test(f.name || "") && !/sample|trailer/i.test(f.name));
    const base = (n) => n.replace(/(\.ia)?(_512kb)?\.\w+$/i, "").toLowerCase();
    const score = (f) => {
      let s = 0; const n = f.name.toLowerCase(); const fmt = (f.format || "").toLowerCase();
      if (n.endsWith(".mp4")) s += 100;
      if (/h\.264|mpeg4/.test(fmt)) s += 20;
      if (n.includes("512kb")) s -= 30;
      s += Math.min((+f.size || 0) / 1e8, 15);
      return s;
    };
    const best = new Map();
    vids.forEach((f) => { const b = base(f.name); if (!best.has(b) || score(f) > score(best.get(b))) best.set(b, f); });
    const files = [...best.values()].sort((a, b) => a.name.localeCompare(b.name)).map((f) => ({
      name: f.title || f.name, url: `${API.ia}/download/${encodeURIComponent(id)}/${f.name.split("/").map(encodeURIComponent).join("/")}`,
      size: +f.size || 0,
    }));
    const md = meta.metadata || {};
    return { files, title: first(md.title) || id, plot: stripHtml(first(md.description)), year: String(first(md.year) || first(md.date) || "").slice(0, 4) };
  },
  async random(count = 18) {
    const coll = isKids() ? "animationandcartoons" : "feature_films";
    const { total } = await IA.search({ coll, rows: 1 });
    const page = 1 + Math.floor(Math.random() * Math.max(1, Math.min(total, 5000) / 50));
    const { items } = await IA.search({ coll, rows: 50, page });
    return items.sort(() => Math.random() - 0.5).slice(0, count);
  },
};

/* ------------------------------------------------------------------ TMDB (Onde assistir) */
const TMDB = {
  enabled: () => !!state.tmdbKey,
  async get(path, params = {}) {
    const key = state.tmdbKey.trim();
    const headers = { Accept: "application/json" };
    const p = new URLSearchParams(params);
    if (key.startsWith("eyJ")) headers.Authorization = "Bearer " + key; else p.set("api_key", key);
    return getJSON(`${API.tmdb}${path}?${p}`, { ttl: 720, headers });
  },
  async providers(kind, imdb) {
    const found = await TMDB.get(`/find/${imdb}`, { external_source: "imdb_id" });
    const hit = (kind === "movie" ? found.movie_results : found.tv_results) || [];
    if (!hit.length) return null;
    const data = await TMDB.get(`/${kind === "movie" ? "movie" : "tv"}/${hit[0].id}/watch/providers`);
    return (data.results || {})[state.region] || {};
  },
};

/* ------------------------------------------------------------------ TV ao vivo */
const Live = {
  channels: null,
  status: store.get("liveStatus", {}),
  async load() {
    if (Live.channels) return Live.filtered();
    const res = await fetch(API.m3u);
    if (!res.ok) throw new Error("lista indisponível");
    const text = await res.text();
    const byId = new Map(); let cur = null;
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (line.startsWith("#EXTINF")) {
        const attr = (k) => (line.match(new RegExp(k + '="([^"]*)"')) || [])[1] || "";
        cur = { name: line.split(",").pop().trim(), id: attr("tvg-id") || line.split(",").pop().trim(), logo: attr("tvg-logo"),
          groups: (attr("group-title") || "Undefined").split(";").map((g) => g.trim()).filter(Boolean) };
      } else if (line && !line.startsWith("#") && cur) {
        cur.url = line;
        const blocked = /xxx|adult/i.test(cur.name + " " + cur.groups.join(" "));
        if (!blocked && line.startsWith("https://")) {          // http é bloqueado em sites https
          const key = cur.id.toLowerCase();
          if (byId.has(key)) byId.get(key).alts.push(cur.url);
          else byId.set(key, { ...cur, alts: [] });
        }
        cur = null;
      }
    }
    Live.channels = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
    return Live.filtered();
  },
  filtered() {
    let list = Live.channels || [];
    if (isKids()) list = list.filter((c) => c.groups.some((g) => ["Kids", "Animation", "Family"].includes(g)));
    return list;
  },
  clean: (n) => n.replace(/\s*\[(Not 24\/7|Geo-blocked)\]/gi, "").trim(),
  sources: (c) => [c.url, ...c.alts],
  srcState(url) { const s = Live.status[url]; if (!s || Date.now() - s[1] > 864e5) return null; return s[0]; },
  chanState(c) { const s = Live.sources(c).map((u) => Live.srcState(u)); if (s.includes(true)) return true; if (s.length && s.every((x) => x === false)) return false; return null; },
  async check(url, timeout = 7000) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeout);
    try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) return false; const txt = (await r.text()).slice(0, 200); return txt.includes("#EXTM3U"); }
    catch { return false; } finally { clearTimeout(t); }
  },
  async checkAll(onProgress) {
    const urls = Live.filtered().flatMap(Live.sources);
    let done = 0, ok = 0, i = 0;
    const worker = async () => {
      while (i < urls.length) {
        const u = urls[i++]; const good = await Live.check(u);
        Live.status[u] = [good, Date.now()]; done++; if (good) ok++;
        onProgress && onProgress(done, urls.length);
      }
    };
    await Promise.all(Array.from({ length: 16 }, worker));
    store.set("liveStatus", Live.status);
    return { ok, total: urls.length };
  },
};

/* ------------------------------------------------------------------ Minha Lista / histórico */
const Lib = {
  list: () => store.get("list", []).filter((i) => !isKids() || i.kidsOk),
  has: (kind, id) => store.get("list", []).some((i) => i.kind === kind && i.id === id),
  toggle(item) {
    let all = store.get("list", []);
    if (all.some((i) => i.kind === item.kind && i.id === item.id)) {
      all = all.filter((i) => !(i.kind === item.kind && i.id === item.id)); store.set("list", all); toast("Removido da Minha Lista"); return false;
    }
    const kidsOk = isKids() || (item.genres || []).some((g) => KIDS_GENRES.includes(g));
    all.unshift({ kind: item.kind, id: item.id, name: item.name, year: item.year, poster: item.poster, genres: item.genres || [], kidsOk, added: Date.now() });
    store.set("list", all); toast("Adicionado à Minha Lista"); return true;
  },
  watched: () => store.get("watched", []).filter((i) => !isKids() || i.kidsOk),
  addWatched(item) {
    const all = store.get("watched", []).filter((i) => !(i.kind === item.kind && i.id === item.id));
    all.unshift({ ...item, kidsOk: isKids(), when: Date.now() }); store.set("watched", all.slice(0, 40));
  },
  history: () => store.get("history", []),
  addHistory(q) { const h = store.get("history", []).filter((x) => x.toLowerCase() !== q.toLowerCase()); h.unshift(q); store.set("history", h.slice(0, 12)); },
};

/* ------------------------------------------------------------------ componentes */
function cardHTML(item, opts = {}) {
  const badge = item.kind === "ia" ? '<span class="badge free">Grátis</span>'
    : item.kind === "series" ? '<span class="badge">Série</span>' : "";
  const rate = item.rating ? `<span class="badge rate">★ ${item.rating.toFixed(1)}</span>` : "";
  const img = item.poster ? `<img src="${esc(item.poster)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : "";
  return `<button class="card" data-open="${esc(item.kind)}" data-id="${esc(item.id)}" aria-label="${esc(item.name)}">
    <div class="poster"><div class="ph">${esc(item.name)}</div>${img}${opts.noBadge ? "" : badge}${rate}</div>
    <div class="card-title">${esc(item.name)}</div></button>`;
}
function chanCardHTML(c) {
  const st = Live.chanState(c);
  const dot = `<i class="dot ${st === true ? "ok" : st === false ? "bad" : ""}"></i>`;
  const logo = c.logo ? `<img src="${esc(c.logo)}" alt="" loading="lazy" onerror="this.remove()">` : "";
  return `<button class="card chan-card" data-chan="${esc(c.id)}" aria-label="${esc(Live.clean(c.name))}">
    <div class="poster"><div class="ph">${esc(Live.clean(c.name))}</div>${logo}${dot}</div>
    <div class="card-title">${esc(Live.clean(c.name))}</div></button>`;
}
function skeletonRail(n = 6) {
  return `<div class="rail">${Array.from({ length: n }, () => '<div class="card"><div class="poster skel"></div><div class="skel" style="height:12px;width:80%"></div></div>').join("")}</div>`;
}
function rowShell(id, title, sub = "", more = "") {
  return `<section class="row" id="${id}"><div class="row-head pad"><div><h2 class="row-title">${esc(title)}</h2>${sub ? `<div class="row-sub">${esc(sub)}</div>` : ""}</div>${more}</div>${skeletonRail()}</section>`;
}
async function fillRow(id, loader, { wide = false, hideEmpty = true } = {}) {
  const sec = document.getElementById(id); if (!sec) return;
  try {
    const items = await loader();
    if (!items.length) { if (hideEmpty) sec.remove(); else sec.querySelector(".rail").outerHTML = '<p class="pad empty">Nada aqui ainda.</p>'; return; }
    sec.querySelector(".rail").outerHTML = `<div class="rail${wide ? " wide" : ""}">${items.map((i) => cardHTML(i)).join("")}</div>`;
    remember(items);
  } catch (e) {
    sec.querySelector(".rail").outerHTML = `<p class="pad" style="color:var(--muted)">Não deu para carregar agora. <button class="row-more" data-retry>Tentar de novo</button></p>`;
    sec.querySelector("[data-retry]").onclick = () => { sec.querySelector("p").outerHTML = skeletonRail(); fillRow(id, loader, { wide, hideEmpty }); };
  }
}
/* guarda itens já vistos para abrir detalhes instantaneamente */
const seen = new Map();
function remember(items) { items.forEach((i) => seen.set(i.kind + ":" + i.id, i)); }

/* ------------------------------------------------------------------ navegação e camadas */
const layers = [];
function pushLayer(el, onClose) {
  $("#overlays").appendChild(el);
  layers.push({ el, onClose });
  history.pushState({ layer: layers.length }, "");
  document.body.style.overflow = "hidden";
}
function popLayer() {
  const l = layers.pop(); if (!l) return;
  l.onClose && l.onClose(); l.el.remove();
  if (!layers.length) document.body.style.overflow = "";
}
/* Fechar uma camada volta o histórico (assim o "voltar" do Android também fecha).
   closeTop devolve uma promessa que só resolve quando a camada saiu de fato. */
const pendingPops = [];
function closeTop() {
  return new Promise((resolve) => {
    if (!layers.length) return resolve();
    pendingPops.push(resolve);
    history.back();
  });
}
async function closeAll() { while (layers.length) await closeTop(); }
window.addEventListener("popstate", () => {
  if (layers.length) { popLayer(); const r = pendingPops.shift(); r && r(); }
  else if (location.hash.slice(1) !== state.tab) showTab(location.hash.slice(1) || "inicio", false);
});

function sheet(html, { back = false } = {}) {
  const el = document.createElement("div");
  el.className = "sheet";
  el.innerHTML = `<button class="sheet-close${back ? " sheet-back" : ""}" aria-label="${back ? "Voltar" : "Fechar"}">${back ? ICON.back : ICON.close}</button>${html}`;
  el.querySelector(".sheet-close").onclick = () => closeTop();
  pushLayer(el);
  el.addEventListener("click", delegate);
  return el;
}

function showTab(tab, push = true) {
  if (!["inicio", "buscar", "aovivo", "lista"].includes(tab)) tab = "inicio";
  state.tab = tab;
  $$(".tabbar button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  $$(".view").forEach((v) => (v.hidden = v.dataset.view !== tab));
  if (push && location.hash.slice(1) !== tab) history.replaceState(null, "", "#" + tab);
  const view = $("#view-" + tab);
  if (!view.dataset.ready || tab === "lista") { view.dataset.ready = "1"; RENDER[tab](view); }
  window.scrollTo({ top: 0 });
}

/* clique em qualquer cartão abre detalhes */
function delegate(e) {
  const card = e.target.closest("[data-open]");
  if (card) { e.preventDefault(); openDetail(card.dataset.open, card.dataset.id); return; }
  const chan = e.target.closest("[data-chan]");
  if (chan) { e.preventDefault(); playChannel(chan.dataset.chan); }
}

/* ------------------------------------------------------------------ INÍCIO */
const RENDER = {};
RENDER.inicio = async (view) => {
  const kids = isKids();
  view.innerHTML = `
    <div class="hero" id="hero"><div class="hero-slide skel"></div></div>
    ${rowShell("r-cont", "Continue assistindo")}
    ${rowShell("r-ia", kids ? "Desenhos clássicos completos" : "Clássicos completos grátis", "Toque e assista", `<button class="row-more" data-go="ia">Ver tudo</button>`)}
    ${rowShell("r-mov", kids ? "Filmes infantis em alta" : "Filmes em alta")}
    ${rowShell("r-ser", kids ? "Séries infantis em alta" : "Séries em alta")}
    <section class="row pad"><button class="btn hot block" id="surpriseBtn">${ICON.dice} Surpreenda-me com um clássico</button></section>
    ${rowShell("r-top", "Os mais bem avaliados")}
    ${kids ? "" : rowShell("r-anim", "Animação")}
    ${kids ? "" : rowShell("r-com", "Comédia")}
    ${kids ? "" : rowShell("r-noir", "Film noir completos", "Grátis")}
  `;
  view.onclick = delegate;
  $("#surpriseBtn").onclick = openSurprise;
  view.querySelector('[data-go="ia"]').onclick = () => openCollection(kids ? "animationandcartoons" : "feature_films");

  const genre = kids ? "Animation" : undefined;
  Cine.catalog("movie", "top", { genre }).then((items) => { remember(items); renderHero(items.filter((i) => i.background).slice(0, 7)); }).catch(() => $("#hero").remove());
  fillRow("r-cont", async () => Lib.watched().filter((w) => w.kind === "ia").slice(0, 12));
  fillRow("r-ia", async () => (await IA.search({ coll: kids ? "animationandcartoons" : "feature_films", rows: 24 })).items);
  fillRow("r-mov", () => Cine.catalog("movie", "top", { genre }));
  fillRow("r-ser", () => Cine.catalog("series", "top", { genre }));
  fillRow("r-top", () => Cine.catalog("movie", "imdbRating", { genre: genre || undefined }));
  if (!kids) {
    fillRow("r-anim", () => Cine.catalog("movie", "top", { genre: "Animation" }));
    fillRow("r-com", () => Cine.catalog("movie", "top", { genre: "Comedy" }));
    fillRow("r-noir", async () => (await IA.search({ coll: "Film_Noir", rows: 24 })).items);
  }
};

let heroTimer;
function renderHero(items) {
  const hero = $("#hero"); if (!hero || !items.length) { hero && hero.remove(); return; }
  hero.innerHTML = `<div class="hero-track" id="heroTrack">${items.map((m, n) => `
    <article class="hero-slide">
      <img class="bg" src="${esc(m.background)}" alt="" ${n ? 'loading="lazy"' : ""}>
      <div class="hero-info">
        ${m.logo ? `<img class="hero-logo" src="${esc(m.logo)}" alt="${esc(m.name)}" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><h2 class="hero-name" hidden>${esc(m.name)}</h2>` : `<h2 class="hero-name">${esc(m.name)}</h2>`}
        <div class="hero-meta">${m.rating ? `<span class="star">★ ${m.rating.toFixed(1)}</span>` : ""}<span>${esc(m.year)}</span>${m.genres.slice(0, 3).map((g) => `<span>${esc(GENRE_PT[g] || g)}</span>`).join("")}</div>
        <div class="hero-actions">
          <button class="btn primary" data-trailer="${esc(m.id)}">${ICON.play} Trailer</button>
          <button class="btn ghost" data-open="movie" data-id="${esc(m.id)}">${ICON.info} Detalhes</button>
        </div>
      </div>
    </article>`).join("")}</div>
    <div class="hero-dots">${items.map((_, n) => `<i class="${n ? "" : "on"}"></i>`).join("")}</div>`;
  const track = $("#heroTrack");
  const dots = $$(".hero-dots i", hero);
  track.addEventListener("scroll", () => {
    const n = Math.round(track.scrollLeft / track.clientWidth);
    dots.forEach((d, i) => d.classList.toggle("on", i === n));
  }, { passive: true });
  hero.querySelectorAll("[data-trailer]").forEach((b) => (b.onclick = () => playTrailerFor("movie", b.dataset.trailer)));
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  clearInterval(heroTimer);
  if (!reduce) {
    let paused = false;
    track.addEventListener("touchstart", () => (paused = true), { passive: true });
    heroTimer = setInterval(() => {
      if (paused || document.hidden || state.tab !== "inicio" || layers.length) return;
      const n = (Math.round(track.scrollLeft / track.clientWidth) + 1) % items.length;
      track.scrollTo({ left: n * track.clientWidth, behavior: "smooth" });
    }, 6500);
  }
}

async function openSurprise() {
  const el = sheet(`<div class="pad" style="padding-top:calc(env(safe-area-inset-top,0px) + 70px)">
    <h2 class="view-title">Surpreenda-me</h2><p style="color:var(--muted);margin-top:-6px">Clássicos completos sorteados para você.</p>
    <div id="surpriseGrid"><div class="spinner"></div></div>
    <button class="btn block" id="again" style="margin-top:18px">${ICON.dice} Sortear de novo</button></div>`);
  const load = async () => {
    $("#surpriseGrid", el).innerHTML = '<div class="spinner"></div>';
    try { const items = await IA.random(); remember(items); $("#surpriseGrid", el).innerHTML = `<div class="grid">${items.map((i) => cardHTML(i)).join("")}</div>`; }
    catch { $("#surpriseGrid", el).innerHTML = '<div class="empty">Não deu para sortear agora. Tente de novo.</div>'; }
  };
  $("#again", el).onclick = load; load();
}

async function openCollection(coll, title) {
  title = title || (IA_COLLECTIONS.find((c) => c[0] === coll) || [, "Acervo"])[1];
  let page = 1, total = 0;
  const el = sheet(`<div class="pad" style="padding-top:calc(env(safe-area-inset-top,0px) + 70px)">
    <h2 class="view-title">${esc(title)}</h2>
    <div class="chips" style="margin:0 calc(-1 * var(--gutter-l))" id="collChips">${(isKids() ? IA_COLLECTIONS.filter((c) => c[0] === "animationandcartoons") : IA_COLLECTIONS).map(([c, t]) => `<button class="chip${c === coll ? " on" : ""}" data-coll="${c}">${t}</button>`).join("")}</div>
    <p class="note" style="color:var(--muted);font-size:13px">Filmes em domínio público do Internet Archive. Assista completos, de graça.</p>
    <div class="grid" id="collGrid"></div><div id="collMore"></div></div>`, { back: true });
  const load = async (reset) => {
    if (reset) { page = 1; $("#collGrid", el).innerHTML = ""; }
    $("#collMore", el).innerHTML = '<div class="spinner"></div>';
    try {
      const r = await IA.search({ coll, rows: 36, page }); total = r.total; remember(r.items);
      $("#collGrid", el).insertAdjacentHTML("beforeend", r.items.map((i) => cardHTML(i, { noBadge: true })).join(""));
      $("#collMore", el).innerHTML = page * 36 < total ? `<button class="btn block" style="margin-top:16px">Carregar mais</button>` : "";
      const b = $("#collMore button", el); if (b) b.onclick = () => { page++; load(); };
    } catch { $("#collMore", el).innerHTML = '<div class="empty">Não deu para carregar. Verifique a internet.</div>'; }
  };
  $$("#collChips .chip", el).forEach((c) => (c.onclick = () => { coll = c.dataset.coll; $$("#collChips .chip", el).forEach((x) => x.classList.toggle("on", x === c)); $(".view-title", el).textContent = c.textContent; load(true); }));
  load(true);
}

/* ------------------------------------------------------------------ DETALHES */
async function openDetail(kind, id) {
  const base = seen.get(kind + ":" + id) || { kind, id, name: "", poster: "", background: "" };
  const el = sheet(`<div class="backdrop">${base.background ? `<img src="${esc(base.background)}" alt="">` : ""}</div>
    <div class="detail pad" id="detailBody"><div class="spinner"></div></div>`);
  const body = $("#detailBody", el);
  try {
    if (kind === "ia") await renderIADetail(el, body, base);
    else await renderCineDetail(el, body, kind, id, base);
  } catch (e) {
    body.innerHTML = `<div class="empty"><strong>Não deu para abrir este título.</strong>Verifique a internet e tente de novo.</div>`;
  }
}

function listBtnHTML(kind, id) {
  const on = Lib.has(kind, id);
  return `<button class="btn" data-list>${on ? ICON.check + " Na lista" : ICON.plus + " Minha Lista"}</button>`;
}
function wireListBtn(root, item) {
  const b = $("[data-list]", root); if (!b) return;
  b.onclick = () => { const on = Lib.toggle(item); b.innerHTML = on ? ICON.check + " Na lista" : ICON.plus + " Minha Lista"; };
}
function wireShare(root, title) {
  const b = $("[data-share]", root); if (!b) return;
  if (!navigator.share) { const l = $("[data-list]", root); if (l) l.style.gridColumn = "1 / -1"; b.remove(); return; }
  b.onclick = () => navigator.share({ title, text: `${title} no Sinexflix`, url: location.href.split("#")[0] }).catch(() => {});
}

async function renderCineDetail(el, body, kind, id, base) {
  const meta = await Cine.meta(kind, id);
  if (!meta) throw new Error("sem meta");
  const it = Cine.toItem(meta, kind);
  if (isKids() && !it.genres.some((g) => KIDS_GENRES.includes(g))) {
    body.innerHTML = '<div class="empty"><strong>Indisponível no modo infantil.</strong></div>'; return;
  }
  if (!base.background && it.background) $(".backdrop", el).innerHTML = `<img src="${esc(it.background)}" alt="">`;
  const trailers = Cine.trailers(meta);
  const runtime = (String(meta.runtime || "").match(/\d+/) || [])[0];
  const oldMovie = kind === "movie" && parseInt(it.year) && parseInt(it.year) <= 1980;
  body.innerHTML = `
    <div class="detail-head">
      <div class="poster">${it.poster ? `<img src="${esc(it.poster)}" alt="">` : ""}</div>
      <div><h1 class="detail-title">${esc(it.name)}</h1>
        <div class="meta-line">${it.rating ? `<span class="star">★ ${it.rating.toFixed(1)}</span>` : ""}<span>${esc(it.year)}</span>${runtime ? `<span>${runtime} min</span>` : ""}<span>${kind === "series" ? "Série" : "Filme"}</span></div>
      </div>
    </div>
    <div class="actions">
      ${trailers.length ? `<button class="btn primary" data-yt="${esc(trailers[0])}">${ICON.play} Assistir trailer</button>` : `<button class="btn primary" disabled>Sem trailer disponível</button>`}
      ${listBtnHTML(kind, id)}
      <button class="btn" data-share>${ICON.share} Compartilhar</button>
    </div>
    <div class="tags">${it.genres.map((g) => `<span class="tag">${esc(GENRE_PT[g] || g)}</span>`).join("")}</div>
    ${it.plot ? `<p class="plot">${esc(it.plot)}</p>` : ""}
    <div class="facts">
      ${meta.director && meta.director.length ? `<div><b>Direção:</b> ${esc([].concat(meta.director).join(", "))}</div>` : ""}
      ${meta.cast && meta.cast.length ? `<div><b>Elenco:</b> ${esc([].concat(meta.cast).slice(0, 6).join(", "))}</div>` : ""}
    </div>
    <section class="panel" id="whereToWatch"><h3>Onde assistir</h3><div class="spinner" style="margin:6px auto"></div></section>
    ${oldMovie ? `<section class="panel" id="freeCopy"><h3>Versão completa grátis</h3><div class="spinner" style="margin:6px auto"></div></section>` : ""}
    ${kind === "series" ? `<section class="panel" id="seasons"></section>` : ""}
  `;
  const yt = $("[data-yt]", body); if (yt) yt.onclick = () => openTrailer(yt.dataset.yt, it.name);
  wireListBtn(body, it); wireShare(body, it.name);
  renderProviders($("#whereToWatch", body), kind, id, it.name);
  if (oldMovie) findFreeCopy($("#freeCopy", body), it);
  if (kind === "series") renderSeasons($("#seasons", body), meta);
}

async function renderProviders(box, kind, id, name) {
  if (!TMDB.enabled()) {
    // Sem chave: só um link discreto, sem insistir.
    box.outerHTML = `<p class="note" style="color:var(--muted);font-size:13px;margin:0">Quer saber em qual serviço assistir este título? <button class="link" data-setup style="font-size:13px">Ativar “Onde assistir”</button></p>`;
    const b = document.querySelector("[data-setup]"); if (b) b.onclick = () => openSettings("tmdb");
    return;
  }
  try {
    const r = await TMDB.providers(kind, id);
    const groups = [["free", "Grátis"], ["ads", "Grátis com anúncios"], ["flatrate", "Assinatura"], ["rent", "Aluguel"], ["buy", "Compra"]]
      .filter(([k]) => r && r[k] && r[k].length);
    if (!groups.length) { box.innerHTML = `<h3>Onde assistir</h3><p class="note">Não está em nenhum serviço de streaming no Brasil agora.</p>`; return; }
    box.innerHTML = `<h3>Onde assistir</h3>${groups.map(([k, label]) => `
      <div class="prov-group"><div class="prov-label${k === "free" || k === "ads" ? " free" : ""}">${label}</div>
      <div class="provs">${r[k].sort((a, b) => a.display_priority - b.display_priority).map((p) => `
        <div class="prov">${p.logo_path ? `<img src="${API.tmdbImg}${esc(p.logo_path)}" alt="" loading="lazy">` : ""}<span>${esc(p.provider_name)}</span></div>`).join("")}</div></div>`).join("")}
      ${r.link ? `<a class="link" href="${esc(r.link)}" target="_blank" rel="noopener">Ver links para assistir ↗</a>` : ""}
      <p class="note">Dados de disponibilidade: JustWatch, via TMDB.</p>`;
  } catch (e) {
    box.innerHTML = `<h3>Onde assistir</h3><p class="note">${e.status === 401 ? "A chave do TMDB foi recusada. Confira nos ajustes." : "Não deu para consultar agora."}</p>`;
  }
}

async function findFreeCopy(box, it) {
  try {
    let { items } = await IA.search({ q: it.name, year: it.year.slice(0, 4), rows: 6 });
    if (!items.length) ({ items } = await IA.search({ q: it.name, rows: 6 }));
    if (!items.length) { box.remove(); return; }
    remember(items);
    box.innerHTML = `<h3>Versão completa grátis</h3><p class="note">Encontramos no acervo público. Toque para assistir.</p>
      <div class="rail" style="margin:0 -14px;padding:0 14px">${items.map((i) => cardHTML(i, { noBadge: true })).join("")}</div>`;
  } catch { box.remove(); }
}

function renderSeasons(box, meta) {
  const videos = (meta.videos || []).filter((v) => v.season);
  const seasons = [...new Set(videos.map((v) => v.season))].sort((a, b) => a - b);
  if (!seasons.length) { box.remove(); return; }
  const t = today();
  const draw = (s) => {
    const eps = videos.filter((v) => v.season === s).sort((a, b) => (a.episode || a.number) - (b.episode || b.number));
    $(".eps", box).innerHTML = eps.map((v) => {
      const rel = (v.released || v.firstAired || "").slice(0, 10);
      const soon = rel && rel > t;
      return `<div class="ep"><div class="thumb">${v.thumbnail ? `<img src="${esc(v.thumbnail)}" alt="" loading="lazy" onerror="this.remove()">` : ""}</div>
        <div><h4>${v.episode || v.number}. ${esc(v.name || v.title || "Episódio")}</h4>
        <div class="when${soon ? " soon" : ""}">${soon ? "Estreia " + ddmm(rel) : rel ? ddmm(rel) + "/" + rel.slice(0, 4) : ""}</div>
        ${v.overview || v.description ? `<p>${esc(v.overview || v.description)}</p>` : ""}</div></div>`;
    }).join("");
  };
  box.innerHTML = `<h3>Episódios</h3><div class="seasons">${seasons.map((s, n) => `<button class="chip${n === seasons.length - 1 ? " on" : ""}" data-s="${s}">Temporada ${s}</button>`).join("")}</div><div class="eps"></div>`;
  $$(".chip", box).forEach((c) => (c.onclick = () => { $$(".chip", box).forEach((x) => x.classList.toggle("on", x === c)); draw(+c.dataset.s); }));
  draw(seasons[seasons.length - 1]);
}

async function renderIADetail(el, body, base) {
  const info = await IA.files(base.id);
  const it = { ...base, name: info.title || base.name, year: info.year || base.year, plot: info.plot || base.plot, poster: IA.img(base.id), kind: "ia", genres: [] };
  body.innerHTML = `
    <div class="detail-head">
      <div class="poster"><img src="${esc(it.poster)}" alt=""></div>
      <div><h1 class="detail-title">${esc(it.name)}</h1>
        <div class="meta-line"><span>${esc(it.year)}</span><span style="color:var(--ok);font-weight:700">Filme completo grátis</span></div></div>
    </div>
    <div class="actions">
      ${info.files.length ? `<button class="btn primary hot" data-play>${ICON.play} Assistir agora</button>` : `<button class="btn primary" disabled>Sem vídeo para tocar</button>`}
      ${listBtnHTML("ia", it.id)}
      <button class="btn" data-share>${ICON.share} Compartilhar</button>
    </div>
    ${info.files.length > 1 ? `<div class="panel"><h3>Partes</h3><div class="tags">${info.files.map((f, n) => `<button class="chip" data-part="${n}">${esc(f.name)}</button>`).join("")}</div></div>` : ""}
    ${it.plot ? `<p class="plot">${esc(it.plot.slice(0, 1200))}</p>` : ""}
    <p class="note" style="color:var(--muted);font-size:12.5px">Do acervo público do Internet Archive (archive.org).</p>`;
  const play = (n) => { Lib.addWatched({ kind: "ia", id: it.id, name: it.name, year: it.year, poster: it.poster }); openPlayer({ title: it.name, src: info.files[n].url }); };
  const pb = $("[data-play]", body); if (pb) pb.onclick = () => play(0);
  $$("[data-part]", body).forEach((b) => (b.onclick = () => play(+b.dataset.part)));
  wireListBtn(body, it); wireShare(body, it.name);
}

/* ------------------------------------------------------------------ players */
async function playTrailerFor(kind, id) {
  try { const meta = await Cine.meta(kind, id); const t = Cine.trailers(meta); if (!t.length) return toast("Este título não tem trailer"); openTrailer(t[0], meta.name); }
  catch { toast("Não deu para abrir o trailer"); }
}
function openTrailer(ytId, title) {
  // Aberto como arquivo do computador, o YouTube não deixa tocar dentro do app.
  if (location.protocol === "file:") { window.open("https://www.youtube.com/watch?v=" + encodeURIComponent(ytId), "_blank"); return; }
  const el = document.createElement("div");
  el.className = "player";
  el.innerHTML = `<div class="player-bar"><button class="icon-btn" data-x aria-label="Fechar">${ICON.close}</button><div class="t">${esc(title || "Trailer")}</div></div>
    <iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(ytId)}?autoplay=1&playsinline=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen title="Trailer"></iframe>
    <div class="player-foot"><a class="link" href="https://www.youtube.com/watch?v=${encodeURIComponent(ytId)}" target="_blank" rel="noopener">Abrir no YouTube ↗</a></div>`;
  $("[data-x]", el).onclick = () => closeTop();
  pushLayer(el);
}

let hlsInstance = null;
function openPlayer({ title, src, sources, isLive = false, onSourceOk }) {
  const list = sources || [src];
  const el = document.createElement("div");
  el.className = "player";
  el.innerHTML = `<div class="player-bar"><button class="icon-btn" data-x aria-label="Fechar">${ICON.close}</button><div class="t">${esc(title)}</div></div>
    <video controls playsinline autoplay></video>
    <div class="player-msg" hidden><div></div></div>
    <div class="player-foot"><span data-src></span></div>`;
  const video = $("video", el), msg = $(".player-msg", el), foot = $("[data-src]", el);
  const say = (t) => { msg.hidden = !t; $("div", msg).textContent = t || ""; };
  const cleanup = () => { if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; } video.removeAttribute("src"); video.load(); };
  $("[data-x]", el).onclick = () => closeTop();
  pushLayer(el, cleanup);

  let idx = 0;
  const tryNext = () => {
    if (idx >= list.length) { say(isLive ? "Este canal está fora do ar agora. Tente outro." : "Não deu para tocar este vídeo agora."); return; }
    const url = list[idx++];
    foot.textContent = list.length > 1 ? `Fonte ${idx} de ${list.length}` : "";
    say(isLive ? "Conectando..." : "");
    if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
    const isHls = /\.m3u8(\?|$)/i.test(url) || isLive;
    let started = false;
    const ok = () => { if (!started) { started = true; say(""); onSourceOk && onSourceOk(url); } };
    video.onplaying = ok;
    video.onerror = () => { if (!started) tryNext(); };
    if (isHls && window.Hls && Hls.isSupported()) {
      hlsInstance = new Hls({ enableWorker: true, lowLatencyMode: true });
      hlsInstance.on(Hls.Events.ERROR, (_, d) => { if (d.fatal && !started) tryNext(); });
      hlsInstance.loadSource(url); hlsInstance.attachMedia(video);
      hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => say("Toque no play para começar.")));
    } else {
      video.src = url;
      video.play().catch(() => {});
    }
    setTimeout(() => { if (!started && isLive && el.isConnected) tryNext(); }, 15000);
  };
  tryNext();
}

/* ------------------------------------------------------------------ BUSCAR */
RENDER.buscar = (view) => {
  view.innerHTML = `<div class="pad" style="padding-top:6px">
      <h1 class="view-title">Buscar</h1>
      <label class="searchbox"><svg viewBox="0 0 24 24"><path d="M10.5 4a6.5 6.5 0 0 1 5.2 10.4l4.4 4.4-1.4 1.4-4.4-4.4A6.5 6.5 0 1 1 10.5 4Zm0 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z"/></svg>
      <input id="q" type="search" placeholder="Filmes, séries, clássicos..." autocomplete="off" enterkeyhint="search"></label>
    </div>
    <div class="chips" id="scope">${[["all", "Tudo"], ["movie", "Filmes"], ["series", "Séries"], ["ia", "Clássicos grátis"]].map(([k, t], n) => `<button class="chip${n ? "" : " on"}" data-scope="${k}">${t}</button>`).join("")}</div>
    <div class="pad" id="results"></div>`;
  view.onclick = delegate;
  const input = $("#q", view), results = $("#results", view);
  let scope = "all", timer, token = 0;
  const showIdle = () => {
    const hist = Lib.history();
    const genres = isKids() ? GENRES.filter(([g]) => KIDS_GENRES.includes(g)) : GENRES;
    results.innerHTML = `${hist.length ? `<div class="section-label">Buscas recentes</div><div class="tags">${hist.map((h) => `<button class="chip" data-h="${esc(h)}">${esc(h)}</button>`).join("")}</div>` : ""}
      <div class="section-label">Explorar por gênero</div>
      <div class="genre-grid">${genres.map(([g, pt]) => `<button class="genre-tile" data-genre="${g}">${pt}</button>`).join("")}</div>
      ${isKids() ? "" : `<div class="section-label">Acervo grátis</div><div class="genre-grid">${IA_COLLECTIONS.map(([c, t]) => `<button class="genre-tile" data-coll="${c}">${t}</button>`).join("")}</div>`}`;
    $$("[data-h]", results).forEach((b) => (b.onclick = () => { input.value = b.dataset.h; run(); }));
    $$("[data-genre]", results).forEach((b) => (b.onclick = () => openGenre(b.dataset.genre)));
    $$("[data-coll]", results).forEach((b) => (b.onclick = () => openCollection(b.dataset.coll)));
  };
  const run = async () => {
    const q = input.value.trim();
    if (q.length < 2) { showIdle(); return; }
    const my = ++token;
    results.innerHTML = '<div class="spinner"></div>';
    const jobs = [];
    if (scope === "all" || scope === "movie") jobs.push(Cine.catalog("movie", "top", { search: q }).then((r) => ["Filmes", r]).catch(() => ["Filmes", []]));
    if (scope === "all" || scope === "series") jobs.push(Cine.catalog("series", "top", { search: q }).then((r) => ["Séries", r]).catch(() => ["Séries", []]));
    if (scope === "all" || scope === "ia") jobs.push(IA.search({ q, rows: 24 }).then((r) => ["Clássicos completos grátis", r.items]).catch(() => ["Clássicos", []]));
    const out = await Promise.all(jobs);
    if (my !== token) return;
    out.forEach(([, items]) => remember(items));
    const html = out.filter(([, i]) => i.length).map(([t, items]) => `<div class="section-label">${t}</div><div class="grid">${items.slice(0, 30).map((i) => cardHTML(i)).join("")}</div>`).join("");
    results.innerHTML = html || `<div class="empty"><strong>Nada encontrado para “${esc(q)}”.</strong>Tente outro nome ou confira a ortografia.</div>`;
    if (html) Lib.addHistory(q);
  };
  input.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(run, 450); });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { clearTimeout(timer); run(); input.blur(); } });
  $$("#scope .chip", view).forEach((c) => (c.onclick = () => { scope = c.dataset.scope; $$("#scope .chip", view).forEach((x) => x.classList.toggle("on", x === c)); run(); }));
  showIdle();
};

async function openGenre(genre) {
  let type = "movie", skip = 0;
  const el = sheet(`<div class="pad" style="padding-top:calc(env(safe-area-inset-top,0px) + 70px)">
    <h2 class="view-title">${esc(GENRE_PT[genre] || genre)}</h2>
    <div class="chips" style="margin:0 calc(-1 * var(--gutter-l)) 8px" id="gType"><button class="chip on" data-t="movie">Filmes</button><button class="chip" data-t="series">Séries</button><button class="chip" data-c="imdbRating">Mais bem avaliados</button></div>
    <div class="grid" id="gGrid"></div><div id="gMore"></div></div>`, { back: true });
  let cid = "top";
  const load = async (reset) => {
    if (reset) { skip = 0; $("#gGrid", el).innerHTML = ""; }
    $("#gMore", el).innerHTML = '<div class="spinner"></div>';
    try {
      const items = await Cine.catalog(type, cid, { genre, skip }); remember(items); skip += items.length || 0;
      $("#gGrid", el).insertAdjacentHTML("beforeend", items.map((i) => cardHTML(i, { noBadge: true })).join(""));
      $("#gMore", el).innerHTML = items.length >= 20 ? '<button class="btn block" style="margin-top:16px">Carregar mais</button>' : "";
      const b = $("#gMore button", el); if (b) b.onclick = () => load();
    } catch { $("#gMore", el).innerHTML = '<div class="empty">Não deu para carregar agora.</div>'; }
  };
  $$("#gType .chip", el).forEach((c) => (c.onclick = () => {
    if (c.dataset.t) { type = c.dataset.t; $$("#gType [data-t]", el).forEach((x) => x.classList.toggle("on", x === c)); }
    else { cid = cid === "top" ? "imdbRating" : "top"; c.classList.toggle("on", cid === "imdbRating"); }
    load(true);
  }));
  load(true);
}

/* ------------------------------------------------------------------ AO VIVO */
RENDER.aovivo = async (view) => {
  view.innerHTML = `<div class="pad" style="padding-top:6px"><h1 class="view-title">TV ao vivo</h1>
    <p style="color:var(--muted);margin:-6px 0 12px">Canais abertos e públicos do Brasil.</p></div>
    <div id="liveBody"><div class="spinner"></div></div>`;
  view.onclick = delegate;
  try { await Live.load(); drawLive(view); }
  catch { $("#liveBody", view).innerHTML = '<div class="empty"><strong>Lista de canais indisponível agora.</strong><button class="btn" id="liveRetry">Tentar de novo</button></div>'; $("#liveRetry", view).onclick = () => RENDER.aovivo(view); }
};
let liveGroup = "all", liveHideOff = store.get("liveHideOff", true);
function drawLive(view) {
  const chans = Live.filtered();
  const counts = {};
  chans.forEach((c) => c.groups.forEach((g) => (counts[g] = (counts[g] || 0) + 1)));
  const groups = Object.keys(counts).sort((a, b) => (LIVE_GROUPS[a] || a).localeCompare(LIVE_GROUPS[b] || b));
  const checked = Object.keys(Live.status).length > 0;
  $("#liveBody", view).innerHTML = `
    <div class="pad"><div class="panel" style="margin-bottom:6px">
      <h3>Canais no ar <button class="btn" id="checkBtn" style="min-height:38px;padding:0 14px;font-size:13.5px">${checked ? "Testar de novo" : "Testar agora"}</button></h3>
      <p class="note">${checked ? "Bolinha verde: funcionando no último teste. Vermelha: fora do ar." : "Teste quais canais estão funcionando para esconder os fora do ar."}</p>
      <div class="progress" hidden><i></i></div>
      <label class="switch"><span>Esconder canais fora do ar</span><input type="checkbox" id="hideOff" ${liveHideOff ? "checked" : ""}></label>
    </div></div>
    <div class="chips" id="lgChips"><button class="chip${liveGroup === "all" ? " on" : ""}" data-g="all">Todos</button>${groups.map((g) => `<button class="chip${liveGroup === g ? " on" : ""}" data-g="${esc(g)}">${esc(LIVE_GROUPS[g] || g)} · ${counts[g]}</button>`).join("")}</div>
    <div class="pad"><div class="grid chans" id="chanGrid"></div></div>`;
  const drawGrid = () => {
    let list = chans.filter((c) => liveGroup === "all" || c.groups.includes(liveGroup));
    if (liveHideOff) list = list.filter((c) => Live.chanState(c) !== false);
    list.sort((a, b) => (Live.chanState(b) === true) - (Live.chanState(a) === true) || a.name.localeCompare(b.name));
    $("#chanGrid", view).innerHTML = list.map(chanCardHTML).join("") || '<div class="empty" style="grid-column:1/-1">Nenhum canal nesta categoria agora.</div>';
  };
  $$("#lgChips .chip", view).forEach((c) => (c.onclick = () => { liveGroup = c.dataset.g; $$("#lgChips .chip", view).forEach((x) => x.classList.toggle("on", x === c)); drawGrid(); }));
  $("#hideOff", view).onchange = (e) => { liveHideOff = e.target.checked; store.set("liveHideOff", liveHideOff); drawGrid(); };
  $("#checkBtn", view).onclick = async (e) => {
    const b = e.currentTarget; b.disabled = true; b.textContent = "Testando...";
    const bar = $(".progress", view); bar.hidden = false;
    const { ok, total } = await Live.checkAll((d, t) => ($(".progress i", view).style.width = Math.round((d / t) * 100) + "%"));
    toast(`${ok} de ${total} fontes no ar`);
    drawLive(view);
  };
  drawGrid();
}
function playChannel(id) {
  const c = (Live.channels || []).find((x) => x.id === id); if (!c) return;
  const srcs = Live.sources(c).sort((a, b) => ({ true: 0, null: 1, false: 2 }[Live.srcState(a)] - { true: 0, null: 1, false: 2 }[Live.srcState(b)]));
  Lib.addWatched({ kind: "live", id: c.id, name: Live.clean(c.name), poster: c.logo });
  openPlayer({ title: Live.clean(c.name), sources: srcs, isLive: true, onSourceOk: (u) => { Live.status[u] = [true, Date.now()]; store.set("liveStatus", Live.status); } });
}

/* ------------------------------------------------------------------ MINHA LISTA */
let listTab = "lista";
RENDER.lista = (view) => {
  view.innerHTML = `<div class="pad" style="padding-top:6px"><h1 class="view-title">Minha Lista</h1></div>
    <div class="chips" id="lTabs">${[["lista", "Salvos"], ["vistos", "Assistidos"], ["proximos", "Próximos episódios"]].map(([k, t]) => `<button class="chip${listTab === k ? " on" : ""}" data-l="${k}">${t}</button>`).join("")}</div>
    <div class="pad" id="lBody" style="margin-top:10px"></div>`;
  view.onclick = delegate;
  $$("#lTabs .chip", view).forEach((c) => (c.onclick = () => { listTab = c.dataset.l; RENDER.lista(view); }));
  const body = $("#lBody", view);
  if (listTab === "lista") {
    const items = Lib.list();
    remember(items);
    body.innerHTML = items.length ? `<div class="grid">${items.map((i) => cardHTML(i)).join("")}</div>`
      : `<div class="empty"><strong>Sua lista está vazia.</strong>Abra um filme ou série e toque em “Minha Lista” para salvar aqui.</div>`;
  } else if (listTab === "vistos") {
    const items = Lib.watched();
    body.innerHTML = items.length ? `<div class="grid">${items.map((i) => i.kind === "live" ? chanCardHTML({ id: i.id, name: i.name, logo: i.poster, url: "", alts: [] }) : cardHTML(i)).join("")}</div>`
      : `<div class="empty"><strong>Nada assistido ainda.</strong>Clássicos e canais que você assistir aparecem aqui.</div>`;
    remember(items.filter((i) => i.kind !== "live"));
    if (items.some((i) => i.kind === "live")) Live.load().catch(() => {});
  } else {
    renderUpcoming(body);
  }
};
async function renderUpcoming(body) {
  const shows = Lib.list().filter((i) => i.kind === "series");
  if (!shows.length) { body.innerHTML = `<div class="empty"><strong>Nenhuma série na sua lista.</strong>Salve séries na Minha Lista para ver os próximos episódios aqui.</div>`; return; }
  body.innerHTML = '<div class="spinner"></div>';
  const now = Date.now(), from = new Date(now - 7 * 864e5).toISOString().slice(0, 10), to = new Date(now + 30 * 864e5).toISOString().slice(0, 10), t = today();
  const eps = [];
  await Promise.all(shows.map(async (s) => {
    try { const m = await Cine.meta("series", s.id); (m.videos || []).forEach((v) => { const r = (v.released || "").slice(0, 10); if (v.season && r >= from && r <= to) eps.push({ r, s, m, v }); }); } catch { /* ignora série que falhou */ }
  }));
  eps.sort((a, b) => a.r.localeCompare(b.r));
  body.innerHTML = eps.length ? `<div class="eps">${eps.map(({ r, s, m, v }) => `
    <button class="ep" data-open="series" data-id="${esc(s.id)}" style="text-align:left">
      <div class="thumb">${v.thumbnail ? `<img src="${esc(v.thumbnail)}" alt="" loading="lazy" onerror="this.remove()">` : ""}</div>
      <div><div class="when${r >= t ? " soon" : ""}">${r === t ? "Hoje" : r > t ? "Estreia " + ddmm(r) : "Saiu " + ddmm(r)}</div>
      <h4>${esc(m.name)} · T${v.season} E${v.episode || v.number}</h4><p>${esc(v.name || "")}</p></div></button>`).join("")}</div>`
    : `<div class="empty"><strong>Nenhum episódio entre a última semana e o próximo mês.</strong></div>`;
}

/* ------------------------------------------------------------------ AJUSTES + modo infantil */
async function sha(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function askPin(title) {
  return new Promise((resolve) => {
    let pin = "";
    const el = sheet(`<div class="pad" style="padding-top:calc(env(safe-area-inset-top,0px) + 80px);text-align:center">
      <h2 class="view-title">${esc(title)}</h2><div class="pin-dots">${"<i></i>".repeat(4)}</div>
      <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "⌫"].map((k) => k === "" ? "<span></span>" : `<button data-k="${k}">${k}</button>`).join("")}</div></div>`);
    let done = false;
    const finish = async (v) => { if (done) return; done = true; await closeTop(); resolve(v); };
    $$("[data-k]", el).forEach((b) => (b.onclick = () => {
      const k = b.dataset.k;
      pin = k === "⌫" ? pin.slice(0, -1) : (pin + k).slice(0, 4);
      $$(".pin-dots i", el).forEach((d, i) => d.classList.toggle("on", i < pin.length));
      if (pin.length === 4) setTimeout(() => finish(pin), 120);
    }));
    $(".sheet-close", el).onclick = () => finish(null);
  });
}
async function kidsUnlock() {
  if (!isKids() || !state.kids.hash) return true;
  const pin = await askPin("Senha do modo infantil");
  if (pin && (await sha(state.kids.salt + pin)) === state.kids.hash) return true;
  if (pin) toast("Senha incorreta");
  return false;
}
async function setKids(on) {
  if (on) {
    const pin = await askPin("Crie uma senha de 4 números");
    if (!pin) return;
    const again = await askPin("Digite a senha de novo");
    if (again !== pin) { toast("As senhas não conferem"); return; }
    const salt = Math.random().toString(36).slice(2, 10);
    state.kids = { on: true, salt, hash: await sha(salt + pin) };
  } else {
    if (!(await kidsUnlock())) return;
    state.kids = { on: false };
  }
  store.set("kids", state.kids);
  toast(on ? "Modo infantil ligado" : "Modo infantil desligado");
  applyKids(); resetViews();
}
function applyKids() { $("#kidsBadge").hidden = !isKids(); }
async function resetViews() {
  await closeAll();
  $$(".view").forEach((v) => { delete v.dataset.ready; v.innerHTML = ""; });
  liveGroup = "all";
  showTab(state.tab);
}

async function openSettings(focus) {
  if (isKids() && !(await kidsUnlock())) return;
  const el = sheet(`<div class="pad form" style="padding-top:calc(env(safe-area-inset-top,0px) + 70px);padding-bottom:40px">
    <h2 class="view-title">Ajustes</h2>
    <section class="panel" id="tmdbPanel"><h3>Onde assistir</h3>
      <p class="note">Mostra em quais serviços cada filme e série está no Brasil (Netflix, Globoplay, Pluto TV e outros). Precisa de uma chave grátis do TMDB.</p>
      <ol class="steps">
        <li>Crie uma conta grátis em <a class="link" href="https://www.themoviedb.org/signup" target="_blank" rel="noopener">themoviedb.org</a></li>
        <li>Abra <a class="link" href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener">Configurações → API</a> e peça uma chave (uso pessoal)</li>
        <li>Copie a “Chave da API” e cole aqui embaixo</li>
      </ol>
      <div class="field"><label for="tmdbKey">Chave da API do TMDB</label><input id="tmdbKey" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Cole sua chave aqui" value="${esc(state.tmdbKey)}"></div>
      <div class="field"><label for="region">País</label><select id="region">${[["BR", "Brasil"], ["PT", "Portugal"], ["US", "Estados Unidos"]].map(([c, n]) => `<option value="${c}"${state.region === c ? " selected" : ""}>${n}</option>`).join("")}</select></div>
      <button class="btn hot" id="saveKey">Salvar e testar</button>
    </section>
    <section class="panel"><h3>Modo infantil</h3>
      <p class="note">Mostra só animação, família, desenhos clássicos e TV infantil. Para sair, precisa da senha.</p>
      <button class="btn" id="kidsBtn">${isKids() ? "Desligar modo infantil" : "Ligar modo infantil"}</button>
    </section>
    <section class="panel"><h3>Instalar no celular</h3>
      <p class="note">No Chrome: toque nos três pontinhos ⋮ e depois em “Adicionar à tela inicial” ou “Instalar app”. No iPhone (Safari): toque em Compartilhar e “Adicionar à Tela de Início”.</p>
      <button class="btn" id="installBtn" hidden>Instalar o Sinexflix</button>
    </section>
    <section class="panel"><h3>Dados deste aparelho</h3>
      <p class="note">Sua lista, histórico e ajustes ficam guardados só neste celular.</p>
      <button class="btn" id="clearHist">Limpar buscas e assistidos</button>
    </section>
    <p class="note" style="color:var(--muted);font-size:12px;text-align:center">Sinexflix · Catálogo: Cinemeta · Onde assistir: JustWatch via TMDB · Clássicos: Internet Archive · TV: iptv-org</p>
  </div>`);
  $("#saveKey", el).onclick = async () => {
    state.tmdbKey = $("#tmdbKey", el).value.trim(); state.region = $("#region", el).value;
    store.set("tmdbKey", state.tmdbKey); store.set("region", state.region); memCache.clear();
    if (!state.tmdbKey) { toast("Chave removida"); return; }
    try { await TMDB.get("/configuration"); toast("Chave funcionando!"); } catch (e) { toast(e.status === 401 ? "Chave recusada. Confira se copiou inteira." : "Não deu para testar agora."); }
  };
  $("#kidsBtn", el).onclick = () => setKids(!isKids());
  $("#clearHist", el).onclick = () => { store.set("history", []); store.set("watched", []); toast("Histórico limpo"); };
  if (deferredInstall) { const b = $("#installBtn", el); b.hidden = false; b.onclick = async () => { deferredInstall.prompt(); deferredInstall = null; b.hidden = true; }; }
  if (focus === "tmdb") setTimeout(() => $("#tmdbKey", el).focus(), 300);
}

/* ------------------------------------------------------------------ início do app */
let deferredInstall = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredInstall = e; });

function boot() {
  $$(".tabbar button").forEach((b) => (b.onclick = async () => { await closeAll(); showTab(b.dataset.tab); }));
  $("#brandBtn").onclick = () => showTab("inicio");
  $("#settingsBtn").onclick = () => openSettings();
  applyKids();
  showTab(location.hash.slice(1) || "inicio");
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
