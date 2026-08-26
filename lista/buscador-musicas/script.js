// ============================================================
// CONFIGURAÇÃO DA API (NGROK / FASTAPI)
// ============================================================
// Altere esta URL sempre que o túnel do ngrok for reiniciado ou modificado:
const API_BASE_URL = 'https://nonnihilistic-lita-unpanniered.ngrok-free.dev';

// Endpoints da API construídos dinamicamente a partir do endereço base:
const API_ENDPOINTS = {
    REQUEST: `${API_BASE_URL}/api/plugins/music_requests/request`,
    REQUESTS: `${API_BASE_URL}/api/plugins/music_requests/requests`,
    PUBLIC_QUEUE: `${API_BASE_URL}/api/plugins/music_requests/public-queue`,
    MY_REQUESTS: `${API_BASE_URL}/api/plugins/music_requests/my-requests`,
    CHANGE: `${API_BASE_URL}/api/plugins/music_requests/change`,
    DELETE: `${API_BASE_URL}/api/plugins/music_requests/delete`,
    BANDS_JSON: `${API_BASE_URL}/api/plugins/music_requests/bands.json`,
    STATUS: `${API_BASE_URL}/api/plugins/music_requests/status`
};

let bands = [];
let currentPage = 1;
let totalPages = 1;
let currentLetter = 'all';
let currentSearchArtist = '';
let currentSearchMusic = '';
let currentLimit = parseInt(document.getElementById('limitSelect')?.value || '20', 10);

const toast = document.getElementById('toast');
const loader = document.getElementById('loader');

// Fontes candidatas para o bands.json (tenta o arquivo local/relativo primeiro, depois a API remota)
const BANDS_CANDIDATE_URLS = [
    'bands.json',
    '../bands.json',
    API_ENDPOINTS.BANDS_JSON
];

// ============================================================
// TOAST / LOADER
// ============================================================

let toastTimeout = null;

function showToast(message) {
    alert(message);
}

function showLoader() {
    if (loader) loader.style.display = 'block';
}

function hideLoader() {
    if (loader) loader.style.display = 'none';
}

// ============================================================
// PEDIDO DE MÚSICA & COMANDO
// ============================================================

async function pedirMusica(artist, title) {
    // Se o modal de troca de música estiver aberto, selecionar para troca em vez de criar novo pedido
    const modalTrocaEl = document.getElementById('modalTrocarPedido');
    if (modalTrocaEl && modalTrocaEl.classList.contains('show')) {
        selecionarMusicaParaTroca(artist, title);
        showToast(`Música selecionada para troca: ${artist} - ${title}`);
        return;
    }

    const usuarioInput = document.getElementById('Username');
    const passwordInput = document.getElementById('Password');
    const textoInput = document.getElementById('texto');
    const usuario = usuarioInput ? usuarioInput.value.trim() : '';
    const senha = passwordInput ? passwordInput.value.trim() : '';

    if (textoInput) {
        textoInput.value = `!pedir ${artist} - ${title}`;
    }

    if (!usuario) {
        showToast('Digite seu apelido primeiro.');
        if (usuarioInput) usuarioInput.focus();
        return;
    }

    if (!senha) {
        showToast('Digite sua senha.');
        if (passwordInput) passwordInput.focus();
        return;
    }

    try {
        const response = await fetch(
            API_ENDPOINTS.REQUEST,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                },
                body: JSON.stringify({
                    usuario: usuario,
                    senha: senha,
                    artist: artist,
                    title: title
                })
            }
        );

        let data = null;
        try {
            data = await response.json();
        } catch (jsonErr) {
            // Resposta não é JSON ou corpo vazio
        }

        if (!response.ok) {
            const errorMsg = (data && (data.error || data.detail))
                ? (data.error || data.detail)
                : `Erro ao enviar pedido: servidor retornou HTTP ${response.status}.`;
            showToast(errorMsg);
            return;
        }

        if (!data || !data.ok) {
            showToast(
                (data && (data.error || data.detail)) ||
                'Não foi possível fazer o pedido.'
            );
            return;
        }

        showToast(
            `Pedido enviado com sucesso: ${artist} - ${title}`
        );

    } catch (error) {
        console.error(
            'Erro de conexão ao enviar pedido:',
            error
        );

        showToast(
            'Não estamos aceitando pedidos no momento.'
        );
    }
}

function enviar() {
    const comandoInput = document.getElementById('texto');
    const usuarioInput = document.getElementById('Username');
    const passwordInput = document.getElementById('Password');

    const comando = comandoInput ? comandoInput.value.trim() : '';
    const usuario = usuarioInput ? usuarioInput.value.trim() : '';
    const senha = passwordInput ? passwordInput.value.trim() : '';

    if (!usuario) {
        showToast('Digite seu apelido primeiro.');
        if (usuarioInput) usuarioInput.focus();
        return;
    }

    if (!senha) {
        showToast('Digite sua senha.');
        if (passwordInput) passwordInput.focus();
        return;
    }

    if (!comando) {
        showToast('Selecione uma música na lista abaixo ou digite o comando.');
        return;
    }

    let clean = comando.replace(/^!pedir\s+/i, '').trim();
    let parts = clean.split(' - ');
    if (parts.length >= 2) {
        let artist = parts[0].trim();
        let title = parts.slice(1).join(' - ').trim();
        pedirMusica(artist, title);
    } else {
        showToast('Formato do comando: !pedir Artista - Música');
    }
}

window.enviar = enviar;

// ============================================================
// MEUS PEDIDOS (MODAL & CONSULTA COM AUTENTICAÇÃO)
// ============================================================

const STORAGE_KEY_MEUS_PEDIDOS = 'musicRequestsMeusPedidos';

function abrirModalMeusPedidos() {
    const usuarioInput = document.getElementById('Username');
    const passwordInput = document.getElementById('Password');
    const usuario = usuarioInput ? usuarioInput.value.trim() : '';
    const senha = passwordInput ? passwordInput.value.trim() : '';

    if (!usuario) {
        alert('Digite seu apelido no campo Apelido para ver seus pedidos.');
        if (usuarioInput) usuarioInput.focus();
        return;
    }

    if (!senha) {
        alert('Digite sua senha no campo Senha para ver seus pedidos.');
        if (passwordInput) passwordInput.focus();
        return;
    }

    const badge = document.getElementById('meusPedidosUsuarioBadge');
    if (badge) {
        badge.textContent = `@${usuario}`;
    }

    const modalEl = document.getElementById('modalMeusPedidos');
    if (modalEl && window.bootstrap && typeof window.bootstrap.Modal === 'function') {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }

    carregarMeusPedidos(true);
}

window.abrirModalMeusPedidos = abrirModalMeusPedidos;

async function carregarMeusPedidos(isManual = false) {
    const usuarioInput = document.getElementById('Username');
    const passwordInput = document.getElementById('Password');
    const usuario = usuarioInput ? usuarioInput.value.trim() : '';
    const senha = passwordInput ? passwordInput.value.trim() : '';

    if (!usuario) {
        alert('Digite seu apelido para carregar seus pedidos.');
        return;
    }

    if (!senha) {
        alert('Digite sua senha para carregar seus pedidos.');
        return;
    }

    const iconAtualizar = document.getElementById('iconAtualizarMeusPedidos');
    const btnAtualizar = document.getElementById('btnAtualizarMeusPedidos');
    const loadingEl = document.getElementById('meusPedidosLoading');
    const tableContainer = document.getElementById('meusPedidosTableContainer');
    const vazioEl = document.getElementById('meusPedidosVazio');

    if (iconAtualizar) iconAtualizar.classList.add('fa-spin');
    if (btnAtualizar) btnAtualizar.disabled = true;
    if (loadingEl && (!tableContainer || tableContainer.classList.contains('d-none'))) {
        loadingEl.classList.remove('d-none');
        if (vazioEl) vazioEl.classList.add('d-none');
    }

    try {
        const response = await fetch(API_ENDPOINTS.MY_REQUESTS, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify({
                usuario: usuario,
                senha: senha
            })
        });

        let data = null;
        try {
            data = await response.json();
        } catch (jsonErr) {}

        if (!response.ok) {
            const errorMsg = (data && data.error) ? data.error : `Erro ao buscar pedidos: servidor retornou HTTP ${response.status}.`;
            alert(errorMsg);
            renderizarMeusPedidos([]);
            return;
        }

        if (!data || !data.ok || !Array.isArray(data.requests)) {
            alert('Não foi possível obter a lista de pedidos do servidor.');
            renderizarMeusPedidos([]);
            return;
        }

        const meusPedidos = data.requests;

        // Salvar pedidos (nunca a senha) no localStorage
        try {
            localStorage.setItem(STORAGE_KEY_MEUS_PEDIDOS, JSON.stringify(meusPedidos));
        } catch (storageErr) {
            console.warn('Erro ao salvar pedidos no localStorage:', storageErr);
        }

        renderizarMeusPedidos(meusPedidos);

    } catch (error) {
        console.error('Erro de conexão ao buscar meus pedidos:', error);
        alert('Não foi possível conectar ao servidor para buscar seus pedidos.');

        // Tentar recuperar do localStorage em caso de falha de conexão
        try {
            const cached = localStorage.getItem(STORAGE_KEY_MEUS_PEDIDOS);
            if (cached) {
                const pedidosCached = JSON.parse(cached);
                if (Array.isArray(pedidosCached)) {
                    renderizarMeusPedidos(pedidosCached);
                }
            }
        } catch (e) {}
    } finally {
        if (iconAtualizar) iconAtualizar.classList.remove('fa-spin');
        if (btnAtualizar) btnAtualizar.disabled = false;
        if (loadingEl) loadingEl.classList.add('d-none');
    }
}

window.carregarMeusPedidos = carregarMeusPedidos;

function renderizarMeusPedidos(pedidos) {
    const tbody = document.getElementById('meusPedidosBody');
    const tableContainer = document.getElementById('meusPedidosTableContainer');
    const vazioEl = document.getElementById('meusPedidosVazio');
    const loadingEl = document.getElementById('meusPedidosLoading');

    if (loadingEl) loadingEl.classList.add('d-none');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!Array.isArray(pedidos) || pedidos.length === 0) {
        if (tableContainer) tableContainer.classList.add('d-none');
        if (vazioEl) vazioEl.classList.remove('d-none');
        return;
    }

    if (vazioEl) vazioEl.classList.add('d-none');
    if (tableContainer) tableContainer.classList.remove('d-none');

    pedidos.forEach(req => {
        const id = req.id != null ? req.id : '-';
        const artist = req.artist || '-';
        const title = req.title || '-';
        const status = (req.status || 'pending').toLowerCase();

        let statusBadge = '';
        if (status === 'playing') {
            statusBadge = '<span class="badge bg-success py-1 px-2"><i class="fa-solid fa-play me-1"></i> Tocando</span>';
        } else if (status === 'played') {
            statusBadge = '<span class="badge bg-secondary py-1 px-2">Tocado</span>';
        } else {
            statusBadge = '<span class="badge bg-warning text-dark py-1 px-2">Pendente</span>';
        }

        let actionsHtml = '';
        if (status === 'pending') {
            const safeArtist = String(artist).replace(/'/g, "\\'").replace(/"/g, '&quot;');
            const safeTitle = String(title).replace(/'/g, "\\'").replace(/"/g, '&quot;');
            actionsHtml = `
                <div class="d-flex align-items-center justify-content-center gap-1">
                    <button type="button" class="btn btn-outline-warning btn-sm py-0 px-2"
                            onclick="abrirModalTroca(${id}, '${safeArtist}', '${safeTitle}')"
                            title="Trocar por outra música do catálogo">
                        <i class="fa-solid fa-arrows-rotate"></i> Trocar
                    </button>
                    <button type="button" class="btn btn-outline-danger btn-sm py-0 px-2"
                            onclick="solicitarExclusao(${id}, '${safeArtist}', '${safeTitle}')"
                            title="Excluir este pedido">
                        <i class="fa-solid fa-trash"></i> Excluir
                    </button>
                </div>
            `;
        } else {
            actionsHtml = '<span class="text-muted small">-</span>';
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="text-center font-monospace text-muted fw-bold">#${id}</td>
            <td class="text-white fw-semibold">${artist}</td>
            <td class="text-info">${title}</td>
            <td class="text-center">${statusBadge}</td>
            <td class="text-center">${actionsHtml}</td>
        `;
        tbody.appendChild(tr);
    });
}

window.renderizarMeusPedidos = renderizarMeusPedidos;

// ============================================================
// EXCLUSÃO DE PEDIDO
// ============================================================

async function solicitarExclusao(requestId, artist, title) {
    const usuarioInput = document.getElementById('Username');
    const passwordInput = document.getElementById('Password');
    const usuario = usuarioInput ? usuarioInput.value.trim() : '';
    let senha = passwordInput ? passwordInput.value.trim() : '';

    const displaySong = (artist && title) ? `${artist} - ${title}` : `Pedido #${requestId}`;
    const confirmar = confirm(`Tem certeza que deseja excluir o pedido #${requestId} (${displaySong})?`);
    if (!confirmar) return;

    if (!usuario) {
        alert('Digite seu apelido no campo Apelido.');
        if (usuarioInput) usuarioInput.focus();
        return;
    }

    if (!senha) {
        senha = prompt('Digite sua senha para confirmar a exclusão do pedido:');
        if (!senha) {
            alert('A senha é obrigatória para excluir o pedido.');
            return;
        }
    }

    try {
        const response = await fetch(API_ENDPOINTS.DELETE, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify({
                request_id: parseInt(requestId, 10),
                username: usuario,
                password: senha
            })
        });

        let data = null;
        try {
            data = await response.json();
        } catch (e) {}

        if (!response.ok) {
            const errorMsg = (data && data.error) ? data.error : `Erro ao excluir pedido: HTTP ${response.status}`;
            alert(errorMsg);
            return;
        }

        alert(data.message || `Pedido #${requestId} excluído com sucesso!`);
        carregarMeusPedidos(false);

    } catch (error) {
        console.error('Erro de conexão ao excluir pedido:', error);
        alert('Não foi possível conectar ao servidor para excluir o pedido.');
    }
}

window.solicitarExclusao = solicitarExclusao;

// ============================================================
// FILA GERAL DE PEDIDOS (AO VIVO COM AUTO-ATUALIZAÇÃO)
// ============================================================

let filaGeralCountdownInterval = null;
let filaGeralSecondsLeft = 120;

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

function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function abrirModalFilaGeral() {
    const modalEl = document.getElementById('modal-fila-geral');
    if (modalEl && window.bootstrap && typeof window.bootstrap.Modal === 'function') {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
    carregarFilaGeral(true);
    iniciarTimerFilaGeral();
}

window.abrirModalFilaGeral = abrirModalFilaGeral;

function iniciarTimerFilaGeral() {
    pararTimerFilaGeral();
    filaGeralSecondsLeft = 120;
    atualizarDisplayCountdown();

    filaGeralCountdownInterval = setInterval(() => {
        filaGeralSecondsLeft--;
        if (filaGeralSecondsLeft <= 0) {
            filaGeralSecondsLeft = 120;
            carregarFilaGeral(false);
        }
        atualizarDisplayCountdown();
    }, 1000);
}

window.iniciarTimerFilaGeral = iniciarTimerFilaGeral;

function pararTimerFilaGeral() {
    if (filaGeralCountdownInterval) {
        clearInterval(filaGeralCountdownInterval);
        filaGeralCountdownInterval = null;
    }
}

window.pararTimerFilaGeral = pararTimerFilaGeral;

function atualizarDisplayCountdown() {
    const el = document.getElementById('filaGeralCountdown');
    if (!el) return;
    const mins = Math.floor(filaGeralSecondsLeft / 60);
    const secs = filaGeralSecondsLeft % 60;
    el.textContent = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

async function carregarFilaGeral(mostrarLoading = false) {
    const loadingEl = document.getElementById('filaGeralLoading');
    const tableContainer = document.getElementById('filaGeralTableContainer');
    const vazioEl = document.getElementById('filaGeralVazio');
    const iconAtualizar = document.getElementById('iconAtualizarFilaGeral');
    const btnAtualizar = document.getElementById('btnAtualizarFilaGeral');

    if (mostrarLoading && loadingEl) {
        loadingEl.classList.remove('d-none');
        if (tableContainer) tableContainer.classList.add('d-none');
        if (vazioEl) vazioEl.classList.add('d-none');
    }

    if (iconAtualizar) iconAtualizar.classList.add('fa-spin');
    if (btnAtualizar) btnAtualizar.disabled = true;

    try {
        const response = await fetch(API_ENDPOINTS.PUBLIC_QUEUE, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            }
        });

        let data = null;
        try {
            data = await response.json();
        } catch (e) {}

        console.log("Dados recebidos da fila:", data);

        if (!response.ok || data == null) {
            const errorMsg = (data && (data.error || data.detail)) || `Erro HTTP ${response.status} ao carregar a fila de pedidos.`;
            alert(errorMsg);
            renderFilaGeralTabela([]);
            return;
        }

        let requests = [];
        if (Array.isArray(data)) {
            requests = data;
        } else if (data && typeof data === 'object') {
            if (Array.isArray(data.queue)) {
                requests = data.queue;
            } else if (Array.isArray(data.requests)) {
                requests = data.requests;
            }
        }

        renderFilaGeralTabela(requests);

        // Reiniciar timer quando a atualização é disparada manualmente
        if (mostrarLoading) {
            filaGeralSecondsLeft = 120;
            atualizarDisplayCountdown();
        }

    } catch (error) {
        console.error("Erro ao carregar fila:", error);
        alert('Não foi possível conectar ao servidor para obter a fila de pedidos.');
        renderFilaGeralTabela([]);
    } finally {
        if (loadingEl) loadingEl.classList.add('d-none');
        if (iconAtualizar) iconAtualizar.classList.remove('fa-spin');
        if (btnAtualizar) btnAtualizar.disabled = false;
    }
}

window.carregarFilaGeral = carregarFilaGeral;

function renderFilaGeralTabela(requests) {
    const tbody = document.getElementById('filaGeralBody');
    const vazioEl = document.getElementById('filaGeralVazio');
    const tableContainer = document.getElementById('filaGeralTableContainer');
    const badgeCount = document.getElementById('filaGeralBadgeCount');

    if (!tbody) return;

    tbody.innerHTML = '';
    const count = Array.isArray(requests) ? requests.length : 0;
    if (badgeCount) {
        badgeCount.textContent = `${count} pedido${count === 1 ? '' : 's'}`;
    }

    if (count === 0) {
        if (tableContainer) tableContainer.classList.add('d-none');
        if (vazioEl) vazioEl.classList.remove('d-none');
        return;
    }

    if (vazioEl) vazioEl.classList.add('d-none');
    if (tableContainer) tableContainer.classList.remove('d-none');

    requests.forEach(req => {
        const tr = document.createElement('tr');
        const status = (req.status || 'pending').toLowerCase();
        let badgeHtml = '';

        if (status === 'playing') {
            tr.className = 'row-playing';
            badgeHtml = '<span class="badge bg-success py-1 px-2"><i class="fa-solid fa-play me-1"></i> Tocando</span>';
        } else if (status === 'played') {
            tr.className = 'opacity-75';
            badgeHtml = '<span class="badge bg-secondary py-1 px-2"><i class="fa-solid fa-check me-1"></i> Tocado</span>';
        } else {
            badgeHtml = '<span class="badge bg-warning text-dark py-1 px-2"><i class="fa-solid fa-hourglass-half me-1"></i> Pendente</span>';
        }

        const dateStr = formatDateTime(req.created_at);

        tr.innerHTML = `
            <td class="text-center font-monospace text-muted fw-bold">#${req.id || '-'}</td>
            <td class="fw-semibold text-info">
                <i class="fa-solid fa-user-tag me-1 text-secondary"></i>${escapeHtml(req.username || '-')}
            </td>
            <td class="fw-semibold text-white">${escapeHtml(req.artist || '-')}</td>
            <td class="text-light">${escapeHtml(req.title || '-')}</td>
            <td class="text-muted small font-monospace">${dateStr}</td>
            <td class="text-center">${badgeHtml}</td>
        `;

        tbody.appendChild(tr);
    });
}

window.renderFilaGeralTabela = renderFilaGeralTabela;

// ============================================================
// TROCA DE MÚSICA
// ============================================================

let debounceTrocaTimeout = null;

function abrirModalTroca(requestId, currentArtist, currentTitle) {
    const usuarioInput = document.getElementById('Username');
    const passwordInput = document.getElementById('Password');
    const usuario = usuarioInput ? usuarioInput.value.trim() : '';
    const senha = passwordInput ? passwordInput.value.trim() : '';

    if (!usuario) {
        alert('Digite seu apelido no campo Apelido.');
        if (usuarioInput) usuarioInput.focus();
        return;
    }
    if (!senha) {
        alert('Digite sua senha no campo Senha para poder trocar o pedido.');
        if (passwordInput) passwordInput.focus();
        return;
    }

    const idInput = document.getElementById('trocaRequestId');
    const idBadge = document.getElementById('trocaRequestIdBadge');
    const currentSongEl = document.getElementById('trocaMusicaAtualTexto');
    const selectedSongEl = document.getElementById('trocaMusicaSelecionadaTexto');
    const inputArtist = document.getElementById('input-troca-artista');
    const inputMusic = document.getElementById('input-troca-musica');

    if (idInput) idInput.value = requestId;
    if (idBadge) idBadge.textContent = `#${requestId}`;
    if (currentSongEl) currentSongEl.textContent = `${currentArtist} - ${currentTitle}`;
    if (selectedSongEl) selectedSongEl.textContent = 'Nenhuma selecionada';
    if (inputArtist) inputArtist.value = '';
    if (inputMusic) inputMusic.value = '';

    filtrarTrocaCatalogo('', '');

    const modalEl = document.getElementById('modalTrocarPedido');
    if (modalEl && window.bootstrap && typeof window.bootstrap.Modal === 'function') {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
}

window.abrirModalTroca = abrirModalTroca;

function debounceTrocaSearch() {
    clearTimeout(debounceTrocaTimeout);
    debounceTrocaTimeout = setTimeout(() => {
        const inputArtist = document.getElementById('input-troca-artista');
        const inputMusic = document.getElementById('input-troca-musica');
        const artistVal = inputArtist ? inputArtist.value.trim() : '';
        const musicVal = inputMusic ? inputMusic.value.trim() : '';

        // Sincronizar com os campos de busca principais da página
        const sa = document.getElementById('searchArtist');
        const sm = document.getElementById('searchMusic');
        if (sa) sa.value = artistVal;
        if (sm) sm.value = musicVal;

        currentSearchArtist = artistVal.toLowerCase();
        currentSearchMusic = musicVal.toLowerCase();
        currentLetter = 'all';

        // Atualizar lista principal ao fundo em tempo real
        loadBands(1, 'all');

        // Atualizar lista de opções dentro do modal
        filtrarTrocaCatalogo(artistVal, musicVal);
    }, 300);
}

window.debounceTrocaSearch = debounceTrocaSearch;

function filtrarTrocaCatalogo(filterArtist, filterMusic) {
    const select = document.getElementById('trocaSelectNovaMusica');
    const countBadge = document.getElementById('trocaResultadosCount');
    const textoSel = document.getElementById('trocaMusicaSelecionadaTexto');
    if (!select) return;

    if (filterArtist === undefined) {
        const inputArtist = document.getElementById('input-troca-artista');
        filterArtist = inputArtist ? inputArtist.value.trim() : '';
    }
    if (filterMusic === undefined) {
        const inputMusic = document.getElementById('input-troca-musica');
        filterMusic = inputMusic ? inputMusic.value.trim() : '';
    }

    const normArtist = (filterArtist || '').toLowerCase();
    const normMusic = (filterMusic || '').toLowerCase();

    select.innerHTML = '';

    const sourceBands = (typeof allBandsCatalog !== 'undefined' && allBandsCatalog && allBandsCatalog.length > 0)
        ? allBandsCatalog
        : ((Array.isArray(bands) && bands.length > 0)
            ? bands
            : ((typeof window !== 'undefined' && Array.isArray(window.bands)) ? window.bands : []));

    let matches = [];
    for (const b of sourceBands) {
        const artistName = b.artist || '';
        const normBandArtist = artistName.toLowerCase();

        if (normArtist && !normBandArtist.includes(normArtist)) {
            continue;
        }

        const bSongs = b.songs || [];
        for (const s of bSongs) {
            const titleName = s.title || '';
            const normSongTitle = titleName.toLowerCase();

            if (normMusic && !normSongTitle.includes(normMusic)) {
                continue;
            }

            matches.push({ artist: artistName, title: titleName });
            if (matches.length >= 100) break;
        }
        if (matches.length >= 100) break;
    }

    if (countBadge) {
        countBadge.textContent = `${matches.length} encontrada${matches.length === 1 ? '' : 's'}`;
    }

    if (matches.length === 0) {
        const opt = document.createElement('option');
        opt.disabled = true;
        opt.textContent = (normArtist || normMusic) ? 'Nenhuma música correspondente encontrada' : 'Carregando catálogo...';
        select.appendChild(opt);
        if (textoSel) textoSel.textContent = 'Nenhuma selecionada';
        return;
    }

    matches.forEach(item => {
        const opt = document.createElement('option');
        opt.value = JSON.stringify({ artist: item.artist, title: item.title });
        opt.textContent = `${item.artist} - ${item.title}`;
        select.appendChild(opt);
    });

    select.selectedIndex = 0;
    if (select.options && select.options[0]) {
        select.value = select.options[0].value;
        if (textoSel) textoSel.textContent = `${matches[0].artist} - ${matches[0].title}`;
    } else if (select.children && select.children[0]) {
        select.value = select.children[0].value;
        if (textoSel) textoSel.textContent = `${matches[0].artist} - ${matches[0].title}`;
    }
}

window.filtrarTrocaCatalogo = filtrarTrocaCatalogo;

function aoSelecionarMusicaTroca() {
    const select = document.getElementById('trocaSelectNovaMusica');
    const textoSel = document.getElementById('trocaMusicaSelecionadaTexto');
    if (!select) return;

    let selectedVal = select.value;
    if (!selectedVal && select.options && select.selectedIndex >= 0 && select.options[select.selectedIndex]) {
        selectedVal = select.options[select.selectedIndex].value;
    } else if (!selectedVal && select.children && select.selectedIndex >= 0 && select.children[select.selectedIndex]) {
        selectedVal = select.children[select.selectedIndex].value;
    }

    if (selectedVal) {
        try {
            const song = JSON.parse(selectedVal);
            if (song && song.artist && song.title) {
                if (textoSel) textoSel.textContent = `${song.artist} - ${song.title}`;
            }
        } catch (e) {}
    }
}

window.aoSelecionarMusicaTroca = aoSelecionarMusicaTroca;

function selecionarMusicaParaTroca(artist, title) {
    const select = document.getElementById('trocaSelectNovaMusica');
    const textoSel = document.getElementById('trocaMusicaSelecionadaTexto');
    if (textoSel) {
        textoSel.textContent = `${artist} - ${title}`;
    }

    const songVal = JSON.stringify({ artist: artist, title: title });
    if (select) {
        let found = false;
        const opts = select.options || select.children || [];
        for (let i = 0; i < opts.length; i++) {
            if (opts[i].value === songVal) {
                select.selectedIndex = i;
                select.value = songVal;
                found = true;
                break;
            }
        }
        if (!found) {
            const opt = document.createElement('option');
            opt.value = songVal;
            opt.textContent = `${artist} - ${title}`;
            select.appendChild(opt);
            select.value = songVal;
            select.selectedIndex = (select.options || select.children).length - 1;
        }
    }
}

window.selecionarMusicaParaTroca = selecionarMusicaParaTroca;

function limparFiltrosTroca() {
    const inputArtist = document.getElementById('input-troca-artista');
    const inputMusic = document.getElementById('input-troca-musica');
    const sa = document.getElementById('searchArtist');
    const sm = document.getElementById('searchMusic');

    if (inputArtist) inputArtist.value = '';
    if (inputMusic) inputMusic.value = '';
    if (sa) sa.value = '';
    if (sm) sm.value = '';

    currentSearchArtist = '';
    currentSearchMusic = '';
    currentLetter = 'all';

    loadBands(1, 'all');
}

window.limparFiltrosTroca = limparFiltrosTroca;

async function confirmarTrocaMusica() {
    const idInput = document.getElementById('trocaRequestId');
    const select = document.getElementById('trocaSelectNovaMusica');
    const usuarioInput = document.getElementById('Username');
    const passwordInput = document.getElementById('Password');
    const btnConfirmar = document.getElementById('btnConfirmarTroca');

    const requestId = idInput ? parseInt(idInput.value, 10) : null;
    const usuario = usuarioInput ? usuarioInput.value.trim() : '';
    let senha = passwordInput ? passwordInput.value.trim() : '';

    if (!requestId) {
        alert('ID do pedido não identificado.');
        return;
    }

    if (!usuario) {
        alert('Digite seu apelido no campo Apelido.');
        return;
    }

    if (!senha) {
        senha = prompt('Digite sua senha para confirmar a troca:');
        if (!senha) {
            alert('A senha é obrigatória para efetuar a troca.');
            return;
        }
    }

    let selectedVal = select ? select.value : '';
    if (!selectedVal && select && select.options && select.selectedIndex >= 0 && select.options[select.selectedIndex]) {
        selectedVal = select.options[select.selectedIndex].value;
    } else if (!selectedVal && select && select.children && select.selectedIndex >= 0 && select.children[select.selectedIndex]) {
        selectedVal = select.children[select.selectedIndex].value;
    }

    if (!selectedVal) {
        alert('Selecione uma nova música no catálogo.');
        return;
    }

    let selectedSong = null;
    try {
        selectedSong = JSON.parse(selectedVal);
    } catch (e) {
        alert('Música selecionada inválida.');
        return;
    }

    if (!selectedSong || !selectedSong.artist || !selectedSong.title) {
        alert('Música selecionada inválida.');
        return;
    }

    if (btnConfirmar) btnConfirmar.disabled = true;

    try {
        const response = await fetch(API_ENDPOINTS.CHANGE, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify({
                request_id: requestId,
                username: usuario,
                password: senha,
                new_artist: selectedSong.artist,
                new_title: selectedSong.title
            })
        });

        let data = null;
        try {
            data = await response.json();
        } catch (e) {}

        if (!response.ok) {
            const errorMsg = (data && data.error) ? data.error : `Erro ao alterar pedido: HTTP ${response.status}`;
            alert(errorMsg);
            return;
        }

        alert(data.message || `Pedido #${requestId} alterado com sucesso para ${selectedSong.artist} - ${selectedSong.title}!`);

        // Fechar modal de troca
        const modalEl = document.getElementById('modalTrocarPedido');
        if (modalEl && window.bootstrap && typeof window.bootstrap.Modal === 'function') {
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
        }

        limparFiltrosTroca();
        carregarMeusPedidos(false);

    } catch (error) {
        console.error('Erro de conexão ao alterar pedido:', error);
        alert('Não foi possível conectar ao servidor para alterar o pedido.');
    } finally {
        if (btnConfirmar) btnConfirmar.disabled = false;
    }
}

window.confirmarTrocaMusica = confirmarTrocaMusica;

// ============================================================
// EXIBIR RESULTADOS
// ============================================================

function displayResults(data) {
    bands = data.bands || [];
    totalPages = data.pagination?.total_pages || 1;
    currentPage = data.pagination?.current_page || 1;

    const container = document.getElementById('bandsContainer');
    if (!container) return;

    container.innerHTML = '';

    if (bands.length === 0) {
        container.innerHTML = '<p class="text-muted text-center py-4">Nenhum resultado encontrado.</p>';
        const pag = document.getElementById('pagination');
        if (pag) pag.innerHTML = '';
        return;
    }

    bands.forEach((band, index) => {
        const card = document.createElement('div');
        card.className = 'accordion-item';
        const collapseId = `collapse${index}`;

        card.innerHTML = `
            <h2 class="accordion-header">
                <button
                    class="accordion-button collapsed"
                    type="button"
                    data-bs-toggle="collapse"
                    data-bs-target="#${collapseId}">
                    ${band.artist}
                </button>
            </h2>

            <div
                id="${collapseId}"
                class="accordion-collapse collapse">
                <div class="accordion-body text-center">
                    <ul class="list-group list-group-flush song-list"></ul>
                </div>
            </div>
        `;

        const ul = card.querySelector('.song-list');

        if (Array.isArray(band.songs)) {
            band.songs.forEach(song => {
                const li = document.createElement('li');
                li.className = 'list-group-item d-flex justify-content-between align-items-center';

                const pedirBtn = `
                    <button class="btn btn-sm btn-success btn-pedir">
                        <i class="fas fa-music"></i> Pedir
                    </button>
                `;

                const youtubeBtn = `
                    <button class="btn btn-sm btn-danger btn-youtube">
                        <i class="fab fa-youtube"></i> YouTube
                    </button>
                `;

                li.innerHTML = `
                    <span>${song.title}</span>
                    <span class="song-buttons">
                        ${pedirBtn}
                        ${youtubeBtn}
                    </span>
                `;

                const btnPedir = li.querySelector('.btn-pedir');
                btnPedir.onclick = () => {
                    pedirMusica(band.artist, song.title);
                };

                const btnYoutube = li.querySelector('.btn-youtube');
                btnYoutube.onclick = () => {
                    const query = encodeURIComponent(`${band.artist} ${song.title}`);
                    window.open(
                        `https://www.youtube.com/results?search_query=${query}`,
                        '_blank'
                    );
                };

                ul.appendChild(li);
            });
        }

        container.appendChild(card);
    });

    renderPagination();
}

// ============================================================
// PAGINAÇÃO
// ============================================================

function renderPagination() {
    const pag = document.getElementById('pagination');
    if (!pag) return;

    pag.innerHTML = '';

    // PRIMEIRO
    const firstLi = document.createElement('li');
    firstLi.className = 'page-item' + (currentPage === 1 ? ' disabled' : '');
    firstLi.innerHTML = `<a class="page-link" href="#">Primeiro</a>`;
    firstLi.onclick = (e) => {
        e.preventDefault();
        if (currentPage > 1) loadBands(1, currentLetter);
    };
    pag.appendChild(firstLi);

    // ANTERIOR
    const prevLi = document.createElement('li');
    prevLi.className = 'page-item' + (currentPage === 1 ? ' disabled' : '');
    prevLi.innerHTML = `<a class="page-link" href="#">Anterior</a>`;
    prevLi.onclick = (e) => {
        e.preventDefault();
        if (currentPage > 1) loadBands(currentPage - 1, currentLetter);
    };
    pag.appendChild(prevLi);

    // NÚMEROS
    const maxPages = 5;
    let start = Math.max(1, currentPage - Math.floor(maxPages / 2));
    let end = Math.min(totalPages, start + maxPages - 1);
    start = Math.max(1, end - maxPages + 1);

    for (let i = start; i <= end; i++) {
        const li = document.createElement('li');
        li.className = 'page-item' + (i === currentPage ? ' active' : '');
        li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
        li.onclick = (e) => {
            e.preventDefault();
            loadBands(i, currentLetter);
        };
        pag.appendChild(li);
    }

    // PRÓXIMO
    const nextLi = document.createElement('li');
    nextLi.className = 'page-item' + (currentPage === totalPages ? ' disabled' : '');
    nextLi.innerHTML = `<a class="page-link" href="#">Próximo</a>`;
    nextLi.onclick = (e) => {
        e.preventDefault();
        if (currentPage < totalPages) loadBands(currentPage + 1, currentLetter);
    };
    pag.appendChild(nextLi);

    // ÚLTIMO
    const lastLi = document.createElement('li');
    lastLi.className = 'page-item' + (currentPage === totalPages ? ' disabled' : '');
    lastLi.innerHTML = `<a class="page-link" href="#">Último</a>`;
    lastLi.onclick = (e) => {
        e.preventDefault();
        if (currentPage < totalPages) loadBands(totalPages, currentLetter);
    };
    pag.appendChild(lastLi);
}

// ============================================================
// FILTRO POR LETRA
// ============================================================

function filterByLetter(letter) {
    currentLetter = letter;
    currentSearchArtist = '';
    currentSearchMusic = '';

    const sa = document.getElementById('searchArtist');
    const sm = document.getElementById('searchMusic');
    if (sa) sa.value = '';
    if (sm) sm.value = '';

    loadBands(1, letter);
}

window.filterByLetter = filterByLetter;

// ============================================================
// PESQUISA
// ============================================================

let debounceTimeout;

function debounceSearch() {
    clearTimeout(debounceTimeout);

    debounceTimeout = setTimeout(() => {
        const sa = document.getElementById('searchArtist');
        const sm = document.getElementById('searchMusic');
        currentSearchArtist = sa ? sa.value.toLowerCase().trim() : '';
        currentSearchMusic = sm ? sm.value.toLowerCase().trim() : '';
        currentLetter = 'all';

        loadBands(1, 'all');
    }, 300);
}

window.debounceSearch = debounceSearch;

// ============================================================
// QUANTIDADE POR PÁGINA
// ============================================================

function changeLimit() {
    const ls = document.getElementById('limitSelect');
    currentLimit = parseInt(ls?.value || '20', 10);
    loadBands(1, currentLetter);
}

window.changeLimit = changeLimit;

// ============================================================
// CARREGAR BANDS.JSON
// ============================================================

let allBandsCatalog = [];

async function loadBands(page = 1, letter = 'all') {
    showLoader();
    const container = document.getElementById('bandsContainer');

    try {
        let rawData = null;
        let successfulUrl = null;

        if (allBandsCatalog && allBandsCatalog.length > 0) {
            rawData = { bands: allBandsCatalog };
        } else {
            // Try candidate URLs in order
            for (const url of BANDS_CANDIDATE_URLS) {
                try {
                    const sep = url.includes('?') ? '&' : '?';
                    const response = await fetch(`${url}${sep}t=${Date.now()}`, {
                        headers: {
                            'ngrok-skip-browser-warning': 'true'
                        }
                    });
                    if (response.ok) {
                        const parsed = await response.json();
                        if (parsed && Array.isArray(parsed.bands)) {
                            rawData = parsed;
                            successfulUrl = url;
                            break;
                        }
                    }
                } catch (err) {
                    // Try next candidate
                }
            }
        }

        if (!rawData || !Array.isArray(rawData.bands)) {
            throw new Error('Nenhuma das fontes de bands.json pôde ser carregada.');
        }

        allBandsCatalog = rawData.bands;
        if (typeof window !== 'undefined') {
            window.allBandsCatalog = allBandsCatalog;
            window.bands = allBandsCatalog;
        }

        let filteredBands = rawData.bands || [];

        // --------------------------------------------------------
        // FILTRO POR LETRA
        // --------------------------------------------------------
        if (letter !== 'all') {
            filteredBands = filteredBands.filter(band =>
                band.artist && band.artist.toUpperCase().startsWith(letter.toUpperCase())
            );
        }

        // --------------------------------------------------------
        // PESQUISA ARTISTA
        // --------------------------------------------------------
        if (currentSearchArtist) {
            filteredBands = filteredBands.filter(band =>
                band.artist && band.artist.toLowerCase().includes(currentSearchArtist)
            );
        }

        // --------------------------------------------------------
        // PESQUISA MÚSICA
        // --------------------------------------------------------
        if (currentSearchMusic) {
            filteredBands = filteredBands.filter(band =>
                Array.isArray(band.songs) && band.songs.some(song =>
                    song.title && song.title.toLowerCase().includes(currentSearchMusic)
                )
            );
        }

        // --------------------------------------------------------
        // PAGINAÇÃO
        // --------------------------------------------------------
        const totalRecords = filteredBands.length;
        totalPages = Math.max(1, Math.ceil(totalRecords / currentLimit));
        currentPage = Math.min(page, totalPages);

        const offset = (currentPage - 1) * currentLimit;
        const pagedBands = filteredBands.slice(offset, offset + currentLimit);

        displayResults({
            bands: pagedBands,
            pagination: {
                current_page: currentPage,
                total_pages: totalPages,
                total_records: totalRecords
            }
        });

    } catch (error) {
        console.error('Erro ao carregar bands.json:', error);

        if (container) {
            if (typeof window !== 'undefined' && window.location && window.location.protocol === 'file:') {
                container.innerHTML = `
                    <div class="alert alert-warning text-start my-4" role="alert">
                        <h5 class="alert-heading"><i class="fa-solid fa-triangle-exclamation"></i> Execução em protocolo file:// detectada</h5>
                        <p class="mb-2">Os navegadores modernos bloqueiam o carregamento de arquivos JSON locais (<code>fetch</code>) quando a página HTML é aberta diretamente com duplo clique pelo gerenciador de arquivos.</p>
                        <hr>
                        <p class="mb-0"><strong>Como resolver:</strong> Abra o buscador através de um servidor web local (como a extensão <em>Live Server</em> do VS Code, <code>python3 -m http.server</code> na pasta, ou pelo GitHub Pages/FeedBack).</p>
                    </div>
                `;
            } else {
                container.innerHTML = `
                    <div class="alert alert-danger text-center my-4" role="alert">
                        <h5 class="alert-heading">Erro ao carregar o catálogo de músicas</h5>
                        <p class="mb-0">Não foi possível carregar o arquivo <code>bands.json</code>. Verifique se o FeedBack está em execução ou se o arquivo existe na pasta.</p>
                    </div>
                `;
            }
        }
    } finally {
        hideLoader();
    }
}

window.loadBands = loadBands;

// ============================================================
// INICIALIZAÇÃO
// ============================================================

function initApp() {
    loadBands();

    const modalFilaEl = document.getElementById('modal-fila-geral');
    if (modalFilaEl) {
        modalFilaEl.addEventListener('hidden.bs.modal', () => {
            pararTimerFilaGeral();
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}