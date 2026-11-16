// game.js

// Estado do Jogo
let v1 = { x: 1, y: 2 };
let v2 = { x: -1, y: 1 };
let frotaInimiga = []; // Guarda coordenadas {x, y, atingido}

// Estado da Rede (MQTT sobre WebSocket)
let mqttClient = null;
let topicoSala = null;
let conectadoNaSala = false;
const meuIdJogador = 'player_' + Math.random().toString(36).substring(2, 9);

window.onload = () => {
    desenharPlanoCartesiano();
    gerarNovaBase();
    posicionarFrotaBot();
};

function desenharPlanoCartesiano() {
    const grid = document.getElementById('cartesian-grid');
    grid.innerHTML = '';

    for (let y = 5; y >= -5; y--) {
        for (let x = -5; x <= 5; x++) {
            const cell = document.createElement('div');
            cell.id = `cell_${x}_${y}`;
            
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

function gerarNovaBase() {
    const basesLI = [
        { v1: { x: 1, y: 0 }, v2: { x: 0, y: 1 } },
        { v1: { x: 1, y: 1 }, v2: { x: 1, y: -1 } },
        { v1: { x: 2, y: 1 }, v2: { x: -1, y: 1 } },
        { v1: { x: 1, y: 2 }, v2: { x: 2, y: 1 } }
    ];

    const escolhida = basesLI[Math.floor(Math.random() * basesLI.length)];
    v1 = escolhida.v1;
    v2 = escolhida.v2;

    document.getElementById('display-v1').innerText = `(${v1.x}, ${v1.y})`;
    document.getElementById('display-v2').innerText = `(${v2.x}, ${v2.y})`;
    logar(`Nova base definida: v1=(${v1.x},${v1.y}) e v2=(${v2.x},${v2.y})`, 'text-blue-400');
}

function posicionarFrotaBot() {
    frotaInimiga = [];
    const pivo1 = { x: -2, y: 3 };
    frotaInimiga.push({ x: pivo1.x, y: pivo1.y, atingido: false });
    frotaInimiga.push({ x: pivo1.x + 1, y: pivo1.y, atingido: false });
    frotaInimiga.push({ x: pivo1.x + 2, y: pivo1.y, atingido: false });

    const pivo2 = { x: 2, y: 1 };
    const parte2 = MathEngine.rotacionar90Graus({ x: 1, y: 0 });
    frotaInimiga.push({ x: pivo2.x, y: pivo2.y, atingido: false });
    frotaInimiga.push({ x: pivo2.x + parte2.x, y: pivo2.y + parte2.y, atingido: false });
}

function disparar() {
    const a1 = parseFloat(document.getElementById('input-a1').value) || 0;
    const a2 = parseFloat(document.getElementById('input-a2').value) || 0;

    const alvo = MathEngine.combinacaoLinear(a1, v1, a2, v2);
    logar(`Calculado: ${a1}(${v1.x},${v1.y}) + ${a2}(${v2.x},${v2.y}) = (${alvo.x}, ${alvo.y})`, 'text-yellow-300');

    if (alvo.x < -5 || alvo.x > 5 || alvo.y < -5 || alvo.y > 5) {
        logar(`ERRO: O vetor (${alvo.x}, ${alvo.y}) caiu fora do radar [-5, 5]!`, 'text-red-400');
        return;
    }

    if (conectadoNaSala && mqttClient) {
        enviarMensagemRede({ tipo: 'TIRO', vetor: alvo });
        logar(`Vetor (${alvo.x}, ${alvo.y}) enviado para a sala...`, 'text-gray-300');
    } else {
        processarImpactoLocal(alvo);
    }
}

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

        const alvosRestantes = frotaInimiga.filter(n => !n.atingido);
        if (alvosRestantes.length > 0) {
            const dicaRadar = MathEngine.calcularAnguloRadar(alvo, alvosRestantes[0]);
            logar(dicaRadar, 'text-purple-300');
        }
    }
}

// --- Conexão Multiplayer via WebSocket (EMQX Broker Público) ---
function entrarNaSala() {
    const codigo = document.getElementById('room-code').value.trim().toLowerCase();
    if (!codigo) {
        logar('Digite um nome ou código para a sala!', 'text-red-400');
        return;
    }

    if (mqttClient) {
        mqttClient.end();
    }

    topicoSala = `fislipe/batalha_linear/${codigo}`;
    logar(`Conectando à sala "${codigo}" via WebSocket...`, 'text-yellow-400');

    // Conecta via WSS (porta 8084/443) que atravessa qualquer firewall
    mqttClient = mqtt.connect('wss://broker.emqx.io:8084/mqtt');

    mqttClient.on('connect', () => {
        mqttClient.subscribe(topicoSala, (err) => {
            if (!err) {
                conectadoNaSala = true;
                document.getElementById('status-conexao').innerText = `Status: Na sala "${codigo}" (Online)`;
                document.getElementById('status-conexao').classList.replace('text-gray-400', 'text-[#43b581]');
                logar(`Conectado com sucesso na sala "${codigo}"!`, 'text-[#43b581]');
                enviarMensagemRede({ tipo: 'ENTROU' });
            }
        });
    });

    mqttClient.on('message', (topic, message) => {
        const dados = JSON.parse(message.toString());
        
        // Ignora as próprias mensagens ecoadas pelo broker
        if (dados.remetente === meuIdJogador) return;

        if (dados.tipo === 'ENTROU') {
            logar('Adversário entrou na sala! Vocês já podem disparar.', 'text-[#43b581] font-bold');
        } else if (dados.tipo === 'TIRO') {
            const navioAtingido = frotaInimiga.find(n => n.x === dados.vetor.x && n.y === dados.vetor.y);
            let hit = false;
            let dica = '';

            if (navioAtingido) {
                navioAtingido.atingido = true;
                hit = true;
            } else {
                const alvosRestantes = frotaInimiga.filter(n => !n.atingido);
                if (alvosRestantes.length > 0) {
                    dica = MathEngine.calcularAnguloRadar(dados.vetor, alvosRestantes[0]);
                }
            }

            enviarMensagemRede({ tipo: 'RESULTADO', vetor: dados.vetor, hit: hit, dica: dica });
            logar(`Inimigo atirou em (${dados.vetor.x}, ${dados.vetor.y}) -> ${hit ? 'ACERTOU!' : 'Errou'}`, 'text-orange-400');

            if (frotaInimiga.every(n => n.atingido)) {
                logar('DERROTA! O adversário afundou toda a sua frota!', 'text-red-500 font-bold text-sm');
            }
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

    mqttClient.on('error', (err) => {
        logar(`Erro na conexão WebSocket: ${err.message}`, 'text-red-400');
    });
}

function enviarMensagemRede(payload) {
    if (!mqttClient || !topicoSala) return;
    payload.remetente = meuIdJogador;
    mqttClient.publish(topicoSala, JSON.stringify(payload));
}

function logar(mensagem, classeCor = 'text-gray-300') {
    const logBox = document.getElementById('combat-log');
    const p = document.createElement('p');
    p.className = `mb-1 ${classeCor}`;
    p.innerText = `> ${mensagem}`;
    logBox.appendChild(p);
    logBox.scrollTop = logBox.scrollHeight;
}