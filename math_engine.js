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

    // 4. Radar via Ângulo entre Vetores: cos(theta) = (u . v) / (|u| * |v|)
    calcularAnguloRadar(tiro, alvoMaisProximo) {
        // Se o tiro ou alvo estiver na origem (0,0), evita divisão por zero
        if ((tiro.x === 0 && tiro.y === 0) || (alvoMaisProximo.x === 0 && alvoMaisProximo.y === 0)) {
            return "Sinal interferido na origem (0,0)!";
        }

        const dot = this.produtoEscalar(tiro, alvoMaisProximo);
        const modTiro = this.modulo(tiro);
        const modAlvo = this.modulo(alvoMaisProximo);

        // Limita o cosseno entre -1 e 1 para evitar erros de ponto flutuante
        let cosTheta = dot / (modTiro * modAlvo);
        cosTheta = Math.max(-1, Math.min(1, cosTheta));

        const radianos = Math.acos(cosTheta);
        const graus = Math.round(radianos * (180 / Math.PI));

        return `Radar: O vetor do alvo mais próximo faz um ângulo de ${graus}° com o seu tiro.`;
    },

    // 5. Transformação Linear de Rotação (90 graus anti-horário): T(x,y) = (-y, x)
    rotacionar90Graus(vetor) {
        return {
            x: -vetor.y,
            y: vetor.x
        };
    }
};