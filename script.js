document.addEventListener('DOMContentLoaded', async () => {
    // --- ИНИЦИАЛИЗАЦИЯ ТЕЛЕГРАМА ---
    const tg = window.Telegram.WebApp;
    tg.expand();
    tg.ready();

    if (tg.themeParams.bg_color) {
        document.documentElement.style.setProperty('--tg-bg', tg.themeParams.bg_color);
    }

    // --- УМНЫЙ ЗАГРУЗЧИК ВЕРСИЙ (От 1.20 до новейших, без мусора) ---
    const versionSel = document.getElementById('version-select');
    async function loadSmartVersions() {
        try {
            const res = await fetch('https://api.modrinth.com/v2/tag/game_version');
            const data = await res.json();
            
            // Фильтруем: только релизы (не снапшоты) и только от 1.20 и выше (1.20, 1.21, 1.22...)
            const stableVersions = data.filter(v => 
                v.version_type === 'release' && 
                (v.version.startsWith('1.20') || v.version.startsWith('1.21') || v.version.startsWith('1.22') || v.version.startsWith('1.23'))
            );

            versionSel.innerHTML = '';
            stableVersions.forEach(v => {
                const opt = document.createElement('option');
                opt.value = v.version;
                opt.innerText = v.version;
                versionSel.appendChild(opt);
            });
            // После загрузки версий, запускаем поиск модов
            fetchMods();
        } catch (e) {
            versionSel.innerHTML = '<option value="1.21.11">1.21.11</option>'; // Запасной план
            fetchMods();
        }
    }

    // --- НАВИГАЦИЯ BOTTOM NAV ---
    const navBtns = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.view-section');
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tg.HapticFeedback.impactOccurred('light'); 
            navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            sections.forEach(sec => {
                if(sec.id === btn.dataset.target) { sec.classList.remove('hidden'); sec.classList.add('active'); }
                else { sec.classList.add('hidden'); sec.classList.remove('active'); }
            });
        });
    });

    // --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ---
    let currentPage = 1, limit = 15, currentCategory = "", selectedMods = [];
    const searchBtn = document.getElementById('search-btn'), searchInput = document.getElementById('search-input');
    const typeSel = document.getElementById('type-select');
    const resultsCont = document.getElementById('results'), projectModal = document.getElementById('project-modal');

    // Кнопка ТГ (Массовая загрузка)
    tg.MainButton.text = "СКАЧАТЬ АДДОНЫ (0)";
    tg.MainButton.color = "#b026ff"; 
    tg.MainButton.onClick(() => {
        tg.HapticFeedback.notificationOccurred('success');
        downloadAllSelected();
    });

    searchBtn.addEventListener('click', () => { tg.HapticFeedback.impactOccurred('light'); currentPage = 1; fetchMods(); });
    document.getElementById('prev-btn').addEventListener('click', () => { if(currentPage>1){currentPage--; fetchMods();} });
    document.getElementById('next-btn').addEventListener('click', () => { currentPage++; fetchMods(); });
    document.getElementById('close-modal-btn').addEventListener('click', () => projectModal.classList.remove('active'));

    // Смарт-теги
    document.querySelectorAll('.tag-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            tg.HapticFeedback.impactOccurred('light');
            document.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));
            if (currentCategory === e.target.dataset.tag) { currentCategory = ""; } 
            else { e.target.classList.add('active'); currentCategory = e.target.dataset.tag; }
            currentPage = 1; fetchMods();
        });
    });

    // Запускаем сборку версий (она сама потом вызовет fetchMods)
    loadSmartVersions();

    // --- ЛОГИКА ПОИСКА МОДОВ ---
    async function fetchMods() {
        resultsCont.innerHTML = '<div class="status-message">СИНХРОНИЗАЦИЯ...</div>';
        document.getElementById('page-indicator').innerText = `СТР. ${currentPage}`;
        document.getElementById('prev-btn').disabled = currentPage === 1;

        try {
            const facets = [[`versions:${versionSel.value}`], [`project_type:${typeSel.value}`]];
            if (currentCategory) facets.push([`categories:${currentCategory}`]);

            const url = new URL('https://api.modrinth.com/v2/search');
            url.searchParams.append('query', searchInput.value); 
            url.searchParams.append('facets', JSON.stringify(facets));
            url.searchParams.append('limit', limit); 
            url.searchParams.append('offset', (currentPage - 1) * limit);

            const res = await fetch(url);
            const data = await res.json();
            document.getElementById('next-btn').disabled = data.hits.length < limit;
            displayResults(data.hits);
        } catch (err) { resultsCont.innerHTML = '<div class="status-message" style="color:#ff007f;">СБОЙ СЕТИ</div>'; }
    }

    function displayResults(mods) {
        resultsCont.innerHTML = '';
        if(!mods.length) { resultsCont.innerHTML = '<div class="status-message">ПУСТО.</div>'; return; }

        mods.forEach(mod => {
            const isSel = selectedMods.some(m => m.id === mod.project_id);
            const card = document.createElement('div');
            card.className = `card ${isSel ? 'selected' : ''}`;
            
            let shortDesc = mod.description.length > 70 ? mod.description.substring(0, 70) + '...' : mod.description;

            card.innerHTML = `
                <div class="card-header">
                    <img src="${mod.icon_url || 'https://docs.modrinth.com/img/logo.svg'}">
                    <h3>${mod.title}</h3>
                </div>
                <p>${shortDesc}</p>
                <div class="card-actions">
                    <button class="neon-btn outline select-btn">
                        ${isSel ? 'УБРАТЬ' : 'В СБОРКУ'}
                    </button>
                    <button class="neon-btn info-btn">ДЕТАЛИ</button>
                </div>
            `;
            
            card.querySelector('.select-btn').addEventListener('click', () => toggleSelection(mod, card));
            card.querySelector('.info-btn').addEventListener('click', () => openModal(mod.project_id, mod.icon_url));
            resultsCont.appendChild(card);
        });
    }

    // --- ВЫБОР И МАССОВОЕ СКАЧИВАНИЕ ---
    function toggleSelection(mod, card) {
        tg.HapticFeedback.selectionChanged();
        const idx = selectedMods.findIndex(m => m.id === mod.project_id);
        const btn = card.querySelector('.select-btn');
        
        if(idx === -1) { 
            selectedMods.push({id: mod.project_id}); 
            card.classList.add('selected'); btn.innerText = 'УБРАТЬ';
        } else { 
            selectedMods.splice(idx, 1); 
            card.classList.remove('selected'); btn.innerText = 'В СБОРКУ';
        }
        
        if(selectedMods.length > 0) {
            tg.MainButton.text = `СКАЧАТЬ АДДОНЫ (${selectedMods.length})`; tg.MainButton.show();
        } else { tg.MainButton.hide(); }
    }

    async function downloadAllSelected() {
        tg.MainButton.showProgress();
        for(let i=0; i<selectedMods.length; i++) {
            tg.MainButton.text = `ЗАГРУЗКА: ${i+1}/${selectedMods.length}`;
            try {
                const url = await getDownloadUrl(selectedMods[i].id);
                if(url) { const a = document.createElement('a'); a.href = url; document.body.appendChild(a); a.click(); document.body.removeChild(a); }
                await new Promise(r => setTimeout(r, 800)); 
            } catch(e) {}
        }
        tg.MainButton.hideProgress(); tg.MainButton.text = "УСПЕШНО!";
        setTimeout(() => { selectedMods = []; fetchMods(); tg.MainButton.hide(); }, 2000);
    }

    async function getDownloadUrl(id) {
        const res = await fetch(`https://api.modrinth.com/v2/project/${id}/version?game_versions=["${versionSel.value}"]`);
        const data = await res.json();
        if(!data.length) return null;
        return (data[0].files.find(f => f.primary) || data[0].files[0]).url;
    }

    // --- ВИКИ-МОДАЛКА (С ПЕРЕВОДОМ) ---
    async function openModal(id, icon) {
        tg.HapticFeedback.impactOccurred('light');
        projectModal.classList.add('active');
        const modalBody = document.getElementById('modal-body');
        modalBody.innerHTML = '<div class="status-message">ЗАГРУЗКА...</div>';
        try {
            const data = await (await fetch(`https://api.modrinth.com/v2/project/${id}`)).json();
            const bodyHtml = data.body.replace(/^### (.*$)/gim, '<h3>$1</h3>').replace(/^## (.*$)/gim, '<h2>$1</h2>').replace(/^# (.*$)/gim, '<h1>$1</h1>').replace(/!\[(.*?)\]\((.*?)\)/gim, '<img src="$2">').replace(/\n/gim, '<br>');
            
            modalBody.innerHTML = `
                <div class="modal-mobile-layout">
                    <img src="${icon || 'https://docs.modrinth.com/img/logo.svg'}" class="head-img">
                    <h2>${data.title} <button id="translate-btn" style="background:none; border:none; font-size:1.5rem; filter:grayscale(1); cursor:pointer;">🌐</button></h2>
                    <div class="stats">
                        <p style="color:var(--neon-green); margin-bottom:5px;"><b>Скачиваний:</b> ${data.downloads}</p>
                        <p style="color:var(--neon-purple)"><b>Обновлен:</b> ${new Date(data.updated).toLocaleDateString()}</p>
                    </div>
                    <button class="neon-btn full-width" id="modal-dl" style="margin-bottom: 20px;">СКАЧАТЬ ФАЙЛ</button>
                    <div class="modal-body-text" id="modal-text">${bodyHtml}</div>
                </div>
            `;
            
            document.getElementById('modal-dl').addEventListener('click', async (e) => {
                e.target.innerText = 'ПОИСК ФАЙЛА...';
                const url = await getDownloadUrl(id);
                if(url) { window.location.href = url; e.target.innerText = 'ГОТОВО!'; }
            });

            // Кнопка перевода
            document.getElementById('translate-btn').addEventListener('click', async (e) => {
                const btn = e.target; if(btn.dataset.t === "1") return;
                btn.innerText = "⏳";
                try {
                    const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ru&dt=t&q=${encodeURIComponent(data.body.substring(0, 1500))}`); // Переводим до 1500 симв.
                    const transData = await res.json();
                    document.getElementById('modal-text').innerHTML = transData[0].map(i => i[0]).join('').replace(/\n/gim, '<br>');
                    btn.innerText = "🇷🇺"; btn.dataset.t = "1"; btn.style.filter = "none";
                } catch(err) { btn.innerText = "❌"; }
            });

        } catch(e) { modalBody.innerHTML = '<div class="status-message" style="color:#ff007f;">ОШИБКА</div>'; }
    }

    // --- РАДАР (BEDROCK ПОРТЫ) ---
    document.getElementById('radar-btn').addEventListener('click', async () => {
        tg.HapticFeedback.impactOccurred('light');
        const ip = document.getElementById('radar-input').value.trim();
        const resBox = document.getElementById('radar-result');
        if(!ip) return;
        resBox.classList.remove('hidden'); resBox.innerHTML = '<div class="status-message">ПИНГ...</div>';
        try {
            const data = await (await fetch(`https://api.mcsrvstat.us/bedrock/3/${ip}`)).json();
            if(data.online) {
                resBox.innerHTML = `
                    <div class="radar-status online">ONLINE // ${data.players.online}/${data.players.max}</div>
                    <h3 style="font-size:1.5rem; margin-top:10px;">${ip}</h3>
                    <p style="color:var(--neon-purple); font-weight:bold;">Версия: ${data.version}</p>
                    <p style="color:#aaa; font-size:0.9rem; margin-top:5px;">Ядро: ${data.software || 'Неизвестно'}</p>
                `;
            } else resBox.innerHTML = `<div class="radar-status offline">OFFLINE</div><h3 style="margin-top:10px;">${ip}</h3>`;
        } catch(e) { resBox.innerHTML = '<div class="status-message" style="color:#ff007f;">ОШИБКА</div>'; }
    });

    // --- СКИНЫ ---
    document.getElementById('skin-search-btn').addEventListener('click', () => {
        tg.HapticFeedback.impactOccurred('light');
        const user = document.getElementById('skin-search-input').value.trim();
        if(!user) return;
        document.getElementById('skin-result').classList.remove('hidden');
        document.getElementById('skin-username').innerText = user.toUpperCase();
        document.getElementById('btn-download-raw').href = `https://minotar.net/skin/${user}`;
        document.getElementById('btn-download-avatar').href = `https://minotar.net/helm/${user}/256.png`;
        document.getElementById('skin-3d-render').src = `https://starlightskins.lunareclipse.studio/render/ultimate/${user}/full?height=300`;
    });
});
