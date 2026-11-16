// game.js

let v1 = { x: 1, y: 0 };
let v2 = { x: 0, y: 1 };
let minhaFrota = [];
let frotaBot = [];
let jogoEncerrado = false;

// Estado da Rede (MQTT sobre WebSocket)
let mqttClient = null;
let topicoSala = null;
let conectadoNaSala = false;
const meuIdJogador = 'player_' + Math.random().toString(36).substring(2, 9);

window.onload = () => {
    iniciarTabuleiros();
};

function iniciarTabuleiros() {
    jogoEncerrado = false;
    document.getElementById('game-over-banner').classList.add('hidden');
    document.getElementById('btn-disparar').disabled = false;
    document.getElementById('btn-disparar').classList.remove('opacity-50', 'cursor-not-allowed');

    // Limpa os dois grids
    desenharPlanoCartesiano('attack-grid', 'atk');
    desenharPlanoCartesiano('defense-grid', 'def');
    
    gerarNovaBase();

    const qtdNavios = parseInt(document.getElementById('ship-count').value) || 2;
    
    // Gera apenas a SUA frota e desenha no tabuleiro de defesa (direita)
    minhaFrota = gerarFrotaAleatoria(qtdNavios);
    renderizarMinhaFrota();

    // Gera a frota do Bot (modo solo) SEM desenhar no tabuleiro de ataque (fica oculta)
    frotaBot = gerarFrotaAleatoria(qtdNavios);
    
    logar(`Partida pronta com ${qtdNavios} navio(s) de cada lado.`, 'text-gray-300');
}

function desenharPlanoCartesiano(elementId, prefixo) {
    const grid = document.getElementById(elementId);
    grid.innerHTML = '';

    for (let y = 5; y >= -5; y--) {
        for (let x = -5; x <= 5; x++) {
            const cell = document.createElement('div');
            cell.id = `${prefixo}_${x}_${y}`;
            
            let borderClass = 'border border-gray-800';
            if (x === 0 || y === 0) {
                borderClass = 'border border-gray-600 bg-[#292b2f]';
            }

            cell.className = `w-8 h-8 flex items-center justify-center text-[9px] font-mono text-gray-500 rounded-sm ${borderClass}`;
            cell.innerText = `${x},${y}`;
            grid.appendChild(cell);
        }
    }
}

// Gera N navios (tamanhos variados entre 2 e 3) sem sobreposição usando Transformação Linear
function gerarFrotaAleatoria(quantidade) {
    const frota = [];
    // Catálogo de tamanhos para até 5 navios
    const tamanhos = [3, 2, 3, 2, 2];

    for (let i = 0; i < quantidade; i++) {
        const tam = tamanhos[i % tamanhos.length];
        let colocado = false;
        let tentativas = 0;

        while (!colocado && tentativas < 100) {
            tentativas++;
            // Vetor direção base: horizontal (1, 0)
            let dir = { x: 1, y: 0 };
            // 50% de chance de aplicar a Transformação Linear de rotação 90° -> (0, 1)
            if (Math.random() > 0.5) {
                dir = MathEngine.rotacionar90Graus(dir);
            }

            const startX = Math.floor(Math.random() * 11) - 5; // -5 a 5
            const startY = Math.floor(Math.random() * 11) - 5; // -5 a 5

            const novasPartes = [];
            let valido = true;

            for (let k = 0; k < tam; k++) {
                const px = startX + (dir.x * k);
                const py = startY + (dir.y * k);

                // Verifica se saiu do plano [-5, 5] ou bateu em outro navio
                if (px < -5 || px > 5 || py < -5 || py > 5 || frota.some(n => n.x === px && n.y === py)) {
                    valido = false;
                    break;
                }
                novasPartes.push({ x: px, y: py, atingido: false });
            }

            if (valido) {
                frota.push(...novasPartes);
                colocado = true;
            }
        }
    }

    return frota;
}

// Desenha APENAS os seus navios no seu tabuleiro de defesa
function renderizarMinhaFrota() {
    minhaFrota.forEach(parte => {
        const celula = document.getElementById(`def_${parte.x}_${parte.y}`);
        if (celula) {
            celula.className = 'w-8 h-8 flex items-center justify-center text-[10px] font-bold text-gray-900 bg-[#43b581] rounded-sm shadow';
            celula.innerText = '🚢';
        }
    });
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
    logar(`Base atual: v1=(${v1.x},${v1.y}), v2=(${v2.x},${v2.y})`, 'text-blue-400');
}

function disparar() {
    if (jogoEncerrado) return;

    const a1 = parseFloat(document.getElementById('input-a1').value) || 0;
    const a2 = parseFloat(document.getElementById('input-a2').value) || 0;

    const alvo = MathEngine.combinacaoLinear(a1, v1, a2, v2);
    logar(`Tiro: ${a1}(${v1.x},${v1.y}) + ${a2}(${v2.x},${v2.y}) = (${alvo.x}, ${alvo.y})`, 'text-yellow-300');

    if (alvo.x < -5 || alvo.x > 5 || alvo.y < -5 || alvo.y > 5) {
        logar(`ERRO: (${alvo.x}, ${alvo.y}) caiu fora do radar [-5, 5]!`, 'text-red-400');
        return;
    }

    if (conectadoNaSala && mqttClient) {
        enviarMensagemRede({ tipo: 'TIRO', vetor: alvo });
        logar(`Vetor (${alvo.x}, ${alvo.y}) disparado contra o adversário...`, 'text-gray-300');
    } else {
        processarImpactoSolo(alvo);
    }
}

function processarImpactoSolo(alvo) {
    const celula = document.getElementById(`atk_${alvo.x}_${alvo.y}`);
    const navioAtingido = frotaBot.find(n => n.x === alvo.x && n.y === alvo.y);

    if (navioAtingido) {
        navioAtingido.atingido = true;
        celula.className = 'w-8 h-8 flex items-center justify-center text-xs font-bold text-white bg-[#f04747] rounded-sm';
        celula.innerText = '💥';
        logar(`IMPACTO DIRETO em (${alvo.x}, ${alvo.y})!`, 'text-[#43b581] font-bold');

        if (frotaBot.every(n => n.atingido)) {
            finalizarJogo(true, 'VITÓRIA! Você destruiu toda a frota do Bot!');
        }
    } else {
        celula.className = 'w-8 h-8 flex items-center justify-center text-[9px] font-mono text-blue-200 bg-blue-500/30 border border-blue-400 rounded-sm';
        logar(`Água em (${alvo.x}, ${alvo.y}).`, 'text-blue-300');

        const alvosRestantes = frotaBot.filter(n => !n.atingido);
        if (alvosRestantes.length > 0) {
            logar(MathEngine.calcularAnguloRadar(alvo, alvosRestantes[0]), 'text-purple-300');
        }
    }
}

function finalizarJogo(venceu, mensagem) {
    jogoEncerrado = true;
    const banner = document.getElementById('game-over-banner');
    const texto = document.getElementById('game-over-text');
    const btn = document.getElementById('btn-disparar');

    btn.disabled = true;
    btn.classList.add('opacity-50', 'cursor-not-allowed');

    banner.classList.remove('hidden', 'bg-green-900/80', 'border-green-500', 'text-green-200', 'bg-red-900/80', 'border-red-500', 'text-red-200');
    
    if (venceu) {
        banner.classList.add('bg-green-900/80', 'border-green-500', 'text-green-200');
    } else {
        banner.classList.add('bg-red-900/80', 'border-red-500', 'text-red-200');
    }

    texto.innerText = mensagem;
    logar(mensagem, venceu ? 'text-[#43b581] font-bold' : 'text-red-400 font-bold');
}

function reiniciarPartida() {
    const qtd = document.getElementById('ship-count').value;
    iniciarTabuleiros();
    if (conectadoNaSala && mqttClient) {
        enviarMensagemRede({ tipo: 'REINICIAR', qtdNavios: qtd });
    }
}

// --- Conexão Multiplayer via WebSocket ---
function entrarNaSala() {
    const codigo = document.getElementById('room-code').value.trim().toLowerCase();
    if (!codigo) {
        logar('Digite um nome para a sala!', 'text-red-400');
        return;
    }

    if (mqttClient) mqttClient.end();

    topicoSala = `fislipe/batalha_linear/${codigo}`;
    logar(`Conectando à sala "${codigo}"...`, 'text-yellow-400');

    mqttClient = mqtt.connect('wss://broker.emqx.io:8084/mqtt');

    mqttClient.on('connect', () => {
        mqttClient.subscribe(topicoSala, (err) => {
            if (!err) {
                conectadoNaSala = true;
                document.getElementById('status-conexao').innerText = `Status: Sala "${codigo}" (Online)`;
                document.getElementById('status-conexao').classList.replace('text-gray-400', 'text-[#43b581]');
                logar(`Conectado na sala "${codigo}"!`, 'text-[#43b581]');
                enviarMensagemRede({ tipo: 'ENTROU' });
            }
        });
    });

    mqttClient.on('message', (topic, message) => {
        const dados = JSON.parse(message.toString());
        if (dados.remetente === meuIdJogador) return;

        if (dados.tipo === 'ENTROU') {
            logar('Adversário entrou na sala! Podem disparar.', 'text-[#43b581] font-bold');
        } else if (dados.tipo === 'REINICIAR') {
            if (dados.qtdNavios) {
                document.getElementById('ship-count').value = dados.qtdNavios;
            }
            iniciarTabuleiros();
            logar(`Adversário definiu nova partida com ${dados.qtdNavios} navio(s)!`, 'text-yellow-400');
        } else if (dados.tipo === 'TIRO') {
            const navioAtingido = minhaFrota.find(n => n.x === dados.vetor.x && n.y === dados.vetor.y);
            const celulaDefesa = document.getElementById(`def_${dados.vetor.x}_${dados.vetor.y}`);
            let hit = false;
            let dica = '';
            let frotaDestruida = false;

            if (navioAtingido) {
                navioAtingido.atingido = true;
                hit = true;
                if (celulaDefesa) {
                    celulaDefesa.className = 'w-8 h-8 flex items-center justify-center text-xs font-bold text-white bg-[#f04747] rounded-sm';
                    celulaDefesa.innerText = '💥';
                }
                frotaDestruida = minhaFrota.every(n => n.atingido);
            } else {
                if (celulaDefesa) {
                    celulaDefesa.className = 'w-8 h-8 flex items-center justify-center text-[9px] font-mono text-blue-200 bg-blue-500/30 border border-blue-400 rounded-sm';
                }
                const alvosRestantes = minhaFrota.filter(n => !n.atingido);
                if (alvosRestantes.length > 0) {
                    dica = MathEngine.calcularAnguloRadar(dados.vetor, alvosRestantes[0]);
                }
            }

            enviarMensagemRede({ 
                tipo: 'RESULTADO', 
                vetor: dados.vetor, 
                hit: hit, 
                dica: dica,
                vitoria: frotaDestruida 
            });

            logar(`Inimigo atirou em (${dados.vetor.x}, ${dados.vetor.y}) -> ${hit ? 'ATINGIU SEU NAVIO!' : 'Água'}`, hit ? 'text-red-400 font-bold' : 'text-gray-400');

            if (frotaDestruida) {
                finalizarJogo(false, 'DERROTA! O adversário afundou toda a sua frota!');
            }

        } else if (dados.tipo === 'RESULTADO') {
            const celulaAtaque = document.getElementById(`atk_${dados.vetor.x}_${dados.vetor.y}`);
            if (dados.hit) {
                celulaAtaque.className = 'w-8 h-8 flex items-center justify-center text-xs font-bold text-white bg-[#f04747] rounded-sm';
                celulaAtaque.innerText = '💥';
                logar(`ACERTOU o inimigo em (${dados.vetor.x}, ${dados.vetor.y})!`, 'text-[#43b581] font-bold');

                if (dados.vitoria) {
                    finalizarJogo(true, 'VITÓRIA! Você afundou toda a frota do adversário!');
                }
            } else {
                celulaAtaque.className = 'w-8 h-8 flex items-center justify-center text-[9px] font-mono text-blue-200 bg-blue-500/30 border border-blue-400 rounded-sm';
                logar(`Água em (${dados.vetor.x}, ${dados.vetor.y}). ${dados.dica}`, 'text-purple-300');
            }
        }
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