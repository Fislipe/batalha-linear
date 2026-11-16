// game.js

// Estado do Jogo
let v1 = { x: 1, y: 2 };
let v2 = { x: -1, y: 1 };
let frotaInimiga = []; // Guarda coordenadas {x, y, atingido}
let peer = null;
let conn = null;

// Inicialização ao carregar a página
window.onload = () => {
    desenharPlanoCartesiano();
    gerarNovaBase();
    posicionarFrotaBot();
    iniciarPeerJS();
};

// Desenha o Grid de -5 a +5 (Y de cima para baixo, X da esquerda para direita)
function desenharPlanoCartesiano() {
    const grid = document.getElementById('cartesian-grid');
    grid.innerHTML = '';

    for (let y = 5; y >= -5; y--) {
        for (let x = -5; x <= 5; x++) {
            const cell = document.createElement('div');
            cell.id = `cell_${x}_${y}`;
            
            // Destaca os eixos principais (x=0 ou y=0)
            let borderClass = 'border border-gray-800';
            if (x === 0 || y === 0) {
                borderClass = 'border border-gray-600 bg-[#292b2f]';
            }

            cell.className = `w-10 h-10 flex items-center justify-center text-[10px] font-mono text-gray-500 rounded-sm transition-colors ${borderClass}`;
            cell.innerText = `${x},${y}`;
            grid.appendChild(cell);
        }
    }
}

// Gera bases LI (Linearmente Independentes) para o jogador calcular
function gerarNovaBase() {
    const basesLI = [
        { v1: { x: 1, y: 0 }, v2: { x: 0, y: 1 } },   // Base Canônica
        { v1: { x: 1, y: 1 }, v2: { x: 1, y: -1 } },  // Base Diagonal
        { v1: { x: 2, y: 1 }, v2: { x: -1, y: 1 } },  // Base Oblíqua
        { v1: { x: 1, y: 2 }, v2: { x: 2, y: 1 } }    // Base Simétrica
    ];

    const escolhida = basesLI[Math.floor(Math.random() * basesLI.length)];
    v1 = escolhida.v1;
    v2 = escolhida.v2;

    document.getElementById('display-v1').innerText = `(${v1.x}, ${v1.y})`;
    document.getElementById('display-v2').innerText = `(${v2.x}, ${v2.y})`;
    logar(`Nova base definida: v1=(${v1.x},${v1.y}) e v2=(${v2.x},${v2.y})`, 'text-blue-400');
}

// Posiciona navios ocultos no modo Solo usando Transformação Linear
function posicionarFrotaBot() {
    frotaInimiga = [];
    // Navio 1 (Tamanho 3)
    const pivo1 = { x: -2, y: 3 };
    frotaInimiga.push({ x: pivo1.x, y: pivo1.y, atingido: false });
    frotaInimiga.push({ x: pivo1.x + 1, y: pivo1.y, atingido: false });
    frotaInimiga.push({ x: pivo1.x + 2, y: pivo1.y, atingido: false });

    // Navio 2 (Tamanho 2) - Rotacionado 90 graus via Transformação Linear!
    const pivo2 = { x: 2, y: 1 };
    const parte2 = MathEngine.rotacionar90Graus({ x: 1, y: 0 }); // Vira (0, 1)
    frotaInimiga.push({ x: pivo2.x, y: pivo2.y, atingido: false });
    frotaInimiga.push({ x: pivo2.x + parte2.x, y: pivo2.y + parte2.y, atingido: false });
}

// Executa o tiro calculando a Combinação Linear
function disparar() {
    const a1 = parseFloat(document.getElementById('input-a1').value) || 0;
    const a2 = parseFloat(document.getElementById('input-a2').value) || 0;

    // Aplica a matemática
    const alvo = MathEngine.combinacaoLinear(a1, v1, a2, v2);
    logar(`Calculado: ${a1}(${v1.x},${v1.y}) + ${a2}(${v2.x},${v2.y}) = (${alvo.x}, ${alvo.y})`, 'text-yellow-300');

    // Verifica se saiu do plano [-5, 5]
    if (alvo.x < -5 || alvo.x > 5 || alvo.y < -5 || alvo.y > 5) {
        logar(`ERRO: O vetor (${alvo.x}, ${alvo.y}) caiu fora do radar [-5, 5]!`, 'text-red-400');
        return;
    }

    // Se estiver conectado via PeerJS, envia o vetor para o amigo
    if (conn && conn.open) {
        conn.send({ tipo: 'TIRO', vetor: alvo });
        logar(`Vetor (${alvo.x}, ${alvo.y}) enviado ao adversário...`, 'text-gray-300');
    } else {
        // Modo Solo contra o Bot
        processarImpactoLocal(alvo);
    }
}

// Verifica acerto ou calcula o ângulo do radar no Modo Solo
function processarImpactoLocal(alvo) {
    const celula = document.getElementById(`cell_${alvo.x}_${alvo.y}`);
    const navioAtingido = frotaInimiga.find(n => n.x === alvo.x && n.y === alvo.y);

    if (navioAtingido) {
        navioAtingido.atingido = true;
        celula.className = 'w-10 h-10 flex items-center justify-center text-xs font-bold text-white bg-[#f04747] rounded-sm shadow-lg';
        celula.innerText = '💥';
        logar(`IMPACTO DIRETO em (${alvo.x}, ${alvo.y})!`, 'text-[#43b581] font-bold');

        if (frotaInimiga.every(n => n.atingido)) {
            logar(`VITÓRIA! Toda a frota inimiga foi destruída!`, 'text-[#43b581] font-bold text-sm');
        }
    } else {
        celula.className = 'w-10 h-10 flex items-center justify-center text-[10px] font-mono text-blue-200 bg-blue-500/30 border border-blue-400 rounded-sm';
        logar(`Água em (${alvo.x}, ${alvo.y}).`, 'text-blue-300');

        // Aciona o Radar de Produto Escalar para dar a dica de ângulo
        const alvosRestantes = frotaInimiga.filter(n => !n.atingido);
        if (alvosRestantes.length > 0) {
            const dicaRadar = MathEngine.calcularAnguloRadar(alvo, alvosRestantes[0]);
            logar(dicaRadar, 'text-purple-300');
        }
    }
}

// --- Configuração Multiplayer P2P (PeerJS) ---
function iniciarPeerJS() {
    peer = new Peer();
    peer.on('open', (id) => {
        document.getElementById('my-peer-id').innerText = id;
    });

    peer.on('connection', (conexaoRecebida) => {
        conn = conexaoRecebida;
        configurarEventosConexao();
    });
}

function conectarAdversario() {
    const enemyId = document.getElementById('enemy-peer-id').value.trim();
    if (!enemyId) return;
    conn = peer.connect(enemyId);
    configurarEventosConexao();
}

function configurarEventosConexao() {
    conn.on('open', () => {
        document.getElementById('status-conexao').innerText = 'Status: Conectado via P2P!';
        document.getElementById('status-conexao').classList.replace('text-gray-400', 'text-[#43b581]');
        logar('Oponente conectado! Os tiros agora são enviados pela rede.', 'text-[#43b581]');
    });

    conn.on('data', (dados) => {
        if (dados.tipo === 'TIRO') {
            // Verifica na sua frota e devolve o resultado
            const hit = frotaInimiga.some(n => n.x === dados.vetor.x && n.y === dados.vetor.y);
            let dica = '';
            if (!hit) {
                dica = MathEngine.calcularAnguloRadar(dados.vetor, frotaInimiga[0]);
            }
            conn.send({ tipo: 'RESULTADO', vetor: dados.vetor, hit: hit, dica: dica });
            logar(`Inimigo atirou em (${dados.vetor.x}, ${dados.vetor.y}) -> ${hit ? 'ACERTOU!' : 'Errou'}`, 'text-orange-400');
        } else if (dados.tipo === 'RESULTADO') {
            const celula = document.getElementById(`cell_${dados.vetor.x}_${dados.vetor.y}`);
            if (dados.hit) {
                celula.className = 'w-10 h-10 flex items-center justify-center text-xs font-bold text-white bg-[#f04747] rounded-sm';
                celula.innerText = '💥';
                logar(`ACERTOU o inimigo em (${dados.vetor.x}, ${dados.vetor.y})!`, 'text-[#43b581] font-bold');
            } else {
                celula.className = 'w-10 h-10 flex items-center justify-center text-[10px] font-mono text-blue-200 bg-blue-500/30 border border-blue-400 rounded-sm';
                logar(`Água em (${dados.vetor.x}, ${dados.vetor.y}). ${dados.dica}`, 'text-purple-300');
            }
        }
    });
}

function logar(mensagem, classeCor = 'text-gray-300') {
    const logBox = document.getElementById('combat-log');
    const p = document.createElement('p');
    p.className = `mb-1 ${classeCor}`;
    p.innerText = `> ${mensagem}`;
    logBox.appendChild(p);
    logBox.scrollTop = logBox.scrollHeight;
}