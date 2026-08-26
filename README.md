🎵 FeedBack Plugin: music_requests
Sistema de solicitação de músicas em tempo real para o FeedBack Desktop. Conecta o público ao operador da pista através de uma interface web responsiva (hospedada no GitHub Pages ou servidor local) comunicando-se de forma segura via túnel ngrok com o backend FastAPI do FeedBack.

🚀 Funcionalidades
🎧 Painel do Operador (FeedBack Desktop UI v3)
Menu Integrado: Aba dedicada "Pedidos" integrada diretamente à barra lateral do FeedBack.

Fila em Tempo Real: Acompanhamento dinâmico dos status (Pendente ➔ Tocando ➔ Tocado).

Reprodução Integrada: Botão ▶ Play nativo que despacha a faixa para a fila de reprodução (window.playSong).

Controle de Limite por Usuário: Input ajustável no painel para limitar a quantidade de músicas pendentes por pessoa (ex: 5 pedidos por usuário ou 0 para ilimitado).

Moderação da Fila:

Exclusão individual de pedidos da lista.

Botão de Limpeza Geral da fila com confirmação de segurança.

📱 Frontend do Público (Web / Buscador de Músicas)
Busca Rápida no Catálogo: Pesquisa instantânea por Artista/Banda ou Título da Música com paginação e índice alfabético (A–Z).

Autenticação Segura: Cadastro e login por Apelido e Senha criptografados (PBKDF2-HMAC-SHA256). Nenhuma senha é salva em texto puro ou no localStorage.

Área "Meus Pedidos":

Consulta autenticada dos pedidos feitos pelo usuário.

Troca de Música: Modal dedicado com busca dupla integrada para substituir uma música pendente.

Cancelamento: Permite ao usuário excluir seu próprio pedido pendente.

Fila Geral ao Vivo: Modal público com visualização da ordem de pedidos e atualização automática a cada 2 minutos (com botão de refresh manual).

🏗️ Arquitetura do Sistema
┌─────────────────────────────────────────────────────────────┐
│             FRONTEND WEB (Público / GitHub Pages)           │
│  • Catálogo de músicas (lista/bands.json)                   │
│  • Pedidos, Trocas e Cancelamentos                          │
│  • Visualização da Fila Geral (Auto-refresh 2 min)          │
└──────────────────────────────┬──────────────────────────────┘
                               │ Requisições HTTPS + Header ngrok
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      TÚNEL NGROK                            │
│  • Redireciona tráfego web seguro para a porta local        │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│             BACKEND FASTAPI (FeedBack Desktop)              │
│  • routes.py: Endpoints REST, Locks e Criptografia          │
│  • requests.json: Fila com controle de concorrência         │
│  • users.json: Credenciais com Hash + Salt                  │
│  • config.json: Parâmetros e limites configurados           │
└──────────────────────────────┬──────────────────────────────┘
                               │ Controle de Reprodução
                               ▼
┌─────────────────────────────────────────────────────────────┐
│             PAINEL DO OPERADOR (Desktop UI v3)              │
│  • Gestão de fila, Limites, Exclusão e Play direto          │
└─────────────────────────────────────────────────────────────┘
⚙️ Configuração e Instalação
1. Pré-requisitos
FeedBack Desktop instalado e configurado.

Conta gratuita criada no ngrok.com.

ngrok instalado no sistema.

2. Configurando o ngrok
Autentique o seu token do ngrok no terminal:

Bash
ngrok config add-authtoken SEU_AUTHTOKEN_AQUI
Inicie o túnel apontando para a porta onde o backend do FeedBack está rodando (porta padrão: 8000 ou a configurada no app):

Bash
ngrok http 18000
O ngrok gerará uma URL pública HTTPS semelhante a:

Plaintext
https://abc1-23-45-67-89.ngrok-free.app
⚠️ Atenção: Guarde essa URL para configurar o frontend web.

3. Configurando o Frontend Web (lista/buscador-musicas/)
Abra o arquivo de configuração da interface web (ex: config.js ou o topo de app.js).

Atualize a variável com a sua URL do ngrok:

JavaScript
const API_BASE_URL = "https://abc1-23-45-67-89.ngrok-free.app";
Importante para requisições via ngrok:

Certifique-se de que as chamadas fetch enviem o header para ignorar a tela de aviso de conexão gratuita:

JavaScript
headers: {
  "Content-Type": "application/json",
  "ngrok-skip-browser-warning": "true"
}
📡 Endpoints da API
Método	Rota	Descrição
POST	/api/plugins/music_requests/request	Cria um novo pedido com verificação de credenciais e limite.
POST	/api/plugins/music_requests/my-requests	Retorna o histórico de pedidos do usuário autenticado.
POST	/api/plugins/music_requests/change	Substitui uma música pendente por outra do catálogo.
POST	/api/plugins/music_requests/delete	Exclui um pedido pendente do usuário.
GET	/api/plugins/music_requests/public-queue	Lista pública da fila com dados essenciais (sem dados sensíveis).
GET	/api/plugins/music_requests/config	Consulta o limite configurado de pedidos por usuário.
POST	/api/plugins/music_requests/config	Altera o limite máximo de pedidos permitidos.
POST	/api/plugins/music_requests/clear	Limpa todos os pedidos da fila (Ação do Operador).
POST	/api/plugins/music_requests/play/{id}	Inicia a reprodução e altera status para playing/played.
🛡️ Políticas de Segurança
Zero Plaintext Passwords: Todas as senhas utilizam salt individual e PBKDF2 com 100.000 iterações.

Thread Safety: Todas as leituras e gravações nos arquivos requests.json, users.json e config.json são protegidas por threading.RLock().

Integridade de Fila: Usuários só podem alterar ou cancelar pedidos próprios e enquanto o status estiver como pending. Pedidos que já estão em reprodução ou foram concluídos ficam bloqueados contra edição.

📄 Licença
Distribuído sob a licença MIT. Consulte LICENSE para obter mais informações.
