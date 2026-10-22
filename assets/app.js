/* Comportement commun à toutes les pages. Script classique (pas de module, pas de fetch) pour rester compatible avec file://.
   Lit window.COURS (assets/data.js). Chaque fonctionnalité s'active seulement si ses éléments existent dans la page. */
(function () {
  "use strict";
  var D = window.COURS;
  if (!D) return;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  /* En file://, certains navigateurs (Firefox) isolent localStorage par fichier : la progression d'une page disparaît sur la suivante.
     On double donc chaque écriture dans window.name, qui survit à la navigation dans le même onglet. */
  var mirror = {};
  try { var parsed = JSON.parse(window.name); if (parsed && parsed.cours) mirror = parsed.cours; } catch (e) {}
  var store = {
    get: function (k) {
      var v = null;
      try { v = window.localStorage.getItem(k); } catch (e) {}
      return v != null ? v : (k in mirror ? mirror[k] : null);
    },
    set: function (k, v) {
      try { window.localStorage.setItem(k, v); } catch (e) {}
      mirror[k] = v;
      try { window.name = JSON.stringify({ cours: mirror }); } catch (e) {}
    }
  };
  Object.keys(mirror).forEach(function (k) { try { if (window.localStorage.getItem(k) == null) window.localStorage.setItem(k, mirror[k]); } catch (e) {} });
  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text != null) n.textContent = text;
    return n;
  }
  function norm(s) { return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }

  var pageId = document.body.getAttribute("data-page") || "index";
  var pages = D.pages;
  var curIdx = Math.max(0, pages.findIndex(function (p) { return p.id === pageId; }));
  var cur = pages[curIdx];
  var chapById = {};
  D.chapters.forEach(function (c) { chapById[c.id] = c; });
  var pageById = {};
  pages.forEach(function (p) { pageById[p.id] = p; });
  function realChapters(p) { return p.chapters.filter(function (id) { return !chapById[id].nochap; }); }
  var allChapterIds = [];
  pages.forEach(function (p) { allChapterIds = allChapterIds.concat(realChapters(p)); });
  function pageNumber(p) { return pages.indexOf(p); }

  /* ---------- progression (clés localStorage inchangées : done:cN) ---------- */
  var done = {};
  allChapterIds.forEach(function (id) { done[id] = store.get("done:" + id) === "1"; });

  /* ---------- sommaire ---------- */
  var LEVELS = [
    { n: 1, name: "Découverte", desc: "L'essentiel, sans prérequis." },
    { n: 2, name: "Intermédiaire", desc: "+ fonctionnement et configuration." },
    { n: 3, name: "Expert", desc: "+ mécanismes internes, code, compromis." }
  ];
  var toc = $("#toc");

  function buildToc() {
    if (!toc) return;
    toc.appendChild(el("p", { "class": "toc-title" }, "Ma progression"));
    var bar = el("div", { "class": "progress", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": "0", id: "pbar" });
    bar.appendChild(el("i"));
    toc.appendChild(bar);
    toc.appendChild(el("p", { "class": "progress-label", id: "plabel" }));

    var ctl = el("div", { "class": "lvl-ctl", role: "group", "aria-labelledby": "lvl-title" });
    ctl.appendChild(el("p", { "class": "toc-title", id: "lvl-title" }, "Je veux lire :"));
    var opts = el("div", { "class": "lvl-opts" });
    LEVELS.forEach(function (l) {
      var b = el("button", { type: "button", "class": "lvl-opt", "data-l": l.n, "aria-pressed": "false" });
      b.appendChild(el("b", {}, l.name));
      b.appendChild(el("span", {}, l.desc));
      b.addEventListener("click", function () { setLevel(l.n); });
      opts.appendChild(b);
    });
    ctl.appendChild(opts);
    toc.appendChild(ctl);

    var sw = el("div", { "class": "toc-search" });
    sw.appendChild(el("label", { "class": "sr-only", "for": "s-q" }, "Rechercher un chapitre ou un terme"));
    sw.appendChild(el("input", { id: "s-q", type: "search", placeholder: "Chercher un chapitre ou un terme…", autocomplete: "off" }));
    sw.appendChild(el("ul", { id: "s-res", hidden: "" }));
    toc.appendChild(sw);

    var toggle = el("button", { "class": "toc-toggle", id: "toc-toggle", type: "button", "aria-expanded": "false", "aria-controls": "toc-list" }, "Afficher le sommaire");
    toc.appendChild(toggle);

    var list = el("ol", { id: "toc-list" });
    var lastPart = null;
    pages.forEach(function (p) {
      if (p.part && p.part !== lastPart) {
        list.appendChild(el("li", { "class": "toc-part" }, D.parts[p.part]));
        lastPart = p.part;
      }
      var li = el("li");
      var a = el("a", { href: p.file, "class": "pg" + (p === cur ? " current" : "") });
      if (p === cur) a.setAttribute("aria-current", "page");
      a.appendChild(el("span", {}, (pageNumber(p) ? pageNumber(p) + ". " : "") + p.title));
      var cnt = el("span", { "class": "cnt", "data-cnt": p.id });
      a.appendChild(cnt);
      li.appendChild(a);
      if (p === cur && p.chapters.length) {
        var sub = el("ol", { "class": "sub" });
        p.chapters.forEach(function (id) {
          var c = chapById[id];
          var sli = el("li");
          var sa = el("a", { href: "#" + id, "data-target": id });
          sa.appendChild(el("span", { "class": "tick", "aria-hidden": "true" }, "✓"));
          sa.appendChild(el("span", {}, (c.num ? c.num + ". " : "") + c.title));
          sli.appendChild(sa);
          sub.appendChild(sli);
        });
        li.appendChild(sub);
      }
      list.appendChild(li);
    });
    toc.appendChild(list);

    var tb = el("button", { "class": "theme-btn side", id: "theme-btn", type: "button" });
    toc.appendChild(tb);

    toggle.addEventListener("click", function () {
      var open = toc.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open);
      toggle.textContent = open ? "Masquer le sommaire" : "Afficher le sommaire";
    });
    list.addEventListener("click", function (e) {
      if (e.target.closest("a[data-target]") && window.matchMedia("(max-width: 899px)").matches) {
        toc.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.textContent = "Afficher le sommaire";
      }
    });
  }

  function refreshProgress() {
    var n = allChapterIds.filter(function (id) { return done[id]; }).length;
    var pct = Math.round(100 * n / allChapterIds.length);
    var pbar = $("#pbar");
    if (pbar) { $("i", pbar).style.width = pct + "%"; pbar.setAttribute("aria-valuenow", pct); }
    var pl = $("#plabel");
    if (pl) pl.textContent = n + " / " + allChapterIds.length + " chapitres lus";
    pages.forEach(function (p) {
      var c = $("[data-cnt=\"" + p.id + "\"]");
      var ids = realChapters(p);
      if (c) c.textContent = ids.length ? ids.filter(function (id) { return done[id]; }).length + "/" + ids.length : "";
    });
    $$(".toc a[data-target]").forEach(function (a) { a.classList.toggle("done", !!done[a.dataset.target]); });
    $$("[data-done]").forEach(function (b) {
      var on = !!done[b.dataset.done];
      b.setAttribute("aria-pressed", on);
      b.textContent = on ? "✓ Lu" : "Marquer comme lu";
    });
    $$("[data-home-count]").forEach(function (s) {
      var ids = realChapters(pageById[s.dataset.homeCount]);
      s.textContent = ids.filter(function (id) { return done[id]; }).length + " / " + ids.length + " chapitres lus";
    });
  }

  function bindDone() {
    $$("[data-done]").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.dataset.done;
        done[id] = !done[id];
        store.set("done:" + id, done[id] ? "1" : "0");
        refreshProgress();
      });
    });
  }

  function trackActive() {
    if (!("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          $$(".toc a[data-target]").forEach(function (a) { a.classList.toggle("active", a.dataset.target === e.target.id); });
        }
      });
    }, { rootMargin: "-20% 0px -70% 0px" });
    $$("section.chap").forEach(function (s) { io.observe(s); });
  }

  /* ---------- niveau de lecture (clé « maxlvl » inchangée) ---------- */
  function setLevel(n) {
    document.body.setAttribute("data-maxlvl", n);
    $$(".lvl-opt").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.l === String(n)); });
    store.set("maxlvl", String(n));
  }

  /* ---------- thème ---------- */
  var themes = ["auto", "light", "dark"];
  var themeNames = { auto: "auto", light: "clair", dark: "sombre" };
  var ti = Math.max(0, themes.indexOf(store.get("theme") || "auto"));
  function applyTheme() {
    var t = themes[ti];
    if (t === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
    var b = $("#theme-btn");
    if (b) b.textContent = "Thème : " + themeNames[t];
  }

  /* ---------- en-tête de page : prérequis, durée, date de vérification ---------- */
  function buildPageMeta() {
    var box = $("#page-meta");
    if (!box || !cur) return;
    if (cur.prereq && cur.prereq.length) {
      var s = el("span");
      s.appendChild(el("b", {}, "Prérequis : "));
      cur.prereq.forEach(function (id, i) {
        var p = pageById[id];
        if (i) s.appendChild(document.createTextNode(", "));
        s.appendChild(el("a", { href: p.file }, "page " + pageNumber(p) + " (" + p.title + ")"));
      });
      box.appendChild(s);
    }
    if (cur.minutes) {
      var d = el("span");
      d.appendChild(el("b", {}, "Durée : "));
      d.appendChild(document.createTextNode("~" + cur.minutes.d + " min en Découverte, ~" + cur.minutes.e + " min en Expert"));
      box.appendChild(d);
    }
    if (cur.verified) {
      var v = el("span");
      v.appendChild(el("b", {}, "Vérifié le "));
      v.appendChild(document.createTextNode(D.verifiedOn));
      box.appendChild(v);
    }
  }

  /* ---------- pagination précédent / suivant ---------- */
  function buildPager() {
    var box = $("#pager");
    if (!box) return;
    var prev = pages[curIdx - 1], next = pages[curIdx + 1];
    if (prev) {
      var a = el("a", { href: prev.file, "class": "prev" });
      a.appendChild(el("small", {}, "← Page précédente"));
      a.appendChild(document.createTextNode(prev.title));
      box.appendChild(a);
    }
    if (next) {
      var b = el("a", { href: next.file, "class": "next" });
      b.appendChild(el("small", {}, "Page suivante →"));
      b.appendChild(document.createTextNode(next.title));
      box.appendChild(b);
    }
  }

  /* ---------- recherche : titres de chapitres + termes du glossaire ---------- */
  function bindSearch() {
    var input = $("#s-q"), res = $("#s-res");
    if (!input) return;
    input.addEventListener("input", function () {
      var q = norm(input.value).trim();
      res.innerHTML = "";
      if (!q) { res.hidden = true; return; }
      var hits = [];
      pages.forEach(function (p) {
        p.chapters.forEach(function (id) {
          var c = chapById[id];
          if (norm(c.title).indexOf(q) !== -1) hits.push({ href: p.file + "#" + id, label: (c.num ? c.num + ". " : "") + c.title, sub: p.title });
        });
      });
      D.glossary.forEach(function (g) {
        if (norm(g[0]).indexOf(q) !== -1) hits.push({ href: "8-ressources.html?q=" + encodeURIComponent(g[0]) + "#glossaire", label: g[0], sub: "Glossaire" });
      });
      hits.slice(0, 8).forEach(function (h) {
        var li = el("li"), a = el("a", { href: h.href });
        a.appendChild(document.createTextNode(h.label));
        a.appendChild(el("small", {}, h.sub));
        li.appendChild(a);
        res.appendChild(li);
      });
      if (!hits.length) res.appendChild(el("li", {}, "Aucun résultat."));
      res.hidden = false;
    });
    input.addEventListener("keydown", function (e) { if (e.key === "Escape") { input.value = ""; res.hidden = true; } });
  }

  /* ---------- accueil : parcours et carte des pages ---------- */
  function buildHome() {
    var paths = $("#home-paths"), map = $("#home-map");
    if (paths) {
      D.paths.forEach(function (pa) {
        var first = pageById[pa.pages[0]];
        var a = el("a", { "class": "home-card", href: first.file });
        a.appendChild(el("span", { "class": "tag" }, "Niveau conseillé : " + LEVELS[pa.level - 1].name));
        a.appendChild(el("h3", {}, pa.title));
        a.appendChild(el("p", {}, pa.text));
        a.appendChild(el("span", { "class": "stat" }, "Pages " + pa.pages.map(function (id) { return pageNumber(pageById[id]); }).join(", ")));
        a.addEventListener("click", function () { store.set("maxlvl", String(pa.level)); });
        paths.appendChild(a);
      });
    }
    if (map) {
      pages.forEach(function (p) {
        if (p.id === "index") return;
        var a = el("a", { "class": "home-card", href: p.file });
        a.appendChild(el("span", { "class": "tag" }, D.parts[p.part]));
        a.appendChild(el("h3", {}, pageNumber(p) + ". " + p.title));
        a.appendChild(el("p", {}, p.chapters.map(function (id) { return chapById[id].title; }).join(" · ")));
        if (realChapters(p).length) a.appendChild(el("span", { "class": "stat", "data-home-count": p.id }));
        map.appendChild(a);
      });
    }
  }

  /* ---------- infobulles de glossaire : <span class="term" data-term="Token" tabindex="0">token</span> ---------- */
  var termIndex = {};
  D.glossary.forEach(function (g) {
    var keys = [g[0]];
    var m = g[0].match(/^(.*?)\s*\((.*)\)\s*$/);
    if (m) keys.push(m[1], m[2]);
    (g[2] || []).forEach(function (k) { keys.push(k); });
    keys.forEach(function (k) { termIndex[norm(k)] = g; });
  });
  function bindTerms() {
    var tip = el("div", { id: "tip", role: "tooltip", hidden: "" });
    document.body.appendChild(tip);
    var on = null;
    function show(t) {
      var g = termIndex[norm(t.getAttribute("data-term") || t.textContent)];
      if (!g) return;
      tip.innerHTML = "";
      tip.appendChild(el("b", {}, g[0]));
      tip.appendChild(document.createTextNode(g[1]));
      tip.hidden = false;
      var r = t.getBoundingClientRect();
      var left = Math.min(Math.max(8, r.left + window.scrollX), window.scrollX + document.documentElement.clientWidth - tip.offsetWidth - 8);
      tip.style.left = left + "px";
      tip.style.top = (r.bottom + window.scrollY + 6) + "px";
      t.setAttribute("aria-describedby", "tip");
      on = t;
    }
    function hide() { tip.hidden = true; if (on) on.removeAttribute("aria-describedby"); on = null; }
    document.addEventListener("mouseover", function (e) { var t = e.target.closest && e.target.closest(".term"); if (t) show(t); });
    document.addEventListener("mouseout", function (e) { if (e.target.closest && e.target.closest(".term")) hide(); });
    document.addEventListener("focusin", function (e) { var t = e.target.closest && e.target.closest(".term"); if (t) show(t); });
    document.addEventListener("focusout", function () { hide(); });
    document.addEventListener("click", function (e) {
      var t = e.target.closest && e.target.closest(".term");
      if (t && on !== t) show(t); else hide();
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") hide(); });
  }

  function autoTerms() {
    var list = D.autoTerms || [];
    if (!list.length || !$("main .lvl")) return;
    var SKIP = /^(CODE|PRE|A|H1|H2|H3|H4|BUTTON|LABEL|TEXTAREA|LEGEND|SCRIPT|STYLE|SVG|SUMMARY|TH)$/;
    var SKIPCLS = ["term", "tag", "k", "demo", "diagram", "fname", "chap-num", "stat"];
    var used = {};
    var res = list.filter(function (p) { return termIndex[norm(p[1])]; }).map(function (p) {
      return { key: p[1], re: new RegExp("(^|[^\\p{L}\\p{N}_])(" + p[0] + ")(?![\\p{L}\\p{N}_])", "iu") };
    });
    function skipped(n, root) {
      for (var e = n.parentNode; e && e !== root; e = e.parentNode) {
        if (SKIP.test(e.nodeName)) return true;
        if (e.classList && SKIPCLS.some(function (c) { return e.classList.contains(c); })) return true;
      }
      return false;
    }
    $$("main .lvl").forEach(function (lvl) {
      var walker = document.createTreeWalker(lvl, NodeFilter.SHOW_TEXT, null);
      var nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(function (node) {
        if (skipped(node, lvl)) return;
        var cur = node;
        for (;;) {
          var best = null;
          res.forEach(function (r) {
            if (used[r.key]) return;
            var m = r.re.exec(cur.nodeValue);
            if (m && (!best || m.index < best.m.index)) best = { r: r, m: m };
          });
          if (!best) break;
          var word = cur.splitText(best.m.index + best.m[1].length);
          var after = word.splitText(best.m[2].length);
          var span = el("span", { "class": "term", "data-term": best.r.key, tabindex: "0" });
          word.parentNode.replaceChild(span, word);
          span.appendChild(word);
          used[best.r.key] = true;
          cur = after;
        }
      });
    });
  }

  /* ---------- quiz (final et mini-quiz par page) ---------- */
  function makeQuiz(root, items, uid) {
    root.innerHTML = "";
    var form = el("form", { novalidate: "" });
    form.addEventListener("submit", function (e) { e.preventDefault(); });
    items.forEach(function (it, i) {
      var d = el("div", { "class": "q", id: uid + "q" + i });
      var fs = el("fieldset");
      fs.appendChild(el("legend", {}, (i + 1) + ". " + it.q));
      it.o.forEach(function (opt, j) {
        var l = el("label");
        l.appendChild(el("input", { type: "radio", name: uid + "q" + i, value: j }));
        l.appendChild(el("span", {}, opt));
        fs.appendChild(l);
      });
      fs.appendChild(el("div", { "class": "fb" }));
      d.appendChild(fs);
      form.appendChild(d);
    });
    root.appendChild(form);
    var row = el("div", { "class": "row" });
    var check = el("button", { "class": "btn", type: "button" }, "Corriger");
    var reset = el("button", { "class": "btn ghost", type: "button" }, "Recommencer");
    row.appendChild(check); row.appendChild(reset);
    root.appendChild(row);
    var score = el("p", { id: uid + "score", "class": "score", "aria-live": "polite" });
    score.style.cssText = "font-family:var(--display);font-size:1.3rem;margin-top:14px";
    root.appendChild(score);
    check.addEventListener("click", function () {
      var ok = 0, answered = 0;
      items.forEach(function (it, i) {
        var box = $("#" + uid + "q" + i), sel = form.querySelector("input[name=\"" + uid + "q" + i + "\"]:checked"), fb = $(".fb", box);
        box.classList.remove("right", "wrong");
        if (!sel) { fb.textContent = "Pas de réponse. " + it.e; return; }
        answered++;
        if (+sel.value === it.a) { ok++; box.classList.add("right"); fb.textContent = "Bonne réponse. " + it.e; }
        else { box.classList.add("wrong"); fb.textContent = "Pas tout à fait. " + it.e; }
      });
      var msg = ok + " / " + items.length;
      if (answered < items.length) msg += " (" + (items.length - answered) + " sans réponse)";
      else if (ok === items.length) msg += " · Parfait, tu as les bases.";
      else if (ok / items.length >= 0.75) msg += " · Solide. Relis les chapitres des questions manquées.";
      else msg += " · Reprends les chapitres concernés, puis retente.";
      score.textContent = msg;
    });
    reset.addEventListener("click", function () { makeQuiz(root, items, uid); });
  }
  function buildQuizzes() {
    var fin = $("#quiz-root");
    if (fin) makeQuiz(fin, D.quiz, "fq");
    $$(".miniquiz").forEach(function (box) {
      var items = D.miniQuizzes[box.dataset.quiz] || [];
      if (!items.length) { box.hidden = true; return; }
      var body = el("div");
      box.appendChild(el("h3", {}, "Vérifie ce que tu as retenu"));
      box.appendChild(body);
      makeQuiz(body, items, "mq" + box.dataset.quiz.replace(/\W/g, "") );
    });
  }

  /* ---------- glossaire (page Ressources) ---------- */
  function buildGlossary() {
    var gl = $("#gl-list"), inp = $("#gl-q");
    if (!gl) return;
    function draw(q) {
      q = norm(q || "").trim();
      gl.innerHTML = "";
      var shown = D.glossary.filter(function (g) { return !q || norm(g[0] + " " + g[1]).indexOf(q) !== -1; });
      shown.forEach(function (g) {
        var d = el("div");
        d.appendChild(el("dt", {}, g[0]));
        d.appendChild(el("dd", {}, g[1]));
        gl.appendChild(d);
      });
      if (!shown.length) gl.appendChild(el("p", {}, "Aucun terme trouvé."));
    }
    inp.addEventListener("input", function () { draw(inp.value); });
    var m = /[?&]q=([^&#]*)/.exec(window.location.search);
    if (m) { try { inp.value = decodeURIComponent(m[1].replace(/\+/g, " ")); } catch (e) {} }
    draw(inp.value);
  }

  /* ---------- aide-mémoire (page Ressources) ---------- */
  function buildCheat() {
    var box = $("#cheat");
    if (!box) return;
    var C = D.cheat;
    function table(title, head, rows) {
      box.appendChild(el("h3", {}, title));
      var wrap = el("div", { "class": "scroll-x" });
      var t = el("table");
      var tr = el("tr");
      head.forEach(function (h) { tr.appendChild(el("th", {}, h)); });
      t.appendChild(el("thead")).appendChild(tr);
      var tb = el("tbody");
      rows.forEach(function (r) {
        var row = el("tr");
        row.appendChild(el("td")).appendChild(el("code", {}, r[0]));
        row.appendChild(el("td", {}, r[1]));
        var c = chapById[r[2]], p = c && pages.filter(function (x) { return x.chapters.indexOf(r[2]) !== -1; })[0];
        var td = el("td");
        if (c && p) td.appendChild(el("a", { href: p.file + "#" + r[2] }, "Chapitre " + c.num));
        row.appendChild(td);
        tb.appendChild(row);
      });
      t.appendChild(tb);
      wrap.appendChild(t);
      box.appendChild(wrap);
    }
    table("Commandes « / »", ["Commande", "Effet", "Détail"], C.commands);
    table("Raccourcis", ["Geste", "Effet", "Détail"], C.shortcuts);
    table("Où vit quoi ?", ["Fichier", "Rôle", "Détail"], C.files);
    box.appendChild(el("h3", {}, "Priorité des réglages (du plus fort au plus faible)"));
    var ol = el("ol", { "class": "clean" });
    C.precedence.forEach(function (t) { ol.appendChild(el("li", {}, t)); });
    box.appendChild(ol);
    table("Options de la ligne de commande", ["Option", "Effet", "Détail"], C.flags);
  }

  /* ---------- démos (actives seulement si présentes dans la page) ---------- */
  function demoReliability() {
    var relP = $("#rel-p"), relN = $("#rel-n");
    if (!relP) return;
    function draw() {
      var p = relP.value / 100, n = +relN.value, r = Math.pow(p, n) * 100;
      $("#rel-p-v").textContent = relP.value + " %";
      $("#rel-n-v").textContent = n;
      $("#rel-out").textContent = (r < 10 ? r.toFixed(1) : Math.round(r)) + " %";
      $("#rel-bar").style.width = r + "%";
    }
    relP.addEventListener("input", draw);
    relN.addEventListener("input", draw);
    draw();
  }

  function demoTokens() {
    var tokIn = $("#tok-in"), tokOut = $("#tok-out");
    if (!tokIn) return;
    function tokenize(text) {
      var out = [];
      var words = text.match(/\s*[A-Za-zÀ-ÿ'’]+|\s*\d+|\s*[^\sA-Za-zÀ-ÿ\d]|\s+/g) || [];
      words.forEach(function (w) {
        var lead = (w.match(/^\s*/) || [""])[0];
        var core = w.slice(lead.length);
        if (!core) { out.push(w); return; }
        if (/^\d+$/.test(core)) {
          for (var i = 0; i < core.length; i += 3) out.push((i === 0 ? lead : "") + core.slice(i, i + 3));
          return;
        }
        if (core.length <= 6) { out.push(w); return; }
        var size = core.length > 11 ? 4 : 5, first = true;
        for (var j = 0; j < core.length; j += size) {
          out.push((first ? lead : "") + core.slice(j, j + size));
          first = false;
        }
      });
      return out;
    }
    function render() {
      var toks = tokenize(tokIn.value);
      tokOut.innerHTML = "";
      toks.forEach(function (t) {
        var s = document.createElement("span");
        s.textContent = t.replace(/^ /, "·");
        tokOut.appendChild(s);
      });
      $("#tok-stat").textContent = tokIn.value.length + " caractères · environ " + toks.length + " tokens";
      $("#tok-bar").style.width = Math.min(100, toks.length / 2) + "%";
    }
    tokIn.addEventListener("input", render);
    render();
  }

  function stepper(prefix, script) {
    var list = $("#" + prefix + "-steps"), next = $("#" + prefix + "-next");
    if (!list) return;
    var pos = 0;
    function count() {
      $("#" + prefix + "-count").textContent = pos + " / " + script.length + " étapes";
      next.disabled = pos >= script.length;
    }
    next.addEventListener("click", function () {
      if (pos >= script.length) return;
      var s = script[pos++];
      var li = document.createElement("li");
      li.className = s[0];
      var k = document.createElement("span"); k.className = "k"; k.textContent = s[1];
      li.appendChild(k);
      li.appendChild(document.createTextNode(s[2]));
      list.appendChild(li);
      li.scrollIntoView({ block: "nearest", behavior: "smooth" });
      count();
    });
    $("#" + prefix + "-reset").addEventListener("click", function () { pos = 0; list.innerHTML = ""; count(); });
    count();
  }

  function demoSteppers() {
    stepper("loop", [
      ["think", "Réfléchir", "Il me faut une salle de 8 places mardi après-midi. Je dois d'abord voir lesquelles sont libres."],
      ["act", "Agir · outil chercher_salles", "date = mardi, créneau = 14 h–16 h, places_min = 8"],
      ["obs", "Observer", "Résultat : « Salle Rhône (10 places) » et « Salle Saône (8 places) » libres."],
      ["think", "Réfléchir", "La Rhône est plus grande que nécessaire. Je tente la Saône, plus adaptée."],
      ["act", "Agir · outil reserver_salle", "salle = Saône, créneau = 14 h–16 h"],
      ["obs", "Observer", "Erreur : « Salle Saône réservée à l'instant par un autre utilisateur. »"],
      ["think", "Réfléchir", "Échec. Pas de panique : l'autre option était la Rhône, je la réserve."],
      ["act", "Agir · outil reserver_salle", "salle = Rhône, créneau = 14 h–16 h"],
      ["obs", "Observer", "Succès : réservation confirmée, identifiant R-2841."],
      ["think", "Réfléchir", "Reste à prévenir l'équipe. Je rédige l'invitation avec le lieu et l'horaire."],
      ["act", "Agir · outil envoyer_invitation", "destinataires = équipe projet, lieu = Rhône, horaire = mardi 14 h"],
      ["obs", "Observer", "Invitation envoyée à 6 personnes."],
      ["final", "Fin · objectif atteint", "C'est fait : salle Rhône réservée mardi 14 h–16 h et équipe prévenue. La Saône était prise, j'ai donc choisi la Rhône."]
    ]);
    stepper("cc", [
      ["think", "Réfléchir", "Je dois d'abord comprendre ce que teste test_total."],
      ["act", "Recherche (grep)", "motif : test_total dans tests/"],
      ["obs", "Résultat", "tests/test_panier.py:12 : test_total"],
      ["act", "Outil Read", "tests/test_panier.py"],
      ["obs", "Résultat", "Le test attend un total de 108,00 pour 2 articles à 50,00 avec 10 % de remise et 20 % de TVA."],
      ["act", "Outil Bash (déjà autorisé : pytest)", "pytest tests/test_panier.py"],
      ["obs", "Résultat", "1 échec : 110,00 obtenu, 108,00 attendu."],
      ["act", "Recherche puis Read", "def total dans src/ → src/panier.py"],
      ["think", "Réfléchir", "La remise est appliquée après la TVA. Il faut l'appliquer avant : 100 × 0,9 × 1,2 = 108."],
      ["ask", "Demande d'approbation · Edit src/panier.py", "Claude propose la modification (affichée sous forme de diff). Tu choisis : accepter, refuser, ou toujours accepter les éditions."],
      ["obs", "Après ton accord", "Fichier modifié : la remise est calculée avant la TVA."],
      ["act", "Outil Bash", "pytest tests/test_panier.py"],
      ["obs", "Résultat", "1 passed."],
      ["final", "Fin · vérifié", "Corrigé dans src/panier.py : la remise s'applique avant la TVA. Le test test_total passe. Je n'ai modifié aucun autre fichier."]
    ]);
  }

  /* ---------- démarrage ---------- */
  buildToc();
  var savedLvl = parseInt(store.get("maxlvl"), 10);
  setLevel(savedLvl >= 1 && savedLvl <= 3 ? savedLvl : 3);
  var tb = $("#theme-btn");
  if (tb) tb.addEventListener("click", function () { ti = (ti + 1) % 3; store.set("theme", themes[ti]); applyTheme(); });
  applyTheme();
  bindDone();
  buildPageMeta();
  buildPager();
  buildHome();
  refreshProgress();
  trackActive();
  bindSearch();
  autoTerms();
  bindTerms();
  buildQuizzes();
  buildGlossary();
  buildCheat();
  demoReliability();
  demoTokens();
  demoSteppers();
})();
