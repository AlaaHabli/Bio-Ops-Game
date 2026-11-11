import * as THREE from 'three';
import { SuperAbilityType } from '../types/game';


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

// 6. BACTERIA BATTLE TANK (Desert-Tan & Olive-Drab Camo Main Battle Tank with 6 Roadwheels, Sloped ERA Turret Armor, Bore-Evacuator Cannon & Dual Antennas — Matched to IMG_5396.png!)
export function createBacteriaTank(): {
  group: THREE.Group;
  turret: THREE.Group;
  cannon: THREE.Mesh;
  leftTread: THREE.Mesh;
  rightTread: THREE.Mesh;
} {
  const group = new THREE.Group();

  // Palette matched directly to IMG_5396.png (Weathered Desert Sand Tan + Olive Green Camo + Gunmetal Track Links)
  const desertTanLightMat = createFastLitMaterial({
    color: 0xd8c398, // Sunlit weathered desert sand armor
    roughness: 0.45,
    metalness: 0.25,
  });
  const desertTanMidMat = createFastLitMaterial({
    color: 0xbfa678, // Warm desert tan mid-tone
    roughness: 0.5,
    metalness: 0.3,
  });
  const oliveCamoMat = createFastLitMaterial({
    color: 0x5c6b43, // Olive-drab camouflage bands
    roughness: 0.48,
    metalness: 0.35,
  });
  const oliveDarkMat = createFastLitMaterial({
    color: 0x3b462b, // Deep olive structural shadow & ERA frames
    roughness: 0.52,
    metalness: 0.45,
  });
  const trackSteelMat = createFastLitMaterial({
    color: 0x1e242b, // Dark gunmetal steel caterpillar tracks
    roughness: 0.4,
    metalness: 0.75,
  });
  const blackOutlineMat = new THREE.MeshBasicMaterial({ color: 0x0f1410 });

  // 1. Lower & Upper Sloped Main Battle Tank Hull Chassis
  const lowerHull = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.52, 3.35), oliveDarkMat);
  lowerHull.position.set(0, -0.1, 0.0);
  group.add(lowerHull);

  // Sloped Front Glacis Plate in Weathered Desert Tan + Olive Camo Stripe
  const frontGlacis = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.42, 1.15), desertTanLightMat);
  frontGlacis.position.set(0, 0.08, 1.42);
  frontGlacis.rotation.x = 0.34;
  group.add(frontGlacis);

  const glacisCamoStripe = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.43, 1.12), oliveCamoMat);
  glacisCamoStripe.position.set(-0.28, 0.085, 1.42);
  glacisCamoStripe.rotation.x = 0.34;
  group.add(glacisCamoStripe);

  // Lower Front Toe Plate & Dual Tow Shackles (as seen on the front hull of IMG_5396)
  const lowerToePlate = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.36, 0.55), oliveDarkMat);
  lowerToePlate.position.set(0, -0.14, 1.72);
  lowerToePlate.rotation.x = -0.45;
  group.add(lowerToePlate);

  [-0.52, 0.52].forEach((tx) => {
    const towHook = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.035, 6, 12), desertTanMidMat);
    towHook.position.set(tx, -0.06, 1.92);
    towHook.rotation.y = Math.PI / 2;
    group.add(towHook);
  });

  // Wide Upper Hull Deck & Engine Deck
  const upperDeck = new THREE.Mesh(new THREE.BoxGeometry(2.78, 0.26, 3.45), desertTanLightMat);
  upperDeck.position.set(0, 0.24, -0.05);
  group.add(upperDeck);

  // Armored Side Ballistic Skirts with Desert-Tan & Olive-Green Camo Bands
  [-1.38, 1.38].forEach((sx) => {
    const sideSkirt = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.34, 3.35), desertTanMidMat);
    sideSkirt.position.set(sx, 0.14, -0.04);
    group.add(sideSkirt);

    // Alternating Olive Camo Patches along side skirt
    [-1.05, 0.15, 1.1].forEach((cz) => {
      const camoPatch = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.33, 0.55), oliveCamoMat);
      camoPatch.position.set(sx, 0.14, cz);
      group.add(camoPatch);
    });
  });

  // 2. Curved Desert-Tan & Olive Front Track Mudguard Fenders + Headlight Clusters (IMG_5396!)
  [-1.18, 1.18].forEach((fx) => {
    const fenderGroup = new THREE.Group();
    fenderGroup.position.set(fx, 0.18, 1.78);

    const tanFender = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.1, 0.72), desertTanLightMat);
    tanFender.rotation.x = 0.38;
    fenderGroup.add(tanFender);

    const fenderLip = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.05, 0.74), oliveDarkMat);
    fenderLip.position.set(0, -0.03, 0.02);
    fenderLip.rotation.x = 0.38;
    fenderGroup.add(fenderLip);

    // Armored Front Headlight Housing on Upper Glacis Fender
    const lightBox = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.24), oliveDarkMat);
    lightBox.position.set(fx < 0 ? 0.22 : -0.22, 0.16, -0.35);
    fenderGroup.add(lightBox);

    group.add(fenderGroup);
  });

  // 3. Heavy Caterpillar Tracks with 6 Concave Desert-Tan Roadwheels per side + Drive Sprocket (Matched to IMG_5396!)
  const treadGeo = new THREE.BoxGeometry(0.66, 0.76, 3.82);
  const leftTread = new THREE.Mesh(treadGeo, trackSteelMat);
  leftTread.position.set(-1.18, -0.24, 0);
  group.add(leftTread);

  const rightTread = new THREE.Mesh(treadGeo, trackSteelMat);
  rightTread.position.set(1.18, -0.24, 0);
  group.add(rightTread);

  const roadwheelZPositions = [-1.42, -0.85, -0.28, 0.28, 0.85, 1.42];
  [-1.18, 1.18].forEach((tx) => {
    // Front & Rear Exposed Steel Track Link Pads
    for (let bar = -3; bar <= 3; bar++) {
      const frontPad = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.065, 0.08), desertTanMidMat);
      frontPad.position.set(tx, -0.22 + bar * 0.1, 1.92 - Math.abs(bar) * 0.03);
      group.add(frontPad);
    }

    // 6 Concave Desert-Tan Roadwheels with Dark Rubber Tires & Center Hubs
    roadwheelZPositions.forEach((wz) => {
      const wheelX = tx < 0 ? tx - 0.31 : tx + 0.31;
      const tireRim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.25, 0.15, 14),
        blackOutlineMat
      );
      tireRim.rotateZ(Math.PI / 2);
      tireRim.position.set(wheelX, -0.38, wz);
      group.add(tireRim);

      const dishWheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.2, 0.17, 14),
        desertTanMidMat
      );
      dishWheel.rotateZ(Math.PI / 2);
      dishWheel.position.set(wheelX, -0.38, wz);
      group.add(dishWheel);

      const centerHub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 0.19, 10),
        oliveDarkMat
      );
      centerHub.rotateZ(Math.PI / 2);
      centerHub.position.set(wheelX, -0.38, wz);
      group.add(centerHub);
    });

    // Front Toothed Drive Sprocket Wheel & Rear Idler Wheel
    [-1.72, 1.72].forEach((endZ) => {
      const wheelX = tx < 0 ? tx - 0.31 : tx + 0.31;
      const sprocket = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 0.16, 12),
        desertTanLightMat
      );
      sprocket.rotateZ(Math.PI / 2);
      sprocket.position.set(wheelX, -0.14, endZ);
      group.add(sprocket);
    });
  });

  // 4. Faceted Sloped Desert-Tan MBT Turret with 5 Sloped ERA Reactive Armor Blocks per Cheek (IMG_5396!)
  const turret = new THREE.Group();
  turret.position.set(0, 0.78, -0.06);

  // Main Wide Faceted Turret Core
  const turretCore = new THREE.Mesh(
    new THREE.CylinderGeometry(1.12, 1.38, 0.68, 8),
    desertTanLightMat
  );
  turretCore.rotation.y = Math.PI / 8;
  turretCore.scale.set(1.08, 1.0, 1.18);
  turret.add(turretCore);

  // Turret Rear Bustle Rack
  const turretBustle = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.52, 0.85), oliveCamoMat);
  turretBustle.position.set(0, 0.04, -1.05);
  turret.add(turretBustle);

  // 5 Sloped Explosive Reactive Armor (ERA) Bricks Arrayed Along Left & Right Turret Cheeks (Signature feature of IMG_5396!)
  [-1, 1].forEach((sideSign) => {
    for (let bIdx = 0; bIdx < 5; bIdx++) {
      const zOff = 0.72 - bIdx * 0.34;
      const xOff = sideSign * (1.16 + (bIdx < 2 ? -0.06 : 0.04));
      const eraBrick = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.42, 0.26),
        bIdx % 2 === 0 ? desertTanMidMat : oliveDarkMat
      );
      eraBrick.position.set(xOff, -0.02, zOff);
      eraBrick.rotation.z = sideSign * 0.38;
      eraBrick.rotation.y = sideSign * (0.28 - bIdx * 0.08);
      turret.add(eraBrick);

      const eraFrame = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.45, 0.04),
        blackOutlineMat
      );
      eraFrame.position.set(xOff, -0.02, zOff + 0.12);
      eraFrame.rotation.z = sideSign * 0.38;
      turret.add(eraFrame);
    }
  });

  // Canvas Gun Mantlet Dust Cover on Front Turret Center
  const mantlet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.34, 0.52, 14),
    desertTanMidMat
  );
  mantlet.rotateX(Math.PI / 2);
  mantlet.position.set(0, 0.0, 1.28);
  turret.add(mantlet);

  // 5. Long 125mm Smoothbore Main Cannon Barrel with Central Bore Evacuator & Camo Bands (IMG_5396!)
  const cannonGeo = new THREE.CylinderGeometry(0.135, 0.165, 3.15, 16);
  cannonGeo.rotateX(Math.PI / 2);
  const cannon = new THREE.Mesh(cannonGeo, desertTanLightMat);
  cannon.position.set(0, 0.02, 2.25);

  // Olive Camo Band on Cannon Barrel
  const barrelCamoBand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.152, 0.158, 0.75, 16),
    oliveCamoMat
  );
  barrelCamoBand.rotateX(Math.PI / 2);
  barrelCamoBand.position.set(0, 0, -0.45);
  cannon.add(barrelCamoBand);

  // Central Bore Evacuator (Fume Extractor Bulge) on Main Barrel
  const boreEvacuator = new THREE.Mesh(
    new THREE.CylinderGeometry(0.21, 0.21, 0.62, 16),
    desertTanMidMat
  );
  boreEvacuator.rotateX(Math.PI / 2);
  boreEvacuator.position.set(0, 0, 0.22);
  cannon.add(boreEvacuator);

  // Thermal Shroud Rings & Muzzle Reference Collar
  [-0.85, -0.12, 0.56, 1.38].forEach((rz) => {
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(0.175, 0.175, 0.05, 16),
      blackOutlineMat
    );
    ring.rotateX(Math.PI / 2);
    ring.position.set(0, 0, rz);
    cannon.add(ring);
  });

  const muzzleCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.16, 0.26, 16),
    oliveDarkMat
  );
  muzzleCollar.rotateX(Math.PI / 2);
  muzzleCollar.position.set(0, 0, 1.48);
  cannon.add(muzzleCollar);

  const boreOpening = new THREE.Mesh(
    new THREE.CylinderGeometry(0.115, 0.115, 0.08, 14),
    blackOutlineMat
  );
  boreOpening.rotateX(Math.PI / 2);
  boreOpening.position.set(0, 0, 1.58);
  cannon.add(boreOpening);

  turret.add(cannon);

  // 6. Turret Roof Commander Cupola, Pintle Heavy Machine Gun, Thermal Sight Box & Dual Tall Whip Antennas (IMG_5396!)
  const cupolaGroup = new THREE.Group();
  cupolaGroup.position.set(-0.42, 0.42, -0.12);

  const cupolaRing = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.42, 0.22, 12), oliveDarkMat);
  cupolaGroup.add(cupolaRing);

  // Pintle-Mounted Heavy Machine Gun & Ammo Box on Commander Cupola
  const mgReceiver = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.48), blackOutlineMat);
  mgReceiver.position.set(0, 0.22, 0.15);
  cupolaGroup.add(mgReceiver);

  const mgBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.68, 10), trackSteelMat);
  mgBarrel.rotateX(Math.PI / 2);
  mgBarrel.position.set(0, 0.24, 0.58);
  cupolaGroup.add(mgBarrel);

  turret.add(cupolaGroup);

  // Right Roof Rectangular Thermal Sight / Laser Rangefinder Housing (with glass window as in IMG_5396)
  const thermalBox = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.28, 0.36), oliveDarkMat);
  thermalBox.position.set(0.42, 0.48, 0.22);
  turret.add(thermalBox);

  const thermalWindow = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.04), desertTanLightMat);
  thermalWindow.position.set(0.42, 0.48, 0.4);
  turret.add(thermalWindow);

  // Side Stowage Ammunition Box on Left Turret Rear
  const sideAmmoBox = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.52), oliveCamoMat);
  sideAmmoBox.position.set(-1.12, 0.28, -0.58);
  turret.add(sideAmmoBox);

  // Dual Tall Vertical Radio Whip Antennas rising from Turret Roof (Signature silhouette of IMG_5396!)
  [-0.58, 0.48].forEach((ax) => {
    const antennaMast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.025, 1.45, 6),
      blackOutlineMat
    );
    antennaMast.position.set(ax, 1.05, -0.45);
    turret.add(antennaMast);
  });

  group.add(turret);

  return { group, turret, cannon, leftTread, rightTread };
}


// 6b. REAL 3D TACTICAL HOLOGRAPHIC REFLEX SCOPE (Exact 3D model of scope_optic_clean.png):
// - Picatinny dual cross-bolt rail riser clamp
// - Hollow tactical cylindrical housing with chamfered angular shoulders (looking straight through along Z!)
// - Luminous glowing amber/orange inner bezel ring
// - Top solar ambient light collector with amber glow & knurled elevation dial
// - Windage turret on the right side
// - Clear multi-coated optical glass disc
// - Glowing illuminated amber reticle (center dot, chevrons >> <<, horizontal range brackets —| · |—)
export function createTacticalReflexScopeModel(options?: { isSniper?: boolean }): THREE.Group {
  const scope = new THREE.Group();
  scope.name = 'tactical_optic_scope';

  const matteBlack = createFastLitMaterial({ color: 0x0f172a, roughness: 0.45, metalness: 0.75 });
  const darkGunmetal = createFastLitMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.9 });
  const neonAmberGlow = new THREE.MeshBasicMaterial({ color: 0xf97316 });
  const reticleYellowGlow = new THREE.MeshBasicMaterial({ color: 0xfbbf24, side: THREE.DoubleSide });
  const clearLensMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  // 1. Picatinny Riser Base & Dual Clamp Assembly (locks firmly to top rail teeth)
  const baseClamp = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.034, 0.22), matteBlack);
  baseClamp.position.set(0, -0.092, 0);
  scope.add(baseClamp);

  // Left & Right Hex Cross-Bolts
  [-0.06, 0.06].forEach((cz) => {
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.125, 8), darkGunmetal);
    bolt.rotateZ(Math.PI / 2);
    bolt.position.set(0, -0.092, cz);
    scope.add(bolt);

    const knob = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.024, 0.024), matteBlack);
    knob.position.set(0.062, -0.092, cz);
    scope.add(knob);
  });

  // 2. Sculpted Lower Cradle / Neck
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.038, 0.17), darkGunmetal);
  neck.position.set(0, -0.058, 0);
  scope.add(neck);

  // 3. Solid Machined Tactical Housing Tube with Beveled Rims (Solid optic chassis)
  const tubeLength = options?.isSniper ? 0.34 : 0.18;
  const outerRadius = 0.128;
  const innerRadius = 0.108;
  const rearRimZ = tubeLength * 0.5;

  const outerHousing = new THREE.Mesh(
    new THREE.CylinderGeometry(outerRadius, outerRadius, tubeLength, 28, 1, true),
    darkGunmetal
  );
  outerHousing.rotateX(Math.PI / 2);
  scope.add(outerHousing);

  const innerHousing = new THREE.Mesh(
    new THREE.CylinderGeometry(innerRadius, innerRadius, tubeLength, 28, 1, true),
    matteBlack
  );
  innerHousing.rotateX(Math.PI / 2);
  scope.add(innerHousing);

  // Solid Rear Ocular Eyepiece Bezel (Thick machined metal face facing shooter)
  const rearBezel = new THREE.Mesh(
    new THREE.RingGeometry(innerRadius - 0.002, outerRadius + 0.004, 28),
    darkGunmetal
  );
  rearBezel.position.set(0, 0, rearRimZ);
  scope.add(rearBezel);

  // Solid Front Objective Sunshade Bezel
  const frontBezel = new THREE.Mesh(
    new THREE.RingGeometry(innerRadius - 0.002, outerRadius + 0.004, 28),
    matteBlack
  );
  frontBezel.position.set(0, 0, -rearRimZ);
  scope.add(frontBezel);

  // 4. Chamfered Angular Armored Shoulders (from scope_optic_clean.png)
  const leftWing = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.088, tubeLength * 0.9), matteBlack);
  leftWing.position.set(-0.118, 0.02, 0);
  leftWing.rotation.z = -0.42;
  scope.add(leftWing);

  const rightWing = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.088, tubeLength * 0.9), matteBlack);
  rightWing.position.set(0.118, 0.02, 0);
  rightWing.rotation.z = 0.42;
  scope.add(rightWing);

  // 5. Top Ambient Solar Light Collector & Elevation Dial (from scope_optic_clean.png)
  const topCover = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.024, tubeLength * 0.72), matteBlack);
  topCover.position.set(0, outerRadius + 0.012, 0);
  scope.add(topCover);

  const solarCell = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.008, 0.07), neonAmberGlow);
  solarCell.position.set(0, outerRadius + 0.024, 0);
  scope.add(solarCell);

  const elevDial = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.018, 12), darkGunmetal);
  elevDial.position.set(0, outerRadius + 0.028, -0.02);
  scope.add(elevDial);

  const windDial = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.018, 12), darkGunmetal);
  windDial.rotateZ(Math.PI / 2);
  windDial.position.set(outerRadius + 0.024, 0.01, 0);
  scope.add(windDial);

  // 6. SINGLE LUMINOUS GLOWING AMBER/ORANGE OCULAR RIM (Only 1 ring facing shooter — NO second ring down the tube!)
  const amberRing = new THREE.Mesh(
    new THREE.TorusGeometry(innerRadius - 0.003, 0.005, 12, 32),
    neonAmberGlow
  );
  amberRing.position.set(0, 0, rearRimZ - 0.003);
  scope.add(amberRing);

  // 7. Clear Optical Glass Disc (Multi-Coated Reflex Lens)
  const lens = new THREE.Mesh(new THREE.CircleGeometry(innerRadius - 0.004, 24), clearLensMat);
  lens.position.set(0, 0, rearRimZ - 0.008);
  scope.add(lens);

  // 8. HOLOGRAPHIC AMBER RETICLE (Projected in center of lens with glowing yellow circle & white core)
  const reticleDot = new THREE.Mesh(new THREE.CircleGeometry(0.006, 16), reticleYellowGlow);
  reticleDot.position.set(0, 0, rearRimZ - 0.008);
  scope.add(reticleDot);

  const reticleCore = new THREE.Mesh(new THREE.CircleGeometry(0.0028, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
  reticleCore.position.set(0, 0, rearRimZ - 0.0075);
  scope.add(reticleCore);

  // Chevrons >> (left) and << (right)
  const chevronL1 = new THREE.Mesh(new THREE.PlaneGeometry(0.016, 0.0032), reticleYellowGlow);
  chevronL1.position.set(-0.046, 0.006, rearRimZ - 0.008);
  chevronL1.rotation.z = 0.55;
  scope.add(chevronL1);
  const chevronL2 = new THREE.Mesh(new THREE.PlaneGeometry(0.016, 0.0032), reticleYellowGlow);
  chevronL2.position.set(-0.046, -0.006, rearRimZ - 0.008);
  chevronL2.rotation.z = -0.55;
  scope.add(chevronL2);

  const chevronR1 = new THREE.Mesh(new THREE.PlaneGeometry(0.016, 0.0032), reticleYellowGlow);
  chevronR1.position.set(0.046, 0.006, rearRimZ - 0.008);
  chevronR1.rotation.z = -0.55;
  scope.add(chevronR1);
  const chevronR2 = new THREE.Mesh(new THREE.PlaneGeometry(0.016, 0.0032), reticleYellowGlow);
  chevronR2.position.set(0.046, -0.006, rearRimZ - 0.008);
  chevronR2.rotation.z = 0.55;
  scope.add(chevronR2);

  // Horizontal Range Brackets: —|   ·   |—
  const bracketL = new THREE.Mesh(new THREE.PlaneGeometry(0.022, 0.0028), reticleYellowGlow);
  bracketL.position.set(-0.022, 0, rearRimZ - 0.008);
  scope.add(bracketL);
  const postL = new THREE.Mesh(new THREE.PlaneGeometry(0.0028, 0.012), reticleYellowGlow);
  postL.position.set(-0.012, -0.005, rearRimZ - 0.008);
  scope.add(postL);

  const bracketR = new THREE.Mesh(new THREE.PlaneGeometry(0.022, 0.0028), reticleYellowGlow);
  bracketR.position.set(0.022, 0, rearRimZ - 0.008);
  scope.add(bracketR);
  const postR = new THREE.Mesh(new THREE.PlaneGeometry(0.0028, 0.012), reticleYellowGlow);
  postR.position.set(0.012, -0.005, rearRimZ - 0.008);
  scope.add(postR);

  return scope;
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

    // Iconic SCAR UGG-Boot Folding Buttstock (Trimmed for First-Person ADS so it NEVER clips into camera eye!)
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.22, 0.32), scarTanMat);
    stock.position.set(0, -0.03, 0.32);
    group.add(stock);
    const cheekRest = new THREE.Mesh(new THREE.BoxGeometry(0.138, 0.06, 0.22), matteBlackMat);
    cheekRest.position.set(0, 0.07, 0.3);
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

    // Real 3D Tactical Holographic Reflex Scope (Matches scope_optic_clean.png with 100% Hollow Look-Through!)
    const reflexScope = createTacticalReflexScopeModel();
    reflexScope.position.set(0, 0.23, 0.0);
    group.add(reflexScope);

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

    // Real 3D Tactical Telescopic Scope (Matches scope_optic_clean.png with 100% Hollow Look-Through!)
    const sniperScope = createTacticalReflexScopeModel({ isSniper: true });
    sniperScope.position.set(0, 0.23, -0.04);
    group.add(sniperScope);

    // Detachable .338 Lapua Box Magazine
    const sniperMag = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.26, 0.24), matteBlackMat);
    sniperMag.position.set(0, -0.2, 0.0);
    group.add(sniperMag);

    // Skeletonized Precision Buttstock (Trimmed for First-Person ADS so it NEVER clips into camera eye!)
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.2, 0.34), sniperCyanMat);
    stock.position.set(0, -0.04, 0.34);
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

    // Real 3D Tactical Holographic Reflex Scope (Matches scope_optic_clean.png with 100% Hollow Look-Through!)
    const lmgScope = createTacticalReflexScopeModel();
    lmgScope.position.set(0, 0.23, 0.0);
    group.add(lmgScope);

    // Heavy Buffer Stock (Trimmed for First-Person ADS so it NEVER clips into camera eye!)
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.32), matteBlackMat);
    stock.position.set(0, -0.04, 0.32);
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

// 11. PARACHUTING ALLIED WHITE BLOOD CELL COMMANDO (With Rotatable Head, Visible Multilobed Purple Neutrophil Nucleus, Articulated Flexing Limbs & Speech Callout)
export function createAlliedWBCCommando(
  isLeft: boolean,
  playerName: string = 'COMMANDER'
): {
  group: THREE.Group;
  parachuteGroup: THREE.Group;
  headGroup: THREE.Group;
  nucleusGroup: THREE.Group;
  assistBadge: THREE.Mesh;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftRifle: THREE.Mesh;
  rightRifle: THREE.Mesh;
} {
  const group = new THREE.Group();

  // Rotatable Upper Soma / Head Assembly (Turns behind to face player and reveal the multilobed purple nucleus!)
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.12, 0);
  group.add(headGroup);

  // Translucent Pearl-White Leukocyte Membrane (Allows internal multilobed purple nucleus to shine through!)
  const bodyGeo = new THREE.SphereGeometry(0.74, 18, 18);
  const bodyMat = createFastLitMaterial({
    color: 0xf8fafc,
    roughness: 0.2,
    metalness: 0.1,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.18,
    transparent: true,
    opacity: 0.68,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  headGroup.add(body);

  // MULTILOBED PURPLE POLYMORPHONUCLEAR NEUTROPHIL NUCLEUS (3 connected glowing purple lobes inside & protruding slightly so when rotated it is unmistakably visible!)
  const nucleusGroup = new THREE.Group();
  nucleusGroup.position.set(0, 0.06, 0.12);
  const purpleLobeMat = createFastLitMaterial({
    color: 0x9333ea,
    emissive: 0x7e22ce,
    emissiveIntensity: 1.35,
    roughness: 0.25,
  });
  const chromatinBridgeMat = createFastLitMaterial({
    color: 0xc084fc,
    emissive: 0x9333ea,
    emissiveIntensity: 1.1,
  });

  // 3 Distinct Polymorphonuclear Lobes arranged in a horse-shoe / trefoil arc
  const lobePositions: Array<[number, number, number, number]> = [
    [-0.28, 0.14, 0.16, 0.23],
    [0.0, 0.26, 0.22, 0.25],
    [0.28, 0.12, 0.16, 0.23],
  ];
  lobePositions.forEach(([lx, ly, lz, r]) => {
    const lobe = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 12), purpleLobeMat);
    lobe.scale.set(1.1, 0.92, 1.08);
    lobe.position.set(lx, ly, lz);
    nucleusGroup.add(lobe);
  });

  // Thin Chromatin Strands connecting the 3 purple lobes
  [-0.14, 0.14].forEach((bx, idx) => {
    const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.32, 8), chromatinBridgeMat);
    bridge.position.set(bx, 0.19, 0.19);
    bridge.rotation.z = idx === 0 ? -1.1 : 1.1;
    nucleusGroup.add(bridge);
  });
  headGroup.add(nucleusGroup);

  // UN/NATO Elite Blue Commando Beret (Tilted high so the purple multilobed nucleus beneath is clearly visible)
  const beretGeo = new THREE.CylinderGeometry(0.54, 0.6, 0.18, 16);
  const beretMat = createFastLitMaterial({ color: 0x0284c7, roughness: 0.5 });
  const beret = new THREE.Mesh(beretGeo, beretMat);
  beret.position.set(0.1, 0.66, 0);
  beret.rotation.z = -0.26;
  headGroup.add(beret);

  const beretBadge = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.14, 0.04),
    createFastLitMaterial({ color: 0xfacc15, metalness: 0.9 })
  );
  beretBadge.position.set(0.08, 0.66, 0.56);
  headGroup.add(beretBadge);

  // Tactical Ballistic Visor Shades (Positioned lower on face so glowing purple 3-lobed nucleus is visible right above/behind them!)
  const shades = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.15, 0.14),
    createFastLitMaterial({ color: 0x09090b, roughness: 0.1, metalness: 0.9 })
  );
  shades.position.set(0, -0.08, 0.68);
  headGroup.add(shades);

  // Floating 3D Speech Callout ("ASSIST US, [NAME]!") shown when turning head toward player
  const cleanName = (playerName || 'COMMANDER').trim().toUpperCase().slice(0, 12);
  const assistBadge = createDistressSpeechBadge(`ASSIST US, ${cleanName}!`, '#f3e8ff', '#9333ea');
  assistBadge.scale.set(1.55, 1.55, 1.55);
  assistBadge.position.set(0, 1.22, 0);
  assistBadge.visible = false;
  headGroup.add(assistBadge);

  // Tactical Body Armor Plate Carrier Vest & Commando Belt
  const vest = new THREE.Mesh(
    new THREE.CylinderGeometry(0.72, 0.76, 0.52, 16),
    createFastLitMaterial({ color: 0x1e293b, roughness: 0.55 })
  );
  vest.position.set(0, -0.22, 0);
  group.add(vest);

  // Pouch details on vest
  [-0.28, 0, 0.28].forEach((px) => {
    const pouch = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.22, 0.12),
      createFastLitMaterial({ color: 0x334155, roughness: 0.6 })
    );
    pouch.position.set(px, -0.24, 0.72);
    group.add(pouch);
  });

  // Articulated Muscular Commando Limbs
  const limbMat = createFastLitMaterial({ color: 0xe2e8f0, roughness: 0.35 });
  const muscleBandMat = createFastLitMaterial({ color: 0x0284c7, roughness: 0.4 });
  const bootMat = createFastLitMaterial({ color: 0x0f172a, roughness: 0.7 });

  // Articulated Combat Legs with Knee Pads & Boots
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.36, -0.58, 0);
  const lThigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.52, 6, 8), limbMat);
  lThigh.position.set(0, -0.15, 0);
  leftLeg.add(lThigh);
  const lKnee = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.24), bootMat);
  lKnee.position.set(0, -0.22, 0.08);
  leftLeg.add(lKnee);
  const lb = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.36), bootMat);
  lb.position.set(0, -0.46, 0.1);
  leftLeg.add(lb);
  group.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.36, -0.58, 0);
  const rThigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.52, 6, 8), limbMat);
  rThigh.position.set(0, -0.15, 0);
  rightLeg.add(rThigh);
  const rKnee = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.24), bootMat);
  rKnee.position.set(0, -0.22, 0.08);
  rightLeg.add(rKnee);
  const rb = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.36), bootMat);
  rb.position.set(0, -0.46, 0.1);
  rightLeg.add(rb);
  group.add(rightLeg);

  // Muscular Commando Arms (Bicep + Forearm + Tactical Assault Rifle)
  const gunMat = createFastLitMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.2 });
  const barrelMat = createFastLitMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.15 });

  const leftArm = new THREE.Group();
  leftArm.position.set(-0.82, 0.02, 0.12);
  const lBicep = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), limbMat);
  lBicep.scale.set(1.0, 1.35, 1.0);
  lBicep.position.set(-0.06, 0.04, 0);
  leftArm.add(lBicep);
  const lBand = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.08, 10), muscleBandMat);
  lBand.position.set(-0.06, 0.06, 0);
  leftArm.add(lBand);
  const lForearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.48, 6, 8), limbMat);
  lForearm.position.set(0.02, -0.18, 0.18);
  lForearm.rotation.x = 0.65;
  leftArm.add(lForearm);
  const leftRifle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.86), gunMat);
  leftRifle.position.set(0.08, -0.22, 0.42);
  const lBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.42, 8), barrelMat);
  lBarrel.rotateX(Math.PI / 2);
  lBarrel.position.set(0, 0.03, 0.55);
  leftRifle.add(lBarrel);
  leftArm.add(leftRifle);
  group.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.82, 0.02, 0.12);
  const rBicep = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), limbMat);
  rBicep.scale.set(1.0, 1.35, 1.0);
  rBicep.position.set(0.06, 0.04, 0);
  rightArm.add(rBicep);
  const rBand = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.08, 10), muscleBandMat);
  rBand.position.set(0.06, 0.06, 0);
  rightArm.add(rBand);
  const rForearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.48, 6, 8), limbMat);
  rForearm.position.set(-0.02, -0.18, 0.18);
  rForearm.rotation.x = 0.65;
  rightArm.add(rForearm);
  const rightRifle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.86), gunMat);
  rightRifle.position.set(-0.08, -0.22, 0.42);
  const rBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.42, 8), barrelMat);
  rBarrel.rotateX(Math.PI / 2);
  rBarrel.position.set(0, 0.03, 0.55);
  rightRifle.add(rBarrel);
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

  return {
    group,
    parachuteGroup,
    headGroup,
    nucleusGroup,
    assistBadge,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    leftRifle,
    rightRifle,
  };
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

  // Palette matched directly to IMG_5395.webp (Military Olive-Drab Field Howitzer + Dark Treaded Tires + Red Breech Recess)
  const oliveDrabLightMat = createFastLitMaterial({
    color: 0x767d56, // Sunlit olive-drab armor & barrel
    roughness: 0.46,
    metalness: 0.32,
  });
  const oliveDrabMidMat = createFastLitMaterial({
    color: 0x5d6443, // Main olive-drab carriage & recoil housing
    roughness: 0.5,
    metalness: 0.38,
  });
  const oliveDrabDarkMat = createFastLitMaterial({
    color: 0x3d432b, // Shaded olive structural brackets & hubs
    roughness: 0.55,
    metalness: 0.45,
  });
  const tireRubberMat = createFastLitMaterial({
    color: 0x26282a, // Heavy-treaded artillery rubber tires
    roughness: 0.72,
    metalness: 0.15,
  });
  const redBreechMat = createFastLitMaterial({
    color: 0x991b1b, // Signature crimson-red inner breech trough & tail reflectors (IMG_5395.webp!)
    emissive: 0x7f1d1d,
    emissiveIntensity: 0.35,
  });
  const reflectorOrangeMat = new THREE.MeshBasicMaterial({ color: 0xea580c });
  const darkMetalMat = new THREE.MeshBasicMaterial({ color: 0x141712 });

  // 1. Central Firing Jack Baseplate & Heavy Axle Beam
  const firingPedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.62, 0.78, 0.34, 14),
    oliveDrabDarkMat
  );
  firingPedestal.position.set(0, 0.17, -0.35);
  group.add(firingPedestal);

  const mainAxle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 3.05, 12),
    oliveDrabMidMat
  );
  mainAxle.rotateZ(Math.PI / 2);
  mainAxle.position.set(0, 0.68, -0.45);
  group.add(mainAxle);

  // Orange-Red Rectangular Tail Reflector Boxes on Left & Right Axle Ends (as seen in IMG_5395.webp!)
  [-1.22, 1.22].forEach((rx) => {
    const lightBracket = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.32), oliveDrabMidMat);
    lightBracket.position.set(rx, 0.65, -0.82);
    group.add(lightBracket);

    const reflector = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.06), reflectorOrangeMat);
    reflector.position.set(rx, 0.65, -0.97);
    group.add(reflector);
  });

  // 2. Two Large Heavy-Treaded Rubber Artillery Tires with Olive-Drab 6-Bolt Dish Hubs (IMG_5395.webp!)
  [-1.52, 1.52].forEach((wx) => {
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(wx, 0.72, -0.32);

    // Main Thick Rubber Tire Torus/Cylinder
    const tireMain = new THREE.Mesh(
      new THREE.CylinderGeometry(0.72, 0.72, 0.42, 20),
      tireRubberMat
    );
    tireMain.rotateZ(Math.PI / 2);
    wheelGroup.add(tireMain);

    // 12 Radial Off-Road Tire Lug Treads around circumference
    for (let tIdx = 0; tIdx < 12; tIdx++) {
      const ang = (tIdx / 12) * Math.PI * 2;
      const lug = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.08, 0.12), darkMetalMat);
      lug.position.set(0, Math.cos(ang) * 0.71, Math.sin(ang) * 0.71);
      lug.rotation.x = -ang;
      wheelGroup.add(lug);
    }

    // Olive-Drab Concave Steel Wheel Rim + Central Axle Cap
    const wheelRim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 0.45, 14),
      oliveDrabMidMat
    );
    wheelRim.rotateZ(Math.PI / 2);
    wheelGroup.add(wheelRim);

    const wheelHub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.49, 10),
      oliveDrabDarkMat
    );
    wheelHub.rotateZ(Math.PI / 2);
    wheelGroup.add(wheelHub);

    group.add(wheelGroup);
  });

  // 3. Long Split-Trail / Box-Beam Stabilizer Carriage Legs Extending Forward Under Barrel (IMG_5395.webp!)
  [-0.48, 0.48].forEach((tx) => {
    const trailBeam = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.32, 3.65), oliveDrabMidMat);
    trailBeam.position.set(tx, 0.42, 1.15);
    group.add(trailBeam);

    const trailTopFlange = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 3.55), oliveDrabLightMat);
    trailTopFlange.position.set(tx, 0.59, 1.15);
    group.add(trailTopFlange);

    // Side tie-down cleats along carriage beam
    [-0.1, 0.8, 1.7, 2.4].forEach((cz) => {
      const cleat = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 0.14), oliveDrabDarkMat);
      cleat.position.set(tx + (tx < 0 ? -0.2 : 0.2), 0.42, cz);
      group.add(cleat);
    });

    // Circular Ground-Spade Anchor Pad at End of Trail Beam
    const spadePad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.44, 0.14, 12),
      oliveDrabDarkMat
    );
    spadePad.position.set(tx, 0.18, 2.88);
    group.add(spadePad);
  });

  // Forward Barrel Travel Lock A-Frame Bracket on Trail Beams
  const travelLock = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.48, 0.16), oliveDrabDarkMat);
  travelLock.position.set(0, 0.78, 2.15);
  group.add(travelLock);

  // 4. Angled Twin Gun-Shield Flaps (Left & Right) + Handwheel Crank + Optical Sight Mount (IMG_5395.webp!)
  [-0.78, 0.78].forEach((sx) => {
    const shieldLower = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.92, 0.08), oliveDrabMidMat);
    shieldLower.position.set(sx, 1.12, -0.18);
    shieldLower.rotation.x = -0.28;
    shieldLower.rotation.y = sx < 0 ? 0.22 : -0.22;
    group.add(shieldLower);

    const shieldUpperFlap = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.42, 0.07), oliveDrabLightMat);
    shieldUpperFlap.position.set(sx, 1.62, -0.02);
    shieldUpperFlap.rotation.x = -0.62;
    shieldUpperFlap.rotation.y = sx < 0 ? 0.22 : -0.22;
    group.add(shieldUpperFlap);
  });

  // Left Elevation Handwheel Crank & Panoramic Artillery Sight Assembly (IMG_5395.webp!)
  const handwheel = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.03, 8, 16),
    darkMetalMat
  );
  handwheel.position.set(-0.78, 1.18, -0.62);
  handwheel.rotation.y = 0.45;
  group.add(handwheel);

  const sightMount = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.38, 0.26), darkMetalMat);
  sightMount.position.set(-0.62, 1.48, -0.35);
  group.add(sightMount);

  // Twin Hydraulic Equilibrator Cylinders Flanking the Breech
  [-0.44, 0.44].forEach((ex) => {
    const eqCyl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.1, 0.78, 10),
      oliveDrabLightMat
    );
    eqCyl.position.set(ex, 1.05, -0.48);
    eqCyl.rotation.z = ex < 0 ? -0.25 : 0.25;
    eqCyl.rotation.x = 0.22;
    group.add(eqCyl);
  });

  // 5. Elevating Howitzer Cradle, Open Breech Block with Red Inner Trough, Over-Barrel Recoil Recuperator & Long Barrel with Slotted Muzzle Brake (IMG_5395.webp!)
  const barrelGroup = new THREE.Group();
  barrelGroup.position.set(0, 1.18, -0.35);
  barrelGroup.rotation.x = -0.18; // Slight upward field-artillery elevation

  // Heavy Cast-Steel Breech Ring Hood at Rear
  const breechHood = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.72, 0.82), oliveDrabLightMat);
  breechHood.position.set(0, 0.06, -0.38);
  barrelGroup.add(breechHood);

  // Signature Crimson-Red Inner Breech Loading Trough Recess (Directly from IMG_5395.webp!)
  const sporeCore = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.44, 0.56), redBreechMat);
  sporeCore.position.set(0, -0.04, -0.52);
  barrelGroup.add(sporeCore);

  // Swinging Breech Block Door on Left of Breech
  const breechDoor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.44, 0.42), oliveDrabMidMat);
  breechDoor.position.set(-0.42, -0.04, -0.88);
  breechDoor.rotation.y = 0.35;
  barrelGroup.add(breechDoor);

  // Thick Boxy-Rounded Hydro-Pneumatic Recoil Recuperator Housing Mounted ON TOP of Rear Barrel (IMG_5395.webp!)
  const recuperatorHousing = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.42, 2.35),
    oliveDrabMidMat
  );
  recuperatorHousing.position.set(0, 0.34, 0.92);
  barrelGroup.add(recuperatorHousing);

  const recuperatorCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 2.34, 12),
    oliveDrabLightMat
  );
  recuperatorCap.rotateX(Math.PI / 2);
  recuperatorCap.position.set(0, 0.52, 0.92);
  barrelGroup.add(recuperatorCap);

  // Long 152mm/155mm Olive-Drab Howitzer Cannon Barrel Extending Forward
  const barrelGeo = new THREE.CylinderGeometry(0.16, 0.21, 4.45, 16);
  barrelGeo.rotateX(Math.PI / 2);
  const barrel = new THREE.Mesh(barrelGeo, oliveDrabLightMat);
  barrel.position.set(0, 0.06, 2.05);

  // Barrel Collar Band at Mid-Length
  const midCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.18, 16),
    oliveDrabDarkMat
  );
  midCollar.rotateX(Math.PI / 2);
  midCollar.position.set(0, 0, 0.35);
  barrel.add(midCollar);

  // Signature Rectangular Dual-Baffle Slotted Muzzle Brake + Front Tow-Eye Ring at Tip (IMG_5395.webp!)
  const muzzleBrakeBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.36, 0.68),
    oliveDrabMidMat
  );
  muzzleBrakeBody.position.set(0, 0, 2.18);
  barrel.add(muzzleBrakeBody);

  // Dark Side Vent Slots on Muzzle Brake
  [-0.235, 0.235].forEach((vx) => {
    [-0.14, 0.14].forEach((vz) => {
      const ventSlot = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.22, 0.18), darkMetalMat);
      ventSlot.position.set(vx, 0, 2.18 + vz);
      barrel.add(ventSlot);
    });
  });

  // Circular Tow-Eye Ring at the Very Front Tip of the Muzzle Brake (IMG_5395.webp!)
  const muzzleTowRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.11, 0.028, 8, 14),
    oliveDrabLightMat
  );
  muzzleTowRing.rotation.x = Math.PI / 2;
  muzzleTowRing.position.set(0, -0.02, 2.62);
  barrel.add(muzzleTowRing);

  barrelGroup.add(barrel);
  group.add(barrelGroup);

  return { group, barrel, sporeCore };
}

// 26b. TACTICAL C4 SATCHEL CHARGE WITH BLINKING LED BEACON (For Secret Spy Mission Timed Demolition!)
export function createC4SatchelModel(): {
  group: THREE.Group;
  ledMesh: THREE.Mesh;
} {
  const group = new THREE.Group();

  const packMat = createFastLitMaterial({
    color: 0x3f4a3c, // Military olive-grey C4 brick wrapping
    roughness: 0.6,
  });
  const strapMat = createFastLitMaterial({
    color: 0x18181b,
    roughness: 0.4,
  });
  const screenMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

  // Twin C4 Plastic Explosive Bricks
  [-0.14, 0.14].forEach((bx) => {
    const brick = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.42), packMat);
    brick.position.set(bx, 0.08, 0);
    group.add(brick);
  });

  // Binding Straps
  [-0.12, 0.12].forEach((sz) => {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.18, 0.06), strapMat);
    strap.position.set(0, 0.08, sz);
    group.add(strap);
  });

  // Central Digital Detonator Receiver + Blinking Red LED Beacon
  const detonatorBox = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.24), strapMat);
  detonatorBox.position.set(0, 0.19, 0);
  group.add(detonatorBox);

  const timerScreen = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 0.09), screenMat);
  timerScreen.position.set(0, 0.245, 0.03);
  group.add(timerScreen);

  const ledMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.065, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xef4444 })
  );
  ledMesh.position.set(0, 0.26, -0.06);
  group.add(ledMesh);

  return { group, ledMesh };
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

// ============================================================================
// 3D MULTIPLAYER STUDENT COMMANDO OPERATOR (For Simultaneous Online Deathmatch!)
// Includes Translucent Leukocyte Soma, Multilobed Purple Nucleus, Squad Armor,
// Articulated Limbs, Scope Glint, Bio-Stasis Freeze Crystal Cage & Live Callsign!
// ============================================================================
export function updateStudentOperatorBadge(
  canvas: HTMLCanvasElement,
  texture: THREE.CanvasTexture,
  callsign: string,
  className: string,
  isStunned: boolean,
  isLiveHuman: boolean
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Pill background
  ctx.fillStyle = isStunned
    ? 'rgba(8, 51, 68, 0.94)'
    : isLiveHuman
    ? 'rgba(15, 23, 42, 0.94)'
    : 'rgba(24, 24, 27, 0.92)';
  ctx.strokeStyle = isStunned ? '#22d3ee' : isLiveHuman ? '#f43f5e' : '#f59e0b';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(6, 6, canvas.width - 12, canvas.height - 12, 16);
  ctx.fill();
  ctx.stroke();

  // Top line: Student Callsign
  ctx.fillStyle = isStunned ? '#67e8f9' : '#ffffff';
  ctx.font = '900 24px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const cleanName = (callsign || 'OPERATIVE').toUpperCase().slice(0, 14);
  ctx.fillText(isStunned ? `❄️ ${cleanName}` : cleanName, canvas.width / 2, 30);

  // Bottom line: Status or Class Name
  ctx.fillStyle = isStunned ? '#a5f3fc' : isLiveHuman ? '#fda4af' : '#fcd34d';
  ctx.font = 'bold 16px monospace';
  const subText = isStunned
    ? 'STUNNED [SOLVING 3 Qs]'
    : isLiveHuman
    ? `● LIVE · ${(className || 'ONLINE').toUpperCase().slice(0, 12)}`
    : `${(className || 'UNIT').toUpperCase().slice(0, 14)}`;
  ctx.fillText(subText, canvas.width / 2, 56);

  texture.needsUpdate = true;
}

export function updateStudentOperatorAppearance(
  operatorGroup: THREE.Group,
  avatarType: string = 'leukocyte',
  weaponId: string = 'scar_bio'
) {
  const ud = operatorGroup.userData as {
    avatarVariants?: Record<string, THREE.Group>;
    weaponVariants?: Record<string, THREE.Group>;
    limbMeshes?: THREE.Mesh[];
    limbMatsByAvatar?: Record<string, THREE.Material>;
    currentAvatar?: string;
    currentWeapon?: string;
  };
  if (!ud) return;

  const validAvatars = ['leukocyte', 'rbc', 'platelet', 'dendrite', 'antibody', 'mucus'];
  const resolvedAvatar = validAvatars.includes(avatarType) ? avatarType : 'leukocyte';

  if (ud.avatarVariants) {
    ud.currentAvatar = resolvedAvatar;
    for (const key of validAvatars) {
      if (ud.avatarVariants[key]) {
        ud.avatarVariants[key].visible = key === resolvedAvatar;
      }
    }
    if (ud.limbMeshes && ud.limbMatsByAvatar && ud.limbMatsByAvatar[resolvedAvatar]) {
      const mat = ud.limbMatsByAvatar[resolvedAvatar];
      for (let i = 0; i < ud.limbMeshes.length; i++) {
        ud.limbMeshes[i].material = mat;
      }
    }
  }

  const validWeapons = ['scar_bio', 'pump_shotgun', 'bolt_sniper', 'drum_lmg'];
  const resolvedWeapon = validWeapons.includes(weaponId) ? weaponId : 'scar_bio';

  if (ud.weaponVariants) {
    ud.currentWeapon = resolvedWeapon;
    for (const wKey of validWeapons) {
      if (ud.weaponVariants[wKey]) {
        ud.weaponVariants[wKey].visible = wKey === resolvedWeapon;
      }
    }
  }
}

export function createMultiplayerStudentOperator(slotIdx: number = 0): {
  group: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  scopeGlint: THREE.Mesh;
  stasisCage: THREE.Group;
  callsignBadge: THREE.Mesh;
  callsignCanvas: HTMLCanvasElement;
  callsignTexture: THREE.CanvasTexture;
} {
  const group = new THREE.Group();

  const squadColors = [0xe11d48, 0xd97706, 0x7c3aed, 0x0284c7, 0x059669, 0x10b981];
  const accentHex = squadColors[slotIdx % squadColors.length];

  const avatarVariants: Record<string, THREE.Group> = {};
  const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const eyePupilMat = new THREE.MeshBasicMaterial({ color: 0x09090b });
  const browDarkMat = createFastLitMaterial({ color: 0x0f172a, roughness: 0.4 });
  const vestMat = createFastLitMaterial({ color: 0x1e293b, roughness: 0.52 });

  // Helper to attach fierce front-facing tactical eyes (+Z forward)
  const attachFierceEyes = (parent: THREE.Group, yPos: number, zPos: number, browColor: number = 0x0f172a) => {
    const bMat = browColor === 0x0f172a ? browDarkMat : createFastLitMaterial({ color: browColor, roughness: 0.35 });
    [-1, 1].forEach((side) => {
      const eyeW = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), eyeWhiteMat);
      eyeW.scale.set(1, 0.85, 0.55);
      eyeW.position.set(side * 0.21, yPos, zPos);
      parent.add(eyeW);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), eyePupilMat);
      pupil.position.set(side * 0.21, yPos - 0.01, zPos + 0.05);
      parent.add(pupil);

      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.045, 0.08), bMat);
      brow.position.set(side * 0.21, yPos + 0.09, zPos + 0.04);
      brow.rotation.z = side * 0.32;
      parent.add(brow);
    });
  };

  // ==========================================================================
  // 1. WHITE LEUKOCYTE FIGHTER ('leukocyte')
  // ==========================================================================
  {
    const leukoGroup = new THREE.Group();
    const bodyMat = createFastLitMaterial({
      color: 0xf8fafc,
      roughness: 0.22,
      metalness: 0.1,
      emissive: accentHex,
      emissiveIntensity: 0.16,
      transparent: true,
      opacity: 0.74,
    });
    const soma = new THREE.Mesh(new THREE.SphereGeometry(0.66, 16, 16), bodyMat);
    soma.position.set(0, 0.22, 0);
    leukoGroup.add(soma);

    const purpleLobeMat = createFastLitMaterial({
      color: 0x9333ea,
      emissive: 0x7e22ce,
      emissiveIntensity: 1.25,
      roughness: 0.25,
    });
    [
      [-0.22, 0.26, 0.12],
      [0, 0.36, 0.16],
      [0.22, 0.26, 0.12],
    ].forEach(([lx, ly, lz]) => {
      const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 10), purpleLobeMat);
      lobe.position.set(lx, ly, lz);
      leukoGroup.add(lobe);
    });

    const beretMat = createFastLitMaterial({ color: accentHex, roughness: 0.45 });
    const beret = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.54, 0.16, 14), beretMat);
    beret.position.set(0.06, 0.78, 0);
    beret.rotation.z = -0.22;
    leukoGroup.add(beret);

    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 0.14, 0.14),
      createFastLitMaterial({ color: 0x09090b, metalness: 0.9, roughness: 0.1 })
    );
    visor.position.set(0, 0.18, 0.58);
    leukoGroup.add(visor);

    const vest = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.68, 0.48, 14), vestMat);
    vest.position.set(0, -0.18, 0);
    leukoGroup.add(vest);

    const chestStripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.22, 0.14),
      createFastLitMaterial({ color: accentHex, roughness: 0.4 })
    );
    chestStripe.position.set(0, -0.16, 0.62);
    leukoGroup.add(chestStripe);

    avatarVariants['leukocyte'] = leukoGroup;
    group.add(leukoGroup);
  }

  // ==========================================================================
  // 2. RED BLOOD CELL (ERYTHROCYTE) FIGHTER ('rbc')
  // ==========================================================================
  {
    const rbcGroup = new THREE.Group();
    const rbcMat = createFastLitMaterial({
      color: 0xe11d48,
      emissive: 0xbe123c,
      emissiveIntensity: 0.45,
      roughness: 0.28,
    });
    const rbcDimpleMat = createFastLitMaterial({
      color: 0x9f1239,
      emissive: 0x881337,
      emissiveIntensity: 0.35,
      roughness: 0.35,
    });

    // Biconcave disc standing upright facing +Z
    const torus = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.25, 14, 24), rbcMat);
    torus.position.set(0, 0.16, 0);
    torus.scale.set(1.0, 1.0, 0.72);
    rbcGroup.add(torus);

    const centerWeb = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.16, 16), rbcDimpleMat);
    centerWeb.rotation.x = Math.PI / 2;
    centerWeb.position.set(0, 0.16, 0);
    rbcGroup.add(centerWeb);

    // Tactical Crimson Headband & Commando Belt
    const headband = new THREE.Mesh(
      new THREE.BoxGeometry(1.12, 0.12, 0.46),
      createFastLitMaterial({ color: 0xfef08a, emissive: 0xfacc15, emissiveIntensity: 0.4, roughness: 0.3 })
    );
    headband.position.set(0, 0.56, 0.04);
    rbcGroup.add(headband);

    attachFierceEyes(rbcGroup, 0.24, 0.24, 0x4c0519);

    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.58, 0.24, 14), vestMat);
    belt.position.set(0, -0.36, 0);
    rbcGroup.add(belt);

    rbcGroup.visible = false;
    avatarVariants['rbc'] = rbcGroup;
    group.add(rbcGroup);
  }

  // ==========================================================================
  // 3. PLATELET (THROMBOCYTE) FIGHTER ('platelet')
  // ==========================================================================
  {
    const pltGroup = new THREE.Group();
    const pltMat = createFastLitMaterial({
      color: 0xfbbf24,
      emissive: 0xd97706,
      emissiveIntensity: 0.55,
      roughness: 0.28,
    });
    const spikeMat = createFastLitMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.65,
      roughness: 0.25,
    });

    const core = new THREE.Mesh(new THREE.SphereGeometry(0.58, 16, 14), pltMat);
    core.position.set(0, 0.14, 0);
    core.scale.set(1.08, 0.92, 0.78);
    pltGroup.add(core);

    // 8 Radiating Activated Platelet Pseudopodia Spikes
    const spikeGeo = new THREE.ConeGeometry(0.11, 0.48, 7);
    for (let s = 0; s < 8; s++) {
      const ang = (s / 8) * Math.PI * 2;
      const spike = new THREE.Mesh(spikeGeo, spikeMat);
      spike.position.set(Math.cos(ang) * 0.66, 0.14 + Math.sin(ang) * 0.58, (s % 2 === 0 ? 1 : -1) * 0.08);
      spike.rotation.z = ang - Math.PI / 2;
      pltGroup.add(spike);
    }

    attachFierceEyes(pltGroup, 0.2, 0.44, 0x78350f);

    const vest = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.56, 0.3, 12), vestMat);
    vest.position.set(0, -0.32, 0);
    pltGroup.add(vest);

    pltGroup.visible = false;
    avatarVariants['platelet'] = pltGroup;
    group.add(pltGroup);
  }

  // ==========================================================================
  // 4. DENDRITE FIGHTER ('dendrite')
  // ==========================================================================
  {
    const dendGroup = new THREE.Group();
    const dendMat = createFastLitMaterial({
      color: 0xc084fc,
      emissive: 0x9333ea,
      emissiveIntensity: 0.68,
      roughness: 0.25,
    });
    const tipMat = createFastLitMaterial({
      color: 0x22d3ee,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.9,
      roughness: 0.2,
    });

    const soma = new THREE.Mesh(new THREE.OctahedronGeometry(0.58, 2), dendMat);
    soma.position.set(0, 0.16, 0);
    soma.scale.set(1.05, 1.0, 0.78);
    dendGroup.add(soma);

    const branchGeo = new THREE.ConeGeometry(0.1, 0.62, 6);
    const tipGeo = new THREE.SphereGeometry(0.09, 8, 8);
    for (let b = 0; b < 6; b++) {
      const ang = (b / 6) * Math.PI * 2 + 0.25;
      const branch = new THREE.Mesh(branchGeo, dendMat);
      branch.position.set(Math.cos(ang) * 0.68, 0.18 + Math.sin(ang) * 0.62, 0);
      branch.rotation.z = ang - Math.PI / 2;
      dendGroup.add(branch);

      const tip = new THREE.Mesh(tipGeo, tipMat);
      tip.position.set(Math.cos(ang) * 0.96, 0.18 + Math.sin(ang) * 0.88, 0);
      dendGroup.add(tip);
    }

    attachFierceEyes(dendGroup, 0.22, 0.44, 0x3b0764);

    const vest = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.54, 0.3, 12), vestMat);
    vest.position.set(0, -0.34, 0);
    dendGroup.add(vest);

    dendGroup.visible = false;
    avatarVariants['dendrite'] = dendGroup;
    group.add(dendGroup);
  }

  // ==========================================================================
  // 5. ANTIBODY (IMMUNOGLOBULIN Y-FIGHTER) ('antibody')
  // ==========================================================================
  {
    const abGroup = new THREE.Group();
    const abBodyMat = createFastLitMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.75,
      roughness: 0.22,
    });
    const abTipMat = createFastLitMaterial({
      color: 0xfacc15,
      emissive: 0xeab308,
      emissiveIntensity: 0.9,
      roughness: 0.2,
    });

    // Fc Vertical Stem
    const fcStem = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.52, 8, 12), abBodyMat);
    fcStem.position.set(0, -0.08, 0);
    abGroup.add(fcStem);

    // Left & Right Y-Shaped Fab Arms + Antigen-Binding Golden Claws
    [-1, 1].forEach((side) => {
      const fabArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.48, 8, 10), abBodyMat);
      fabArm.position.set(side * 0.34, 0.44, 0);
      fabArm.rotation.z = -side * 0.62;
      abGroup.add(fabArm);

      const fabTip = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 1), abTipMat);
      fabTip.position.set(side * 0.56, 0.72, 0);
      abGroup.add(fabTip);
    });

    attachFierceEyes(abGroup, 0.14, 0.24, 0x082f49);

    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.22, 12), vestMat);
    belt.position.set(0, -0.36, 0);
    abGroup.add(belt);

    abGroup.visible = false;
    avatarVariants['antibody'] = abGroup;
    group.add(abGroup);
  }

  // ==========================================================================
  // 6. MUCUS CELL (GOBLET CELL) FIGHTER ('mucus')
  // ==========================================================================
  {
    const mucGroup = new THREE.Group();
    const gobletMat = createFastLitMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 0.55,
      roughness: 0.25,
    });
    const mucinGelMat = createFastLitMaterial({
      color: 0xa3e635,
      emissive: 0x65a30d,
      emissiveIntensity: 0.85,
      roughness: 0.18,
    });

    // Tapered Goblet Chalice Cup
    const chalice = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.36, 0.88, 16), gobletMat);
    chalice.position.set(0, 0.14, 0);
    mucGroup.add(chalice);

    // Bubbling Mucin Gel Crown overflowing the Goblet top
    [
      [0, 0.64, 0, 0.28],
      [-0.32, 0.58, 0.14, 0.22],
      [0.32, 0.58, 0.14, 0.22],
      [0, 0.56, 0.32, 0.2],
      [-0.24, 0.6, -0.22, 0.21],
      [0.24, 0.6, -0.22, 0.21],
    ].forEach(([mx, my, mz, mr]) => {
      const drop = new THREE.Mesh(new THREE.SphereGeometry(mr, 10, 10), mucinGelMat);
      drop.position.set(mx, my, mz);
      mucGroup.add(drop);
    });

    attachFierceEyes(mucGroup, 0.22, 0.48, 0x064e3b);

    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.24, 14), vestMat);
    belt.position.set(0, -0.34, 0);
    mucGroup.add(belt);

    mucGroup.visible = false;
    avatarVariants['mucus'] = mucGroup;
    group.add(mucGroup);
  }

  // Limb materials per avatar character so arms and legs match the biological cell fighter!
  const limbMatsByAvatar: Record<string, THREE.Material> = {
    leukocyte: createFastLitMaterial({ color: 0xe2e8f0, roughness: 0.35 }),
    rbc: createFastLitMaterial({ color: 0xf43f5e, roughness: 0.32 }),
    platelet: createFastLitMaterial({ color: 0xfbbf24, roughness: 0.32 }),
    dendrite: createFastLitMaterial({ color: 0xc084fc, roughness: 0.32 }),
    antibody: createFastLitMaterial({ color: 0x38bdf8, roughness: 0.32 }),
    mucus: createFastLitMaterial({ color: 0x34d399, roughness: 0.32 }),
  };

  // Articulated Legs
  const limbMat = limbMatsByAvatar['leukocyte'];
  const bootMat = createFastLitMaterial({ color: 0x0f172a, roughness: 0.7 });

  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.3, -0.52, 0);
  const lThigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.46, 6, 8), limbMat);
  lThigh.position.set(0, -0.16, 0);
  leftLeg.add(lThigh);
  const lBoot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.32), bootMat);
  lBoot.position.set(0, -0.42, 0.08);
  leftLeg.add(lBoot);
  group.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.3, -0.52, 0);
  const rThigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.46, 6, 8), limbMat);
  rThigh.position.set(0, -0.16, 0);
  rightLeg.add(rThigh);
  const rBoot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.32), bootMat);
  rBoot.position.set(0, -0.42, 0.08);
  rightLeg.add(rBoot);
  group.add(rightLeg);

  // Articulated Arms + Realistic 3D Equipped Weapons (SCAR, Shotgun, Sniper, Drum LMG) + Scope Glint
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.66, 0.02, 0.14);
  const lArmMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.44, 6, 8), limbMat);
  lArmMesh.position.set(0.12, -0.14, 0.18);
  lArmMesh.rotation.x = 0.68;
  lArmMesh.rotation.z = -0.25;
  leftArm.add(lArmMesh);
  group.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.66, 0.02, 0.14);
  const rArmMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.44, 6, 8), limbMat);
  rArmMesh.position.set(-0.08, -0.14, 0.16);
  rArmMesh.rotation.x = 0.65;
  rightArm.add(rArmMesh);

  // Pre-build all 4 realistic 3D weapons on the operator's right arm so players clearly see the exact weapon their enemy carries!
  const weaponHolder = new THREE.Group();
  // rightArm.rotation.x is ~ -0.68 rad during combat, so +0.68 rad on weaponHolder.rotation.x levels the barrel horizontally (0° at pitch=0)
  weaponHolder.position.set(-0.18, -0.06, 0.44);
  weaponHolder.rotation.set(0.68, 0, 0);
  weaponHolder.scale.set(0.82, 0.82, 0.82);
  rightArm.add(weaponHolder);

  const weaponVariants: Record<string, THREE.Group> = {};
  const weaponIds = ['scar_bio', 'pump_shotgun', 'bolt_sniper', 'drum_lmg'];
  for (let wIdx = 0; wIdx < weaponIds.length; wIdx++) {
    const wId = weaponIds[wIdx];
    const wModel = createFortniteWeaponModel(wId, '');
    // Rotate weapon 180° around Y so its barrel (-Z in FPS view space) points straight ahead (+Z) along the operator's aim direction
    wModel.group.rotation.y = Math.PI;
    wModel.group.visible = wId === 'scar_bio';
    weaponVariants[wId] = wModel.group;
    weaponHolder.add(wModel.group);
  }

  const scopeGlintMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.0,
  });
  const scopeGlint = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), scopeGlintMat);
  scopeGlint.position.set(-0.18, -0.02, 0.92);
  rightArm.add(scopeGlint);

  group.add(rightArm);

  group.userData = {
    avatarVariants,
    weaponVariants,
    limbMeshes: [lThigh, rThigh, lArmMesh, rArmMesh],
    limbMatsByAvatar,
    currentAvatar: 'leukocyte',
    currentWeapon: 'scar_bio',
  };

  // Pick initial diverse avatar based on slotIdx so even before network sync, slots look varied
  const initialAvatars = ['leukocyte', 'rbc', 'platelet', 'dendrite', 'antibody', 'mucus'];
  updateStudentOperatorAppearance(group, initialAvatars[slotIdx % initialAvatars.length], 'scar_bio');

  // 3D Bio-Stasis Freeze Crystal Cage (Visible when opponent student's 1-minute timer expires and they are stunned solving 3 questions!)
  const stasisCage = new THREE.Group();
  const stasisCrystalMat = new THREE.MeshBasicMaterial({
    color: 0x22d3ee,
    transparent: true,
    opacity: 0.38,
    wireframe: false,
    side: THREE.DoubleSide,
  });
  const stasisWireMat = new THREE.MeshBasicMaterial({
    color: 0x67e8f9,
    wireframe: true,
    transparent: true,
    opacity: 0.85,
  });
  const crystalShell = new THREE.Mesh(new THREE.OctahedronGeometry(1.18, 1), stasisCrystalMat);
  crystalShell.scale.set(0.88, 1.15, 0.88);
  crystalShell.position.set(0, -0.05, 0);
  stasisCage.add(crystalShell);

  const crystalWire = new THREE.Mesh(new THREE.OctahedronGeometry(1.2, 1), stasisWireMat);
  crystalWire.scale.set(0.88, 1.15, 0.88);
  crystalWire.position.set(0, -0.05, 0);
  stasisCage.add(crystalWire);

  stasisCage.visible = false;
  group.add(stasisCage);

  // Dynamic 3D Overhead Callsign & Status Banner
  const callsignCanvas = document.createElement('canvas');
  callsignCanvas.width = 320;
  callsignCanvas.height = 76;
  const callsignTexture = new THREE.CanvasTexture(callsignCanvas);
  updateStudentOperatorBadge(callsignCanvas, callsignTexture, `OPERATIVE ${slotIdx + 1}`, 'ONLINE', false, false);

  const badgeMat = new THREE.MeshBasicMaterial({
    map: callsignTexture,
    transparent: true,
    depthTest: false,
    side: THREE.DoubleSide,
  });
  const callsignBadge = new THREE.Mesh(new THREE.PlaneGeometry(1.85, 0.44), badgeMat);
  callsignBadge.position.set(0, 1.88, 0);
  callsignBadge.renderOrder = 12;
  group.add(callsignBadge);

  return {
    group,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    scopeGlint,
    stasisCage,
    callsignBadge,
    callsignCanvas,
    callsignTexture,
  };
}

// ============================================================================
// OPEN-WORLD PULMONARY LUNG & ALVEOLI BATTLE ROYALE LANDSCAPE (MULTIPLAYER)
// Replaces the enclosed cylinder tunnel in Multiplayer Deathmatch with a wide,
// open 3D Lung Parenchyma battlefield surrounded by breathing grape-like
// Alveolar Sac clusters, Arterioles/Venules capillary beds, Bronchial Arches,
// and an open Thoracic Sky Dome!
// ============================================================================
export function createOpenLungAlveoliLandscape(): {
  group: THREE.Group;
  breathingSacs: Array<{ mesh: THREE.Object3D; phase: number; baseScale: number }>;
  gasParticles: Array<{ mesh: THREE.Mesh; baseY: number; phase: number; speed: number }>;
} {
  const group = new THREE.Group();
  const breathingSacs: Array<{ mesh: THREE.Object3D; phase: number; baseScale: number }> = [];
  const gasParticles: Array<{ mesh: THREE.Mesh; baseY: number; phase: number; speed: number }> = [];

  // 1. Open Thoracic Sky Dome (High-visibility oxygenated atmosphere)
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 256;
  skyCanvas.height = 256;
  const skyCtx = skyCanvas.getContext('2d');
  if (skyCtx) {
    const skyGrad = skyCtx.createLinearGradient(0, 0, 0, 256);
    skyGrad.addColorStop(0, '#090d1e');
    skyGrad.addColorStop(0.38, '#1e102a');
    skyGrad.addColorStop(0.72, '#3b1534');
    skyGrad.addColorStop(1, '#591c3b');
    skyCtx.fillStyle = skyGrad;
    skyCtx.fillRect(0, 0, 256, 256);

    // Subtle bioluminescent pleural aurora bands
    skyCtx.strokeStyle = 'rgba(56, 189, 248, 0.16)';
    skyCtx.lineWidth = 4;
    for (let y = 30; y < 180; y += 28) {
      skyCtx.beginPath();
      skyCtx.moveTo(0, y);
      skyCtx.bezierCurveTo(85, y - 16, 170, y + 16, 256, y);
      skyCtx.stroke();
    }
  }
  const skyTex = new THREE.CanvasTexture(skyCanvas);
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(148, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false })
  );
  group.add(skyDome);

  // 2. Expansive 280x280 Open Lung Parenchyma Floor with Capillary Vascular Network & Surfactant Grid (Fits 20+ Operatives!)
  const floorCanvas = document.createElement('canvas');
  floorCanvas.width = 512;
  floorCanvas.height = 512;
  const fCtx = floorCanvas.getContext('2d');
  if (fCtx) {
    const fGrad = fCtx.createRadialGradient(256, 256, 30, 256, 256, 260);
    fGrad.addColorStop(0, '#4c162e');
    fGrad.addColorStop(0.55, '#3b1124');
    fGrad.addColorStop(1, '#260a18');
    fCtx.fillStyle = fGrad;
    fCtx.fillRect(0, 0, 512, 512);

    // Alveolar epithelial cell polygonal tiling
    fCtx.strokeStyle = 'rgba(244, 114, 182, 0.22)';
    fCtx.lineWidth = 2;
    for (let gx = 0; gx <= 512; gx += 64) {
      fCtx.beginPath();
      fCtx.moveTo(gx, 0);
      fCtx.lineTo(gx, 512);
      fCtx.stroke();
    }
    for (let gy = 0; gy <= 512; gy += 64) {
      fCtx.beginPath();
      fCtx.moveTo(0, gy);
      fCtx.lineTo(512, gy);
      fCtx.stroke();
    }

    // Oxygenated (Red) & Deoxygenated (Blue) Capillary Vessels across the Lung Floor
    for (let v = 0; v < 18; v++) {
      fCtx.strokeStyle = v % 2 === 0 ? 'rgba(239, 68, 68, 0.38)' : 'rgba(59, 130, 246, 0.34)';
      fCtx.lineWidth = 3 + (v % 3);
      fCtx.beginPath();
      const startX = (v * 37) % 512;
      fCtx.moveTo(startX, 0);
      fCtx.bezierCurveTo(
        (startX + 90) % 512,
        170,
        (startX + 420) % 512,
        340,
        startX,
        512
      );
      fCtx.stroke();
    }

    // Glowing Cyan Pulmonary Surfactant Micro-Rings
    fCtx.strokeStyle = 'rgba(34, 211, 238, 0.24)';
    fCtx.lineWidth = 1.5;
    for (let r = 0; r < 24; r++) {
      const rx = (r * 73 + 29) % 480 + 16;
      const ry = (r * 113 + 41) % 480 + 16;
      fCtx.beginPath();
      fCtx.arc(rx, ry, 14 + (r % 10), 0, Math.PI * 2);
      fCtx.stroke();
    }
  }
  const floorTex = new THREE.CanvasTexture(floorCanvas);
  floorTex.wrapS = THREE.RepeatWrapping;
  floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(16, 16);

  const floorGeo = new THREE.PlaneGeometry(280, 280, 44, 44);
  floorGeo.rotateX(-Math.PI / 2);
  // Wide Central Respiratory Valley flanked by elevated High Ground Ridges (Y = +1.5m)
  const posAttr = floorGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    const distFromArenaCenter = Math.hypot(vx, vz + 20);
    let elevation = 0;
    if (distFromArenaCenter > 46) {
      elevation =
        Math.min(11.0, (distFromArenaCenter - 46) * 0.22) *
        (0.65 + 0.35 * Math.sin(vx * 0.12) * Math.cos(vz * 0.12));
    } else {
      const absVx = Math.abs(vx);
      if (absVx >= 16.0) {
        elevation = 1.5;
      } else if (absVx > 13.5) {
        elevation = ((absVx - 13.5) / 2.5) * 1.5;
      } else {
        elevation = 0;
      }
      elevation += Math.sin(vx * 0.16) * Math.cos(vz * 0.16) * 0.08;
    }
    posAttr.setY(i, elevation);
  }
  floorGeo.computeVertexNormals();

  const floorMat = createFastLitMaterial({
    map: floorTex,
    color: 0xfda4af,
    roughness: 0.58,
    metalness: 0.08,
  });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.position.set(0, -1.72, -20);
  group.add(floorMesh);

  // 3. Glowing Pulmonary Gas-Exchange Sector Rings across the Wide 20-Player Landscape
  const sectorRingCoords: Array<[number, number, number, number]> = [
    [0, -18, 6.2, 0x38bdf8],
    [-18, -28, 4.5, 0xf43f5e],
    [18, -28, 4.5, 0xf43f5e],
    [-16, -6, 4.2, 0x22d3ee],
    [16, -6, 4.2, 0x22d3ee],
    [0, -42, 5.2, 0xa855f7],
  ];
  sectorRingCoords.forEach(([rx, rz, rad, col]) => {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(rad, rad + 0.42, 36),
      new THREE.MeshBasicMaterial({
        color: col,
        transparent: true,
        opacity: 0.38,
        side: THREE.DoubleSide,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(rx, -1.58, rz);
    group.add(ring);
  });

  // 4. Shared Materials for Grape-Like Alveolar Sac Clusters & Capillary Beds
  const alveolusPinkMat = createFastLitMaterial({
    color: 0xfb7185,
    emissive: 0xe11d48,
    emissiveIntensity: 0.28,
    roughness: 0.32,
    metalness: 0.08,
    transparent: true,
    opacity: 0.88,
  });
  const alveolusCoralMat = createFastLitMaterial({
    color: 0xfda4af,
    emissive: 0xf43f5e,
    emissiveIntensity: 0.22,
    roughness: 0.35,
    metalness: 0.06,
    transparent: true,
    opacity: 0.86,
  });
  const bronchioleStemMat = createFastLitMaterial({
    color: 0xfecdd3,
    roughness: 0.45,
    metalness: 0.1,
  });
  const arterialRedMat = createFastLitMaterial({
    color: 0xef4444,
    emissive: 0xdc2626,
    emissiveIntensity: 0.45,
    roughness: 0.3,
  });
  const venousBlueMat = createFastLitMaterial({
    color: 0x3b82f6,
    emissive: 0x2563eb,
    emissiveIntensity: 0.45,
    roughness: 0.3,
  });
  const o2OrbMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.85,
  });
  const co2OrbMat = new THREE.MeshBasicMaterial({
    color: 0xf43f5e,
    transparent: true,
    opacity: 0.8,
  });

  const sacSphereGeo = new THREE.SphereGeometry(1.0, 14, 14);
  const capillaryRingGeo = new THREE.TorusGeometry(1.03, 0.075, 7, 20);
  const gasOrbGeo = new THREE.SphereGeometry(0.22, 8, 8);

  // Helper to build a 3D Grape-like Alveolar Sac Cluster with Bronchiole Duct & Capillary Network
  const buildAlveolarCluster = (cx: number, cy: number, cz: number, scale: number, seed: number) => {
    const cluster = new THREE.Group();
    cluster.position.set(cx, cy, cz);

    // Bronchiole Airway Stem with Cartilage Rings
    const stemHeight = 2.6 * scale;
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32 * scale, 0.44 * scale, stemHeight, 10),
      bronchioleStemMat
    );
    stem.position.set(0, stemHeight * 0.45, 0);
    cluster.add(stem);

    // Bunch of 8 Grape-Like Alveolar Sacs + Capillary Web
    const sacGroup = new THREE.Group();
    sacGroup.position.set(0, stemHeight * 0.92, 0);

    const offsets: Array<[number, number, number, number]> = [
      [0, 0.45, 0, 1.15],
      [-0.85, 0.15, 0.45, 0.92],
      [0.85, 0.18, 0.42, 0.95],
      [-0.75, 0.22, -0.65, 0.9],
      [0.78, 0.2, -0.62, 0.88],
      [0, -0.35, 0.78, 0.84],
      [-0.48, 0.88, -0.15, 0.82],
      [0.52, 0.85, 0.18, 0.84],
    ];

    offsets.forEach(([ox, oy, oz, r], idx) => {
      const sacMesh = new THREE.Mesh(
        sacSphereGeo,
        idx % 2 === 0 ? alveolusPinkMat : alveolusCoralMat
      );
      sacMesh.position.set(ox * scale, oy * scale, oz * scale);
      sacMesh.scale.setScalar(r * scale);
      sacGroup.add(sacMesh);

      // Wrap each alveolus in red (oxygenated) and blue (deoxygenated) pulmonary capillaries
      if (idx % 2 === 0) {
        const capRed = new THREE.Mesh(capillaryRingGeo, arterialRedMat);
        capRed.position.copy(sacMesh.position);
        capRed.scale.setScalar(r * scale);
        capRed.rotation.set(idx * 0.7, idx * 1.1, 0.4);
        sacGroup.add(capRed);
      } else {
        const capBlue = new THREE.Mesh(capillaryRingGeo, venousBlueMat);
        capBlue.position.copy(sacMesh.position);
        capBlue.scale.setScalar(r * scale);
        capBlue.rotation.set(-idx * 0.6, idx * 0.9, -0.5);
        sacGroup.add(capBlue);
      }
    });

    cluster.add(sacGroup);
    group.add(cluster);

    breathingSacs.push({
      mesh: sacGroup,
      phase: seed,
      baseScale: 1.0,
    });

    // Floating O2 / CO2 Gas Exchange Orbs rising around the Alveolar Cluster
    const orb = new THREE.Mesh(gasOrbGeo, seed % 2 === 0 ? o2OrbMat : co2OrbMat);
    const orbY = cy + stemHeight + 1.2 * scale;
    orb.position.set(cx + Math.sin(seed) * 0.8, orbY, cz + Math.cos(seed) * 0.8);
    group.add(orb);
    gasParticles.push({
      mesh: orb,
      baseY: orbY,
      phase: seed * 1.7,
      speed: 1.4 + (seed % 3) * 0.4,
    });
  };

  // Place 28 Giant Alveolar Sac Clusters across the wide 20-Player Open Lung Landscape
  const clusterPlacements: Array<[number, number, number, number]> = [
    // Inner-Flank Landmarks across the wide combat basin
    [-19.5, -1.7, -4.0, 1.35],
    [19.5, -1.7, -4.0, 1.35],
    [-22.5, -1.7, -18.0, 1.45],
    [22.5, -1.7, -18.0, 1.45],
    [-20.5, -1.7, -34.0, 1.4],
    [20.5, -1.7, -34.0, 1.4],
    [-18.0, -1.7, -48.0, 1.45],
    [18.0, -1.7, -48.0, 1.45],
    [-16.0, -1.7, 10.0, 1.3],
    [16.0, -1.7, 10.0, 1.3],
    // Wide Outer-Wing Alveolar Sacs (X = ±34 to ±46)
    [-36.0, -1.2, 6.0, 1.85],
    [36.0, -1.2, 6.0, 1.85],
    [-39.0, -1.0, -10.0, 2.05],
    [39.0, -1.0, -10.0, 2.05],
    [-42.0, -0.9, -26.0, 2.15],
    [42.0, -0.9, -26.0, 2.15],
    [-38.0, -1.0, -44.0, 2.0],
    [38.0, -1.0, -44.0, 2.0],
    // Forward Horizon Giant Alveolar Clusters (Z = -60 to -74)
    [-28.0, -0.9, -62.0, 2.2],
    [-12.0, -1.1, -66.0, 2.1],
    [0.0, -1.1, -70.0, 2.35],
    [12.0, -1.1, -66.0, 2.1],
    [28.0, -0.9, -62.0, 2.2],
    // Rear Horizon Giant Alveolar Clusters (Z = +20 to +28)
    [-24.0, -1.1, 22.0, 1.9],
    [-8.0, -1.2, 25.0, 1.85],
    [8.0, -1.2, 25.0, 1.85],
    [24.0, -1.1, 22.0, 1.9],
    [0.0, -1.1, 28.0, 2.1],
  ];

  clusterPlacements.forEach(([x, y, z, sc], idx) => {
    buildAlveolarCluster(x, y, z, sc, idx + 1);
  });

  // 5. Grand Overhead Bronchial Cartilage Arches spanning the Wide 20-Player Basin
  const archMat = createFastLitMaterial({
    color: 0xfda4af,
    emissive: 0x9f1239,
    emissiveIntensity: 0.2,
    roughness: 0.5,
  });
  [-48, -26, -6, 14].forEach((az, aIdx) => {
    const arch = new THREE.Mesh(
      new THREE.TorusGeometry(54 + (aIdx % 2) * 5, 0.85, 8, 36, Math.PI),
      archMat
    );
    arch.position.set(0, -1.5, az);
    group.add(arch);
  });

  // 6. Central Alveolar Research Bunker & High-Ground Rooftop Complex
  // Anchored at Y = -1.72 (true arena ground level) with deep sub-grade foundation pads (-0.30m to +0.55m) so it sits 100% flush on the ground!
  // Features:
  // - Exterior stepped staircases at South & North doors leading into the Ground Floor (elevationY = 0.55m)
  // - Extra-tall 6.40m ceiling (5.85m interior room height, roof surface at 6.70m) so standing inside never feels cramped
  // - True open-cutout tactical shooting windows on South, North, East & West walls at eye level
  // - Wide 4.4m x 4.2m roof hatch opening with a solid sloped internal ladder-staircase to climb smoothly ONTO THE ROOF (elevationY = 6.70m)
  const bunkerGroup = new THREE.Group();
  bunkerGroup.position.set(0, -1.72, -22.0);

  // Anatomical Theme Materials: Cancellous Ivory Bone, Vertebral Cartilage, Costal Ribcage
  const slabMat = createFastLitMaterial({
    color: 0xfef3c7, // ivory cancellous osteoid bone
    emissive: 0x78350f,
    emissiveIntensity: 0.18,
    roughness: 0.45,
  });
  const wallMat = createFastLitMaterial({
    color: 0xffedd5, // osteoblast cortical bone matrix
    emissive: 0x9a3412,
    emissiveIntensity: 0.12,
    roughness: 0.42,
  });
  const parapetMat = createFastLitMaterial({
    color: 0xfda4af, // costal rib bone arches
    emissive: 0xbe123c,
    emissiveIntensity: 0.32,
    roughness: 0.35,
  });
  const windowTrimMat = createFastLitMaterial({
    color: 0x38bdf8, // bioluminescent endothelial frame
    emissive: 0x0284c7,
    emissiveIntensity: 0.55,
    roughness: 0.2,
  });
  const interiorLightCyanMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const interiorLightPinkMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e });

  // Solid Ground Foundation Base (18.6m wide x 10.6m deep x 0.85m tall, spanning local Y = -0.30 to +0.55 so it is 100% embedded in the ground!)
  const groundSlab = new THREE.Mesh(new THREE.BoxGeometry(18.6, 0.85, 10.6), slabMat);
  groundSlab.position.set(0, 0.125, 0);
  bunkerGroup.add(groundSlab);

  // Outer perimeter foundation plinth skirt (ensures zero gap around edges)
  const plinthSkirt = new THREE.Mesh(new THREE.BoxGeometry(19.2, 0.36, 11.2), parapetMat);
  plinthSkirt.position.set(0, -0.05, 0);
  bunkerGroup.add(plinthSkirt);

  // Exterior Stepped Staircases (South & North Entrances) to walk smoothly from ground (0.0m) onto Ground Floor (0.55m)
  const buildEntranceStaircase = (zSign: 1 | -1) => {
    const stairGroup = new THREE.Group();
    const numSteps = 6;
    const stairWidth = 4.0;
    const totalDepth = 2.2; // local z from 5.0 to 7.2
    const stepDepth = totalDepth / numSteps;
    for (let s = 0; s < numSteps; s++) {
      // s = 0 is highest step against doorway (0.55m), s = 5 is lowest step embedded in ground
      const topY = 0.55 * ((numSteps - s) / numSteps);
      const bottomY = -0.25;
      const stepHeight = topY - bottomY;
      const stepMesh = new THREE.Mesh(
        new THREE.BoxGeometry(stairWidth, stepHeight, stepDepth + 0.06),
        slabMat
      );
      const localZ = zSign * (5.0 + (s + 0.5) * stepDepth);
      stepMesh.position.set(0, bottomY + stepHeight * 0.5, localZ);
      stairGroup.add(stepMesh);
    }
    // Side stair stringer curbs
    [-stairWidth / 2 - 0.14, stairWidth / 2 + 0.14].forEach((railX) => {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.85, totalDepth + 0.25), parapetMat);
      curb.position.set(railX, 0.28, zSign * (5.0 + totalDepth * 0.5));
      curb.rotation.x = zSign * 0.22;
      stairGroup.add(curb);
    });
    bunkerGroup.add(stairGroup);
  };
  buildEntranceStaircase(1);  // South Entrance Stairs (world Z: -17.0 to -14.8)
  buildEntranceStaircase(-1); // North Entrance Stairs (world Z: -27.0 to -29.2)

  // Extra-Tall Ceiling / Rooftop Platform Slab at local Y = 6.40 to 6.70 (5.85m above room floor!)
  // Constructed around a WIDE Open Internal Ladder Roof Hatch at local X in [-7.8, -3.4] (4.4m wide), local Z in [-3.8, 0.4] (4.2m long)
  const roofThickness = 0.30;
  const roofBottomY = 6.40;
  const roofTopY = roofBottomY + roofThickness; // top surface at local Y = 6.70
  const roofCenterY = roofBottomY + roofThickness * 0.5;

  // Main East Roof Section (X from -3.4 to +9.2 -> width 12.6, full Z from -5.2 to +5.2 -> depth 10.4)
  const roofEast = new THREE.Mesh(new THREE.BoxGeometry(12.6, roofThickness, 10.4), slabMat);
  roofEast.position.set(2.9, roofCenterY, 0);
  bunkerGroup.add(roofEast);
  // West Outer Strip (X from -9.2 to -7.8 -> width 1.4, full Z from -5.2 to +5.2 -> depth 10.4)
  const roofWestOuter = new THREE.Mesh(new THREE.BoxGeometry(1.4, roofThickness, 10.4), slabMat);
  roofWestOuter.position.set(-8.5, roofCenterY, 0);
  bunkerGroup.add(roofWestOuter);
  // Hatch South Strip (X from -7.8 to -3.4 -> width 4.4, Z from 0.4 to +5.2 -> depth 4.8)
  const roofHatchSouth = new THREE.Mesh(new THREE.BoxGeometry(4.4, roofThickness, 4.8), slabMat);
  roofHatchSouth.position.set(-5.6, roofCenterY, 2.8);
  bunkerGroup.add(roofHatchSouth);
  // Hatch North Landing Strip (X from -7.8 to -3.4 -> width 4.4, Z from -5.2 to -3.8 -> depth 1.4)
  const roofHatchNorth = new THREE.Mesh(new THREE.BoxGeometry(4.4, roofThickness, 1.4), slabMat);
  roofHatchNorth.position.set(-5.6, roofCenterY, -4.5);
  bunkerGroup.add(roofHatchNorth);

  // Glowing Hatch Rim Frame around the wide 4.4m x 4.2m rooftop ladder access opening (X in [-7.8, -3.4], Z in [-3.8, 0.4])
  const hatchTrimN = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.36, 0.16), windowTrimMat);
  hatchTrimN.position.set(-5.6, roofCenterY, -3.8);
  bunkerGroup.add(hatchTrimN);
  const hatchTrimS = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.36, 0.16), windowTrimMat);
  hatchTrimS.position.set(-5.6, roofCenterY, 0.4);
  bunkerGroup.add(hatchTrimS);
  const hatchTrimW = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.36, 4.3), windowTrimMat);
  hatchTrimW.position.set(-7.8, roofCenterY, -1.7);
  bunkerGroup.add(hatchTrimW);
  const hatchTrimE = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.36, 4.3), windowTrimMat);
  hatchTrimE.position.set(-3.4, roofCenterY, -1.7);
  bunkerGroup.add(hatchTrimE);

  // Solid Sloped Internal Climbable Ladder-Staircase inside the room (centered at local X = -5.6, rising from Z = 0.2 at floor 0.55m to Z = -3.8 at roof 6.70m)
  const internalLadderGroup = new THREE.Group();
  const ladderSpanY = roofTopY - 0.55; // 6.15m vertical rise
  const ladderSpanZ = 4.0; // from local Z = 0.2 to -3.8
  const ladderLen = Math.hypot(ladderSpanY, ladderSpanZ);
  const ladderTiltX = Math.atan2(ladderSpanZ, ladderSpanY); // sloped so player walks smoothly straight up onto the roof!
  const railGeo = new THREE.CylinderGeometry(0.11, 0.13, ladderLen + 0.4, 8);
  [-0.95, 0.95].forEach((rx) => {
    const rail = new THREE.Mesh(railGeo, wallMat);
    rail.position.set(-5.6 + rx, 0.55 + ladderSpanY * 0.5, 0.2 - ladderSpanZ * 0.5);
    rail.rotation.x = ladderTiltX;
    internalLadderGroup.add(rail);
  });
  const numInternalSteps = 18;
  const stepBoxGeo = new THREE.BoxGeometry(1.85, 0.12, 0.34);
  const stepGlowGeo = new THREE.BoxGeometry(1.75, 0.05, 0.10);
  for (let i = 0; i <= numInternalSteps; i++) {
    const frac = i / numInternalSteps;
    const sy = 0.55 + frac * ladderSpanY;
    const sz = 0.2 - frac * ladderSpanZ;
    const stepTread = new THREE.Mesh(stepBoxGeo, slabMat);
    stepTread.position.set(-5.6, sy, sz);
    internalLadderGroup.add(stepTread);
    const stepGlow = new THREE.Mesh(stepGlowGeo, windowTrimMat);
    stepGlow.position.set(-5.6, sy + 0.05, sz + 0.12);
    internalLadderGroup.add(stepGlow);
  }
  bunkerGroup.add(internalLadderGroup);

  // Glowing floor guide ring at base of internal ladder inside the room (local X = -5.6, Z = 0.4)
  const ladderFloorRing = new THREE.Mesh(
    new THREE.RingGeometry(0.85, 1.25, 24),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide })
  );
  ladderFloorRing.rotation.x = -Math.PI / 2;
  ladderFloorRing.position.set(-5.6, 0.58, 0.45);
  bunkerGroup.add(ladderFloorRing);

  // Support Columns (Corners & Doorway Piers, height 5.85m from Y=0.55 to Y=6.40)
  const colHeight = 5.85;
  const colCenterY = 0.55 + colHeight * 0.5;
  const columnGeo = new THREE.CylinderGeometry(0.28, 0.32, colHeight, 10);
  const colCoords = [
    [-8.8, colCenterY, -4.8],
    [8.8, colCenterY, -4.8],
    [-8.8, colCenterY, 4.8],
    [8.8, colCenterY, 4.8],
    [-1.95, colCenterY, -4.8],
    [1.95, colCenterY, -4.8],
    [-1.95, colCenterY, 4.8],
    [1.95, colCenterY, 4.8],
  ];
  colCoords.forEach(([cx, cy, cz]) => {
    const col = new THREE.Mesh(columnGeo, wallMat);
    col.position.set(cx, cy, cz);
    bunkerGroup.add(col);
  });

  // Helper to build a solid wall section with a REAL OPEN SHOOTING WINDOW CUTOUT at player eye level!
  // Room floor = 0.55m, ceiling = 6.40m. Player standing eye level = 2.27m (world Y = +0.55m).
  // Window opening spans local Y = 1.40m to 3.55m (2.15m tall panoramic open shooting view!)
  const buildWallWithOpenWindow = (
    centerX: number,
    centerZ: number,
    totalWidth: number,
    winWidth: number,
    isAlongZ: boolean
  ) => {
    const wallThickness = 0.30;
    const yFloor = 0.55;
    const yWinBot = 1.40;
    const yWinTop = 3.55;
    const yCeil = 6.40;

    // 1. Bottom sill wall (from 0.55 to 1.40)
    const sillH = yWinBot - yFloor;
    const sillGeo = isAlongZ
      ? new THREE.BoxGeometry(wallThickness, sillH, totalWidth)
      : new THREE.BoxGeometry(totalWidth, sillH, wallThickness);
    const sillMesh = new THREE.Mesh(sillGeo, wallMat);
    sillMesh.position.set(centerX, yFloor + sillH * 0.5, centerZ);
    bunkerGroup.add(sillMesh);

    // 2. Top lintel wall (from 3.55 to 6.40)
    const lintelH = yCeil - yWinTop;
    const lintelGeo = isAlongZ
      ? new THREE.BoxGeometry(wallThickness, lintelH, totalWidth)
      : new THREE.BoxGeometry(totalWidth, lintelH, wallThickness);
    const lintelMesh = new THREE.Mesh(lintelGeo, wallMat);
    lintelMesh.position.set(centerX, yWinTop + lintelH * 0.5, centerZ);
    bunkerGroup.add(lintelMesh);

    // 3. Left & Right solid piers flanking the open window cutout
    const winH = yWinTop - yWinBot;
    const pierW = Math.max(0.4, (totalWidth - winWidth) * 0.5);
    const pierOffset = winWidth * 0.5 + pierW * 0.5;
    const pierGeo = isAlongZ
      ? new THREE.BoxGeometry(wallThickness, winH, pierW)
      : new THREE.BoxGeometry(pierW, winH, wallThickness);

    const pier1 = new THREE.Mesh(pierGeo, wallMat);
    const pier2 = new THREE.Mesh(pierGeo, wallMat);
    if (isAlongZ) {
      pier1.position.set(centerX, yWinBot + winH * 0.5, centerZ - pierOffset);
      pier2.position.set(centerX, yWinBot + winH * 0.5, centerZ + pierOffset);
    } else {
      pier1.position.set(centerX - pierOffset, yWinBot + winH * 0.5, centerZ);
      pier2.position.set(centerX + pierOffset, yWinBot + winH * 0.5, centerZ);
    }
    bunkerGroup.add(pier1);
    bunkerGroup.add(pier2);

    // 4. Glowing Bioluminescent Frame Bars around the open window cutout (100% hollow center for shooting!)
    const trimThick = 0.09;
    const trimDepth = wallThickness + 0.06;
    const horizTrimGeo = isAlongZ
      ? new THREE.BoxGeometry(trimDepth, trimThick, winWidth + 0.16)
      : new THREE.BoxGeometry(winWidth + 0.16, trimThick, trimDepth);
    const topTrim = new THREE.Mesh(horizTrimGeo, windowTrimMat);
    topTrim.position.set(centerX, yWinTop, centerZ);
    bunkerGroup.add(topTrim);

    const botTrim = new THREE.Mesh(horizTrimGeo, windowTrimMat);
    botTrim.position.set(centerX, yWinBot, centerZ);
    bunkerGroup.add(botTrim);

    const vertTrimGeo = isAlongZ
      ? new THREE.BoxGeometry(trimDepth, winH + 0.16, trimThick)
      : new THREE.BoxGeometry(trimThick, winH + 0.16, trimDepth);
    const sideTrim1 = new THREE.Mesh(vertTrimGeo, windowTrimMat);
    const sideTrim2 = new THREE.Mesh(vertTrimGeo, windowTrimMat);
    if (isAlongZ) {
      sideTrim1.position.set(centerX, yWinBot + winH * 0.5, centerZ - winWidth * 0.5);
      sideTrim2.position.set(centerX, yWinBot + winH * 0.5, centerZ + winWidth * 0.5);
    } else {
      sideTrim1.position.set(centerX - winWidth * 0.5, yWinBot + winH * 0.5, centerZ);
      sideTrim2.position.set(centerX + winWidth * 0.5, yWinBot + winH * 0.5, centerZ);
    }
    bunkerGroup.add(sideTrim1);
    bunkerGroup.add(sideTrim2);
  };

  // South (Front) Walls with Open Shooting Windows (leaving central doorway x in [-1.9, 1.9] open for stair entry)
  buildWallWithOpenWindow(-5.45, 4.88, 7.1, 3.8, false);
  buildWallWithOpenWindow(5.45, 4.88, 7.1, 3.8, false);

  // North (Back) Walls with Open Shooting Windows (leaving central doorway x in [-1.9, 1.9] open for stair entry)
  buildWallWithOpenWindow(-5.45, -4.88, 7.1, 3.8, false);
  buildWallWithOpenWindow(5.45, -4.88, 7.1, 3.8, false);

  // West & East Solid Outer Walls with Wide Open Shooting Windows (entry to building is strictly via stairs!)
  buildWallWithOpenWindow(-8.88, 0, 9.8, 4.8, true);
  buildWallWithOpenWindow(8.88, 0, 9.8, 4.8, true);

  // Interior Bioluminescent Ceiling Light Nodes (high up at Y = 6.10m)
  const lightSphereGeo = new THREE.SphereGeometry(0.30, 8, 8);
  const lightWest = new THREE.Mesh(lightSphereGeo, interiorLightCyanMat);
  lightWest.position.set(-3.2, 6.10, 0);
  bunkerGroup.add(lightWest);

  const lightEast = new THREE.Mesh(lightSphereGeo, interiorLightPinkMat);
  lightEast.position.set(4.2, 6.10, 0);
  bunkerGroup.add(lightEast);

  // Rooftop High-Ground Defensive Parapet Railings (0.90m tall above roof surface Y = 6.70m)
  const parapetH = 0.90;
  const parapetCenterY = roofTopY + parapetH * 0.5;
  const parapetShortGeo = new THREE.BoxGeometry(0.26, parapetH, 10.4);

  const southParapetWest = new THREE.Mesh(new THREE.BoxGeometry(7.2, parapetH, 0.26), parapetMat);
  southParapetWest.position.set(-5.4, parapetCenterY, 5.05);
  bunkerGroup.add(southParapetWest);
  const southParapetEast = new THREE.Mesh(new THREE.BoxGeometry(7.2, parapetH, 0.26), parapetMat);
  southParapetEast.position.set(5.4, parapetCenterY, 5.05);
  bunkerGroup.add(southParapetEast);

  const northParapetWest = new THREE.Mesh(new THREE.BoxGeometry(7.2, parapetH, 0.26), parapetMat);
  northParapetWest.position.set(-5.4, parapetCenterY, -5.05);
  bunkerGroup.add(northParapetWest);
  const northParapetEast = new THREE.Mesh(new THREE.BoxGeometry(7.2, parapetH, 0.26), parapetMat);
  northParapetEast.position.set(5.4, parapetCenterY, -5.05);
  bunkerGroup.add(northParapetEast);

  const westParapet = new THREE.Mesh(parapetShortGeo, parapetMat);
  westParapet.position.set(-9.05, parapetCenterY, 0);
  bunkerGroup.add(westParapet);
  const eastParapet = new THREE.Mesh(parapetShortGeo, parapetMat);
  eastParapet.position.set(9.05, parapetCenterY, 0);
  bunkerGroup.add(eastParapet);

  group.add(bunkerGroup);

  // 7. Standalone Anatomical Vertebral Watchtower in the Fight Ground (X = 14.0, Y = -1.72, Z = -11.0)
  // Anchored flush on the ground at Y = -1.72 with a solid ground foundation pad!
  const towerGroup = new THREE.Group();
  towerGroup.position.set(14.0, -1.72, -11.0);

  // Solid ground foundation base pad for Watchtower (embeds into ground from local Y = -0.30 to +0.22)
  const towerBasePad = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.52, 5.0), slabMat);
  towerBasePad.position.set(0, -0.04, 0);
  towerGroup.add(towerBasePad);

  // 4 Segmented Spinal Vertebral Disc Pillars
  const vertColGeo = new THREE.CylinderGeometry(0.26, 0.32, 5.1, 10);
  [
    [-1.9, 2.35, -1.9],
    [1.9, 2.35, -1.9],
    [-1.9, 2.35, 1.9],
    [1.9, 2.35, 1.9],
  ].forEach(([tx, ty, tz]) => {
    const col = new THREE.Mesh(vertColGeo, wallMat);
    col.position.set(tx, ty, tz);
    towerGroup.add(col);
  });

  // Elevated Cancellous Bone Observation Deck at local Y = 4.8m (4.6m x 4.6m)
  const towerDeck = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.24, 4.6), slabMat);
  towerDeck.position.set(0, 4.8 + 0.12, 0);
  towerGroup.add(towerDeck);

  // Costal Ribcage Parapet Railings around 3 sides (North, West, East)
  const tParapetNorth = new THREE.Mesh(new THREE.BoxGeometry(4.7, 0.85, 0.2), parapetMat);
  tParapetNorth.position.set(0, 4.92 + 0.425, -2.25);
  towerGroup.add(tParapetNorth);

  const tParapetWest = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.85, 4.7), parapetMat);
  tParapetWest.position.set(-2.25, 4.92 + 0.425, 0);
  towerGroup.add(tParapetWest);

  const tParapetEast = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.85, 4.7), parapetMat);
  tParapetEast.position.set(2.25, 4.92 + 0.425, 0);
  towerGroup.add(tParapetEast);

  // South Parapet split leaving ladder access in center
  const tParapetSouthL = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.85, 0.2), parapetMat);
  tParapetSouthL.position.set(-1.5, 4.92 + 0.425, 2.25);
  towerGroup.add(tParapetSouthL);
  const tParapetSouthR = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.85, 0.2), parapetMat);
  tParapetSouthR.position.set(1.5, 4.92 + 0.425, 2.25);
  towerGroup.add(tParapetSouthR);

  // Vertical Climbable Bone Ladder on South Face (Climbs from ground to deck)
  const towerLadder = createAnatomicalLadder(4.9, 1.15);
  towerLadder.position.set(0, 0, 2.32);
  towerGroup.add(towerLadder);

  group.add(towerGroup);

  // 8. Flanking West Pulmonary High Ground Ridge Structure (X = -19.0, Y = -1.72, Z = -11.0)
  // Embedded into ground plane from local Y = -0.30 to +1.50
  const westRidgeTerrace = new THREE.Group();
  westRidgeTerrace.position.set(-19.0, -1.72, -11.0);
  const wDeck = new THREE.Mesh(new THREE.BoxGeometry(5.4, 1.8, 6.4), slabMat);
  wDeck.position.set(0, 0.60, 0);
  westRidgeTerrace.add(wDeck);
  group.add(westRidgeTerrace);

  return { group, breathingSacs, gasParticles };
}

// Elevation & High-Ground Physics for Multiplayer Arena
export function getArenaSurfaceElevation(
  x: number,
  z: number,
  currentElevY: number = 0
): { elevationY: number; isRooftop: boolean; isInsideBuilding: boolean } {
  const ROOF_ELEV = 6.70;

  // 1. Central Bunker South Entrance Staircase (x in [-2.0, 2.0], z from -14.8 to -17.0, climbs 0.0m to 0.55m)
  if (Math.abs(x) <= 2.0 && z <= -14.8 && z >= -17.0) {
    if (currentElevY >= 4.5) {
      return { elevationY: ROOF_ELEV, isRooftop: true, isInsideBuilding: false };
    }
    const t = THREE.MathUtils.clamp((-14.8 - z) / 2.2, 0, 1);
    return { elevationY: t * 0.55, isRooftop: false, isInsideBuilding: z <= -16.5 };
  }

  // 2. Central Bunker North Entrance Staircase (x in [-2.0, 2.0], z from -29.2 to -27.0, climbs 0.0m to 0.55m)
  if (Math.abs(x) <= 2.0 && z >= -29.2 && z <= -27.0) {
    if (currentElevY >= 4.5) {
      return { elevationY: ROOF_ELEV, isRooftop: true, isInsideBuilding: false };
    }
    const t = THREE.MathUtils.clamp((z - (-29.2)) / 2.2, 0, 1);
    return { elevationY: t * 0.55, isRooftop: false, isInsideBuilding: z >= -27.5 };
  }

  // 3. Central Bunker Footprint (x in [-9.0, 9.0], z in [-27.0, -17.0])
  if (x >= -9.0 && x <= 9.0 && z >= -27.0 && z <= -17.0) {
    // Wide Internal Ladder-Staircase Zone inside the West side of the room:
    // World X in [-7.6, -3.6], World Z in [-25.8, -21.2] (local X in [-7.6, -3.6], local Z in [-3.8, 0.8])
    const inInternalLadderZone = x >= -7.6 && x <= -3.6 && z >= -25.8 && z <= -21.2;

    if (currentElevY >= 4.8) {
      // Player is currently standing ON THE ROOF (elevationY = 6.70m)
      // Only descend if they walk back into the middle-south descent slot of the hatch (x in [-6.8, -4.4], z in [-23.8, -21.8])
      if (x >= -6.8 && x <= -4.4 && z >= -23.8 && z <= -21.8) {
        const climbT = THREE.MathUtils.clamp((-21.6 - z) / 3.8, 0, 1);
        return {
          elevationY: 0.55 + climbT * (ROOF_ELEV - 0.55),
          isRooftop: false,
          isInsideBuilding: true,
        };
      }
      return { elevationY: ROOF_ELEV, isRooftop: true, isInsideBuilding: false };
    }

    // Player is inside the Ground Floor room: check if they are climbing the wide Internal Ladder to the roof!
    if (inInternalLadderZone) {
      const climbT = THREE.MathUtils.clamp((-21.6 - z) / 3.8, 0, 1);
      const climbElev = 0.55 + climbT * (ROOF_ELEV - 0.55);
      const reachedRoof = climbT >= 0.85;
      return {
        elevationY: reachedRoof ? ROOF_ELEV : climbElev,
        isRooftop: reachedRoof,
        isInsideBuilding: !reachedRoof,
      };
    }

    return { elevationY: 0.55, isRooftop: false, isInsideBuilding: true };
  }

  // 4. Standalone Watchtower Ladder (x in [12.5, 15.5], z in [-9.5, -8.2], vertical climb 0 to 4.8m)
  if (x >= 12.5 && x <= 15.5 && z >= -9.5 && z <= -8.2) {
    const t = THREE.MathUtils.clamp((-8.2 - z) / 1.3, 0, 1);
    return { elevationY: t * 4.8, isRooftop: t >= 0.85, isInsideBuilding: false };
  }

  // 5. Standalone Watchtower Deck (x in [11.6, 16.4], z in [-13.4, -8.6])
  if (x >= 11.6 && x <= 16.4 && z >= -13.4 && z <= -8.6) {
    if (currentElevY >= 2.2) {
      return { elevationY: 4.8, isRooftop: true, isInsideBuilding: false };
    }
  }

  // 6. Flanking High Ground Ridges (|x| >= 16.0m at Y = +1.5m)
  const absX = Math.abs(x);
  if (absX >= 16.0) {
    return { elevationY: 1.5, isRooftop: false, isInsideBuilding: false };
  }
  if (absX > 13.5) {
    const slopeT = (absX - 13.5) / 2.5;
    return { elevationY: slopeT * 1.5, isRooftop: false, isInsideBuilding: false };
  }

  return { elevationY: 0.0, isRooftop: false, isInsideBuilding: false };
}

// ============================================================================
// ANATOMICAL CLIMBABLE BONE & CARTILAGE LADDER
// Replaces sloped ramps with ivory osteoid bone stanchions, glowing cartilage
// rungs spaced every 0.28m, and curved costal ribcage grab hooks at the top.
// Players can look forward and walk smoothly straight up to the high grounds!
// ============================================================================
export function createAnatomicalLadder(height: number, width: number = 0.95): THREE.Group {
  const ladder = new THREE.Group();

  const boneStanchionMat = createFastLitMaterial({
    color: 0xfef3c7, // ivory cancellous osteoid bone
    emissive: 0x78350f,
    emissiveIntensity: 0.18,
    roughness: 0.45,
    metalness: 0.08,
  });
  const cartilageRungMat = createFastLitMaterial({
    color: 0xfde047, // glowing cartilage golden amber
    emissive: 0xd97706,
    emissiveIntensity: 0.35,
    roughness: 0.3,
  });
  const ribCurveMat = createFastLitMaterial({
    color: 0xfda4af, // costal rib cartilage arch
    emissive: 0xbe123c,
    emissiveIntensity: 0.25,
    roughness: 0.35,
  });

  const railRadius = 0.045;
  const railGeo = new THREE.CylinderGeometry(railRadius, railRadius, height, 10);

  // Left upright bone rail
  const leftRail = new THREE.Mesh(railGeo, boneStanchionMat);
  leftRail.position.set(-width / 2, height / 2, 0);
  ladder.add(leftRail);

  // Right upright bone rail
  const rightRail = new THREE.Mesh(railGeo, boneStanchionMat);
  rightRail.position.set(width / 2, height / 2, 0);
  ladder.add(rightRail);

  // Cartilage rungs spaced every 0.28m
  const rungGeo = new THREE.CylinderGeometry(0.028, 0.028, width, 8);
  rungGeo.rotateZ(Math.PI / 2);
  const rungSpacing = 0.28;
  const numRungs = Math.floor(height / rungSpacing);
  for (let r = 1; r <= numRungs; r++) {
    const rung = new THREE.Mesh(rungGeo, cartilageRungMat);
    rung.position.set(0, r * rungSpacing, 0);
    ladder.add(rung);
  }

  // Costal ribcage safety grab arches at top curving over onto the platform deck
  const hookGeo = new THREE.TorusGeometry(0.22, 0.035, 6, 12, Math.PI);
  const leftHook = new THREE.Mesh(hookGeo, ribCurveMat);
  leftHook.position.set(-width / 2, height, -0.15);
  leftHook.rotation.y = Math.PI / 2;
  leftHook.rotation.z = Math.PI / 2;
  ladder.add(leftHook);

  const rightHook = new THREE.Mesh(hookGeo, ribCurveMat);
  rightHook.position.set(width / 2, height, -0.15);
  rightHook.rotation.y = Math.PI / 2;
  rightHook.rotation.z = Math.PI / 2;
  ladder.add(rightHook);

  return ladder;
}

// ============================================================================
// HEAVY MILITARY TRANSPORT HELICOPTER (Matches reference military helicopter)
// Flies in from the horizon carrying the supply cargo net underneath, drops
// the crate while flying over the target zone, and flies away to the horizon!
// ============================================================================
export function createSupplyTransportHelicopter(): {
  group: THREE.Group;
  mainRotor: THREE.Group;
  tailRotor: THREE.Group;
  slungCargoNet: THREE.Group;
} {
  const group = new THREE.Group();

  const bodyMat = createFastLitMaterial({ color: 0x525b56, roughness: 0.42, metalness: 0.48 });
  const armorBellyMat = createFastLitMaterial({ color: 0x3b433f, roughness: 0.5, metalness: 0.55 });
  const darkMat = createFastLitMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.72 });
  const turbineMat = createFastLitMaterial({ color: 0x0f172a, roughness: 0.22, metalness: 0.85 });
  const glassMat = createFastLitMaterial({ color: 0x1e3a4c, transparent: true, opacity: 0.78, roughness: 0.12, metalness: 0.3 });
  const tanTipMat = new THREE.MeshBasicMaterial({ color: 0xd6b88a });
  const redLightMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const whiteTipMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });

  // 1. Sculpted Heavy Armored Fuselage & Tapered Belly Hull
  const mainHull = new THREE.Mesh(new THREE.BoxGeometry(1.72, 1.25, 4.4), bodyMat);
  mainHull.position.set(0, 0.05, 0);
  group.add(mainHull);

  const bellyKeel = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.28, 4.1), armorBellyMat);
  bellyKeel.position.set(0, -0.62, 0.1);
  group.add(bellyKeel);

  // Side Cabin Windows & Sliding Cargo Door Panels
  [-0.87, 0.87].forEach((sx) => {
    for (let w = 0; w < 3; w++) {
      const sideWin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.32, 0.42), glassMat);
      sideWin.position.set(sx, 0.22, 0.85 - w * 0.68);
      group.add(sideWin);
    }
  });

  // 2. Stepped Armored Cockpit, Multi-Pane Windshields, Wipers & Nose FLIR Radar Turret
  const cockpitUpper = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.96, 1.45), bodyMat);
  cockpitUpper.position.set(0, -0.04, 2.55);
  group.add(cockpitUpper);

  const noseCone = new THREE.Mesh(new THREE.SphereGeometry(0.68, 14, 12), bodyMat);
  noseCone.scale.set(1.05, 0.78, 1.15);
  noseCone.position.set(0, -0.22, 3.35);
  group.add(noseCone);

  // Front FLIR / Electro-Optical Chin Sensor Box & Gimbal Turret
  const flirHousing = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.38, 0.42), armorBellyMat);
  flirHousing.position.set(0, -0.18, 3.95);
  group.add(flirHousing);

  const flirLens = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), turbineMat);
  flirLens.position.set(0, -0.45, 3.65);
  group.add(flirLens);

  // Multi-pane angled cockpit glass windshields + lower chin observation windows
  const windshieldMain = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.56, 0.85), glassMat);
  windshieldMain.position.set(0, 0.3, 2.55);
  windshieldMain.rotation.x = 0.32;
  group.add(windshieldMain);

  const chinWindowL = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.28, 0.45), glassMat);
  chinWindowL.position.set(-0.38, -0.12, 3.22);
  group.add(chinWindowL);
  const chinWindowR = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.28, 0.45), glassMat);
  chinWindowR.position.set(0.38, -0.12, 3.22);
  group.add(chinWindowR);

  // 3. Twin Top Turboshaft Engine Nacelles with Dark Air Intakes (Exact silhouette from image)
  [-0.58, 0.58].forEach((ex) => {
    const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.32, 2.2, 12), bodyMat);
    nacelle.rotateX(Math.PI / 2);
    nacelle.position.set(ex, 0.82, 0.35);
    group.add(nacelle);

    const intake = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.16, 12), turbineMat);
    intake.rotateX(Math.PI / 2);
    intake.position.set(ex, 0.82, 1.44);
    group.add(intake);
  });

  // Central Rotor Pylon Doghouse Fairing
  const doghouse = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.45, 2.1), armorBellyMat);
  doghouse.position.set(0, 0.82, 0.2);
  group.add(doghouse);

  // 4. 6-Blade Heavy Main Rotor Hub, Swashplate & Tan-Tipped Blades
  const mainRotor = new THREE.Group();
  mainRotor.position.set(0, 1.28, 0.35);

  const rotorMast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.42, 10), turbineMat);
  rotorMast.position.y = -0.12;
  mainRotor.add(rotorMast);

  const rotorHub = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.34, 0.18, 12), darkMat);
  mainRotor.add(rotorHub);

  const bladeGeo = new THREE.BoxGeometry(0.22, 0.025, 4.4);
  const tipGeo = new THREE.BoxGeometry(0.23, 0.028, 0.32);
  for (let i = 0; i < 6; i++) {
    const bladePivot = new THREE.Group();
    bladePivot.rotation.y = (i * Math.PI * 2) / 6;

    const blade = new THREE.Mesh(bladeGeo, turbineMat);
    blade.position.set(0, 0, 2.35);
    blade.rotation.z = 0.08;
    bladePivot.add(blade);

    const tip = new THREE.Mesh(tipGeo, tanTipMat);
    tip.position.set(0, 0, 4.42);
    bladePivot.add(tip);

    mainRotor.add(bladePivot);
  }
  group.add(mainRotor);

  // 5. Tail Boom, Tall Vertical Fin, Horizontal Stabilizer & 4-Blade Tail Rotor
  const tailBoom = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.24, 3.6, 10), bodyMat);
  tailBoom.rotateX(Math.PI / 2);
  tailBoom.position.set(0, 0.26, -3.35);
  group.add(tailBoom);

  const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.45, 0.78), bodyMat);
  tailFin.position.set(0, 0.92, -4.85);
  tailFin.rotation.x = -0.26;
  group.add(tailFin);

  const horizStabilizer = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.08, 0.48), armorBellyMat);
  horizStabilizer.position.set(0, 0.35, -4.65);
  group.add(horizStabilizer);

  const tailRotor = new THREE.Group();
  tailRotor.position.set(0.2, 1.38, -4.95);
  const tailBladeGeo = new THREE.BoxGeometry(0.05, 0.14, 0.95);
  for (let i = 0; i < 4; i++) {
    const tBlade = new THREE.Mesh(tailBladeGeo, turbineMat);
    tBlade.position.set(0, 0, 0.46);
    tBlade.rotation.x = (i * Math.PI) / 2;
    tailRotor.add(tBlade);
  }
  group.add(tailRotor);

  // 6. Side Stub Wings (Sponsons) with External Fuel Tanks & Multi-Barrel Rocket Pods (Matches Image!)
  [-1, 1].forEach((side) => {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.14, 0.68), bodyMat);
    wing.position.set(side * 1.38, -0.12, 0.15);
    wing.rotation.z = side * -0.08;
    group.add(wing);

    // Outer Aux Fuel Tank
    const fuelTank = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.45, 10), armorBellyMat);
    fuelTank.rotateX(Math.PI / 2);
    fuelTank.position.set(side * 1.85, -0.32, 0.18);
    group.add(fuelTank);

    // Inner Multi-Tube Rocket Pod with visible white/red rocket warhead tips
    const rocketPod = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 1.15, 12), darkMat);
    rocketPod.rotateX(Math.PI / 2);
    rocketPod.position.set(side * 1.32, -0.32, 0.25);
    group.add(rocketPod);

    for (let r = 0; r < 6; r++) {
      const ang = (r * Math.PI * 2) / 6;
      const tip = new THREE.Mesh(
        new THREE.SphereGeometry(0.048, 6, 6),
        r === 0 ? redLightMat : whiteTipMat
      );
      tip.position.set(
        side * 1.32 + Math.cos(ang) * 0.13,
        -0.32 + Math.sin(ang) * 0.13,
        0.84
      );
      group.add(tip);
    }
  });

  // 7. Tricycle Wheeled Landing Gear with Oleo Struts
  const wheelGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.14, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const strutGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.48, 8);

  const noseStrut = new THREE.Mesh(strutGeo, darkMat);
  noseStrut.position.set(0, -0.72, 2.35);
  group.add(noseStrut);
  const wheelNose = new THREE.Mesh(wheelGeo, turbineMat);
  wheelNose.position.set(0, -0.95, 2.35);
  group.add(wheelNose);

  [-1.08, 1.08].forEach((wx) => {
    const mainStrut = new THREE.Mesh(strutGeo, darkMat);
    mainStrut.position.set(wx, -0.68, -0.2);
    group.add(mainStrut);
    const wheelMain = new THREE.Mesh(wheelGeo, turbineMat);
    wheelMain.position.set(wx, -0.92, -0.2);
    group.add(wheelMain);
  });

  // Belly Red Anti-Collision Beacons
  const beacon1 = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 6), redLightMat);
  beacon1.position.set(-0.35, -0.77, 1.2);
  group.add(beacon1);
  const beacon2 = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 6), redLightMat);
  beacon2.position.set(0.35, -0.77, 1.2);
  group.add(beacon2);

  // 8. Slung Cargo Net Crate hanging beneath the Helicopter Belly while flying in from the horizon!
  const slungCargoNet = new THREE.Group();
  slungCargoNet.position.set(0, -1.65, 0.1);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.85, 6), darkMat);
  cable.position.y = 0.55;
  slungCargoNet.add(cable);
  const previewCrate = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 0.52, 0.68),
    createFastLitMaterial({ color: 0xf59e0b, emissive: 0xb45309, emissiveIntensity: 0.35, roughness: 0.4 })
  );
  slungCargoNet.add(previewCrate);
  group.add(slungCargoNet);

  return { group, mainRotor, tailRotor, slungCargoNet };
}

// ============================================================================
// HELICOPTER SUPPLY DROPPING CARGO NET & BIO-CAPSULE CRATE
// Dropped every 15s by military/medical transport into the active combat basin.
// Features woven cargo webbing straps, reinforced biohazard capsule container,
// status strobe lamps, and a rotating 3D holographic super-ability insignia.
// ============================================================================
export function createSupplyCargoNetMesh(abilityType: string = 'burning_bullets'): {
  group: THREE.Group;
  emblemMesh: THREE.Group;
  strobeLight: THREE.Mesh;
} {
  const group = new THREE.Group();

  // 1. Reinforced Tactical Bio-Capsule Crate
  const crateMat = createFastLitMaterial({
    color: 0x18181b, // tactical matte slate
    emissive: 0x09090b,
    roughness: 0.5,
    metalness: 0.6,
  });
  const edgeTrimMat = createFastLitMaterial({
    color: 0xf59e0b, // high-visibility hazard amber trim
    emissive: 0xb45309,
    emissiveIntensity: 0.45,
    roughness: 0.35,
  });
  const netMat = createFastLitMaterial({
    color: 0x27272a, // heavy-duty nylon tactical webbing
    roughness: 0.7,
  });

  const crateBody = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.72, 0.92), crateMat);
  crateBody.position.y = 0.36;
  group.add(crateBody);

  // Corner protective hazard bumpers
  const bumperGeo = new THREE.BoxGeometry(0.12, 0.76, 0.12);
  [
    [-0.44, 0.36, -0.44],
    [0.44, 0.36, -0.44],
    [-0.44, 0.36, 0.44],
    [0.44, 0.36, 0.44],
  ].forEach(([bx, by, bz]) => {
    const bumper = new THREE.Mesh(bumperGeo, edgeTrimMat);
    bumper.position.set(bx, by, bz);
    group.add(bumper);
  });

  // 2. Intersecting Diamond Woven Cargo Net Strapping
  const strapGeo = new THREE.CylinderGeometry(0.02, 0.02, 1.35, 6);
  for (let s = 0; s < 4; s++) {
    const strapX = new THREE.Mesh(strapGeo, netMat);
    strapX.position.set((s - 1.5) * 0.28, 0.42, 0);
    strapX.rotation.z = 0.25 * (s % 2 === 0 ? 1 : -1);
    group.add(strapX);

    const strapZ = new THREE.Mesh(strapGeo, netMat);
    strapZ.position.set(0, 0.42, (s - 1.5) * 0.28);
    strapZ.rotation.x = 0.25 * (s % 2 === 0 ? 1 : -1);
    group.add(strapZ);
  }

  // Heavy steel cargo carabiner ring at apex
  const ringMat = createFastLitMaterial({
    color: 0x94a3b8,
    metalness: 0.8,
    roughness: 0.2,
  });
  const topRing = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.035, 6, 16), ringMat);
  topRing.position.set(0, 0.85, 0);
  topRing.rotation.x = Math.PI / 2;
  group.add(topRing);

  // Bioluminescent status strobe light
  const strobeLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0x22d3ee })
  );
  strobeLight.position.set(0, 0.74, 0.45);
  group.add(strobeLight);

  // 3. Rotating 3D Holographic Ability Emblem
  const emblemGroup = new THREE.Group();
  emblemGroup.position.set(0, 1.25, 0);

  if (abilityType === 'burning_bullets') {
    // 3D Incendiary Flame & Bullet Spitze
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const flameCone = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.58, 8), flameMat);
    emblemGroup.add(flameCone);
    const innerFlame = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.38, 8), coreMat);
    innerFlame.position.y = -0.05;
    emblemGroup.add(innerFlame);
  } else if (abilityType === 'supersonic_speed') {
    // 3D Supersonic Lightning Chevron
    const boltMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const boltGeo = new THREE.BoxGeometry(0.08, 0.55, 0.12);
    const b1 = new THREE.Mesh(boltGeo, boltMat);
    b1.rotation.z = -0.45;
    b1.position.set(-0.1, 0.1, 0);
    emblemGroup.add(b1);
    const b2 = new THREE.Mesh(boltGeo, boltMat);
    b2.rotation.z = 0.45;
    b2.position.set(0.1, -0.1, 0);
    emblemGroup.add(b2);
  } else if (abilityType === 'immortality') {
    // 3D Golden Aegis Shield + Radiant Halo
    const shieldMat = createFastLitMaterial({
      color: 0xfacc15,
      emissive: 0xeab308,
      emissiveIntensity: 0.7,
      roughness: 0.2,
      metalness: 0.4,
    });
    const sBody = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.04, 0.55, 6), shieldMat);
    sBody.rotation.x = Math.PI;
    emblemGroup.add(sBody);
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.035, 6, 16),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    halo.rotation.x = Math.PI / 2;
    emblemGroup.add(halo);
  } else if (abilityType === 'double_xp') {
    // 3D Golden 2X Star Emblem
    const starMat = createFastLitMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.6,
      roughness: 0.25,
      metalness: 0.5,
    });
    const oct = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 1), starMat);
    emblemGroup.add(oct);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.44, 0.04, 6, 16),
      new THREE.MeshBasicMaterial({ color: 0xfde047 })
    );
    ring.rotation.x = Math.PI / 2;
    emblemGroup.add(ring);
  } else if (abilityType === 'postpone_question') {
    // 3D Biological Chronometer / Hourglass
    const timeMat = new THREE.MeshBasicMaterial({ color: 0x2dd4bf });
    const topCone = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.28, 8), timeMat);
    topCone.rotation.x = Math.PI;
    topCone.position.y = 0.14;
    emblemGroup.add(topCone);
    const btmCone = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.28, 8), timeMat);
    btmCone.position.y = -0.14;
    emblemGroup.add(btmCone);
  } else if (abilityType === 't_cytotoxic') {
    // 3D T-Cytotoxic Laser Disintegrator Crystal
    const laserMat = createFastLitMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 0.85,
      roughness: 0.15,
      metalness: 0.3,
    });
    const crystal = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.16, 0.58, 6), laserMat);
    emblemGroup.add(crystal);
    const focusRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.36, 0.035, 6, 16),
      new THREE.MeshBasicMaterial({ color: 0x34d399 })
    );
    focusRing.rotation.x = Math.PI / 2;
    emblemGroup.add(focusRing);
  } else {
    // 3D Biotoxic RPG Heavy Rocket Warhead
    const warheadMat = createFastLitMaterial({
      color: 0x84cc16,
      emissive: 0x65a30d,
      emissiveIntensity: 0.65,
      roughness: 0.35,
    });
    const noseMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const rocketBody = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.52, 8), warheadMat);
    emblemGroup.add(rocketBody);
    const noseCone = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.24, 8), noseMat);
    noseCone.position.y = 0.38;
    emblemGroup.add(noseCone);
    for (let f = 0; f < 4; f++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.14, 0.02), warheadMat);
      fin.rotation.y = (f * Math.PI) / 2;
      fin.position.y = -0.18;
      emblemGroup.add(fin);
    }
  }

  group.add(emblemGroup);

  return { group, emblemMesh: emblemGroup, strobeLight };
}

// ============================================================================
// 3D PRE-DROP PING BEACON & SONAR INDICATOR
// Appears 3 seconds before supply net drops to guide players to the drop zone!
// Features a towering 18m beacon pillar + expanding concentric ground sonar rings.
// ============================================================================
export function createSupplyPingBeaconMesh(): {
  group: THREE.Group;
  sonarRing: THREE.Mesh;
  pillarMesh: THREE.Mesh;
} {
  const group = new THREE.Group();

  // 18m Vertical Cyan/Gold Warning Light Pillar
  const pillarGeo = new THREE.CylinderGeometry(0.45, 1.6, 18, 16, 1, true);
  const pillarMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const pillarMesh = new THREE.Mesh(pillarGeo, pillarMat);
  pillarMesh.position.y = 9.0;
  group.add(pillarMesh);

  // Concentric Ground Sonar Ring
  const ringGeo = new THREE.RingGeometry(1.6, 2.1, 32);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x22d3ee,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const sonarRing = new THREE.Mesh(ringGeo, ringMat);
  sonarRing.rotation.x = -Math.PI / 2;
  sonarRing.position.y = 0.08;
  group.add(sonarRing);

  // Inner Tactical Crosshair Ring
  const innerRingGeo = new THREE.RingGeometry(0.65, 0.82, 24);
  const innerRing = new THREE.Mesh(innerRingGeo, ringMat);
  innerRing.rotation.x = -Math.PI / 2;
  innerRing.position.y = 0.09;
  group.add(innerRing);

  // Crosshair Hash Ticks
  const hashGeo = new THREE.PlaneGeometry(0.12, 1.4);
  const hash1 = new THREE.Mesh(hashGeo, ringMat);
  hash1.rotation.x = -Math.PI / 2;
  hash1.position.y = 0.1;
  group.add(hash1);
  const hash2 = new THREE.Mesh(hashGeo, ringMat);
  hash2.rotation.x = -Math.PI / 2;
  hash2.rotation.z = Math.PI / 2;
  hash2.position.y = 0.1;
  group.add(hash2);

  return { group, sonarRing, pillarMesh };
}

// Biological Power-Up 3D Mesh
export function createBiologicalPowerUpMesh(type: 'atp' | 'shield'): THREE.Group {
  const group = new THREE.Group();
  if (type === 'atp') {
    const cyanAuraMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.85,
    });
    const coreMat = createFastLitMaterial({
      color: 0x06b6d4,
      emissive: 0x0891b2,
      emissiveIntensity: 0.6,
      roughness: 0.2,
    });
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 1), coreMat);
    group.add(core);

    for (let i = 0; i < 3; i++) {
      const pOrb = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), cyanAuraMat);
      const angle = (i * Math.PI * 2) / 3;
      pOrb.position.set(Math.cos(angle) * 0.42, Math.sin(angle) * 0.15, Math.sin(angle) * 0.42);
      group.add(pOrb);
    }

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.48, 0.035, 6, 20),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.7 })
    );
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
  } else {
    const goldMat = createFastLitMaterial({
      color: 0xfacc15,
      emissive: 0xeab308,
      emissiveIntensity: 0.7,
      roughness: 0.2,
      metalness: 0.3,
    });
    const shieldBody = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.05, 0.55, 6), goldMat);
    shieldBody.rotation.x = Math.PI;
    group.add(shieldBody);

    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.48, 0.04, 6, 20),
      new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.8 })
    );
    halo.rotation.x = Math.PI / 2;
    group.add(halo);
  }
  return group;
}

// ============================================================================
// DESTRUCTIBLE ANATOMICAL COVER CLUSTER FOR MULTIPLAYER OPEN-WORLD DEATHMATCH
// Students can hide & crouch behind these biological structures (Alveolar Coral
// Septum Wall, Hyaline Cartilage Ring Barrier, or Fibrin-Platelet Clot Cluster)
// to block enemy gunfire — and they can be damaged, shattered, and regrown!
// ============================================================================
export function createAnatomicalCoverCluster(variantIndex: number = 0): {
  group: THREE.Group;
  hpBarFill: THREE.Mesh;
  bounds: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };
} {
  const group = new THREE.Group();
  const variant = variantIndex % 3;

  if (variant === 0) {
    // Variant 0: Alveolar Coral Septum & Capillary Barrier Wall
    const septumMat = createFastLitMaterial({
      color: 0xfb7185,
      emissive: 0xbe123c,
      emissiveIntensity: 0.25,
      roughness: 0.4,
    });
    const capRedMat = createFastLitMaterial({
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 0.4,
    });
    const capBlueMat = createFastLitMaterial({
      color: 0x3b82f6,
      emissive: 0x2563eb,
      emissiveIntensity: 0.4,
    });

    // Organic lobed alveolar wall pods
    const podPositions: Array<[number, number, number, number, number, number]> = [
      [-0.95, -0.15, 0, 0.72, 0.95, 0.55],
      [-0.32, -0.05, 0.08, 0.78, 1.12, 0.58],
      [0.35, -0.08, -0.06, 0.76, 1.08, 0.58],
      [0.98, -0.18, 0.04, 0.7, 0.92, 0.54],
      [-0.62, 0.35, 0, 0.58, 0.65, 0.48],
      [0.62, 0.32, 0, 0.58, 0.65, 0.48],
    ];
    const sphereGeo = new THREE.SphereGeometry(1, 12, 10);
    podPositions.forEach(([px, py, pz, sx, sy, sz], idx) => {
      const pod = new THREE.Mesh(sphereGeo, septumMat);
      pod.position.set(px, py, pz);
      pod.scale.set(sx, sy, sz);
      group.add(pod);

      const vein = new THREE.Mesh(
        new THREE.TorusGeometry(0.58, 0.065, 6, 16),
        idx % 2 === 0 ? capRedMat : capBlueMat
      );
      vein.position.set(px, py, pz);
      vein.rotation.set(idx * 0.5, idx * 0.8, 0.3);
      group.add(vein);
    });
  } else if (variant === 1) {
    // Variant 1: Hyaline Bronchial Cartilage Ridge & Surfactant Nodes
    const cartilageMat = createFastLitMaterial({
      color: 0xe0f2fe,
      emissive: 0x0284c7,
      emissiveIntensity: 0.24,
      roughness: 0.32,
    });
    const mucosaMat = createFastLitMaterial({
      color: 0xf472b6,
      emissive: 0x9d174d,
      emissiveIntensity: 0.25,
    });

    // 3 interlocking curved hyaline cartilage plates
    [-0.78, 0, 0.78].forEach((cx, idx) => {
      const arch = new THREE.Mesh(
        new THREE.CylinderGeometry(0.52, 0.64, 1.38, 12),
        cartilageMat
      );
      arch.position.set(cx, -0.05 + (idx === 1 ? 0.12 : 0), (idx % 2 === 0 ? 1 : -1) * 0.06);
      arch.rotation.z = (cx < 0 ? 1 : cx > 0 ? -1 : 0) * 0.12;
      group.add(arch);

      const band = new THREE.Mesh(
        new THREE.TorusGeometry(0.56, 0.08, 7, 16),
        mucosaMat
      );
      band.rotation.x = Math.PI / 2;
      band.position.set(cx, 0.15, 0);
      group.add(band);
    });
  } else {
    // Variant 2: Coagulated Fibrin Meshwork & Activated Platelet Bio-Shield Mound
    const plateletMat = createFastLitMaterial({
      color: 0xfde047,
      emissive: 0xca8a04,
      emissiveIntensity: 0.28,
    });
    const rbcClotMat = createFastLitMaterial({
      color: 0xe11d48,
      emissive: 0x881337,
      emissiveIntensity: 0.3,
    });
    const fibrinStrandMat = createFastLitMaterial({
      color: 0xfef08a,
      emissive: 0xeab308,
      emissiveIntensity: 0.32,
    });

    const clotNodes: Array<[number, number, number, number, boolean]> = [
      [-0.88, -0.18, 0.05, 0.62, false],
      [-0.28, 0.05, -0.05, 0.72, true],
      [0.32, 0.02, 0.06, 0.7, false],
      [0.92, -0.16, -0.04, 0.62, true],
      [0, 0.38, 0, 0.56, true],
    ];
    const nodeGeo = new THREE.DodecahedronGeometry(1, 1);
    clotNodes.forEach(([nx, ny, nz, rad, isPlt]) => {
      const node = new THREE.Mesh(nodeGeo, isPlt ? plateletMat : rbcClotMat);
      node.position.set(nx, ny, nz);
      node.scale.set(rad * 1.15, rad * 0.95, rad * 0.75);
      group.add(node);
    });

    // Cross-linked golden fibrin strands wrapping the cover mound
    for (let s = 0; s < 4; s++) {
      const strand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.055, 2.45, 6),
        fibrinStrandMat
      );
      strand.rotation.z = Math.PI / 2 + (s - 1.5) * 0.16;
      strand.position.set(0, -0.15 + s * 0.18, 0.38);
      group.add(strand);
    }
  }

  // Floating 3D Bio-Cover Integrity Bar above the anatomical structure
  const hpBarGroup = new THREE.Group();
  hpBarGroup.position.set(0, 0.98, 0);

  const hpBg = new THREE.Mesh(
    new THREE.PlaneGeometry(1.48, 0.13),
    new THREE.MeshBasicMaterial({ color: 0x09090b, side: THREE.DoubleSide })
  );
  hpBarGroup.add(hpBg);

  const hpBarFill = new THREE.Mesh(
    new THREE.PlaneGeometry(1.38, 0.085),
    new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide })
  );
  hpBarFill.position.z = 0.01;
  hpBarGroup.add(hpBarFill);
  group.add(hpBarGroup);

  return {
    group,
    hpBarFill,
    bounds: {
      minX: -1.48,
      maxX: 1.48,
      minY: -0.75,
      maxY: 0.95,
      minZ: -0.68,
      maxZ: 0.68,
    },
  };
}



