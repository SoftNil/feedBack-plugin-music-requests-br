// Pedidos de Música — screen.js
(function () {
    'use strict';

    // ---- Constants ----
    const Plugin_Label = 'Pedidos de Música';
    const Plugin = 'music_requests';
    const API = '/api/plugins/' + Plugin;

    // Cache of requests in memory for live DOM manipulation
    let currentRequests = [];
    let autoRefreshInterval = null;

    // Session control: only process playback events for songs triggered from music_requests
    let _activeRequestId = null;
    let _isHandlingEvent = false;

    // Helper: Format Date/Time
    function formatDateTime(isoString) {
        if (!isoString) return '-';
        try {
            const date = new Date(isoString);
            if (isNaN(date.getTime())) return isoString;
            return date.toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        } catch (e) {
            return isoString;
        }
    }

    // Helper: Show Alert / Toast Message
    function showAlert(message, type = 'success') {
        const alertBox = document.getElementById('mr-alert-message');
        const alertText = document.getElementById('mr-alert-text');
        const alertIcon = document.getElementById('mr-alert-icon');

        if (!alertBox || !alertText) return;

        alertText.textContent = message;

        if (type === 'success') {
            alertBox.className = 'w-full p-4 rounded-xl text-sm transition-all duration-200 flex items-center justify-between bg-green-900/30 text-green-300 border border-green-800 shadow-lg shadow-green-950/20';
            if (alertIcon) alertIcon.textContent = '✅';
        } else if (type === 'error') {
            alertBox.className = 'w-full p-4 rounded-xl text-sm transition-all duration-200 flex items-center justify-between bg-red-900/30 text-red-300 border border-red-800 shadow-lg shadow-red-950/20';
            if (alertIcon) alertIcon.textContent = '❌';
        } else {
            alertBox.className = 'w-full p-4 rounded-xl text-sm transition-all duration-200 flex items-center justify-between bg-blue-900/30 text-blue-300 border border-blue-800 shadow-lg shadow-blue-950/20';
            if (alertIcon) alertIcon.textContent = 'ℹ️';
        }

        alertBox.classList.remove('hidden');

        // Auto-dismiss after 6 seconds for success
        if (type === 'success') {
            setTimeout(() => {
                if (alertText.textContent === message) {
                    alertBox.classList.add('hidden');
                }
            }, 6000);
        }
    }

    // Helper: Render Table Rows
    function renderTable(requests) {
        const table = document.getElementById('mr-requests-table');
        const tbody = document.getElementById('mr-requests-tbody');
        const emptyState = document.getElementById('mr-empty-state');
        const totalRequestsCount = document.getElementById('mr-count-total-requests');
        const badgeCount = document.getElementById('mr-badge-count');

        if (!tbody || !table || !emptyState) return;

        const count = requests.length;
        if (totalRequestsCount) totalRequestsCount.textContent = count;
        if (badgeCount) badgeCount.textContent = count;

        if (count === 0) {
            table.classList.add('hidden');
            emptyState.classList.remove('hidden');
            tbody.innerHTML = '';
            return;
        }

        emptyState.classList.add('hidden');
        table.classList.remove('hidden');

        let html = '';
        requests.forEach((req) => {
            const id = req.id;
            const usuario = req.usuario || '-';
            const artist = req.artist || '-';
            const title = req.title || '-';
            const dateFormatted = formatDateTime(req.created_at);
            const statusRaw = (req.status || 'pending').toLowerCase();
            const isPlaying = (statusRaw === 'playing');
            const isPlayed = (statusRaw === 'played');

            // Format status label and badge
            let statusBadge = '';
            let rowClass = 'hover:bg-gray-800/40 transition-colors';
            let playBtnHtml = '';

            // Escape strings for onclick handlers
            const safeArtist = artist.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            const safeTitle = title.replace(/'/g, "\\'").replace(/"/g, '&quot;');

            if (isPlaying) {
                statusBadge = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-950/40"><span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>Tocando</span>';
                rowClass = 'bg-emerald-950/25 border-l-4 border-l-emerald-500 hover:bg-emerald-950/40 transition-colors';
                playBtnHtml = `
                  <button disabled
                          title="Esta música já está tocando na pista"
                          class="px-2.5 py-1 text-xs font-semibold text-emerald-300 bg-emerald-900/50 border border-emerald-600/60 rounded-md cursor-default flex items-center gap-1 shadow-sm">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                    ▶ Tocando
                  </button>
                `;
            } else if (isPlayed) {
                statusBadge = '<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-700/40 text-gray-400 border border-gray-600/40">Tocado</span>';
                rowClass = 'opacity-75 hover:opacity-100 hover:bg-gray-800/40 transition-colors';
                playBtnHtml = `
                  <button onclick="window.musicRequestsPlayRequest(${id}, '${safeArtist}', '${safeTitle}')"
                          title="Tocar novamente na pista"
                          class="px-2.5 py-1 text-xs font-medium text-gray-300 hover:text-white bg-gray-800/60 hover:bg-gray-700 border border-gray-700 rounded-md transition cursor-pointer shadow-sm flex items-center gap-1">
                    ▶ Tocar
                  </button>
                `;
            } else {
                statusBadge = '<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">Pendente</span>';
                playBtnHtml = `
                  <button onclick="window.musicRequestsPlayRequest(${id}, '${safeArtist}', '${safeTitle}')"
                          title="Abrir e tocar na pista do FeedBack"
                          class="px-2.5 py-1 text-xs font-medium text-emerald-300 hover:text-white bg-emerald-950/40 hover:bg-emerald-800/70 active:bg-emerald-950 border border-emerald-700/50 rounded-md transition cursor-pointer shadow-sm flex items-center gap-1">
                    ▶ Play
                  </button>
                `;
            }

            html += `
              <tr id="mr-row-${id}" class="${rowClass}">
                <td class="py-3 px-4 text-center font-mono text-xs text-gray-400">#${id}</td>
                <td class="py-3 px-4 font-medium text-white">${usuario}</td>
                <td class="py-3 px-4 text-gray-200 font-semibold">${artist}</td>
                <td class="py-3 px-4 text-blue-300 font-medium">${title}</td>
                <td class="py-3 px-4 text-xs text-gray-400 font-mono">${dateFormatted}</td>
                <td class="py-3 px-4 text-center">${statusBadge}</td>
                <td class="py-3 px-4 text-center">
                  <div class="flex items-center justify-center gap-2">
                    ${playBtnHtml}
                    <button onclick="window.musicRequestsDeleteRequest(${id}, '${safeArtist}', '${safeTitle}')"
                            title="Excluir pedido #${id} da fila"
                            class="px-2.5 py-1 text-xs font-medium text-red-400 hover:text-red-200 bg-red-950/40 hover:bg-red-900/60 active:bg-red-950 border border-red-800/50 rounded-md transition cursor-pointer shadow-sm flex items-center gap-1">
                      <span>🗑️</span> Excluir
                    </button>
                  </div>
                </td>
              </tr>
            `;
        });

        tbody.innerHTML = html;
    }

    // ── 1. Fetch Requests from API ──────────────────────────────────────────
    async function musicRequestsFetchRequests(isManual = false) {
        const refreshIcon = document.getElementById('mr-refresh-icon');
        const refreshBtn = document.getElementById('mr-refresh-btn');

        if (isManual && refreshIcon) {
            refreshIcon.classList.add('animate-spin');
        }
        if (isManual && refreshBtn) {
            refreshBtn.disabled = true;
        }

        try {
            const response = await fetch(`${API}/requests`);
            if (response.ok) {
                const data = await response.json();
                if (data.ok && Array.isArray(data.requests)) {
                    currentRequests = data.requests;
                    renderTable(currentRequests);
                    if (isManual) {
                        showAlert('Lista de pedidos atualizada.', 'success');
                    }
                }
            } else {
                if (isManual) {
                    showAlert('Erro ao buscar pedidos do servidor.', 'error');
                }
            }
        } catch (err) {
            console.error(`${Plugin_Label}: Erro ao carregar pedidos`, err);
            if (isManual) {
                showAlert('Falha na comunicação com a API de pedidos.', 'error');
            }
        } finally {
            if (isManual && refreshIcon) {
                refreshIcon.classList.remove('animate-spin');
            }
            if (isManual && refreshBtn) {
                refreshBtn.disabled = false;
            }
        }
    }

    // ── 2. Play Request via API & window.playSong ───────────────────────────
    async function musicRequestsPlayRequest(id, artist = '', title = '') {
        const songLabel = (artist && title) ? `${artist} - ${title}` : `Pedido #${id}`;

        try {
            const response = await fetch(`${API}/request/${id}/play`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();

            if (response.ok && data.ok) {
                // Set active request ID for lifecycle isolation and clear busy flag
                _activeRequestId = id;
                _isHandlingEvent = false;

                // Update in-memory state: revert previous playing to pending and set new playing
                currentRequests.forEach(req => {
                    if (req.id === id) {
                        req.status = 'playing';
                    } else if (req.status === 'playing') {
                        req.status = 'pending';
                    }
                });

                renderTable(currentRequests);
                showAlert(`Agora tocando: ${songLabel}`, 'success');

                // Call native FeedBack player
                if (data.filename) {
                    if (typeof window.playSong === 'function') {
                        console.log(`${Plugin_Label}: Invocando window.playSong('${data.filename}')`);
                        window.playSong(data.filename);
                    } else {
                        console.warn(`${Plugin_Label}: window.playSong não está disponível no escopo global.`);
                    }
                }
            } else {
                const errorMsg = data.error || 'Música não encontrada na biblioteca';
                showAlert(errorMsg, 'error');
            }
        } catch (err) {
            console.error(`${Plugin_Label}: Falha ao executar Play no pedido #${id}`, err);
            showAlert('Falha de conexão ao tentar tocar o pedido.', 'error');
        }
    }

    // ── 3. Handle Song Finished Naturally (playing -> played) ───────────────
    function handleSongEnded() {
        if (!_activeRequestId || _isHandlingEvent) return;
        _isHandlingEvent = true;

        const targetId = _activeRequestId;
        _activeRequestId = null;

        console.log(`${Plugin_Label}: Término natural da música detectado para pedido #${targetId}`);
        fetch(`${API}/request/${targetId}/played`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        })
        .then(res => res.json())
        .then(data => {
            if (data.ok && data.request) {
                console.log(`${Plugin_Label}: Pedido #${targetId} finalizado como 'played'.`);
                // Update in-memory state and re-render
                currentRequests.forEach(req => {
                    if (req.id === targetId) req.status = 'played';
                });
                renderTable(currentRequests);
                musicRequestsFetchRequests(false);
            }
        })
        .catch(err => {
            console.error(`${Plugin_Label}: Erro ao marcar pedido #${targetId} como played:`, err);
        });
    }

    // ── 4. Handle Song Interrupted / ESC (playing -> pending) ────────────────
    function handleSongStopped() {
        if (!_activeRequestId || _isHandlingEvent) return;
        _isHandlingEvent = true;

        const targetId = _activeRequestId;
        _activeRequestId = null;

        console.log(`${Plugin_Label}: Interrupção da música (ESC/Stop) detectada para pedido #${targetId}`);
        fetch(`${API}/request/${targetId}/stop`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        })
        .then(res => res.json())
        .then(data => {
            if (data.ok && data.request) {
                console.log(`${Plugin_Label}: Pedido #${targetId} revertido para 'pending'.`);
                // Update in-memory state and re-render
                currentRequests.forEach(req => {
                    if (req.id === targetId) req.status = 'pending';
                });
                renderTable(currentRequests);
                musicRequestsFetchRequests(false);
            }
        })
        .catch(err => {
            console.error(`${Plugin_Label}: Erro ao reverter pedido #${targetId} para pending:`, err);
        });
    }

    // ── 5. Delete Request via API ───────────────────────────────────────────
    async function musicRequestsDeleteRequest(id, artist = '', title = '') {
        const songLabel = (artist && title) ? ` (${artist} - ${title})` : '';
        const confirmed = window.confirm(`Deseja realmente excluir o pedido #${id}${songLabel}?`);
        if (!confirmed) return;

        try {
            const response = await fetch(`${API}/request/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();

            if (response.ok && data.ok) {
                if (_activeRequestId === id) {
                    _activeRequestId = null;
                }
                // Remove row from memory and update UI immediately without full reload
                currentRequests = currentRequests.filter(req => req.id !== id);
                renderTable(currentRequests);
                showAlert(`Pedido #${id}${songLabel} excluído com sucesso!`, 'success');
                loadCatalogStatus();
            } else {
                const errorMsg = data.error || `Erro ao excluir o pedido #${id}.`;
                showAlert(errorMsg, 'error');
            }
        } catch (err) {
            console.error(`${Plugin_Label}: Falha ao excluir pedido #${id}`, err);
            showAlert(`Falha de conexão ao tentar excluir o pedido #${id}.`, 'error');
        }
    }

    // ── 6. Load Catalog and Overview Status ─────────────────────────────────
    async function loadCatalogStatus() {
        try {
            const response = await fetch(`${API}/status`);
            if (response.ok) {
                const data = await response.json();
                const overviewArtistsEl = document.getElementById('mr-count-catalog-artists');
                const overviewSongsEl = document.getElementById('mr-count-catalog-songs');

                if (overviewArtistsEl) {
                    overviewArtistsEl.textContent = data.total_artistas || 0;
                }
                if (overviewSongsEl) {
                    overviewSongsEl.textContent = data.total_musicas || 0;
                }
            }
        } catch (err) {
            console.debug(`${Plugin_Label}: Status load error`, err);
        }
    }

    // ── 7. Sync Catalog with meta_db ────────────────────────────────────────
    async function musicRequestsSyncCatalog() {
        const btn = document.getElementById('mr-sync-btn');
        const icon = document.getElementById('mr-sync-icon');

        if (btn) {
            btn.disabled = true;
            btn.classList.add('opacity-75', 'cursor-not-allowed');
        }
        if (icon) {
            icon.classList.add('animate-spin');
        }

        showAlert('Sincronizando catálogo com a biblioteca oficial...', 'info');

        try {
            const response = await fetch(`${API}/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();

            if (response.ok && data.ok) {
                loadCatalogStatus();
                if (data.has_changes) {
                    showAlert(`Catálogo atualizado com sucesso! (+${data.musicas_adicionadas} / -${data.musicas_removidas} músicas, +${data.artistas_adicionados} / -${data.artistas_removidos} artistas)`, 'success');
                } else {
                    showAlert('Nenhuma alteração na biblioteca. Catálogo já está atualizado.', 'info');
                }
            } else {
                showAlert(data.error || 'Erro ao sincronizar catálogo.', 'error');
            }
        } catch (err) {
            console.error(`${Plugin_Label}: Sync failed`, err);
            showAlert('Falha na conexão ao sincronizar catálogo.', 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.classList.remove('opacity-75', 'cursor-not-allowed');
            }
            if (icon) {
                icon.classList.remove('animate-spin');
            }
        }
    }

    // ── 8. Ensure Sidebar Nav Item ("Pedidos") ──────────────────────────────
    function ensureSidebarNav() {
        const nav = document.getElementById('v3-nav');
        if (!nav) return;

        let existing = nav.querySelector('[data-v3-nav="music_requests"]');
        if (existing) {
            // Update active styling if this screen is current
            const isCurrent = document.querySelector('#plugin-music_requests.screen.active') !== null;
            if (isCurrent) {
                existing.classList.add('text-fb-text', 'bg-fb-card/50');
                existing.classList.remove('text-fb-textDim');
            } else {
                existing.classList.remove('text-fb-text', 'bg-fb-card/50');
                existing.classList.add('text-fb-textDim');
            }
            return;
        }

        // Find Playlists anchor or existing promoted slot
        const playlistLink = nav.querySelector('[data-v3-nav="playlists"]');
        if (playlistLink) {
            const itemWrap = playlistLink.parentElement || playlistLink;
            const navItem = document.createElement('div');
            navItem.className = 'space-y-0.5';
            navItem.id = 'v3-nav-music-requests';
            navItem.innerHTML = `
                <a href="#/music_requests" data-v3-nav="music_requests"
                   class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-fb-textDim hover:text-fb-text hover:bg-fb-card/50 transition-colors">
                    <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"></path>
                    </svg>
                    <span class="truncate v3-nav-label">Pedidos</span>
                </a>
            `;
            const a = navItem.querySelector('a');
            a.addEventListener('click', (e) => {
                e.preventDefault();
                if (typeof window.showScreen === 'function') {
                    window.showScreen('plugin-music_requests');
                }
            });
            itemWrap.insertAdjacentElement('afterend', navItem);
        }
    }

    // ── 9. Dynamic Requests Limit Configuration ─────────────────────────────
    async function musicRequestsLoadConfig() {
        try {
            const res = await fetch(API + '/config', {
                headers: { 'ngrok-skip-browser-warning': 'true' }
            });
            if (res.ok) {
                const data = await res.json();
                const input = document.getElementById('input-limite-pedidos');
                if (input && data && typeof data.max_requests_per_user !== 'undefined') {
                    input.value = data.max_requests_per_user;
                }
            }
        } catch (err) {
            console.error(`${Plugin_Label}: Erro ao carregar configurações:`, err);
        }
    }

    async function musicRequestsSaveConfig() {
        const input = document.getElementById('input-limite-pedidos');
        const btn = document.getElementById('btn-salvar-limite');
        if (!input) return;

        const val = parseInt(input.value, 10);
        if (isNaN(val) || val < 0) {
            showAlert('Por favor, informe um número válido (0 ou maior).', 'error');
            return;
        }

        if (btn) {
            btn.disabled = true;
            btn.classList.add('opacity-75', 'cursor-not-allowed');
        }

        try {
            const res = await fetch(API + '/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                },
                body: JSON.stringify({ max_requests_per_user: val })
            });

            const data = await res.json().catch(() => ({}));
            if (res.ok && data.ok) {
                showAlert('Limite atualizado com sucesso!', 'success');
            } else {
                showAlert(data.error || 'Erro ao atualizar limite de pedidos.', 'error');
            }
        } catch (err) {
            console.error(`${Plugin_Label}: Erro ao salvar configurações:`, err);
            showAlert('Falha na conexão ao salvar limite.', 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.classList.remove('opacity-75', 'cursor-not-allowed');
            }
        }
    }

    // ── 10. Clear Entire Queue ─────────────────────────────────────────────
    async function musicRequestsClearQueue() {
        const confirmed = window.confirm('Tem certeza absoluta de que deseja limpar todos os pedidos da lista? Esta ação não pode ser desfeita.');
        if (!confirmed) {
            return;
        }

        const btn = document.getElementById('btn-limpar-fila');
        if (btn) {
            btn.disabled = true;
            btn.style.opacity = '0.6';
            btn.style.cursor = 'not-allowed';
        }

        try {
            const res = await fetch(API + '/clear', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                }
            });

            let data = null;
            try {
                data = await res.json();
            } catch (e) {}

            if (res.ok && (data && (data.success || data.ok))) {
                currentRequests = [];
                renderTable([]);
                showAlert('Fila limpa com sucesso!', 'success');
            } else {
                const errMsg = (data && (data.error || data.detail)) || 'Erro ao limpar a fila de pedidos.';
                showAlert(errMsg, 'error');
            }
        } catch (err) {
            console.error(`${Plugin_Label}: Erro ao limpar fila:`, err);
            showAlert('Falha na conexão ao limpar a fila.', 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
            }
        }
    }

    // ── Expose Global Handlers for HTML Buttons ─────────────────────────────
    window.musicRequestsFetchRequests = musicRequestsFetchRequests;
    window.musicRequestsPlayRequest = musicRequestsPlayRequest;
    window.musicRequestsDeleteRequest = musicRequestsDeleteRequest;
    window.musicRequestsSyncCatalog = musicRequestsSyncCatalog;
    window.musicRequestsLoadConfig = musicRequestsLoadConfig;
    window.musicRequestsSaveConfig = musicRequestsSaveConfig;
    window.musicRequestsClearQueue = musicRequestsClearQueue;

    // ── Resilient Lifecycle Listener Registration ───────────────────────────
    const wireLifecycleListeners = () => {
        const bus = window.slopsmith || window.feedBack;
        if (!bus || typeof bus.on !== 'function') {
            window.addEventListener('feedBack:capabilities:ready', wireLifecycleListeners, { once: true });
            window.addEventListener('slopsmith:capabilities:ready', wireLifecycleListeners, { once: true });
            return;
        }

        // Genuine song ending events
        bus.on('playback:ended', handleSongEnded);
        bus.on('song:ended', handleSongEnded);

        // Song stopped / ESC events
        bus.on('playback:stopped', handleSongStopped);
        bus.on('song:stop', handleSongStopped);

        // Sidebar sync on screen change
        bus.on('screen:changed', ensureSidebarNav);
    };
    wireLifecycleListeners();

    // Fallback on HTML5 audio element
    const audioEl = document.getElementById('audio');
    if (audioEl) {
        audioEl.addEventListener('ended', handleSongEnded);
    }

    // ── Initial Load and Setup ──────────────────────────────────────────────
    loadCatalogStatus();
    musicRequestsLoadConfig();
    musicRequestsFetchRequests();
    ensureSidebarNav();

    // Periodic check to ensure sidebar link and requests sync
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    autoRefreshInterval = setInterval(() => {
        ensureSidebarNav();
        if (document.getElementById('mr-requests-tbody')) {
            musicRequestsFetchRequests(false);
        }
    }, 4000);

    console.log(Plugin_Label + ': interface carregada com item promovido na barra lateral.');
})();
