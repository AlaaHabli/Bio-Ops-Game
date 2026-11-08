import React from 'react';
import { Weapon } from '../types/game';

interface WeaponBlockyIconProps {
  weaponId?: string;
  category?: Weapon['category'] | 'SPY_PISTOL' | 'SPY_SMG' | 'SPY_SNIPER';
  className?: string;
}

/**
 * Renders the exact multi-part blocky ("Lego-shape") 3D weapon designs built in CellModels.ts
 * (`createFortniteWeaponModel` & `createCovertSuppressedPistol`) for HUD weapon slots and Armory cards.
 */
export const WeaponBlockyIcon: React.FC<WeaponBlockyIconProps> = React.memo(({
  weaponId,
  category,
  className = 'w-9 h-5 sm:w-11 sm:h-6',
}) => {
  const id = weaponId || '';

  // 1. IMMUNO-SCAR ASSAULT (scar_bio / ASSAULT)
  // Blocky Gold/Amber monolithic upper receiver (#d97706 / #f59e0b), 4 dark cooling vents,
  // tan UGG-boot folding stock with black cheek pad, EOTech holo sight with cyan reticle (#06b6d4),
  // glowing yellow plasma conduit strip (#facc15), vertical foregrip, 7.62mm mag with yellow bio-window,
  // gunmetal barrel + 3-prong flash hider, and green AN/PEQ laser lens (#22c55e).
  if (id === 'scar_bio' || (!id && category === 'ASSAULT')) {
    return (
      <svg
        viewBox="0 0 68 30"
        className={`${className} drop-shadow-[0_2px_3px_rgba(0,0,0,0.95)]`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* UGG-Boot Folding Buttstock (Tan/Gold + Black Rubber Pad & Cheek Riser) */}
        <rect x="2" y="10" width="4" height="11" rx="0.5" fill="#0f172a" />
        <rect x="6" y="10" width="11" height="8" rx="0.5" fill="#f59e0b" stroke="#0f172a" strokeWidth="0.8" />
        <rect x="6" y="15" width="7" height="5" rx="0.5" fill="#d97706" />
        <rect x="7" y="8.5" width="8" height="2" rx="0.5" fill="#0f172a" />
        <rect x="16" y="10" width="2.5" height="7" fill="#0f172a" />

        {/* Lower Receiver & Ergonomic Pistol Grip */}
        <rect x="18" y="15" width="21" height="4.5" fill="#1e293b" stroke="#0f172a" strokeWidth="0.7" />
        <polygon points="19,19.5 24,19.5 21.5,28 16.5,28" fill="#0f172a" />

        {/* 7.62mm Box Magazine + Glowing Yellow Bio-Window + Ranger Baseplate */}
        <polygon points="28,19 35,19 36.5,28.5 29.5,28.5" fill="#334155" stroke="#0f172a" strokeWidth="0.7" />
        <polygon points="31,20.5 33,20.5 34,26.5 32,26.5" fill="#facc15" />
        <rect x="29.5" y="27.5" width="7.2" height="1.8" fill="#0f172a" />

        {/* Stubby Vertical Foregrip */}
        <rect x="40" y="18.5" width="4" height="7.5" rx="0.5" fill="#0f172a" />
        <rect x="40.5" y="20.5" width="3" height="1" fill="#334155" />
        <rect x="40.5" y="22.5" width="3" height="1" fill="#334155" />

        {/* Monolithic Blocky Gold Upper Receiver */}
        <rect x="18" y="9" width="29" height="6.8" rx="0.6" fill="#d97706" stroke="#0f172a" strokeWidth="0.8" />
        <rect x="19" y="9.6" width="27" height="2" fill="#f59e0b" />

        {/* Glowing Yellow Plasma Bio-Conduit Strip */}
        <rect x="20" y="14.2" width="25" height="1.3" fill="#facc15" />

        {/* 4 Side Barrel Cooling Vents + Ejection Port + Reciprocating Charging Handle */}
        <rect x="23" y="11.2" width="5.5" height="2" fill="#0f172a" />
        <rect x="33" y="11.3" width="2" height="2" fill="#0f172a" />
        <rect x="36.2" y="11.3" width="2" height="2" fill="#0f172a" />
        <rect x="39.4" y="11.3" width="2" height="2" fill="#0f172a" />
        <rect x="42.6" y="11.3" width="2" height="2" fill="#0f172a" />

        {/* Top Full-Length Picatinny Rail Teeth */}
        <rect x="19" y="7.5" width="27" height="1.5" fill="#1e293b" />
        <rect x="20" y="6.6" width="2" height="1" fill="#334155" />
        <rect x="24" y="6.6" width="2" height="1" fill="#334155" />
        <rect x="36" y="6.6" width="2" height="1" fill="#334155" />
        <rect x="40" y="6.6" width="2" height="1" fill="#334155" />
        <rect x="44" y="6.6" width="2" height="1" fill="#334155" />

        {/* EOTech Holographic Sight with Cyan Hologram Window */}
        <rect x="26.5" y="2.8" width="8.5" height="4.8" rx="0.6" fill="#0f172a" stroke="#475569" strokeWidth="0.6" />
        <rect x="28" y="3.6" width="5.5" height="3.2" fill="#06b6d4" />
        <circle cx="30.75" cy="5.2" r="0.9" fill="#ffffff" />

        {/* Side AN/PEQ-15 Laser Box + Green Emitter Lens */}
        <rect x="42" y="15.5" width="5" height="2.8" fill="#0f172a" />
        <rect x="46.5" y="16" width="1.5" height="1.8" fill="#22c55e" />

        {/* Heavy Free-Float Gunmetal Barrel + Gas Block + 3-Prong Flash Hider */}
        <rect x="47" y="10.2" width="4" height="3.8" fill="#1e293b" />
        <rect x="48" y="6.5" width="1.8" height="3.8" fill="#0f172a" />
        <rect x="51" y="11" width="10" height="2.5" fill="#334155" stroke="#0f172a" strokeWidth="0.6" />
        <rect x="61" y="10.3" width="5" height="3.9" fill="#0f172a" />
        <rect x="63.5" y="11.6" width="2.5" height="1.2" fill="#facc15" />
      </svg>
    );
  }

  // 2. MACROPHAGE PUMP SHOTGUN (pump_shotgun / SHOTGUN)
  // Blocky Epic Purple receiver (#7c3aed), perforated gunmetal top heat shield (#334155),
  // 5 red 12-gauge shells (#dc2626) with brass bases (#facc15) on the side saddle,
  // over-under barrel & mag tube, ribbed black fore-end pump slide, chrome breacher choke,
  // and purple CQB ghost-ring sight (#a855f7).
  if (id === 'pump_shotgun' || (!id && category === 'SHOTGUN')) {
    return (
      <svg
        viewBox="0 0 68 30"
        className={`${className} drop-shadow-[0_2px_3px_rgba(0,0,0,0.95)]`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Heavy Tactical Buttstock & Recoil Pad */}
        <rect x="2" y="12" width="3.5" height="10.5" rx="0.5" fill="#0f172a" />
        <polygon points="5.5,12 16,11 16,18.5 5.5,22" fill="#1e293b" stroke="#0f172a" strokeWidth="0.8" />
        <polygon points="15.5,16 20,16 17.5,26.5 13,26.5" fill="#0f172a" />

        {/* Blocky Epic Purple Shotgun Receiver */}
        <rect x="16" y="9.5" width="19" height="7.5" rx="0.6" fill="#7c3aed" stroke="#0f172a" strokeWidth="0.8" />
        <rect x="17" y="10.2" width="17" height="1.8" fill="#a855f7" />

        {/* CQB Ghost-Ring Rear Sight */}
        <rect x="18" y="6.2" width="5" height="3.3" rx="0.5" fill="#0f172a" />
        <rect x="19.2" y="7" width="2.6" height="1.8" fill="#a855f7" />

        {/* Side Shell Saddle with 5 Red 12-Gauge Shells & Gold Brass Bases */}
        <rect x="18.5" y="12" width="14" height="4.2" fill="#0f172a" />
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <rect x={19.3 + i * 2.6} y="11.2" width="1.8" height="3.6" fill="#dc2626" />
            <rect x={19.3 + i * 2.6} y="14.5" width="1.8" height="1.4" fill="#facc15" />
          </g>
        ))}

        {/* Over-Under Double Tubes: Upper Heavy Barrel + Lower Tubular Magazine */}
        <rect x="35" y="9.5" width="24" height="3.2" fill="#334155" stroke="#0f172a" strokeWidth="0.6" />
        <rect x="35" y="13.2" width="22" height="2.8" fill="#1e293b" stroke="#0f172a" strokeWidth="0.6" />

        {/* Perforated Top Metal Heat Shield with Vent Cutouts */}
        <rect x="35" y="8" width="17" height="2.2" fill="#475569" stroke="#0f172a" strokeWidth="0.6" />
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x={36.5 + i * 3} y="8.5" width="1.6" height="1.2" fill="#0f172a" />
        ))}

        {/* Ribbed Sliding Pump Action Fore-End */}
        <rect x="38" y="14.5" width="13.5" height="5" rx="0.6" fill="#0f172a" stroke="#475569" strokeWidth="0.6" />
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x={39.4 + i * 2.3} y="15" width="1.1" height="4" fill="#334155" />
        ))}

        {/* Chrome Standoff Breacher Muzzle Choke + Glowing Fiber-Optic Bead */}
        <rect x="59" y="8.8" width="6.5" height="4.6" rx="0.4" fill="#94a3b8" stroke="#0f172a" strokeWidth="0.7" />
        <rect x="63.5" y="9.6" width="2" height="1" fill="#0f172a" />
        <rect x="63.5" y="11.6" width="2" height="1" fill="#0f172a" />
        <rect x="58" y="6.8" width="2" height="2" fill="#a855f7" />
      </svg>
    );
  }

  // 3. ANTIBODY BOLT SNIPER (bolt_sniper / SNIPER)
  // Blocky Cyan precision chassis (#0284c7), skeletonized stock with cheek rest,
  // chrome bolt knob (#94a3b8), Dual-Ring 12x Telescopic Sniper Scope with glowing cyan lenses (#38bdf8),
  // long fluted free-float bull barrel, folding front bipod legs, and rectangular .50 BMG muzzle brake.
  if (id === 'bolt_sniper' || (!id && category === 'SNIPER')) {
    return (
      <svg
        viewBox="0 0 68 30"
        className={`${className} drop-shadow-[0_2px_3px_rgba(0,0,0,0.95)]`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Skeletonized Precision Stock + Adjustable Cheek Rest */}
        <rect x="1.5" y="10.5" width="3" height="10" fill="#0f172a" />
        <rect x="4.5" y="11" width="11" height="3" fill="#0284c7" stroke="#0f172a" strokeWidth="0.6" />
        <rect x="4.5" y="17.5" width="11" height="2.5" fill="#0284c7" stroke="#0f172a" strokeWidth="0.6" />
        <rect x="6" y="9.2" width="7.5" height="2" rx="0.4" fill="#0f172a" />

        {/* Pistol Grip & Cyan Machined Alloy Chassis */}
        <polygon points="15.5,16.5 19.5,16.5 17.5,26.5 13.5,26.5" fill="#0f172a" />
        <rect x="15" y="10.5" width="23" height="6.2" rx="0.6" fill="#0284c7" stroke="#0f172a" strokeWidth="0.8" />
        <rect x="16" y="11.2" width="21" height="1.6" fill="#38bdf8" />
        <rect x="18" y="14.5" width="18" height="1.2" fill="#38bdf8" />

        {/* Chrome Bolt Action Handle & Oversized Tactical Knob */}
        <rect x="21" y="12.2" width="4.5" height="1.6" fill="#94a3b8" />
        <circle cx="25.5" cy="13" r="1.8" fill="#e2e8f0" stroke="#0f172a" strokeWidth="0.6" />

        {/* Detachable .338 Lapua Box Magazine */}
        <rect x="24" y="16.7" width="6.5" height="8" rx="0.4" fill="#1e293b" stroke="#0f172a" strokeWidth="0.7" />
        <rect x="25.5" y="18" width="3.5" height="5" fill="#0f172a" />

        {/* Dual Scope Mount Rings + High-Power 12x Telescopic Sniper Scope */}
        <rect x="20" y="7.2" width="2.5" height="3.3" fill="#0f172a" />
        <rect x="30.5" y="7.2" width="2.5" height="3.3" fill="#0f172a" />
        {/* Scope Main Tube */}
        <rect x="17" y="4.5" width="19" height="3" fill="#0f172a" stroke="#334155" strokeWidth="0.5" />
        {/* Scope Turrets */}
        <rect x="25" y="2.5" width="2.8" height="2" fill="#1e293b" />
        {/* Rear Eyepiece Bell + Cyan Ocular Lens */}
        <rect x="14.5" y="3.8" width="3.5" height="4.4" fill="#0f172a" />
        <rect x="13.8" y="4.4" width="1.2" height="3.2" fill="#38bdf8" />
        {/* Front Objective Bell + Glowing Cyan Objective Lens */}
        <rect x="35.5" y="3.2" width="5.5" height="5.6" fill="#0f172a" />
        <rect x="40.5" y="3.8" width="1.5" height="4.4" fill="#38bdf8" />

        {/* Long Fluted Free-Float Bull Barrel */}
        <rect x="38" y="11.5" width="22" height="2.6" fill="#334155" stroke="#0f172a" strokeWidth="0.6" />
        <rect x="40" y="12.3" width="18" height="0.8" fill="#0f172a" />

        {/* Folding Front Sniper Bipod Legs */}
        <rect x="42" y="14.1" width="3" height="2.2" fill="#0f172a" />
        <polygon points="43,16 45,16 41,25 39,25" fill="#334155" stroke="#0f172a" strokeWidth="0.5" />
        <polygon points="44,16 46,16 49,25 47,25" fill="#1e293b" stroke="#0f172a" strokeWidth="0.5" />

        {/* Rectangular .50 BMG Tank-Style Muzzle Brake with Dual Baffle Vents */}
        <rect x="60" y="9.8" width="6.8" height="5.8" rx="0.5" fill="#0f172a" stroke="#475569" strokeWidth="0.6" />
        <rect x="61.4" y="10.8" width="1.6" height="3.8" fill="#38bdf8" />
        <rect x="64" y="10.8" width="1.6" height="3.8" fill="#38bdf8" />
      </svg>
    );
  }

  // 4. CYTOKINE DRUM GUN (drum_lmg / MACHINE_GUN)
  // Heavy Emerald-Green LMG receiver (#15803d), Twin Beta-C Round Drum Magazines underneath
  // with glowing green bio-ammo belt (#4ade80), perforated gunmetal cooling shroud,
  // chrome muzzle compensator, and top target-finder reflex sight with green glass (#22c55e).
  if (id === 'drum_lmg' || (!id && category === 'MACHINE_GUN')) {
    return (
      <svg
        viewBox="0 0 68 30"
        className={`${className} drop-shadow-[0_2px_3px_rgba(0,0,0,0.95)]`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Heavy Buffer Tube & Buttstock */}
        <rect x="2.5" y="10" width="3.5" height="10.5" fill="#0f172a" />
        <rect x="6" y="10.5" width="10.5" height="6.5" fill="#1e293b" stroke="#0f172a" strokeWidth="0.7" />
        <polygon points="16.5,16.5 21,16.5 18.5,26.5 14,26.5" fill="#0f172a" />

        {/* Heavy Blocky Emerald-Green LMG Receiver */}
        <rect x="16" y="8.8" width="24" height="8" rx="0.8" fill="#15803d" stroke="#0f172a" strokeWidth="0.8" />
        <rect x="17" y="9.5" width="22" height="2" fill="#22c55e" />
        {/* Glowing Green Plasma Strip */}
        <rect x="17.5" y="14.5" width="21" height="1.4" fill="#4ade80" />

        {/* Top Target-Finder Optic with Glowing Green Glass */}
        <rect x="23.5" y="3.5" width="8.5" height="5.2" rx="0.6" fill="#0f172a" stroke="#475569" strokeWidth="0.6" />
        <rect x="25" y="4.4" width="5.5" height="3.4" fill="#22c55e" />
        <circle cx="27.75" cy="6.1" r="0.9" fill="#ffffff" />

        {/* Twin Beta-C 100-Round Drum Magazine & Exposed Glowing Bio-Ammo Belt */}
        <rect x="27" y="15.8" width="6" height="3.5" fill="#4ade80" stroke="#0f172a" strokeWidth="0.5" />
        <circle cx="26" cy="22.5" r="5.5" fill="#0f172a" stroke="#334155" strokeWidth="0.8" />
        <circle cx="26" cy="22.5" r="2.3" fill="#22c55e" />
        <circle cx="34" cy="22.5" r="5.5" fill="#0f172a" stroke="#334155" strokeWidth="0.8" />
        <circle cx="34" cy="22.5" r="2.3" fill="#22c55e" />

        {/* Perforated Heavy Gunmetal Barrel Shroud + Barrel + Chrome Compensator */}
        <rect x="40" y="9.5" width="14" height="6" rx="0.5" fill="#334155" stroke="#0f172a" strokeWidth="0.7" />
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={41.5 + i * 3} y="10.8" width="1.6" height="3.2" fill="#0f172a" />
        ))}
        <rect x="54" y="11" width="6.5" height="3" fill="#1e293b" />
        <rect x="60.5" y="10" width="5" height="5" rx="0.5" fill="#94a3b8" stroke="#0f172a" strokeWidth="0.6" />
      </svg>
    );
  }

  // 5. SPY COVERT WEAPONS (USP-S Silenced Pistol, MP5-SD Submachine Gun, VSS Vintorez Dart Rifle)
  if (id === 'pistol_usp' || category === 'SPY_PISTOL') {
    return (
      <svg
        viewBox="0 0 68 30"
        className={`${className} drop-shadow-[0_2px_3px_rgba(0,0,0,0.95)]`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Pistol Grip & Trigger Guard */}
        <polygon points="14,14 22,14 18.5,27 10.5,27" fill="#0f172a" stroke="#334155" strokeWidth="0.7" />
        <rect x="12" y="26" width="7" height="2" fill="#38bdf8" />
        <rect x="21" y="14" width="5.5" height="4.5" stroke="#334155" strokeWidth="1.1" />
        {/* Machined Metallic Slide */}
        <rect x="12" y="8" width="23" height="6.5" rx="0.6" fill="#334155" stroke="#0f172a" strokeWidth="0.8" />
        <rect x="13.5" y="9" width="19" height="1.8" fill="#64748b" />
        {/* Mini Reflex Sight with Cyan Reticle */}
        <rect x="15" y="4.2" width="6" height="3.8" fill="#0f172a" />
        <rect x="16.2" y="5" width="3.6" height="2.2" fill="#38bdf8" />
        {/* Under-Barrel Green Laser Sight */}
        <rect x="27" y="14.5" width="7" height="3" fill="#0f172a" />
        <rect x="33" y="15" width="1.6" height="2" fill="#10b981" />
        {/* Heavy Cylindrical Osprey Suppressor with Heat-Ribs */}
        <rect x="35" y="8.8" width="28" height="5.2" rx="0.8" fill="#0f172a" stroke="#475569" strokeWidth="0.7" />
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x={38 + i * 4.5} y="9.4" width="1.5" height="4" fill="#334155" />
        ))}
        <rect x="61.5" y="10.2" width="2" height="2.4" fill="#38bdf8" />
      </svg>
    );
  }

  if (id === 'smg_mp5sd' || category === 'SPY_SMG') {
    return (
      <svg
        viewBox="0 0 68 30"
        className={`${className} drop-shadow-[0_2px_3px_rgba(0,0,0,0.95)]`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Collapsible Wire Buttstock */}
        <rect x="3" y="10" width="3" height="9" fill="#0f172a" />
        <rect x="6" y="12.5" width="10" height="2" fill="#475569" />
        {/* MP5-SD Receiver + Curved 9mm Magazine */}
        <rect x="16" y="9.5" width="21" height="7" rx="0.6" fill="#7c3aed" stroke="#0f172a" strokeWidth="0.8" />
        <polygon points="17,16.5 22,16.5 19.5,26.5 14.5,26.5" fill="#0f172a" />
        <polygon points="28,16.5 33,16.5 35.5,27.5 30.5,27.5" fill="#1e293b" stroke="#a855f7" strokeWidth="0.6" />
        {/* Holo Optic */}
        <rect x="21" y="4.8" width="7" height="4.6" fill="#0f172a" />
        <rect x="22.4" y="5.6" width="4.2" height="3" fill="#a855f7" />
        {/* Ribbed Integrally Suppressed Barrel Shroud */}
        <rect x="37" y="9.2" width="26" height="6.2" rx="1" fill="#0f172a" stroke="#475569" strokeWidth="0.7" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect key={i} x={39 + i * 3.8} y="9.8" width="1.6" height="5" fill="#334155" />
        ))}
      </svg>
    );
  }

  // Fallback / VSS Vintorez Dart Sniper
  return (
    <svg
      viewBox="0 0 68 30"
      className={`${className} drop-shadow-[0_2px_3px_rgba(0,0,0,0.95)]`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="2" y="10.5" width="13" height="8" rx="0.5" fill="#d97706" stroke="#0f172a" strokeWidth="0.7" />
      <rect x="5" y="12.5" width="7" height="4" fill="#0f172a" />
      <rect x="15" y="10" width="20" height="6.5" fill="#334155" stroke="#0f172a" strokeWidth="0.7" />
      <rect x="18" y="4.2" width="14" height="4.5" fill="#0f172a" />
      <rect x="31" y="4.6" width="1.5" height="3.7" fill="#facc15" />
      <rect x="24" y="16.5" width="6" height="9" fill="#0f172a" />
      <rect x="35" y="9.8" width="29" height="5" rx="0.8" fill="#0f172a" stroke="#f59e0b" strokeWidth="0.6" />
    </svg>
  );
});
