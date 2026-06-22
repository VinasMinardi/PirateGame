import { readFileSync } from 'node:fs';
import { WorldModel } from '../src/shared/world/WorldModel.js';
import { SailingSystem } from '../src/server/systems/SailingSystem.js';
import { Simulation } from '../src/server/Simulation.js';
import { SnapshotBuilder } from '../src/server/SnapshotBuilder.js';
import { ClientState } from '../src/client/ClientState.js';
import {
  createOrganicConfigHash,
  getOrganicChunkCacheKey
} from '../src/client/render/organic/OrganicChunkDiskCache.js';
import {
  OrganicTerrainField,
  sampleOrganicTerrainAtWorld
} from '../src/client/render/organic/OrganicTerrainField.js';
import {
  ORGANIC_BAKE_CONFIG,
  ORGANIC_CACHE_CONFIG,
  ORGANIC_CHUNK_CACHE_CONFIG,
  ORGANIC_MAP_RENDER_MODE,
  ORGANIC_RENDER_QUALITY,
  organicTerrainConfig
} from '../src/client/render/organic/organicTerrainConfig.js';
import {
  getBaseWorldSizeTiles,
  getSectorAtTile,
  getWorldSizeTiles,
  isTileInsideWorld
} from '../src/shared/world/SectorGrid.js';

function assert(condition, message) {
  if (!condition) {
    console.error(`[TESTE REPROVADO]: ${message}`);
    process.exit(1);
  }

  console.log(`[TESTE APROVADO]: ${message}`);
}

async function runTests() {
  console.log('====================================================');
  console.log('INICIANDO SUITE DE TESTES OBRIGATORIOS V3');
  console.log('====================================================');

  const model1 = new WorldModel(42);
  const model2 = new WorldModel(42);
  assert(model1.seed === model2.seed, 'WorldModel preserva seed sem acoplar geracao antiga por tiles.');
  assert(typeof model1.getSpawnPoint().x === 'number', 'WorldModel fornece spawn para servidor e cliente.');
  assert(model1.clampToWorld(999999, 999999, 26).x < 999999, 'WorldModel limita coordenadas ao mundo.');

  assert(ORGANIC_MAP_RENDER_MODE === 'organic_map_prototype', 'Modo organico fica ativo para o renderer principal.');
  assert(ORGANIC_RENDER_QUALITY.visualCellSize === 2, 'Qualidade organica usa celula visual de 2px.');
  assert(ORGANIC_RENDER_QUALITY.supersampling === 2, 'Qualidade organica usa supersampling 2x2.');
  assert(organicTerrainConfig.smoothBandEdges, 'Mapa organico usa blending suave entre faixas.');
  assert(ORGANIC_CHUNK_CACHE_CONFIG.preloadRadiusChunks >= 3, 'Preload organico aquece area ampla ao redor do spawn.');
  assert(ORGANIC_CHUNK_CACHE_CONFIG.maxChunksBuiltPerFrame === 1, 'Runtime organico limita geracao pesada por frame.');
  assert(ORGANIC_CACHE_CONFIG.persistentCacheEnabled, 'Cache persistente local do mapa organico fica habilitado.');
  assert(ORGANIC_BAKE_CONFIG.outputDir === 'public/generated/organic-map', 'Bake organico salva chunks em public/generated/organic-map.');

  const configHash = createOrganicConfigHash(organicTerrainConfig);
  const changedHash = createOrganicConfigHash({
    ...organicTerrainConfig,
    visualCellSize: organicTerrainConfig.visualCellSize + 1
  });
  assert(configHash !== changedHash, 'Hash do cache muda quando parametro visual relevante muda.');
  const chunkCacheKey = getOrganicChunkCacheKey(12, -4, organicTerrainConfig);
  assert(chunkCacheKey.includes(organicTerrainConfig.cacheVersion), 'Chave do chunk inclui cacheVersion.');
  assert(chunkCacheKey.includes(configHash), 'Chave do chunk inclui configHash.');
  assert(chunkCacheKey.includes('chunk_12_-4'), 'Chave do chunk inclui coordenadas.');

  const organicField = new OrganicTerrainField(organicTerrainConfig);
  const organicHeightA = organicField.getHeightAtWorld(1234.5, -9876.25);
  const organicHeightB = organicField.getHeightAtWorld(1234.5, -9876.25);
  const organicHeightC = organicField.getHeightAtWorld(1234.5 + organicTerrainConfig.chunkSizePx, -9876.25);
  assert(organicHeightA === organicHeightB, 'OrganicTerrainField e deterministico para a mesma coordenada.');
  assert(organicHeightA !== organicHeightC, 'OrganicTerrainField usa coordenadas globais.');

  const pixiRendererSource = readFileSync(new URL('../src/client/render/PixiRenderer.js', import.meta.url), 'utf8');
  const organicRendererSource = readFileSync(new URL('../src/client/render/organic/OrganicMapRenderer.js', import.meta.url), 'utf8');
  const organicMinimapSource = readFileSync(new URL('../src/client/render/organic/OrganicMinimapRenderer.js', import.meta.url), 'utf8');
  const sectorOverlaySource = readFileSync(new URL('../src/client/render/organic/SectorOverlayRenderer.js', import.meta.url), 'utf8');
  const hudSource = readFileSync(new URL('../src/client/ui/Hud.js', import.meta.url), 'utf8');
  const preloaderSource = readFileSync(new URL('../src/client/loading/GamePreloader.js', import.meta.url), 'utf8');
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

  assert(pixiRendererSource.includes('OrganicMapRenderer'), 'PixiRenderer importa OrganicMapRenderer.');
  assert(!pixiRendererSource.includes('TilemapRenderer'), 'PixiRenderer nao importa TilemapRenderer antigo.');
  assert(organicRendererSource.includes('this.chunks = new Map()'), 'OrganicMapRenderer mantem cache de chunks.');
  assert(organicRendererSource.includes('processBuildQueue'), 'OrganicMapRenderer processa fila de chunks.');
  assert(organicRendererSource.includes('initDiskCache'), 'OrganicMapRenderer inicializa cache persistente.');
  assert(organicRendererSource.includes('initBakedChunkCache'), 'OrganicMapRenderer tenta carregar chunks pre-gerados.');
  assert(organicMinimapSource.includes('OrganicMinimapRenderer'), 'OrganicMinimapRenderer existe.');
  assert(organicMinimapSource.includes('this.field'), 'OrganicMinimapRenderer usa OrganicTerrainField.');
  assert(organicMinimapSource.includes('drawSectorFrame'), 'OrganicMinimapRenderer desenha moldura do setor atual.');
  assert(sectorOverlaySource.includes('SectorOverlayRenderer'), 'SectorOverlayRenderer existe para linhas de setor.');
  assert(pixiRendererSource.includes('SectorOverlayRenderer'), 'PixiRenderer inclui overlay de setores.');
  assert(hudSource.includes('minimapRenderer.attach'), 'HUD conecta canvas ao minimapa organico.');
  assert(preloaderSource.includes('organicMapRenderer'), 'GamePreloader aquece renderer organico, nao MapStore antigo.');
  assert(!preloaderSource.includes('mapStore'), 'GamePreloader nao aquece mapa antigo por tiles.');
  assert(packageJson.scripts['bake:organic-map:spawn'], 'package.json expoe bake organico por spawn.');
  assert(packageJson.scripts['bake:organic-map:all'], 'package.json expoe bake organico completo.');

  const spawn = model1.getSpawnPoint();
  const spawnSample = sampleOrganicTerrainAtWorld(spawn.x, spawn.y);
  assert(['deep_water', 'shallow_water', 'wet_sand'].includes(spawnSample.visualLayer), 'Spawn inicial fica em camada visual navegavel organica.');

  const mockShip = {
    x: 0,
    y: 0,
    rotation: 0,
    velocityX: 0,
    velocityY: 0,
    sail: 0,
    rudder: 0,
    speed: 0,
    windAngle: 0,
    windStrength: 4
  };
  SailingSystem.update(mockShip, { sailUp: true }, model1, 0.1);
  assert(mockShip.sail > 0, 'Aceleracao do velame responde de maneira gradual.');

  const worldSize = getWorldSizeTiles();
  const baseWorldSize = getBaseWorldSizeTiles();
  assert(worldSize.width === 5120 && worldSize.height === 5120, 'Mapa usa grade mundial de 5120x5120 tiles de 16px.');
  assert(baseWorldSize.width === 1280 && baseWorldSize.height === 1280, 'Grade base permanece 1280x1280 para setores.');
  assert(getSectorAtTile(-2560, -2560).id === 'A1', 'Canto superior esquerdo corresponde ao setor A1.');
  assert(getSectorAtTile(2559, 2559).id === 'J10', 'Canto inferior direito corresponde ao setor J10.');
  assert(isTileInsideWorld(0, 0), 'Centro do mundo fica dentro do tabuleiro.');

  const deepWaterPoint = { x: -8192, y: -8192 };
  const shallowWaterPoint = { x: -3832, y: -8192 };
  const wetSandPoint = { x: -3504, y: -8192 };
  const beachPoint = { x: -3368, y: -8192 };
  const landPoint = { x: 3208, y: -8192 };

  assert(organicField.getHeightAtWorld(deepWaterPoint.x, deepWaterPoint.y) < organicTerrainConfig.thresholds.deepWater, 'Ponto deep water continua no heightmap.');
  const deepSample = sampleOrganicTerrainAtWorld(deepWaterPoint.x, deepWaterPoint.y);
  assert(deepSample.visualLayer === 'deep_water', 'Amostra unica identifica deep_water.');
  assert(!('collisionLayer' in deepSample) && !('blocksShip' in deepSample), 'Amostra organica nao carrega dados de bloqueio.');
  assert(sampleOrganicTerrainAtWorld(shallowWaterPoint.x, shallowWaterPoint.y).visualLayer === 'shallow_water', 'Amostra unica identifica shallow_water.');
  assert(sampleOrganicTerrainAtWorld(wetSandPoint.x, wetSandPoint.y).visualLayer === 'wet_sand', 'Amostra unica identifica wet_sand.');
  assert(sampleOrganicTerrainAtWorld(beachPoint.x, beachPoint.y).visualLayer === 'beach', 'Amostra unica identifica beach.');
  const landSample = sampleOrganicTerrainAtWorld(landPoint.x, landPoint.y);
  assert(['land', 'forest'].includes(landSample.visualLayer), 'Amostra unica identifica terra sem bloquear navegacao.');

  const freeSimulation = new Simulation(model1);
  const freeShip = freeSimulation.addShip('free-pass');
  Object.assign(freeShip, {
    x: landPoint.x,
    y: landPoint.y,
    rotation: 0,
    velocityX: 20,
    velocityY: 0,
    speed: 20,
    sail: 0,
    rudder: 0,
    windAngle: 0,
    windStrength: 4
  });
  freeSimulation.processInput(freeShip.id, {
    sailUp: false,
    sailDown: false,
    rudderLeft: false,
    rudderRight: false,
    anchorToggle: false
  });
  assert(freeShip.x > landPoint.x, 'Navio atravessa terra sem teste de casco ou bloqueio.');

  const serializedFreeShip = SnapshotBuilder.serializeShip(freeShip);
  assert(!('oc' in serializedFreeShip) && !('lcd' in serializedFreeShip) && !('lc' in serializedFreeShip), 'Snapshot nao envia dados de bloqueio/debug.');

  const clientState = new ClientState();
  clientState.updateFromSnapshot({
    ships: [{
      id: 'local',
      x: 1,
      y: 2
    }]
  }, 'local');
  assert(clientState.getLocalShip().id === 'local', 'Cliente preserva snapshot essencial dos navios.');

  const noCollisionRuntimeSource = [
    '../src/server/Simulation.js',
    '../src/server/SnapshotBuilder.js',
    '../src/client/render/organic/OrganicTerrainField.js',
    '../src/client/render/PixiRenderer.js'
  ].map((file) => readFileSync(new URL(file, import.meta.url), 'utf8')).join('\n');
  assert(!noCollisionRuntimeSource.includes('CollisionSystem'), 'Runtime principal nao importa sistema de colisao.');
  assert(!noCollisionRuntimeSource.includes('collisionLayer'), 'Runtime principal nao serializa camada de colisao.');
  assert(!noCollisionRuntimeSource.includes('blocksShip'), 'Runtime principal nao marca terreno como bloqueante.');
  assert(!pixiRendererSource.includes('OrganicCollisionDebugOverlay'), 'Runtime principal nao carrega overlay visual de colisao.');
  assert(!pixiRendererSource.includes('OrganicTerrainEditorOverlay'), 'Runtime principal nao carrega editor organico.');

  const unusedLegacySource = [
    '../src/client/render/PixiRenderer.js',
    '../src/client/loading/GamePreloader.js',
    '../src/shared/world/WorldModel.js'
  ].map((file) => readFileSync(new URL(file, import.meta.url), 'utf8')).join('\n');
  assert(!unusedLegacySource.includes('WorldMapStore'), 'Caminho ativo nao referencia WorldMapStore antigo.');
  assert(!unusedLegacySource.includes('TilemapRenderer'), 'Caminho ativo nao referencia TilemapRenderer antigo.');
  assert(!unusedLegacySource.includes('MapOverrides'), 'Caminho ativo nao referencia MapOverrides antigo.');
  assert(!unusedLegacySource.includes('DebugPanel'), 'Caminho ativo nao referencia painel de debug removido.');

  console.log('====================================================');
  console.log('TODOS OS CRITERIOS DE PRONTO E TESTES PASSARAM COM SUCESSO!');
  console.log('====================================================');
}

runTests();
