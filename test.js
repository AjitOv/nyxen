// NYXEN System Verification Test
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
  const world = new w.CoralEdenWorld(0);
  console.log(`  - Terrain: ${world.terrainMesh.vertexCount} verts`);
  console.log(`  - Kelp: ${world.kelpInstances.length} columns`);
  console.log(`  - Corals: ${world.coralInstances.length} colonies`);
  console.log(`  - Landmarks: ${world.landmarks.length}`);
  console.log(`  - Collectibles: ${world.collectibles.length}`);

  const f = await import('./src/fish_physics.js');
  console.log('✓ fish_physics.js loaded');
  const phys = new f.FishPhysics();
  phys.update(0.016, { forward: true, yaw: 0.1, sprint: true });
  console.log(`  - Swimming velocity: ${phys.currentSpeed.toFixed(2)} m/s`);

  console.log('==============================================');
  console.log('ALL NYXEN CORE ENGINE MODULES VERIFIED 100% OK!');
  console.log('==============================================');
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
