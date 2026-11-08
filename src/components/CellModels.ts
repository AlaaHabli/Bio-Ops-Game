import * as THREE from 'three';

/**
 * Recursively disposes GPU BufferGeometries, Materials, and Textures inside a Three.js Object3D tree,
 * skipping any shared singleton resources marked with `userData.isCached = true`.
 * Eliminates VRAM accumulation and WebGL context crashes across phase transitions!
 */
export function disposeSceneGraph(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry && !mesh.geometry.userData?.isCached) {
      mesh.geometry.dispose();
    }
    if (mesh.material) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        if (!m || m.userData?.isCached) continue;
        const stdMat = m as THREE.MeshBasicMaterial & { map?: THREE.Texture | null };
        if (stdMat.map && !stdMat.map.userData?.isCached) {
          stdMat.map.dispose();
        }
        m.dispose();
      }
    }
  });
}

// Fast vertex-lit Lambert material wrapper that ignores PBR roughness/metalness so WebGL compiles a single lightweight shader program with zero mid-combat shader compilation stalls on mobile!
function createFastLitMaterial(params: THREE.MeshStandardMaterialParameters): THREE.MeshLambertMaterial {
  const { roughness: _r, metalness: _m, ...lambertParams } = params;
  return new THREE.MeshLambertMaterial(lambertParams);
}

// HELPER: TACTICAL BLACK OPS COMMS HEADSET & KEVLAR BODY ARMOR
export function addTacticalBlackOpsGear(
  group: THREE.Group,
  headCenter: { x: number; y: number; z: number; radius: number },
  torsoCenter: { x: number; y: number; z: number; radius: number },
  isCommander = false
) {
  // 1. TACTICAL MILITARY COMMS HEADSET ("the thing army communicates through")
  const headsetMat = createFastLitMaterial({
    color: isCommander ? 0x1c1917 : 0x27272a,
    roughness: 0.4,
    metalness: 0.6,
  });
  const cushionMat = createFastLitMaterial({ color: 0x09090b, roughness: 0.9 });

  // Left Earcup
  const leftEarcup = new THREE.Group();
  leftEarcup.position.set(headCenter.x - headCenter.radius * 0.98, headCenter.y, headCenter.z);
  const lShell = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.12, 12), headsetMat);
  lShell.rotateZ(Math.PI / 2);
  leftEarcup.add(lShell);
  const lCushion = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 12), cushionMat);
  lCushion.rotateZ(Math.PI / 2);
  lCushion.position.set(0.04, 0, 0);
  leftEarcup.add(lCushion);

  // Articulated Boom Microphone curving around to mouth
  const boomArm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.48, 6), headsetMat);
  boomArm.rotateX(Math.PI / 2.3);
  boomArm.rotateZ(-0.4);
  boomArm.position.set(0.1, -0.15, 0.28);
  leftEarcup.add(boomArm);

  // Microphone Foam Pop Filter / Windscreen
  const micTip = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), cushionMat);
  micTip.position.set(0.25, -0.32, 0.45);
  leftEarcup.add(micTip);

  // Tactical Whip Antenna angled upward
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.012, 0.65, 6), headsetMat);
  antenna.position.set(-0.02, 0.32, -0.1);
  antenna.rotateZ(-0.15);
  leftEarcup.add(antenna);

  group.add(leftEarcup);

  // Right Earcup
  const rightEarcup = new THREE.Group();
  rightEarcup.position.set(headCenter.x + headCenter.radius * 0.98, headCenter.y, headCenter.z);
  const rShell = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.12, 12), headsetMat);
  rShell.rotateZ(Math.PI / 2);
  rightEarcup.add(rShell);
  const rCushion = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 12), cushionMat);
  rCushion.rotateZ(Math.PI / 2);
  rCushion.position.set(-0.04, 0, 0);
  rightEarcup.add(rCushion);
  group.add(rightEarcup);

  // Connecting Over-Head Headband
  const band = new THREE.Mesh(
    new THREE.TorusGeometry(headCenter.radius * 0.96, 0.035, 6, 16, Math.PI),
    headsetMat
  );
  band.position.set(headCenter.x, headCenter.y, headCenter.z);
  band.rotateZ(Math.PI);
  group.add(band);

  // 2. TACTICAL KEVLAR BODY ARMOR PLATE CARRIER VEST ("tactical clothes and armor")
  const vestMat = createFastLitMaterial({
    color: isCommander ? 0x1e293b : 0x2e3d23, // SWAT digital navy or military olive drab
    roughness: 0.6,
    metalness: 0.15,
  });
  const pouchMat = createFastLitMaterial({
    color: isCommander ? 0x0f172a : 0x365314,
    roughness: 0.7,
  });

  const vestGeo = new THREE.CylinderGeometry(
    torsoCenter.radius * 1.05,
    torsoCenter.radius * 1.08,
    torsoCenter.radius * 0.75,
    16
  );
  const vest = new THREE.Mesh(vestGeo, vestMat);
  vest.position.set(torsoCenter.x, torsoCenter.y, torsoCenter.z);
  group.add(vest);

  // 3 Tactical Front Ammo Pouches with Molle loops
  for (let i = -1; i <= 1; i++) {
    const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.25, 0.12), pouchMat);
    pouch.position.set(torsoCenter.x + i * 0.22, torsoCenter.y - 0.05, torsoCenter.z + torsoCenter.radius * 1.05);
    group.add(pouch);
  }

  // Tactical Radio Holster on Upper Chest with Status LED
  const radio = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.26, 0.1), headsetMat);
  radio.position.set(torsoCenter.x - 0.32, torsoCenter.y + 0.12, torsoCenter.z + torsoCenter.radius * 0.98);
  const radioLed = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0x22c55e })
  );
  radioLed.position.set(0, 0.1, 0.06);
  radio.add(radioLed);
  group.add(radio);

  // Shoulder Epaulet Pauldrons (Armored shoulder pads)
  const padGeo = new THREE.CylinderGeometry(0.24, 0.28, 0.12, 10);
  const lPad = new THREE.Mesh(padGeo, vestMat);
  lPad.position.set(torsoCenter.x - torsoCenter.radius * 0.95, torsoCenter.y + 0.25, torsoCenter.z);
  lPad.rotateZ(0.3);
  group.add(lPad);

  const rPad = new THREE.Mesh(padGeo, vestMat);
  rPad.position.set(torsoCenter.x + torsoCenter.radius * 0.95, torsoCenter.y + 0.25, torsoCenter.z);
  rPad.rotateZ(-0.3);
  group.add(rPad);
}

// 1. STREPTOCOCCUS TROOPER (High-Detail Black Ops Assault Bacteria with Kevlar Helmet, NVG Mount, Assault Rifle & Articulated Limbs)
export function createStreptococcusSoldier(): {
  group: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  scopeGlint: THREE.Mesh;
} {
  const group = new THREE.Group();

  // Vibrant Biotoxic Lime Spherical Bacteria Body with Cellular Membrane Sheen
  const bodyGeo = new THREE.SphereGeometry(0.86, 24, 24);
  const bodyMat = createFastLitMaterial({
    color: 0x84cc16,
    roughness: 0.28,
    metalness: 0.18,
    emissive: 0x365314,
    emissiveIntensity: 0.3,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  group.add(body);

  // Sculpted PASGT / Ops-Core Tactical Ballistic Helmet
  const helmetGeo = new THREE.SphereGeometry(0.93, 24, 20, 0, Math.PI * 2, 0, Math.PI / 1.82);
  const helmetMat = createFastLitMaterial({
    color: 0x27272a,
    roughness: 0.32,
    metalness: 0.78,
  });
  const helmet = new THREE.Mesh(helmetGeo, helmetMat);
  helmet.position.set(0, 0.22, 0);
  helmet.rotation.x = -0.14;
  group.add(helmet);

  // Helmet Ballistic Visor Trim & Side Picatinny Rails
  const rimGeo = new THREE.TorusGeometry(0.92, 0.055, 10, 28);
  const rimMat = createFastLitMaterial({ color: 0x18181b, roughness: 0.4, metalness: 0.85 });
  const rim = new THREE.Mesh(rimGeo, rimMat);
  rim.position.set(0, 0.18, 0);
  rim.rotation.x = Math.PI / 2 - 0.14;
  group.add(rim);

  // Front NVG (Night-Vision Goggle) Shroud & Dual Glowing Tactical Optics on Helmet Brow
  const nvgMount = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.22, 0.16),
    createFastLitMaterial({ color: 0x09090b, metalness: 0.9, roughness: 0.2 })
  );
  nvgMount.position.set(0, 0.56, 0.86);
  group.add(nvgMount);

  const nvgLensMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
  [-0.12, 0.12].forEach((nx) => {
    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.065, 0.22, 10),
      createFastLitMaterial({ color: 0x18181b, metalness: 0.9 })
    );
    tube.rotateX(Math.PI / 2);
    tube.position.set(nx, 0.55, 0.95);
    group.add(tube);

    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.055, 10), nvgLensMat);
    lens.position.set(nx, 0.55, 1.065);
    group.add(lens);
  });

  // 3D FIERCE COMMANDO FACE (High contrast, expressive scowl & glowing iris)
  const browGeo = new THREE.BoxGeometry(0.36, 0.09, 0.1);
  const browMat = new THREE.MeshBasicMaterial({ color: 0x09090b });
  const leftBrow = new THREE.Mesh(browGeo, browMat);
  leftBrow.position.set(-0.28, 0.18, 0.83);
  leftBrow.rotation.z = -0.38;
  group.add(leftBrow);

  const rightBrow = new THREE.Mesh(browGeo, browMat);
  rightBrow.position.set(0.28, 0.18, 0.83);
  rightBrow.rotation.z = 0.38;
  group.add(rightBrow);

  // Glowing Sclera & Fierce Crimson Tactical Pupils
  const eyeGeo = new THREE.SphereGeometry(0.18, 16, 16);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-0.26, 0.02, 0.8);
  const leftPupil = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 10), pupilMat);
  leftPupil.position.set(0, 0, 0.14);
  leftEye.add(leftPupil);
  group.add(leftEye);

  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  rightEye.position.set(0.26, 0.02, 0.8);
  const rightPupil = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 10), pupilMat);
  rightPupil.position.set(0, 0, 0.14);
  rightEye.add(rightPupil);
  group.add(rightEye);

  // Snarling War-Cry Mouth with Upper & Lower Fangs
  const mouthGeo = new THREE.BoxGeometry(0.52, 0.24, 0.14);
  const mouthMat = new THREE.MeshBasicMaterial({ color: 0x09090b });
  const mouth = new THREE.Mesh(mouthGeo, mouthMat);
  mouth.position.set(0, -0.28, 0.81);

  const toothGeo = new THREE.ConeGeometry(0.048, 0.1, 6);
  toothGeo.rotateX(Math.PI);
  const toothMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (let i = 0; i < 4; i++) {
    const tTop = new THREE.Mesh(toothGeo, toothMat);
    tTop.position.set(-0.18 + i * 0.12, 0.07, 0.06);
    mouth.add(tTop);
  }
  group.add(mouth);

  // 4 ARTICULATED LIMBS WITH KNEE PADS, COMBAT BOOTS & DETAILED M4 BIO-CARBINE
  const limbMat = createFastLitMaterial({ color: 0x65a30d, roughness: 0.42 });
  const bootMat = createFastLitMaterial({ color: 0x18181b, roughness: 0.55, metalness: 0.4 });
  const padMat = createFastLitMaterial({ color: 0x27272a, roughness: 0.35, metalness: 0.7 });

  // Left Leg
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.4, -0.7, 0);
  const lLegMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.6, 8, 10), limbMat);
  lLegMesh.position.set(0, -0.3, 0);
  leftLeg.add(lLegMesh);
  const lKnee = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.24), padMat);
  lKnee.position.set(0, -0.32, 0.06);
  leftLeg.add(lKnee);
  const lBoot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.38), bootMat);
  lBoot.position.set(0, -0.6, 0.1);
  leftLeg.add(lBoot);
  group.add(leftLeg);

  // Right Leg
  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.4, -0.7, 0);
  const rLegMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.6, 8, 10), limbMat);
  rLegMesh.position.set(0, -0.3, 0);
  rightLeg.add(rLegMesh);
  const rKnee = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.24), padMat);
  rKnee.position.set(0, -0.32, 0.06);
  rightLeg.add(rKnee);
  const rBoot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.38), bootMat);
  rBoot.position.set(0, -0.6, 0.1);
  rightLeg.add(rBoot);
  group.add(rightLeg);

  // Left Arm (Armored Shoulder Pad + Tactical Glove)
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.95, 0.02, 0);
  const lShoulder = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 10), padMat);
  leftArm.add(lShoulder);
  const lArmMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.62, 8, 10), limbMat);
  lArmMesh.position.set(0, -0.3, 0);
  leftArm.add(lArmMesh);
  const lFist = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), bootMat);
  lFist.position.set(0, -0.65, 0);
  leftArm.add(lFist);
  group.add(leftArm);

  // Right Arm (Armored Shoulder + Detailed Black Ops Assault Carbine with Red-Dot Optic & Barrel)
  const rightArm = new THREE.Group();
  rightArm.position.set(0.95, 0.02, 0);
  const rShoulder = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 10), padMat);
  rightArm.add(rShoulder);
  const rArmMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.62, 8, 10), limbMat);
  rArmMesh.position.set(0, -0.3, 0);
  rightArm.add(rArmMesh);

  // Detailed Tactical Bio-Carbine Rifle in hand
  const gunGroup = new THREE.Group();
  gunGroup.position.set(0, -0.55, 0.32);
  const gunMat = createFastLitMaterial({ color: 0x1e293b, metalness: 0.88, roughness: 0.25 });
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.62), gunMat);
  gunGroup.add(receiver);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.55, 10), gunMat);
  barrel.rotateX(Math.PI / 2);
  barrel.position.set(0, 0.03, 0.5);
  gunGroup.add(barrel);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.28, 0.14), padMat);
  mag.position.set(0, -0.2, 0.1);
  mag.rotation.x = 0.25;
  gunGroup.add(mag);
  // Tactical Optical Sight Scope mounted on top rail + Glowing Scope Lens Glint when aiming!
  const scopeTube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.048, 0.048, 0.34, 10),
    createFastLitMaterial({ color: 0x09090b, metalness: 0.92, roughness: 0.18 })
  );
  scopeTube.rotateX(Math.PI / 2);
  scopeTube.position.set(0, 0.155, 0.08);
  gunGroup.add(scopeTube);

  const scopeGlint = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff2222, transparent: true, opacity: 0.0 })
  );
  scopeGlint.position.set(0, 0.155, 0.27);
  gunGroup.add(scopeGlint);

  const muzzleGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xa3e635 })
  );
  muzzleGlow.position.set(0, 0.03, 0.78);
  gunGroup.add(muzzleGlow);
  rightArm.add(gunGroup);
  group.add(rightArm);

  // Black Ops Tactical Comms Headset with boom mic & Kevlar armor vest with ammo pouches
  addTacticalBlackOpsGear(group, { x: 0, y: 0.22, z: 0, radius: 0.92 }, { x: 0, y: -0.25, z: 0, radius: 0.85 }, false);

  return { group, leftLeg, rightLeg, leftArm, rightArm, scopeGlint };
}

// 2. BACILLUS HEAVY GUNNER (Armored Rod Commando with Red Beret, Ballistic Visor, RPG/Plasma Cannon & 4 Limbs)
export function createBacillusSoldier(): {
  group: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  scopeGlint: THREE.Mesh;
} {
  const group = new THREE.Group();

  // Heavy Amber-Orange Rod Capsule Body
  const bodyGeo = new THREE.CapsuleGeometry(0.66, 1.4, 12, 20);
  const bodyMat = createFastLitMaterial({
    color: 0xf59e0b,
    roughness: 0.3,
    metalness: 0.18,
    emissive: 0x92400e,
    emissiveIntensity: 0.32,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  group.add(body);

  // Sculpted Red Spetsnaz/Commando Beret with Golden Special Forces Flash Badge
  const beretGeo = new THREE.CylinderGeometry(0.66, 0.74, 0.28, 20);
  const beretMat = createFastLitMaterial({ color: 0xdc2626, roughness: 0.5 });
  const beret = new THREE.Mesh(beretGeo, beretMat);
  beret.position.set(0.14, 1.26, 0);
  beret.rotation.z = -0.28;
  group.add(beret);

  const badge = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.18, 0.07),
    createFastLitMaterial({ color: 0xfacc15, metalness: 0.95, roughness: 0.15 })
  );
  badge.position.set(0.08, 1.26, 0.7);
  group.add(badge);

  // Scowling Eyes with Tactical HUD Monocle over Right Eye
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x09090b });

  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 14), eyeMat);
  leftEye.position.set(-0.25, 0.46, 0.62);
  const lp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), pupilMat);
  lp.position.set(0, 0, 0.14);
  leftEye.add(lp);
  group.add(leftEye);

  const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 14), eyeMat);
  rightEye.position.set(0.25, 0.46, 0.62);
  const rp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), pupilMat);
  rp.position.set(0, 0, 0.14);
  rightEye.add(rp);
  group.add(rightEye);

  // Glowing Targeting Visor Monocle on Right Eye
  const monocle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.06, 16),
    new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.65 })
  );
  monocle.rotateX(Math.PI / 2);
  monocle.position.set(0.25, 0.46, 0.78);
  group.add(monocle);

  // Heavy Scowling Eyebrows
  const browMat = new THREE.MeshBasicMaterial({ color: 0x451a03 });
  const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.09), browMat);
  b1.position.set(-0.25, 0.62, 0.65);
  b1.rotation.z = -0.4;
  group.add(b1);

  const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.09), browMat);
  b2.position.set(0.25, 0.62, 0.65);
  b2.rotation.z = 0.4;
  group.add(b2);

  // Gritted War Mouth with Cigar/Respirator Grille
  const mouth = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.22, 0.12),
    new THREE.MeshBasicMaterial({ color: 0x1c1917 })
  );
  mouth.position.set(0, 0.15, 0.65);
  group.add(mouth);

  // 4 Heavy Armored Limbs
  const limbMat = createFastLitMaterial({ color: 0xd97706, roughness: 0.4 });
  const bootMat = createFastLitMaterial({ color: 0x1c1917, roughness: 0.5, metalness: 0.4 });
  const armorMat = createFastLitMaterial({ color: 0x27272a, metalness: 0.8, roughness: 0.3 });

  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.4, -1.05, 0);
  leftLeg.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.75, 8, 10), limbMat));
  const lShinPad = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.32, 0.24), armorMat);
  lShinPad.position.set(0, -0.1, 0.06);
  leftLeg.add(lShinPad);
  const lb = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.42), bootMat);
  lb.position.set(0, -0.42, 0.12);
  leftLeg.add(lb);
  group.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.4, -1.05, 0);
  rightLeg.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.75, 8, 10), limbMat));
  const rShinPad = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.32, 0.24), armorMat);
  rShinPad.position.set(0, -0.1, 0.06);
  rightLeg.add(rShinPad);
  const rb = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.42), bootMat);
  rb.position.set(0, -0.42, 0.12);
  rightLeg.add(rb);
  group.add(rightLeg);

  const leftArm = new THREE.Group();
  leftArm.position.set(-0.86, 0.32, 0);
  const lPauldron = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), armorMat);
  leftArm.add(lPauldron);
  leftArm.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.7, 8, 10), limbMat));
  group.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.86, 0.32, 0);
  const rPauldron = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), armorMat);
  rightArm.add(rPauldron);
  rightArm.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.7, 8, 10), limbMat));

  // Heavy RPG / Bio-Plasma Autocannon in Right Hand
  const launcherGroup = new THREE.Group();
  launcherGroup.position.set(0, -0.38, 0.42);
  const tube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.17, 1.15, 14),
    createFastLitMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.22 })
  );
  tube.rotateX(Math.PI / 2);
  launcherGroup.add(tube);

  const shroud = new THREE.Mesh(
    new THREE.CylinderGeometry(0.19, 0.19, 0.45, 12),
    createFastLitMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.3 })
  );
  shroud.rotateX(Math.PI / 2);
  shroud.position.set(0, 0, 0.15);
  launcherGroup.add(shroud);

  // Ballistic Rangefinder Scope on top of Heavy Cannon + Glowing Scope Glint when aiming!
  const heavyScope = new THREE.Mesh(
    new THREE.CylinderGeometry(0.058, 0.058, 0.38, 10),
    createFastLitMaterial({ color: 0x09090b, metalness: 0.92, roughness: 0.2 })
  );
  heavyScope.rotateX(Math.PI / 2);
  heavyScope.position.set(0, 0.23, 0.16);
  launcherGroup.add(heavyScope);

  const scopeGlint = new THREE.Mesh(
    new THREE.SphereGeometry(0.095, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.0 })
  );
  scopeGlint.position.set(0, 0.23, 0.37);
  launcherGroup.add(scopeGlint);

  const warheadGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xf97316 })
  );
  warheadGlow.position.set(0, 0, 0.6);
  launcherGroup.add(warheadGlow);

  rightArm.add(launcherGroup);
  group.add(rightArm);

  // Black Ops Tactical Comms Headset with boom mic & Kevlar armor vest with ammo pouches
  addTacticalBlackOpsGear(group, { x: 0, y: 0.85, z: 0, radius: 0.72 }, { x: 0, y: -0.15, z: 0, radius: 0.68 }, false);

  return { group, leftLeg, rightLeg, leftArm, rightArm, scopeGlint };
}

// 3. AMOEBA GENERAL BOSS (Giant 4-Limbed Angry General)
export function createAmoebaBossSoldier(): {
  group: THREE.Group;
  nucleus: THREE.Mesh;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
} {
  const group = new THREE.Group();

  // Translucent giant amoeba body
  const outerGeo = new THREE.IcosahedronGeometry(1.8, 2);
  const outerMat = createFastLitMaterial({
    color: 0x9333ea,
    roughness: 0.25,
    metalness: 0.15,
    transparent: true,
    opacity: 0.75,
  });
  const outer = new THREE.Mesh(outerGeo, outerMat);
  group.add(outer);

  // Glowing Critical Nucleus in center (CRITICAL HEADSHOT TARGET)
  const nucleusGeo = new THREE.SphereGeometry(0.8, 16, 16);
  const nucleusMat = createFastLitMaterial({
    color: 0xff0033,
    emissive: 0xff0044,
    emissiveIntensity: 2.5,
  });
  const nucleus = new THREE.Mesh(nucleusGeo, nucleusMat);
  group.add(nucleus);

  // General's Peaked Cap
  const capGeo = new THREE.CylinderGeometry(1.05, 0.85, 0.4, 18);
  const capMat = createFastLitMaterial({ color: 0x18181b, roughness: 0.4, metalness: 0.6 });
  const cap = new THREE.Mesh(capGeo, capMat);
  cap.position.set(0, 1.9, 0.2);
  cap.rotation.x = 0.2;
  group.add(cap);

  // Gold officer crest
  const crest = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.08), createFastLitMaterial({ color: 0xfacc15, metalness: 0.9 }));
  crest.position.set(0, 1.95, 0.85);
  crest.rotation.x = 0.2;
  group.add(crest);

  // Enormous Angry Eyes
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });

  const lEye = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 14), eyeMat);
  lEye.position.set(-0.5, 0.4, 1.7);
  const lp = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), pupilMat);
  lp.position.set(0, 0, 0.25);
  lEye.add(lp);
  group.add(lEye);

  const rEye = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 14), eyeMat);
  rEye.position.set(0.5, 0.4, 1.7);
  const rp = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), pupilMat);
  rp.position.set(0, 0, 0.25);
  rEye.add(rp);
  group.add(rEye);

  // Angry General Mouth with Cigar
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.15), new THREE.MeshBasicMaterial({ color: 0x09090b }));
  mouth.position.set(0, -0.3, 1.75);
  // Cigar
  const cigar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.45, 8), createFastLitMaterial({ color: 0x78350f }));
  cigar.rotateZ(Math.PI / 3);
  cigar.position.set(0.35, -0.05, 0.15);
  // Glowing cigar tip
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), new THREE.MeshBasicMaterial({ color: 0xf97316 }));
  tip.position.set(0, 0.22, 0);
  cigar.add(tip);
  mouth.add(cigar);
  group.add(mouth);

  // 4 Giant Pseudopod Limbs
  const limbMat = createFastLitMaterial({ color: 0x7e22ce, transparent: true, opacity: 0.85 });

  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.9, -1.8, 0);
  leftLeg.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.3, 6, 8), limbMat));
  group.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.9, -1.8, 0);
  rightLeg.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.3, 6, 8), limbMat));
  group.add(rightLeg);

  const leftArm = new THREE.Group();
  leftArm.position.set(-1.9, 0.2, 0);
  leftArm.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.4, 6, 8), limbMat));
  group.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(1.9, 0.2, 0);
  rightArm.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.4, 6, 8), limbMat));
  group.add(rightArm);

  // Black Ops Tactical Comms Headset with boom mic & Kevlar armor vest with ammo pouches
  addTacticalBlackOpsGear(group, { x: 0, y: 0.6, z: 0, radius: 1.8 }, { x: 0, y: -0.7, z: 0, radius: 1.85 }, true);

  return { group, nucleus, leftLeg, rightLeg, leftArm, rightArm };
}

// 4. PANICKING 4-LIMBED RED BLOOD CELL (Screaming, trembling, running in panic!)
export function createPanickingRbc(): {
  group: THREE.Group;
  lArm: THREE.Group;
  rArm: THREE.Group;
  lLeg: THREE.Group;
  rLeg: THREE.Group;
} {
  const group = new THREE.Group();

  // Biconcave Erythrocyte Body
  const bodyGeo = new THREE.TorusGeometry(0.8, 0.38, 14, 24);
  const bodyMat = createFastLitMaterial({
    color: 0xe11d48,
    roughness: 0.25,
    metalness: 0.15,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.scale.set(1, 1, 0.45);
  group.add(body);

  // Center Dimple
  const centerGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.15, 16);
  centerGeo.rotateX(Math.PI / 2);
  const center = new THREE.Mesh(centerGeo, createFastLitMaterial({ color: 0xbe123c }));
  group.add(center);

  // PANICKED SCREAMING FACE (High contrast, funny screaming expression!)
  // Giant wide frightened eyes (O_O)
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x09090b });

  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 14), eyeMat);
  leftEye.position.set(-0.3, 0.12, 0.22);
  const lp = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), pupilMat);
  lp.position.set(0, 0, 0.18);
  leftEye.add(lp);
  group.add(leftEye);

  const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 14), eyeMat);
  rightEye.position.set(0.3, 0.12, 0.22);
  const rp = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), pupilMat);
  rp.position.set(0, 0, 0.18);
  rightEye.add(rp);
  group.add(rightEye);

  // Huge Screaming Open Mouth (OДO)
  const mouthGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.1, 16);
  mouthGeo.rotateX(Math.PI / 2);
  const mouth = new THREE.Mesh(mouthGeo, new THREE.MeshBasicMaterial({ color: 0x450a0a }));
  mouth.position.set(0, -0.25, 0.22);
  group.add(mouth);

  // Sweat Drop of Panic
  const sweatGeo = new THREE.SphereGeometry(0.12, 8, 8);
  const sweatMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const sweat = new THREE.Mesh(sweatGeo, sweatMat);
  sweat.position.set(0.55, 0.55, 0.25);
  group.add(sweat);

  // 4 FLAILING NOODLE LIMBS (Running in panic with arms up in the air!)
  const noodleMat = createFastLitMaterial({ color: 0xf43f5e, roughness: 0.4 });

  // Left Arm (waving up in terror \o/ )
  const lArm = new THREE.Group();
  lArm.position.set(-0.95, 0.4, 0);
  const a1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.75, 6, 8), noodleMat);
  a1.position.set(-0.25, 0.35, 0);
  a1.rotation.z = 0.6;
  lArm.add(a1);
  group.add(lArm);

  // Right Arm (waving up in terror \o/ )
  const rArm = new THREE.Group();
  rArm.position.set(0.95, 0.4, 0);
  const a2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.75, 6, 8), noodleMat);
  a2.position.set(0.25, 0.35, 0);
  a2.rotation.z = -0.6;
  rArm.add(a2);
  group.add(rArm);

  // Left Running Leg
  const lLeg = new THREE.Group();
  lLeg.position.set(-0.4, -0.85, 0);
  const leg1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.7, 6, 8), noodleMat);
  leg1.position.set(0, -0.35, 0);
  lLeg.add(leg1);
  group.add(lLeg);

  // Right Running Leg
  const rLeg = new THREE.Group();
  rLeg.position.set(0.4, -0.85, 0);
  const leg2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.7, 6, 8), noodleMat);
  leg2.position.set(0, -0.35, 0);
  rLeg.add(leg2);
  group.add(rLeg);

  return { group, lArm, rArm, lLeg, rLeg };
}

// 5. WHITE BLOOD CELL FPS OPERATIVE ARMS & BLACK OPS TACTICAL GLOVES (First-Person View Gripping the Weapon)
export function createLeukocyteFPSArms(_weaponColor: string): THREE.Group {
  const group = new THREE.Group();

  // Pearlescent White Blood Cell (Leukocyte) cellular arm material with glowing bio-sheen
  const wbcArmMat = createFastLitMaterial({
    color: 0xf8fafc,
    roughness: 0.22,
    metalness: 0.12,
    emissive: 0xbae6fd,
    emissiveIntensity: 0.28,
  });

  // Glowing Cyan Leukocyte Bio-Vein / Sleeve Trim
  const bioVeinMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
  });

  // Black Ops Hard-Knuckle Tactical Glove Material
  const gloveLeatherMat = createFastLitMaterial({
    color: 0x0f172a,
    roughness: 0.45,
    metalness: 0.45,
  });
  const knuckleArmorMat = createFastLitMaterial({
    color: 0x334155,
    roughness: 0.25,
    metalness: 0.88,
  });
  const strapAccentMat = createFastLitMaterial({
    color: 0xf59e0b,
    roughness: 0.3,
    metalness: 0.85,
  });

  // ============================================================================
  // RIGHT ARM & TACTICAL GLOVE (Trigger Hand gripping the weapon pistol grip)
  // ============================================================================
  const rightArmGroup = new THREE.Group();
  // Forearm extends from bottom-right camera corner up into the weapon pistol grip at (0, -0.18, 0.28)
  const rForearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.082, 0.56, 10, 14), wbcArmMat);
  rForearm.position.set(0.16, -0.31, 0.54);
  rForearm.rotation.set(Math.PI / 2.65, 0, 0.36);
  rightArmGroup.add(rForearm);

  // Leukocyte Cellular Cuff Ring on Right Forearm
  const rCuff = new THREE.Mesh(new THREE.TorusGeometry(0.084, 0.015, 8, 18), bioVeinMat);
  rCuff.position.set(0.08, -0.23, 0.38);
  rCuff.rotation.set(0.35, 0.3, 0);
  rightArmGroup.add(rCuff);

  // Right Black Ops Tactical Glove Wrist Gauntlet + Velcro Strap
  const rWrist = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.084, 0.14, 12), gloveLeatherMat);
  rWrist.rotateX(Math.PI / 2.4);
  rWrist.position.set(0.04, -0.2, 0.32);
  rightArmGroup.add(rWrist);

  const rStrap = new THREE.Mesh(new THREE.BoxGeometry(0.165, 0.04, 0.09), strapAccentMat);
  rStrap.position.set(0.04, -0.19, 0.31);
  rightArmGroup.add(rStrap);

  // Right Glove Palm & Carbon-Fiber Hard-Knuckle Plate gripping the Pistol Grip
  const rPalm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.16), gloveLeatherMat);
  rPalm.position.set(0.02, -0.16, 0.22);
  rightArmGroup.add(rPalm);

  const rKnucklePlate = new THREE.Mesh(new THREE.BoxGeometry(0.128, 0.055, 0.13), knuckleArmorMat);
  rKnucklePlate.position.set(0.045, -0.12, 0.21);
  rightArmGroup.add(rKnucklePlate);

  // Trigger Finger extended onto the Trigger + 3 Curled Grip Fingers
  for (let f = 0; f < 4; f++) {
    const isTriggerFinger = f === 0;
    const finger = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.02, isTriggerFinger ? 0.095 : 0.08, 6, 8),
      isTriggerFinger ? knuckleArmorMat : gloveLeatherMat
    );
    finger.rotateZ(Math.PI / 2);
    if (isTriggerFinger) {
      finger.position.set(0.01, -0.11, 0.11);
      finger.rotation.y = -0.35;
    } else {
      finger.position.set(0.0, -0.12 - f * 0.032, 0.19);
    }
    rightArmGroup.add(finger);
  }

  // Right Thumb wrapped over the left side of the receiver grip
  const rThumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.024, 0.085, 6, 8), gloveLeatherMat);
  rThumb.position.set(-0.04, -0.09, 0.21);
  rThumb.rotation.set(0.5, 0.4, 0.4);
  rightArmGroup.add(rThumb);

  group.add(rightArmGroup);

  // ============================================================================
  // LEFT SUPPORT ARM, BIOMETRIC WATCH & TACTICAL GLOVE (Gripping Foregrip/Barrel)
  // ============================================================================
  const leftArmGroup = new THREE.Group();

  // White Blood Cell Left Forearm sweeping in from lower-left to the front handguard (-0.36Z)
  const lForearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.084, 0.68, 10, 14), wbcArmMat);
  lForearm.position.set(-0.22, -0.29, 0.02);
  lForearm.rotation.set(Math.PI / 2.75, 0, -0.46);
  leftArmGroup.add(lForearm);

  // Glowing Leukocyte Membrane Ring on Left Forearm
  const lCuff = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.015, 8, 18), bioVeinMat);
  lCuff.position.set(-0.11, -0.2, -0.18);
  lCuff.rotation.set(0.35, -0.35, 0);
  leftArmGroup.add(lCuff);

  // Black Ops Tactical Holographic Biometric Wristwatch on Left Wrist (Clearly visible in FPS!)
  const watchBand = new THREE.Mesh(new THREE.CylinderGeometry(0.086, 0.086, 0.07, 14), gloveLeatherMat);
  watchBand.rotateX(Math.PI / 2.6);
  watchBand.rotateZ(-0.42);
  watchBand.position.set(-0.095, -0.185, -0.21);
  leftArmGroup.add(watchBand);

  const watchBezel = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.055, 0.028, 14), knuckleArmorMat);
  watchBezel.position.set(-0.055, -0.14, -0.21);
  watchBezel.rotation.set(0.35, 0.3, -0.45);
  leftArmGroup.add(watchBezel);

  const watchScreen = new THREE.Mesh(
    new THREE.CircleGeometry(0.042, 14),
    new THREE.MeshBasicMaterial({ color: 0x22c55e })
  );
  watchScreen.position.set(-0.048, -0.128, -0.205);
  watchScreen.rotation.set(-0.9, 0.35, -0.3);
  leftArmGroup.add(watchScreen);

  // Left Black Ops Tactical Glove Gauntlet & Carbon-Fiber Knuckle Plate gripping Foregrip
  const lGlovePalm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.19), gloveLeatherMat);
  lGlovePalm.position.set(-0.02, -0.12, -0.36);
  leftArmGroup.add(lGlovePalm);

  const lKnuckleArmor = new THREE.Mesh(new THREE.BoxGeometry(0.138, 0.05, 0.15), knuckleArmorMat);
  lKnuckleArmor.position.set(-0.045, -0.09, -0.36);
  leftArmGroup.add(lKnuckleArmor);

  // 4 Armored Fingers wrapped around the Front Handguard / Vertical Foregrip
  for (let f = 0; f < 4; f++) {
    const lFinger = new THREE.Mesh(new THREE.CapsuleGeometry(0.021, 0.09, 6, 8), knuckleArmorMat);
    lFinger.rotateZ(Math.PI / 2);
    lFinger.position.set(0.035, -0.095 - f * 0.022, -0.31 - f * 0.032);
    leftArmGroup.add(lFinger);
  }

  // Left Thumb C-Clamping over the Left Picatinny Handguard Rail
  const lThumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.024, 0.095, 6, 8), gloveLeatherMat);
  lThumb.position.set(-0.055, -0.04, -0.35);
  lThumb.rotation.set(0.4, -0.3, -0.3);
  leftArmGroup.add(lThumb);

  group.add(leftArmGroup);

  return group;
}

// 6. BACTERIA BATTLE TANK (Heavy M1A2 Abrams / Bio-Leopard Armored Tank with Reactive Armor & Recoiling 120mm Cannon)
export function createBacteriaTank(): {
  group: THREE.Group;
  turret: THREE.Group;
  cannon: THREE.Mesh;
  leftTread: THREE.Mesh;
  rightTread: THREE.Mesh;
} {
  const group = new THREE.Group();

  // Palette matched directly to IMG_5381_0d50bcc0.webp
  const oliveLightMat = createFastLitMaterial({
    color: 0x748b47, // Classic Olive-Green upper armor
    roughness: 0.42,
    metalness: 0.35,
  });
  const oliveMidMat = createFastLitMaterial({
    color: 0x5b7035, // Shaded Olive-Green lower & side armor
    roughness: 0.48,
    metalness: 0.4,
  });
  const oliveDarkMat = createFastLitMaterial({
    color: 0x3b4d21, // Deep olive shadow / structural plates
    roughness: 0.5,
    metalness: 0.45,
  });
  const tanFenderMat = createFastLitMaterial({
    color: 0xeab676, // Signature Warm Tan / Sand Front Fender & Tread Link plates
    roughness: 0.38,
    metalness: 0.25,
  });
  const blackOutlineMat = new THREE.MeshBasicMaterial({ color: 0x0f1410 });

  // 1. Lower & Upper Stepped Olive-Green Armored Hull Chassis
  const lowerHull = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.56, 3.05), oliveMidMat);
  lowerHull.position.set(0, -0.08, 0.05);
  group.add(lowerHull);

  // Sloped Front Lower Glacis Block with Dark Tow-Hook Mounts
  const frontGlacis = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.52, 0.9), oliveLightMat);
  frontGlacis.position.set(0, 0.04, 1.38);
  frontGlacis.rotation.x = -0.28;
  group.add(frontGlacis);

  [-0.58, 0.58].forEach((tx) => {
    const towBracket = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 0.22), oliveDarkMat);
    towBracket.position.set(tx, 0.04, 1.72);
    group.add(towBracket);
  });

  // Stepped Upper Hull Deck Over Sponsons
  const upperDeck = new THREE.Mesh(new THREE.BoxGeometry(2.72, 0.28, 3.28), oliveLightMat);
  upperDeck.position.set(0, 0.26, -0.05);
  group.add(upperDeck);

  const upperDeckCap = new THREE.Mesh(new THREE.BoxGeometry(2.38, 0.16, 2.95), oliveMidMat);
  upperDeckCap.position.set(0, 0.42, -0.1);
  group.add(upperDeckCap);

  // 2. Signature Sloped Warm Tan / Sand Front Track Mudguard Fenders (Left & Right, from IMG_5381!)
  [-1.18, 1.18].forEach((fx) => {
    const fenderGroup = new THREE.Group();
    fenderGroup.position.set(fx, 0.16, 1.65);

    const tanFlap = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.09, 0.92), tanFenderMat);
    tanFlap.rotation.x = 0.46;
    fenderGroup.add(tanFlap);

    // Crisp dark edge trim around tan fender
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.79, 0.04, 0.95), blackOutlineMat);
    trim.position.set(0, -0.03, 0);
    trim.rotation.x = 0.46;
    fenderGroup.add(trim);

    group.add(fenderGroup);
  });

  // 3. Heavy Caterpillar Tracks with Golden-Tan Tread Bars, 4 Lower Tan Roadwheels & 4 Upper Green Bogies
  const treadGeo = new THREE.BoxGeometry(0.68, 0.78, 3.65);
  const leftTread = new THREE.Mesh(treadGeo, blackOutlineMat);
  leftTread.position.set(-1.18, -0.22, 0);
  group.add(leftTread);

  const rightTread = new THREE.Mesh(treadGeo, blackOutlineMat);
  rightTread.position.set(1.18, -0.22, 0);
  group.add(rightTread);

  // Golden-Tan Horizontal Tread Link Bars on Front & Rear Track Faces
  [-1.18, 1.18].forEach((tx) => {
    for (let bar = -2; bar <= 2; bar++) {
      const frontLink = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.07, 0.08), tanFenderMat);
      frontLink.position.set(tx, -0.2 + bar * 0.13, 1.81 - Math.abs(bar) * 0.04);
      group.add(frontLink);
    }

    // 4 Lower Golden-Tan Roadwheels with Dark Rim & Inner Hub
    [-1.15, -0.38, 0.38, 1.15].forEach((wz) => {
      const wheelX = tx < 0 ? tx - 0.31 : tx + 0.31;
      const lowerWheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.27, 0.27, 0.14, 16),
        tanFenderMat
      );
      lowerWheel.rotateZ(Math.PI / 2);
      lowerWheel.position.set(wheelX, -0.38, wz);
      group.add(lowerWheel);

      const lowerHub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, 0.13, 0.17, 12),
        oliveDarkMat
      );
      lowerHub.rotateZ(Math.PI / 2);
      lowerHub.position.set(wheelX, -0.38, wz);
      group.add(lowerHub);
    });

    // Upper Olive-Green Suspension Housing + 4 Upper Green Bogie Wheels
    const upperSuspension = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.34, 3.25),
      oliveLightMat
    );
    upperSuspension.position.set(tx < 0 ? tx - 0.29 : tx + 0.29, -0.02, -0.05);
    group.add(upperSuspension);

    [-1.22, -0.42, 0.38, 1.18].forEach((wz) => {
      const wheelX = tx < 0 ? tx - 0.33 : tx + 0.33;
      const bogie = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 0.12, 14),
        oliveMidMat
      );
      bogie.rotateZ(Math.PI / 2);
      bogie.position.set(wheelX, -0.02, wz);
      group.add(bogie);

      const bogieHub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.09, 0.15, 10),
        blackOutlineMat
      );
      bogieHub.rotateZ(Math.PI / 2);
      bogieHub.position.set(wheelX, -0.02, wz);
      group.add(bogieHub);
    });
  });

  // 4. Tall Boxy-Angled Olive-Green Main Turret (Matched to IMG_5381)
  const turret = new THREE.Group();
  turret.position.set(0, 0.88, -0.08);

  // Main Tall Turret Block
  const turretMain = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.86, 2.22), oliveLightMat);
  turret.add(turretMain);

  // Chamfered Top & Bottom Turret Bevel Plates
  const turretRoof = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.12, 2.02), oliveMidMat);
  turretRoof.position.set(0, 0.47, 0);
  turret.add(turretRoof);

  const turretCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.02, 0.18, 16), blackOutlineMat);
  turretCollar.position.set(0, -0.46, 0);
  turret.add(turretCollar);

  // Two Dark Front Armor Viewport Slits on Upper Turret Face (Left & Right, as in IMG_5381)
  [-0.58, 0.62].forEach((vx) => {
    const slitRecess = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.12), blackOutlineMat);
    slitRecess.position.set(vx, 0.22, 1.08);
    slitRecess.rotation.x = -0.15;
    turret.add(slitRecess);
  });

  // Side Rivet Bolts on Turret Cheek (3 vertical rivets + rear bolt as in IMG_5381)
  [-1.03, 1.03].forEach((rx) => {
    [-0.18, -0.02, 0.14].forEach((ry) => {
      const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), oliveDarkMat);
      rivet.position.set(rx, ry, 0.58);
      turret.add(rivet);
    });
    const rearBolt = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), tanFenderMat);
    rearBolt.position.set(rx, -0.22, -0.82);
    turret.add(rearBolt);
  });

  // Rounded Rectangular Offset Mantlet Box on Front Turret Face
  const mantletBox = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.34, 0.34), oliveLightMat);
  mantletBox.position.set(-0.22, -0.02, 1.12);
  turret.add(mantletBox);

  const mantletTrim = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.38, 0.26), blackOutlineMat);
  mantletTrim.position.set(-0.22, -0.02, 1.08);
  turret.add(mantletTrim);

  // 5. Stepped Olive-Green Main Cannon Barrel with 3 Barrel Rings & Wide Cylindrical Muzzle Collar
  const cannonGeo = new THREE.CylinderGeometry(0.18, 0.21, 2.55, 16);
  cannonGeo.rotateX(Math.PI / 2);
  const cannon = new THREE.Mesh(cannonGeo, oliveMidMat);
  cannon.position.set(0.22, -0.02, 1.65);

  // 3 Distinct Black/Dark-Olive Barrel Rings along the Cannon Tube (exactly like IMG_5381)
  [-0.55, 0.02, 0.58].forEach((rz) => {
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(0.215, 0.215, 0.07, 16),
      blackOutlineMat
    );
    ring.rotateX(Math.PI / 2);
    ring.position.set(0, 0, rz);
    cannon.add(ring);
  });

  // Wide Cylindrical Muzzle Brake Collar & Deep Black Bore Opening
  const muzzleCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.27, 0.25, 0.48, 18),
    oliveLightMat
  );
  muzzleCollar.rotateX(Math.PI / 2);
  muzzleCollar.position.set(0, 0, 1.15);
  cannon.add(muzzleCollar);

  const muzzleRim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.08, 18),
    blackOutlineMat
  );
  muzzleRim.rotateX(Math.PI / 2);
  muzzleRim.position.set(0, 0, 1.36);
  cannon.add(muzzleRim);

  const boreOpening = new THREE.Mesh(
    new THREE.CylinderGeometry(0.21, 0.21, 0.12, 16),
    blackOutlineMat
  );
  boreOpening.rotateX(Math.PI / 2);
  boreOpening.position.set(0, 0, 1.38);
  cannon.add(boreOpening);

  turret.add(cannon);

  // 6. Roof-Mounted Commander Auxiliary Turret with Secondary Gun Barrel & Periscope Sights (IMG_5381!)
  const auxTurret = new THREE.Group();
  auxTurret.position.set(-0.34, 0.62, -0.15);

  const auxBox = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.34, 0.88), oliveLightMat);
  auxTurret.add(auxBox);

  const auxRearDome = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), blackOutlineMat);
  auxRearDome.position.set(-0.46, -0.02, -0.35);
  auxTurret.add(auxRearDome);

  // Stepped Secondary Roof Cannon pointing forward
  const auxGun = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.13, 0.92, 12),
    oliveMidMat
  );
  auxGun.rotateX(Math.PI / 2);
  auxGun.position.set(0.12, 0.04, 0.66);
  auxTurret.add(auxGun);

  const auxMuzzle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.14, 12),
    blackOutlineMat
  );
  auxMuzzle.rotateX(Math.PI / 2);
  auxMuzzle.position.set(0.12, 0.04, 1.12);
  auxTurret.add(auxMuzzle);

  turret.add(auxTurret);

  // Roof Periscope & Pintle Machine-Gunner Sight on Right Roof
  const roofSight = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.48), oliveMidMat);
  roofSight.position.set(0.45, 0.58, 0.38);
  roofSight.rotation.x = -0.2;
  turret.add(roofSight);

  group.add(turret);

  return { group, turret, cannon, leftTread, rightTread };
}

// 7. FORTNITE + CALL OF DUTY: BLACK OPS WEAPON MODELS (SCAR-H, Tactical Pump Shotgun, Bolt-Action Sniper, Heavy Drum LMG)
export function createFortniteWeaponModel(weaponId: string, _color: string): { group: THREE.Group; pumpSlide?: THREE.Mesh; core?: THREE.Mesh } {
  const group = new THREE.Group();

  const gunmetalMat = createFastLitMaterial({
    color: 0x1e293b,
    roughness: 0.28,
    metalness: 0.88,
  });
  const matteBlackMat = createFastLitMaterial({
    color: 0x0f172a,
    roughness: 0.42,
    metalness: 0.72,
  });
  const chromeSteelMat = createFastLitMaterial({
    color: 0x94a3b8,
    roughness: 0.18,
    metalness: 0.95,
  });

  // Shared Black Ops Tactical Hardware: Ergonomic Pistol Grip, Trigger Guard, Top Picatinny Rail & AN/PEQ-15 Laser Module
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.24, 0.11), matteBlackMat);
  grip.position.set(0, -0.19, 0.22);
  grip.rotation.x = -0.28;
  group.add(grip);

  const triggerGuard = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.07, 0.14), gunmetalMat);
  triggerGuard.position.set(0, -0.14, 0.11);
  group.add(triggerGuard);

  // Machined Picatinny Top Rail Ridge
  for (let r = -0.45; r <= 0.35; r += 0.08) {
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.022, 0.04), matteBlackMat);
    tooth.position.set(0, 0.125, r);
    group.add(tooth);
  }

  // Side-Mounted AN/PEQ-15 Tactical Laser Box with Green Laser Emitter Lens
  const peqBox = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.065, 0.18), matteBlackMat);
  peqBox.position.set(0.095, 0.04, -0.42);
  group.add(peqBox);
  const peqLens = new THREE.Mesh(new THREE.CircleGeometry(0.02, 10), new THREE.MeshBasicMaterial({ color: 0x22c55e }));
  peqLens.rotateY(Math.PI);
  peqLens.position.set(0.095, 0.04, -0.515);
  group.add(peqLens);

  if (weaponId === 'scar_bio') {
    // ==========================================================================
    // 1. LEGENDARY FN SCAR-H BIO-ASSAULT RIFLE (Fortnite Gold + Black Ops Spec)
    // ==========================================================================
    const scarGoldMat = createFastLitMaterial({
      color: 0xd97706,
      roughness: 0.24,
      metalness: 0.86,
    });
    const scarTanMat = createFastLitMaterial({
      color: 0xf59e0b,
      roughness: 0.32,
      metalness: 0.72,
    });

    // Monolithic Upper Receiver (Iconic SCAR Gold)
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.155, 0.21, 1.08), scarGoldMat);
    group.add(upper);

    // Side Cooling Vents & Reciprocating Charging Handle
    [-0.08, 0.08].forEach((sx) => {
      for (let v = 0; v < 4; v++) {
        const vent = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.045, 0.06), matteBlackMat);
        vent.position.set(sx, 0.04, -0.18 - v * 0.09);
        group.add(vent);
      }
    });
    const chargingHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.09, 8), chromeSteelMat);
    chargingHandle.rotateZ(Math.PI / 2);
    chargingHandle.position.set(-0.11, 0.07, -0.05);
    group.add(chargingHandle);

    // Lower Polymer Receiver & Magwell
    const lower = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.16, 0.82), gunmetalMat);
    lower.position.set(0, -0.11, 0.08);
    group.add(lower);

    // Iconic SCAR UGG-Boot Folding Buttstock with Cheek Riser
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.24, 0.46), scarTanMat);
    stock.position.set(0, -0.03, 0.72);
    group.add(stock);
    const cheekRest = new THREE.Mesh(new THREE.BoxGeometry(0.138, 0.07, 0.34), matteBlackMat);
    cheekRest.position.set(0, 0.08, 0.68);
    group.add(cheekRest);

    // Heavy 7.62mm Box Magazine with Glowing Bio-Ammo Window
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.42, 0.21), gunmetalMat);
    mag.position.set(0, -0.32, 0.02);
    mag.rotation.x = 0.14;
    const magWindow = new THREE.Mesh(
      new THREE.BoxGeometry(0.102, 0.24, 0.05),
      new THREE.MeshBasicMaterial({ color: 0xfacc15 })
    );
    mag.add(magWindow);
    group.add(mag);

    // Vertical Tactical Foregrip (Held by Left White Blood Cell Gloved Hand!)
    const foregrip = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.038, 0.2, 12), matteBlackMat);
    foregrip.position.set(0, -0.16, -0.36);
    group.add(foregrip);

    // Black Ops EOTech Holographic Reflex Sight with Glowing Cyan Bullseye Reticle
    const sightHood = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.15, 0.2), matteBlackMat);
    sightHood.position.set(0, 0.19, 0.06);
    group.add(sightHood);
    const sightGlass = new THREE.Mesh(
      new THREE.BoxGeometry(0.095, 0.105, 0.015),
      new THREE.MeshBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.65 })
    );
    sightGlass.position.set(0, 0.195, 0.06);
    group.add(sightGlass);
    const sightDot = new THREE.Mesh(
      new THREE.RingGeometry(0.014, 0.024, 16),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee, side: THREE.DoubleSide })
    );
    sightDot.position.set(0, 0.195, 0.07);
    group.add(sightDot);

    // Free-Float Barrel, Gas Block & 3-Prong Flash Suppressor
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.044, 0.58, 14), gunmetalMat);
    barrel.rotateX(Math.PI / 2);
    barrel.position.set(0, 0.02, -0.8);
    group.add(barrel);

    const flashHider = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.052, 0.18, 12), matteBlackMat);
    flashHider.rotateX(Math.PI / 2);
    flashHider.position.set(0, 0.02, -1.12);
    group.add(flashHider);

    // Pulsing Golden-Cyan Plasma Conduit along Receiver
    const core = new THREE.Mesh(
      new THREE.BoxGeometry(0.162, 0.038, 0.76),
      createFastLitMaterial({ color: 0xfacc15, emissive: 0xfacc15, emissiveIntensity: 2.4 })
    );
    core.position.set(0, 0.04, -0.08);
    group.add(core);

    return { group, core };

  } else if (weaponId === 'pump_shotgun') {
    // ==========================================================================
    // 2. SPAS-12 / EPIC TACTICAL PUMP SHOTGUN (Epic Purple + 12-Gauge Shell Rack)
    // ==========================================================================
    const epicPurpleMat = createFastLitMaterial({
      color: 0x7c3aed,
      roughness: 0.28,
      metalness: 0.78,
    });

    // Heavy Alloy Shotgun Receiver
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.23, 0.98), epicPurpleMat);
    group.add(body);

    // Perforated SPAS-12 Top Heat Shield shroud
    const heatShield = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.78), gunmetalMat);
    heatShield.position.set(0, 0.09, -0.58);
    group.add(heatShield);

    // Side-Mounted 5-Shell 12-Gauge Bandolier Saddle on Left & Right Receiver!
    const shellRedMat = createFastLitMaterial({ color: 0xdc2626, roughness: 0.35 });
    const brassMat = createFastLitMaterial({ color: 0xfacc15, metalness: 0.9, roughness: 0.2 });
    for (let s = 0; s < 5; s++) {
      const shell = new THREE.Group();
      shell.position.set(-0.095, 0.01, -0.18 + s * 0.095);
      const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.09, 10), shellRedMat);
      shell.add(hull);
      const brass = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.023, 0.03, 10), brassMat);
      brass.position.set(0, -0.045, 0);
      shell.add(brass);
      group.add(shell);
    }

    // Over-Under Heavy 12-Gauge Bore + Magazine Tube
    const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.78, 16), gunmetalMat);
    b1.rotateX(Math.PI / 2);
    b1.position.set(0, 0.06, -0.84);
    group.add(b1);

    const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.72, 14), matteBlackMat);
    b2.rotateX(Math.PI / 2);
    b2.position.set(0, -0.055, -0.8);
    group.add(b2);

    // Tactical Breacher Muzzle Choke with Glowing Violet Plasma Ring
    const choke = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.065, 0.16, 12), chromeSteelMat);
    choke.rotateX(Math.PI / 2);
    choke.position.set(0, 0.06, -1.24);
    group.add(choke);

    // CQB Ghost-Ring Reflex Sight on Top Rail
    const cqbSight = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.01, 8, 18), matteBlackMat);
    cqbSight.position.set(0, 0.17, 0.04);
    group.add(cqbSight);
    const cqbDot = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), new THREE.MeshBasicMaterial({ color: 0xa855f7 }));
    cqbDot.position.set(0, 0.17, 0.04);
    group.add(cqbDot);

    // Animated Ribbed Fore-End Pump Slide (Held by Left Gloved Hand!)
    const pumpSlide = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.082, 0.36, 16), matteBlackMat);
    pumpSlide.rotateX(Math.PI / 2);
    pumpSlide.position.set(0, -0.06, -0.38);
    group.add(pumpSlide);

    // Tactical Buttstock
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.48), matteBlackMat);
    stock.position.set(0, -0.06, 0.68);
    group.add(stock);

    return { group, pumpSlide };

  } else if (weaponId === 'bolt_sniper') {
    // ==========================================================================
    // 3. AWM / L115A3 BLACK OPS BOLT-ACTION HEAVY SNIPER RIFLE
    // ==========================================================================
    const sniperCyanMat = createFastLitMaterial({
      color: 0x0284c7,
      roughness: 0.25,
      metalness: 0.85,
    });

    // Precision Machined Chassis
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.155, 0.2, 1.18), sniperCyanMat);
    group.add(body);

    // Bolt-Action Handle with Tactical Spherical Knob on Right Side
    const boltStem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.11, 8), chromeSteelMat);
    boltStem.rotateZ(Math.PI / 2);
    boltStem.position.set(0.11, 0.05, 0.18);
    group.add(boltStem);
    const boltKnob = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 10), matteBlackMat);
    boltKnob.position.set(0.165, 0.05, 0.18);
    group.add(boltKnob);

    // Long Fluted Free-Float Bull Barrel + Massive .50 BMG Dual-Baffle Muzzle Brake
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.046, 1.18, 16), gunmetalMat);
    barrel.rotateX(Math.PI / 2);
    barrel.position.set(0, 0.04, -1.12);
    group.add(barrel);

    const sniperBrake = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.22), matteBlackMat);
    sniperBrake.position.set(0, 0.04, -1.74);
    group.add(sniperBrake);

    // Folding Tactical Bipod Under Forend
    [-0.08, 0.08].forEach((bx) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.34, 8), matteBlackMat);
      leg.rotateX(Math.PI / 2.2);
      leg.position.set(bx, -0.09, -0.75);
      group.add(leg);
    });

    // High-Magnification 12x Telescopic Sniper Scope with Dual Mount Rings & Turret Dials
    const scopeTube = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.56, 16), matteBlackMat);
    scopeTube.rotateX(Math.PI / 2);
    scopeTube.position.set(0, 0.23, -0.04);
    group.add(scopeTube);

    const objBell = new THREE.Mesh(new THREE.CylinderGeometry(0.076, 0.05, 0.22, 16), matteBlackMat);
    objBell.rotateX(Math.PI / 2);
    objBell.position.set(0, 0.23, -0.36);
    group.add(objBell);

    const eyeBell = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.064, 0.16, 16), matteBlackMat);
    eyeBell.rotateX(Math.PI / 2);
    eyeBell.position.set(0, 0.23, 0.26);
    group.add(eyeBell);

    // Glowing Cyan Multi-Coated Sniper Lenses
    const frontLens = new THREE.Mesh(
      new THREE.CircleGeometry(0.068, 16),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    frontLens.rotateY(Math.PI);
    frontLens.position.set(0, 0.23, -0.472);
    group.add(frontLens);

    const rearLens = new THREE.Mesh(
      new THREE.CircleGeometry(0.056, 16),
      new THREE.MeshBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.75 })
    );
    rearLens.position.set(0, 0.23, 0.342);
    group.add(rearLens);

    // Detachable .338 Lapua Box Magazine
    const sniperMag = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.26, 0.24), matteBlackMat);
    sniperMag.position.set(0, -0.2, 0.0);
    group.add(sniperMag);

    // Skeletonized Precision Buttstock
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.22, 0.52), sniperCyanMat);
    stock.position.set(0, -0.04, 0.74);
    group.add(stock);

    return { group };

  } else {
    // ==========================================================================
    // 4. BLACK OPS RPK / MG36 HEAVY DRUM MACHINE GUN (LMG)
    // ==========================================================================
    const lmgGreenMat = createFastLitMaterial({
      color: 0x15803d,
      roughness: 0.32,
      metalness: 0.76,
    });

    // Heavy Reinforced LMG Receiver
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.25, 1.12), lmgGreenMat);
    group.add(body);

    // Massive 100-Round Beta-C Twin Drum Magazine Underneath
    const drumLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.16, 20), matteBlackMat);
    drumLeft.rotateX(Math.PI / 2);
    drumLeft.position.set(-0.14, -0.28, -0.05);
    group.add(drumLeft);

    const drumRight = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.16, 20), matteBlackMat);
    drumRight.rotateX(Math.PI / 2);
    drumRight.position.set(0.14, -0.28, -0.05);
    group.add(drumRight);

    const ammoBeltGlow = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.06, 0.12),
      new THREE.MeshBasicMaterial({ color: 0x4ade80 })
    );
    ammoBeltGlow.position.set(0, -0.14, -0.05);
    group.add(ammoBeltGlow);

    // Perforated Heavy Cooling Barrel Jacket + Carry Handle + Muzzle Compensator
    const shroud = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.078, 0.72, 16), gunmetalMat);
    shroud.rotateX(Math.PI / 2);
    shroud.position.set(0, 0.02, -0.88);
    group.add(shroud);

    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.048, 0.22, 12), chromeSteelMat);
    muzzle.rotateX(Math.PI / 2);
    muzzle.position.set(0, 0.02, -1.32);
    group.add(muzzle);

    // Black Ops Target-Finder Reflex Optic on Top Rail
    const tfFrame = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.22), matteBlackMat);
    tfFrame.position.set(0, 0.2, 0.05);
    group.add(tfFrame);
    const tfGlass = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.095, 0.015),
      new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.65 })
    );
    tfGlass.position.set(0, 0.2, 0.05);
    group.add(tfGlass);

    // Heavy Buffer Stock
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.24, 0.48), matteBlackMat);
    stock.position.set(0, -0.04, 0.72);
    group.add(stock);

    return { group };
  }
}

// 8. BIO-CLUSTER FRAG GRENADE
export function createGrenadeModel(): THREE.Group {
  const group = new THREE.Group();

  // Pineapple fragmentation body
  const bodyGeo = new THREE.SphereGeometry(0.22, 12, 12);
  const bodyMat = createFastLitMaterial({
    color: 0x15803d,
    roughness: 0.5,
    metalness: 0.3,
    emissive: 0x22c55e,
    emissiveIntensity: 0.3,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  group.add(body);

  // Ribbed ribs
  const rib = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 6, 16), createFastLitMaterial({ color: 0x166534 }));
  group.add(rib);

  // Fuse Cap & Safety Lever
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.14, 8), createFastLitMaterial({ color: 0x334155, metalness: 0.9 }));
  cap.position.set(0, 0.25, 0);
  group.add(cap);

  // Glowing fuse blinking LED
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
  led.position.set(0, 0.32, 0);
  group.add(led);

  return group;
}

// Helper to create an authentic bulging burlap sandbag with tied ears & stitching
function createSingleSandbag(w: number, h: number, d: number, colorHex: number): THREE.Group {
  const bag = new THREE.Group();

  const bagMat = createFastLitMaterial({
    color: colorHex,
    roughness: 0.94,
    metalness: 0.04,
  });

  // Pillowed rounded sack body
  const bodyGeo = new THREE.CylinderGeometry(h * 0.52, h * 0.52, w * 0.85, 10);
  bodyGeo.rotateZ(Math.PI / 2);
  const body = new THREE.Mesh(bodyGeo, bagMat);
  body.scale.set(1.0, 1.0, d / (h * 0.52 * 2));
  bag.add(body);

  // Left puckered tied ear
  const tieMat = createFastLitMaterial({ color: 0x451a03, roughness: 0.9 });
  const lEar = new THREE.Mesh(new THREE.ConeGeometry(h * 0.38, 0.12, 6), bagMat);
  lEar.rotateZ(Math.PI / 2);
  lEar.position.set(-w * 0.46, 0, 0);
  bag.add(lEar);

  const lTie = new THREE.Mesh(new THREE.TorusGeometry(h * 0.3, 0.025, 4, 10), tieMat);
  lTie.rotateY(Math.PI / 2);
  lTie.position.set(-w * 0.42, 0, 0);
  bag.add(lTie);

  // Right puckered tied ear
  const rEar = new THREE.Mesh(new THREE.ConeGeometry(h * 0.38, 0.12, 6), bagMat);
  rEar.rotateZ(-Math.PI / 2);
  rEar.position.set(w * 0.46, 0, 0);
  bag.add(rEar);

  const rTie = new THREE.Mesh(new THREE.TorusGeometry(h * 0.3, 0.025, 4, 10), tieMat);
  rTie.rotateY(Math.PI / 2);
  rTie.position.set(w * 0.42, 0, 0);
  bag.add(rTie);

  // Top seam stitch line
  const seam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, w * 0.8, 6),
    new THREE.MeshBasicMaterial({ color: 0x3f2512 })
  );
  seam.rotateZ(Math.PI / 2);
  seam.position.set(0, h * 0.48, 0);
  bag.add(seam);

  return bag;
}

// 9. DEFENSIVE MILITARY SANDBAG BARRICADE (Low-Profile Waist-High Bunker with Center Firing Notch)
export function createSandbagBarricade(): {
  group: THREE.Group;
  hpBarFill: THREE.Mesh;
  bounds: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };
} {
  const group = new THREE.Group();

  const sandColors = [0xd4a373, 0xca8a04, 0xb4884d, 0x9a6b32];

  // Tier 1 (Bottom Row - 4 Sandbags)
  const xBottom = [-0.96, -0.32, 0.32, 0.96];
  xBottom.forEach((x, i) => {
    const bag = createSingleSandbag(0.66, 0.24, 0.42, sandColors[i % sandColors.length]);
    bag.position.set(x, -0.68, 0);
    bag.rotation.z = (Math.random() - 0.5) * 0.04;
    group.add(bag);
  });

  // Tier 2 (Middle Row - 3 Sandbags)
  const xMiddle = [-0.64, 0, 0.64];
  xMiddle.forEach((x, i) => {
    const bag = createSingleSandbag(0.66, 0.24, 0.42, sandColors[(i + 1) % sandColors.length]);
    bag.position.set(x, -0.46, 0.02);
    bag.rotation.z = (Math.random() - 0.5) * 0.04;
    group.add(bag);
  });

  // Tier 3 (Top Row - Split Left/Right with an open Center Firing Embrasure so player sights are never blocked!)
  const xTop = [-0.72, 0.72];
  xTop.forEach((x, i) => {
    const bag = createSingleSandbag(0.58, 0.22, 0.4, sandColors[(i + 2) % sandColors.length]);
    bag.position.set(x, -0.26, 0.03);
    bag.rotation.z = (Math.random() - 0.5) * 0.04;
    group.add(bag);
  });

  // Low Wooden Support Stakes on both sides (kept below top sandbag height)
  const stakeGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.75, 8);
  const stakeMat = createFastLitMaterial({ color: 0x78350f, roughness: 0.85 });

  const stakeL = new THREE.Mesh(stakeGeo, stakeMat);
  stakeL.position.set(-1.28, -0.45, 0.14);
  stakeL.rotation.z = 0.06;
  group.add(stakeL);

  const stakeR = new THREE.Mesh(stakeGeo, stakeMat);
  stakeR.position.set(1.28, -0.45, 0.14);
  stakeR.rotation.z = -0.06;
  group.add(stakeR);

  // Barbed Wire Coil across the front base
  const wireGeo = new THREE.TorusGeometry(0.15, 0.012, 6, 14);
  const wireMat = createFastLitMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 });
  for (let w = -1.0; w <= 1.0; w += 0.4) {
    const coil = new THREE.Mesh(wireGeo, wireMat);
    coil.position.set(w, -0.74, 0.26);
    coil.rotateY(0.4);
    group.add(coil);
  }

  // Embedded 3D Barricade Health Bar mounted on the middle sandbag face (never obstructs sightline!)
  const hpBg = new THREE.Mesh(
    new THREE.PlaneGeometry(1.45, 0.11),
    new THREE.MeshBasicMaterial({ color: 0x09090b, side: THREE.DoubleSide })
  );
  hpBg.position.set(0, -0.35, 0.25);
  group.add(hpBg);

  const hpBarFill = new THREE.Mesh(
    new THREE.PlaneGeometry(1.38, 0.07),
    new THREE.MeshBasicMaterial({ color: 0x22c55e, side: THREE.DoubleSide })
  );
  hpBarFill.position.set(0, -0.35, 0.26);
  group.add(hpBarFill);

  group.scale.set(0.82, 0.82, 0.82);

  return {
    group,
    hpBarFill,
    bounds: {
      minX: -1.15,
      maxX: 1.15,
      minY: -0.9,
      maxY: 1.35, // Generous vertical shield height so standing behind cover blocks enemy projectiles
      minZ: -0.5,
      maxZ: 0.5,
    },
  };
}

// 10. WW2 C-47 SKYTRAIN / DAKOTA D-DAY PARATROOPER AIRDROP PLANE (Modeled directly after IMG_5380_4583916b.webp!)
export function createTacticalAirdropPlane(): {
  group: THREE.Group;
  propellers: THREE.Mesh[];
  leftNavLight: THREE.Mesh;
  rightNavLight: THREE.Mesh;
} {
  const group = new THREE.Group();

  // Olive-Drab WW2 USAAF Fuselage & Wing Palette from IMG_5380
  const oliveDrabMat = createFastLitMaterial({
    color: 0x575325, // Authentic WW2 Olive-Drab green-brown
    roughness: 0.45,
    metalness: 0.35,
  });
  const oliveDarkMat = createFastLitMaterial({
    color: 0x3b3818,
    roughness: 0.55,
    metalness: 0.3,
  });
  const stripeWhiteMat = createFastLitMaterial({
    color: 0xf8fafc,
    roughness: 0.3,
    metalness: 0.15,
  });
  const stripeBlackMat = createFastLitMaterial({
    color: 0x0f172a,
    roughness: 0.4,
    metalness: 0.2,
  });
  const cockpitYellowMat = new THREE.MeshBasicMaterial({
    color: 0xfacc15, // Bright Yellow Cockpit Windshield Glass from IMG_5380
  });

  // 1. Cylindrical C-47 Dakota Main Fuselage (Length: 9.0 units along Z)
  const fuselageGeo = new THREE.CylinderGeometry(0.96, 0.88, 7.2, 12);
  fuselageGeo.rotateX(Math.PI / 2);
  const fuselage = new THREE.Mesh(fuselageGeo, oliveDrabMat);
  fuselage.position.set(0, 0.1, 0.2);
  group.add(fuselage);

  // Rounded Streamlined Nose Cone
  const noseGeo = new THREE.SphereGeometry(0.95, 12, 10);
  noseGeo.scale(0.95, 0.82, 1.65);
  const nose = new THREE.Mesh(noseGeo, oliveDrabMat);
  nose.position.set(0, 0.02, 3.8);
  group.add(nose);

  // Tapered Rear Tail Cone
  const tailConeGeo = new THREE.CylinderGeometry(0.88, 0.32, 2.6, 12);
  tailConeGeo.rotateX(Math.PI / 2);
  const tailCone = new THREE.Mesh(tailConeGeo, oliveDrabMat);
  tailCone.position.set(0, 0.14, -4.5);
  group.add(tailCone);

  // 2. Signature Bright Yellow Split Cockpit Windshield Windows (IMG_5380)
  [-0.32, 0.32].forEach((wx) => {
    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.28, 0.42), cockpitYellowMat);
    pane.position.set(wx, 0.58, 3.85);
    pane.rotation.x = -0.35;
    pane.rotation.y = wx < 0 ? -0.22 : 0.22;
    group.add(pane);
  });

  // 3 White Dorsal Radio / ADF Whip Antennas on Upper Forward Roof
  [2.9, 1.9, 1.1].forEach((az, idx) => {
    const mast = new THREE.Mesh(
      new THREE.ConeGeometry(0.06, idx === 0 ? 0.42 : 0.3, 8),
      stripeWhiteMat
    );
    mast.position.set(0, 1.12, az);
    mast.rotation.x = -0.25;
    group.add(mast);
  });

  // 3. Row of 6 Dark Square Troop Cabin Windows + Paratrooper Jump Door on Both Sides
  [2.1, 1.35, 0.6, -0.15, -0.9].forEach((wz) => {
    const win = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.26, 0.34), stripeBlackMat);
    win.position.set(0, 0.18, wz);
    group.add(win);
  });
  const cargoWindow = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.28, 0.78), stripeBlackMat);
  cargoWindow.position.set(0, 0.18, -1.85);
  group.add(cargoWindow);

  // 4. D-Day Black-and-White Invasion Stripes on Rear Fuselage + USAAF Star-and-Bars Insignia!
  const fuselageStripeOffsets = [
    { z: -2.65, mat: stripeWhiteMat },
    { z: -2.95, mat: stripeBlackMat },
    { z: -3.25, mat: stripeWhiteMat },
    { z: -3.55, mat: stripeBlackMat },
    { z: -3.85, mat: stripeWhiteMat },
  ];
  fuselageStripeOffsets.forEach((st) => {
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.91, 0.89, 0.3, 18),
      st.mat
    );
    band.rotateX(Math.PI / 2);
    band.position.set(0, 0.11, st.z);
    group.add(band);
  });

  // USAAF Star-and-Bars Roundel on Both Sides of Rear Fuselage
  [-0.92, 0.92].forEach((sx) => {
    const roundelDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 0.05, 16),
      new THREE.MeshBasicMaterial({ color: 0x1e293b })
    );
    roundelDisc.rotateZ(Math.PI / 2);
    roundelDisc.position.set(sx, 0.12, -3.25);
    group.add(roundelDisc);

    const whiteBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.22, 1.15),
      stripeWhiteMat
    );
    whiteBar.position.set(sx, 0.12, -3.25);
    group.add(whiteBar);

    const starCenter = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.26, 0),
      stripeWhiteMat
    );
    starCenter.scale.set(0.22, 1, 1);
    starCenter.position.set(sx < 0 ? sx - 0.02 : sx + 0.02, 0.12, -3.25);
    group.add(starCenter);
  });

  // 5. Low-Mounted Swept Tapered C-47 Wings (16.4 units wingspan) with D-Day Invasion Stripes!
  const wingGeo = new THREE.BoxGeometry(16.4, 0.22, 2.35);
  const wings = new THREE.Mesh(wingGeo, oliveDrabMat);
  wings.position.set(0, -0.32, 0.65);
  group.add(wings);

  // D-Day Black & White Invasion Stripes on Both Left & Right Wings (Outboard of Engines)
  [-1, 1].forEach((side) => {
    [
      { offset: 3.55, mat: stripeWhiteMat },
      { offset: 4.0, mat: stripeBlackMat },
      { offset: 4.45, mat: stripeWhiteMat },
      { offset: 4.9, mat: stripeBlackMat },
      { offset: 5.35, mat: stripeWhiteMat },
    ].forEach((ws) => {
      const wStripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.44, 0.24, 2.38),
        ws.mat
      );
      wStripe.position.set(side * ws.offset, -0.32, 0.65);
      group.add(wStripe);
    });
  });

  // 6. Twin Radial Engine Nacelles + Blue Spinning Propeller Discs with Golden-Orange Rim (IMG_5380!)
  const enginePositions = [-2.35, 2.35];
  const propellers: THREE.Mesh[] = [];

  enginePositions.forEach((xPos) => {
    // Olive-Drab Engine Nacelle Fairing
    const nacelle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.56, 0.48, 2.1, 10),
      oliveDrabMat
    );
    nacelle.rotateX(Math.PI / 2);
    nacelle.position.set(xPos, -0.25, 1.55);
    group.add(nacelle);

    // Dark Radial Engine Cowling Ring
    const cowling = new THREE.Mesh(
      new THREE.CylinderGeometry(0.57, 0.57, 0.45, 10),
      stripeBlackMat
    );
    cowling.rotateX(Math.PI / 2);
    cowling.position.set(xPos, -0.25, 2.55);
    group.add(cowling);

    // Silver Propeller Hub Spinner
    const spinner = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.45, 8),
      stripeWhiteMat
    );
    spinner.rotateX(Math.PI / 2);
    spinner.position.set(xPos, -0.25, 2.95);
    group.add(spinner);

    // Translucent Sky-Blue Motion-Blur Propeller Disc with Golden-Orange Outer Ring (Exact match to IMG_5380!)
    const bluePropDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(1.18, 1.18, 0.03, 14),
      new THREE.MeshBasicMaterial({
        color: 0x3b82f6,
        transparent: true,
        opacity: 0.68,
      })
    );
    bluePropDisc.rotateX(Math.PI / 2);
    bluePropDisc.position.set(xPos, -0.25, 2.84);
    group.add(bluePropDisc);

    const orangePropRim = new THREE.Mesh(
      new THREE.TorusGeometry(1.18, 0.065, 6, 16),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b })
    );
    orangePropRim.position.set(xPos, -0.25, 2.84);
    group.add(orangePropRim);

    // Spinning Crossed Blades inside the Blue Disc
    const propGroup = new THREE.Group();
    propGroup.position.set(xPos, -0.25, 2.86);
    const bladeGeo = new THREE.BoxGeometry(2.15, 0.16, 0.04);
    const blade1 = new THREE.Mesh(bladeGeo, stripeBlackMat);
    const blade2 = new THREE.Mesh(bladeGeo, stripeBlackMat);
    blade2.rotateZ(Math.PI / 2);
    propGroup.add(blade1);
    propGroup.add(blade2);
    group.add(propGroup);
    propellers.push(blade1, blade2);
  });

  // 7. Rounded C-47 Vertical Tail Fin, Low Horizontal Stabilizers & Rear Tailwheel
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.55, 2.15), oliveDrabMat);
  fin.position.set(0, 1.35, -4.65);
  fin.rotation.x = -0.22;
  group.add(fin);

  const hStab = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.16, 1.45), oliveDrabMat);
  hStab.position.set(0, 0.22, -4.85);
  group.add(hStab);

  const tailWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.16, 12), oliveDarkMat);
  tailWheel.rotateZ(Math.PI / 2);
  tailWheel.position.set(0, -0.52, -4.4);
  group.add(tailWheel);

  // Flashing Wingtip Navigation Lights (Red Left, Green Right)
  const leftNavLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xef4444 })
  );
  leftNavLight.position.set(-8.15, -0.32, 0.65);
  group.add(leftNavLight);

  const rightNavLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0x22c55e })
  );
  rightNavLight.position.set(8.15, -0.32, 0.65);
  group.add(rightNavLight);

  return { group, propellers, leftNavLight, rightNavLight };
}

// 11. PARACHUTING ALLIED WHITE BLOOD CELL COMMANDO
export function createAlliedWBCCommando(isLeft: boolean): {
  group: THREE.Group;
  parachuteGroup: THREE.Group;
  leftRifle: THREE.Mesh;
  rightRifle: THREE.Mesh;
} {
  const group = new THREE.Group();

  // White Blood Cell Body (Amoeboid Pearl White)
  const bodyGeo = new THREE.SphereGeometry(0.75, 18, 18);
  const bodyMat = createFastLitMaterial({
    color: 0xf8fafc,
    roughness: 0.25,
    metalness: 0.1,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.2,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  group.add(body);

  // UN/NATO Elite Blue Commando Beret
  const beretGeo = new THREE.CylinderGeometry(0.55, 0.62, 0.2, 16);
  const beretMat = createFastLitMaterial({ color: 0x0284c7, roughness: 0.5 });
  const beret = new THREE.Mesh(beretGeo, beretMat);
  beret.position.set(0.1, 0.68, 0);
  beret.rotation.z = -0.28;
  group.add(beret);

  const beretBadge = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.14, 0.04),
    createFastLitMaterial({ color: 0xfacc15, metalness: 0.9 })
  );
  beretBadge.position.set(0.08, 0.68, 0.58);
  group.add(beretBadge);

  // Tactical Ballistic Sunglasses
  const shades = new THREE.Mesh(
    new THREE.BoxGeometry(0.65, 0.2, 0.15),
    createFastLitMaterial({ color: 0x09090b, roughness: 0.1, metalness: 0.9 })
  );
  shades.position.set(0, 0.16, 0.7);
  group.add(shades);

  // Tactical Body Armor Vest
  const vest = new THREE.Mesh(
    new THREE.CylinderGeometry(0.78, 0.8, 0.55, 16),
    createFastLitMaterial({ color: 0x1e293b, roughness: 0.6 })
  );
  vest.position.set(0, -0.15, 0);
  group.add(vest);

  // Limbs
  const limbMat = createFastLitMaterial({ color: 0xe2e8f0 });
  const bootMat = createFastLitMaterial({ color: 0x0f172a, roughness: 0.7 });

  // Kneeling Combat Legs
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.35, -0.6, 0);
  leftLeg.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.55, 6, 8), limbMat));
  const lb = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.32), bootMat);
  lb.position.set(0, -0.4, 0.1);
  leftLeg.add(lb);
  group.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.35, -0.6, 0);
  rightLeg.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.55, 6, 8), limbMat));
  const rb = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.32), bootMat);
  rb.position.set(0, -0.4, 0.1);
  rightLeg.add(rb);
  group.add(rightLeg);

  // Arms holding Tactical Rifles
  const gunMat = createFastLitMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.2 });

  const leftArm = new THREE.Group();
  leftArm.position.set(-0.8, -0.05, 0.2);
  leftArm.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.55, 6, 8), limbMat));
  const leftRifle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.8), gunMat);
  leftRifle.position.set(0.1, -0.25, 0.35);
  leftArm.add(leftRifle);
  group.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.8, -0.05, 0.2);
  rightArm.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.55, 6, 8), limbMat));
  const rightRifle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.8), gunMat);
  rightRifle.position.set(-0.1, -0.25, 0.35);
  rightArm.add(rightRifle);
  group.add(rightArm);

  // Parachute Assembly (Detachable when landing)
  const parachuteGroup = new THREE.Group();
  parachuteGroup.position.set(0, 1.8, 0);

  // Dome Canopy
  const canopyGeo = new THREE.SphereGeometry(1.6, 16, 10, 0, Math.PI * 2, 0, Math.PI / 1.9);
  canopyGeo.rotateX(Math.PI);
  const canopyMat = createFastLitMaterial({
    color: isLeft ? 0x15803d : 0x0369a1,
    roughness: 0.8,
    side: THREE.DoubleSide,
  });
  const canopy = new THREE.Mesh(canopyGeo, canopyMat);
  canopy.position.set(0, 1.2, 0);
  parachuteGroup.add(canopy);

  // 4 Paracord lines
  const cordMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const cordGeo = new THREE.CylinderGeometry(0.015, 0.015, 1.4, 4);
  [-0.6, 0.6].forEach((xCord) => {
    [-0.6, 0.6].forEach((zCord) => {
      const cord = new THREE.Mesh(cordGeo, cordMat);
      cord.position.set(xCord * 0.7, 0.5, zCord * 0.7);
      parachuteGroup.add(cord);
    });
  });

  group.add(parachuteGroup);

  return { group, parachuteGroup, leftRifle, rightRifle };
}

// 10. REALISTIC 3D SPITZER RIFLE CARTRIDGE & HEAVY FIN-STABILIZED TANK ARTILLERY SHELL WITH SUPERSONIC BULLET RACE STREAKS!
// Shared cached projectile geometries & materials to prevent per-shot GPU allocations
const _sharedProj = {
  tankOliveWarheadMat: createFastLitMaterial({
    color: 0x857f4e,
    emissive: 0x4d4929,
    emissiveIntensity: 0.45,
    metalness: 0.82,
    roughness: 0.22,
  }),
  tankBrassCasingMat: createFastLitMaterial({
    color: 0x6b7035,
    metalness: 0.85,
    roughness: 0.28,
  }),
  tankSteelFinMat: createFastLitMaterial({
    color: 0xcbd5e1,
    metalness: 0.9,
    roughness: 0.2,
  }),
  tankCrimpMat: new THREE.MeshBasicMaterial({ color: 0x09090b }),
  tankMachMat0: new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.85 }),
  tankMachMat1: new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.55 }),
  tankFlameMat: new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.94 }),
  tankRaceOuterMat: new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.62 }),
  tankRaceInnerMat: new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.9 }),
  tankTipGeo: new THREE.ConeGeometry(0.145, 0.56, 8),
  tankMidGeo: new THREE.CylinderGeometry(0.145, 0.135, 0.42, 8),
  tankCrimpGeo: new THREE.CylinderGeometry(0.15, 0.15, 0.05, 8),
  tankRearGeo: new THREE.CylinderGeometry(0.155, 0.16, 0.48, 8),
  tankFinGeo: new THREE.BoxGeometry(0.46, 0.028, 0.28),
  tankMachGeo0: new THREE.TorusGeometry(0.24, 0.025, 6, 12),
  tankMachGeo1: new THREE.TorusGeometry(0.19, 0.025, 6, 12),
  tankFlameGeo: new THREE.ConeGeometry(0.13, 0.85, 8),
  tankRaceOuterGeo: new THREE.CylinderGeometry(0.085, 0.012, 4.4, 6),
  tankRaceInnerGeo: new THREE.CylinderGeometry(0.04, 0.006, 3.6, 6),

  bulletSteelTipMat: createFastLitMaterial({
    color: 0xd1d5db,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.35,
    metalness: 0.92,
    roughness: 0.15,
  }),
  bulletBrassNeckMat: createFastLitMaterial({
    color: 0xb48a3e,
    emissive: 0xca8a04,
    emissiveIntensity: 0.35,
    metalness: 0.88,
    roughness: 0.2,
  }),
  bulletVaporMat: new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.78 }),
  bulletTailMat: new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.92 }),
  bulletRaceGlowMat: new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.65 }),
  bulletRaceCoreMat: new THREE.MeshBasicMaterial({ color: 0xfef9c3, transparent: true, opacity: 0.92 }),
  bulletNoseGeo: new THREE.ConeGeometry(0.082, 0.34, 8),
  bulletBodyGeo: new THREE.CylinderGeometry(0.082, 0.072, 0.28, 8),
  bulletCollarGeo: new THREE.CylinderGeometry(0.088, 0.088, 0.07, 8),
  bulletTailStemGeo: new THREE.CylinderGeometry(0.068, 0.074, 0.26, 8),
  bulletFinGeo: new THREE.BoxGeometry(0.21, 0.018, 0.12),
  bulletVaporGeo: new THREE.TorusGeometry(0.125, 0.014, 6, 10),
  bulletTracerGeo: new THREE.ConeGeometry(0.068, 0.55, 6),
  bulletRaceGlowGeo: new THREE.CylinderGeometry(0.046, 0.006, 3.4, 6),
  bulletRaceCoreGeo: new THREE.CylinderGeometry(0.022, 0.003, 2.8, 6),

  playerSteelCaseMat: createFastLitMaterial({
    color: 0xe2e8f0,
    metalness: 0.9,
    roughness: 0.18,
  }),
  playerTrailMat: new THREE.MeshBasicMaterial({ color: 0xfef9c3, transparent: true, opacity: 0.92 }),
  playerRaceCoreMat: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 }),
  playerTipGeo: new THREE.ConeGeometry(0.055, 0.28, 8),
  playerShankGeo: new THREE.CylinderGeometry(0.055, 0.048, 0.22, 8),
  playerMachGeo: new THREE.TorusGeometry(0.095, 0.012, 6, 10),
  playerTrailGeo: new THREE.ConeGeometry(0.052, 0.85, 6),
  playerRaceOuterGeo: new THREE.CylinderGeometry(0.042, 0.005, 4.6, 6),
  playerRaceCoreGeo: new THREE.CylinderGeometry(0.018, 0.002, 3.8, 6),
};

const _playerAccentMatCache = new Map<
  number,
  { tipMat: THREE.MeshLambertMaterial; machMat: THREE.MeshBasicMaterial; raceMat: THREE.MeshBasicMaterial }
>();

function getPlayerTracerMats(accentColorHex: number) {
  let cached = _playerAccentMatCache.get(accentColorHex);
  if (!cached) {
    cached = {
      tipMat: createFastLitMaterial({
        color: 0xfbbf24,
        emissive: accentColorHex,
        emissiveIntensity: 0.55,
        metalness: 0.95,
        roughness: 0.12,
      }),
      machMat: new THREE.MeshBasicMaterial({ color: accentColorHex, transparent: true, opacity: 0.78 }),
      raceMat: new THREE.MeshBasicMaterial({ color: accentColorHex, transparent: true, opacity: 0.72 }),
    };
    _playerAccentMatCache.set(accentColorHex, cached);
  }
  return cached;
}

export function createEnemyBulletMesh(isTank: boolean): THREE.Group {
  const group = new THREE.Group();

  if (isTank) {
    const tipCone = new THREE.Mesh(_sharedProj.tankTipGeo, _sharedProj.tankOliveWarheadMat);
    tipCone.rotateX(Math.PI / 2);
    tipCone.position.set(0, 0, 0.52);
    group.add(tipCone);

    const midWarhead = new THREE.Mesh(_sharedProj.tankMidGeo, _sharedProj.tankOliveWarheadMat);
    midWarhead.rotateX(Math.PI / 2);
    midWarhead.position.set(0, 0, 0.03);
    group.add(midWarhead);

    const crimpRing = new THREE.Mesh(_sharedProj.tankCrimpGeo, _sharedProj.tankCrimpMat);
    crimpRing.rotateX(Math.PI / 2);
    crimpRing.position.set(0, 0, -0.18);
    group.add(crimpRing);

    const rearCasing = new THREE.Mesh(_sharedProj.tankRearGeo, _sharedProj.tankBrassCasingMat);
    rearCasing.rotateX(Math.PI / 2);
    rearCasing.position.set(0, 0, -0.44);
    group.add(rearCasing);

    for (let i = 0; i < 4; i++) {
      const fin = new THREE.Mesh(_sharedProj.tankFinGeo, _sharedProj.tankSteelFinMat);
      fin.position.set(0, 0, -0.54);
      fin.rotation.z = (i * Math.PI) / 2;
      group.add(fin);
    }

    const machRing0 = new THREE.Mesh(_sharedProj.tankMachGeo0, _sharedProj.tankMachMat0);
    machRing0.position.set(0, 0, -0.2);
    group.add(machRing0);

    const machRing1 = new THREE.Mesh(_sharedProj.tankMachGeo1, _sharedProj.tankMachMat1);
    machRing1.position.set(0, 0, -1.1);
    group.add(machRing1);

    const flameCore = new THREE.Mesh(_sharedProj.tankFlameGeo, _sharedProj.tankFlameMat);
    flameCore.rotateX(-Math.PI / 2);
    flameCore.position.set(0, 0, -1.05);
    group.add(flameCore);

    const raceOuter = new THREE.Mesh(_sharedProj.tankRaceOuterGeo, _sharedProj.tankRaceOuterMat);
    raceOuter.rotateX(Math.PI / 2);
    raceOuter.position.set(0, 0, -2.85);
    group.add(raceOuter);

    const raceInner = new THREE.Mesh(_sharedProj.tankRaceInnerGeo, _sharedProj.tankRaceInnerMat);
    raceInner.rotateX(Math.PI / 2);
    raceInner.position.set(0, 0, -2.45);
    group.add(raceInner);
  } else {
    const noseCone = new THREE.Mesh(_sharedProj.bulletNoseGeo, _sharedProj.bulletSteelTipMat);
    noseCone.rotateX(Math.PI / 2);
    noseCone.position.set(0, 0, 0.36);
    group.add(noseCone);

    const bulletBody = new THREE.Mesh(_sharedProj.bulletBodyGeo, _sharedProj.bulletSteelTipMat);
    bulletBody.rotateX(Math.PI / 2);
    bulletBody.position.set(0, 0, 0.05);
    group.add(bulletBody);

    const collar = new THREE.Mesh(_sharedProj.bulletCollarGeo, _sharedProj.bulletBrassNeckMat);
    collar.rotateX(Math.PI / 2);
    collar.position.set(0, 0, -0.12);
    group.add(collar);

    const tailStem = new THREE.Mesh(_sharedProj.bulletTailStemGeo, _sharedProj.bulletBrassNeckMat);
    tailStem.rotateX(Math.PI / 2);
    tailStem.position.set(0, 0, -0.28);
    group.add(tailStem);

    for (let i = 0; i < 4; i++) {
      const microFin = new THREE.Mesh(_sharedProj.bulletFinGeo, _sharedProj.bulletSteelTipMat);
      microFin.position.set(0, 0, -0.35);
      microFin.rotation.z = (i * Math.PI) / 2;
      group.add(microFin);
    }

    const vaporRing = new THREE.Mesh(_sharedProj.bulletVaporGeo, _sharedProj.bulletVaporMat);
    vaporRing.position.set(0, 0, -0.22);
    group.add(vaporRing);

    const tracerTail = new THREE.Mesh(_sharedProj.bulletTracerGeo, _sharedProj.bulletTailMat);
    tracerTail.rotateX(-Math.PI / 2);
    tracerTail.position.set(0, 0, -0.66);
    group.add(tracerTail);

    const bulletRaceGlow = new THREE.Mesh(_sharedProj.bulletRaceGlowGeo, _sharedProj.bulletRaceGlowMat);
    bulletRaceGlow.rotateX(Math.PI / 2);
    bulletRaceGlow.position.set(0, 0, -2.08);
    group.add(bulletRaceGlow);

    const bulletRaceCore = new THREE.Mesh(_sharedProj.bulletRaceCoreGeo, _sharedProj.bulletRaceCoreMat);
    bulletRaceCore.rotateX(Math.PI / 2);
    bulletRaceCore.position.set(0, 0, -1.78);
    group.add(bulletRaceCore);
  }

  return group;
}

// 10B. PLAYER & ALLIED 3D POINTED SPITZER BULLET PROJECTILE WITH SUPERSONIC BULLET RACE STREAK!
export function createPlayerBulletTracerMesh(accentColorHex = 0x38bdf8): THREE.Group {
  const group = new THREE.Group();
  const mats = getPlayerTracerMats(accentColorHex);

  const tip = new THREE.Mesh(_sharedProj.playerTipGeo, mats.tipMat);
  tip.rotateX(Math.PI / 2);
  tip.position.set(0, 0, 0.24);
  group.add(tip);

  const shank = new THREE.Mesh(_sharedProj.playerShankGeo, _sharedProj.playerSteelCaseMat);
  shank.rotateX(Math.PI / 2);
  shank.position.set(0, 0, -0.01);
  group.add(shank);

  const machRing = new THREE.Mesh(_sharedProj.playerMachGeo, mats.machMat);
  machRing.position.set(0, 0, -0.08);
  group.add(machRing);

  const trail = new THREE.Mesh(_sharedProj.playerTrailGeo, _sharedProj.playerTrailMat);
  trail.rotateX(-Math.PI / 2);
  trail.position.set(0, 0, -0.52);
  group.add(trail);

  const raceOuter = new THREE.Mesh(_sharedProj.playerRaceOuterGeo, mats.raceMat);
  raceOuter.rotateX(Math.PI / 2);
  raceOuter.position.set(0, 0, -2.42);
  group.add(raceOuter);

  const raceCore = new THREE.Mesh(_sharedProj.playerRaceCoreGeo, _sharedProj.playerRaceCoreMat);
  raceCore.rotateX(Math.PI / 2);
  raceCore.position.set(0, 0, -2.02);
  group.add(raceCore);

  return group;
}

export function setPlayerBulletTracerColor(group: THREE.Group, accentColorHex: number) {
  const mats = getPlayerTracerMats(accentColorHex);
  const tip = group.children[0] as THREE.Mesh | undefined;
  const machRing = group.children[2] as THREE.Mesh | undefined;
  const raceOuter = group.children[4] as THREE.Mesh | undefined;
  if (tip) tip.material = mats.tipMat;
  if (machRing) machRing.material = mats.machMat;
  if (raceOuter) raceOuter.material = mats.raceMat;
}

// 11. PHASE 1 BOSS: AH-64 APACHE / HUEY BIO-GUNSHIP ATTACK HELICOPTER (8+ Hits to destroy)
export function createBacteriaHelicopter(): {
  group: THREE.Group;
  mainRotor: THREE.Group;
  tailRotor: THREE.Group;
  guns: THREE.Mesh[];
} {
  const group = new THREE.Group();

  const oliveDrabMat = createFastLitMaterial({
    color: 0x2e4c2b, // Authentic military olive-drab gunship green
    roughness: 0.42,
    metalness: 0.45,
  });
  const bellyArmorMat = createFastLitMaterial({
    color: 0x1e293b, // Dark armored gunship belly & engine cowling
    roughness: 0.35,
    metalness: 0.75,
  });
  const darkMetalMat = createFastLitMaterial({
    color: 0x0f172a,
    roughness: 0.28,
    metalness: 0.88,
  });
  const yellowAccentMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
  const glassMat = createFastLitMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.25,
    transparent: true,
    opacity: 0.62,
    roughness: 0.12,
    metalness: 0.3,
  });

  // 1. SLEEK ANGULAR GUNSHIP FUSELAGE (Narrower width so side profile, skids & stub wings stand out!)
  const lowerHull = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.58, 2.7), oliveDrabMat);
  lowerHull.position.set(0, -0.1, 0.15);
  group.add(lowerHull);

  // Tapered Aerodynamic Nose Cone
  const noseCone = new THREE.Mesh(new THREE.ConeGeometry(0.52, 1.15, 6), oliveDrabMat);
  noseCone.rotateX(Math.PI / 2);
  noseCone.scale.set(0.92, 0.72, 1.0);
  noseCone.position.set(0, -0.14, 1.95);
  group.add(noseCone);

  // Chin-Mounted TADS/FLIR Sensor Turret Ball + 30mm M230 Chain Gun under the nose
  const sensorBall = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 12), bellyArmorMat);
  sensorBall.position.set(0, -0.22, 2.38);
  group.add(sensorBall);

  const flirLens = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xef4444 })
  );
  flirLens.position.set(0, -0.22, 2.56);
  group.add(flirLens);

  const chinGunMount = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.35), darkMetalMat);
  chinGunMount.position.set(0, -0.46, 1.55);
  group.add(chinGunMount);

  const chinGunBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.15, 8), darkMetalMat);
  chinGunBarrel.rotateX(Math.PI / 2);
  chinGunBarrel.position.set(0, -0.48, 2.15);
  group.add(chinGunBarrel);

  // 2. STEPPED TANDEM ARMORED GLASS COCKPIT CANOPY (Front Gunner + Elevated Rear Pilot)
  // Front gunner windshield (angled flat glass pane)
  const frontGlass = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.42, 0.85), glassMat);
  frontGlass.position.set(0, 0.28, 1.05);
  frontGlass.rotation.x = 0.38;
  group.add(frontGlass);

  // Rear elevated pilot canopy
  const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.48, 1.15), glassMat);
  rearGlass.position.set(0, 0.46, 0.15);
  rearGlass.rotation.x = 0.12;
  group.add(rearGlass);

  // Armored Canopy Frame Bars (gives unmistakable military helicopter cockpit look)
  [-0.39, 0, 0.39].forEach((fx) => {
    const frameBar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.52, 1.85), darkMetalMat);
    frameBar.position.set(fx, 0.38, 0.55);
    frameBar.rotation.x = 0.22;
    group.add(frameBar);
  });

  // Glowing HUD Instrument Panel & Pilots inside Cockpit
  const hudGlow = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.12, 0.08),
    new THREE.MeshBasicMaterial({ color: 0x22c55e })
  );
  hudGlow.position.set(0, 0.22, 1.22);
  group.add(hudGlow);

  // Front Gunner & Rear Pilot with Visor Helmets
  [
    { y: 0.24, z: 0.85 },
    { y: 0.42, z: 0.05 },
  ].forEach((pPos) => {
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 10), oliveDrabMat);
    helmet.position.set(0, pPos.y, pPos.z);
    group.add(helmet);

    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.1, 0.14),
      createFastLitMaterial({ color: 0xfacc15, metalness: 0.9, roughness: 0.1 })
    );
    visor.position.set(0, pPos.y, pPos.z + 0.14);
    group.add(visor);
  });

  // 3. TWIN TURBOSHAFT ENGINE NACELLES ON UPPER SPINE
  [-0.58, 0.58].forEach((ex) => {
    const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 1.45, 10), bellyArmorMat);
    nacelle.rotateX(Math.PI / 2);
    nacelle.position.set(ex, 0.32, -0.25);
    group.add(nacelle);

    // Jet intake ring in front of nacelle
    const intake = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.12, 10), darkMetalMat);
    intake.rotateX(Math.PI / 2);
    intake.position.set(ex, 0.32, 0.48);
    group.add(intake);
  });

  // Upper Rotor Pylon Spine housing
  const rotorDoghouse = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.36, 1.3), oliveDrabMat);
  rotorDoghouse.position.set(0, 0.62, -0.15);
  group.add(rotorDoghouse);

  // 4. OVERHEAD MAIN ROTOR ASSEMBLY (4 Wide Blades with Yellow Tips + Motion Blur Rotor Disc)
  const mainRotor = new THREE.Group();
  mainRotor.position.set(0, 1.02, -0.1);
  // Slight forward tilt on the rotor mast so the player clearly sees the spinning rotor disc & blades!
  mainRotor.rotation.x = 0.16;

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.48, 10), darkMetalMat);
  mainRotor.add(mast);

  const swashplate = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.1, 12), bellyArmorMat);
  swashplate.position.set(0, 0.2, 0);
  mainRotor.add(swashplate);

  // Translucent High-Speed Motion-Blur Rotor Disc (makes helicopter silhouette unmistakable!)
  const rotorDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(2.65, 2.65, 0.015, 16),
    new THREE.MeshBasicMaterial({
      color: 0x94a3b8,
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
    })
  );
  rotorDisc.position.set(0, 0.22, 0);
  mainRotor.add(rotorDisc);

  // Outer warning ring on rotor disc
  const rotorRing = new THREE.Mesh(
    new THREE.RingGeometry(2.48, 2.65, 18),
    new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
    })
  );
  rotorRing.rotateX(Math.PI / 2);
  rotorRing.position.set(0, 0.23, 0);
  mainRotor.add(rotorRing);

  // 4 Heavy Main Rotor Blades (5.2 units span!) with bright yellow hazard tips
  for (let i = 0; i < 4; i++) {
    const bladeGroup = new THREE.Group();
    bladeGroup.position.set(0, 0.22, 0);
    bladeGroup.rotation.y = (i * Math.PI) / 2;

    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.035, 2.45), darkMetalMat);
    blade.position.set(0, 0, 1.25);
    bladeGroup.add(blade);

    const bladeTip = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.04, 0.28), yellowAccentMat);
    bladeTip.position.set(0, 0, 2.5);
    bladeGroup.add(bladeTip);

    mainRotor.add(bladeGroup);
  }
  group.add(mainRotor);

  // 5. LONG TAPERED TAIL BOOM, SWEPT VERTICAL FIN & 4-BLADE TAIL ROTOR
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.12, 3.4, 10), oliveDrabMat);
  boom.rotateX(Math.PI / 2);
  boom.position.set(0, 0.12, -2.55);
  group.add(boom);

  // Yellow Hazard Band around Tail Boom
  const boomStripe = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.19, 0.28, 10), yellowAccentMat);
  boomStripe.rotateX(Math.PI / 2);
  boomStripe.position.set(0, 0.12, -2.9);
  group.add(boomStripe);

  // Horizontal Stabilator Wings on Tail
  const hStab = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.06, 0.36), bellyArmorMat);
  hStab.position.set(0, 0.08, -3.75);
  group.add(hStab);

  // Tall Swept Vertical Tail Fin
  const vFin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.15, 0.58), oliveDrabMat);
  vFin.position.set(0, 0.58, -4.05);
  vFin.rotation.x = -0.25;
  group.add(vFin);

  const vFinTip = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.18, 0.56), yellowAccentMat);
  vFinTip.position.set(0, 1.12, -4.18);
  group.add(vFinTip);

  // Spinning 4-Blade Tail Rotor on Side of Vertical Fin
  const tailRotor = new THREE.Group();
  tailRotor.position.set(0.14, 0.72, -4.1);
  const tailDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.62, 0.62, 0.02, 16),
    new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.28, side: THREE.DoubleSide })
  );
  tailDisc.rotateZ(Math.PI / 2);
  tailRotor.add(tailDisc);

  for (let t = 0; t < 2; t++) {
    const tBlade = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.18, 0.12), darkMetalMat);
    tBlade.rotation.x = (t * Math.PI) / 2;
    tailRotor.add(tBlade);
  }
  group.add(tailRotor);

  // 6. WIDE STUB WINGS WITH HYDRA ROCKET PODS & 4 HELLFIRE ANTI-ARMOR MISSILES
  const guns: THREE.Mesh[] = [];
  [-1, 1].forEach((side) => {
    // Stub Wing
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.1, 0.52), oliveDrabMat);
    wing.position.set(side * 0.95, -0.06, 0.15);
    wing.rotation.z = -side * 0.08;
    group.add(wing);

    // Wingtip Navigation Strobe Light (Red / Green)
    const navLight = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 8),
      new THREE.MeshBasicMaterial({ color: side < 0 ? 0xef4444 : 0x22c55e })
    );
    navLight.position.set(side * 1.54, -0.08, 0.15);
    group.add(navLight);

    // Hydra-70 19-Tube Cylindrical Rocket Pod (Inner Pylon)
    const rocketPod = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.05, 12), bellyArmorMat);
    rocketPod.rotateX(Math.PI / 2);
    rocketPod.position.set(side * 0.88, -0.28, 0.25);
    group.add(rocketPod);

    const podFace = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.04, 12),
      new THREE.MeshBasicMaterial({ color: 0xf97316 })
    );
    podFace.rotateX(Math.PI / 2);
    podFace.position.set(side * 0.88, -0.28, 0.77);
    group.add(podFace);
    guns.push(podFace);

    // 2 AGM-114 Hellfire Missiles on Outer Pylon Rack
    [-0.12, 0.12].forEach((mx) => {
      const missile = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.95, 8), darkMetalMat);
      missile.rotateX(Math.PI / 2);
      missile.position.set(side * 1.32 + mx, -0.28, 0.3);
      group.add(missile);

      const warhead = new THREE.Mesh(
        new THREE.ConeGeometry(0.058, 0.18, 8),
        new THREE.MeshBasicMaterial({ color: 0xef4444 })
      );
      warhead.rotateX(Math.PI / 2);
      warhead.position.set(side * 1.32 + mx, -0.28, 0.85);
      group.add(warhead);
    });
  });

  // 7. CLASSIC CURVED HELICOPTER LANDING SKIDS UNDERNEATH
  [-0.68, 0.68].forEach((skidX) => {
    // Horizontal main skid runner
    const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 2.55, 8), darkMetalMat);
    skid.rotateX(Math.PI / 2);
    skid.position.set(skidX, -0.78, 0.15);
    group.add(skid);

    // Upturned front skid toe
    const frontToe = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.38, 8), darkMetalMat);
    frontToe.position.set(skidX, -0.68, 1.52);
    frontToe.rotation.x = -0.65;
    group.add(frontToe);

    // Front & Rear angled shock struts connecting fuselage to skids
    [-0.45, 0.65].forEach((strutZ) => {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.56, 6), darkMetalMat);
      strut.position.set(skidX * 0.78, -0.52, strutZ);
      strut.rotation.z = skidX > 0 ? 0.42 : -0.42;
      group.add(strut);
    });
  });

  return { group, mainRotor, tailRotor, guns };
}

// 12. PHASE 2 BOSS: GIANT BIO-MECH TITAN ROBOT (High-Detail Armored War-Mech with Shoulder Rocket Pods, Rotary Gatling & Plasma Claw)
export function createBioMechRobot(): {
  group: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  coreMesh: THREE.Mesh;
  gatling: THREE.Group;
} {
  const group = new THREE.Group();

  const armorMat = createFastLitMaterial({
    color: 0x334155, // Gunmetal Titanium Armor
    roughness: 0.28,
    metalness: 0.85,
  });
  const trimMat = createFastLitMaterial({
    color: 0x475569,
    roughness: 0.32,
    metalness: 0.78,
  });
  const darkMechMat = createFastLitMaterial({
    color: 0x0f172a,
    roughness: 0.4,
    metalness: 0.92,
  });
  const hazardMat = createFastLitMaterial({
    color: 0xf59e0b,
    roughness: 0.35,
    metalness: 0.6,
  });
  const bioCoreMat = createFastLitMaterial({
    color: 0x22c55e,
    emissive: 0x4ade80,
    emissiveIntensity: 3.2,
    roughness: 0.1,
  });

  // Multi-Layered Angular Armored Chest Chassis & Pelvis Assembly
  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.75, 1.45, 1.2), armorMat);
  torso.position.set(0, 1.85, 0);
  group.add(torso);

  // Sloped Chest Breastplates & Hazard Roll-Bars
  [-0.55, 0.55].forEach((cx) => {
    const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.1, 0.35), trimMat);
    chestPlate.position.set(cx, 1.88, 0.55);
    chestPlate.rotation.y = cx < 0 ? 0.22 : -0.22;
    group.add(chestPlate);

    const rollBar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.85, 0.14), hazardMat);
    rollBar.position.set(cx * 1.35, 1.88, 0.62);
    group.add(rollBar);
  });

  // Pelvis & Hydraulic Waist Actuator
  const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.58, 0.45, 10), darkMechMat);
  waist.position.set(0, 1.05, 0);
  group.add(waist);

  // Glowing Bio-Reactor Turbine Core in Chest with Containment Ring
  const coreRing = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.06, 8, 16), darkMechMat);
  coreRing.position.set(0, 1.88, 0.62);
  group.add(coreRing);

  const coreMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.28, 12), bioCoreMat);
  coreMesh.rotateX(Math.PI / 2);
  coreMesh.position.set(0, 1.88, 0.58);
  group.add(coreMesh);

  // Armored Mech Cockpit Head with Glowing Crimson Cylon/Titan Optics Visor & Twin Comms Antennas
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.54, 0.72), darkMechMat);
  head.position.set(0, 2.78, 0.05);
  group.add(head);

  const browCrown = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.16, 0.76), armorMat);
  browCrown.position.set(0, 3.0, 0.08);
  browCrown.rotation.x = 0.15;
  group.add(browCrown);

  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.64, 0.14, 0.12),
    createFastLitMaterial({ color: 0xef4444, emissive: 0xff0000, emissiveIntensity: 3.5 })
  );
  visor.position.set(0, 2.78, 0.39);
  group.add(visor);

  [-0.32, 0.32].forEach((ax) => {
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, 0.55, 8), trimMat);
    ant.position.set(ax, 3.25, -0.1);
    ant.rotation.x = -0.25;
    group.add(ant);
  });

  // Heavy Dual Shoulder 6-Tube Salvo Rocket Pods
  [-1.15, 1.15].forEach((xSide) => {
    const pod = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.56, 0.85), darkMechMat);
    pod.position.set(xSide, 2.52, 0.05);
    group.add(pod);

    const podHood = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.12, 0.9), hazardMat);
    podHood.position.set(xSide, 2.82, 0.05);
    group.add(podHood);

    // 6 Armed Rocket Warhead Tubes per Shoulder Pod
    [-0.18, 0, 0.18].forEach((rx) => {
      [-0.12, 0.12].forEach((ry) => {
        const tube = new THREE.Mesh(
          new THREE.CylinderGeometry(0.068, 0.068, 0.16, 10),
          createFastLitMaterial({ color: 0xf97316, emissive: 0xea580c, emissiveIntensity: 2.0 })
        );
        tube.rotateX(Math.PI / 2);
        tube.position.set(xSide + rx, 2.52 + ry, 0.46);
        group.add(tube);
      });
    });
  });

  // Right Arm: 6-Barrel Heavy Vulcan Rotary Gatling Cannon with Ammo Belt Drum
  const gatling = new THREE.Group();
  gatling.position.set(1.25, 1.65, 0.32);
  const armMount = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.52, 0.72), armorMat);
  gatling.add(armMount);

  const rotorClamp = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.18, 14), hazardMat);
  rotorClamp.rotateX(Math.PI / 2);
  rotorClamp.position.set(0, 0, 0.95);
  gatling.add(rotorClamp);

  for (let b = 0; b < 6; b++) {
    const ang = (b * Math.PI * 2) / 6;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 1.35, 8), darkMechMat);
    barrel.rotateX(Math.PI / 2);
    barrel.position.set(Math.cos(ang) * 0.13, Math.sin(ang) * 0.13, 0.72);
    gatling.add(barrel);
  }
  group.add(gatling);

  // Left Arm: Hydraulic Siege Claw & Wrist Rocket Launcher
  const leftArm = new THREE.Group();
  leftArm.position.set(-1.25, 1.65, 0.32);
  const leftMount = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.52, 0.72), armorMat);
  leftArm.add(leftMount);
  const plasmaEmitter = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), bioCoreMat);
  plasmaEmitter.position.set(0, 0, 0.42);
  leftArm.add(plasmaEmitter);
  [-0.18, 0.18].forEach((cy) => {
    const claw = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.72), trimMat);
    claw.position.set(0, cy, 0.58);
    claw.rotateX(cy > 0 ? -0.22 : 0.22);
    leftArm.add(claw);
  });
  group.add(leftArm);

  // Segmented Reverse-Jointed Armored Legs with Hydraulic Pistons
  const buildMechLeg = (xOffset: number) => {
    const leg = new THREE.Group();
    leg.position.set(xOffset, 1.1, 0);
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.72, 0.46), armorMat);
    thigh.position.set(0, -0.35, 0);
    leg.add(thigh);
    const kneeArmor = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.3, 0.52), hazardMat);
    kneeArmor.position.set(0, -0.68, 0.08);
    leg.add(kneeArmor);
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.68, 0.4), darkMechMat);
    shin.position.set(0, -0.92, 0.04);
    leg.add(shin);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.22, 0.88), armorMat);
    foot.position.set(0, -1.24, 0.22);
    leg.add(foot);
    return leg;
  };

  const leftLeg = buildMechLeg(-0.58);
  const rightLeg = buildMechLeg(0.58);
  group.add(leftLeg);
  group.add(rightLeg);

  return { group, leftLeg, rightLeg, coreMesh, gatling };
}

// 13. PHASE 3 BOSS: ICE-BLUE F-16 FIGHTING FALCON VIPER JET (Modeled directly after IMG_5382_36bada0b.png!)
export function createF16FighterJet(): {
  group: THREE.Group;
  afterburnerMesh: THREE.Mesh;
} {
  const group = new THREE.Group();

  // Ice-Blue / Slate-Blue Air-Superiority Palette matched directly to IMG_5382_36bada0b.png
  const iceBlueUpperMat = createFastLitMaterial({
    color: 0x9ec5db, // Light Ice-Blue upper fuselage & wings
    roughness: 0.28,
    metalness: 0.45,
  });
  const slateBlueMidMat = createFastLitMaterial({
    color: 0x73a2be, // Medium Slate-Blue wing & spine shading
    roughness: 0.34,
    metalness: 0.5,
  });
  const darkBlueRadomeMat = createFastLitMaterial({
    color: 0x3b698a, // Deep Navy-Slate Radome Nose Cone, Tail Fin & Pylons
    roughness: 0.36,
    metalness: 0.6,
  });
  const pureWhiteMat = createFastLitMaterial({
    color: 0xf8fafc, // Crisp White Pre-Radome Band, Missiles & Ventral Intake Lip
    roughness: 0.22,
    metalness: 0.35,
  });
  const blackOutlineMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });

  // 1. Dark Slate-Blue Pointed Radome Nose Cone + Sharp Pitot Needle Spike (IMG_5382)
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.35, 12), darkBlueRadomeMat);
  nose.rotateX(Math.PI / 2);
  nose.position.set(0, 0, 2.48);
  group.add(nose);

  const pitot = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.022, 0.58, 6), blackOutlineMat);
  pitot.rotateX(Math.PI / 2);
  pitot.position.set(0, 0, 3.35);
  group.add(pitot);

  // Crisp White Pre-Radome Avionics Collar Band + Red/Gold Nose Crest Badge (IMG_5382)
  const whiteNoseCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.37, 0.35, 0.38, 12),
    pureWhiteMat
  );
  whiteNoseCollar.rotateX(Math.PI / 2);
  whiteNoseCollar.position.set(0, 0.01, 1.65);
  group.add(whiteNoseCollar);

  [-0.35, 0.35].forEach((bx) => {
    const noseBadge = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.14, 0.18),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    noseBadge.position.set(bx, 0.04, 1.65);
    group.add(noseBadge);
  });

  // 2. Blended Wing-Body Ice-Blue Fuselage Spine & Leading-Edge Root Extensions (LERX)
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.44, 3.25, 12), iceBlueUpperMat);
  body.rotateX(Math.PI / 2);
  body.position.set(0, 0.02, 0.22);
  group.add(body);

  const lerxChine = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.12, 2.15), slateBlueMidMat);
  lerxChine.position.set(0, 0.04, 0.58);
  group.add(lerxChine);

  // 3. Signature F-16 Chin-Mounted Ventral Air Intake Scoop with White Lip & Dark Duct Cavity (IMG_5382!)
  const intakeOuter = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.36, 1.55), pureWhiteMat);
  intakeOuter.position.set(0, -0.34, 0.95);
  group.add(intakeOuter);

  const intakeLip = new THREE.Mesh(
    new THREE.TorusGeometry(0.24, 0.045, 6, 12),
    pureWhiteMat
  );
  intakeLip.scale.set(1.25, 0.72, 1);
  intakeLip.position.set(0, -0.34, 1.72);
  group.add(intakeLip);

  const intakeCavity = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.26, 0.22),
    blackOutlineMat
  );
  intakeCavity.position.set(0, -0.34, 1.66);
  group.add(intakeCavity);

  // 4. Deep-Blue Tinted Bubble Canopy with Frame Arch & Pilot Silhouette inside Cockpit (IMG_5382!)
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.36, 12, 10),
    createFastLitMaterial({
      color: 0x1d4ed8,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.32,
      transparent: true,
      opacity: 0.78,
      roughness: 0.12,
      metalness: 0.28,
    })
  );
  canopy.scale.set(0.76, 0.68, 1.68);
  canopy.position.set(0, 0.32, 1.05);
  group.add(canopy);

  // Canopy Frame Bow Arch
  const canopyArch = new THREE.Mesh(
    new THREE.TorusGeometry(0.27, 0.025, 6, 12, Math.PI),
    darkBlueRadomeMat
  );
  canopyArch.position.set(0, 0.3, 0.85);
  group.add(canopyArch);

  // Pilot Helmet inside Bubble Canopy
  const pilotHelmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 8, 8),
    pureWhiteMat
  );
  pilotHelmet.position.set(0, 0.36, 1.12);
  group.add(pilotHelmet);

  // 5. Swept Cropped-Delta Main Wings (4.3m Wingspan) with Flap Lines & Circular Roundel Insignias
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0.95);
  wingShape.lineTo(2.15, -0.52);
  wingShape.lineTo(2.05, -1.18);
  wingShape.lineTo(0, -0.88);
  wingShape.lineTo(-2.05, -1.18);
  wingShape.lineTo(-2.15, -0.52);
  wingShape.closePath();

  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.07, bevelEnabled: false });
  const wingMesh = new THREE.Mesh(wingGeo, iceBlueUpperMat);
  wingMesh.rotateX(Math.PI / 2);
  wingMesh.position.set(0, -0.02, 0.18);
  group.add(wingMesh);

  // Wing Roundel Insignias on Upper & Lower Surfaces (Red/White/Blue Bulls-Eye Roundels from IMG_5382)
  [-1.28, 1.28].forEach((rx) => {
    const outerRing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.24, 0.085, 16),
      new THREE.MeshBasicMaterial({ color: 0x1e3a8a })
    );
    outerRing.position.set(rx, -0.05, -0.35);
    group.add(outerRing);

    const midRing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.09, 16),
      pureWhiteMat
    );
    midRing.position.set(rx, -0.05, -0.35);
    group.add(midRing);

    const innerDot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.095, 12),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    innerDot.position.set(rx, -0.05, -0.35);
    group.add(innerDot);
  });

  // 6. Wingtip Launch Rails with AIM-9 Sidewinder Missiles + Underwing Drop Tanks & White Guided Missiles (IMG_5382!)
  [-2.12, 2.12].forEach((wx) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 1.35), darkBlueRadomeMat);
    rail.position.set(wx, -0.04, -0.45);
    group.add(rail);

    const sidewinder = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 1.25, 10),
      pureWhiteMat
    );
    sidewinder.rotateX(Math.PI / 2);
    sidewinder.position.set(wx < 0 ? wx - 0.06 : wx + 0.06, -0.04, -0.32);
    group.add(sidewinder);

    const seekerTip = new THREE.Mesh(
      new THREE.ConeGeometry(0.046, 0.22, 10),
      darkBlueRadomeMat
    );
    seekerTip.rotateX(Math.PI / 2);
    seekerTip.position.set(wx < 0 ? wx - 0.06 : wx + 0.06, -0.04, 0.41);
    group.add(seekerTip);
  });

  // Inboard Underwing Slate-Blue Drop Tanks + Mid-Wing White Air-to-Ground Missiles
  [-0.85, 0.85].forEach((tx) => {
    const tankBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.11, 1.42, 14),
      slateBlueMidMat
    );
    tankBody.rotateX(Math.PI / 2);
    tankBody.position.set(tx, -0.24, 0.05);
    group.add(tankBody);

    const tankNose = new THREE.Mesh(
      new THREE.ConeGeometry(0.13, 0.36, 14),
      darkBlueRadomeMat
    );
    tankNose.rotateX(Math.PI / 2);
    tankNose.position.set(tx, -0.24, 0.94);
    group.add(tankNose);
  });

  [-1.48, 1.48].forEach((mx) => {
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.55), darkBlueRadomeMat);
    pylon.position.set(mx, -0.12, -0.15);
    group.add(pylon);

    const agmBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.068, 0.068, 1.18, 12),
      pureWhiteMat
    );
    agmBody.rotateX(Math.PI / 2);
    agmBody.position.set(mx, -0.21, -0.05);
    group.add(agmBody);

    const agmTip = new THREE.Mesh(
      new THREE.ConeGeometry(0.068, 0.25, 12),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    agmTip.rotateX(Math.PI / 2);
    agmTip.position.set(mx, -0.21, 0.66);
    group.add(agmTip);
  });

  // 7. Tall Swept Vertical Tail Fin with "00" Squadron Markings, Red Warning Dot & Dorsal Spine (IMG_5382!)
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.32, 1.12), slateBlueMidMat);
  fin.position.set(0, 0.68, -1.05);
  fin.rotateX(-0.28);
  group.add(fin);

  const finCap = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.16, 0.96), darkBlueRadomeMat);
  finCap.position.set(0, 1.26, -1.16);
  finCap.rotateX(-0.28);
  group.add(finCap);

  // Red Beacon Dot & Double "00" Squadron Rings on Both Sides of Vertical Fin
  [-0.05, 0.05].forEach((fx) => {
    const redFinDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    redFinDot.position.set(fx, 1.08, -1.08);
    group.add(redFinDot);

    [-0.92, -1.14].forEach((fz) => {
      const zeroRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.075, 0.022, 8, 14),
        blackOutlineMat
      );
      zeroRing.rotateY(Math.PI / 2);
      zeroRing.scale.set(1, 1.35, 1);
      zeroRing.position.set(fx, 0.62, fz);
      group.add(zeroRing);
    });
  });

  // Swept All-Moving Horizontal Stabilators
  const hTail = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.06, 0.65), slateBlueMidMat);
  hTail.position.set(0, 0.02, -1.36);
  group.add(hTail);

  // 8. Ribbed Single Turbofan Exhaust Nozzle & Supersonic Afterburner Plume
  const nozzle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.34, 0.52, 16),
    darkBlueRadomeMat
  );
  nozzle.rotateX(Math.PI / 2);
  nozzle.position.set(0, 0, -1.38);
  group.add(nozzle);

  const flameGeo = new THREE.ConeGeometry(0.25, 1.4, 14);
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0xf97316,
    transparent: true,
    opacity: 0.92,
  });
  const afterburnerMesh = new THREE.Mesh(flameGeo, flameMat);
  afterburnerMesh.rotateX(-Math.PI / 2);
  afterburnerMesh.position.set(0, 0, -2.12);

  const innerCore = new THREE.Mesh(
    new THREE.ConeGeometry(0.14, 0.88, 10),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.95 })
  );
  innerCore.position.set(0, 0.15, 0);
  afterburnerMesh.add(innerCore);
  group.add(afterburnerMesh);

  return { group, afterburnerMesh };
}

// 13B. 3D BOSS ROCKET / GUIDED MISSILE (Modeled directly after IMG_5378_27ae3c8a.jpeg!)
// Features: Bright Red Pointed Nose Cone, Olive-Drab Body with Silver Collar Band, Lime-Green Wing Roots + Golden-Ochre Swept Mid-Wings, Yellow Tail Band, Brown Tail Fins & Twin Red Booster Nozzles!
const _sharedRocket = {
  oliveBodyMat: createFastLitMaterial({
    color: 0x5c6650,
    metalness: 0.65,
    roughness: 0.28,
  }),
  blackSeamMat: new THREE.MeshBasicMaterial({ color: 0x09090b }),
  warheadMat: createFastLitMaterial({
    color: 0xef4444,
    emissive: 0xdc2626,
    emissiveIntensity: 0.45,
    roughness: 0.18,
    metalness: 0.3,
  }),
  silverBandMat: createFastLitMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.15 }),
  limeRootMat: createFastLitMaterial({
    color: 0x84cc16,
    emissive: 0x4d7c0f,
    emissiveIntensity: 0.25,
    roughness: 0.3,
  }),
  ochreWingMat: createFastLitMaterial({
    color: 0xd97706,
    metalness: 0.45,
    roughness: 0.3,
  }),
  yellowBandMat: new THREE.MeshBasicMaterial({ color: 0xfacc15 }),
  brownFinMat: createFastLitMaterial({
    color: 0x78350f,
    metalness: 0.4,
    roughness: 0.45,
  }),
  nozzleMat: new THREE.MeshBasicMaterial({ color: 0xef4444 }),
  flameMat: new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.95 }),
  bodyGeo: new THREE.CylinderGeometry(0.11, 0.11, 1.12, 10),
  warheadGeo: new THREE.ConeGeometry(0.112, 0.42, 10),
  noseSeamGeo: new THREE.CylinderGeometry(0.115, 0.115, 0.03, 10),
  silverBandGeo: new THREE.CylinderGeometry(0.114, 0.114, 0.14, 10),
  rootFairingGeo: new THREE.BoxGeometry(0.08, 0.045, 0.34),
  midWingGeo: new THREE.BoxGeometry(0.32, 0.03, 0.26),
  yellowBandGeo: new THREE.CylinderGeometry(0.114, 0.114, 0.13, 10),
  finHGeo: new THREE.BoxGeometry(0.46, 0.03, 0.22),
  finVGeo: new THREE.BoxGeometry(0.03, 0.46, 0.22),
  nozzleGeo: new THREE.CapsuleGeometry(0.036, 0.14, 4, 6),
  flameGeo: new THREE.ConeGeometry(0.13, 0.72, 8),
};
Object.values(_sharedRocket).forEach((item) => {
  item.userData = { isCached: true };
});

export function createBossRocketMesh(): { group: THREE.Group; flame: THREE.Mesh } {
  const group = new THREE.Group();

  const body = new THREE.Mesh(_sharedRocket.bodyGeo, _sharedRocket.oliveBodyMat);
  body.rotateX(Math.PI / 2);
  group.add(body);

  const warhead = new THREE.Mesh(_sharedRocket.warheadGeo, _sharedRocket.warheadMat);
  warhead.rotateX(Math.PI / 2);
  warhead.position.set(0, 0, 0.77);
  group.add(warhead);

  const noseSeam = new THREE.Mesh(_sharedRocket.noseSeamGeo, _sharedRocket.blackSeamMat);
  noseSeam.rotateX(Math.PI / 2);
  noseSeam.position.set(0, 0, 0.55);
  group.add(noseSeam);

  const silverBand = new THREE.Mesh(_sharedRocket.silverBandGeo, _sharedRocket.silverBandMat);
  silverBand.rotateX(Math.PI / 2);
  silverBand.position.set(0, 0, 0.34);
  group.add(silverBand);

  [-1, 1].forEach((side) => {
    const rootFairing = new THREE.Mesh(_sharedRocket.rootFairingGeo, _sharedRocket.limeRootMat);
    rootFairing.position.set(side * 0.12, 0, 0.02);
    group.add(rootFairing);

    const midWing = new THREE.Mesh(_sharedRocket.midWingGeo, _sharedRocket.ochreWingMat);
    midWing.position.set(side * 0.25, 0, -0.02);
    midWing.rotation.y = side * -0.35;
    group.add(midWing);
  });

  const yellowBand = new THREE.Mesh(_sharedRocket.yellowBandGeo, _sharedRocket.yellowBandMat);
  yellowBand.rotateX(Math.PI / 2);
  yellowBand.position.set(0, 0, -0.3);
  group.add(yellowBand);

  const finH = new THREE.Mesh(_sharedRocket.finHGeo, _sharedRocket.brownFinMat);
  finH.position.set(0, 0, -0.44);
  group.add(finH);
  const finV = new THREE.Mesh(_sharedRocket.finVGeo, _sharedRocket.brownFinMat);
  finV.position.set(0, 0, -0.44);
  group.add(finV);

  [-0.045, 0.045].forEach((nx) => {
    const twinNozzle = new THREE.Mesh(_sharedRocket.nozzleGeo, _sharedRocket.nozzleMat);
    twinNozzle.rotateX(Math.PI / 2);
    twinNozzle.position.set(nx, 0, -0.62);
    group.add(twinNozzle);
  });

  const flame = new THREE.Mesh(_sharedRocket.flameGeo, _sharedRocket.flameMat);
  flame.rotateX(-Math.PI / 2);
  flame.position.set(0, 0, -0.95);
  group.add(flame);

  return { group, flame };
}

// Helper: Create a 3D Floating Distress Speech Bubble ("HELP! CLOT NEEDED!", "SAVE US WBC!") above Panicking Cells & Platelets!
const _speechBadgeGeo = new THREE.PlaneGeometry(0.95, 0.32);
_speechBadgeGeo.userData = { isCached: true };
const _speechBadgeMatCache = new Map<string, THREE.MeshBasicMaterial>();
const _roadSignMatCache = new Map<string, THREE.MeshBasicMaterial>();
const _landmarkPlaqueMatCache = new Map<string, THREE.MeshBasicMaterial>();

function createDistressSpeechBadge(text: string, bgHex = '#fef08a', borderHex = '#ef4444'): THREE.Mesh {
  const cacheKey = `${text}|${bgHex}|${borderHex}`;
  let mat = _speechBadgeMatCache.get(cacheKey);
  if (!mat) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 84;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = bgHex;
      ctx.beginPath();
      ctx.roundRect(6, 6, 244, 60, 16);
      ctx.fill();

      ctx.strokeStyle = borderHex;
      ctx.lineWidth = 6;
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.font = '900 23px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(text, 128, 44, 228);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    tex.userData = { isCached: true };
    mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
    mat.userData = { isCached: true };
    _speechBadgeMatCache.set(cacheKey, mat);
  }
  return new THREE.Mesh(_speechBadgeGeo, mat);
}

// 14. PANICKING SMALL PLATELETS (Highly visible golden-amber clotting cells with waving arms, panicking face & floating "HELP!" speech bubble!)
export function createPlateletModel(cryText = 'HELP! SAVE US!'): {
  group: THREE.Group;
  disc: THREE.Mesh;
  lArm: THREE.Mesh;
  rArm: THREE.Mesh;
} {
  const group = new THREE.Group();

  const mat = createFastLitMaterial({
    color: 0xfbbf24, // Bright glowing golden-amber platelet membrane
    emissive: 0xd97706,
    emissiveIntensity: 0.65,
    roughness: 0.25,
    metalness: 0.2,
  });

  // Plump star-disc platelet body facing the camera
  const discGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.18, 14);
  discGeo.rotateX(Math.PI / 2);
  const disc = new THREE.Mesh(discGeo, mat);
  group.add(disc);

  // 8 Activated Platelet Pseudopodia Spikes radiating around rim
  for (let i = 0; i < 8; i++) {
    const ang = (i * Math.PI * 2) / 8;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.32, 6), mat);
    spike.position.set(Math.cos(ang) * 0.48, Math.sin(ang) * 0.48, 0);
    spike.rotation.z = ang - Math.PI / 2;
    group.add(spike);
  }

  // Waving little platelet arms
  const armGeo = new THREE.CapsuleGeometry(0.05, 0.28, 4, 6);
  const lArm = new THREE.Mesh(armGeo, mat);
  lArm.position.set(-0.48, 0.18, 0.05);
  lArm.rotation.z = 0.7;
  group.add(lArm);

  const rArm = new THREE.Mesh(armGeo, mat);
  rArm.position.set(0.48, 0.18, 0.05);
  rArm.rotation.z = -0.7;
  group.add(rArm);

  // Expressive Cartoon Panicking Eyes & Open Screaming Mouth on Front (+Z) and Back (-Z)
  const eyeWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const eyePupil = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const mouthMat = new THREE.MeshBasicMaterial({ color: 0x450a0a });

  [1, -1].forEach((zSide) => {
    [-0.14, 0.14].forEach((x) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.105, 10, 10), eyeWhite);
      eye.position.set(x, 0.09, 0.1 * zSide);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 8), eyePupil);
      pupil.position.set(x, 0.09, 0.18 * zSide);
      group.add(eye, pupil);
    });

    const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.095, 8, 8), mouthMat);
    mouth.scale.set(0.9, 1.35, 0.5);
    mouth.position.set(0, -0.11, 0.11 * zSide);
    group.add(mouth);
  });

  // Floating 3D "HELP! SAVE US!" Speech Bubble above Platelet
  const helpBadge = createDistressSpeechBadge(cryText, '#fef08a', '#dc2626');
  helpBadge.position.set(0, 0.82, 0);
  group.add(helpBadge);

  group.scale.set(0.95, 0.95, 0.95);
  return { group, disc, lArm, rArm };
}

// 15. HEROIC ANTIBODIES (Y-shaped with cute determined angry frowning eyes, charging at bacteria)
export function createHeroicAntibodyModel(): { group: THREE.Group } {
  const group = new THREE.Group();

  const bodyMat = createFastLitMaterial({
    color: 0x38bdf8, // Bioluminescent light blue
    emissive: 0x0284c7,
    emissiveIntensity: 1.8,
    roughness: 0.2,
    metalness: 0.3,
  });
  const tipMat = createFastLitMaterial({
    color: 0xfacc15,
    emissive: 0xeab308,
    emissiveIntensity: 2.2,
  });

  // Central stem (Fc region)
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.6, 8), bodyMat);
  stem.position.set(0, -0.3, 0);
  group.add(stem);

  // Left Fab arm (angled 40 degrees)
  const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.5, 8), bodyMat);
  leftArm.position.set(-0.18, 0.15, 0);
  leftArm.rotateZ(0.65);
  group.add(leftArm);

  const leftTip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.12), tipMat);
  leftTip.position.set(-0.32, 0.32, 0);
  group.add(leftTip);

  // Right Fab arm (angled -40 degrees)
  const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.5, 8), bodyMat);
  rightArm.position.set(0.18, 0.15, 0);
  rightArm.rotateZ(-0.65);
  group.add(rightArm);

  const rightTip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.12), tipMat);
  rightTip.position.set(0.32, 0.32, 0);
  group.add(rightTip);

  // Cute Heroic Eyes with determined angry/frowning eyebrows on BOTH sides (+Z and -Z)
  const eyeWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const eyePupil = new THREE.MeshBasicMaterial({ color: 0x0369a1 });
  const browMat = new THREE.MeshBasicMaterial({ color: 0x0c4a6e });

  [1, -1].forEach((zDir) => {
    // Left Eye & Fierce Frowning Eyebrow
    const lEye = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 8), eyeWhite);
    lEye.position.set(-0.09, 0.03, 0.08 * zDir);
    const lPupil = new THREE.Mesh(new THREE.SphereGeometry(0.042, 6, 6), eyePupil);
    lPupil.position.set(-0.09, 0.03, 0.145 * zDir);
    const lBrow = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.032, 0.035), browMat);
    lBrow.position.set(-0.09, 0.105, 0.125 * zDir);
    lBrow.rotateZ(-0.38); // Angled inward aggressively!
    group.add(lEye);
    group.add(lPupil);
    group.add(lBrow);

    // Right Eye & Fierce Frowning Eyebrow
    const rEye = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 8), eyeWhite);
    rEye.position.set(0.09, 0.03, 0.08 * zDir);
    const rPupil = new THREE.Mesh(new THREE.SphereGeometry(0.042, 6, 6), eyePupil);
    rPupil.position.set(0.09, 0.03, 0.145 * zDir);
    const rBrow = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.032, 0.035), browMat);
    rBrow.position.set(0.09, 0.105, 0.125 * zDir);
    rBrow.rotateZ(0.38); // Angled inward aggressively!
    group.add(rEye);
    group.add(rPupil);
    group.add(rBrow);
  });

  group.scale.set(1.25, 1.25, 1.25);
  return { group };
}

// Helper to add fierce heroic frowning eyes on BOTH sides (+Z and -Z) of any heroic immune cell
function addHeroicFrowningEyes(group: THREE.Group, yOffset = 0.05, zOffset = 0.28, pupilHex = 0x0f172a, browHex = 0x09090b) {
  const eyeWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const eyePupil = new THREE.MeshBasicMaterial({ color: pupilHex });
  const browMat = new THREE.MeshBasicMaterial({ color: browHex });

  [1, -1].forEach((zDir) => {
    const lEye = new THREE.Mesh(new THREE.SphereGeometry(0.095, 8, 8), eyeWhite);
    lEye.position.set(-0.12, yOffset, zOffset * zDir);
    const lPupil = new THREE.Mesh(new THREE.SphereGeometry(0.048, 6, 6), eyePupil);
    lPupil.position.set(-0.12, yOffset, (zOffset + 0.065) * zDir);
    const lBrow = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.038, 0.04), browMat);
    lBrow.position.set(-0.12, yOffset + 0.085, (zOffset + 0.04) * zDir);
    lBrow.rotateZ(-0.4);
    group.add(lEye, lPupil, lBrow);

    const rEye = new THREE.Mesh(new THREE.SphereGeometry(0.095, 8, 8), eyeWhite);
    rEye.position.set(0.12, yOffset, zOffset * zDir);
    const rPupil = new THREE.Mesh(new THREE.SphereGeometry(0.048, 6, 6), eyePupil);
    rPupil.position.set(0.12, yOffset, (zOffset + 0.065) * zDir);
    const rBrow = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.038, 0.04), browMat);
    rBrow.position.set(0.12, yOffset + 0.085, (zOffset + 0.04) * zDir);
    rBrow.rotateZ(0.4);
    group.add(rEye, rPupil, rBrow);
  });
}

// 16. HEROIC ALVEOLAR / DIGESTIVE MACROPHAGE (Amoeboid phagocyte with pseudopods & fierce frowning eyes)
export function createHeroicMacrophageModel(isDigestive = false): { group: THREE.Group } {
  const group = new THREE.Group();

  const bodyMat = createFastLitMaterial({
    color: isDigestive ? 0xa3e635 : 0x34d399, // Emerald/lime phagocyte membrane
    emissive: isDigestive ? 0x4d7c0f : 0x059669,
    emissiveIntensity: 1.4,
    roughness: 0.25,
    metalness: 0.2,
  });

  // Ruffled amoeboid central body
  const core = new THREE.Mesh(new THREE.DodecahedronGeometry(0.34, 1), bodyMat);
  core.scale.set(1.15, 0.95, 0.85);
  group.add(core);

  // Extending phagocytic pseudopod arms reaching forward to engulf bacteria
  [-0.28, 0.28].forEach((xSide, idx) => {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.36, 6, 8), bodyMat);
    arm.position.set(xSide, 0.16, 0);
    arm.rotateZ(idx === 0 ? 0.55 : -0.55);
    group.add(arm);
  });

  // Lower pseudopods
  [-0.2, 0.2].forEach((xSide, idx) => {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.26, 6, 8), bodyMat);
    leg.position.set(xSide, -0.28, 0);
    leg.rotateZ(idx === 0 ? -0.3 : 0.3);
    group.add(leg);
  });

  addHeroicFrowningEyes(group, 0.04, 0.28, 0x064e3b, 0x022c22);
  group.scale.set(1.2, 1.2, 1.2);
  return { group };
}

// 17. HEROIC DENDRITIC / MICROGLIA CELL (Star-branched neural immune defender with fierce frowning eyes)
export function createHeroicDendriticCellModel(): { group: THREE.Group } {
  const group = new THREE.Group();

  const bodyMat = createFastLitMaterial({
    color: 0xc084fc, // Bioluminescent neural violet/cyan
    emissive: 0x7e22ce,
    emissiveIntensity: 1.6,
    roughness: 0.2,
    metalness: 0.35,
  });
  const tipMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

  const soma = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), bodyMat);
  soma.scale.set(1.1, 1.0, 0.85);
  group.add(soma);

  // Star-like branching dendrites
  for (let i = 0; i < 6; i++) {
    const ang = (i * Math.PI * 2) / 6;
    const branch = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.48, 6), bodyMat);
    branch.position.set(Math.cos(ang) * 0.34, Math.sin(ang) * 0.34, 0);
    branch.rotation.z = ang - Math.PI / 2;
    group.add(branch);

    const receptor = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 6), tipMat);
    receptor.position.set(Math.cos(ang) * 0.56, Math.sin(ang) * 0.56, 0);
    group.add(receptor);
  }

  addHeroicFrowningEyes(group, 0.03, 0.24, 0x3b0764, 0x1e1b4b);
  group.scale.set(1.22, 1.22, 1.22);
  return { group };
}

// Helper to add cartoon panicking face & flailing limbs to theme-specific panicking cells
function attachPanicFaceAndLimbs(group: THREE.Group, limbColorHex: number): {
  lArm: THREE.Group;
  rArm: THREE.Group;
  lLeg: THREE.Group;
  rLeg: THREE.Group;
} {
  const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

  const lEye = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), eyeWhiteMat);
  lEye.position.set(-0.16, 0.14, 0.34);
  const lPupil = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), pupilMat);
  lPupil.position.set(-0.16, 0.14, 0.45);
  group.add(lEye, lPupil);

  const rEye = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), eyeWhiteMat);
  rEye.position.set(0.16, 0.14, 0.34);
  const rPupil = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), pupilMat);
  rPupil.position.set(0.16, 0.14, 0.45);
  group.add(rEye, rPupil);

  // Screaming mouth
  const mouth = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0x1a0000 })
  );
  mouth.scale.set(0.85, 1.35, 0.5);
  mouth.position.set(0, -0.1, 0.35);
  group.add(mouth);

  const limbMat = createFastLitMaterial({ color: limbColorHex, roughness: 0.4 });
  const limbGeo = new THREE.CapsuleGeometry(0.055, 0.34, 4, 8);

  const lArm = new THREE.Group();
  lArm.position.set(-0.46, 0.1, 0);
  const laMesh = new THREE.Mesh(limbGeo, limbMat);
  laMesh.position.y = 0.18;
  lArm.add(laMesh);
  group.add(lArm);

  const rArm = new THREE.Group();
  rArm.position.set(0.46, 0.1, 0);
  const raMesh = new THREE.Mesh(limbGeo, limbMat);
  raMesh.position.y = 0.18;
  rArm.add(raMesh);
  group.add(rArm);

  const lLeg = new THREE.Group();
  lLeg.position.set(-0.2, -0.45, 0);
  const llMesh = new THREE.Mesh(limbGeo, limbMat);
  llMesh.position.y = -0.18;
  lLeg.add(llMesh);
  group.add(lLeg);

  const rLeg = new THREE.Group();
  rLeg.position.set(0.2, -0.45, 0);
  const rlMesh = new THREE.Mesh(limbGeo, limbMat);
  rlMesh.position.y = -0.18;
  rLeg.add(rlMesh);
  group.add(rLeg);

  // Floating 3D Distress Speech Badge above Panicking Cell
  const cellBadge = createDistressSpeechBadge('HELP US WBC!', '#ffffff', '#ef4444');
  cellBadge.position.set(0, 0.85, 0);
  group.add(cellBadge);

  return { lArm, rArm, lLeg, rLeg };
}

// 18. PANICKING MUCUS GOBLET CELL (For Trachea & Alveoli respiratory theme)
export function createPanickingGobletCell(): {
  group: THREE.Group;
  lArm: THREE.Group;
  rArm: THREE.Group;
  lLeg: THREE.Group;
  rLeg: THREE.Group;
} {
  const group = new THREE.Group();

  const gobletMat = createFastLitMaterial({
    color: 0x10b981, // Teal-emerald goblet cell membrane
    roughness: 0.3,
    metalness: 0.1,
  });
  const mucusMat = createFastLitMaterial({
    color: 0xa3e635, // Shiny green/lime mucin granules overflowing at top
    emissive: 0x4d7c0f,
    emissiveIntensity: 0.8,
    roughness: 0.15,
  });

  // Chalice / Goblet cup body (narrow basal stem, wide apical cup)
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.22, 0.82, 12), gobletMat);
  group.add(cup);

  // Bubbling Mucus Droplets overflowing from top of goblet cell
  [
    { x: 0, y: 0.45, z: 0, r: 0.22 },
    { x: -0.22, y: 0.42, z: 0.08, r: 0.16 },
    { x: 0.22, y: 0.42, z: -0.05, r: 0.16 },
  ].forEach((b) => {
    const drop = new THREE.Mesh(new THREE.SphereGeometry(b.r, 8, 8), mucusMat);
    drop.position.set(b.x, b.y, b.z);
    group.add(drop);
  });

  const limbs = attachPanicFaceAndLimbs(group, 0x059669);
  return { group, ...limbs };
}

// 19. PANICKING DIGESTIVE EPITHELIAL / ENTEROCYTE VILLI CELL (For Stomach & Intestine themes)
export function createPanickingDigestiveCell(isIntestine: boolean): {
  group: THREE.Group;
  lArm: THREE.Group;
  rArm: THREE.Group;
  lLeg: THREE.Group;
  rLeg: THREE.Group;
} {
  const group = new THREE.Group();

  const cellMat = createFastLitMaterial({
    color: isIntestine ? 0xf59e0b : 0xf43f5e, // Warm amber enterocyte or rose gastric parietal cell
    roughness: 0.35,
    metalness: 0.1,
  });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.42, 8, 12), cellMat);
  group.add(body);

  // Brush-border Microvilli tuft on top of head!
  const villiMat = createFastLitMaterial({
    color: isIntestine ? 0xfde047 : 0xfda4af,
    roughness: 0.3,
  });
  for (let i = -3; i <= 3; i++) {
    const villus = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.22, 4, 6), villiMat);
    villus.position.set(i * 0.08, 0.56, 0);
    villus.rotation.z = -i * 0.08;
    group.add(villus);
  }

  const limbs = attachPanicFaceAndLimbs(group, isIntestine ? 0xd97706 : 0xe11d48);
  return { group, ...limbs };
}

// 20. PANICKING NEURONE / ASTROCYTE CELL (For Brain & Spinal Cord theme)
export function createPanickingNeuroneCell(): {
  group: THREE.Group;
  lArm: THREE.Group;
  rArm: THREE.Group;
  lLeg: THREE.Group;
  rLeg: THREE.Group;
} {
  const group = new THREE.Group();

  const somaMat = createFastLitMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.9,
    roughness: 0.2,
  });

  const soma = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 12), somaMat);
  group.add(soma);

  // Sparking dendrite crown spikes on head
  for (let i = 0; i < 5; i++) {
    const ang = -0.8 + i * 0.4;
    const dendrite = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.35, 5), somaMat);
    dendrite.position.set(Math.sin(ang) * 0.48, Math.cos(ang) * 0.48, 0);
    dendrite.rotation.z = -ang;
    group.add(dendrite);
  }

  const limbs = attachPanicFaceAndLimbs(group, 0x0369a1);
  return { group, ...limbs };
}

// 21. VINTAGE BLÉRIOT WW2 WARPLANE BOMBER (Drops Mortar Shells on Barricades!)
export function createBleriotPlane(): {
  group: THREE.Group;
  propeller: THREE.Group;
} {
  const group = new THREE.Group();

  const canvasWingMat = createFastLitMaterial({
    color: 0xd6d3d1, // Vintage doped linen/canvas cream-olive
    roughness: 0.75,
    metalness: 0.1,
  });
  const woodFrameMat = createFastLitMaterial({
    color: 0x78350f, // Mahogany/ash wooden airframe struts
    roughness: 0.7,
    metalness: 0.15,
  });
  const engineMetalMat = createFastLitMaterial({
    color: 0x334155,
    roughness: 0.4,
    metalness: 0.85,
  });

  // Forward cowling & vintage open-lattice wooden fuselage
  const noseCowl = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.9, 12), engineMetalMat);
  noseCowl.rotateX(Math.PI / 2);
  noseCowl.position.set(0, 0, 1.05);
  group.add(noseCowl);

  const fuselage = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.46, 2.8), woodFrameMat);
  fuselage.position.set(0, 0, -0.5);
  group.add(fuselage);

  // Vintage Main Cambered Monoplane/Biplane Wing
  const mainWing = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.07, 0.88), canvasWingMat);
  mainWing.position.set(0, 0.18, 0.45);
  group.add(mainWing);

  // Upper cabane A-frame Kingpost & wire bracing tower (Iconic Blériot XI silhouette!)
  const cabaneL = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.75, 6), woodFrameMat);
  cabaneL.position.set(-0.2, 0.52, 0.5);
  cabaneL.rotateZ(-0.22);
  const cabaneR = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.75, 6), woodFrameMat);
  cabaneR.position.set(0.2, 0.52, 0.5);
  cabaneR.rotateZ(0.22);
  group.add(cabaneL, cabaneR);

  // WWII Roundel markings on wings
  [-1.5, 1.5].forEach((xPos) => {
    const roundel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 0.08, 14),
      new THREE.MeshBasicMaterial({ color: 0xdc2626 })
    );
    roundel.position.set(xPos, 0.19, 0.45);
    group.add(roundel);
  });

  // Tail Horizontal Elevator & Vertical Rudder
  const hTail = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.5), canvasWingMat);
  hTail.position.set(0, 0.05, -1.8);
  const vRudder = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.55), canvasWingMat);
  vRudder.position.set(0, 0.35, -1.85);
  group.add(hTail, vRudder);

  // Vintage Spoked Front Landing Gear
  [-0.42, 0.42].forEach((xSide) => {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.65, 6), woodFrameMat);
    strut.position.set(xSide, -0.42, 0.75);
    const wheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.06, 12),
      createFastLitMaterial({ color: 0x18181b })
    );
    wheel.rotateZ(Math.PI / 2);
    wheel.position.set(xSide, -0.72, 0.75);
    group.add(strut, wheel);
  });

  // Spinning 2-Blade Carved Wooden Propeller
  const propeller = new THREE.Group();
  propeller.position.set(0, 0, 1.56);
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(1.35, 0.14, 0.03),
    createFastLitMaterial({ color: 0x92400e, roughness: 0.4 })
  );
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.22, 10), engineMetalMat);
  spinner.rotateX(Math.PI / 2);
  spinner.position.z = 0.08;
  propeller.add(blade, spinner);
  group.add(propeller);

  group.scale.set(1.15, 1.15, 1.15);
  return { group, propeller };
}

// 22. FALLING WW2 AERIAL MORTAR BOMB (Modeled directly after the Red-and-White Diagonal Striped Finned Bomb in IMG_5379_39052f1e.jpeg!)
let _sharedMortarAssets: {
  steelBodyMat: THREE.MeshLambertMaterial;
  finMetalMat: THREE.MeshLambertMaterial;
  hazardMat: THREE.MeshBasicMaterial;
  fuseMat: THREE.MeshBasicMaterial;
  bodyGeo: THREE.CapsuleGeometry;
  bandGeo: THREE.CylinderGeometry;
  finGeo: THREE.BoxGeometry;
  tailRodGeo: THREE.CylinderGeometry;
  fuseGeo: THREE.CylinderGeometry;
} | null = null;

function getSharedMortarAssets() {
  if (_sharedMortarAssets) return _sharedMortarAssets;
  const stripeCanvas = document.createElement('canvas');
  stripeCanvas.width = 256;
  stripeCanvas.height = 64;
  const sCtx = stripeCanvas.getContext('2d');
  if (sCtx) {
    sCtx.fillStyle = '#ffffff';
    sCtx.fillRect(0, 0, 256, 64);
    sCtx.fillStyle = '#dc2626';
    for (let x = -64; x < 320; x += 32) {
      sCtx.beginPath();
      sCtx.moveTo(x, 0);
      sCtx.lineTo(x + 16, 0);
      sCtx.lineTo(x - 16, 64);
      sCtx.lineTo(x - 32, 64);
      sCtx.closePath();
      sCtx.fill();
    }
    sCtx.strokeStyle = '#09090b';
    sCtx.lineWidth = 4;
    sCtx.strokeRect(0, 2, 256, 60);
  }
  const stripeTex = new THREE.CanvasTexture(stripeCanvas);
  stripeTex.wrapS = THREE.RepeatWrapping;
  stripeTex.needsUpdate = true;

  _sharedMortarAssets = {
    steelBodyMat: createFastLitMaterial({
      color: 0xcbd5e1,
      metalness: 0.78,
      roughness: 0.26,
    }),
    finMetalMat: createFastLitMaterial({
      color: 0x64748b,
      metalness: 0.85,
      roughness: 0.25,
    }),
    hazardMat: new THREE.MeshBasicMaterial({ map: stripeTex }),
    fuseMat: new THREE.MeshBasicMaterial({ color: 0xef4444 }),
    bodyGeo: new THREE.CapsuleGeometry(0.22, 0.42, 8, 12),
    bandGeo: new THREE.CylinderGeometry(0.226, 0.226, 0.16, 12),
    finGeo: new THREE.BoxGeometry(0.52, 0.28, 0.03),
    tailRodGeo: new THREE.CylinderGeometry(0.035, 0.035, 0.38, 6),
    fuseGeo: new THREE.CylinderGeometry(0.055, 0.075, 0.12, 8),
  };
  return _sharedMortarAssets;
}

export function createMortarBombMesh(): THREE.Group {
  const group = new THREE.Group();
  const assets = getSharedMortarAssets();

  const body = new THREE.Mesh(assets.bodyGeo, assets.steelBodyMat);
  group.add(body);

  const hazardBand = new THREE.Mesh(assets.bandGeo, assets.hazardMat);
  hazardBand.position.y = -0.05;
  group.add(hazardBand);

  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(assets.finGeo, assets.finMetalMat);
    fin.position.y = 0.34;
    fin.rotation.y = (i * Math.PI) / 2;
    group.add(fin);
  }

  const tailRod = new THREE.Mesh(assets.tailRodGeo, assets.finMetalMat);
  tailRod.position.y = 0.38;
  group.add(tailRod);

  const fuse = new THREE.Mesh(assets.fuseGeo, assets.fuseMat);
  fuse.position.y = -0.44;
  group.add(fuse);

  return group;
}

// 23. 3D ORGAN ENVIRONMENT PROPS (Realistic 360° Wall-Rooted Beating Cilia & Smoothly Moving Mucus, Smooth Muscle & Acid, Microvilli & Bile, Spinal Neurones, Sparse Road Signs & 3D Anatomical Landmarks!)
export function createOrganEnvironmentProps(themeId: string): {
  group: THREE.Group;
  ciliaList: Array<{
    mesh: THREE.Object3D;
    phase: number;
    baseRotZ: number;
    distalTips?: THREE.Object3D[];
  }>;
  flowingBlobs: Array<{
    mesh: THREE.Object3D;
    speed: number;
    baseX: number;
    baseY: number;
    angle: number;
    phase: number;
  }>;
  muscleRings: THREE.Mesh[];
  floorLiquid?: THREE.Mesh;
  roadSigns: Array<{
    mesh: THREE.Group;
    code: string;
    title: string;
    subtitle: string;
    distance: string;
    style: 'highway' | 'roundabout' | 'warning' | 'landmark';
    side: number;
    speed: number;
  }>;
  landmarks: Array<{
    mesh: THREE.Group;
    rotor?: THREE.Object3D;
    streams?: THREE.Object3D[];
    title: string;
    subtitle: string;
    side: number;
    speed: number;
  }>;
} {
  const group = new THREE.Group();
  const ciliaList: Array<{
    mesh: THREE.Object3D;
    phase: number;
    baseRotZ: number;
    distalTips?: THREE.Object3D[];
  }> = [];
  const flowingBlobs: Array<{
    mesh: THREE.Object3D;
    speed: number;
    baseX: number;
    baseY: number;
    angle: number;
    phase: number;
  }> = [];
  const muscleRings: THREE.Mesh[] = [];
  let floorLiquid: THREE.Mesh | undefined;

  // Elliptical canal radii so top (UP), bottom (DOWN), LEFT, and RIGHT walls tightly frame the player's field of view!
  const wallRadiusX = 6.2;
  const wallRadiusY = 4.25;

  if (themeId === 'alveoli') {
    // TRACHEA TO ALVEOLI:
    // 1. 360° Wet Respiratory Mucosal Epithelial Sleeve + Tracheal Cartilage Rings so cilia are physically rooted in the canal walls (UP, DOWN, LEFT, RIGHT)!
    const mucosaWallMat = createFastLitMaterial({
      color: 0x881337,
      emissive: 0x4c0519,
      emissiveIntensity: 0.45,
      roughness: 0.35,
      metalness: 0.08,
      side: THREE.BackSide,
    });
    const innerCanalGeo = new THREE.CylinderGeometry(1.0, 1.0, 72, 32, 1, true);
    innerCanalGeo.rotateX(Math.PI / 2);
    const innerCanal = new THREE.Mesh(innerCanalGeo, mucosaWallMat);
    innerCanal.scale.set(wallRadiusX, wallRadiusY, 1.0);
    innerCanal.position.set(0, 0, -28);
    group.add(innerCanal);

    // Glistening Periciliary Mucus Gel Blanket coating all 4 walls (Up, Down, Left, Right) around the bases of the cilia
    const mucusGelSheenMat = createFastLitMaterial({
      color: 0xa3e635,
      emissive: 0x3f6212,
      emissiveIntensity: 0.55,
      transparent: true,
      opacity: 0.22,
      roughness: 0.08,
      metalness: 0.2,
      side: THREE.BackSide,
    });
    const gelLiningGeo = new THREE.CylinderGeometry(1.0, 1.0, 72, 32, 1, true);
    gelLiningGeo.rotateX(Math.PI / 2);
    const gelLining = new THREE.Mesh(gelLiningGeo, mucusGelSheenMat);
    gelLining.scale.set(wallRadiusX * 0.91, wallRadiusY * 0.91, 1.0);
    gelLining.position.set(0, 0, -28);
    group.add(gelLining);

    // Fleshy Tracheal Cartilage & Mucosal Submucosa Rings around the canal
    const cartilageRingMat = createFastLitMaterial({
      color: 0xbe123c,
      emissive: 0x881337,
      emissiveIntensity: 0.35,
      roughness: 0.4,
    });
    const ringGeo = new THREE.TorusGeometry(1.0, 0.048, 8, 32);
    for (let z = -3; z >= -60; z -= 6.0) {
      const ring = new THREE.Mesh(ringGeo, cartilageRingMat);
      ring.scale.set(wallRadiusX, wallRadiusY, 1.0);
      ring.userData = { sx: wallRadiusX, sy: wallRadiusY };
      ring.position.set(0, 0, z);
      group.add(ring);
      muscleRings.push(ring);
    }

    // 2. REALISTIC CURVED MULTI-SEGMENT BEATING CILIA CARPETS ON ALL WALLS (UP, DOWN, LEFT, RIGHT & DIAGONALS)
    const epithelialPadMat = createFastLitMaterial({
      color: 0xe11d48,
      emissive: 0x881337,
      emissiveIntensity: 0.35,
      roughness: 0.45,
    });
    const ciliaShaftMat = createFastLitMaterial({
      color: 0xfb7185,
      emissive: 0xbe123c,
      emissiveIntensity: 0.38,
      roughness: 0.25,
      metalness: 0.1,
    });
    const ciliaTipMat = createFastLitMaterial({
      color: 0xfda4af,
      emissive: 0xd9f99d, // Subtle mucus-coated sheen at ciliary tips
      emissiveIntensity: 0.28,
      roughness: 0.18,
    });

    // Shared geometries for lightweight 360° beating ciliary bundles (optimized for 60 FPS on mobile!)
    const padGeo = new THREE.SphereGeometry(0.28, 6, 5);
    padGeo.scale(1.5, 0.42, 1.3);
    const ciliumGeo = new THREE.CapsuleGeometry(0.025, 0.85, 4, 6);
    ciliumGeo.translate(0, 0.45, 0);

    // 2 hair offsets per epithelial cell tuft (lightweight draw-call count)
    const hairOffsets = [
      { dx: -0.1, dz: 0, tiltX: 0.18, tiltZ: 0.08, hScale: 1.05, mat: ciliaTipMat },
      { dx: 0.1, dz: 0, tiltX: 0.22, tiltZ: -0.08, hScale: 0.96, mat: ciliaShaftMat },
    ];

    // 4 circumferential angles around the canal spaced every 9.5 units (24 tufts total instead of 80 -> 75% fewer draw calls!)
    const numWallSectors = 4;
    for (let z = -4.0; z >= -52.0; z -= 9.5) {
      const zRowIdx = Math.round(Math.abs(z) / 9.5);
      for (let s = 0; s < numWallSectors; s++) {
        const angle = (s / numWallSectors) * Math.PI * 2 + (zRowIdx % 2) * (Math.PI / numWallSectors);
        const wx = Math.cos(angle) * wallRadiusX * 0.98;
        const wy = Math.sin(angle) * wallRadiusY * 0.98;

        const inwardAngle = Math.atan2(-wy, -wx);
        const baseRotZ = inwardAngle - Math.PI / 2;

        const tuftGroup = new THREE.Group();
        tuftGroup.position.set(wx, wy, z);
        tuftGroup.rotation.z = baseRotZ;

        const cellPad = new THREE.Mesh(padGeo, epithelialPadMat);
        tuftGroup.add(cellPad);

        const ciliaPivot = new THREE.Group();

        hairOffsets.forEach((ho) => {
          const hairMesh = new THREE.Mesh(ciliumGeo, ho.mat);
          hairMesh.position.set(ho.dx, 0.05, ho.dz);
          hairMesh.scale.setScalar(ho.hScale);
          hairMesh.rotation.set(ho.tiltX, 0, ho.tiltZ);
          ciliaPivot.add(hairMesh);
        });

        tuftGroup.add(ciliaPivot);
        group.add(tuftGroup);

        ciliaList.push({
          mesh: ciliaPivot,
          phase: z * 0.42 + s * 0.35,
          baseRotZ: 0,
        });
      }
    }

    // 3. VISCOUS MUCUS STREAMS & GLOBULES GLIDING SMOOTHLY ON ALL WALLS (UP, DOWN, LEFT, RIGHT)
    const viscousMucusMat = createFastLitMaterial({
      color: 0xbef264,
      emissive: 0x65a30d,
      emissiveIntensity: 0.65,
      transparent: true,
      opacity: 0.78,
      roughness: 0.08,
      metalness: 0.15,
    });
    const deepMucinMat = createFastLitMaterial({
      color: 0xa3e635,
      emissive: 0x4d7c0f,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.85,
      roughness: 0.12,
    });

    const mainRibbonGeo = new THREE.CapsuleGeometry(0.24, 1.35, 6, 8);
    mainRibbonGeo.rotateX(Math.PI / 2);
    const subLobeGeo = new THREE.SphereGeometry(0.22, 6, 6);

    // 16 Multi-lobed Mucus Blankets distributed across ALL 8 wall angles
    for (let m = 0; m < 16; m++) {
      const sectorIdx = m % 8;
      const angle = (sectorIdx / 8) * Math.PI * 2 + ((m % 2) - 0.5) * 0.12;

      const baseX = Math.cos(angle) * wallRadiusX * 0.83;
      const baseY = Math.sin(angle) * wallRadiusY * 0.83;
      const zStart = -2 - (m / 16) * 56;

      const mucusCluster = new THREE.Group();
      mucusCluster.position.set(baseX, baseY, zStart);
      mucusCluster.rotation.z = Math.atan2(-baseY, -baseX) - Math.PI / 2;

      const ribbon = new THREE.Mesh(mainRibbonGeo, viscousMucusMat);
      ribbon.scale.set(1.45, 0.42, 1.3);
      mucusCluster.add(ribbon);

      const drop = new THREE.Mesh(subLobeGeo, deepMucinMat);
      drop.position.set(0.18, 0.04, 0.35);
      drop.scale.set(1.15, 0.5, 1.5);
      mucusCluster.add(drop);

      group.add(mucusCluster);
      flowingBlobs.push({
        mesh: mucusCluster,
        speed: 3.6 + (m % 4) * 0.35,
        baseX,
        baseY,
        angle,
        phase: zStart * 0.42,
      });
    }
  } else if (themeId === 'stomach') {
    // ESOPHAGUS TO STOMACH: Smooth Muscle Peristalsis Rings + Bubbling Green HCl Acid Pool on the ground!
    const muscleMat = createFastLitMaterial({
      color: 0xe11d48,
      emissive: 0x881337,
      emissiveIntensity: 0.5,
      roughness: 0.5,
    });
    for (let z = -8; z >= -56; z -= 8) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(7.2, 0.38, 8, 24), muscleMat);
      ring.position.set(0, 0, z);
      group.add(ring);
      muscleRings.push(ring);
    }

    // Bubbling Green/Yellow Stomach Acid Pool on the floor (y = -2.35)
    const acidMat = createFastLitMaterial({
      color: 0x84cc16,
      emissive: 0x65a30d,
      emissiveIntensity: 1.1,
      transparent: true,
      opacity: 0.65,
      roughness: 0.15,
    });
    floorLiquid = new THREE.Mesh(new THREE.PlaneGeometry(12, 75), acidMat);
    floorLiquid.rotation.x = -Math.PI / 2;
    floorLiquid.position.set(0, -2.35, -32);
    group.add(floorLiquid);

    // Acid bubbles rising & drifting along the stomach floor
    for (let b = 0; b < 16; b++) {
      const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.24 + Math.random() * 0.2, 8, 8), acidMat);
      const baseX = (Math.random() - 0.5) * 8.5;
      const baseY = -2.15 + Math.random() * 0.4;
      bubble.position.set(baseX, baseY, -5 - Math.random() * 55);
      group.add(bubble);
      flowingBlobs.push({
        mesh: bubble,
        speed: 2.5 + Math.random() * 1.8,
        baseX,
        baseY,
        angle: -Math.PI / 2,
        phase: b * 0.7,
      });
    }
  } else if (themeId === 'intestine') {
    // SMALL INTESTINE: Smooth Muscle Bands + 360° Finger-like Microvilli + Golden-Green Bile Stream on Floor!
    const muscleMat = createFastLitMaterial({
      color: 0xf43f5e,
      emissive: 0x9f1239,
      emissiveIntensity: 0.4,
      roughness: 0.55,
    });
    for (let z = -10; z >= -58; z -= 9) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(7.3, 0.32, 8, 24), muscleMat);
      ring.position.set(0, 0, z);
      group.add(ring);
      muscleRings.push(ring);
    }

    // Finger-like Villi & Microvilli projections waving around walls (lightweight 28 meshes instead of 160!)
    const villiMat = createFastLitMaterial({
      color: 0xfbbf24,
      emissive: 0xd97706,
      emissiveIntensity: 0.55,
      roughness: 0.35,
    });
    const villusGeo = new THREE.CapsuleGeometry(0.14, 0.95, 5, 6);
    villusGeo.translate(0, 0.48, 0);
    for (let z = -5; z >= -53; z -= 8.0) {
      for (let s = 0; s < 4; s++) {
        const angle = (s / 4) * Math.PI * 2 + (Math.round(Math.abs(z)) % 2) * 0.4;
        const vx = Math.cos(angle) * wallRadiusX;
        const vy = Math.sin(angle) * wallRadiusY;
        const baseRotZ = Math.atan2(-vy, -vx) - Math.PI / 2;

        const villus = new THREE.Mesh(villusGeo, villiMat);
        villus.position.set(vx, vy, z);
        villus.rotation.z = baseRotZ;
        group.add(villus);
        ciliaList.push({ mesh: villus, phase: z * 0.35 + s * 0.4, baseRotZ });
      }
    }

    // Golden-Green Bile Stream on the intestinal floor
    const bileMat = createFastLitMaterial({
      color: 0xa3e635,
      emissive: 0xca8a04,
      emissiveIntensity: 0.95,
      transparent: true,
      opacity: 0.6,
      roughness: 0.2,
    });
    floorLiquid = new THREE.Mesh(new THREE.PlaneGeometry(11, 75), bileMat);
    floorLiquid.rotation.x = -Math.PI / 2;
    floorLiquid.position.set(0, -2.35, -32);
    group.add(floorLiquid);

    // Emulsified Bile droplets drifting along the lumen
    for (let b = 0; b < 14; b++) {
      const drop = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 8), bileMat);
      const baseX = (Math.random() - 0.5) * 8.0;
      const baseY = -2.0 + Math.random() * 0.6;
      drop.position.set(baseX, baseY, -5 - Math.random() * 55);
      group.add(drop);
      flowingBlobs.push({
        mesh: drop,
        speed: 3.4 + Math.random() * 1.5,
        baseX,
        baseY,
        angle: -Math.PI / 2,
        phase: b * 0.6,
      });
    }
  } else if (themeId === 'brain') {
    // BRAIN & SPINAL CORD: Myelinated Neurone Axons & Synaptic Pulses!
    const myelinMat = createFastLitMaterial({
      color: 0x8b5cf6,
      emissive: 0x6d28d9,
      emissiveIntensity: 0.75,
      roughness: 0.3,
    });
    const pulseMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

    for (let z = -9; z >= -57; z -= 8) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(7.2, 0.22, 8, 20), myelinMat);
      ring.position.set(0, 0, z);
      group.add(ring);
      muscleRings.push(ring);
    }

      // Glowing Action-Potential Synaptic Pulses racing along the spinal cord walls
    for (let p = 0; p < 16; p++) {
      const angle = (p / 16) * Math.PI * 2;
      const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), pulseMat);
      pulse.scale.set(0.6, 0.6, 2.4);
      const baseX = Math.cos(angle) * 6.0;
      const baseY = Math.sin(angle) * 4.1;
      pulse.position.set(baseX, baseY, -5 - Math.random() * 55);
      group.add(pulse);
      flowingBlobs.push({
        mesh: pulse,
        speed: 9.5 + Math.random() * 4.0,
        baseX,
        baseY,
        angle,
        phase: p * 0.5,
      });
    }
  }

  // ANATOMICAL 3D ROAD SIGNS (Bronchial Roundabout, The Arc de Diaphragmo, Aortic Autobahn, etc.)
  const roadSignCatalog: Record<
    string,
    Array<{
      code: string;
      title: string;
      subtitle: string;
      distance: string;
      style: 'highway' | 'roundabout' | 'warning' | 'landmark';
    }>
  > = {
    alveoli: [
      {
        code: 'R-O2',
        title: 'BRONCHIAL ROUNDABOUT',
        subtitle: 'YIELD TO COUGHING TRAFFIC • EXIT 2: L. LUNG',
        distance: '150 µm ⟲',
        style: 'roundabout',
      },
      {
        code: 'I-72',
        title: 'THE ARC DE DIAPHRAGMO',
        subtitle: 'SCENIC THORACIC OVERPASS • INHALE LANE',
        distance: '400 µm ⬆️',
        style: 'landmark',
      },
      {
        code: 'W-14',
        title: 'CILIA SWEEPING ZONE',
        subtitle: 'SLIPPERY MUCUS WHEN WET • REDUCE SPEED',
        distance: 'NEXT 2 km ⚠️',
        style: 'warning',
      },
      {
        code: 'T-01',
        title: 'EPIGLOTTIS TOLL BRIDGE',
        subtitle: 'AIR TRAFFIC ONLY • NO FOOD OR DRINK',
        distance: '300 µm 🚧',
        style: 'highway',
      },
      {
        code: 'E-99',
        title: 'ALVEOLI CUL-DE-SAC',
        subtitle: 'O2 / CO2 GAS EXCHANGE TERMINAL AHEAD',
        distance: '650 µm ↗️',
        style: 'highway',
      },
    ],
    capillary: [
      {
        code: 'A-120',
        title: 'AORTIC AUTOBAHN',
        subtitle: 'SPEED LIMIT: 120/80 mmHg • NO CLOTTING',
        distance: '200 µm ⬆️',
        style: 'highway',
      },
      {
        code: 'I-01',
        title: 'THE ARC DE DIAPHRAGMO',
        subtitle: 'AORTIC HIATUS TUNNEL • KEEP PULSE STEADY',
        distance: '450 µm 🏛️',
        style: 'landmark',
      },
      {
        code: 'R-VC',
        title: 'VENA CAVA ROUNDABOUT',
        subtitle: 'MERGE WITH DEOXYGENATED RBC TRAFFIC',
        distance: '180 µm ⟲',
        style: 'roundabout',
      },
      {
        code: 'W-SA',
        title: 'SA NODE PACEMAKER JCT',
        subtitle: 'HIGH VOLTAGE RHYTHM ZONE • 72 BPM',
        distance: '320 µm ⚡',
        style: 'warning',
      },
      {
        code: 'E-CA',
        title: 'CAROTID EXPRESSWAY',
        subtitle: 'HOV LANE TO BRAIN • JUGULAR RETURN',
        distance: '500 µm ↗️',
        style: 'highway',
      },
    ],
    stomach: [
      {
        code: 'I-LES',
        title: 'THE ARC DE DIAPHRAGMO',
        subtitle: 'ESOPHAGEAL SPHINCTER • NO ACID REFLUX',
        distance: '120 µm 🏛️',
        style: 'landmark',
      },
      {
        code: 'R-RG',
        title: 'RUGAE ROUNDABOUT',
        subtitle: 'HEAVY PERISTALSIS CHURNING • HOLD ON',
        distance: '240 µm ⟲',
        style: 'roundabout',
      },
      {
        code: 'W-PH',
        title: 'PYLORIC SPHINCTER TOLL',
        subtitle: 'CORROSIVE HCl ACID pH 1.5 AHEAD',
        distance: '310 µm ⚠️',
        style: 'warning',
      },
      {
        code: 'H-91',
        title: 'HEARTBURN HIGHWAY',
        subtitle: 'ONE WAY DIGESTIVE TRAFFIC • DO NOT BACKFLOW',
        distance: '480 µm 🔥',
        style: 'highway',
      },
      {
        code: 'E-12',
        title: 'PEPSINOGEN BYPASS',
        subtitle: 'PROTEIN BREAKDOWN LANE • MERGE RIGHT',
        distance: '600 µm ↗️',
        style: 'highway',
      },
    ],
    intestine: [
      {
        code: 'R-DD',
        title: 'DUODENUM ROUNDABOUT',
        subtitle: 'GALLBLADDER BILE DUCT MERGE LEFT',
        distance: '160 µm ⟲',
        style: 'roundabout',
      },
      {
        code: 'I-JJ',
        title: 'JEJUNUM SUPERHIGHWAY',
        subtitle: 'NEXT REST STOP: 6 METERS OF LOOPS',
        distance: '350 µm ⬆️',
        style: 'highway',
      },
      {
        code: 'L-MV',
        title: 'MICROVILLI BOARDWALK',
        subtitle: 'SCENIC NUTRIENT ABSORPTION PICKUP LANE',
        distance: '220 µm 🏛️',
        style: 'landmark',
      },
      {
        code: 'W-AP',
        title: 'APPENDIX CUL-DE-SAC',
        subtitle: 'DEAD END ALLEY • DO NOT INFLAME!',
        distance: '410 µm ⚠️',
        style: 'warning',
      },
      {
        code: 'E-IL',
        title: 'ILEOCECAL VALVE EXIT',
        subtitle: 'COLON BORDER CROSSING • PREPARE TO STOP',
        distance: '580 µm ↗️',
        style: 'highway',
      },
    ],
    brain: [
      {
        code: 'I-CC',
        title: 'CORPUS CALLOSUM BRIDGE',
        subtitle: 'LEFT ↔ RIGHT HEMISPHERE EXPRESS CROSSING',
        distance: '190 µm 🏛️',
        style: 'landmark',
      },
      {
        code: 'R-CW',
        title: 'CIRCLE OF WILLIS ROTARY',
        subtitle: 'CEREBRAL ARTERIAL ROUNDABOUT • YIELD',
        distance: '260 µm ⟲',
        style: 'roundabout',
      },
      {
        code: 'W-MY',
        title: 'NODES OF RANVIER JUMP',
        subtitle: 'SALTATORY CONDUCTION • 120 m/s MINIMUM',
        distance: '340 µm ⚡',
        style: 'warning',
      },
      {
        code: 'H-MO',
        title: 'MEDULLA OBLONGATA JCT',
        subtitle: 'AUTONOMIC BREATHING & HEARTBEAT CONTROL',
        distance: '470 µm ⬆️',
        style: 'highway',
      },
      {
        code: 'E-SC',
        title: 'SCIATIC TURNPIKE SOUTH',
        subtitle: 'EXPRESS AXON TO LUMBAR PLEXUS',
        distance: '620 µm ↗️',
        style: 'highway',
      },
    ],
  };

  // Only spawn 2 well-spaced road signs per tunnel loop (spaced 44 units apart!) so road signs feel special and never clutter the tunnel!
  const signsForTheme = (roadSignCatalog[themeId] || roadSignCatalog.capillary).slice(0, 2);
  const roadSigns: Array<{
    mesh: THREE.Group;
    code: string;
    title: string;
    subtitle: string;
    distance: string;
    style: 'highway' | 'roundabout' | 'warning' | 'landmark';
    side: number;
    speed: number;
  }> = [];

  const strutMat = createFastLitMaterial({
    color: 0x94a3b8,
    metalness: 0.85,
    roughness: 0.25,
  });
  const backplateMat = createFastLitMaterial({
    color: 0x1e293b,
    metalness: 0.7,
    roughness: 0.4,
  });

  signsForTheme.forEach((signDef, idx) => {
    const signGroup = new THREE.Group();
    const side = idx % 2 === 0 ? -1 : 1;

    const signCacheKey = `${signDef.code}|${signDef.title}`;
    let signMat = _roadSignMatCache.get(signCacheKey);
    if (!signMat) {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const bgColors =
          signDef.style === 'roundabout'
            ? ['#0369a1', '#0c4a6e']
            : signDef.style === 'warning'
            ? ['#d97706', '#78350f']
            : signDef.style === 'landmark'
            ? ['#4f46e5', '#312e81']
            : ['#047857', '#064e3b'];

        const borderColor =
          signDef.style === 'warning'
            ? '#fef08a'
            : signDef.style === 'landmark'
            ? '#fde047'
            : '#f8fafc';

        const grad = ctx.createLinearGradient(0, 0, 0, 256);
        grad.addColorStop(0, bgColors[0]);
        grad.addColorStop(1, bgColors[1]);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(6, 6, 500, 244, 22);
        ctx.fill();

        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.roundRect(14, 14, 484, 228, 16);
        ctx.stroke();

        ctx.fillStyle = borderColor;
        ctx.beginPath();
        ctx.roundRect(28, 28, 108, 42, 8);
        ctx.fill();

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 24px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(signDef.code, 82, 57);

        ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
        ctx.beginPath();
        ctx.roundRect(330, 28, 152, 42, 8);
        ctx.fill();
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 21px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(signDef.distance, 406, 56);

        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
        ctx.shadowBlur = 6;
        ctx.font = '900 33px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(signDef.title, 256, 134, 456);

        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(36, 158);
        ctx.lineTo(476, 158);
        ctx.stroke();

        ctx.fillStyle = signDef.style === 'warning' ? '#fef08a' : '#e2e8f0';
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(signDef.subtitle, 256, 198, 452);
      }

      const signTex = new THREE.CanvasTexture(canvas);
      signTex.needsUpdate = true;
      signTex.userData = { isCached: true };
      signMat = new THREE.MeshBasicMaterial({ map: signTex });
      signMat.userData = { isCached: true };
      _roadSignMatCache.set(signCacheKey, signMat);
    }

    const boardW = 2.15;
    const boardH = 1.08;
    const faceMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(boardW, boardH),
      signMat
    );
    faceMesh.position.z = 0.045;
    signGroup.add(faceMesh);

    const backMesh = new THREE.Mesh(
      new THREE.BoxGeometry(boardW + 0.08, boardH + 0.08, 0.06),
      backplateMat
    );
    signGroup.add(backMesh);

    const armLen = 1.35;
    const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, armLen, 8), strutMat);
    upperArm.rotation.z = Math.PI / 2;
    upperArm.position.set(side * (boardW * 0.35), 0.3, -0.02);
    signGroup.add(upperArm);

    const wallX = side * 4.55;
    const wallY = 1.15;
    // Spaced far apart (-22 and -66) so road signs appear occasionally
    const startZ = -22 - idx * 44;
    signGroup.position.set(wallX, wallY, startZ);
    signGroup.rotation.y = side * -0.24;

    group.add(signGroup);
    roadSigns.push({
      mesh: signGroup,
      code: signDef.code,
      title: signDef.title,
      subtitle: signDef.subtitle,
      distance: signDef.distance,
      style: signDef.style,
      side,
      speed: 2.9,
    });
  });

  // 24. 3D ANATOMICAL SIDE LANDMARKS (Fibrinogen Fountain & Thromboglobin Coagulation Tower on the left/right sides!)
  const landmarks: Array<{
    mesh: THREE.Group;
    rotor?: THREE.Object3D;
    streams?: THREE.Object3D[];
    title: string;
    subtitle: string;
    side: number;
    speed: number;
  }> = [];

  const createLandmarkPlaque = (title: string, sub: string, borderHex: string) => {
    const plaqueKey = `${title}|${sub}|${borderHex}`;
    let plaqueMat = _landmarkPlaqueMatCache.get(plaqueKey);
    if (!plaqueMat) {
      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 140;
      const cx = c.getContext('2d');
      if (cx) {
        cx.fillStyle = 'rgba(15, 23, 42, 0.92)';
        cx.beginPath();
        cx.roundRect(6, 6, 500, 128, 18);
        cx.fill();
        cx.strokeStyle = borderHex;
        cx.lineWidth = 6;
        cx.stroke();

        cx.fillStyle = '#ffffff';
        cx.font = '900 30px sans-serif';
        cx.textAlign = 'center';
        cx.fillText(title, 256, 62, 470);

        cx.fillStyle = borderHex;
        cx.font = 'bold 20px monospace';
        cx.fillText(sub, 256, 104, 470);
      }
      const t = new THREE.CanvasTexture(c);
      t.needsUpdate = true;
      t.userData = { isCached: true };
      plaqueMat = new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide });
      plaqueMat.userData = { isCached: true };
      _landmarkPlaqueMatCache.set(plaqueKey, plaqueMat);
    }
    return new THREE.Mesh(
      new THREE.PlaneGeometry(2.3, 0.64),
      plaqueMat
    );
  };

  // LANDMARK 1 (LEFT SIDE): THE FIBRINOGEN FOUNTAIN (Multi-tiered Golden Clotting Cascade Fountain!)
  {
    const fountainGroup = new THREE.Group();
    const basinMat = createFastLitMaterial({
      color: 0xe2e8f0,
      metalness: 0.45,
      roughness: 0.25,
    });
    const fibrinGoldMat = createFastLitMaterial({
      color: 0xfacc15,
      emissive: 0xd97706,
      emissiveIntensity: 1.1,
      roughness: 0.15,
    });

    // Lower & Upper Sculpted Cellular Basins
    const basePool = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.28, 0.36, 18), basinMat);
    fountainGroup.add(basePool);

    const liquidPool = new THREE.Mesh(new THREE.CylinderGeometry(1.06, 1.06, 0.39, 18), fibrinGoldMat);
    fountainGroup.add(liquidPool);

    const centerPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 1.25, 14), basinMat);
    centerPillar.position.y = 0.65;
    fountainGroup.add(centerPillar);

    const upperBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.32, 0.28, 16), basinMat);
    upperBowl.position.y = 1.25;
    fountainGroup.add(upperBowl);

    const topSpout = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 12), fibrinGoldMat);
    topSpout.position.y = 1.55;
    fountainGroup.add(topSpout);

    // 6 Arching Golden Fibrin Polymer Streams spouting from the top bowl into the lower basin
    const streams: THREE.Object3D[] = [];
    for (let s = 0; s < 6; s++) {
      const ang = (s * Math.PI * 2) / 6;
      const arcGroup = new THREE.Group();
      arcGroup.rotation.y = ang;
      const streamArc = new THREE.Mesh(
        new THREE.TorusGeometry(0.55, 0.045, 8, 16, Math.PI),
        fibrinGoldMat
      );
      streamArc.position.set(0.45, 0.95, 0);
      arcGroup.add(streamArc);
      fountainGroup.add(arcGroup);
      streams.push(streamArc);
    }

    const plaque = createLandmarkPlaque(
      '⛲ FIBRINOGEN FOUNTAIN',
      'COAGULATION CASCADE PLAZA • FACTOR I',
      '#facc15'
    );
    plaque.position.set(0, 2.35, 0);
    fountainGroup.add(plaque);

    fountainGroup.position.set(-4.65, -2.1, -42);
    fountainGroup.rotation.y = 0.28;
    group.add(fountainGroup);

    landmarks.push({
      mesh: fountainGroup,
      streams,
      title: '⛲ FIBRINOGEN FOUNTAIN',
      subtitle: 'COAGULATION CASCADE PLAZA • CLOTTING FACTOR I',
      side: -1,
      speed: 2.9,
    });
  }

  // LANDMARK 2 (RIGHT SIDE): THE THROMBOGLOBIN TOWER (Tall Bio-Steel Prothrombin Relay & Coagulation Beacon Tower!)
  {
    const towerGroup = new THREE.Group();
    const latticeMat = createFastLitMaterial({
      color: 0x94a3b8,
      metalness: 0.88,
      roughness: 0.22,
    });
    const thrombinRingMat = createFastLitMaterial({
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 1.2,
      roughness: 0.2,
    });

    // 4 Tapered Lattice Corner Legs + Glowing Thrombin Energy Rings
    const legPositions = [
      [-0.48, -0.48],
      [0.48, -0.48],
      [-0.48, 0.48],
      [0.48, 0.48],
    ];
    legPositions.forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 3.2, 8), latticeMat);
      leg.position.set(lx * 0.7, 1.5, lz * 0.7);
      leg.rotation.z = lx * 0.14;
      leg.rotation.x = -lz * 0.14;
      towerGroup.add(leg);
    });

    [0.5, 1.35, 2.2].forEach((ry, rIdx) => {
      const ringRadius = 0.68 - rIdx * 0.14;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(ringRadius, 0.055, 8, 20), thrombinRingMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = ry;
      towerGroup.add(ring);
    });

    // Rotating Prothrombin Coagulation Dish & Beacon at Top of Tower
    const rotorGroup = new THREE.Group();
    rotorGroup.position.set(0, 3.15, 0);

    const beaconCore = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.28, 1),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    rotorGroup.add(beaconCore);

    const dishRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.04, 8, 18),
      new THREE.MeshBasicMaterial({ color: 0xfacc15 })
    );
    rotorGroup.add(dishRing);
    towerGroup.add(rotorGroup);

    const plaque = createLandmarkPlaque(
      '🗼 THROMBOGLOBIN TOWER',
      'PROTHROMBIN & PLATELET SIGNAL RELAY',
      '#38bdf8'
    );
    plaque.position.set(0, 3.95, 0);
    towerGroup.add(plaque);

    towerGroup.position.set(4.65, -2.25, -76);
    towerGroup.rotation.y = -0.28;
    group.add(towerGroup);

    landmarks.push({
      mesh: towerGroup,
      rotor: rotorGroup,
      title: '🗼 THROMBOGLOBIN TOWER',
      subtitle: 'PROTHROMBIN & PLATELET COAGULATION RELAY',
      side: 1,
      speed: 2.9,
    });
  }

  return { group, ciliaList, flowingBlobs, muscleRings, floorLiquid, roadSigns, landmarks };
}

// ============================================================================
// 25. SECRET SPY MISSION MODELS: SILENCED PISTOL, PATHOGEN GENERAL & BIO-BASE
// ============================================================================

export function createSilencedPistolModel(): {
  group: THREE.Group;
  slideMesh: THREE.Mesh;
} {
  const group = new THREE.Group();

  const matteBlackMat = createFastLitMaterial({
    color: 0x0f172a,
    roughness: 0.32,
    metalness: 0.85,
  });
  const gunmetalSlideMat = createFastLitMaterial({
    color: 0x1e293b,
    roughness: 0.25,
    metalness: 0.92,
  });
  const suppressorMat = createFastLitMaterial({
    color: 0x111827,
    roughness: 0.28,
    metalness: 0.88,
  });
  const tritiumMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
  const laserAccentMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });

  // Ergonomic Polymer Grip
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.28, 0.12), matteBlackMat);
  grip.position.set(0, -0.16, 0.14);
  grip.rotation.x = 0.24;
  group.add(grip);

  // Trigger Guard
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.12), matteBlackMat);
  guard.position.set(0, -0.07, 0.02);
  group.add(guard);

  // Lower Receiver Frame & Picatinny Rail
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.075, 0.42), matteBlackMat);
  frame.position.set(0, -0.01, -0.04);
  group.add(frame);

  // Under-barrel Stealth Laser Module
  const laserBox = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.055, 0.16), gunmetalSlideMat);
  laserBox.position.set(0, -0.06, -0.14);
  group.add(laserBox);

  const laserLens = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), laserAccentMat);
  laserLens.position.set(0, -0.06, -0.225);
  group.add(laserLens);

  // Reciprocating Top Slide
  const slideMesh = new THREE.Mesh(new THREE.BoxGeometry(0.096, 0.085, 0.44), gunmetalSlideMat);
  slideMesh.position.set(0, 0.055, -0.03);
  group.add(slideMesh);

  // Glowing Green Tritium Night Sights (Rear & Front)
  [-0.025, 0.025].forEach((sx) => {
    const rearDot = new THREE.Mesh(new THREE.SphereGeometry(0.011, 6, 6), tritiumMat);
    rearDot.position.set(sx, 0.105, 0.17);
    group.add(rearDot);
  });
  const frontDot = new THREE.Mesh(new THREE.SphereGeometry(0.013, 6, 6), tritiumMat);
  frontDot.position.set(0, 0.105, -0.22);
  group.add(frontDot);

  // Extended Cylindrical Acoustic Silencer / Suppressor Tube
  const suppressor = new THREE.Mesh(
    new THREE.CylinderGeometry(0.048, 0.048, 0.48, 14),
    suppressorMat
  );
  suppressor.rotateX(Math.PI / 2);
  suppressor.position.set(0, 0.052, -0.48);
  group.add(suppressor);

  // Suppressor Cooling Baffle Rings
  [-0.36, -0.48, -0.60].forEach((bz) => {
    const baffleRing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.052, 0.052, 0.025, 12),
      laserAccentMat
    );
    baffleRing.rotateX(Math.PI / 2);
    baffleRing.position.set(0, 0.052, bz);
    group.add(baffleRing);
  });

  return { group, slideMesh };
}

export function createPathogenGeneralModel(): {
  group: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  headGroup: THREE.Group;
} {
  const base = createBacillusSoldier();
  const group = base.group;

  // Upgrade with High-Ranking Pathogen General Regalia: Crimson Commander Beret, Gold Epaulets & Tactical Monocle!
  const crimsonMat = createFastLitMaterial({
    color: 0xdc2626,
    emissive: 0x7f1d1d,
    emissiveIntensity: 0.45,
    roughness: 0.35,
  });
  const goldMat = createFastLitMaterial({
    color: 0xfacc15,
    emissive: 0xca8a04,
    emissiveIntensity: 0.5,
    metalness: 0.85,
    roughness: 0.2,
  });

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.05, 0);

  // Crimson Officer Beret Cap
  const beret = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.32, 0.16, 14), crimsonMat);
  beret.position.set(0.04, 0.22, 0);
  beret.rotation.z = -0.18;
  headGroup.add(beret);

  // Gold Officer Crest on Beret
  const crest = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), goldMat);
  crest.position.set(0, 0.24, 0.31);
  headGroup.add(crest);

  group.add(headGroup);

  // Golden Commander Epaulets on Both Shoulders
  [-0.48, 0.48].forEach((sx) => {
    const epaulet = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.09, 0.32), goldMat);
    epaulet.position.set(sx, 0.68, 0);
    group.add(epaulet);
  });

  // Crimson Commander Chest Sash
  const sash = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.12, 0.52), crimsonMat);
  sash.position.set(0, 0.32, 0.02);
  sash.rotation.z = 0.55;
  group.add(sash);

  return {
    group,
    leftLeg: base.leftLeg,
    rightLeg: base.rightLeg,
    leftArm: base.leftArm,
    rightArm: base.rightArm,
    headGroup,
  };
}

export function createEnemyBioBaseModel(): {
  group: THREE.Group;
  coreMesh: THREE.Mesh;
  radarDish: THREE.Group;
} {
  const group = new THREE.Group();

  const bunkerArmorMat = createFastLitMaterial({
    color: 0x1e293b,
    roughness: 0.4,
    metalness: 0.78,
  });
  const darkSteelMat = createFastLitMaterial({
    color: 0x0f172a,
    roughness: 0.3,
    metalness: 0.9,
  });
  const coreBioMat = createFastLitMaterial({
    color: 0xa855f7,
    emissive: 0x9333ea,
    emissiveIntensity: 1.8,
    roughness: 0.15,
  });
  const hazardStripeMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });

  // Heavy Hexagonal / Octagonal Command Base Foundation
  const foundation = new THREE.Mesh(
    new THREE.CylinderGeometry(1.65, 1.95, 0.95, 8),
    bunkerArmorMat
  );
  foundation.position.set(0, 0.48, 0);
  group.add(foundation);

  // Armored Upper Command Dome
  const upperBastion = new THREE.Mesh(
    new THREE.CylinderGeometry(1.15, 1.45, 0.85, 8),
    darkSteelMat
  );
  upperBastion.position.set(0, 1.25, 0);
  group.add(upperBastion);

  // Glowing Volatile Bio-Reactor Core in the Front Center (Critical Sabotage Weak Point!)
  const coreMesh = new THREE.Mesh(new THREE.SphereGeometry(0.52, 14, 14), coreBioMat);
  coreMesh.position.set(0, 1.15, 1.05);
  group.add(coreMesh);

  const coreRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.62, 0.06, 8, 18),
    hazardStripeMat
  );
  coreRing.position.set(0, 1.15, 1.08);
  group.add(coreRing);

  // Twin Toxin Spore Silo Tanks on Left & Right Flanks
  [-1.35, 1.35].forEach((sx) => {
    const silo = new THREE.Mesh(
      new THREE.CylinderGeometry(0.36, 0.36, 1.65, 12),
      bunkerArmorMat
    );
    silo.position.set(sx, 0.85, -0.2);
    group.add(silo);

    const siloCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.36, 10, 8),
      coreBioMat
    );
    siloCap.position.set(sx, 1.68, -0.2);
    group.add(siloCap);
  });

  // Rotating Pathogen Comms Radar Dish on Roof
  const radarDish = new THREE.Group();
  radarDish.position.set(0, 1.85, -0.15);

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.45, 8), darkSteelMat);
  radarDish.add(mast);

  const dish = new THREE.Mesh(
    new THREE.CylinderGeometry(0.65, 0.15, 0.28, 14),
    bunkerArmorMat
  );
  dish.rotation.x = 0.65;
  dish.position.set(0, 0.32, 0.1);
  radarDish.add(dish);

  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xef4444 })
  );
  beacon.position.set(0, 0.48, 0.28);
  radarDish.add(beacon);

  group.add(radarDish);

  return { group, coreMesh, radarDish };
}

// ============================================================================
// 26. ANATOMICAL STEALTH ENVIRONMENT & PATHOGEN ARTILLERY MODELS
// Trachea Setting: Cilia Trees, Vesicular Crates, Cartilage Barricades & Bio-Artillery
// ============================================================================

export function createBacterialArtilleryModel(): {
  group: THREE.Group;
  barrel: THREE.Mesh;
  sporeCore: THREE.Mesh;
} {
  const group = new THREE.Group();

  const chitinMat = createFastLitMaterial({
    color: 0x334155,
    roughness: 0.45,
    metalness: 0.65,
  });
  const darkSteelMat = createFastLitMaterial({
    color: 0x1e293b,
    roughness: 0.35,
    metalness: 0.85,
  });
  const sporeGlowMat = createFastLitMaterial({
    color: 0x10b981,
    emissive: 0x059669,
    emissiveIntensity: 0.85,
    roughness: 0.2,
  });
  const hazardMat = createFastLitMaterial({
    color: 0xf59e0b,
    emissive: 0xb45309,
    emissiveIntensity: 0.35,
  });

  // Heavy Armored Chitinous Base with Spiked Stabilization Outriggers
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.65, 2.6), chitinMat);
  chassis.position.y = 0.35;
  group.add(chassis);

  [-1.25, 1.25].forEach((sx) => {
    const outrigger = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.5, 2.4), darkSteelMat);
    outrigger.position.set(sx, 0.3, 0);
    group.add(outrigger);

    // Hazard Stripes
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 2.1), hazardMat);
    stripe.position.set(sx, 0.48, 0);
    group.add(stripe);
  });

  // Swivel Turret Ring
  const turretBase = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.1, 0.45, 12), darkSteelMat);
  turretBase.position.y = 0.85;
  group.add(turretBase);

  // Angled Spore Cannon Mortar Barrel (pointed ~48° upward toward distal bronchi)
  const barrelGroup = new THREE.Group();
  barrelGroup.position.set(0, 1.05, 0);
  barrelGroup.rotation.x = -0.75; // Upward angle

  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.46, 2.6, 12),
    darkSteelMat
  );
  barrel.position.set(0, 1.1, 0);
  barrelGroup.add(barrel);

  // Muzzle Brake Ring
  const muzzle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.44, 0.38, 0.32, 12),
    chitinMat
  );
  muzzle.position.set(0, 2.35, 0);
  barrelGroup.add(muzzle);

  // Coiled Bioluminescent Spore Reactor Chamber
  const sporeCore = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 10), sporeGlowMat);
  sporeCore.position.set(0, 0.2, -0.35);
  barrelGroup.add(sporeCore);

  group.add(barrelGroup);

  return { group, barrel, sporeCore };
}

export function createCiliaTreeModel(): {
  group: THREE.Group;
} {
  const group = new THREE.Group();

  const trunkMat = createFastLitMaterial({
    color: 0xf472b6,
    emissive: 0xdb2777,
    emissiveIntensity: 0.25,
    roughness: 0.5,
  });
  const ciliaMat = createFastLitMaterial({
    color: 0xfda4af,
    emissive: 0xf43f5e,
    emissiveIntensity: 0.35,
    roughness: 0.3,
  });
  const mucusDropletMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    emissive: 0xd97706,
    emissiveIntensity: 0.3,
    roughness: 0.1,
    metalness: 0.15,
    transparent: true,
    opacity: 0.8,
  });

  // Cellular Trunk (Epithelial Arbor Stem)
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.38, 3.8, 8), trunkMat);
  trunk.position.y = 1.9;
  group.add(trunk);

  // Crown of Radiating Cilia Fronds (Microscopic Palm / Sea Anemone Foliage)
  const crownGroup = new THREE.Group();
  crownGroup.position.set(0, 3.6, 0);

  const numCilia = 14;
  for (let i = 0; i < numCilia; i++) {
    const angle = (i / numCilia) * Math.PI * 2;
    const cilia = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.09, 1.8, 6), ciliaMat);
    cilia.position.set(Math.cos(angle) * 0.45, 0.65, Math.sin(angle) * 0.45);
    cilia.rotation.z = Math.cos(angle) * 0.75;
    cilia.rotation.x = Math.sin(angle) * 0.75;
    crownGroup.add(cilia);
  }

  // Golden Mucus Droplet Hanging from Cilia Crown (Matches user reference image!)
  const droplet = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), mucusDropletMat);
  droplet.scale.set(1.0, 1.55, 1.0);
  droplet.position.set(0, -0.15, 0);
  crownGroup.add(droplet);

  group.add(crownGroup);

  return { group };
}

export function createVesicularCrateModel(): {
  group: THREE.Group;
} {
  const group = new THREE.Group();

  const crateFrameMat = createFastLitMaterial({
    color: 0x334155,
    roughness: 0.4,
    metalness: 0.6,
  });
  const membraneMat = createFastLitMaterial({
    color: 0x0284c7,
    emissive: 0x0369a1,
    emissiveIntensity: 0.4,
    roughness: 0.25,
  });
  const latchMat = createFastLitMaterial({
    color: 0xf59e0b,
    emissive: 0xb45309,
    emissiveIntensity: 0.35,
  });

  // Outer Hexagonal / Chamfered Storage Crate
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.5, 1.8), crateFrameMat);
  box.position.y = 0.75;
  group.add(box);

  // Bioluminescent Nutrient Window Panels on 4 Sides
  [
    { pos: [0, 0.75, 0.91], rot: [0, 0, 0] },
    { pos: [0, 0.75, -0.91], rot: [0, Math.PI, 0] },
    { pos: [0.91, 0.75, 0], rot: [0, Math.PI / 2, 0] },
    { pos: [-0.91, 0.75, 0], rot: [0, -Math.PI / 2, 0] },
  ].forEach((side) => {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.9), membraneMat);
    panel.position.set(side.pos[0], side.pos[1], side.pos[2]);
    panel.rotation.set(side.rot[0], side.rot[1], side.rot[2]);
    group.add(panel);
  });

  // Ribosomal Security Latch
  const latch = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.14, 0.12), latchMat);
  latch.position.set(0, 1.15, 0.92);
  group.add(latch);

  return { group };
}

export function createTracheaCartilageBarricadeModel(): {
  group: THREE.Group;
} {
  const group = new THREE.Group();

  const cartilageMat = createFastLitMaterial({
    color: 0xfecdd3,
    emissive: 0xf43f5e,
    emissiveIntensity: 0.15,
    roughness: 0.35,
    metalness: 0.1,
  });
  const mucusCushionMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    emissive: 0xd97706,
    emissiveIntensity: 0.25,
    roughness: 0.15,
    transparent: true,
    opacity: 0.85,
  });

  // Heavy C-Shaped Tracheal Cartilage Slab (Chest-High Cover Wall)
  const slab = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.0, 1.2), cartilageMat);
  slab.position.y = 1.0;
  group.add(slab);

  // Top Mucus Cushion Barrier Trim
  const topCushion = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.35, 4.35, 10),
    mucusCushionMat
  );
  topCushion.rotation.z = Math.PI / 2;
  topCushion.position.set(0, 2.05, 0);
  group.add(topCushion);

  return { group };
}
