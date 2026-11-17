// math_engine.js

const MathEngine = {
    // 1. Combinação Linear: v = a1*v1 + a2*v2
    combinacaoLinear(a1, v1, a2, v2) {
        return {
            x: Math.round(a1 * v1.x + a2 * v2.x),
            y: Math.round(a1 * v1.y + a2 * v2.y)
        };
    },

    // 2. Produto Escalar: u . v
    produtoEscalar(u, v) {
        return (u.x * v.x) + (u.y * v.y);
    },

    // 3. Módulo de um vetor: |v|
    modulo(v) {
        return Math.sqrt((v.x * v.x) + (v.y * v.y));
    },

    // 4. Radar: direção do tiro até a parte de navio inimigo mais próxima
    calcularAnguloRadar(tiro, alvosRestantes) {
        if (alvosRestantes.length === 0) {
            return "Nenhum navio inimigo restante no radar.";
        }

        const alvoMaisProximo = alvosRestantes.reduce((maisProximo, alvo) => {
            const distancia = (alvo.x - tiro.x) ** 2 + (alvo.y - tiro.y) ** 2;
            const menorDistancia = (maisProximo.x - tiro.x) ** 2 + (maisProximo.y - tiro.y) ** 2;
            return distancia < menorDistancia ? alvo : maisProximo;
        });

        const dx = alvoMaisProximo.x - tiro.x;
        const dy = alvoMaisProximo.y - tiro.y;
        const radianos = Math.atan2(dx, dy);
        const graus = (Math.round(radianos * (180 / Math.PI)) + 360) % 360;

        return `O navio inimigo mais próximo está na direção de ${graus}° a partir do tiro (0° = acima, sentido horário).`;
    },

    // 5. Transformação Linear de Rotação (90 graus anti-horário): T(x,y) = (-y, x)
    rotacionar90Graus(vetor) {
        return {
            x: -vetor.y,
            y: vetor.x
        };
    }
};