    const API_URL = "https://script.google.com/macros/s/AKfycbwp_biaKSxfJMMcFcvP23s8fPHXUPwha9GbsXxX3QmBDqyVGBN4MBSDfu0zWiDMK9DK/exec";
    const STORAGE_KEY = "DASHBOARD_DATA_CACHE";
    let isMobile = window.innerWidth <= 768;

    // 모달 관련 함수
    function showGuide(type) {
        const modal = document.getElementById('guide-modal');
        if(type === 'start') {
            document.getElementById('modal-title').innerText = "🏠 시작페이지 설정";
            document.getElementById('modal-text').innerHTML = "브라우저 우측 상단 [점 3개] → [설정] → [시작 그룹]에서<br>현재 주소를 등록하세요!";
        } else {
            document.getElementById('modal-title').innerText = "⭐ 즐겨찾기 단축키";
            document.getElementById('modal-text').innerHTML = "Windows: <strong>Ctrl + D</strong><br>Mac: <strong>Cmd + D</strong>";
        }
        modal.style.display = 'flex';
    }

    function closeModal() {
        document.getElementById('guide-modal').style.display = 'none';
    }

    // 모달 외부 클릭 시 닫기
    document.getElementById('guide-modal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeModal();
        }
    });

    // Masonry 레이아웃 함수들
    function resizeGridItem(item) {
        const grid = document.getElementById("main-grid");
        const rowHeight = parseInt(window.getComputedStyle(grid).getPropertyValue('grid-auto-rows'));
        
        // row-gap이 0이므로 margin-bottom만 사용
        const contentHeight = item.getBoundingClientRect().height;
        const marginBottom = parseInt(window.getComputedStyle(item).getPropertyValue('margin-bottom')) || 20;
        
        // 총 높이 = 콘텐츠 높이 + 마진
        const totalHeight = contentHeight + marginBottom;
        
        // 필요한 행 수 계산 (rowHeight가 1px이므로 총 높이와 동일)
        const rowSpan = Math.ceil(totalHeight / rowHeight);
        
        item.style.gridRowEnd = "span " + rowSpan;
    }

    function resizeAllGridItems() {
        const allItems = document.getElementsByClassName("category-group");
        for (let i = 0; i < allItems.length; i++) {
            resizeGridItem(allItems[i]);
        }
    }

    // 아코디언 토글 (모바일)
    function toggleAccordion(header) {
        if (!isMobile) return;

        const bookmarkList = header.nextElementSibling;
        const toggle = header.querySelector('.accordion-toggle');
        
        // 현재 활성 상태 확인
        const isActive = bookmarkList.classList.contains('active');
        
        // 모든 아코디언 닫기
        document.querySelectorAll('.bookmark-list').forEach(list => {
            list.classList.remove('active');
        });
        document.querySelectorAll('.accordion-toggle').forEach(t => {
            t.classList.remove('active');
        });
        
        // 클릭한 아코디언만 열기 (이미 열려있었다면 닫힌 상태 유지)
        if (!isActive) {
            bookmarkList.classList.add('active');
            toggle.classList.add('active');
        }

        // 아코디언 애니메이션 후 레이아웃 재계산
        setTimeout(resizeAllGridItems, 350);
    }

    // 화면 크기 변경 감지
    let resizeTimeout;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(function() {
            const wasMobile = isMobile;
            isMobile = window.innerWidth <= 768;
            
            // 모바일 ↔ 데스크톱 전환 시
            if (wasMobile !== isMobile) {
                if (!isMobile) {
                    // 데스크톱: 모든 아코디언 펼치기
                    document.querySelectorAll('.bookmark-list').forEach(list => {
                        list.classList.add('active');
                    });
                } else {
                    // 모바일: 첫 번째만 펼치기
                    document.querySelectorAll('.bookmark-list').forEach((list, index) => {
                        if (index === 0) {
                            list.classList.add('active');
                        } else {
                            list.classList.remove('active');
                        }
                    });
                    document.querySelectorAll('.accordion-toggle').forEach((t, index) => {
                        if (index === 0) {
                            t.classList.add('active');
                        } else {
                            t.classList.remove('active');
                        }
                    });
                }
            }
            
            // Masonry 레이아웃 재계산
            resizeAllGridItems();
        }, 100);
    });

    // 데이터 로드 및 렌더링
    async function loadData() {
        const cachedData = localStorage.getItem(STORAGE_KEY);
        
        if (cachedData) {
            const data = JSON.parse(cachedData);
            renderDashboard(data);
        }

        try {
            const res = await fetch(API_URL);
            const newData = await res.json();
            
            if (JSON.stringify(newData) !== cachedData) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
                renderDashboard(newData);
            }
        } catch (err) {
            console.error("데이터 갱신 실패:", err);
        }
    }

    function renderDashboard(categories) {
        const grid = document.getElementById('main-grid');
        grid.innerHTML = '';
        
        categories.forEach((cat, index) => {
            const group = document.createElement('div');
            group.className = 'category-group';
            
            const linksHtml = cat.links.map(link => {
                let iconHtml;
                if (link.icon) {
                    iconHtml = `<div class="icon-box emoji">${link.icon}</div>`;
                } else {
                    try {
                        const domain = new URL(link.url).hostname;
                        iconHtml = `<div class="icon-box"><img src="https://www.google.com/s2/favicons?domain=${domain}&sz=64" alt="${link.name}"></div>`;
                    } catch(e) {
                        iconHtml = `<div class="icon-box emoji">🔗</div>`;
                    }
                }
                
                return `
                    <a href="${link.url}" class="bookmark-item" target="_blank">
                        ${iconHtml}
                        <span class="bookmark-name">${link.name}</span>
                        <span class="bookmark-arrow">→</span>
                    </a>
                `;
            }).join('');
            
            // 데스크톱에서는 모든 리스트 활성화, 모바일에서는 첫 번째만
            const activeClass = !isMobile ? 'active' : (index === 0 ? 'active' : '');
            const toggleActiveClass = !isMobile ? '' : (index === 0 ? 'active' : '');
            
            group.innerHTML = `
                <div class="category-header" onclick="toggleAccordion(this)">
                    <div class="category-title">
                        <span>${cat.title}</span>
                        <span class="category-count">${cat.links.length}</span>
                    </div>
                    <div class="accordion-toggle ${toggleActiveClass}">▼</div>
                </div>
                <div class="bookmark-list ${activeClass}">
                    ${linksHtml}
                </div>
            `;
            
            grid.appendChild(group);
        });

        // 이미지 로드 완료 후 레이아웃 재계산
        const images = grid.querySelectorAll('img');
        let loadedCount = 0;
        const totalImages = images.length;

        if (totalImages === 0) {
            // 이미지가 없으면 바로 계산
            setTimeout(resizeAllGridItems, 200);
        } else {
            // 각 이미지 로드 완료 시 재계산
            images.forEach(img => {
                if (img.complete) {
                    loadedCount++;
                } else {
                    img.addEventListener('load', function() {
                        loadedCount++;
                        if (loadedCount === totalImages) {
                            resizeAllGridItems();
                        }
                    });
                }
            });
            
            // 타임아웃으로도 재계산 (안전장치)
            setTimeout(resizeAllGridItems, 200);
            setTimeout(resizeAllGridItems, 500);
        }
    }

    // 검색 관련 함수
    function updateEngineIcon() {
        const select = document.getElementById('search-engine');
        const domain = select.options[select.selectedIndex].getAttribute('data-domain');
        document.getElementById('current-engine-icon').src = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    }

    function doSearch() {
        const engine = document.getElementById('search-engine').value;
        const query = document.getElementById('search-input').value;
        if (query.trim()) {
            window.open(engine + encodeURIComponent(query), '_blank');
        }
    }

    // 시계 업데이트
    function updateClock() {
        const now = new Date();
        document.getElementById('cur-time').innerText = now.toLocaleTimeString('ko-KR', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        });
        document.getElementById('cur-date').innerText = now.toLocaleDateString('ko-KR', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric', 
            weekday: 'short' 
        });
        
        const hour = now.getHours();
        const greeting = document.getElementById('greeting');
        if(hour < 6) greeting.innerText = "평온한 밤입니다 🌙";
        else if(hour < 12) greeting.innerText = "좋은 아침이에요 ☀️";
        else if(hour < 18) greeting.innerText = "즐거운 오후입니다 ☕";
        else greeting.innerText = "편안한 저녁 되세요 🌃";
    }

    // 초기화
    setInterval(updateClock, 1000);
    updateClock();
    loadData();
