// ============================================================
// CONFIGURAÇÃO DA API (NGROK / FASTAPI)
// ============================================================
// Altere esta URL sempre que o túnel do ngrok for reiniciado ou modificado:
const API_BASE_URL = 'https://nonnihilistic-lita-unpanniered.ngrok-free.dev';

// Endpoints da API construídos dinamicamente a partir do endereço base:
const API_ENDPOINTS = {
    REQUEST: `${API_BASE_URL}/api/plugins/music_requests/request`,
    REQUESTS: `${API_BASE_URL}/api/plugins/music_requests/requests`,
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
    const usuarioInput = document.getElementById('Username');
    const textoInput = document.getElementById('texto');
    const usuario = usuarioInput ? usuarioInput.value.trim() : '';

    if (textoInput) {
        textoInput.value = `!pedir ${artist} - ${title}`;
    }

    if (!usuario) {
        showToast('Digite seu apelido primeiro.');
        if (usuarioInput) usuarioInput.focus();
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
            const errorMsg = (data && data.error) ? ` (${data.error})` : '';
            showToast(
                `Erro ao enviar pedido: servidor retornou HTTP ${response.status}${errorMsg}.`
            );
            return;
        }

        if (!data || !data.ok) {
            showToast(
                (data && data.error) ||
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

    const comando = comandoInput ? comandoInput.value.trim() : '';
    const usuario = usuarioInput ? usuarioInput.value.trim() : '';

    if (!usuario) {
        showToast('Digite seu apelido primeiro.');
        if (usuarioInput) usuarioInput.focus();
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

async function loadBands(page = 1, letter = 'all') {
    showLoader();
    const container = document.getElementById('bandsContainer');

    try {
        let rawData = null;
        let successfulUrl = null;

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

        if (!rawData) {
            throw new Error('Nenhuma das fontes de bands.json pôde ser carregada.');
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
            if (window.location.protocol === 'file:') {
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

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => loadBands());
} else {
    loadBands();
}