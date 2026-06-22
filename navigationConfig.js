// ============================================================
// CONFIGURAÇÃO DE NAVEGAÇÃO DO NAVIO
// ============================================================
//
// Este arquivo concentra os principais parâmetros de navegação,
// do navio na água.
//
// A ideia é que você consiga ajustar a sensação do navio sem mexer
// nos sistemas internos do jogo.
//
// Regra prática:
// - Para o navio andar mais rápido: aumente maxSpeed.
// - Para o navio ganhar velocidade mais rápido: aumente baseAcceleration.
// - Para o navio virar mais rápido: aumente turnRate.
// - Para o navio parecer menos escorregadio: aumente lateralDrag.
// - Para o navio perder velocidade mais rápido: aumente waterDrag.
// - Para testar o jogo com velocidade alta: mexa primeiro em baseAcceleration e maxSpeed.
//
// Observação importante:
// O HUD atualmente mostra a velocidade em nós multiplicando a velocidade interna por 1.5.
// Exemplo:
// maxSpeed: 100.0
// velocidade exibida no HUD: aproximadamente 150 nós.
//
// ============================================================

export const navigationConfig = {
  // ==========================================================
  // CONTROLE DE VELAS
  // ==========================================================

  // Velocidade com que o velame sobe quando o jogador segura W.
  // Quanto maior o valor, mais rápido o navio chega a 100% de vela.
  //
  // Exemplo:
  // 0.5 = demora cerca de 2 segundos para chegar a 100%.
  // 1.0 = demora cerca de 1 segundo.
  // 2.0 = demora cerca de 0,5 segundo.
  //
  // Recomendo para teste: entre 0.5 e 2.0.
  sailChangeRate: 0.5,

  // Limite máximo de vela aberta.
  // 1.0 representa 100%.
  // Não recomendo passar de 1.0, porque isso muda a lógica do sistema.
  maxSail: 1.0,

  // Limite mínimo de vela.
  // 0.0 representa vela totalmente recolhida.
  minSail: 0.0,


  // ==========================================================
  // CONTROLE DE LEME
  // ==========================================================

  // Velocidade com que o leme gira quando o jogador segura A ou D.
  // Quanto maior o valor, mais rápido o leme chega ao ângulo máximo.
  //
  // Se o navio estiver demorando para começar a virar, aumente este valor.
  //
  // Valor original: 1.5.
  // Teste mais responsivo: 2.0 a 3.0.
  rudderChangeRate: 2.5,

  // Velocidade com que o leme volta sozinho para o centro quando o jogador solta A ou D.
  //
  // Quanto maior o valor, mais rápido o navio para de virar depois que solta o botão.
  // Quanto menor, mais o navio continua com tendência de curva.
  //
  // Valor original: 1.0.
  rudderReturnRate: 1.0,

  // Ângulo máximo do leme, em radianos.
  // Quanto maior o valor, maior a curva máxima do navio.
  //
  // 0.6 é uma curva moderada.
  // 0.8 deixa o navio com curva mais forte.
  // 1.0 deixa muito agressivo.
  //
  // Se o navio está girando pouco mesmo com velocidade, aumente um pouco.
  maxRudder: 1.6,


  // ==========================================================
  // ACELERAÇÃO E VELOCIDADE
  // ==========================================================

  // Força base de aceleração do navio.
  // Este é um dos valores mais importantes para teste.
  //
  // Quanto maior o valor, mais rápido o navio ganha velocidade.
  //
  // Valor original: 1.2.
  // Valor atual de teste: 40.0.
  //
  // Para testes rápidos:
  // 20.0 = rápido, mas ainda controlável.
  // 40.0 = bem rápido.
  // 60.0 = muito rápido.
  baseAcceleration: 140.0,

  // Influência geral do vento na propulsão.
  //
  // Atenção:
  // No SailingSystem atual, este campo pode não estar sendo usado diretamente
  // em todos os cálculos. Ele fica aqui como parâmetro preparado para ajuste
  // fino do sistema de vento.
  //
  // Se futuramente o sistema usar este multiplicador, valores maiores fazem
  // o vento pesar mais na navegação.
  windInfluence: 0.8,

  // Penalidade ao navegar contra o vento.
  //
  // Quanto menor o valor, mais severo fica navegar contra o vento.
  // Quanto maior o valor, menos o vento contra atrapalha.
  //
  // Valor atual: 0.4.
  //
  // Para teste arcade, pode usar 0.7 ou 0.8.
  // Para navegação mais realista, pode usar 0.3 ou 0.4.
  headwindPenalty: 0.7,

  // Bônus ao navegar a favor do vento.
  //
  // Quanto maior o valor, mais o navio acelera com vento favorável.
  //
  // Valor atual: 1.3.
  //
  // Para deixar o vento mais importante: 1.5 a 2.0.
  // Para deixar a navegação mais estável: 1.0 a 1.2.
  tailwindBonus: 1.3,

  // Velocidade máxima interna do navio.
  //
  // Este é o principal limitador de velocidade.
  //
  // O HUD mostra aproximadamente:
  // velocidade exibida = maxSpeed * 1.5
  //
  // Exemplos:
  // maxSpeed 8.0   = 12 nós
  // maxSpeed 50.0  = 75 nós
  // maxSpeed 100.0 = 150 nós
  //
  // Valor original: 8.0.
  // Valor atual de teste: 100.0.
  maxSpeed: 300.0,


  // ==========================================================
  // ARRASTO E DESLIZAMENTO
  // ==========================================================

  // Arrasto natural da água.
  //
  // Quanto maior o valor, mais rápido o navio perde velocidade.
  // Quanto menor o valor, mais ele conserva velocidade.
  //
  // Valor original: 0.15.
  //
  // Se aumentar muito a velocidade e o navio parecer que demora demais
  // para frear, aumente este valor.
  //
  // Sugestões:
  // 0.10 = conserva mais velocidade.
  // 0.15 = padrão atual.
  // 0.25 = freia mais rápido.
  // 0.40 = freia bastante.
  waterDrag: 0.25,

  // Controle do deslizamento lateral do casco.
  //
  // Quanto maior o valor, menos o navio anda de lado.
  // Quanto menor o valor, mais ele derrapa/drifta.
  //
  // Valor atual: 0.92.
  //
  // Sugestões:
  // 0.85 = mais escorregadio.
  // 0.92 = equilibrado.
  // 0.96 = mais firme, menos drift.
  // 0.98 = quase sem deslizamento lateral.
  lateralDrag: 1.92,


  // ==========================================================
  // GIRO E RESPOSTA DE CURVA
  // ==========================================================

  // Força base de giro do navio.
  //
  // Este é o principal valor para corrigir o giro lento.
  //
  // Quanto maior o valor, mais rápido o navio vira quando o leme está acionado.
  //
  // Valor original: 0.4.
  //
  // Para a velocidade atual de teste, recomendo testar:
  // 0.6 = giro um pouco melhor.
  // 0.8 = giro bem mais responsivo.
  // 1.0 = giro forte.
  //
  // Se o navio está rápido e parece pesado demais para virar, aumente este valor.
  turnRate: 0.9,

  // Arrasto angular.
  //
  // Controla o quanto o giro perde força quando o navio está lento ou sem comando.
  //
  // Quanto maior, mais rápido o navio para de girar.
  // Quanto menor, mais ele mantém rotação.
  //
  // Valor atual: 0.15.
  angularDrag: 0.15,

  // Velocidade mínima necessária para o leme ter efeito.
  //
  // Navios reais precisam de fluxo de água no leme para virar.
  // Este valor simula isso.
  //
  // Quanto menor o valor, mais o navio consegue virar quase parado.
  // Quanto maior, mais ele precisa estar em movimento para virar.
  //
  // Valor atual: 0.5.
  //
  // Para jogo mais arcade, pode usar 0.2.
  // Para navegação mais realista, pode usar 0.8 ou 1.0.
  minSteeringSpeed: 0.5,


  // ==========================================================
  // ÂNCORA
  // ==========================================================

  // Corte imediato de velocidade no momento em que a âncora é lançada.
  // 0.35 = mantém 35% da velocidade atual.
  anchorDropShockFactor: 0.35,

  // Freio linear da âncora.
  // Reduz a velocidade até zero sem deixar inverter para marcha ré.
  // 60 = freio moderado.
  // 85 = freio forte.
  // 120 = freio muito forte.
  anchorLinearBrake: 85.0,

  // Abaixo dessa velocidade, o navio ancorado trava em zero.
  anchorStopSpeed: 0.75,

  // Força extra de giro da âncora quando o navio ainda está em movimento.
  // Ajuda no cavalo de pau.
  anchorTurnRate: 6.0,

  // Giro mínimo permitido mesmo com o navio parado.
  // Serve para manobra em porto.
  anchorPivotTurnRate: 1.8,

  // Limite de velocidade angular durante manobra ancorada.
  anchorMaxAngularVelocity: 3.0,

  // Amortece o giro quando o jogador solta A/D com a âncora lançada.
  anchorAngularDrag: 0.18,

  // ==========================================================
  // ==========================================================

  // Força de rebote quando o navio bate em terra/obstáculo.
  //
  // Quanto maior, mais ele quica ao bater.
  // Quanto menor, mais ele para seco.
  //
  // Valor atual: 0.4.
  //
  // Sugestões:
  // 0.1 = quase sem rebote.
  // 0.4 = rebote moderado.
  // 0.7 = rebote forte.


  // ==========================================================
  // ÁGUA RASA
  // ==========================================================

  // Penalidade de navegação em água rasa.
  //
  // Quanto maior o valor, mais o navio perde velocidade em água rasa.
  //
  // Valor atual: 0.3.
  //
  // Sugestões:
  // 0.1 = quase não penaliza.
  // 0.3 = penalidade moderada.
  // 0.6 = penalidade forte.
};
