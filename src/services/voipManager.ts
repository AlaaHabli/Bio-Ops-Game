import { sounds } from './soundEffects';

export type OrganVoipType =
  | 'heart'
  | 'bone_marrow'
  | 'bronchial'
  | 'gastric'
  | 'neural'
  | 'lymph'
  | 'platelet';

export type VoipContextTag =
  | 'any'
  | 'capillary'
  | 'alveoli'
  | 'stomach'
  | 'intestine'
  | 'brain'
  | 'tank_active'
  | 'boss_active'
  | 'airdrop_active'
  | 'barricade_damaged'
  | 'low_hp';

export interface OrganVoipClip {
  id: string;
  organType: OrganVoipType;
  callsign: string;
  organ: string;
  frequency: string;
  message: string;
  urgency: 'CRITICAL' | 'HIGH' | 'REINFORCE';
  contexts: VoipContextTag[];
}

export interface CombatVoipContext {
  themeId: string;
  hasTank: boolean;
  hasBoss: boolean;
  isAirdropActive: boolean;
  hasDamagedBarricade: boolean;
  playerHp: number;
  wave: 1 | 2 | 3;
}

const ORGAN_VOIP_CLIPS: OrganVoipClip[] = [
  // Core Signature Clips (User-Specified + Universal High-Immersion Clips)
  {
    id: 'heart_bronchial_push',
    organType: 'heart',
    callsign: 'HEART COMMAND // CARDIAC OPS',
    organ: 'HEART COMMAND',
    frequency: '142.80 MHz',
    message: 'Heart Command: Hostile presence in the bronchial sector, push back!',
    urgency: 'CRITICAL',
    contexts: ['any', 'alveoli', 'capillary'],
  },
  {
    id: 'bone_marrow_reinforce',
    organType: 'bone_marrow',
    callsign: 'BONE MARROW // STEM-CELL HQ',
    organ: 'BONE MARROW',
    frequency: '118.45 MHz',
    message: 'Bone Marrow: Reinforcements are on the way, hold the line!',
    urgency: 'REINFORCE',
    contexts: ['any', 'airdrop_active', 'low_hp'],
  },

  // Heart Command & Arterial Network Clips
  {
    id: 'heart_fountain_pressure',
    organType: 'heart',
    callsign: 'HEART COMMAND // LEFT VENTRICLE',
    organ: 'HEART COMMAND',
    frequency: '142.80 MHz',
    message: 'Heart Command: Systolic pressure dropping near Fibrinogen Fountain—keep the vessel clear!',
    urgency: 'HIGH',
    contexts: ['capillary', 'any'],
  },
  {
    id: 'heart_aortic_barricade',
    organType: 'heart',
    callsign: 'HEART COMMAND // AORTIC ARCH',
    organ: 'HEART COMMAND',
    frequency: '142.80 MHz',
    message: 'Heart Command: Enemy Spitzer rounds racing down the artery—use your sandbag bunkers!',
    urgency: 'CRITICAL',
    contexts: ['capillary', 'barricade_damaged'],
  },

  // Bone Marrow & Leukocyte Mobilization Clips
  {
    id: 'bone_marrow_myeloid_drop',
    organType: 'bone_marrow',
    callsign: 'BONE MARROW // MYELOID CORPS',
    organ: 'BONE MARROW',
    frequency: '118.45 MHz',
    message: 'Bone Marrow: Fresh Leukocyte & Macrophage paratroopers deployed to your flank, keep firing!',
    urgency: 'REINFORCE',
    contexts: ['airdrop_active', 'any'],
  },
  {
    id: 'bone_marrow_reserves',
    organType: 'bone_marrow',
    callsign: 'BONE MARROW // HEMATOPOIESIS HQ',
    organ: 'BONE MARROW',
    frequency: '118.45 MHz',
    message: 'Bone Marrow: Stem-cell reserves mobilized! Do not let them breach the last bunker!',
    urgency: 'HIGH',
    contexts: ['low_hp', 'barricade_damaged', 'any'],
  },

  // Bronchial & Alveoli Command Clips
  {
    id: 'bronchial_cilia_line',
    organType: 'bronchial',
    callsign: 'BRONCHIAL HQ // TRACHEA SECTOR 4',
    organ: 'BRONCHIAL COMMAND',
    frequency: '134.20 MHz',
    message: 'Bronchial Command: Pathogens advancing past the beating cilia—defend the mucosal wall!',
    urgency: 'CRITICAL',
    contexts: ['alveoli'],
  },
  {
    id: 'bronchial_goblet_evac',
    organType: 'bronchial',
    callsign: 'ALVEOLAR HQ // GAS EXCHANGE',
    organ: 'ALVEOLI COMMAND',
    frequency: '134.20 MHz',
    message: 'Alveoli HQ: Mucus Goblet cells panicking in the airway—suppress those bacterial riflemen!',
    urgency: 'HIGH',
    contexts: ['alveoli'],
  },

  // Gastric & Intestinal Command Clips
  {
    id: 'gastric_pyloric_acid',
    organType: 'gastric',
    callsign: 'GASTRIC HQ // PYLORIC SPHINCTER',
    organ: 'GASTRIC COMMAND',
    frequency: '126.90 MHz',
    message: 'Gastric Command: Acid barrier compromised at the Pyloric Sphincter—repel the invaders!',
    urgency: 'CRITICAL',
    contexts: ['stomach'],
  },
  {
    id: 'enteric_microvilli_defense',
    organType: 'gastric',
    callsign: 'ENTERIC HQ // DUODENUM RELAY',
    organ: 'INTESTINAL COMMAND',
    frequency: '127.40 MHz',
    message: 'Intestinal Command: Hostile squad scoping in near the microvilli boardwalk—push them back!',
    urgency: 'HIGH',
    contexts: ['intestine'],
  },

  // Neural & Blood-Brain Barrier Command Clips
  {
    id: 'neural_bbb_breach',
    organType: 'neural',
    callsign: 'NEURAL COMMAND // MEDULLA RELAY',
    organ: 'BRAIN COMMAND',
    frequency: '156.10 MHz',
    message: 'Neural Command: Hostile snipers scoping the central canal—protect the spinal neurones!',
    urgency: 'CRITICAL',
    contexts: ['brain'],
  },
  {
    id: 'neural_synapse_guard',
    organType: 'neural',
    callsign: 'NEURAL COMMAND // CORTEX NET',
    organ: 'SPINAL COMMAND',
    frequency: '156.10 MHz',
    message: 'Spinal Command: Nodes of Ranvier under fire! Hold the blood-brain barrier at all costs!',
    urgency: 'HIGH',
    contexts: ['brain'],
  },

  // Context-Specific Threat Clips (Tank, Boss, Barricade Breach, Platelets)
  {
    id: 'lymph_tank_alert',
    organType: 'lymph',
    callsign: 'LYMPH NODE HQ // ARMOR WATCH',
    organ: 'LYMPH COMMAND',
    frequency: '149.55 MHz',
    message: 'Lymph Command: Heavy M1A2 Bio-Tank locking 120mm cannon on your bunker—focus fire on its hull!',
    urgency: 'CRITICAL',
    contexts: ['tank_active'],
  },
  {
    id: 'lymph_boss_rockets',
    organType: 'lymph',
    callsign: 'THYMUS HQ // AIR DEFENSE',
    organ: 'THYMUS COMMAND',
    frequency: '151.00 MHz',
    message: 'Thymus Command: Hostile Boss launching guided rockets—take cover behind intact sandbags!',
    urgency: 'CRITICAL',
    contexts: ['boss_active'],
  },
  {
    id: 'platelet_tower_cover',
    organType: 'platelet',
    callsign: 'COAGULATION HQ // THROMBOGLOBIN TOWER',
    organ: 'PLATELET CORPS',
    frequency: '121.50 MHz',
    message: 'Platelet Corps: Sandbag barricade taking heavy fire—cover our Platelets while we clot the breach!',
    urgency: 'HIGH',
    contexts: ['barricade_damaged', 'any'],
  },
];

class VOIPManager {
  private recentClipIds: string[] = [];
  private lastDispatchTime: number = 0;

  // Selects and plays a context-specific Organ VOIP radio chatter clip based on live combat state
  public dispatchContextualVoip(ctx: CombatVoipContext, force: boolean = false): OrganVoipClip | null {
    const now = performance.now();
    if (!force && now - this.lastDispatchTime < 5200) {
      return null;
    }

    // Build active context tags from live battlefield telemetry
    const activeTags = new Set<VoipContextTag>(['any']);
    if (
      ctx.themeId === 'capillary' ||
      ctx.themeId === 'alveoli' ||
      ctx.themeId === 'stomach' ||
      ctx.themeId === 'intestine' ||
      ctx.themeId === 'brain'
    ) {
      activeTags.add(ctx.themeId);
    }
    if (ctx.hasTank) activeTags.add('tank_active');
    if (ctx.hasBoss) activeTags.add('boss_active');
    if (ctx.isAirdropActive) activeTags.add('airdrop_active');
    if (ctx.hasDamagedBarricade) activeTags.add('barricade_damaged');
    if (ctx.playerHp < 50) activeTags.add('low_hp');

    // Score each candidate clip by how specifically it matches the current combat state
    const candidates = ORGAN_VOIP_CLIPS.filter((clip) =>
      clip.contexts.some((tag) => activeTags.has(tag))
    );

    const unplayedCandidates = candidates.filter(
      (clip) => !this.recentClipIds.includes(clip.id)
    );
    const pool = unplayedCandidates.length > 0 ? unplayedCandidates : candidates;

    // Weight clips that match specific combat events (tank, boss, organ theme, damaged barricade) higher than generic 'any'
    const weightedPool: OrganVoipClip[] = [];
    pool.forEach((clip) => {
      let weight = 1;
      if (ctx.hasTank && clip.contexts.includes('tank_active')) weight += 3;
      if (ctx.hasBoss && clip.contexts.includes('boss_active')) weight += 3;
      if (ctx.isAirdropActive && clip.contexts.includes('airdrop_active')) weight += 3;
      if (ctx.hasDamagedBarricade && clip.contexts.includes('barricade_damaged')) weight += 2;
      if (clip.contexts.includes(ctx.themeId as VoipContextTag)) weight += 2;
      if (clip.id === 'heart_bronchial_push' || clip.id === 'bone_marrow_reinforce') weight += 2;

      for (let i = 0; i < weight; i++) {
        weightedPool.push(clip);
      }
    });

    const chosen =
      weightedPool[Math.floor(Math.random() * weightedPool.length)] || ORGAN_VOIP_CLIPS[0];

    this.recordAndPlay(chosen, now);
    return chosen;
  }

  // Trigger an immediate event-driven Organ VOIP transmission (e.g. Airdrop called, Boss spawned, Barricade shattered)
  public triggerEventVoip(
    event: 'airdrop_inbound' | 'boss_detected' | 'tank_advancing' | 'barricade_breached',
    _themeId: string = 'capillary'
  ): OrganVoipClip | null {
    const now = performance.now();
    if (now - this.lastDispatchTime < 2800) {
      return null;
    }

    let targetId = 'bone_marrow_reinforce';
    if (event === 'airdrop_inbound') {
      targetId = Math.random() < 0.65 ? 'bone_marrow_reinforce' : 'bone_marrow_myeloid_drop';
    } else if (event === 'boss_detected') {
      targetId = 'lymph_boss_rockets';
    } else if (event === 'tank_advancing') {
      targetId = 'lymph_tank_alert';
    } else if (event === 'barricade_breached') {
      targetId = 'platelet_tower_cover';
    }

    const chosen =
      ORGAN_VOIP_CLIPS.find((c) => c.id === targetId) || ORGAN_VOIP_CLIPS[0];
    this.recordAndPlay(chosen, now);
    return chosen;
  }

  private recordAndPlay(clip: OrganVoipClip, now: number): void {
    this.lastDispatchTime = now;
    this.recentClipIds.push(clip.id);
    if (this.recentClipIds.length > 5) {
      this.recentClipIds.shift();
    }
    sounds.playOrganVoipClip(clip.organType, clip.message);
  }
}

export const voipManager = new VOIPManager();
