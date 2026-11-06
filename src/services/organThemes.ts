import * as THREE from 'three';

export interface OrganTheme {
  id: 'capillary' | 'alveoli' | 'stomach' | 'intestine' | 'brain';
  name: string;
  location: string;
  fogColor: number;
  fogDensity: number;
  ambientColor: number;
  keyLightColor: number;
  wallTextureGenerator: () => THREE.CanvasTexture;
  particleColor: number;
  particleSize: number;
  organPropsName: string;
  heroicDefenderLabel: string;
  panickingCellLabel: string;
  environmentFeatureLabel: string;
}

const _wallTexCache = new Map<string, THREE.CanvasTexture>();

// Procedural texture for Brain & Spinal Cord Synapse
function createBrainTexture(): THREE.CanvasTexture {
  const cached = _wallTexCache.get('brain');
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Deep dark cerebral navy
  ctx.fillStyle = '#060d1a';
  ctx.fillRect(0, 0, 512, 512);

  // Synaptic neural filaments
  for (let i = 0; i < 40; i++) {
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(56, 189, 248, 0.4)' : 'rgba(168, 85, 247, 0.35)';
    ctx.lineWidth = Math.random() * 4 + 2;
    ctx.beginPath();
    let x = Math.random() * 512;
    let y = 0;
    ctx.moveTo(x, y);
    while (y < 512) {
      x += (Math.random() - 0.5) * 60;
      y += Math.random() * 80 + 30;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Glowing synaptic dendrite nodes
  for (let j = 0; j < 30; j++) {
    const rx = Math.random() * 512;
    const ry = Math.random() * 512;
    const grad = ctx.createRadialGradient(rx, ry, 2, rx, ry, 20);
    grad.addColorStop(0, '#38bdf8');
    grad.addColorStop(0.5, 'rgba(147, 51, 234, 0.4)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(rx, ry, 20, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 6);
  texture.colorSpace = THREE.SRGBColorSpace;
  _wallTexCache.set('brain', texture);
  return texture;
}

// Procedural texture for Smooth Muscle & Stomach Acid Chamber
function createStomachTexture(): THREE.CanvasTexture {
  const cached = _wallTexCache.get('stomach');
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Smooth muscle pink/crimson base with gastric rugae
  ctx.fillStyle = '#2b1216';
  ctx.fillRect(0, 0, 512, 512);

  // Peristalsis smooth muscle striations
  for (let i = 0; i < 35; i++) {
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(225, 29, 72, 0.45)' : 'rgba(132, 204, 22, 0.35)';
    ctx.lineWidth = Math.random() * 14 + 6;
    ctx.beginPath();
    const y = Math.random() * 512;
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(150, y + 40, 350, y - 40, 512, y);
    ctx.stroke();
  }

  // Acid bubbling vesicles
  for (let j = 0; j < 50; j++) {
    ctx.fillStyle = 'rgba(163, 230, 53, 0.35)';
    ctx.beginPath();
    ctx.arc(Math.random() * 512, Math.random() * 512, Math.random() * 12 + 4, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 6);
  texture.colorSpace = THREE.SRGBColorSpace;
  _wallTexCache.set('stomach', texture);
  return texture;
}

// Procedural texture for Intestinal Microvilli & Smooth Muscle
function createIntestinesTexture(): THREE.CanvasTexture {
  const cached = _wallTexCache.get('intestine');
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Warm smooth muscle & golden-green bile tissue
  ctx.fillStyle = '#291809';
  ctx.fillRect(0, 0, 512, 512);

  // Circular smooth muscle bands
  for (let m = 0; m < 16; m++) {
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.28)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(0, m * 32);
    ctx.lineTo(512, m * 32);
    ctx.stroke();
  }

  // Microvilli carpet patterns
  for (let i = 0; i < 80; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(217, 119, 6, 0.4)' : 'rgba(132, 204, 22, 0.3)';
    ctx.beginPath();
    ctx.ellipse(
      Math.random() * 512,
      Math.random() * 512,
      Math.random() * 8 + 4,
      Math.random() * 25 + 10,
      Math.random() * 0.4 - 0.2,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 8);
  texture.colorSpace = THREE.SRGBColorSpace;
  _wallTexCache.set('intestine', texture);
  return texture;
}

// Procedural texture for Trachea Cilia & Mucus-Lined Respiratory Canal
function createAlveoliTexture(): THREE.CanvasTexture {
  const cached = _wallTexCache.get('alveoli');
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Rich wet rose-coral respiratory mucosa base
  const bgGrad = ctx.createLinearGradient(0, 0, 512, 512);
  bgGrad.addColorStop(0, '#3b101c');
  bgGrad.addColorStop(0.5, '#4c1624');
  bgGrad.addColorStop(1, '#330d17');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 512, 512);

  // Horizontal Tracheal Hyaline Cartilage C-Ring ridges
  for (let r = 0; r < 12; r++) {
    const y = r * 42 + 18;
    const ringGrad = ctx.createLinearGradient(0, y - 12, 0, y + 12);
    ringGrad.addColorStop(0, 'rgba(244, 114, 182, 0.05)');
    ringGrad.addColorStop(0.5, 'rgba(251, 146, 160, 0.32)');
    ringGrad.addColorStop(1, 'rgba(136, 19, 55, 0.35)');
    ctx.fillStyle = ringGrad;
    ctx.fillRect(0, y - 12, 512, 24);
  }

  // Longitudinal mucosal folds & glistening viscous mucus streams along the canal wall
  for (let i = 0; i < 28; i++) {
    ctx.strokeStyle =
      i % 2 === 0 ? 'rgba(163, 230, 53, 0.28)' : 'rgba(253, 224, 71, 0.22)';
    ctx.lineWidth = Math.random() * 16 + 8;
    ctx.beginPath();
    let x = (i / 28) * 512;
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(
      x + (Math.random() - 0.5) * 50,
      170,
      x + (Math.random() - 0.5) * 50,
      340,
      x,
      512
    );
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 6);
  texture.colorSpace = THREE.SRGBColorSpace;
  _wallTexCache.set('alveoli', texture);
  return texture;
}

// Procedural texture for Bloodstream Capillary
function createBloodstreamTexture(): THREE.CanvasTexture {
  const cached = _wallTexCache.get('capillary');
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#3a0808';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 40; i++) {
    ctx.strokeStyle = i % 2 === 0 ? '#881337' : '#200505';
    ctx.lineWidth = Math.random() * 10 + 4;
    ctx.beginPath();
    const y = Math.random() * 512;
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(170, y + 30, 340, y - 30, 512, y);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 6);
  texture.colorSpace = THREE.SRGBColorSpace;
  _wallTexCache.set('capillary', texture);
  return texture;
}

export const ORGAN_THEMES: OrganTheme[] = [
  {
    id: 'capillary',
    name: 'BLOODSTREAM & ARTERIAL VESSEL',
    location: 'Vascular Microcirculation',
    fogColor: 0x1a0505,
    fogDensity: 0.025,
    ambientColor: 0xef4444,
    keyLightColor: 0xffedd5,
    wallTextureGenerator: createBloodstreamTexture,
    particleColor: 0xfca5a5,
    particleSize: 0.25,
    organPropsName: 'Plasma & Endothelium',
    heroicDefenderLabel: 'Heroic Antibodies',
    panickingCellLabel: 'Red Blood Cells & Platelets',
    environmentFeatureLabel: 'Arterial Plasma Stream',
  },
  {
    id: 'alveoli',
    name: 'TRACHEA TO ALVEOLI AIRWAY',
    location: 'Ciliated Trachea & Alveolar Sacs',
    fogColor: 0x1f0a12,
    fogDensity: 0.023,
    ambientColor: 0xfb7185,
    keyLightColor: 0xffedd5,
    wallTextureGenerator: createAlveoliTexture,
    particleColor: 0x6ee7b7,
    particleSize: 0.3,
    organPropsName: 'Beating Cilia & Mucus',
    heroicDefenderLabel: 'Heroic Macrophages',
    panickingCellLabel: 'Mucus Goblet Cells',
    environmentFeatureLabel: 'Beating Cilia & Moving Mucus',
  },
  {
    id: 'stomach',
    name: 'ESOPHAGUS TO STOMACH ACID',
    location: 'Smooth Muscle & Gastric HCl Pool',
    fogColor: 0x0f1f0a,
    fogDensity: 0.026,
    ambientColor: 0x84cc16,
    keyLightColor: 0xfacc15,
    wallTextureGenerator: createStomachTexture,
    particleColor: 0xa3e635,
    particleSize: 0.35,
    organPropsName: 'Smooth Muscle & Gastric Acid',
    heroicDefenderLabel: 'Heroic Lysozyme Defenders',
    panickingCellLabel: 'Gastric Parietal Cells',
    environmentFeatureLabel: 'Smooth Muscle & Floor Acid',
  },
  {
    id: 'intestine',
    name: 'SMALL INTESTINE MICROVILLI & BILE',
    location: 'Duodenum Villi & Bile Stream',
    fogColor: 0x1c1006,
    fogDensity: 0.024,
    ambientColor: 0xf59e0b,
    keyLightColor: 0xfef08a,
    wallTextureGenerator: createIntestinesTexture,
    particleColor: 0xfbbf24,
    particleSize: 0.25,
    organPropsName: 'Microvilli & Bile',
    heroicDefenderLabel: 'Heroic M-Cell Phagocytes',
    panickingCellLabel: 'Intestinal Villi Cells',
    environmentFeatureLabel: 'Smooth Muscle, Microvilli & Bile',
  },
  {
    id: 'brain',
    name: 'BRAIN & SPINAL CORD TRACT',
    location: 'Central Nervous System & Neurones',
    fogColor: 0x070c18,
    fogDensity: 0.025,
    ambientColor: 0x38bdf8,
    keyLightColor: 0xc084fc,
    wallTextureGenerator: createBrainTexture,
    particleColor: 0x38bdf8,
    particleSize: 0.28,
    organPropsName: 'Neurones & Synapses',
    heroicDefenderLabel: 'Heroic Dendritic Cells',
    panickingCellLabel: 'Spinal Neurone Cells',
    environmentFeatureLabel: 'Myelinated Axons & Synapses',
  },
];

export function getOrganThemeById(id: OrganTheme['id']): OrganTheme {
  return ORGAN_THEMES.find((t) => t.id === id) || ORGAN_THEMES[0];
}

export function getOrganThemeForLevel(levelId: string, phaseNumber: number): OrganTheme {
  if (levelId === 'level_breathing') {
    return getOrganThemeById('alveoli'); // Trachea Cilia + Mucus + Macrophages + Goblet Cells
  }
  if (levelId === 'level_digestion') {
    // Phases 1 & 2: Smooth muscle & Stomach Acid on ground; Phase 3: Intestine Microvilli & Bile!
    return phaseNumber <= 2 ? getOrganThemeById('stomach') : getOrganThemeById('intestine');
  }
  if (levelId === 'level_pathogens' || levelId === 'level_respiration') {
    return getOrganThemeById('capillary'); // Bloodstream RBCs + Platelets + Heroic Antibodies
  }
  if (levelId === 'level_cells') {
    // Distributes Bloodstream -> Trachea/Alveoli -> Brain & Spinal Cord across the 3 phases
    return phaseNumber === 1
      ? getOrganThemeById('capillary')
      : phaseNumber === 2
      ? getOrganThemeById('alveoli')
      : getOrganThemeById('brain');
  }
  if (levelId === 'level_diffusion') {
    return phaseNumber === 1
      ? getOrganThemeById('alveoli')
      : phaseNumber === 2
      ? getOrganThemeById('intestine')
      : getOrganThemeById('capillary');
  }
  if (levelId === 'level_ecosystems') {
    return phaseNumber === 1
      ? getOrganThemeById('stomach')
      : phaseNumber === 2
      ? getOrganThemeById('intestine')
      : getOrganThemeById('brain');
  }
  if (levelId === 'level_photosynthesis') {
    return phaseNumber === 1
      ? getOrganThemeById('brain')
      : phaseNumber === 2
      ? getOrganThemeById('alveoli')
      : getOrganThemeById('intestine');
  }
  return ORGAN_THEMES[(phaseNumber - 1) % ORGAN_THEMES.length];
}

export function getRandomOrganTheme(): OrganTheme {
  const idx = Math.floor(Math.random() * ORGAN_THEMES.length);
  return ORGAN_THEMES[idx];
}

