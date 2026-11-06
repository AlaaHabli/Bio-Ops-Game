/**
 * Pro-tier Web Audio API sound engine for Bio-Ops Cellular Warfare
 * Heavy bass transients, distortion waveshaping, metallic reload mechanics,
 * authentic Call of Duty hitmarkers, rewarding kill confirmations,
 * realistic C-130 airdrop turboprop flyover, allied & enemy shooting audio,
 * and tactical military radio callouts.
 */

class SoundEffectsService {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;
  private distortionNode: WaveShaperNode | null = null;
  private masterGain: GainNode | null = null;
  private lastVoiceTime: number = 0;
  private lastWhizTime: number = 0;
  private whiteNoiseBuffer: AudioBuffer | null = null;
  private isUnlocked: boolean = false;
  private voicesLoaded: boolean = false;
  private preferredVoices: SpeechSynthesisVoice[] = [];
  private isSpeakingPriorityVoip: boolean = false;
  private speechResumeTimer: number | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initSpeechVoices();

      // Auto-unlock and auto-resume audio + speech synthesis on every touch, pointerdown, click, or keydown
      const unlock = () => {
        this.unlockAudio();
      };
      window.addEventListener('pointerdown', unlock, { passive: true, capture: true });
      window.addEventListener('touchstart', unlock, { passive: true, capture: true });
      window.addEventListener('touchend', unlock, { passive: true, capture: true });
      window.addEventListener('keydown', unlock, { passive: true, capture: true });
      window.addEventListener('click', unlock, { passive: true, capture: true });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.unlockAudio();
        }
      });
    }
  }

  private initSpeechVoices(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      const loadVoices = () => {
        const all = window.speechSynthesis.getVoices();
        if (all && all.length > 0) {
          this.preferredVoices = all.filter((v) => v.lang && v.lang.toLowerCase().startsWith('en'));
          if (this.preferredVoices.length === 0) {
            this.preferredVoices = all;
          }
        }
        this.voicesLoaded = true;
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    } catch {
      this.voicesLoaded = true;
    }
  }

  // Force-unlock and recover audio hardware + SpeechSynthesis on iOS Safari, Android Chrome, and Desktop
  public unlockAudio(): void {
    if (typeof window === 'undefined') return;
    if (this.isUnlocked && this.ctx && (this.ctx.state as string) === 'running') {
      return;
    }
    this.initContext();
    if (!this.voicesLoaded) {
      this.initSpeechVoices();
    }

    // Ensure SpeechSynthesis is not paused by browser tab policies
    try {
      if ('speechSynthesis' in window && window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch {
      // ignore
    }

    if (!this.ctx) return;

    const state = this.ctx.state as string;
    if (state !== 'running') {
      this.ctx
        .resume()
        .then(() => {
          this.playSilentTick();
          this.isUnlocked = true;
        })
        .catch(() => {});
    } else if (!this.isUnlocked) {
      this.playSilentTick();
      this.isUnlocked = true;
    }
  }

  public isAudioSuspended(): boolean {
    if (!this.ctx) return true;
    const state = this.ctx.state as string;
    return state !== 'running';
  }

  private playSilentTick(): void {
    if (!this.ctx) return;
    try {
      const sampleRate = this.ctx.sampleRate || 44100;
      const buffer = this.ctx.createBuffer(1, Math.floor(sampleRate * 0.04), sampleRate);
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.ctx.destination);
      source.start(0);
    } catch {
      // ignore
    }
  }

  private initContext(): void {
    if (typeof window === 'undefined') return;

    if (this.ctx && (this.ctx.state as string) === 'closed') {
      this.ctx = null;
      this.masterGain = null;
      this.distortionNode = null;
      this.whiteNoiseBuffer = null;
    }

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      // Master hardware limiter compressor so overlapping explosions, gunshots, VOIP & bullet races never clip or mute
      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.value = -6;
      compressor.knee.value = 12;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.15;
      compressor.connect(this.ctx.destination);

      // Master gain node
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.95;
      this.masterGain.connect(compressor);

      // Waveshaper curve for punchy weapon saturation
      this.distortionNode = this.ctx.createWaveShaper();
      (this.distortionNode as unknown as { curve: unknown }).curve = this.makeDistortionCurve(16);
      this.distortionNode.oversample = '2x';
      this.distortionNode.connect(this.masterGain);

      // Auto-recover immediately if iOS/WebKit ever transitions AudioContext into 'interrupted' or 'suspended'
      this.ctx.onstatechange = () => {
        if (this.ctx && (this.ctx.state as string) !== 'running' && this.enabled) {
          this.ctx.resume().catch(() => {});
        }
      };
    }

    if (this.ctx && (this.ctx.state as string) !== 'running') {
      this.ctx.resume().catch(() => {});
    }
  }

  private makeDistortionCurve(amount: number): Float32Array {
    const k = typeof amount === 'number' ? amount : 16;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  // Pre-cached white noise source for zero-latency, zero-allocation playback
  private getWhiteNoiseBuffer(): AudioBuffer | null {
    if (!this.ctx) return null;
    if (!this.whiteNoiseBuffer) {
      const sampleRate = this.ctx.sampleRate || 44100;
      const length = Math.floor(sampleRate * 2.5); // 2.5s loopable noise
      this.whiteNoiseBuffer = this.ctx.createBuffer(1, length, sampleRate);
      const data = this.whiteNoiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    }
    return this.whiteNoiseBuffer;
  }

  public setEnabled(val: boolean): void {
    this.enabled = val;
    if (val) {
      this.unlockAudio();
    }
  }

  // Play a filtered burst of noise (gunpowder crack, sand impact, wind roar)
  private playNoiseBurst(duration: number, volume: number, centerFreq: number, q: number = 1.0, type: BiquadFilterType = 'bandpass'): void {
    if (!this.ctx || !this.masterGain) return;
    const buf = this.getWhiteNoiseBuffer();
    if (!buf) return;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = centerFreq;
    filter.Q.value = q;

    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime + 0.003;
    gain.gain.setValueAtTime(Math.max(0.0001, volume), t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.onended = () => {
      try {
        noise.disconnect();
        filter.disconnect();
        gain.disconnect();
      } catch {
        // ignore
      }
    };

    noise.start(t);
    noise.stop(t + duration + 0.02);
  }

  // 1. TACTICAL WEAPON FIRING (SCAR, Pump Shotgun, Sniper, Drum MG, Heavy)
  public playShoot(category: 'ASSAULT' | 'SHOTGUN' | 'SNIPER' | 'MACHINE_GUN' | 'HEAVY'): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime + 0.003;

    if (category === 'ASSAULT') {
      // SCAR-H 5.56 Bio-Rifle: Loud explosive crack + punchy mid body + crisp bolt action
      // Mid-punch body (audible on phones & laptops)
      const body = this.ctx.createOscillator();
      const bodyGain = this.ctx.createGain();
      body.type = 'sawtooth';
      body.frequency.setValueAtTime(320, t);
      body.frequency.exponentialRampToValueAtTime(95, t + 0.09);
      bodyGain.gain.setValueAtTime(0.85, t);
      bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      body.connect(bodyGain);
      bodyGain.connect(this.masterGain);
      body.start(t);
      body.stop(t + 0.09);

      // Sub-bass thump
      const sub = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      sub.type = 'triangle';
      sub.frequency.setValueAtTime(140, t);
      sub.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      subGain.gain.setValueAtTime(0.7, t);
      subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      sub.connect(subGain);
      subGain.connect(this.masterGain);
      sub.start(t);
      sub.stop(t + 0.12);

      // Gunpowder muzzle crack
      this.playNoiseBurst(0.065, 0.95, 2600, 1.2, 'bandpass');

      // Metallic bolt cycle snap
      const bolt = this.ctx.createOscillator();
      const boltGain = this.ctx.createGain();
      bolt.type = 'triangle';
      bolt.frequency.setValueAtTime(1300, t + 0.02);
      bolt.frequency.exponentialRampToValueAtTime(400, t + 0.05);
      boltGain.gain.setValueAtTime(0.4, t + 0.02);
      boltGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      bolt.connect(boltGain);
      boltGain.connect(this.masterGain);
      bolt.start(t + 0.02);
      bolt.stop(t + 0.05);

    } else if (category === 'SHOTGUN') {
      // Tactical Pump Shotgun: Massive 12-gauge close-range blast + satisfying pump rack
      // Blast body
      const body = this.ctx.createOscillator();
      const bodyGain = this.ctx.createGain();
      body.type = 'sawtooth';
      body.frequency.setValueAtTime(220, t);
      body.frequency.exponentialRampToValueAtTime(45, t + 0.22);
      bodyGain.gain.setValueAtTime(1.1, t);
      bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      body.connect(bodyGain);
      bodyGain.connect(this.masterGain);
      body.start(t);
      body.stop(t + 0.22);

      // Low end boom
      const sub = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      sub.type = 'triangle';
      sub.frequency.setValueAtTime(120, t);
      sub.frequency.exponentialRampToValueAtTime(30, t + 0.28);
      subGain.gain.setValueAtTime(1.0, t);
      subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      sub.connect(subGain);
      subGain.connect(this.masterGain);
      sub.start(t);
      sub.stop(t + 0.28);

      // Wideband pellet blast
      this.playNoiseBurst(0.18, 1.2, 1600, 0.8, 'lowpass');

      // Mechanical pump racking action (clack-clink)
      setTimeout(() => {
        if (!this.ctx || !this.masterGain) return;
        const t2 = this.ctx.currentTime + 0.002;
        // Slide back
        this.playNoiseBurst(0.04, 0.5, 2200, 2.0, 'bandpass');
        const slide = this.ctx.createOscillator();
        const slideG = this.ctx.createGain();
        slide.type = 'sine';
        slide.frequency.setValueAtTime(950, t2);
        slide.frequency.setValueAtTime(450, t2 + 0.035);
        slideG.gain.setValueAtTime(0.35, t2);
        slideG.gain.exponentialRampToValueAtTime(0.001, t2 + 0.035);
        slide.connect(slideG);
        slideG.connect(this.masterGain);
        slide.start(t2);
        slide.stop(t2 + 0.035);

        // Slide forward lock
        setTimeout(() => {
          if (!this.ctx || !this.masterGain) return;
          const t3 = this.ctx.currentTime + 0.002;
          const lock = this.ctx.createOscillator();
          const lockG = this.ctx.createGain();
          lock.type = 'triangle';
          lock.frequency.setValueAtTime(650, t3);
          lock.frequency.setValueAtTime(1400, t3 + 0.035);
          lockG.gain.setValueAtTime(0.4, t3);
          lockG.gain.exponentialRampToValueAtTime(0.001, t3 + 0.035);
          lock.connect(lockG);
          lockG.connect(this.masterGain);
          lock.start(t3);
          lock.stop(t3 + 0.035);
        }, 120);
      }, 160);

    } else if (category === 'SNIPER') {
      // Bolt-Action Heavy Sniper: High-velocity supersonic sonic crack + devastating concussive boom
      const body = this.ctx.createOscillator();
      const bodyGain = this.ctx.createGain();
      body.type = 'sawtooth';
      body.frequency.setValueAtTime(420, t);
      body.frequency.exponentialRampToValueAtTime(65, t + 0.32);
      bodyGain.gain.setValueAtTime(1.15, t);
      bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      body.connect(bodyGain);
      bodyGain.connect(this.masterGain);
      body.start(t);
      body.stop(t + 0.32);

      // Deep concussion
      const sub = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      sub.type = 'triangle';
      sub.frequency.setValueAtTime(160, t);
      sub.frequency.exponentialRampToValueAtTime(35, t + 0.45);
      subGain.gain.setValueAtTime(1.1, t);
      subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      sub.connect(subGain);
      subGain.connect(this.masterGain);
      sub.start(t);
      sub.stop(t + 0.45);

      // High-velocity crack + long echoing tail
      this.playNoiseBurst(0.08, 1.3, 4200, 1.8, 'bandpass');
      this.playNoiseBurst(0.35, 0.7, 950, 1.0, 'lowpass');

      // Heavy bolt lift & cycle at 260ms
      setTimeout(() => {
        if (!this.ctx || !this.masterGain) return;
        const t2 = this.ctx.currentTime + 0.002;
        const bolt = this.ctx.createOscillator();
        const boltG = this.ctx.createGain();
        bolt.type = 'triangle';
        bolt.frequency.setValueAtTime(1800, t2);
        bolt.frequency.setValueAtTime(800, t2 + 0.06);
        boltG.gain.setValueAtTime(0.45, t2);
        boltG.gain.exponentialRampToValueAtTime(0.001, t2 + 0.06);
        bolt.connect(boltG);
        boltG.connect(this.masterGain);
        bolt.start(t2);
        bolt.stop(t2 + 0.06);
      }, 260);

    } else if (category === 'MACHINE_GUN') {
      // Drum LMG: Rapid heavy mechanical clatter + punchy cyclic cadence
      const body = this.ctx.createOscillator();
      const bodyGain = this.ctx.createGain();
      body.type = 'sawtooth';
      body.frequency.setValueAtTime(260, t);
      body.frequency.exponentialRampToValueAtTime(80, t + 0.075);
      bodyGain.gain.setValueAtTime(0.9, t);
      bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.075);
      body.connect(bodyGain);
      bodyGain.connect(this.masterGain);
      body.start(t);
      body.stop(t + 0.075);

      this.playNoiseBurst(0.05, 0.85, 3400, 1.5, 'bandpass');

      // Metallic drum link rattle
      const rattle = this.ctx.createOscillator();
      const rattleG = this.ctx.createGain();
      rattle.type = 'triangle';
      rattle.frequency.setValueAtTime(1600, t + 0.015);
      rattle.frequency.setValueAtTime(600, t + 0.045);
      rattleG.gain.setValueAtTime(0.35, t + 0.015);
      rattleG.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
      rattle.connect(rattleG);
      rattleG.connect(this.masterGain);
      rattle.start(t + 0.015);
      rattle.stop(t + 0.045);

    } else {
      // HEAVY Rocket/Detonation
      const body = this.ctx.createOscillator();
      const bodyGain = this.ctx.createGain();
      body.type = 'triangle';
      body.frequency.setValueAtTime(110, t);
      body.frequency.exponentialRampToValueAtTime(22, t + 0.55);
      bodyGain.gain.setValueAtTime(1.4, t);
      bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      body.connect(bodyGain);
      bodyGain.connect(this.masterGain);
      body.start(t);
      body.stop(t + 0.55);

      this.playNoiseBurst(0.45, 1.3, 1100, 0.7, 'lowpass');
    }

    // Supersonic Downrange Bullet Race Zip (high-velocity projectile tearing through the vessel)
    try {
      const zip = this.ctx.createOscillator();
      const zipG = this.ctx.createGain();
      zip.type = 'sine';
      zip.frequency.setValueAtTime(category === 'SNIPER' ? 3400 : 2550, t + 0.015);
      zip.frequency.exponentialRampToValueAtTime(420, t + 0.095);
      zipG.gain.setValueAtTime(0.28, t + 0.015);
      zipG.gain.exponentialRampToValueAtTime(0.001, t + 0.098);
      zip.connect(zipG);
      zipG.connect(this.masterGain);
      zip.start(t + 0.015);
      zip.stop(t + 0.1);
    } catch {
      // ignore
    }
  }

  // 2. KILL CONFIRMATION: Authentic Call of Duty elimination double-chime + tactile thud
  public playKillConfirm(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime + 0.003;

    // Chime 1: Crisp high-register metallic bell (A6 1760Hz)
    const chime1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    chime1.type = 'sine';
    chime1.frequency.setValueAtTime(1760, t);
    gain1.gain.setValueAtTime(0.65, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    chime1.connect(gain1);
    gain1.connect(this.masterGain);
    chime1.start(t);
    chime1.stop(t + 0.16);

    // Chime 2: Harmonious high sparkle (E7 2640Hz) with 15ms offset
    const chime2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    chime2.type = 'sine';
    chime2.frequency.setValueAtTime(2640, t + 0.018);
    gain2.gain.setValueAtTime(0.55, t + 0.018);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    chime2.connect(gain2);
    gain2.connect(this.masterGain);
    chime2.start(t + 0.018);
    chime2.stop(t + 0.2);

    // Tactile elimination impact thud (audible punch on all phone & laptop speakers)
    const thud = this.ctx.createOscillator();
    const thudGain = this.ctx.createGain();
    thud.type = 'triangle';
    thud.frequency.setValueAtTime(320, t);
    thud.frequency.exponentialRampToValueAtTime(75, t + 0.08);
    thudGain.gain.setValueAtTime(0.8, t);
    thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    thud.connect(thudGain);
    thudGain.connect(this.masterGain);
    thud.start(t);
    thud.stop(t + 0.08);

    // Sharp mechanical feedback click
    this.playNoiseBurst(0.02, 0.45, 3600, 3.0, 'bandpass');
  }

  // 3. TACTICAL C-130 AIRDROP FLYOVER ROAR (Instant turboprop roar + Doppler sweep + paratrooper drop)
  public playAirdropPlane(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime + 0.003;

    // Heavy 4-engine turboprop drone harmonics (audible on phones & laptops)
    const freqs = [180, 240, 360, 520];
    freqs.forEach((baseFreq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';

      // Doppler pitch shift: 1.08x as plane approaches -> 0.86x as plane passes
      osc.frequency.setValueAtTime(baseFreq * 1.08, t);
      osc.frequency.linearRampToValueAtTime(baseFreq * 1.0, t + 1.6);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.82, t + 5.0);

      // Instant volume on button press, peaks at 1.6s, then fades
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.linearRampToValueAtTime(0.65, t + 1.5);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 5.0);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 5.0);
    });

    // Propeller blade chopping noise (LFO modulation of wind roar)
    this.playNoiseBurst(4.8, 0.85, 680, 1.1, 'bandpass');

    // Cargo bay parachute deployment whoosh at 1.4s
    setTimeout(() => {
      if (!this.ctx || !this.masterGain) return;
      this.playNoiseBurst(0.45, 0.9, 1400, 0.8, 'lowpass');
      this.playRadioChirp();
    }, 1300);
  }

  // 4. ALLIED WHITE BLOOD CELL PARATROOPERS SUPPRESSIVE BURST (3-round burst from flanks)
  public playAlliedShoot(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    // Fast 3-round burst at 0ms, 55ms, 110ms
    [0, 0.055, 0.11].forEach((offset) => {
      setTimeout(() => {
        if (!this.ctx || !this.masterGain) return;
        const t = this.ctx.currentTime + 0.002;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(360, t);
        osc.frequency.exponentialRampToValueAtTime(110, t + 0.045);
        gain.gain.setValueAtTime(0.55, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.045);

        this.playNoiseBurst(0.035, 0.6, 2800, 1.5, 'bandpass');
      }, offset * 1000);
    });
  }

  // 5. ENEMY BACTERIA TACTICAL SHOOTING (Aggressive bio-toxin plasma darts)
  public playEnemyShoot(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime + 0.002;

    // Venomous corrosive zip/crack (stands out distinct from player gunshots)
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1150, t);
    osc.frequency.exponentialRampToValueAtTime(220, t + 0.11);
    gain.gain.setValueAtTime(0.65, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.11);

    // Acid sizzle
    this.playNoiseBurst(0.08, 0.55, 3400, 2.0, 'bandpass');
  }

  // 6. BACTERIA BATTLE TANK MAIN TURRET CANNON (120mm toxic mortar roar)
  public playTankCannon(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime + 0.003;

    // Low-end concussive mortar punch
    const body = this.ctx.createOscillator();
    const bodyGain = this.ctx.createGain();
    body.type = 'sawtooth';
    body.frequency.setValueAtTime(160, t);
    body.frequency.exponentialRampToValueAtTime(28, t + 0.45);
    bodyGain.gain.setValueAtTime(1.3, t);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    body.connect(bodyGain);
    bodyGain.connect(this.masterGain);
    body.start(t);
    body.stop(t + 0.45);

    // Heavy artillery noise shockwave
    this.playNoiseBurst(0.38, 1.25, 950, 0.8, 'lowpass');

    // Turret hydraulic recoil clank
    setTimeout(() => {
      if (!this.ctx || !this.masterGain) return;
      const t2 = this.ctx.currentTime + 0.002;
      const recoil = this.ctx.createOscillator();
      const recoilG = this.ctx.createGain();
      recoil.type = 'triangle';
      recoil.frequency.setValueAtTime(500, t2);
      recoil.frequency.setValueAtTime(180, t2 + 0.08);
      recoilG.gain.setValueAtTime(0.5, t2);
      recoilG.gain.exponentialRampToValueAtTime(0.001, t2 + 0.08);
      recoil.connect(recoilG);
      recoilG.connect(this.masterGain);
      recoil.start(t2);
      recoil.stop(t2 + 0.08);
    }, 120);
  }

  // 7. BULLET IMPACT ON SANDBAG BARRICADE (Heavy sand thwump + sand scatter + ricochet whistle)
  public playBarricadeHit(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime + 0.002;

    // Heavy sandbag thwump
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.09);
    gain.gain.setValueAtTime(0.75, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.09);

    // Sand scatter hiss
    this.playNoiseBurst(0.08, 0.6, 1600, 1.2, 'bandpass');

    // 40% chance of high-pitched ricochet whine (PWWEEEOOOW)
    if (Math.random() < 0.4) {
      const rico = this.ctx.createOscillator();
      const ricoG = this.ctx.createGain();
      rico.type = 'sine';
      rico.frequency.setValueAtTime(2800, t + 0.02);
      rico.frequency.exponentialRampToValueAtTime(900, t + 0.16);
      ricoG.gain.setValueAtTime(0.35, t + 0.02);
      ricoG.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      rico.connect(ricoG);
      ricoG.connect(this.masterGain);
      rico.start(t + 0.02);
      rico.stop(t + 0.16);
    }
  }

  // 7b. SANDBAG BARRICADE SHATTERING & COLLAPSE (Wood stake snapping + burlap ripping + sand avalanche)
  public playBarricadeShatter(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime + 0.002;

    // Deep structural collapse thud
    const sub = this.ctx.createOscillator();
    const subG = this.ctx.createGain();
    sub.type = 'sawtooth';
    sub.frequency.setValueAtTime(140, t);
    sub.frequency.exponentialRampToValueAtTime(24, t + 0.55);
    subG.gain.setValueAtTime(1.1, t);
    subG.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    sub.connect(subG);
    subG.connect(this.masterGain);
    sub.start(t);
    sub.stop(t + 0.55);

    // 4 rapid wooden stake splinter cracks
    [0.02, 0.09, 0.17, 0.26].forEach((offset, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const crack = this.ctx.createOscillator();
      const crackG = this.ctx.createGain();
      crack.type = 'square';
      crack.frequency.setValueAtTime(920 - idx * 110, t + offset);
      crack.frequency.exponentialRampToValueAtTime(180, t + offset + 0.055);
      crackG.gain.setValueAtTime(0.55, t + offset);
      crackG.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.055);
      crack.connect(crackG);
      crackG.connect(this.masterGain);
      crack.start(t + offset);
      crack.stop(t + offset + 0.06);
    });

    // Burlap tear + pouring sand avalanche noise
    this.playNoiseBurst(0.65, 1.0, 1450, 0.9, 'bandpass');
  }

  // 8. CALL OF DUTY / BLACK OPS HITMARKER
  public playHitmarker(isCritical: boolean = false): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime + 0.002;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (isCritical) {
      // Metallic ringing headshot ping (1850Hz -> 920Hz)
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1850, t);
      osc.frequency.exponentialRampToValueAtTime(920, t + 0.14);
      gain.gain.setValueAtTime(0.65, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.14);
    } else {
      // Snappy Call of Duty double-tic
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1100, t);
      osc.frequency.exponentialRampToValueAtTime(420, t + 0.032);
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.032);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.032);
    }
  }

  // Frag grenade whoosh
  public playGrenadeThrow(): void {
    if (!this.enabled) return;
    this.initContext();
    this.playNoiseBurst(0.14, 0.5, 1800, 1.0, 'bandpass');
  }

  // Massive explosion shockwave
  public playExplosion(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime + 0.003;
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'triangle';
    sub.frequency.setValueAtTime(95, t);
    sub.frequency.exponentialRampToValueAtTime(18, t + 0.7);
    subGain.gain.setValueAtTime(1.5, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    sub.connect(subGain);
    subGain.connect(this.masterGain);
    sub.start(t);
    sub.stop(t + 0.7);

    this.playNoiseBurst(0.55, 1.3, 850, 0.6, 'lowpass');
  }

  // Realistic Multi-Stage Tactical Reload Sound (Mag Release -> Mag Eject -> Fresh Mag Slap -> Bolt Rack!)
  public playReload(durationMs: number = 1400): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime + 0.002;

    // Stage 1 (0ms): Metallic mag-catch button click + empty magazine sliding out
    const catchClick = this.ctx.createOscillator();
    const catchG = this.ctx.createGain();
    catchClick.type = 'triangle';
    catchClick.frequency.setValueAtTime(1650, t);
    catchClick.frequency.exponentialRampToValueAtTime(480, t + 0.045);
    catchG.gain.setValueAtTime(0.55, t);
    catchG.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    catchClick.connect(catchG);
    catchG.connect(this.masterGain);
    catchClick.start(t);
    catchClick.stop(t + 0.055);
    this.playNoiseBurst(0.09, 0.6, 2400, 1.8, 'bandpass');

    // Stage 2 (48% of reload): Heavy fresh magazine insertion thud + positive lock click
    const magInDelay = Math.max(240, Math.round(durationMs * 0.46));
    setTimeout(() => {
      if (!this.ctx || !this.masterGain || !this.enabled) return;
      const t2 = this.ctx.currentTime + 0.002;

      // Polymer/steel mag well thud
      const thud = this.ctx.createOscillator();
      const thudG = this.ctx.createGain();
      thud.type = 'triangle';
      thud.frequency.setValueAtTime(190, t2);
      thud.frequency.exponentialRampToValueAtTime(55, t2 + 0.085);
      thudG.gain.setValueAtTime(0.85, t2);
      thudG.gain.exponentialRampToValueAtTime(0.001, t2 + 0.09);
      thud.connect(thudG);
      thudG.connect(this.masterGain);
      thud.start(t2);
      thud.stop(t2 + 0.09);

      // Crisp locking latch snap
      const lock = this.ctx.createOscillator();
      const lockG = this.ctx.createGain();
      lock.type = 'sine';
      lock.frequency.setValueAtTime(580, t2 + 0.025);
      lock.frequency.setValueAtTime(1380, t2 + 0.06);
      lockG.gain.setValueAtTime(0.55, t2 + 0.025);
      lockG.gain.exponentialRampToValueAtTime(0.001, t2 + 0.095);
      lock.connect(lockG);
      lockG.connect(this.masterGain);
      lock.start(t2 + 0.025);
      lock.stop(t2 + 0.1);
      this.playNoiseBurst(0.05, 0.55, 2900, 2.2, 'bandpass');
    }, magInDelay);

    // Stage 3 (82% of reload): Crisp steel charging-handle pull & bolt carrier slam forward
    const boltDelay = Math.max(460, Math.round(durationMs * 0.8));
    setTimeout(() => {
      if (!this.ctx || !this.masterGain || !this.enabled) return;
      const t3 = this.ctx.currentTime + 0.002;

      // Bolt slide back
      this.playNoiseBurst(0.065, 0.7, 3400, 1.6, 'bandpass');
      const pull = this.ctx.createOscillator();
      const pullG = this.ctx.createGain();
      pull.type = 'sawtooth';
      pull.frequency.setValueAtTime(1100, t3);
      pull.frequency.exponentialRampToValueAtTime(520, t3 + 0.055);
      pullG.gain.setValueAtTime(0.45, t3);
      pullG.gain.exponentialRampToValueAtTime(0.001, t3 + 0.06);
      pull.connect(pullG);
      pullG.connect(this.masterGain);
      pull.start(t3);
      pull.stop(t3 + 0.06);

      // Bolt slam home into battery (90ms later)
      setTimeout(() => {
        if (!this.ctx || !this.masterGain || !this.enabled) return;
        const t4 = this.ctx.currentTime + 0.002;
        const slam = this.ctx.createOscillator();
        const slamG = this.ctx.createGain();
        slam.type = 'triangle';
        slam.frequency.setValueAtTime(720, t4);
        slam.frequency.setValueAtTime(1720, t4 + 0.035);
        slamG.gain.setValueAtTime(0.65, t4);
        slamG.gain.exponentialRampToValueAtTime(0.001, t4 + 0.075);
        slam.connect(slamG);
        slamG.connect(this.masterGain);
        slam.start(t4);
        slam.stop(t4 + 0.08);
        this.playNoiseBurst(0.045, 0.65, 4100, 2.0, 'bandpass');
      }, 90);
    }, boltDelay);
  }

  // Fast Tactical Speed-Reload Lock Chime when player hits Active Reload sweet spot!
  public playActiveReloadLock(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime + 0.002;
    [880, 1320, 1760].forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + i * 0.04);
      g.gain.setValueAtTime(0.48, t + i * 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.04 + 0.12);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t + i * 0.04);
      osc.stop(t + i * 0.04 + 0.13);
    });
    this.playNoiseBurst(0.05, 0.65, 3800, 2.0, 'bandpass');
  }

  // Dry fire click
  public playDryFire(): void {
    if (!this.enabled) return;
    this.initContext();
    this.playNoiseBurst(0.03, 0.4, 2000, 3.0, 'bandpass');
  }

  // Low health heartbeat
  public playHeartbeat(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime + 0.002;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.15);
    gain.gain.setValueAtTime(0.9, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.15);

    setTimeout(() => {
      if (!this.ctx || !this.masterGain) return;
      const t2 = this.ctx.currentTime + 0.002;
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(70, t2);
      osc2.frequency.exponentialRampToValueAtTime(30, t2 + 0.16);
      gain2.gain.setValueAtTime(0.75, t2);
      gain2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.16);
      osc2.connect(gain2);
      gain2.connect(this.masterGain);
      osc2.start(t2);
      osc2.stop(t2 + 0.16);
    }, 180);
  }

  // Cambridge Quiz Correct chime
  public playQuizCorrect(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime + 0.002;
    const freqs = [392.0, 523.25, 659.25, 1046.5];
    freqs.forEach((f, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const start = t + idx * 0.06;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, start);
      gain.gain.setValueAtTime(0.35, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(start);
      osc.stop(start + 0.2);
    });
  }

  // Quiz Wrong buzz
  public playQuizWrong(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime + 0.002;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(105, t);
    osc.frequency.setValueAtTime(80, t + 0.22);
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  // Radio squelch / static
  public playRadioSquelch(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime + 0.002;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(2200, t);
    osc.frequency.setValueAtTime(1500, t + 0.02);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.04);

    this.playNoiseBurst(0.035, 0.2, 3200, 2.0, 'bandpass');
  }

  // Night vision capacitor whine
  public playNightVisionToggle(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime + 0.002;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2000, t);
    osc.frequency.exponentialRampToValueAtTime(4500, t + 0.16);
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  // Brass shell casing bounce
  public playBrassShellDrop(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime + 0.18 + Math.random() * 0.08;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    const baseFreq = 2400 + Math.random() * 500;
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.setValueAtTime(baseFreq * 0.85, t + 0.02);
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  // Radio chirp
  public playRadioChirp(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime + 0.002;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1500, t);
    osc.frequency.setValueAtTime(2200, t + 0.025);
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  // Combat Alarm warhorn
  public playCombatAlarm(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime + 0.003;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.linearRampToValueAtTime(85, t + 0.75);
    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.8);
  }

  // Victory fanfare
  public playVictory(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime + 0.002;
    const notes = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const start = t + idx * 0.09;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.4, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(start);
      osc.stop(start + 0.35);
    });
  }

  // Tactical Stimpack Auto-Injector SFX (Pneumatic hiss + biometric surge, 100% Web Audio)
  public playStimInject(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime + 0.002;
    // 1. High-pressure pneumatic injector hiss
    this.playNoiseBurst(0.16, 0.7, 2400, 1.2, 'bandpass');

    // 2. Mechanical auto-syringe spring click
    const click = this.ctx.createOscillator();
    const clickG = this.ctx.createGain();
    click.type = 'triangle';
    click.frequency.setValueAtTime(1400, t);
    click.frequency.setValueAtTime(450, t + 0.03);
    clickG.gain.setValueAtTime(0.5, t);
    clickG.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    click.connect(clickG);
    clickG.connect(this.masterGain);
    click.start(t);
    click.stop(t + 0.04);

    // 3. Ascending vital pulse tone (cellular regeneration)
    const tone = this.ctx.createOscillator();
    const toneG = this.ctx.createGain();
    tone.type = 'sine';
    tone.frequency.setValueAtTime(520, t + 0.05);
    tone.frequency.exponentialRampToValueAtTime(1080, t + 0.22);
    toneG.gain.setValueAtTime(0.4, t + 0.05);
    toneG.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    tone.connect(toneG);
    toneG.connect(this.masterGain);
    tone.start(t + 0.05);
    tone.stop(t + 0.24);
  }

  // Tactical Killstreak Sting & Fanfare (Double, Triple, Quadra, Penta, Immunoful, Leukocytastic, Bloody Monster!)
  public playKillstreak(streakCount: number): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime + 0.002;
    const baseFreqs = streakCount >= 8
      ? [330, 440, 554, 659, 880, 1108] // Bloody Monster
      : streakCount >= 6
      ? [392, 523, 659, 784, 1046]       // Immunoful / Leukocytastic
      : streakCount === 5
      ? [440, 554, 659, 880]             // Penta Kill
      : streakCount === 4
      ? [440, 554, 659]                  // Quadra Kill
      : streakCount === 3
      ? [523, 659, 784]                  // Triple Kill
      : [523, 784];                      // Double Kill

    baseFreqs.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const start = t + idx * 0.055;
      osc.type = streakCount >= 5 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.35 + Math.min(0.3, streakCount * 0.05), start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(start);
      osc.stop(start + 0.28);
    });

    // Sub-bass impact for high tier streaks
    if (streakCount >= 4) {
      const sub = this.ctx.createOscillator();
      const subG = this.ctx.createGain();
      sub.type = 'triangle';
      sub.frequency.setValueAtTime(140, t);
      sub.frequency.exponentialRampToValueAtTime(45, t + 0.35);
      subG.gain.setValueAtTime(0.8, t);
      subG.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      sub.connect(subG);
      subG.connect(this.masterGain);
      sub.start(t);
      sub.stop(t + 0.35);
    }
  }

  // Bacteria Attack Helicopter Heavy Rotor Thumping
  public playHelicopterRotor(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime + 0.002;
    // Rhythmic double-blade chop
    [0, 0.045].forEach((offset) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(95, t + offset);
      osc.frequency.exponentialRampToValueAtTime(35, t + offset + 0.06);
      gain.gain.setValueAtTime(0.45, t + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.06);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t + offset);
      osc.stop(t + offset + 0.06);
    });
    this.playNoiseBurst(0.07, 0.4, 520, 1.2, 'bandpass');
  }

  // Rogue F-16 Jet Fighter Afterburner Flyby Screamer
  public playJetFlyby(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime + 0.003;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    // Doppler roar: 920Hz screams down to 280Hz
    osc.frequency.setValueAtTime(920, t);
    osc.frequency.exponentialRampToValueAtTime(260, t + 1.2);
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.linearRampToValueAtTime(0.7, t + 0.35);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 1.4);

    this.playNoiseBurst(1.3, 0.85, 1400, 0.7, 'lowpass');
  }

  // Giant Bio-Mech Robot Heavy Hydraulic Footstep
  public playRobotStep(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime + 0.002;
    // Heavy metallic foot crash
    const thud = this.ctx.createOscillator();
    const thudG = this.ctx.createGain();
    thud.type = 'triangle';
    thud.frequency.setValueAtTime(130, t);
    thud.frequency.exponentialRampToValueAtTime(28, t + 0.22);
    thudG.gain.setValueAtTime(0.85, t);
    thudG.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    thud.connect(thudG);
    thudG.connect(this.masterGain);
    thud.start(t);
    thud.stop(t + 0.22);

    // Hydraulic piston air release
    this.playNoiseBurst(0.12, 0.5, 2200, 1.5, 'bandpass');
  }

  // 12. SUPERSONIC BULLET RACE WHIZ & FLYBY SNAP (Plays when enemy Spitzer rounds race past player/barricade!)
  public playBulletRaceWhiz(isHeavy: boolean = false): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const now = performance.now();
    if (now - this.lastWhizTime < 95) return; // Rate-limit overlapping bullet whizzes
    this.lastWhizTime = now;

    try {
      const t = this.ctx.currentTime + 0.002;

      // 1. Supersonic Mach Snap (sharp ballistic shockwave crack)
      const snap = this.ctx.createOscillator();
      const snapG = this.ctx.createGain();
      snap.type = 'triangle';
      snap.frequency.setValueAtTime(isHeavy ? 2200 : 3600, t);
      snap.frequency.exponentialRampToValueAtTime(680, t + 0.028);
      snapG.gain.setValueAtTime(isHeavy ? 0.55 : 0.42, t);
      snapG.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
      snap.connect(snapG);
      snapG.connect(this.masterGain);
      snap.start(t);
      snap.stop(t + 0.032);

      // 2. High-Velocity Doppler Bullet Race Whiz ("ZIIIIIP-FWWEEEW!")
      const whiz = this.ctx.createOscillator();
      const whizG = this.ctx.createGain();
      whiz.type = 'sine';
      const startFreq = (isHeavy ? 1850 : 2850) + (Math.random() - 0.5) * 420;
      const endFreq = (isHeavy ? 260 : 440) + (Math.random() - 0.5) * 90;
      const dur = isHeavy ? 0.16 : 0.11;
      whiz.frequency.setValueAtTime(startFreq, t + 0.008);
      whiz.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
      whizG.gain.setValueAtTime(0.001, t);
      whizG.gain.linearRampToValueAtTime(isHeavy ? 0.48 : 0.38, t + 0.025);
      whizG.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.01);
      whiz.connect(whizG);
      whizG.connect(this.masterGain);
      whiz.start(t);
      whiz.stop(t + dur + 0.015);

      // 3. Air-shear slipstream hiss
      this.playNoiseBurst(dur, isHeavy ? 0.5 : 0.36, isHeavy ? 1600 : 2900, 1.8, 'bandpass');
    } catch {
      // ignore
    }
  }

  // 13. 100% WEB AUDIO PROCEDURAL TROOPS VOIP & RADIO CHATTER SYNTHESIZER
  // Uses a single automated oscillator + filter chain (zero node accumulation!)
  public playTroopVoip(
    role: 'enemy_troop' | 'allied_troop' | 'tank_cmd' | 'bacillus_boss' | 'cell_help' | 'organ_hq',
    forcePriority: boolean = false
  ): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const now = performance.now();
    if (!forcePriority && now - this.lastVoiceTime < 2200) return;
    this.lastVoiceTime = now;

    try {
      const t = this.ctx.currentTime + 0.005;

      const syllableCount = role === 'organ_hq' ? 5 : 4;
      const syllableDur = role === 'cell_help' ? 0.08 : 0.09;
      const gapDur = 0.025;
      const totalSpeechDur = syllableCount * (syllableDur + gapDur);
      const endT = t + 0.055 + totalSpeechDur;

      // Single Walkie-Talkie Bandpass Filter + Single Voice Oscillator + Single Gain Envelope
      const radioBand = this.ctx.createBiquadFilter();
      radioBand.type = 'bandpass';
      radioBand.frequency.value =
        role === 'cell_help'
          ? 1650
          : role === 'enemy_troop'
          ? 1050
          : role === 'tank_cmd' || role === 'bacillus_boss'
          ? 820
          : 1280;
      radioBand.Q.value = 1.3;
      radioBand.connect(this.masterGain);

      const voiceOsc = this.ctx.createOscillator();
      const voiceGain = this.ctx.createGain();
      voiceOsc.type = role === 'allied_troop' || role === 'cell_help' ? 'triangle' : 'sawtooth';

      // PTT Key-In Beep at start
      const pttFreq1 = role === 'enemy_troop' || role === 'tank_cmd' ? 1180 : 1580;
      const pttFreq2 = role === 'enemy_troop' || role === 'tank_cmd' ? 890 : 2180;
      voiceOsc.frequency.setValueAtTime(pttFreq1, t);
      voiceOsc.frequency.setValueAtTime(pttFreq2, t + 0.022);
      voiceGain.gain.setValueAtTime(0.26, t);
      voiceGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

      const pattern =
        role === 'enemy_troop'
          ? [142, 168, 134, 176, 152]
          : role === 'allied_troop'
          ? [175, 210, 192, 228, 185]
          : role === 'tank_cmd'
          ? [98, 118, 106, 124, 92]
          : role === 'bacillus_boss'
          ? [82, 96, 88, 105, 76]
          : role === 'cell_help'
          ? [640, 820, 710, 890, 620]
          : [188, 225, 205, 240, 195];

      const peakGain = role === 'cell_help' ? 0.34 : 0.4;
      for (let s = 0; s < syllableCount; s++) {
        const sStart = t + 0.055 + s * (syllableDur + gapDur);
        const sEnd = sStart + syllableDur;
        const baseF0 = pattern[s % pattern.length];
        voiceOsc.frequency.setValueAtTime(baseF0, sStart);
        voiceOsc.frequency.linearRampToValueAtTime(baseF0 * (s % 2 === 0 ? 1.15 : 0.9), sEnd);
        voiceGain.gain.setValueAtTime(0.001, sStart);
        voiceGain.gain.linearRampToValueAtTime(peakGain, sStart + 0.015);
        voiceGain.gain.exponentialRampToValueAtTime(0.001, sEnd);
      }

      // Closing Roger-Beep on the same oscillator
      voiceOsc.frequency.setValueAtTime(pttFreq2, endT);
      voiceOsc.frequency.setValueAtTime(pttFreq1 * 0.85, endT + 0.025);
      voiceGain.gain.setValueAtTime(0.22, endT);
      voiceGain.gain.exponentialRampToValueAtTime(0.001, endT + 0.055);

      voiceOsc.connect(voiceGain);
      voiceGain.connect(radioBand);

      voiceOsc.onended = () => {
        try {
          voiceOsc.disconnect();
          voiceGain.disconnect();
          radioBand.disconnect();
        } catch {
          // ignore
        }
      };

      voiceOsc.start(t);
      voiceOsc.stop(endT + 0.06);
    } catch {
      // ignore
    }
  }

  // Extract clean spoken dialog from HUD-formatted strings like 'HOSTILE VOIP // STREP-1: "At the barricade!"'
  private cleanSpokenText(rawText: string): string {
    const quotedMatch = rawText.match(/"([^"]+)"/);
    const core = quotedMatch ? quotedMatch[1] : rawText;
    return core
      .replace(/120mm/gi, '120 millimeter')
      .replace(/WBC/g, 'White Blood Cell')
      .replace(/HQ/g, 'Command')
      .replace(/—/g, ', ')
      .replace(/\/\//g, ', ')
      .trim();
  }

  // Real Spoken Voice Synthesizer (Non-blocking: NEVER calls synth.cancel() which deadlocks mobile/desktop browsers!)
  public speakVoiceLine(
    text: string,
    role: 'enemy_troop' | 'allied_troop' | 'tank_cmd' | 'bacillus_boss' | 'cell_help' | 'organ_hq',
    isPriority: boolean = false
  ): void {
    if (!this.enabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const spoken = this.cleanSpokenText(text);
    if (!spoken) return;

    try {
      const synth = window.speechSynthesis;
      if (!this.voicesLoaded) {
        this.initSpeechVoices();
      }

      // CRITICAL: Never call synth.cancel() during active WebGL gameplay — if already speaking or pending, let current utterance finish naturally!
      if (synth.speaking || synth.pending) {
        return;
      }

      const utter = new SpeechSynthesisUtterance(spoken);
      utter.lang = 'en-US';
      utter.volume = 0.95;

      if (role === 'cell_help') {
        utter.pitch = 1.45;
        utter.rate = 1.16;
      } else if (role === 'bacillus_boss') {
        utter.pitch = 0.65;
        utter.rate = 0.98;
      } else if (role === 'tank_cmd') {
        utter.pitch = 0.76;
        utter.rate = 1.04;
      } else if (role === 'enemy_troop') {
        utter.pitch = 0.85;
        utter.rate = 1.1;
      } else if (role === 'allied_troop') {
        utter.pitch = 1.05;
        utter.rate = 1.1;
      } else {
        utter.pitch = 0.95;
        utter.rate = 1.06;
      }

      if (this.preferredVoices.length > 0) {
        const voiceIdx =
          role === 'cell_help'
            ? this.preferredVoices.length - 1
            : role === 'organ_hq'
            ? 0
            : role === 'enemy_troop' || role === 'tank_cmd'
            ? Math.min(1, this.preferredVoices.length - 1)
            : Math.min(2, this.preferredVoices.length - 1);
        utter.voice = this.preferredVoices[voiceIdx];
      }

      if (isPriority) {
        this.isSpeakingPriorityVoip = true;
      }

      utter.onend = () => {
        this.isSpeakingPriorityVoip = false;
      };
      utter.onerror = () => {
        this.isSpeakingPriorityVoip = false;
      };

      synth.speak(utter);
    } catch {
      this.isSpeakingPriorityVoip = false;
    }
  }

  // Procedural Web Audio character vocalization + Spoken Voice Fallback
  public playVocalFx(role: 'rbc' | 'strep' | 'bacillus' | 'tank' | 'commando'): void {
    if (!this.enabled) return;
    if (role === 'rbc') {
      this.playTroopVoip('cell_help');
    } else if (role === 'strep') {
      this.playTroopVoip('enemy_troop');
    } else if (role === 'bacillus') {
      this.playTroopVoip('bacillus_boss');
    } else if (role === 'tank') {
      this.playTroopVoip('tank_cmd');
    } else {
      this.playTroopVoip('allied_troop');
    }
  }

  // 1. Panicking Red Blood Cells crying for help
  public speakRbcPanic(): void {
    if (!this.enabled) return;
    this.playTroopVoip('cell_help');
    this.speakVoiceLine('Help! Red Blood Cells under attack! Save us!', 'cell_help', false);
  }

  // 2. Strepto Bacteria Soldier VOIP Grunts
  public speakStrepGrunt(): string {
    const phrases = [
      'HOSTILE VOIP // STREP-1: "At the barricade! Scoping target—open fire!"',
      'HOSTILE VOIP // STREP-2: "Crouching at firing line! Pin down the Leukocyte!"',
      'HOSTILE VOIP // STREP-3: "Suppress their sandbags! Keep firing!"',
      'HOSTILE VOIP // STREP-4: "Target locked in scope! Breach the vessel wall!"',
      'HOSTILE VOIP // STREP-5: "Advance to the bunker line and fire at will!"',
    ];
    const phrase = phrases[Math.floor(Math.random() * phrases.length)];
    if (this.enabled) {
      this.playTroopVoip('enemy_troop');
      this.speakVoiceLine(phrase, 'enemy_troop', false);
    }
    return phrase;
  }

  // 3. Bacillus Heavy Titan VOIP
  public speakBacillusHeavy(): string {
    const phrases = [
      'HOSTILE VOIP // BACILLUS HEAVY: "Heavy bio-armor advancing! Crush their barricade!"',
      'HOSTILE VOIP // BACILLUS HEAVY: "All bacterial squads, focus fire on the White Blood Cell!"',
      'HOSTILE VOIP // BACILLUS HEAVY: "Release the endotoxins! Break their defensive line!"',
    ];
    const phrase = phrases[Math.floor(Math.random() * phrases.length)];
    if (this.enabled) {
      this.playTroopVoip('bacillus_boss');
      this.speakVoiceLine(phrase, 'bacillus_boss', false);
    }
    return phrase;
  }

  // 4. Bacteria Battle Tank Commander VOIP
  public speakTankCommander(): string {
    const phrases = [
      'ARMOR VOIP // BIO-TANK CMD: "120mm toxic shell loaded! Shatter their sandbag bunker!"',
      'ARMOR VOIP // BIO-TANK CMD: "Main turret locked on Leukocyte position—FIRE!"',
      'ARMOR VOIP // BIO-TANK CMD: "Heavy armor holding firing line! Pound their cover to dust!"',
    ];
    const phrase = phrases[Math.floor(Math.random() * phrases.length)];
    if (this.enabled) {
      this.playTroopVoip('tank_cmd');
      this.speakVoiceLine(phrase, 'tank_cmd', false);
    }
    return phrase;
  }

  // 5. Allied WBC Commando Paratrooper VOIP
  public speakCommando(): string {
    const phrases = [
      'SQUAD VOIP // SGT. LEUKO-1: "Commandos on your flank! Laying suppressive fire!"',
      'SQUAD VOIP // MACROPHAGE-2: "Covering your reload, Operator! Keep picking them off!"',
      'SQUAD VOIP // RANGER WBC-3: "Hostiles crouching at the barricade—light them up!"',
      'SQUAD VOIP // ANTIBODY TAC-4: "Flank secured! Watch for incoming bullet races!"',
    ];
    const phrase = phrases[Math.floor(Math.random() * phrases.length)];
    if (this.enabled) {
      this.playTroopVoip('allied_troop');
      this.speakVoiceLine(phrase, 'allied_troop', false);
    }
    return phrase;
  }

  // 6. Tactical Radio Callout
  public speakRadio(text?: string): void {
    if (!this.enabled) return;
    this.playTroopVoip('allied_troop');
    if (text) {
      this.speakVoiceLine(text, 'allied_troop', true);
    }
  }

  // 7. Blériot Vintage WW2 Warplane Propeller Dive + Mortar Bomb Release
  public playBleriotMortarRun(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    try {
      const t = this.ctx.currentTime;

      // Vintage rotary piston engine drone with Doppler pitch shift
      const engineOsc = this.ctx.createOscillator();
      const subOsc = this.ctx.createOscillator();
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      const engineGain = this.ctx.createGain();

      engineOsc.type = 'sawtooth';
      engineOsc.frequency.setValueAtTime(115, t);
      engineOsc.frequency.linearRampToValueAtTime(155, t + 0.9);
      engineOsc.frequency.exponentialRampToValueAtTime(78, t + 2.2);

      subOsc.type = 'square';
      subOsc.frequency.setValueAtTime(58, t);
      subOsc.frequency.linearRampToValueAtTime(77, t + 0.9);
      subOsc.frequency.exponentialRampToValueAtTime(39, t + 2.2);

      // 19 Hz wooden propeller chop modulation
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(19, t);
      lfoGain.gain.setValueAtTime(0.35, t);
      lfo.connect(lfoGain);
      lfoGain.connect(engineGain.gain);

      engineGain.gain.setValueAtTime(0.01, t);
      engineGain.gain.linearRampToValueAtTime(0.55, t + 0.65);
      engineGain.gain.exponentialRampToValueAtTime(0.001, t + 2.25);

      engineOsc.connect(engineGain);
      subOsc.connect(engineGain);
      engineGain.connect(this.masterGain);

      engineOsc.start(t);
      subOsc.start(t);
      lfo.start(t);
      engineOsc.stop(t + 2.25);
      subOsc.stop(t + 2.25);
      lfo.stop(t + 2.25);

      // Descending WW2 Mortar Shell Whistle as bomb drops toward barricade
      const whistleOsc = this.ctx.createOscillator();
      const whistleGain = this.ctx.createGain();
      whistleOsc.type = 'sine';
      whistleOsc.frequency.setValueAtTime(1180, t + 0.45);
      whistleOsc.frequency.exponentialRampToValueAtTime(220, t + 1.65);

      whistleGain.gain.setValueAtTime(0.001, t + 0.45);
      whistleGain.gain.linearRampToValueAtTime(0.42, t + 0.75);
      whistleGain.gain.exponentialRampToValueAtTime(0.001, t + 1.68);

      whistleOsc.connect(whistleGain);
      whistleGain.connect(this.masterGain);
      whistleOsc.start(t + 0.45);
      whistleOsc.stop(t + 1.68);
    } catch {
      // ignore
    }
  }

  // 8. BOSS GUIDED ROCKET / MISSILE LAUNCH (High-pressure ignition hiss + roaring booster whoosh)
  public playRocketLaunch(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    try {
      const t = this.ctx.currentTime + 0.002;

      // Rocket motor ignition shriek
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(520, t);
      osc.frequency.exponentialRampToValueAtTime(135, t + 0.48);
      gain.gain.setValueAtTime(0.65, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.48);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.48);

      // Solid-fuel booster propellant roar
      this.playNoiseBurst(0.45, 0.95, 1650, 1.1, 'bandpass');
    } catch {
      // ignore
    }
  }

  // 9. BLACK OPS SIGHT SCOPE (ADS) ZOOM IN / OUT SERVO CLICK
  public playScopeZoom(zoomIn: boolean): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    try {
      const t = this.ctx.currentTime + 0.002;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(zoomIn ? 480 : 760, t);
      osc.frequency.exponentialRampToValueAtTime(zoomIn ? 880 : 390, t + 0.075);
      gain.gain.setValueAtTime(0.38, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.075);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.08);
    } catch {
      // ignore
    }
  }

  // 10. PANICKING CELLS & PLATELETS AUDIBLE CRY FOR HELP (Real Spoken Voice + Expressive Formant Distress Cry!)
  public speakCellHelpCry(themeId: string = 'capillary', isPlatelet: boolean = false): string {
    const plateletPhrases = [
      'Help us! Tiny Platelets under fire! Need Fibrin backup!',
      'Save the Platelets! We are trying to clot the wound!',
      'White Blood Cell, help! Pathogens chasing our Platelet squad!',
      'Medic! Platelets need protection near the Thromboglobin Tower!',
    ];
    const themePhrases: Record<string, string[]> = {
      capillary: [
        'Help! Red Blood Cells under attack! Save our oxygen cargo!',
        'Leukocyte, help us! Bacteria swarming the capillary!',
        'Save us! We are just carrying hemoglobin!',
      ],
      alveoli: [
        'Help! Mucus Goblet Cells panicking! Clear the airway!',
        'White Blood Cell, save the trachea! Pathogens in the mucus!',
        'Help us! Our cilia cannot sweep them fast enough!',
      ],
      stomach: [
        'Help! Gastric cells under siege! Hold the Pyloric line!',
        'Save us Leukocyte! Bacteria resisting the stomach acid!',
      ],
      intestine: [
        'Help! Enterocyte villi cells under fire! Defend the lumen!',
        'White Blood Cell, protect the microvilli absorption lane!',
      ],
      brain: [
        'Help! Neurones in danger! Protect the spinal cord axons!',
        'Save our synapses! Pathogens breaching the neural canal!',
      ],
    };

    const list = isPlatelet ? plateletPhrases : themePhrases[themeId] || themePhrases.capillary;
    const phrase = list[Math.floor(Math.random() * list.length)];

    if (!this.enabled) return phrase;
    this.playTroopVoip('cell_help', true);
    this.speakVoiceLine(phrase, 'cell_help', true);
    return phrase;
  }

  // 11. CONTEXT-SPECIFIC ORGAN VOIP RADIO CHATTER (Distinct Organ Acoustic Preambles + Real Spoken Radio Voice!)
  public playOrganVoipClip(
    organType: 'heart' | 'bone_marrow' | 'bronchial' | 'gastric' | 'neural' | 'lymph' | 'platelet' = 'heart',
    spokenMessage?: string
  ): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    try {
      const t = this.ctx.currentTime + 0.003;

      if (organType === 'heart') {
        // Heart Command: Double Cardiac Lub-Dub Sub-Bass Pulse before VHF transmission
        [0, 0.14].forEach((offset, idx) => {
          if (!this.ctx || !this.masterGain) return;
          const beat = this.ctx.createOscillator();
          const beatG = this.ctx.createGain();
          beat.type = 'sine';
          beat.frequency.setValueAtTime(idx === 0 ? 78 : 66, t + offset);
          beat.frequency.exponentialRampToValueAtTime(32, t + offset + 0.11);
          beatG.gain.setValueAtTime(0.65, t + offset);
          beatG.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.115);
          beat.connect(beatG);
          beatG.connect(this.masterGain);
          beat.start(t + offset);
          beat.stop(t + offset + 0.12);
        });
      } else if (organType === 'bone_marrow') {
        // Bone Marrow Command: Ascending Stem-Cell Reinforcement Mobilization Triad
        [520, 780, 1040].forEach((freq, idx) => {
          if (!this.ctx || !this.masterGain) return;
          const chime = this.ctx.createOscillator();
          const chimeG = this.ctx.createGain();
          chime.type = 'triangle';
          chime.frequency.setValueAtTime(freq, t + idx * 0.045);
          chimeG.gain.setValueAtTime(0.36, t + idx * 0.045);
          chimeG.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.045 + 0.11);
          chime.connect(chimeG);
          chimeG.connect(this.masterGain);
          chime.start(t + idx * 0.045);
          chime.stop(t + idx * 0.045 + 0.12);
        });
      } else if (organType === 'bronchial') {
        // Bronchial / Alveoli Command: Pressurized Respirator Air-Valve Whoosh
        this.playNoiseBurst(0.18, 0.45, 1650, 1.4, 'bandpass');
      } else if (organType === 'neural') {
        // Neural Command: Synaptic Telemetry Data-Burst Ticks
        [1920, 2560, 2180].forEach((freq, idx) => {
          if (!this.ctx || !this.masterGain) return;
          const syn = this.ctx.createOscillator();
          const synG = this.ctx.createGain();
          syn.type = 'sine';
          syn.frequency.setValueAtTime(freq, t + idx * 0.032);
          synG.gain.setValueAtTime(0.3, t + idx * 0.032);
          synG.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.032 + 0.035);
          syn.connect(synG);
          synG.connect(this.masterGain);
          syn.start(t + idx * 0.032);
          syn.stop(t + idx * 0.032 + 0.04);
        });
      } else {
        // Gastric / Lymph / Platelet HQ: Tactical Double Alert Beep
        [1380, 1840].forEach((freq, idx) => {
          if (!this.ctx || !this.masterGain) return;
          const bp = this.ctx.createOscillator();
          const bpG = this.ctx.createGain();
          bp.type = 'triangle';
          bp.frequency.setValueAtTime(freq, t + idx * 0.045);
          bpG.gain.setValueAtTime(0.34, t + idx * 0.045);
          bpG.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.045 + 0.055);
          bp.connect(bpG);
          bpG.connect(this.masterGain);
          bp.start(t + idx * 0.045);
          bp.stop(t + idx * 0.045 + 0.06);
        });
      }

      // Follow preamble with VHF Organ VOIP Radio Squelch + Real Spoken Voice Transmission!
      setTimeout(() => {
        if (!this.enabled) return;
        const role =
          organType === 'bone_marrow'
            ? 'allied_troop'
            : organType === 'platelet'
            ? 'cell_help'
            : 'organ_hq';
        this.playTroopVoip(role, true);
        if (spokenMessage) {
          this.speakVoiceLine(spokenMessage, role, true);
        }
      }, 150);
    } catch {
      // ignore
    }
  }

  public playOrganRadioComm(spokenText?: string): void {
    if (!this.enabled) return;
    this.playOrganVoipClip('heart', spokenText);
  }
}

export const sounds = new SoundEffectsService();


