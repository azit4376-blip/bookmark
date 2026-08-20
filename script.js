const API_URL = "https://script.google.com/macros/s/AKfycbwp_biaKSxfJMMcFcvP23s8fPHXUPwha9GbsXxX3QmBDqyVGBN4MBSDfu0zWiDMK9DK/exec";
const CACHE_KEY = "LINKDESK_DATA_CACHE_V1";
const LEGACY_CACHE_KEY = "DASHBOARD_DATA_CACHE";
const THEME_KEY = "LINKDESK_THEME";

function storageGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function storageSet(key, value) {
  try { localStorage.setItem(key, value); } catch { /* Private browsing or quota limits. */ }
}

function storageRemove(key) {
  try { localStorage.removeItem(key); } catch { /* Storage may be unavailable. */ }
}

const initialTheme = storageGet(THEME_KEY) || storageGet("DASHBOARD_THEME");
if (initialTheme === "dark") document.documentElement.dataset.theme = "dark";

document.addEventListener("DOMContentLoaded", () => {
  const elements = {
    themeToggle: document.querySelector("#theme-toggle"),
    searchForm: document.querySelector("#search-form"),
    searchInput: document.querySelector("#search-input"),
    searchEngine: document.querySelector("#search-engine"),
    categoryFilter: document.querySelector("#category-filter"),
    clearFilter: document.querySelector("#clear-filter"),
    retryLoad: document.querySelector("#retry-load"),
    grid: document.querySelector("#main-grid"),
    resultCount: document.querySelector("#result-count"),
    summaryLinks: document.querySelector("#summary-links"),
    summaryCategories: document.querySelector("#summary-categories"),
    syncStatus: document.querySelector("#sync-status"),
    lastSync: document.querySelector("#last-sync"),
    guideDialog: document.querySelector("#guide-dialog"),
    guideTitle: document.querySelector("#guide-title"),
    guideCopy: document.querySelector("#guide-copy"),
    toast: document.querySelector("#toast"),
  };

  const state = {
    categories: [],
    query: "",
    category: "all",
    lastSync: null,
    renderFrame: 0,
    layoutFrame: 0,
    toastTimer: 0,
  };

  const mobileQuery = window.matchMedia("(max-width: 640px)");

  function setTheme(theme) {
    const next = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    storageSet(THEME_KEY, next);
    elements.themeToggle.setAttribute("aria-label", next === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = next === "dark" ? "#151e2d" : "#ffffff";
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("is-visible");
    clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 2200);
  }

  function validHttpUrl(value) {
    try {
      const url = new URL(String(value).trim());
      return ["http:", "https:"].includes(url.protocol) ? url : null;
    } catch {
      return null;
    }
  }

  function canonicalUrl(url) {
    const normalized = new URL(url.href);
    normalized.hash = "";
    for (const key of [...normalized.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$)/i.test(key)) normalized.searchParams.delete(key);
    }
    normalized.searchParams.sort();
    normalized.hostname = normalized.hostname.toLowerCase().replace(/^www\./, "");
    normalized.pathname = normalized.pathname.replace(/\/+$/, "");
    return `${normalized.hostname}${normalized.pathname}${normalized.search}`.toLowerCase();
  }

  function normalizePayload(payload) {
    const source = Array.isArray(payload) ? payload : payload?.categories;
    if (!Array.isArray(source)) throw new Error("데이터 형식이 올바르지 않습니다.");

    const seen = new Set();
    const normalized = [];

    for (const category of source) {
      const title = String(category?.title ?? "").trim();
      if (!title || !Array.isArray(category?.links)) continue;

      const links = [];
      for (const link of category.links) {
        const name = String(link?.name ?? "").trim();
        const url = validHttpUrl(link?.url);
        if (!name || !url) continue;

        const key = canonicalUrl(url);
        if (seen.has(key)) continue;
        seen.add(key);
        links.push({ name: name.slice(0, 160), url: url.href });
      }

      if (links.length) normalized.push({ title: title.slice(0, 120), links });
    }

    if (!normalized.length) throw new Error("표시할 링크가 없습니다.");
    return normalized;
  }

  function readCache() {
    for (const key of [CACHE_KEY, LEGACY_CACHE_KEY]) {
      const raw = storageGet(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        const data = normalizePayload(Array.isArray(parsed) ? parsed : parsed.data);
        return { data, savedAt: Number(parsed.savedAt) || Date.now() };
      } catch {
        storageRemove(key);
      }
    }
    return null;
  }

  function writeCache(data, savedAt) {
    storageSet(CACHE_KEY, JSON.stringify({ version: 1, savedAt, data }));
    storageRemove(LEGACY_CACHE_KEY);
  }

  function numberText(value) {
    return new Intl.NumberFormat("ko-KR").format(value);
  }

  function formatSyncTime(timestamp) {
    if (!timestamp) return "—";
    return new Intl.DateTimeFormat("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(timestamp));
  }

  function cleanCategoryTitle(title) {
    return title.replace(/^[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\s]+/gu, "").trim() || title;
  }

  function searchableText(category, link) {
    const url = new URL(link.url);
    return `${category.title} ${link.name} ${url.hostname}`.toLocaleLowerCase("ko-KR");
  }

  function setSyncStatus(mode, label) {
    elements.syncStatus.dataset.state = mode;
    elements.syncStatus.textContent = label;
  }

  function updateSummary() {
    const total = state.categories.reduce((sum, category) => sum + category.links.length, 0);
    elements.summaryLinks.textContent = numberText(total);
    elements.summaryCategories.textContent = numberText(state.categories.length);
    elements.lastSync.textContent = formatSyncTime(state.lastSync);
    elements.lastSync.dateTime = state.lastSync ? new Date(state.lastSync).toISOString() : "";
  }

  function buildCategoryOptions() {
    const selected = state.category;
    const fragment = document.createDocumentFragment();
    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "전체 카테고리";
    fragment.append(allOption);

    for (const category of state.categories) {
      const option = document.createElement("option");
      option.value = category.title;
      option.textContent = `${cleanCategoryTitle(category.title)} (${category.links.length})`;
      fragment.append(option);
    }

    elements.categoryFilter.replaceChildren(fragment);
    const available = state.categories.some(category => category.title === selected);
    state.category = available ? selected : "all";
    elements.categoryFilter.value = state.category;
  }

  function svgElement(kind, className) {
    const namespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(namespace, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.classList.add(className);

    if (kind === "chevron") {
      const path = document.createElementNS(namespace, "path");
      path.setAttribute("d", "m7 10 5 5 5-5");
      svg.append(path);
    } else {
      const first = document.createElementNS(namespace, "path");
      first.setAttribute("d", "M14 5h5v5");
      const second = document.createElementNS(namespace, "path");
      second.setAttribute("d", "M10 14 19 5");
      const third = document.createElementNS(namespace, "path");
      third.setAttribute("d", "M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5");
      svg.append(first, second, third);
    }
    return svg;
  }

  function createBookmark(link) {
    const url = new URL(link.url);
    const item = document.createElement("li");
    const anchor = document.createElement("a");
    anchor.className = "bookmark-link";
    anchor.href = url.href;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.title = `${link.name} — ${url.hostname}`;

    const favicon = document.createElement("span");
    favicon.className = "favicon";
    favicon.setAttribute("aria-hidden", "true");
    favicon.textContent = link.name.slice(0, 1).toLocaleUpperCase("ko-KR");

    const image = document.createElement("img");
    image.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(url.hostname)}&sz=64`;
    image.alt = "";
    image.width = 17;
    image.height = 17;
    image.loading = "lazy";
    image.decoding = "async";
    image.referrerPolicy = "no-referrer";
    image.addEventListener("error", () => image.remove(), { once: true });
    favicon.append(image);

    const copy = document.createElement("span");
    copy.className = "bookmark-copy";
    const name = document.createElement("span");
    name.className = "bookmark-name";
    name.textContent = link.name;
    const domain = document.createElement("span");
    domain.className = "bookmark-domain";
    domain.textContent = url.hostname.replace(/^www\./, "");
    copy.append(name, domain);

    anchor.append(favicon, copy, svgElement("external", "external-mark"));
    item.append(anchor);
    return item;
  }

  function createCategoryCard(category, index, forceOpen) {
    const details = document.createElement("details");
    details.className = "category-card";
    details.open = forceOpen || !mobileQuery.matches || index === 0;

    const summary = document.createElement("summary");
    const categoryIndex = document.createElement("span");
    categoryIndex.className = "category-index";
    categoryIndex.textContent = String(index + 1).padStart(2, "0");
    const title = document.createElement("span");
    title.className = "category-title";
    title.textContent = cleanCategoryTitle(category.title);
    const count = document.createElement("span");
    count.className = "category-count";
    count.textContent = numberText(category.links.length);
    summary.append(categoryIndex, title, count, svgElement("chevron", "category-chevron"));

    const list = document.createElement("ul");
    list.className = "bookmark-list";
    for (const link of category.links) list.append(createBookmark(link));
    details.append(summary, list);
    return details;
  }

  function createMessageState(type, title, message) {
    const wrapper = document.createElement("div");
    wrapper.className = `${type}-state`;
    const strong = document.createElement("strong");
    strong.textContent = title;
    const copy = document.createElement("span");
    copy.textContent = message;
    wrapper.append(strong, copy);
    return wrapper;
  }

  function filteredCategories() {
    const query = state.query.trim().toLocaleLowerCase("ko-KR");
    return state.categories
      .filter(category => state.category === "all" || category.title === state.category)
      .map(category => ({
        title: category.title,
        links: query ? category.links.filter(link => searchableText(category, link).includes(query)) : category.links,
      }))
      .filter(category => category.links.length);
  }

  function layoutMasonry() {
    const cards = [...elements.grid.querySelectorAll(".category-card")];
    if (!cards.length) return;
    cards.forEach(card => { card.style.gridColumnStart = ""; });
    const styles = getComputedStyle(elements.grid);
    const columns = styles.gridTemplateColumns.trim().split(/\s+/).length;
    const rowHeight = Number.parseFloat(styles.gridAutoRows) || 1;
    const rowGap = Number.parseFloat(styles.rowGap) || 0;
    const unit = rowHeight + rowGap;
    const heights = cards.map(card => card.getBoundingClientRect().height);
    cards.forEach((card, index) => {
      card.style.gridColumnStart = String((index % columns) + 1);
      card.style.gridRowEnd = `span ${Math.ceil((heights[index] + rowGap) / unit)}`;
    });
  }

  function scheduleMasonry() {
    cancelAnimationFrame(state.layoutFrame);
    state.layoutFrame = requestAnimationFrame(layoutMasonry);
  }

  function renderDirectory() {
    cancelAnimationFrame(state.renderFrame);
    state.renderFrame = requestAnimationFrame(() => {
      const visible = filteredCategories();
      const visibleLinks = visible.reduce((sum, category) => sum + category.links.length, 0);
      const forceOpen = Boolean(state.query.trim()) || state.category !== "all";
      const fragment = document.createDocumentFragment();

      if (!visible.length) {
        fragment.append(createMessageState("empty", "검색 결과가 없습니다.", "검색어를 줄이거나 카테고리 필터를 초기화해 보세요."));
      } else {
        visible.forEach((category, index) => fragment.append(createCategoryCard(category, index, forceOpen)));
      }

      elements.grid.replaceChildren(fragment);
      elements.grid.setAttribute("aria-busy", "false");
      elements.resultCount.textContent = `카테고리 ${numberText(visible.length)}개 · 링크 ${numberText(visibleLinks)}개 표시`;
      layoutMasonry();
    });
  }

  function scheduleRender() {
    state.query = elements.searchInput.value;
    renderDirectory();
  }

  function applyData(data, savedAt) {
    state.categories = data;
    state.lastSync = savedAt;
    buildCategoryOptions();
    updateSummary();
    renderDirectory();
  }

  async function fetchFreshData() {
    elements.retryLoad.hidden = true;
    setSyncStatus("loading", state.categories.length ? "확인 중" : "불러오는 중");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(API_URL, {
        cache: "no-store",
        credentials: "omit",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = normalizePayload(await response.json());
      const savedAt = Date.now();
      writeCache(data, savedAt);
      applyData(data, savedAt);
      setSyncStatus("ready", "동기화 완료");
    } catch (error) {
      console.error("LinkDesk data sync failed", error);
      elements.retryLoad.hidden = false;
      if (state.categories.length) {
        setSyncStatus("error", "캐시 사용 중");
        showToast("최신 데이터 확인에 실패해 저장된 링크를 표시합니다.");
      } else {
        setSyncStatus("error", "연결 실패");
        elements.grid.replaceChildren(createMessageState("error", "데이터를 불러오지 못했습니다.", "네트워크 연결을 확인한 뒤 다시 불러오기를 눌러 주세요."));
        elements.grid.setAttribute("aria-busy", "false");
        elements.resultCount.textContent = "데이터 연결을 확인해 주세요.";
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  function openWebSearch() {
    const query = elements.searchInput.value.trim();
    if (!query) {
      elements.searchInput.focus();
      showToast("검색어를 입력해 주세요.");
      return;
    }
    const base = elements.searchEngine.value;
    const destination = validHttpUrl(`${base}${encodeURIComponent(query)}`);
    if (!destination) return;
    window.open(destination.href, "_blank", "noopener,noreferrer");
  }

  function showGuide(type) {
    elements.guideCopy.replaceChildren();
    if (type === "start") {
      elements.guideTitle.textContent = "시작페이지로 설정하기";
      const first = document.createElement("p");
      first.textContent = "Chrome 또는 Edge의 설정에서 ‘시작 시’ 메뉴를 열고, 특정 페이지 열기에 현재 주소를 등록하세요.";
      const second = document.createElement("p");
      second.textContent = "회사에서 관리하는 브라우저는 해당 옵션이 제한될 수 있습니다.";
      elements.guideCopy.append(first, second);
    } else {
      elements.guideTitle.textContent = "브라우저 즐겨찾기에 추가하기";
      const paragraph = document.createElement("p");
      paragraph.append("Windows에서는 ");
      const windowsKey = document.createElement("kbd");
      windowsKey.textContent = "Ctrl + D";
      paragraph.append(windowsKey, ", macOS에서는 ");
      const macKey = document.createElement("kbd");
      macKey.textContent = "⌘ + D";
      paragraph.append(macKey, "를 누르면 현재 페이지를 저장할 수 있습니다.");
      elements.guideCopy.append(paragraph);
    }
    elements.guideDialog.showModal();
  }

  elements.themeToggle.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    setTheme(next);
  });
  elements.searchForm.addEventListener("submit", event => {
    event.preventDefault();
    openWebSearch();
  });
  elements.searchInput.addEventListener("input", scheduleRender);
  elements.grid.addEventListener("toggle", scheduleMasonry, true);
  window.addEventListener("resize", scheduleMasonry, { passive: true });
  elements.categoryFilter.addEventListener("change", event => {
    state.category = event.target.value;
    renderDirectory();
  });
  elements.clearFilter.addEventListener("click", () => {
    state.query = "";
    state.category = "all";
    elements.searchInput.value = "";
    elements.categoryFilter.value = "all";
    renderDirectory();
    elements.searchInput.focus();
  });
  elements.retryLoad.addEventListener("click", fetchFreshData);
  document.querySelectorAll("[data-guide]").forEach(button => {
    button.addEventListener("click", () => showGuide(button.dataset.guide));
  });
  elements.guideDialog.addEventListener("click", event => {
    const box = elements.guideDialog.getBoundingClientRect();
    const outside = event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
    if (outside) elements.guideDialog.close();
  });
  document.addEventListener("keydown", event => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
    if (event.key === "/" && !typing) {
      event.preventDefault();
      elements.searchInput.focus();
    }
  });
  mobileQuery.addEventListener("change", () => {
    const cards = [...elements.grid.querySelectorAll(".category-card")];
    cards.forEach((card, index) => { card.open = !mobileQuery.matches || index === 0; });
    scheduleMasonry();
  });

  setTheme(document.documentElement.dataset.theme || "light");
  const cached = readCache();
  if (cached) {
    applyData(cached.data, cached.savedAt);
    setSyncStatus("loading", "캐시 확인 중");
  }
  fetchFreshData();
});
