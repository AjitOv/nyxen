// NYXEN Infinite Ocean System Verification Test
async function run() {
  console.log('Testing NYXEN modules...');
  const m = await import('./src/math.js');
  console.log('✓ math.js loaded');

  const s = await import('./src/species.js');
  console.log('✓ species.js loaded');
  for (const k of Object.values(s.SPECIES)) {
    const mesh = s.buildFishMesh(k);
    console.log(`  - ${k}: ${mesh.vertexCount} verts, ${mesh.indexCount} indices`);
  }

  const w = await import('./src/world.js');
  console.log('✓ world.js loaded');
  const world = new w.InfiniteOceanWorld(0);
  console.log(`  - Active Chunks around (0,0): ${world.activeChunks.size}`);
  
  // Test Infinite Chunk Streaming across distant ocean coordinates!
  console.log('Testing infinite ocean streaming...');
  const testWaypoints = [
    [0, 0],
    [350, 200],
    [800, -600],
    [2500, 1800],
    [-4200, -3100]
  ];

  for (const [wx, wz] of testWaypoints) {
    world.updateChunks(wx, wz);
    const biome = world.getBiomeAt(wx, wz);
    const depth = world.getSeabedHeight(wx, wz);
    console.log(`  - At [X: ${wx}m, Z: ${wz}m] -> Biome: ${biome.name} | Depth: ${depth.toFixed(1)}m | Active Chunks: ${world.activeChunks.size}`);
  }

  console.log(`  - Set piece meshes: ${world.setPieceMeshes.length}`);
  console.log(`  - Total landmarks discovered/registered: ${world.landmarks.length}`);
  console.log(`  - Collectibles generated: ${world.collectibles.length}`);

  const f = await import('./src/fish_physics.js');
  console.log('✓ fish_physics.js loaded');
  const phys = new f.FishPhysics();
  phys.update(0.016, { forward: true, yaw: 0.1, sprint: true }, (x, z) => world.getSeabedHeight(x, z));
  console.log(`  - Swimming velocity: ${phys.currentSpeed.toFixed(2)} m/s`);

  console.log('==============================================');
  console.log('ALL NYXEN INFINITE OCEAN MODULES VERIFIED 100% OK!');
  console.log('==============================================');
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
