# Space Attack

A small, dependency-free Canvas arcade game.

## Run

Open `index.html` directly in a modern desktop browser. No installation, server, or build step is required. A keyboard is required.

## Play

- Click **Launch mission** or press **Enter** to start. Use the same controls to restart after game over.
- Move with **WASD** or **arrow keys**. Hold **Space** to fire.
- Press **P** to pause/resume. Switching away from the window automatically pauses.
- Destroy ships for points. Dodge red plasma and enemy ships.
- You have **5 hull points**. Enemy shots and ship collisions cost hull. After damage, your flashing ship is briefly invulnerable.
- Each wave starts with a complete staggered pyramid. It sweeps horizontally, reverses at the edges, and gradually descends. Destroyed ships leave empty slots; clear the entire formation to advance after a two-second break.
- If **any enemy**, including a detached ship, touches the **danger line**, you lose **1 hull**, even while flashing. Crossings count before combat and cannot be undone by moving upward. All survivors return to their original formation slots (with remaining health preserved); destroyed ships stay destroyed. Score and wave are preserved, projectiles are cleared, and the breakaway cooldown restarts. Simultaneous crossings count as one breach.
- Formations grow from 6 to 10 to 15 ships (on waves 1, 3, and 5), then add **one ship per wave**, up to 30 on wave 20. Additional ships widen the existing five rows gradually. Horizontal speed, descent speed, enemy projectile speed, and the group's firing frequency increase with caps.
- Every **5 seconds** in wave 1, one ship breaks formation. The interval shrinks by 0.2 seconds per wave to a minimum of 3 seconds. From wave 4, each breakaway has a 50% chance to release two ships. There is no cap on accumulated detached ships. They retain their curved movement and horizontal direction changes, with movement speed reduced by 20%. Clear **both formation ships and detached ships** to finish the wave.
- **Basic:** coral, standard silhouette, 1 hit, 100 points, normal detached speed. **Light:** purple, narrow silhouette, 1 hit, 150 points, 25% faster detached movement. **Heavy:** amber, wide silhouette with hull pips, 2 hits, 250 points, 20% slower detached movement. Formation movement stays synchronized for all types. Composition uses exact wave-based quotas with shuffled positions. Wave 1 is all Basic. Light ships begin on wave 2 (17%, rising by 1.5 percentage points per wave to 30%). Heavy ships begin on wave 5 (7%, rising by 1.5 percentage points per wave to 25%). Counts round down and never decrease across waves; random placement cannot create Heavy-heavy spikes.

Enemies are 25% smaller, including collision radii. The formation starts at y=85 instead of y=110, with 42-pixel row spacing instead of 50, leaving more reaction space below it.

## Files

- `index.html`: game page, HUD, menus, controls.
- `style.css`: responsive layout and interface styling.
- `game.js`: input, state transitions, simulation, collisions, procedural rendering.

The game uses a fixed 960 × 640 logical playfield that scales to the page. All visuals are drawn with Canvas or CSS; nothing is downloaded.

Optional regression checks: run `node game.test.cjs` if Node.js is installed. Node is not required to play. These checks exercise simulation and UI state with a mock canvas, rather than testing browser appearance.
`nBreakaway selection is weighted toward upper rows: each successive row has half the per-enemy selection weight (16:8:4:2:1 across five rows). Only living, attached ships qualify. Detached ships keep their horizontal curves and direction changes, while vertical speed varies between 14% and 26% of their movement speed (previously 55%), preserving a slower downward drift.
