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
  private lastShootTime: number = 0;
  private lastEnemyShootTime: number = 0;
  private lastHitmarkerTime: number = 0;
  private lastBarricadeHitTime: number = 0;
  private lastHapticTime: number = 0;
  private whiteNoiseBuffer: AudioBuffer | null = null;
  private isUnlocked: boolean = false;
  private htmlAudioUnlocker: HTMLAudioElement | null = null;
  private htmlAudioPrimed: boolean = false;
  private audioSessionConfigured: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.forcePlaybackAudioSession();

      // Auto-unlock audio once on first user gesture, with passive listeners so touch/scroll/drag never lags
      const unlock = () => {
        this.unlockAudio();
      };
      window.addEventListener('pointerdown', unlock, { passive: true, capture: true });
      window.addEventListener('touchend', unlock, { passive: true, capture: true });
      window.addEventListener('keydown', unlock, { passive: true, capture: true });
      window.addEventListener('click', unlock, { passive: true, capture: true });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.isUnlocked = false;
          this.unlockAudio();
        }
      });
    }
  }

  // Forces iOS 16.4+ / Safari / Mobile WebKit to route Web Audio through the media playback speaker even when the iPhone hardware Ring/Silent switch is on Silent!
  private forcePlaybackAudioSession(): void {
    if (this.audioSessionConfigured) return;
    try {
      const nav = navigator as unknown as { audioSession?: { type: string } };
      if (nav.audioSession) {
        nav.audioSession.type = 'playback';
      }
      this.audioSessionConfigured = true;
    } catch {
      this.audioSessionConfigured = true;
    }
  }

  // Plays a tiny in-memory WAV via HTML5 <audio> once on first touch/click so older iOS & Android WebViews switch out of ringer mode into media speaker output
  private primeHtmlAudioChannel(): void {
    if (this.htmlAudioPrimed || typeof window === 'undefined') return;
    this.htmlAudioPrimed = true;
    try {
      if (!this.htmlAudioUnlocker) {
        const audio = new Audio(
          'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'
        );
        audio.setAttribute('playsinline', 'true');
        audio.volume = 0.01;
        this.htmlAudioUnlocker = audio;
      }
      const p = this.htmlAudioUnlocker.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          this.htmlAudioPrimed = false;
        });
      }
    } catch {
      // ignore
    }
  }

  // Force-unlock and recover audio hardware on iOS Safari, Android Chrome, and Desktop (O(1) no-op once running!)
  public unlockAudio(): void {
    if (typeof window === 'undefined') return;
    if (this.isUnlocked && this.htmlAudioPrimed && this.ctx && (this.ctx.state as string) === 'running') {
      return;
    }
    this.forcePlaybackAudioSession();
    this.primeHtmlAudioChannel();
    this.initContext();

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
    this.forcePlaybackAudioSession();

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
      compressor.threshold.value = -5;
      compressor.knee.value = 10;
      compressor.ratio.value = 3.5;
      compressor.attack.value = 0.002;
      compressor.release.value = 0.12;
      compressor.connect(this.ctx.destination);

      // Phone Speaker Mid-Presence Boost (1.3kHz peaking boost so small phone speakers project gunshots & SFX loudly)
      const phonePresenceBoost = this.ctx.createBiquadFilter();
      phonePresenceBoost.type = 'peaking';
      phonePresenceBoost.frequency.value = 1350;
      phonePresenceBoost.Q.value = 0.9;
      phonePresenceBoost.gain.value = 5.5;
      phonePresenceBoost.connect(compressor);

      // Master gain node (boosted for phone speaker clarity)
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 1.45;
      this.masterGain.connect(phonePresenceBoost);

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

  /**
   * Cross-platform Tactical Haptic Feedback:
   * 1. Triggers hardware vibration motor via navigator.vibrate(pattern) on Android / supported browsers.
   * 2. Synthesizes a 48Hz sub-bass tactile speaker thump on iOS / Safari where navigator.vibrate is blocked,
   *    so players physically feel recoil, hits, kills, and explosions in their hands.
   */
  public triggerHaptic(
    pattern: number | number[] = 18,
    intensity: 'light' | 'medium' | 'heavy' | number = 'medium'
  ): void {
    const nowMs = performance.now();
    if (nowMs - this.lastHapticTime < 220) return;
    this.lastHapticTime = nowMs;

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        const firstVal = Array.isArray(pattern) ? pattern[0] : pattern;
        navigator.vibrate(Math.min(25, firstVal || 18));
      }
    } catch {
      // ignore if blocked
    }

    if (!this.enabled || !this.ctx || !this.masterGain) return;
    if ((this.ctx.state as string) !== 'running') return;

    const level: 'light' | 'medium' | 'heavy' =
      typeof intensity === 'number'
        ? intensity >= 0.65
          ? 'heavy'
          : intensity >= 0.38
          ? 'medium'
          : 'light'
        : intensity;

    const t = this.ctx.currentTime + 0.001;
    const dur = level === 'heavy' ? 0.065 : level === 'medium' ? 0.038 : 0.022;
    const peak = level === 'heavy' ? 0.55 : level === 'medium' ? 0.32 : 0.18;
    this.playTone('sine', level === 'heavy' ? 58 : 48, 26, t, dur, peak, 'exp');
  }

  // Zero-leak oscillator + gain tone helper (disconnects both osc and gain from masterGain on ended!)
  private playTone(
    type: OscillatorType,
    startFreq: number,
    endFreq: number,
    startTime: number,
    duration: number,
    peakGain: number,
    rampType: 'exp' | 'linear' | 'set' = 'exp'
  ): void {
    if (!this.ctx || !this.masterGain) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(1, startFreq), startTime);
      if (rampType === 'exp') {
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), startTime + duration);
      } else if (rampType === 'linear') {
        osc.frequency.linearRampToValueAtTime(Math.max(1, endFreq), startTime + duration);
      } else if (endFreq !== startFreq) {
        osc.frequency.setValueAtTime(Math.max(1, endFreq), startTime + duration * 0.5);
      }
      gain.gain.setValueAtTime(Math.max(0.0001, peakGain), startTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch {
          // ignore
        }
      };
      osc.start(startTime);
      osc.stop(startTime + duration + 0.005);
    } catch {
      // ignore
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
    this.triggerHaptic(
      category === 'SNIPER' || category === 'SHOTGUN' || category === 'HEAVY' ? [28, 20, 35] : 16,
      category === 'SNIPER' || category === 'SHOTGUN' || category === 'HEAVY' ? 'heavy' : 'medium'
    );
    if (!this.enabled) return;
    const nowMs = performance.now();
    if (nowMs - this.lastShootTime < 65) return;
    this.lastShootTime = nowMs;

    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime + 0.003;

    if (category === 'ASSAULT') {
      // SCAR-H 5.56 Bio-Rifle: Loud explosive crack + punchy mid body + crisp bolt action
      this.playTone('sawtooth', 320, 95, t, 0.09, 0.85, 'exp');
      this.playTone('triangle', 140, 45, t, 0.11, 0.68, 'exp');
      this.playNoiseBurst(0.06, 0.9, 2600, 1.2, 'bandpass');
      this.playTone('triangle', 1300, 400, t + 0.02, 0.03, 0.38, 'exp');
    } else if (category === 'SHOTGUN') {
      // Tactical Pump Shotgun: Massive 12-gauge close-range blast + satisfying pump rack
      this.playTone('sawtooth', 220, 45, t, 0.22, 1.1, 'exp');
      this.playTone('triangle', 120, 30, t, 0.28, 1.0, 'exp');
      this.playNoiseBurst(0.18, 1.2, 1600, 0.8, 'lowpass');

      setTimeout(() => {
        if (!this.ctx || !this.masterGain) return;
        const t2 = this.ctx.currentTime + 0.002;
        this.playNoiseBurst(0.04, 0.5, 2200, 2.0, 'bandpass');
        this.playTone('sine', 950, 450, t2, 0.035, 0.35, 'set');

        setTimeout(() => {
          if (!this.ctx || !this.masterGain) return;
          const t3 = this.ctx.currentTime + 0.002;
          this.playTone('triangle', 650, 1400, t3, 0.035, 0.4, 'set');
        }, 120);
      }, 160);
    } else if (category === 'SNIPER') {
      // Bolt-Action Heavy Sniper: High-velocity supersonic sonic crack + devastating concussive boom
      this.playTone('sawtooth', 420, 65, t, 0.32, 1.15, 'exp');
      this.playTone('triangle', 160, 35, t, 0.45, 1.1, 'exp');
      this.playNoiseBurst(0.08, 1.3, 4200, 1.8, 'bandpass');
      this.playNoiseBurst(0.35, 0.7, 950, 1.0, 'lowpass');

      setTimeout(() => {
        if (!this.ctx || !this.masterGain) return;
        const t2 = this.ctx.currentTime + 0.002;
        this.playTone('triangle', 1800, 800, t2, 0.06, 0.45, 'set');
      }, 260);
    } else if (category === 'MACHINE_GUN') {
      // Drum LMG: Rapid heavy mechanical clatter + punchy cyclic cadence
      this.playTone('sawtooth', 260, 80, t, 0.075, 0.9, 'exp');
      this.playNoiseBurst(0.05, 0.85, 3400, 1.5, 'bandpass');
      this.playTone('triangle', 1600, 600, t + 0.015, 0.03, 0.35, 'set');
    } else {
      // HEAVY Rocket/Detonation
      this.playTone('triangle', 110, 22, t, 0.55, 1.4, 'exp');
      this.playNoiseBurst(0.45, 1.3, 1100, 0.7, 'lowpass');
    }

    // Supersonic Downrange Bullet Race Zip
    this.playTone('sine', category === 'SNIPER' ? 3400 : 2550, 420, t + 0.015, 0.08, 0.26, 'exp');
  }

  // 2. KILL CONFIRMATION: Authentic Call of Duty elimination double-chime + tactile thud
  public playKillConfirm(): void {
    this.triggerHaptic([24, 30, 42], 'heavy');
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime + 0.003;
    this.playTone('sine', 1760, 1760, t, 0.16, 0.65, 'set');
    this.playTone('sine', 2640, 2640, t + 0.018, 0.18, 0.55, 'set');
    this.playTone('triangle', 320, 75, t, 0.08, 0.8, 'exp');
    this.playNoiseBurst(0.02, 0.45, 3600, 3.0, 'bandpass');
  }

  // 3. TACTICAL C-130 AIRDROP FLYOVER ROAR (Instant turboprop roar + Doppler sweep + paratrooper drop)
  public playAirdropPlane(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime + 0.003;
    const freqs = [180, 240, 360, 520];
    freqs.forEach((baseFreq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';

      osc.frequency.setValueAtTime(baseFreq * 1.08, t);
      osc.frequency.linearRampToValueAtTime(baseFreq * 1.0, t + 1.6);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.82, t + 5.0);

      gain.gain.setValueAtTime(0.35, t);
      gain.gain.linearRampToValueAtTime(0.65, t + 1.5);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 5.0);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch {
          // ignore
        }
      };
      osc.start(t);
      osc.stop(t + 5.0);
    });

    this.playNoiseBurst(4.8, 0.85, 680, 1.1, 'bandpass');

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

    [0, 0.055, 0.11].forEach((offset) => {
      setTimeout(() => {
        if (!this.ctx || !this.masterGain) return;
        const t = this.ctx.currentTime + 0.002;
        this.playTone('sawtooth', 360, 110, t, 0.045, 0.55, 'exp');
        this.playNoiseBurst(0.035, 0.6, 2800, 1.5, 'bandpass');
      }, offset * 1000);
    });
  }

  // 5. ENEMY BACTERIA TACTICAL SHOOTING (Aggressive bio-toxin plasma darts)
  public playEnemyShoot(): void {
    if (!this.enabled) return;
    const nowMs = performance.now();
    if (nowMs - this.lastEnemyShootTime < 110) return;
    this.lastEnemyShootTime = nowMs;

    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime + 0.002;
    this.playTone('sawtooth', 1150, 220, t, 0.11, 0.65, 'exp');
    this.playNoiseBurst(0.08, 0.55, 3400, 2.0, 'bandpass');
  }

  // 6. BACTERIA BATTLE TANK MAIN TURRET CANNON (120mm toxic mortar roar)
  public playTankCannon(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime + 0.003;
    this.playTone('sawtooth', 160, 28, t, 0.45, 1.3, 'exp');
    this.playNoiseBurst(0.38, 1.25, 950, 0.8, 'lowpass');

    setTimeout(() => {
      if (!this.ctx || !this.masterGain) return;
      const t2 = this.ctx.currentTime + 0.002;
      this.playTone('triangle', 500, 180, t2, 0.08, 0.5, 'set');
    }, 120);
  }

  // 7. BULLET IMPACT ON SANDBAG BARRICADE (Heavy sand thwump + sand scatter + ricochet whistle)
  public playBarricadeHit(): void {
    if (!this.enabled) return;
    const nowMs = performance.now();
    if (nowMs - this.lastBarricadeHitTime < 95) return;
    this.lastBarricadeHitTime = nowMs;

    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime + 0.002;
    this.playTone('triangle', 220, 45, t, 0.09, 0.75, 'exp');
    this.playNoiseBurst(0.08, 0.6, 1600, 1.2, 'bandpass');

    if (Math.random() < 0.4) {
      this.playTone('sine', 2800, 900, t + 0.02, 0.14, 0.35, 'exp');
    }
  }

  // 7b. SANDBAG BARRICADE SHATTERING & COLLAPSE (Wood stake snapping + burlap ripping + sand avalanche)
  public playBarricadeShatter(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime + 0.002;
    this.playTone('sawtooth', 140, 24, t, 0.55, 1.1, 'exp');

    [0.02, 0.09, 0.17, 0.26].forEach((offset, idx) => {
      this.playTone('square', 920 - idx * 110, 180, t + offset, 0.055, 0.55, 'exp');
    });

    this.playNoiseBurst(0.65, 1.0, 1450, 0.9, 'bandpass');
  }

  // 8. CALL OF DUTY / BLACK OPS HITMARKER
  public playHitmarker(isCritical: boolean = false): void {
    this.triggerHaptic(isCritical ? [18, 22, 32] : 14, isCritical ? 'heavy' : 'light');
    if (!this.enabled) return;
    const nowMs = performance.now();
    if (nowMs - this.lastHitmarkerTime < 45) return;
    this.lastHitmarkerTime = nowMs;

    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime + 0.002;
    if (isCritical) {
      this.playTone('triangle', 1850, 920, t, 0.14, 0.65, 'exp');
    } else {
      this.playTone('sine', 1100, 420, t, 0.032, 0.5, 'exp');
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
    this.triggerHaptic([55, 25, 75], 'heavy');
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime + 0.003;
    this.playTone('triangle', 95, 18, t, 0.7, 1.5, 'exp');
    this.playNoiseBurst(0.55, 1.3, 850, 0.6, 'lowpass');
  }

  // Realistic Multi-Stage Tactical Reload Sound (Mag Release -> Mag Eject -> Fresh Mag Slap -> Bolt Rack!)
  public playReload(durationMs: number = 1400): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime + 0.002;
    this.playTone('triangle', 1650, 480, t, 0.048, 0.55, 'exp');
    this.playNoiseBurst(0.09, 0.6, 2400, 1.8, 'bandpass');

    const magInDelay = Math.max(240, Math.round(durationMs * 0.46));
    setTimeout(() => {
      if (!this.ctx || !this.masterGain || !this.enabled) return;
      const t2 = this.ctx.currentTime + 0.002;
      this.playTone('triangle', 190, 55, t2, 0.088, 0.85, 'exp');
      this.playTone('sine', 580, 1380, t2 + 0.025, 0.07, 0.55, 'set');
      this.playNoiseBurst(0.05, 0.55, 2900, 2.2, 'bandpass');
    }, magInDelay);

    const boltDelay = Math.max(460, Math.round(durationMs * 0.8));
    setTimeout(() => {
      if (!this.ctx || !this.masterGain || !this.enabled) return;
      const t3 = this.ctx.currentTime + 0.002;
      this.playNoiseBurst(0.065, 0.7, 3400, 1.6, 'bandpass');
      this.playTone('sawtooth', 1100, 520, t3, 0.058, 0.45, 'exp');

      setTimeout(() => {
        if (!this.ctx || !this.masterGain || !this.enabled) return;
        const t4 = this.ctx.currentTime + 0.002;
        this.playTone('triangle', 720, 1720, t4, 0.075, 0.65, 'set');
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
      this.playTone('triangle', freq, freq, t + i * 0.04, 0.12, 0.48, 'set');
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
    this.playTone('sine', 80, 35, t, 0.15, 0.9, 'exp');

    setTimeout(() => {
      if (!this.ctx || !this.masterGain) return;
      const t2 = this.ctx.currentTime + 0.002;
      this.playTone('sine', 70, 30, t2, 0.16, 0.75, 'exp');
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
      this.playTone('triangle', f, f, t + idx * 0.06, 0.2, 0.35, 'set');
    });
  }

  // Quiz Wrong buzz
  public playQuizWrong(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime + 0.002;
    this.playTone('sawtooth', 105, 80, t, 0.22, 0.5, 'set');
  }

  // Radio squelch / static
  public playRadioSquelch(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime + 0.002;
    this.playTone('square', 2200, 1500, t, 0.04, 0.2, 'set');
    this.playNoiseBurst(0.035, 0.2, 3200, 2.0, 'bandpass');
  }

  // Night vision capacitor whine
  public playNightVisionToggle(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime + 0.002;
    this.playTone('sine', 2000, 4500, t, 0.2, 0.25, 'exp');
  }

  // Brass shell casing bounce
  public playBrassShellDrop(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime + 0.18 + Math.random() * 0.08;
    const baseFreq = 2400 + Math.random() * 500;
    this.playTone('triangle', baseFreq, baseFreq * 0.85, t, 0.05, 0.18, 'set');
  }

  // Radio chirp
  public playRadioChirp(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime + 0.002;
    this.playTone('sine', 1500, 2200, t, 0.06, 0.25, 'set');
  }

  // Combat Alarm warhorn
  public playCombatAlarm(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime + 0.003;
    this.playTone('sawtooth', 120, 85, t, 0.8, 0.6, 'linear');
  }

  // Victory fanfare
  public playVictory(): void {
    if (!this.enabled) return;
    this.triggerHaptic([60, 40, 80, 50, 100], 'heavy');
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime + 0.002;
    const notes = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      this.playTone('triangle', freq, freq, t + idx * 0.09, 0.35, 0.4, 'set');
    });
  }

  // Tactical Stimpack Auto-Injector SFX (Pneumatic hiss + biometric surge, 100% Web Audio)
  public playStimInject(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime + 0.002;
    this.playNoiseBurst(0.16, 0.7, 2400, 1.2, 'bandpass');
    this.playTone('triangle', 1400, 450, t, 0.04, 0.5, 'set');
    this.playTone('sine', 520, 1080, t + 0.05, 0.19, 0.4, 'exp');
  }

  // Tactical Killstreak Sting & Fanfare (Double, Triple, Quadra, Penta, Immunoful, Leukocytastic, Bloody Monster!)
  public playKillstreak(streakCount: number): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime + 0.002;
    const baseFreqs = streakCount >= 8
      ? [330, 440, 554, 659, 880, 1108]
      : streakCount >= 6
      ? [392, 523, 659, 784, 1046]
      : streakCount === 5
      ? [440, 554, 659, 880]
      : streakCount === 4
      ? [440, 554, 659]
      : streakCount === 3
      ? [523, 659, 784]
      : [523, 784];

    baseFreqs.forEach((freq, idx) => {
      this.playTone(
        streakCount >= 5 ? 'sawtooth' : 'triangle',
        freq,
        freq,
        t + idx * 0.055,
        0.28,
        0.35 + Math.min(0.3, streakCount * 0.05),
        'set'
      );
    });

    if (streakCount >= 4) {
      this.playTone('triangle', 140, 45, t, 0.35, 0.8, 'exp');
    }
  }

  // Bacteria Attack Helicopter Heavy Rotor Thumping
  public playHelicopterRotor(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime + 0.002;
    [0, 0.045].forEach((offset) => {
      this.playTone('sawtooth', 95, 35, t + offset, 0.06, 0.45, 'exp');
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
    osc.frequency.setValueAtTime(920, t);
    osc.frequency.exponentialRampToValueAtTime(260, t + 1.2);
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.linearRampToValueAtTime(0.7, t + 0.35);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {
        // ignore
      }
    };
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
    this.playTone('triangle', 130, 28, t, 0.22, 0.85, 'exp');
    this.playNoiseBurst(0.12, 0.5, 2200, 1.5, 'bandpass');
  }

  // 12. SUPERSONIC BULLET RACE WHIZ & FLYBY SNAP (Plays when enemy Spitzer rounds race past player/barricade!)
  public playBulletRaceWhiz(isHeavy: boolean = false): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const now = performance.now();
    if (now - this.lastWhizTime < 120) return;
    this.lastWhizTime = now;

    try {
      const t = this.ctx.currentTime + 0.002;
      this.playTone('triangle', isHeavy ? 2200 : 3600, 680, t, 0.03, isHeavy ? 0.55 : 0.42, 'exp');

      const startFreq = (isHeavy ? 1850 : 2850) + (Math.random() - 0.5) * 420;
      const endFreq = (isHeavy ? 260 : 440) + (Math.random() - 0.5) * 90;
      const dur = isHeavy ? 0.16 : 0.11;
      this.playTone('sine', startFreq, endFreq, t + 0.008, dur, isHeavy ? 0.48 : 0.38, 'exp');
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

  // Non-blocking voice handler: relies on procedural Web Audio API radio synthesis (playTroopVoip)
  // and avoids window.speechSynthesis which can lock up the main UI thread during 60fps WebGL rendering.
  public speakVoiceLine(
    _text: string,
    _role: 'enemy_troop' | 'allied_troop' | 'tank_cmd' | 'bacillus_boss' | 'cell_help' | 'organ_hq',
    _isPriority: boolean = false
  ): void {
    // Intentionally handled via Web Audio API formant synthesis in playTroopVoip()
    // to guarantee zero main-thread stalls or browser speech-queue deadlocks.
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

  public playHazardAlert(type: 'HIGH_BLOOD_PRESSURE' | 'ANTIBIOTIC_WAVE' | 'HISTAMINE_VASODILATION' | 'GASTRIC_ACID_SURGE'): void {
    if (!this.enabled) return;
    this.unlockAudio();
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    try {
      if (type === 'HIGH_BLOOD_PRESSURE') {
        // Double heavy arterial thump with low-frequency rumble
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(65, now);
        osc.frequency.exponentialRampToValueAtTime(32, now + 0.35);
        gain.gain.setValueAtTime(0.7, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.38);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.4);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(55, now + 0.18);
        osc2.frequency.exponentialRampToValueAtTime(28, now + 0.52);
        gain2.gain.setValueAtTime(0.65, now + 0.18);
        gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.55);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.18);
        osc2.stop(now + 0.56);
      } else if (type === 'ANTIBIOTIC_WAVE') {
        // High-energy ascending pharmaceutical shimmer chime
        const freqs = [380, 520, 680, 880, 1150];
        freqs.forEach((f, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, now + idx * 0.05);
          gain.gain.setValueAtTime(0.25, now + idx * 0.05);
          gain.gain.exponentialRampToValueAtTime(0.005, now + idx * 0.05 + 0.3);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.05);
          osc.stop(now + idx * 0.05 + 0.32);
        });
      } else if (type === 'HISTAMINE_VASODILATION') {
        // Warm resonant cellular harmony chord
        [220, 330, 440, 554].forEach((f) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, now);
          gain.gain.setValueAtTime(0.18, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.65);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.7);
        });
      } else if (type === 'GASTRIC_ACID_SURGE') {
        // Corrosive acid hiss and sizzle
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.45);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.48);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.5);
      }
    } catch {
      // ignore
    }
  }

  // Tactical C4 Complement Cascade Arming Sound
  public playC4Arming(): void {
    if (!this.enabled) return;
    this.unlockAudio();
    if (!this.ctx) return;
    try {
      const ctx = this.ctx;
      const now = ctx.currentTime;
      // High-tech ascending tactical arming beep: 900Hz -> 1400Hz
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(900, now);
      osc.frequency.setValueAtTime(1400, now + 0.08);
      osc.frequency.setValueAtTime(1800, now + 0.16);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.setValueAtTime(0.4, now + 0.08);
      gain.gain.setValueAtTime(0.5, now + 0.16);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.36);
    } catch {
      // ignore
    }
  }

  // Urgent C4 Countdown Tick
  public playC4CountdownTick(isFinal: boolean = false): void {
    if (!this.enabled) return;
    this.unlockAudio();
    if (!this.ctx) return;
    try {
      const ctx = this.ctx;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = isFinal ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(isFinal ? 2200 : 1200, now);
      gain.gain.setValueAtTime(isFinal ? 0.5 : 0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + (isFinal ? 0.15 : 0.06));
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + (isFinal ? 0.16 : 0.07));
    } catch {
      // ignore
    }
  }

  // Parked Tank Sabotage Zap & Breakdown
  public playTankSabotage(): void {
    if (!this.enabled) return;
    this.unlockAudio();
    if (!this.ctx) return;
    try {
      const ctx = this.ctx;
      const now = ctx.currentTime;
      // Metallic power-down grind + spark burst
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(450, now);
      osc.frequency.exponentialRampToValueAtTime(35, now + 0.6);
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.65);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.66);
    } catch {
      // ignore
    }
  }

  // Complement Cascade Massive Cellular Osmotic Shockwave Explosion
  public playCascadeShockwave(): void {
    if (!this.enabled) return;
    this.unlockAudio();
    if (!this.ctx) return;
    try {
      const ctx = this.ctx;
      const now = ctx.currentTime;

      // Heavy Sub-bass boom (40Hz)
      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(95, now);
      sub.frequency.exponentialRampToValueAtTime(20, now + 1.2);
      subGain.gain.setValueAtTime(0.85, now);
      subGain.gain.exponentialRampToValueAtTime(0.01, now + 1.5);
      sub.connect(subGain);
      subGain.connect(ctx.destination);
      sub.start(now);
      sub.stop(now + 1.55);

      // Resonant membrane rupture crack
      const noise = ctx.createOscillator();
      const noiseGain = ctx.createGain();
      noise.type = 'triangle';
      noise.frequency.setValueAtTime(320, now);
      noise.frequency.exponentialRampToValueAtTime(40, now + 0.4);
      noiseGain.gain.setValueAtTime(0.6, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
      noise.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noise.start(now);
      noise.stop(now + 0.46);
    } catch {
      // ignore
    }
  }

  // Covert Silenced Pistol Subsonic "Ptew!" + Slide Click for Secret Spy Attack Mode
  public playSilencedPistol(): void {
    this.triggerHaptic(14, 'light');
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;
    try {
      const t = this.ctx.currentTime + 0.002;
      // 1. Acoustic baffle "ptew" pitch drop
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(980, t);
      osc.frequency.exponentialRampToValueAtTime(145, t + 0.075);
      gain.gain.setValueAtTime(0.55, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.085);

      // 2. Muffled gas expansion whisper through suppressor baffles
      this.playNoiseBurst(0.065, 0.35, 2200, 1.8, 'bandpass');
    } catch {
      // ignore
    }
  }

  // Audible Bacterial Squad & NPC Guard Talking / Chatter Sound (multi-syllable bio-commando vocalization)
  private lastChatterTime: number = 0;
  public playBacteriaChatter(isAlerted: boolean = false): void {
    if (!this.enabled) return;
    const nowMs = performance.now();
    if (nowMs - this.lastChatterTime < 1400) return;
    this.lastChatterTime = nowMs;

    this.initContext();
    if (!this.ctx || !this.masterGain) return;
    try {
      const ctx = this.ctx;
      const t0 = ctx.currentTime + 0.005;
      const syllables = isAlerted ? 4 : 5;
      const baseFreqs = isAlerted
        ? [195, 245, 210, 275]
        : [135, 165, 142, 178, 128];

      for (let i = 0; i < syllables; i++) {
        const start = t0 + i * 0.095;
        const dur = 0.072;
        const osc = ctx.createOscillator();
        const mod = ctx.createOscillator();
        const modGain = ctx.createGain();
        const formant = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        const f = baseFreqs[i % baseFreqs.length] * (0.92 + Math.random() * 0.16);
        osc.frequency.setValueAtTime(f, start);
        osc.frequency.linearRampToValueAtTime(f * (i % 2 === 0 ? 1.18 : 0.86), start + dur);

        // Throat growl FM modulation
        mod.type = 'sine';
        mod.frequency.setValueAtTime(32, start);
        modGain.gain.setValueAtTime(18, start);
        mod.connect(modGain);
        modGain.connect(osc.frequency);

        // Vocal tract formant resonance
        formant.type = 'bandpass';
        formant.frequency.setValueAtTime(520 + (i % 3) * 240, start);
        formant.Q.setValueAtTime(2.6, start);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(isAlerted ? 0.28 : 0.2, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

        osc.connect(formant);
        formant.connect(gain);
        gain.connect(this.masterGain);

        osc.start(start);
        mod.start(start);
        osc.stop(start + dur + 0.01);
        mod.stop(start + dur + 0.01);
      }
    } catch {
      // ignore
    }
  }

  // Tactical Supply Drop Sonar / Ping Chirp (Plays 3s before supply drop arrives)
  public playSupplyDropPing(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime + 0.002;
    this.playTone('sine', 1760, 2640, t, 0.12, 0.45, 'exp');
    this.playTone('sine', 2640, 3520, t + 0.08, 0.14, 0.35, 'exp');
  }

  // Supply Drop Cargo Net Heavy Ground Impact
  public playSupplyNetImpact(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime + 0.002;
    this.playTone('triangle', 180, 42, t, 0.35, 0.75, 'exp');
    this.playNoiseBurst(0.28, 0.65, 450, 1.2, 'lowpass');
  }

  // T-Cytotoxic Laser Disintegrator Hyper-Rate Laser Pulse
  public playLaserDisintegrator(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime + 0.001;
    this.playTone('sawtooth', 1280, 220, t, 0.05, 0.32, 'exp');
  }

  // Super Ability Acquired Ascending Harmonic Jingle
  public playSuperAbilityAward(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime + 0.002;
    const freqs = [440, 554.37, 659.25, 880, 1108.73, 1318.5];
    freqs.forEach((f, idx) => {
      this.playTone('triangle', f, f * 1.05, t + idx * 0.045, 0.22, 0.4, 'set');
    });
    this.playNoiseBurst(0.25, 0.35, 1800, 1.0, 'bandpass');
  }
}


export const sounds = new SoundEffectsService();



