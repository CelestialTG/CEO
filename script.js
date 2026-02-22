document.addEventListener('DOMContentLoaded', () => {
    // ИНИЦИАЛИЗАЦИЯ TELEGRAM WEB APP
    const tg = window.Telegram.WebApp;
    tg.expand(); // Разворачиваем на весь экран
    tg.ready();

    // Привязка цвета темы к телеграму (если у юзера светлая/темная тема)
    document.documentElement.style.setProperty('--tg-theme-bg', tg.themeParams.bg_color || '#0a0b10');
    if (tg.themeParams.button_color) {
        document.documentElement.style.setProperty('--accent', tg.themeParams.button_color);
    }

    // Свет за свайпом (пальцем)
    const glow = document.getElementById('glow');
    document.addEventListener('touchmove', (e) => {
        const touch = e.touches[0];
        glow.style.left = `${touch.clientX}px`; 
        glow.style.top = `${touch.clientY}px`;
    });

    // НАВИГАЦИЯ BOTTOM NAV
    const navBtns = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.view-section');
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tg.HapticFeedback.impactOccurred('light'); // Вибрация при клике!
            navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            sections.forEach(sec => {
                if(sec.id === btn.dataset.target) { sec.classList.remove('hidden'); sec.classList.add('active'); }
                else { sec.classList.add('hidden'); sec.classList.remove('active'); }
            });
        });
    });

    // ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
    let currentPage = 1, limit = 15, selectedMods = [];
    const searchBtn = document.getElementById('search-btn'), searchInput = document.getElementById('search-input');
    const versionSel = document.getElementById('version-select'), typeSel = document.getElementById('type-select');
    const resultsCont = document.getElementById('results'), projectModal = document.getElementById('project-modal');

    // Настройка Главной Кнопки ТГ (Main Button)
    tg.MainButton.text = "СКАЧАТЬ СБОРКУ (0)";
    tg.MainButton.onClick(() => {
        tg.HapticFeedback.notificationOccurred('success');
        downloadAllSelected();
    });

    searchBtn.addEventListener('click', () => { tg.HapticFeedback.impactOccurred('light'); currentPage = 1; fetchMods(); });
    document.getElementById('prev-btn').addEventListener('click', () => { if(currentPage>1){currentPage--; fetchMods();} });
    document.getElementById('next-btn').addEventListener('click', () => { currentPage++; fetchMods(); });
    document.getElementById('close-modal-btn').addEventListener('click', () => projectModal.classList.remove('active'));

    fetchMods();

    // ПОИСК МОДОВ
    async function fetchMods() {
        resultsCont.innerHTML = '<div class="status-message">Поиск в сети...</div>';
        document.getElementById('page-indicator').innerText = `Стр. ${currentPage}`;
        document.getElementById('prev-btn').disabled = currentPage === 1;

        try {
            const facets = [[`versions:${versionSel.value}`], [`project_type:${typeSel.value}`]];
            const url = new URL('https://api.modrinth.com/v2/search');
            url.searchParams.append('query', searchInput.value); 
            url.searchParams.append('facets', JSON.stringify(facets));
            url.searchParams.append('limit', limit); 
            url.searchParams.append('offset', (currentPage - 1) * limit);

            const res = await fetch(url);
            const data = await res.json();
            document.getElementById('next-btn').disabled = data.hits.length < limit;
            displayResults(data.hits);
        } catch (err) { resultsCont.innerHTML = 'Сбой сети'; }
    }

    function displayResults(mods) {
        resultsCont.innerHTML = '';
        if(!mods.length) { resultsCont.innerHTML = '<div class="status-message">Ничего не найдено</div>'; return; }

        mods.forEach(mod => {
            const isSel = selectedMods.some(m => m.id === mod.project_id);
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <div class="card-header">
                    <img src="${mod.icon_url || 'https://docs.modrinth.com/img/logo.svg'}">
                    <h3>${mod.title}</h3>
                </div>
                <p>${mod.description.substring(0, 70)}...</p>
                <div class="card-actions">
                    <button class="min-btn outline select-btn" style="border-color:${isSel ? 'var(--accent)' : ''}; color:${isSel ? 'var(--accent)' : ''}">
                        ${isSel ? 'В сборке' : 'Выбрать'}
                    </button>
                    <button class="min-btn info-btn">Инфо</button>
                </div>
            `;
            
            card.querySelector('.select-btn').addEventListener('click', () => toggleSelection(mod, card.querySelector('.select-btn')));
            card.querySelector('.info-btn').addEventListener('click', () => openModal(mod.project_id, mod.icon_url));
            resultsCont.appendChild(card);
        });
    }

    // ЛОГИКА ВЫДЕЛЕНИЯ И КНОПКИ ТЕЛЕГРАМА
    function toggleSelection(mod, btnNode) {
        tg.HapticFeedback.selectionChanged();
        const idx = selectedMods.findIndex(m => m.id === mod.project_id);
        if(idx === -1) { 
            selectedMods.push({id: mod.project_id}); 
            btnNode.innerText = 'В сборке'; btnNode.style.borderColor = 'var(--accent)'; btnNode.style.color = 'var(--accent)';
        } else { 
            selectedMods.splice(idx, 1); 
            btnNode.innerText = 'Выбрать'; btnNode.style.borderColor = 'var(--text-muted)'; btnNode.style.color = 'var(--text-main)';
        }
        
        if(selectedMods.length > 0) {
            tg.MainButton.text = `СКАЧАТЬ СБОРКУ (${selectedMods.length})`;
            tg.MainButton.show();
        } else {
            tg.MainButton.hide();
        }
    }

    // МАССОВОЕ СКАЧИВАНИЕ
    async function downloadAllSelected() {
        tg.MainButton.showProgress();
        for(let i=0; i<selectedMods.length; i++) {
            tg.MainButton.text = `Загрузка: ${i+1}/${selectedMods.length}`;
            try {
                const url = await getDownloadUrl(selectedMods[i].id);
                if(url) { const a = document.createElement('a'); a.href = url; document.body.appendChild(a); a.click(); document.body.removeChild(a); }
                await new Promise(r => setTimeout(r, 800)); // Задержка от блокировки браузером
            } catch(e) {}
        }
        tg.MainButton.hideProgress();
        tg.MainButton.text = "УСПЕШНО ЗАГРУЖЕНО!";
        setTimeout(() => { selectedMods = []; fetchMods(); tg.MainButton.hide(); }, 2000);
    }

    async function getDownloadUrl(id) {
        const res = await fetch(`https://api.modrinth.com/v2/project/${id}/version?game_versions=["${versionSel.value}"]`);
        const data = await res.json();
        if(!data.length) return null;
        return (data[0].files.find(f => f.primary) || data[0].files[0]).url;
    }

    // ВИКИ МОДАЛКА
    async function openModal(id, icon) {
        tg.HapticFeedback.impactOccurred('light');
        projectModal.classList.add('active');
        const modalBody = document.getElementById('modal-body');
        modalBody.innerHTML = 'Загрузка данных...';
        try {
            const data = await (await fetch(`https://api.modrinth.com/v2/project/${id}`)).json();
            const bodyHtml = data.body.replace(/^### (.*$)/gim, '<h3>$1</h3>').replace(/^## (.*$)/gim, '<h2>$1</h2>').replace(/^# (.*$)/gim, '<h1>$1</h1>').replace(/!\[(.*?)\]\((.*?)\)/gim, '<img src="$2">').replace(/\n/gim, '<br>');
            
            modalBody.innerHTML = `
                <img src="${icon || 'https://docs.modrinth.com/img/logo.svg'}" class="head-img">
                <h2>${data.title}</h2>
                <div class="stats">
                    <p><b>Скачиваний:</b> ${data.downloads}</p>
                    <p><b>Обновлен:</b> ${new Date(data.updated).toLocaleDateString()}</p>
                </div>
                <button class="min-btn full-width accent-bg" id="modal-dl" style="margin-bottom: 20px;">Скачать этот файл</button>
                <div class="modal-body-text">${bodyHtml}</div>
            `;
            document.getElementById('modal-dl').addEventListener('click', async (e) => {
                e.target.innerText = 'Загрузка...';
                const url = await getDownloadUrl(id);
                if(url) { window.location.href = url; e.target.innerText = 'Успех!'; }
            });
        } catch(e) { modalBody.innerHTML = 'Ошибка загрузки'; }
    }

    // РАДАР
    document.getElementById('radar-btn').addEventListener('click', async () => {
        tg.HapticFeedback.impactOccurred('light');
        const ip = document.getElementById('radar-input').value.trim();
        const resBox = document.getElementById('radar-result');
        if(!ip) return;
        resBox.classList.remove('hidden'); resBox.innerHTML = 'Пинг...';
        try {
            const data = await (await fetch(`https://api.mcsrvstat.us/3/${ip}`)).json();
            if(data.online) {
                resBox.innerHTML = `<img src="${data.icon || ''}"><div class="radar-status online">ONLINE // ${data.players.online}/${data.players.max}</div><h3>${ip}</h3><p style="font-size: 0.8rem">${data.version}</p>`;
            } else resBox.innerHTML = `<div class="radar-status offline">OFFLINE</div><h3>${ip}</h3>`;
        } catch(e) { resBox.innerHTML = 'Сбой сонара'; }
    });

    // СКИНЫ
    document.getElementById('skin-search-btn').addEventListener('click', () => {
        tg.HapticFeedback.impactOccurred('light');
        const user = document.getElementById('skin-search-input').value.trim();
        if(!user) return;
        document.getElementById('skin-result').classList.remove('hidden');
        document.getElementById('skin-username').innerText = user.toUpperCase();
        document.getElementById('btn-download-raw').href = `https://minotar.net/skin/${user}`;
        document.getElementById('btn-download-avatar').href = `https://minotar.net/helm/${user}/256.png`;
        document.getElementById('skin-3d-render').src = `https://starlightskins.lunareclipse.studio/render/ultimate/${user}/full?height=400`;
    });
});
