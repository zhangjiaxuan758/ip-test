(function () {
  "use strict";

  var body = document.body;
  var TEXT = {
    supported: body.getAttribute("data-supported") || "支持",
    notSupported: body.getAttribute("data-not-supported") || "不支持",
    checking: body.getAttribute("data-checking") || "测试中",
    notAvailable: body.getAttribute("data-not-available") || "暂无数据"
  };

  var CONTINENT_ZH = {
    "Asia": "亚洲",
    "Europe": "欧洲",
    "Africa": "非洲",
    "North America": "北美洲",
    "South America": "南美洲",
    "Oceania": "大洋洲",
    "Antarctica": "南极洲"
  };

  var FALLBACK_COUNTRY = {
    CN: "中国", US: "美国", JP: "日本", GB: "英国", DE: "德国", FR: "法国",
    RU: "俄罗斯", HK: "中国香港", TW: "中国台湾", SG: "新加坡", KR: "韩国",
    CA: "加拿大", AU: "澳大利亚", IN: "印度", BR: "巴西", NL: "荷兰"
  };

  var ISO_CODES = ("AD,AE,AF,AG,AI,AL,AM,AO,AQ,AR,AS,AT,AU,AW,AX,AZ,BA,BB,BD,BE,BF,BG,BH,BI,BJ,BL,BM,BN,BO,BQ,BR,BS,BT,BV,BW,BY,BZ," +
    "CA,CC,CD,CF,CG,CH,CI,CK,CL,CM,CN,CO,CP,CR,CU,CV,CW,CX,CY,CZ,DE,DG,DJ,DK,DM,DO,DZ,EC,EE,EG,EH,ER,ES,ET,EU,FI,FJ,FK,FM,FO,FR," +
    "GA,GB,GD,GE,GF,GG,GH,GI,GL,GM,GN,GP,GQ,GR,GS,GT,GU,GW,GY,HK,HM,HN,HR,HT,HU,IC,ID,IE,IL,IM,IN,IO,IQ,IR,IS,IT,JE,JM,JO,JP," +
    "KE,KG,KH,KI,KM,KN,KP,KR,KW,KY,KZ,LA,LB,LC,LI,LK,LR,LS,LT,LU,LV,LY,MA,MC,MD,ME,MF,MG,MH,MK,ML,MM,MN,MO,MP,MQ,MR,MS,MT,MU," +
    "MV,MW,MX,MY,MZ,NA,NC,NE,NF,NG,NI,NL,NO,NP,NR,NU,NZ,OM,PA,PC,PE,PF,PG,PH,PK,PL,PM,PN,PR,PS,PT,PW,PY,QA,RE,RO,RS,RU,RW,SA," +
    "SB,SC,SD,SE,SG,SH,SI,SJ,SK,SL,SM,SN,SO,SR,SS,ST,SV,SX,SY,SZ,TC,TD,TF,TG,TH,TJ,TK,TL,TM,TN,TO,TR,TT,TV,TW,TZ,UA,UG,UM,UN," +
    "US,UY,UZ,VA,VC,VE,VG,VI,VN,VU,WF,WS,XK,XX,YE,YT,ZA,ZM,ZW").split(",");

  var countryByEnglish = {};
  try {
    if (typeof Intl !== "undefined" && Intl.DisplayNames) {
      var zhNames = new Intl.DisplayNames(["zh-CN"], { type: "region" });
      var enNames = new Intl.DisplayNames(["en"], { type: "region" });
      ISO_CODES.forEach(function (code) {
        try {
          var en = enNames.of(code);
          var zh = zhNames.of(code);
          if (en && zh) countryByEnglish[en.toLowerCase()] = zh;
        } catch (e) { /* 忽略无效代码 */ }
      });
    }
  } catch (e) { /* 老浏览器回退到 FALLBACK_COUNTRY */ }

  function countryName(code, fallback) {
    if (code) {
      var up = String(code).toUpperCase();
      if (FALLBACK_COUNTRY[up]) return FALLBACK_COUNTRY[up];
      try {
        if (typeof Intl !== "undefined" && Intl.DisplayNames) {
          var name = new Intl.DisplayNames(["zh-CN"], { type: "region" }).of(up);
          if (name) return name;
        }
      } catch (e) { /* 忽略 */ }
    }
    if (fallback) {
      return countryByEnglish[String(fallback).toLowerCase()] || fallback;
    }
    return "";
  }

  function continentName(value) {
    return CONTINENT_ZH[value] || value || "";
  }

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $$(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function setYear() {
    var el = document.getElementById("year");
    if (el) el.textContent = String(new Date().getFullYear());
  }

  document.addEventListener("click", function (e) {
    var more = e.target.closest ? e.target.closest("button.more-toggle") : null;
    if (more) {
      var card = more.closest(".card");
      if (!card) return;
      var expanded = card.classList.toggle("expanded");
      more.setAttribute("aria-expanded", expanded ? "true" : "false");
      more.textContent = expanded ? (more.getAttribute("data-less") || "收起") : (more.getAttribute("data-more") || "更多信息");
      return;
    }
    var accHead = e.target.closest ? e.target.closest(".acc-head") : null;
    if (accHead) {
      var item = accHead.closest(".acc-item");
      if (!item) return;
      var body = document.getElementById(accHead.getAttribute("aria-controls"));
      var accOpen = accHead.getAttribute("aria-expanded") === "true";
      accHead.setAttribute("aria-expanded", accOpen ? "false" : "true");
      if (body) body.hidden = accOpen;
    }
  });

  /* ---------- 主题 ---------- */
  var themeMenu = $(".theme-menu");
  if (themeMenu) {
    var themeToggle = $(".theme-toggle", themeMenu);
    var choices = $$("[data-theme-choice]", themeMenu);
    var STORE_KEY = "xiaoxuan-theme";

    function currentChoice() {
      var t = document.documentElement.getAttribute("data-theme");
      return t === "dark" || t === "light" ? t : "system";
    }

    function syncChecked() {
      var now = currentChoice();
      choices.forEach(function (btn) {
        btn.setAttribute("aria-checked", btn.getAttribute("data-theme-choice") === now ? "true" : "false");
      });
    }

    function openMenu(open) {
      themeMenu.classList.toggle("open", open);
      themeToggle.setAttribute("aria-expanded", open ? "true" : "false");
    }

    syncChecked();

    themeToggle.addEventListener("click", function (e) {
      e.stopPropagation();
      openMenu(!themeMenu.classList.contains("open"));
    });

    choices.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var choice = btn.getAttribute("data-theme-choice");
        if (choice === "system") {
          document.documentElement.removeAttribute("data-theme");
          try { localStorage.removeItem(STORE_KEY); } catch (e) { /* 忽略 */ }
        } else {
          document.documentElement.setAttribute("data-theme", choice);
          try { localStorage.setItem(STORE_KEY, choice); } catch (e) { /* 忽略 */ }
        }
        syncChecked();
        openMenu(false);
        var activeIcon = themeToggle.querySelector(choice === "dark" ? ".icon-moon" : choice === "light" ? ".icon-sun" : ".icon-system");
        if (activeIcon) activeIcon.parentNode.replaceChild(activeIcon.cloneNode(true), activeIcon);
        themeToggle.focus();
      });
    });

    document.addEventListener("click", function (e) {
      if (!themeMenu.contains(e.target)) openMenu(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && themeMenu.classList.contains("open")) {
        openMenu(false);
        themeToggle.focus();
      }
    });
  }

  /* ---------- 移动端菜单 / 工具下拉 ---------- */
  var siteNav = document.querySelector("nav.site");
  var navToggle = document.querySelector(".nav-toggle");
  if (siteNav && navToggle) {
    navToggle.addEventListener("click", function () {
      var open = siteNav.classList.toggle("nav-open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  var navDropdown = document.querySelector(".nav-dropdown");
  if (navDropdown) {
    var navDropBtn = navDropdown.querySelector(".nav-drop-btn");
    navDropBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = navDropdown.classList.toggle("open");
      navDropBtn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.addEventListener("click", function (e) {
      if (!navDropdown.contains(e.target) && navDropdown.classList.contains("open")) {
        navDropdown.classList.remove("open");
        navDropBtn.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ---------- 搜索路由，始终留在本站 ---------- */
  function looksLikeIp(value) {
    var v = value.trim();
    if (!v) return false;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v)) {
      return v.split(".").every(function (n) { return Number(n) <= 255; });
    }
    return v.indexOf(":") > -1 && /^[0-9A-Fa-f:.]+$/.test(v);
  }

  function routeFor(value) {
    var q = value.trim();
    if (!q) return null;
    if (looksLikeIp(q)) return "/geoip/?q=" + encodeURIComponent(q);
    return "/whois/?q=" + encodeURIComponent(q);
  }

  $$("form.search").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      var input = form.querySelector('input[name="q"]');
      var target = input ? routeFor(input.value) : null;
      if (!target) { e.preventDefault(); return; }
      e.preventDefault();
      window.location.href = target;
    });
  });

  /* ---------- 首页 IPv4 / IPv6 ---------- */
  function fetchJSON(url, timeout) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, timeout);
    return fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      referrerPolicy: "no-referrer"
    }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    }).then(function (data) {
      clearTimeout(timer);
      return data;
    }, function (err) {
      clearTimeout(timer);
      throw err;
    });
  }

  function probe(family) {
    var remote = family === 4
      ? "https://ipv4.ip.sb/addrinfo"
      : "https://ipv6.ip.sb/addrinfo";
    var firstTimeout = family === 4 ? 10000 : 3500;
    return fetchJSON(remote, firstTimeout).catch(function () {
      return fetchJSON("/api/addrinfo?family=" + family, family === 4 ? 12000 : 5000);
    }).catch(function () {
      return null;
    });
  }

  function setStatus(card, cls, text) {
    var el = $('[data-role="status"]', card);
    if (!el) return;
    el.className = "status " + cls;
    el.textContent = text;
  }

  function setVal(card, role, text, options) {
    options = options || {};
    var el = $('[data-role="' + role + '"]', card);
    if (!el) return null;
    var row = el.closest(".row");
    el.className = "val" + (options.strong ? " strong" : "") + (options.mono ? " mono" : "") + (options.dim ? " dim" : "");
    el.textContent = "";
    if (text === null || text === undefined || text === "") {
      el.classList.add("dim");
      el.textContent = TEXT.notAvailable;
      if (row) row.hidden = false;
      return el;
    }
    if (options.href) {
      var a = document.createElement("a");
      a.href = options.href;
      a.textContent = text;
      el.appendChild(a);
    } else {
      el.textContent = text;
    }
    if (row) row.hidden = false;
    return el;
  }

  function hideRow(card, role) {
    var el = $('[data-role="' + role + '"]', card);
    if (!el) return;
    var row = el.closest(".row");
    if (row) row.hidden = true;
  }

  function renderStack(card, data, family) {
    if (!data) {
      setStatus(card, "bad", "✗ " + TEXT.notSupported);
      var note = $(".row-noconn", card);
      if (note) {
        note.hidden = false;
        var span = $(".val", note);
        if (span) span.textContent = "当前网络不支持 IPv" + family + " 连接。";
      }
      $$(".row", card).forEach(function (row) {
        if (!row.classList.contains("row-noconn")) row.hidden = true;
      });
      var more = $(".more-toggle", card);
      if (more) more.hidden = true;
      card.classList.remove("expanded");
      return;
    }

    setStatus(card, "ok", "✓ " + TEXT.supported);
    var note = $(".row-noconn", card);
    if (note) note.hidden = true;

    var address = data.address || "";
    setVal(card, "address", address, {
      strong: true,
      mono: true,
      href: address ? "/whois/?q=" + encodeURIComponent(address) : null
    });

    var hostname = data.hostname || "";
    if (hostname) {
      setVal(card, "hostname", hostname, {
        mono: true,
        href: hostname.indexOf(".") > 0 ? "/whois/?q=" + encodeURIComponent(hostname) : null
      });
    } else {
      hideRow(card, "hostname");
    }

    var isp = data.isp || {};
    var ispName = isp.name || "";
    var org = isp.organization || data.organization || "";
    var asn = isp.ASN ? "AS" + isp.ASN : "";
    var aso = isp.ASO || "";
    var network = isp.network || "";

    setVal(card, "isp", ispName);
    setVal(card, "org", org);
    setVal(card, "asn", asn, { mono: true, href: asn ? "/whois/?q=" + encodeURIComponent(asn) : null });
    setVal(card, "aso", aso);
    setVal(card, "network", network, { mono: true, href: network ? "/whois/?q=" + encodeURIComponent(network) : null });
    setVal(card, "continent", continentName(data.continent));
    setVal(card, "registered", countryName(null, data.registered_country));

    var loc = data.location && typeof data.location === "object" ? data.location : {};
    setVal(card, "timezone", loc.time_zone || "", { mono: true });
    setVal(card, "coords", (loc.latitude != null && loc.longitude != null) ? (loc.latitude + ", " + loc.longitude) : "", { mono: true });

    var code = (data.country_code || "").toLowerCase();
    var countryText = countryName(code, data.country || "");
    var city = data.city || "";
    var locationText = [city, countryText].filter(Boolean).join(", ");

    var locationEl = $('[data-role="location"]', card);
    if (locationEl) {
      var row = locationEl.closest(".row");
      locationEl.className = "val";
      locationEl.textContent = "";
      if (locationText) {
        if (/^[a-z]{2}$/.test(code) && code !== "xx") {
          var img = document.createElement("img");
          img.className = "flag";
          img.src = "/assets/flags/" + code + ".svg";
          img.alt = "";
          img.width = 20;
          img.height = 15;
          img.loading = "lazy";
          img.decoding = "async";
          img.onerror = function () { this.remove(); };
          locationEl.appendChild(img);
        }
        locationEl.appendChild(document.createTextNode(locationText));
        if (row) row.hidden = false;
      } else {
        locationEl.className = "val dim";
        locationEl.textContent = TEXT.notAvailable;
        if (row) row.hidden = false;
      }
    }
  }

  var stackV4 = document.getElementById("stack-v4");
  var stackV6 = document.getElementById("stack-v6");

  if (stackV4 || stackV6) {
    if (stackV4) {
      setStatus(stackV4, "wait", TEXT.checking + "…");
      probe(4).then(function (data) { renderStack(stackV4, data, 4); });
    }
    if (stackV6) {
      setStatus(stackV6, "wait", TEXT.checking + "…");
      probe(6).then(function (data) { renderStack(stackV6, data, 6); });
    }
  }

  /* ---------- 通用结果渲染 ---------- */
  function makeLoadingCard(query) {
    var card = document.createElement("section");
    card.className = "card";
    card.innerHTML =
      '<div class="card-head"><h2 class="mono"></h2><span class="head-tools"><span class="status wait">查询中…</span></span></div>' +
      '<div class="loading-body">' +
      '<div class="loading-row"><span class="skeleton lbl-sk"></span><span class="skeleton val-sk"></span></div>' +
      '<div class="loading-row"><span class="skeleton lbl-sk"></span><span class="skeleton val-sk short"></span></div>' +
      '<div class="loading-row"><span class="skeleton lbl-sk"></span><span class="skeleton val-sk"></span></div>' +
      '</div>';
    card.querySelector("h2").textContent = query;
    return card;
  }

  function makeErrorCard(message) {
    var card = document.createElement("section");
    card.className = "card error-card";
    card.innerHTML = '<div class="card-head"><h2>查询失败</h2></div><p class="result-error card-empty"></p>';
    card.querySelector(".result-error").textContent = message || "暂时无法获取数据，请稍后重试。";
    return card;
  }

  function appendTextWithBreaks(el, text) {
    var parts = String(text).split("\n");
    parts.forEach(function (part, index) {
      if (index) el.appendChild(document.createElement("br"));
      el.appendChild(document.createTextNode(part));
    });
  }

  function escapeHtml(text) {
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function highlightWhois(text) {
    return String(text).split("\n").map(function (line) {
      if (/^\s*[%#>]/.test(line)) {
        return '<span class="tok-comment">' + escapeHtml(line) + "</span>";
      }
      var match = line.match(/^(\s*[\w .\/-]+:)(.*)$/);
      if (match) {
        return '<span class="tok-key">' + escapeHtml(match[1]) + "</span>" + escapeHtml(match[2]);
      }
      return escapeHtml(line);
    }).join("\n");
  }

  function makeRow(row, options) {
    options = options || {};
    var wrap = document.createElement("div");
    wrap.className = "row";
    var lbl = document.createElement("span");
    lbl.className = "lbl" + (options.labelClass ? " " + options.labelClass : "");
    lbl.textContent = row.label || "";
    var val = document.createElement("span");
    val.className = "val" + (row.strong ? " strong" : "") + (row.mono ? " mono" : "");
    if (row.flag) {
      var img = document.createElement("img");
      img.className = "flag";
      img.src = "/assets/flags/" + row.flag + ".svg";
      img.alt = "";
      img.width = 20;
      img.height = 15;
      img.loading = "lazy";
      img.decoding = "async";
      img.onerror = function () { this.remove(); };
      val.appendChild(img);
    }
    if (row.href) {
      var a = document.createElement("a");
      a.href = row.href;
      a.textContent = row.text || "";
      val.appendChild(a);
    } else {
      appendTextWithBreaks(val, row.text || "");
    }
    wrap.appendChild(lbl);
    wrap.appendChild(val);
    return wrap;
  }

  function renderDomain(container, data) {
    container.innerHTML = "";

    var summaryCard = document.createElement("section");
    summaryCard.className = "card";
    var summaryHead = document.createElement("div");
    summaryHead.className = "card-head";
    var summaryTitle = document.createElement("h2");
    summaryTitle.className = "mono";
    summaryTitle.textContent = data.query || "";
    var summaryTools = document.createElement("span");
    summaryTools.className = "head-tools";
    var whoisLink = document.createElement("a");
    whoisLink.href = "/whois/?q=" + encodeURIComponent(data.query || "");
    whoisLink.textContent = "Whois";
    summaryTools.appendChild(whoisLink);
    summaryHead.appendChild(summaryTitle);
    summaryHead.appendChild(summaryTools);
    summaryCard.appendChild(summaryHead);
    (data.summary || []).forEach(function (row) {
      summaryCard.appendChild(makeRow(row, { noCopy: true }));
    });
    container.appendChild(summaryCard);

    var listCard = document.createElement("section");
    listCard.className = "card";
    var listHead = document.createElement("div");
    listHead.className = "card-head";
    listHead.innerHTML = "<h2></h2>";
    listHead.querySelector("h2").textContent = "解析到的地址";
    listCard.appendChild(listHead);

    var addresses = data.addresses || [];
    if (!addresses.length) {
      var empty = document.createElement("div");
      empty.className = "card-empty";
      empty.textContent = "该域名当前没有解析到任何地址。";
      listCard.appendChild(empty);
      container.appendChild(listCard);
      return;
    }

    var accordion = document.createElement("div");
    accordion.className = "accordion";

    addresses.forEach(function (item, index) {
      var accItem = document.createElement("div");
      accItem.className = "acc-item";

      var btn = document.createElement("button");
      btn.className = "acc-head";
      btn.type = "button";
      btn.setAttribute("aria-controls", "acc-" + index);
      btn.setAttribute("aria-expanded", index === 0 ? "true" : "false");

      var ip = document.createElement("span");
      ip.className = "acc-ip mono";
      ip.textContent = item.ip || "";
      var fam = document.createElement("span");
      fam.className = "acc-fam";
      fam.textContent = item.family || "";
      var loc = document.createElement("span");
      loc.className = "acc-loc";
      loc.textContent = item.location || "";
      var chevron = document.createElement("span");
      chevron.className = "acc-chevron";
      chevron.setAttribute("aria-hidden", "true");
      chevron.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';

      btn.appendChild(ip);
      btn.appendChild(fam);
      btn.appendChild(loc);
      btn.appendChild(chevron);

      var body = document.createElement("div");
      body.className = "acc-body";
      body.id = "acc-" + index;
      if (index !== 0) body.hidden = true;

      (item.sections || []).forEach(function (section) {
        if (section.title) {
          var sub = document.createElement("div");
          sub.className = "row row-sub";
          var subLbl = document.createElement("span");
          subLbl.className = "lbl";
          subLbl.textContent = section.title;
          sub.appendChild(subLbl);
          body.appendChild(sub);
        }
        (section.rows || []).forEach(function (row) {
          body.appendChild(makeRow(row));
        });
      });

      var links = document.createElement("div");
      links.className = "row row-links";
      var geoLink = document.createElement("a");
      geoLink.href = "/geoip/?q=" + encodeURIComponent(item.ip || "");
      geoLink.textContent = "IP 信息";
      var whoisIp = document.createElement("a");
      whoisIp.href = "/whois/?q=" + encodeURIComponent(item.ip || "");
      whoisIp.textContent = "Whois";
      links.appendChild(geoLink);
      links.appendChild(whoisIp);
      body.appendChild(links);

      accItem.appendChild(btn);
      accItem.appendChild(body);
      accordion.appendChild(accItem);
    });

    listCard.appendChild(accordion);
    container.appendChild(listCard);
  }

  function loadDomain(query) {
    var container = document.getElementById("domain-result");
    if (!container) return;
    container.innerHTML = "";
    var examples = document.getElementById("domain-examples");
    if (query) {
      if (examples) examples.hidden = true;
      container.appendChild(makeLoadingCard(query));
      fetch("/api/domain?q=" + encodeURIComponent(query), { cache: "no-store" })
        .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
        .then(function (result) {
          if (!result.ok || !result.data.ok) {
            container.innerHTML = "";
            container.appendChild(makeErrorCard(result.data.error || "查询失败，请稍后重试。"));
            return;
          }
          renderDomain(container, result.data);
        })
        .catch(function () {
          container.innerHTML = "";
          container.appendChild(makeErrorCard("查询服务暂时不可用，请确认已通过启动脚本运行本站。"));
        });
    }
  }

  function loadAzEnv() {
    var box = document.getElementById("azenv-rows");
    if (!box) return;
    fetch("/api/azenv?uri=" + encodeURIComponent(window.location.pathname + window.location.search), { cache: "no-store" })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        box.innerHTML = "";
        if (!data.ok || !data.rows) {
          var err = document.createElement("div");
          err.className = "card-empty";
          err.textContent = data.error || "无法读取请求环境变量。";
          box.appendChild(err);
          return;
        }
        data.rows.forEach(function (item) {
          var rowEl = makeRow({ label: item.key, text: item.value, mono: true }, { labelClass: "mono azenv-key" });
          rowEl.setAttribute("data-key", item.key);
          box.appendChild(rowEl);
        });
        if (data.rows.some(function (item) { return item.key === "REMOTE_ADDR"; })) {
          probe(4).then(function (info) {
            if (!info) return probe(6);
            return info;
          }).then(function (info) {
            if (!info || !info.address) return;
            var cell = box.querySelector('[data-key="REMOTE_ADDR"] .val');
            if (cell) {
              cell.classList.remove("dim");
              cell.textContent = info.address;
            }
          });
        }
      })
      .catch(function () {
        box.innerHTML = '<div class="card-empty">无法读取请求环境变量。</div>';
      });
  }

  function renderCards(container, data, mode) {
    container.innerHTML = "";
    if (!data.cards || !data.cards.length) {
      container.appendChild(makeErrorCard("没有找到可显示的数据。"));
      return;
    }
    data.cards.forEach(function (c) {
      var card = document.createElement("section");
      card.className = "card";
      var head = document.createElement("div");
      head.className = "card-head";
      var title = document.createElement("h2");
      title.className = "mono";
      title.textContent = c.title || data.query || "";
      var tools = document.createElement("span");
      tools.className = "head-tools";
      if (mode === "geoip") {
        var whoisLink = document.createElement("a");
        whoisLink.href = "/whois/?q=" + encodeURIComponent(data.query || "");
        whoisLink.textContent = "Whois";
        tools.appendChild(whoisLink);
      } else if (data.kind === "ip") {
        var geoLink = document.createElement("a");
        geoLink.href = "/geoip/?q=" + encodeURIComponent(data.query || "");
        geoLink.textContent = "IP 地理位置";
        tools.appendChild(geoLink);
      }
      if (c.status) {
        var st = document.createElement("span");
        st.className = "status " + (c.statusClass || "wait");
        st.textContent = c.status;
        tools.appendChild(st);
      }
      head.appendChild(title);
      head.appendChild(tools);
      card.appendChild(head);
      (c.rows || []).forEach(function (row) {
        card.appendChild(makeRow(row));
      });
      container.appendChild(card);
    });
  }

  function loadGeoIP(query) {
    var container = document.getElementById("geoip-result");
    if (!container) return;
    container.innerHTML = "";
    var examples = document.getElementById("geoip-examples");
    if (query) {
      if (examples) examples.hidden = true;
      container.appendChild(makeLoadingCard(query));
      fetch("/api/geoip?q=" + encodeURIComponent(query), { cache: "no-store" })
        .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
        .then(function (result) {
          if (!result.ok || !result.data.ok) {
            container.innerHTML = "";
            container.appendChild(makeErrorCard(result.data.error || "查询失败，请稍后重试。"));
            return;
          }
          renderCards(container, result.data, "geoip");
        })
        .catch(function () {
          container.innerHTML = "";
          container.appendChild(makeErrorCard("查询服务暂时不可用，请确认已通过启动脚本运行本站。"));
        });
    }
  }

  function loadWhois(query) {
    var container = document.getElementById("whois-result");
    if (!container) return;
    container.innerHTML = "";
    var examples = document.getElementById("whois-examples");
    if (query) {
      if (examples) examples.hidden = true;
      container.appendChild(makeLoadingCard(query));
      fetch("/api/whois?q=" + encodeURIComponent(query), { cache: "no-store" })
        .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
        .then(function (result) {
          if (!result.ok || !result.data.ok) {
            container.innerHTML = "";
            container.appendChild(makeErrorCard(result.data.error || "查询失败，请稍后重试。"));
            return;
          }
          renderCards(container, result.data, "whois");
          if (result.data.raw) {
            var rawCard = document.createElement("section");
            rawCard.className = "card";
            rawCard.innerHTML = '<div class="card-head card-head-center"><h2>WHOIS 原文</h2></div><pre class="whois-raw" data-lang="whois"></pre>';
            rawCard.querySelector("pre").innerHTML = highlightWhois(result.data.raw);
            container.appendChild(rawCard);
          }
        })
        .catch(function () {
          container.innerHTML = "";
          container.appendChild(makeErrorCard("查询服务暂时不可用，请确认已通过启动脚本运行本站。"));
        });
    }
  }

  var params = new URLSearchParams(window.location.search);
  var q = (params.get("q") || "").trim();

  if (document.getElementById("geoip-result")) {
    var geoInput = document.querySelector('.hero-form input[name="q"]');
    if (geoInput && q) geoInput.value = q;
    loadGeoIP(q);
  }

  if (document.getElementById("whois-result")) {
    var whoisInput = document.querySelector('.whois-form input[name="q"]');
    if (whoisInput && q) whoisInput.value = q;
    loadWhois(q);
  }

  if (document.getElementById("domain-result")) {
    var domainInput = document.querySelector('.hero-form input[name="q"]');
    if (domainInput && q) domainInput.value = q;
    loadDomain(q);
  }

  loadAzEnv();

  /* ---------- DNS 页连接信息 ---------- */
  var dnsAddress = document.querySelector('[data-role="dns-address"]');
  if (dnsAddress) {
    probe(4).then(function (data) {
      if (!data) return probe(6);
      return data;
    }).then(function (data) {
      if (!data) return;
      var addr = data.address || "";
      if (addr) {
        dnsAddress.href = "/geoip/?q=" + encodeURIComponent(addr);
        dnsAddress.textContent = addr;
      }
      var ispEl = document.querySelector('[data-role="dns-isp"]');
      if (ispEl) {
        var isp = data.isp || {};
        ispEl.textContent = "";
        ispEl.appendChild(document.createTextNode((isp.name || "—") + (isp.ASN ? " · " : "")));
        if (isp.ASN) {
          var asnLink = document.createElement("a");
          asnLink.className = "mono";
          asnLink.href = "/whois/?q=AS" + isp.ASN;
          asnLink.textContent = "AS" + isp.ASN;
          ispEl.appendChild(asnLink);
        }
      }
      var locEl = document.querySelector('[data-role="dns-location"]');
      if (locEl) {
        var code = (data.country_code || "").toLowerCase();
        var text = [data.city || "", countryName(code, data.country || "")].filter(Boolean).join(", ") || "—";
        locEl.textContent = "";
        if (/^[a-z]{2}$/.test(code) && code !== "xx") {
          var flagImg = document.createElement("img");
          flagImg.className = "flag";
          flagImg.src = "/assets/flags/" + code + ".svg";
          flagImg.alt = "";
          flagImg.width = 20;
          flagImg.height = 15;
          flagImg.loading = "lazy";
          flagImg.decoding = "async";
          flagImg.onerror = function () { this.remove(); };
          locEl.appendChild(flagImg);
        }
        locEl.appendChild(document.createTextNode(text));
      }
    });
  }

  /* ---------- 测速页地址与 ISP ---------- */
  var stAddress = document.querySelector('[data-role="st-address"]');
  if (stAddress) {
    probe(4).then(function (data) {
      if (!data) return probe(6);
      return data;
    }).then(function (data) {
      if (!data) return;
      var addr = data.address || "";
      if (addr) {
        stAddress.href = "/geoip/?q=" + encodeURIComponent(addr);
        stAddress.textContent = addr;
      }
      var ispEl = document.querySelector('[data-role="st-isp"]');
      if (ispEl) {
        var isp = data.isp || {};
        ispEl.textContent = "";
        ispEl.appendChild(document.createTextNode((isp.name || "—") + (isp.ASN ? " · " : "")));
        if (isp.ASN) {
          var a = document.createElement("a");
          a.className = "mono";
          a.href = "/whois/?q=AS" + isp.ASN;
          a.textContent = "AS" + isp.ASN;
          ispEl.appendChild(a);
        }
      }
    });
  }

  setYear();

  /* ---------- 强制锁定缩放（iOS Safari 会忽略 user-scalable=no） ---------- */
  (function () {
    function stop(e) {
      if (e.cancelable) e.preventDefault();
    }
    var lastTouchEnd = 0;
    document.addEventListener("gesturestart", stop, { passive: false });
    document.addEventListener("gesturechange", stop, { passive: false });
    document.addEventListener("gestureend", stop, { passive: false });
    document.addEventListener("touchmove", function (e) {
      if (e.touches && e.touches.length > 1) stop(e);
    }, { passive: false });
    document.addEventListener("touchend", function (e) {
      var now = Date.now();
      if (now - lastTouchEnd <= 300) stop(e);
      lastTouchEnd = now;
    }, { passive: false });
    document.addEventListener("wheel", function (e) {
      if (e.ctrlKey) stop(e);
    }, { passive: false });
    document.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && ["+", "-", "=", "0"].indexOf(e.key) !== -1) stop(e);
    });
  })();
})();
