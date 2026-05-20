// =============================================
//  스마트 대시보드 Pro v2 — script.js
// =============================================

const API_URL = "https://script.google.com/macros/s/AKfycbwp_biaKSxfJMMcFcvP23s8fPHXUPwha9GbsXxX3QmBDqyVGBN4MBSDfu0zWiDMK9DK/exec";
const STORAGE_KEY   = "DASHBOARD_DATA_CACHE";
const THEME_KEY     = "DASHBOARD_THEME";
const SEARCH_HIST   = "DASHBOARD_SEARCH_HIST";
const VISIT_KEY     = "DASHBOARD_VISIT_TODAY";

let isMobile = window.innerWidth <= 768;
let allData  = [];

// ── 카테고리별 색상 팔레트 ──────────────────────
const COLOR_PALETTES = [
    ['#5b5ef4', '#a855f7'],  // 인디고→보라
    ['#0ea5e9', '#6366f1'],  // 하늘→인디고
    ['#f43f5e', '#f97316'],  // 장미→주황
    ['#10b981', '#0ea5e9'],  // 에메랄드→하늘
    ['#f59e0b', '#ef4444'],  // 호박→빨강
    ['#8b5cf6', '#ec4899'],  // 바이올렛→핑크
    ['#06b6d4', '#10b981'],  // 시안→초록
    ['#6366f1', '#f43f5e'],  // 인디고→장미
    ['#f97316', '#eab308'],  // 주황→노랑
    ['#3b82f6', '#8b5cf6'],  // 파랑→바이올렛
];

// ── 테마 ────────────────────────────────────────
function initTheme() {
    const saved = localStorage.getItem(THEME_KEY) || 'light';
    applyTheme(saved);
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.getElementById('theme-icon').textContent = theme === 'dark' ? '☀️' : '🌙';
    localStorage.setItem(THEME_KEY, theme);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    showToast(next === 'dark' ? '🌙 다크 모드 켜짐' : '☀️ 라이트 모드 켜짐');
}

// ── 토스트 알림 ─────────────────────────────────
function showToast(msg, duration = 2200) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), duration);
}

// ── 모달 ─────────────────────────────────────────
function showGuide(type) {
    const modal = document.getElementById('guide-modal');
    modal.style.display = 'flex';
    if (type === 'start') {
        document.getElementById('modal-icon').textContent = '🏠';
        document.getElementById('modal-title').textContent = '시작페이지 설정';
        document.getElementById('modal-text').innerHTML =
            '브라우저 우측 상단 [점 3개] → [설정] → [시작 그룹]에서<br>현재 주소를 등록하세요!';
    } else {
        document.getElementById('modal-icon').textContent = '⭐';
        document.getElementById('modal-title').textContent = '즐겨찾기 단축키';
        document.getElementById('modal-text').innerHTML =
            'Windows: <strong>Ctrl + D</strong><br>Mac: <strong>Cmd + D</strong>';
    }
}

function closeModal() {
    document.getElementById('guide-modal').style.display = 'none';
}

document.getElementById('guide-modal').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
});

// ── 검색 기록 ────────────────────────────────────
function getSearchHistory() {
    try { return JSON.parse(localStorage.getItem(SEARCH_HIST) || '[]'); }
    catch { return []; }
}

function addSearchHistory(query) {
    let hist = getSearchHistory().filter(q => q !== query);
    hist.unshift(query);
    hist = hist.slice(0, 5);
    localStorage.setItem(SEARCH_HIST, JSON.stringify(hist));
}

function renderSearchHistory() {
    const hist = getSearchHistory();
    const container = document.getElementById('quick-tags');
    const empty     = document.getElementById('tag-empty');

    // 기존 태그 제거 (label, empty 제외)
    Array.from(container.querySelectorAll('.quick-tag')).forEach(el => el.remove());

    if (hist.length === 0) {
        if (empty) empty.style.display = '';
    } else {
        if (empty) empty.style.display = 'none';
        hist.forEach(q => {
            const tag = document.createElement('button');
            tag.className = 'quick-tag';
            tag.textContent = q;
            tag.onclick = () => {
                document.getElementById('search-input').value = q;
                doSearch();
            };
            container.appendChild(tag);
        });
    }
}

// ── 검색 ─────────────────────────────────────────
function updateEngineIcon() {
    const select = document.getElementById('search-engine');
    const domain = select.options[select.selectedIndex].getAttribute('data-domain');
    document.getElementById('current-engine-icon').src =
        `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

function doSearch() {
    const engine = document.getElementById('search-engine').value;
    const query  = document.getElementById('search-input').value.trim();
    if (!query) return;
    addSearchHistory(query);
    renderSearchHistory();
    window.open(engine + encodeURIComponent(query), '_blank');
    document.getElementById('search-input').value = '';
}

// ── 방문 카운터 ──────────────────────────────────
function trackVisit() {
    const today = new Date().toDateString();
    let data;
    try { data = JSON.parse(localStorage.getItem(VISIT_KEY) || '{}'); }
    catch { data = {}; }
    if (data.date !== today) {
        data = { date: today, count: 0 };
    }
    data.count = (data.count || 0) + 1;
    localStorage.setItem(VISIT_KEY, JSON.stringify(data));
    return data.count;
}

function updateStats(categories) {
    const totalLinks = categories.reduce((sum, cat) => sum + cat.links.length, 0);
    document.getElementById('stat-total').textContent = totalLinks;
    document.getElementById('stat-cats').textContent  = categories.length;
    document.getElementById('stat-today').textContent  = trackVisit();
    document.getElementById('stats-bar').style.display = 'flex';
}

// ── 카테고리 필터 ─────────────────────────────────
function buildFilterBar(categories) {
    const bar = document.getElementById('filter-bar');
    // 기존 칩 초기화 (전체 제외)
    Array.from(bar.querySelectorAll('.filter-chip:not([data-filter="all"])')).forEach(el => el.remove());

    categories.forEach(cat => {
        const chip = document.createElement('button');
        chip.className = 'filter-chip';
        chip.setAttribute('data-filter', cat.title);
        chip.onclick = function() { filterCategory(cat.title, this); };

        // 아이콘 추출 (이모지가 있으면 첫 글자, 없으면 기본)
        const icon = extractEmoji(cat.title) || '📁';
        const label = cat.title.replace(/^[\p{Emoji}\s]+/u, '').trim() || cat.title;
        chip.innerHTML = `<span>${icon}</span> ${label}`;
        bar.appendChild(chip);
    });
}

function filterCategory(filter, el) {
    // 칩 활성화
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');

    // 카드 보이기/숨기기
    document.querySelectorAll('.category-group').forEach(group => {
        if (filter === 'all') {
            group.classList.remove('hidden');
        } else {
            const title = group.dataset.catTitle || '';
            group.classList.toggle('hidden', title !== filter);
        }
    });

    setTimeout(() => scheduleRecalc(), 50);
}

function extractEmoji(str) {
    const match = str.match(/\p{Emoji}/u);
    return match ? match[0] : null;
}

// ── Masonry 레이아웃 ─────────────────────────────
// 그리드 스타일은 한 번만 읽어서 캐싱
let _gridRowHeight = 0;
let _gridRowGap    = 0;

function cacheGridStyle() {
    const grid = document.getElementById('main-grid');
    const cs   = window.getComputedStyle(grid);
    _gridRowHeight = parseInt(cs.getPropertyValue('grid-auto-rows'))  || 1;
    _gridRowGap    = parseInt(cs.getPropertyValue('row-gap'))         || 0;
}

function resizeAllGridItems() {
    const items = document.querySelectorAll('.category-group');
    if (!items.length) return;

    cacheGridStyle(); // 그리드 스타일은 1회만 읽기

    // 1단계: 모든 높이/마진을 한꺼번에 읽기 (read batch → reflow 1회)
    const heights = Array.from(items).map(item => ({
        el: item,
        h:  item.getBoundingClientRect().height,
        mb: parseInt(window.getComputedStyle(item).marginBottom) || 16,
    }));

    // 2단계: 모든 gridRowEnd를 한꺼번에 쓰기 (write batch → reflow 1회)
    const unit = _gridRowHeight + _gridRowGap || 1;
    heights.forEach(({ el, h, mb }) => {
        el.style.gridRowEnd = 'span ' + Math.ceil((h + mb) / unit);
    });
}

// ── 아코디언 (모바일) ─────────────────────────────
function toggleAccordion(header) {
    if (!isMobile) return;
    const list   = header.nextElementSibling;
    const toggle = header.querySelector('.accordion-toggle');
    const isOpen = list.classList.contains('active');

    document.querySelectorAll('.bookmark-list').forEach(l => l.classList.remove('active'));
    document.querySelectorAll('.accordion-toggle').forEach(t => t.classList.remove('active'));

    if (!isOpen) {
        list.classList.add('active');
        toggle.classList.add('active');
    }
    scheduleRecalc(360);
}

// ── 반응형 감지 ──────────────────────────────────
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        const wasMobile = isMobile;
        isMobile = window.innerWidth <= 768;

        if (wasMobile !== isMobile) {
            document.querySelectorAll('.bookmark-list').forEach((list, i) => {
                list.classList.toggle('active', !isMobile || i === 0);
            });
            document.querySelectorAll('.accordion-toggle').forEach((t, i) => {
                if (isMobile) t.classList.toggle('active', i === 0);
                else t.classList.remove('active');
            });
        }
        scheduleRecalc();
    }, 120);
}, { passive: true });

// ── 데이터 로드 ───────────────────────────────────
async function loadData() {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
        try {
            const data = JSON.parse(cached);
            renderDashboard(data);
        } catch {}
    }

    try {
        const res     = await fetch(API_URL);
        const newData = await res.json();
        if (JSON.stringify(newData) !== cached) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
            renderDashboard(newData);
        }
    } catch (err) {
        console.error('데이터 갱신 실패:', err);
        if (!cached) showToast('⚠️ 데이터를 불러오지 못했습니다');
    }
}

// ── 렌더링 ───────────────────────────────────────
let _rafId = 0;
function scheduleRecalc(delay = 0) {
    cancelAnimationFrame(_rafId);
    if (delay > 0) {
        setTimeout(() => { _rafId = requestAnimationFrame(resizeAllGridItems); }, delay);
    } else {
        _rafId = requestAnimationFrame(resizeAllGridItems);
    }
}

function renderDashboard(categories) {
    const grid = document.getElementById('main-grid');
    grid.innerHTML = '';
    allData = categories;

    buildFilterBar(categories);

    // DocumentFragment으로 DOM 조작 최소화 (reflow 1회)
    const fragment = document.createDocumentFragment();
    const imgList  = [];

    categories.forEach((cat, index) => {
        const palette = COLOR_PALETTES[index % COLOR_PALETTES.length];
        const group   = document.createElement('div');
        group.className       = 'category-group';
        group.dataset.catTitle = cat.title;
        group.style.animationDelay = `${index * 0.045}s`;

        const icon  = extractEmoji(cat.title) || '📁';
        const label = cat.title.replace(/^[\p{Emoji}\s]+/u, '').trim() || cat.title;

        const linksHtml = cat.links.map(link => {
            let iconHtml;
            if (link.icon) {
                iconHtml = `<div class="icon-box emoji">${link.icon}</div>`;
            } else {
                try {
                    const domain = new URL(link.url).hostname;
                    // loading="lazy" + width/height으로 CLS 방지
                    iconHtml = `<div class="icon-box"><img src="https://www.google.com/s2/favicons?domain=${domain}&sz=64" alt="${link.name}" width="17" height="17" loading="lazy"></div>`;
                } catch {
                    iconHtml = `<div class="icon-box emoji">🔗</div>`;
                }
            }
            return `<a href="${link.url}" class="bookmark-item" target="_blank" rel="noopener">
                        ${iconHtml}
                        <span class="bookmark-name">${link.name}</span>
                        <span class="bookmark-arrow">→</span>
                    </a>`;
        }).join('');

        const activeClass      = !isMobile ? 'active' : (index === 0 ? 'active' : '');
        const toggleActiveClass = isMobile && index === 0 ? 'active' : '';

        group.innerHTML = `
            <div class="category-header"
                 style="--cat-color-1:${palette[0]};--cat-color-2:${palette[1]};"
                 onclick="toggleAccordion(this)">
                <div class="category-title-wrap">
                    <span class="category-icon">${icon}</span>
                    <span class="category-title">${label}</span>
                    <span class="category-count">${cat.links.length}</span>
                </div>
                <span class="accordion-toggle ${toggleActiveClass}">▼</span>
            </div>
            <div class="bookmark-list ${activeClass}">${linksHtml}</div>`;

        fragment.appendChild(group);

        // img 참조 수집 (DOM 삽입 전)
        group.querySelectorAll('img').forEach(img => imgList.push(img));
    });

    grid.appendChild(fragment); // DOM에 한 번에 삽입

    // 이미지 로드 완료 후 Masonry 재계산
    let pending = imgList.filter(img => !img.complete).length;

    if (pending === 0) {
        scheduleRecalc();
    } else {
        imgList.forEach(img => {
            if (!img.complete) {
                const done = () => { if (--pending === 0) scheduleRecalc(); };
                img.addEventListener('load',  done, { once: true });
                img.addEventListener('error', done, { once: true });
            }
        });
        // 안전장치: 600ms 후 강제 재계산
        scheduleRecalc(600);
    }

    updateStats(categories);
}

// ── 시계 ────────────────────────────────────────
function updateClock() {
    const now = new Date();
    document.getElementById('cur-time').textContent = now.toLocaleTimeString('ko-KR', {
        hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    document.getElementById('cur-date').textContent = now.toLocaleDateString('ko-KR', {
        year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
    });

    const hour = now.getHours();
    const greeting = document.getElementById('greeting');
    const badge    = document.getElementById('greeting-badge-text');
    if (hour < 6) {
        greeting.textContent = '평온한 밤이에요 🌙';
        badge.textContent = '심야 대시보드 활성';
    } else if (hour < 12) {
        greeting.textContent = '좋은 아침이에요 ☀️';
        badge.textContent = '오늘도 좋은 하루';
    } else if (hour < 18) {
        greeting.textContent = '즐거운 오후예요 ☕';
        badge.textContent = '오후 대시보드 활성';
    } else {
        greeting.textContent = '편안한 저녁 되세요 🌃';
        badge.textContent = '저녁 대시보드 활성';
    }
}

// ── 필터바 스크롤 개선 (드래그 + 휠 → 가로) ────
(function initFilterBarScroll() {
    const bar   = document.getElementById('filter-bar');
    const thumb = document.getElementById('filter-scrollbar-thumb');
    const track = document.getElementById('filter-scrollbar');

    // ── 커스텀 스크롤바 업데이트 ──
    function updateScrollbar() {
        const scrollWidth  = bar.scrollWidth;
        const clientWidth  = bar.clientWidth;
        const scrollLeft   = bar.scrollLeft;

        if (scrollWidth <= clientWidth) {
            // 스크롤 불필요 → 스크롤바 숨김
            track.style.opacity = '0';
            return;
        }

        track.style.opacity = '1';
        const ratio      = clientWidth / scrollWidth;
        const thumbW     = Math.max(ratio * track.clientWidth, 32); // 최소 32px
        const maxScroll  = scrollWidth - clientWidth;
        const maxThumbX  = track.clientWidth - thumbW;
        const thumbX     = (scrollLeft / maxScroll) * maxThumbX;

        thumb.style.width     = thumbW + 'px';
        thumb.style.transform = `translateX(${thumbX}px)`;
    }

    // 스크롤 이벤트 → 썸 위치 동기화
    bar.addEventListener('scroll', updateScrollbar, { passive: true });

    // 칩 추가 후 재계산을 위해 ResizeObserver 사용
    const ro = new ResizeObserver(updateScrollbar);
    ro.observe(bar);

    // 트랙 클릭 → 해당 위치로 점프
    track.addEventListener('click', e => {
        const rect     = track.getBoundingClientRect();
        const clickX   = e.clientX - rect.left;
        const ratio    = clickX / track.clientWidth;
        const maxScroll = bar.scrollWidth - bar.clientWidth;
        bar.scrollTo({ left: ratio * maxScroll, behavior: 'smooth' });
    });

    // 썸 드래그
    let thumbDragging = false;
    let thumbStartX   = 0;
    let barStartScroll = 0;

    thumb.addEventListener('mousedown', e => {
        e.stopPropagation(); // 트랙 클릭 이벤트 방지
        thumbDragging  = true;
        thumbStartX    = e.clientX;
        barStartScroll = bar.scrollLeft;
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', e => {
        if (!thumbDragging) return;
        const dx        = e.clientX - thumbStartX;
        const trackW    = track.clientWidth;
        const thumbW    = thumb.offsetWidth;
        const maxThumbX = trackW - thumbW;
        const maxScroll = bar.scrollWidth - bar.clientWidth;
        bar.scrollLeft  = barStartScroll + (dx / maxThumbX) * maxScroll;
    }, { passive: true });

    document.addEventListener('mouseup', () => {
        if (thumbDragging) {
            thumbDragging = false;
            document.body.style.userSelect = '';
        }
    });

    // ── 필터바 드래그 ──
    let isDragging = false;
    let startX = 0;
    let scrollLeft = 0;

    bar.addEventListener('mousedown', e => {
        isDragging = false;
        startX = e.pageX - bar.offsetLeft;
        scrollLeft = bar.scrollLeft;
        bar.style.cursor = 'grabbing';
        bar.dataset.dragging = '0';
    }, { passive: true });

    bar.addEventListener('mousemove', e => {
        if (!bar.style.cursor.includes('grabbing')) return;
        const x    = e.pageX - bar.offsetLeft;
        const walk = x - startX;
        bar.dataset.dragging = String(Math.abs(walk));
        bar.scrollLeft = scrollLeft - walk;
    }, { passive: true });

    const stopDrag = () => { bar.style.cursor = ''; };
    bar.addEventListener('mouseup',    stopDrag, { passive: true });
    bar.addEventListener('mouseleave', stopDrag, { passive: true });

    bar.addEventListener('click', e => {
        if (parseFloat(bar.dataset.dragging || '0') > 5) {
            e.stopPropagation();
            e.preventDefault();
        }
    }, true);

    // 마우스 휠 → 가로 스크롤
    bar.addEventListener('wheel', e => {
        e.preventDefault();
        const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        bar.scrollLeft += delta;
    }, { passive: false });

    // 초기 렌더 후 계산
    setTimeout(updateScrollbar, 300);
})();

// ── 키보드 단축키 ──────────────────────────────
document.addEventListener('keydown', e => {
    // / 키 → 검색창 포커스
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        document.getElementById('search-input').focus();
    }
    // Escape → 검색창 블러 / 모달 닫기
    if (e.key === 'Escape') {
        document.getElementById('search-input').blur();
        closeModal();
    }
});

// ── 초기화 ───────────────────────────────────────
initTheme();
updateClock();
setInterval(updateClock, 1000);
renderSearchHistory();
loadData();
