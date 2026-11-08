import React, { useState } from 'react';
import { X, BookOpen, Search, CheckCircle, Zap } from 'lucide-react';
import { sounds } from '../services/soundEffects';

interface IntelArchiveProps {
  onClose: () => void;
}

interface TopicIntel {
  id: string;
  stage: 'Grade 5' | 'Stage 7' | 'Stage 8';
  title: string;
  summary: string;
  keyConcepts: { label: string; desc: string }[];
  equation?: string;
  tacticalNote: string;
}

const CAMBRIDGE_TOPICS: TopicIntel[] = [
  {
    id: 'g5_matter_properties',
    stage: 'Grade 5',
    title: 'Inspire Unit 1: Properties of Matter',
    summary: 'McGraw Hill Inspire Science (Grade 5): Matter is anything that has mass and takes up space (volume). Substances are identified by their physical and chemical properties.',
    keyConcepts: [
      { label: 'Physical Properties', desc: 'Characteristics observed or measured without changing the substance into something new (mass, volume, color, hardness, reflectivity, magnetism, solubility, conductivity).' },
      { label: 'Mass vs. Volume', desc: 'Mass is the amount of matter in an object (grams/kg). Volume is the amount of space it occupies (mL or cm³).' },
      { label: 'Density & Buoyancy', desc: 'How tightly packed matter is in a given volume. Objects less dense than water float; objects more dense than water sink.' },
      { label: 'Conductors vs. Insulators', desc: 'Metals (like copper and aluminum) conduct heat and electricity easily; rubber, wood, and plastic are insulators.' },
      { label: 'Solubility', desc: 'The ability of a solute (like sugar or salt) to dissolve evenly into a solvent (like water) to form a solution.' },
      { label: 'Chemical Properties', desc: 'Describe how a substance reacts to form a new substance, such as Flammability (ability to burn) and Reactivity (with acid or oxygen to form rust).' },
    ],
    tacticalNote: 'Observing a physical property never changes the identity of the matter; testing a chemical property produces a new substance.',
  },
  {
    id: 'g5_particles_states',
    stage: 'Grade 5',
    title: 'Inspire Unit 1: Particles & Changes in State',
    summary: 'McGraw Hill Inspire Science (Grade 5): All matter is made of microscopic particles too small to be seen. Adding or removing thermal energy changes particle speed and spacing.',
    keyConcepts: [
      { label: 'Solids', desc: 'Particles are tightly packed in a fixed arrangement and vibrate in place. Definite shape and definite volume.' },
      { label: 'Liquids', desc: 'Particles stay close together but slide past one another freely. Definite volume, but takes the shape of its container.' },
      { label: 'Gases', desc: 'Particles move rapidly in all directions and spread far apart to fill the entire shape and volume of any closed container.' },
      { label: 'Adding Thermal Energy', desc: 'Particles move faster and spread apart: Melting (solid → liquid at 0°C for ice) and Evaporation/Boiling (liquid → gas at 100°C for water).' },
      { label: 'Removing Thermal Energy', desc: 'Particles slow down and move closer together: Condensation (gas → liquid, like dew on a cold glass) and Freezing (liquid → solid).' },
    ],
    tacticalNote: 'All changes of state (melting, freezing, boiling, condensation) are PHYSICAL changes because H₂O remains H₂O.',
  },
  {
    id: 'g5_physical_chemical_change',
    stage: 'Grade 5',
    title: 'Inspire Unit 1: Physical & Chemical Changes',
    summary: 'McGraw Hill Inspire Science (Grade 5): Physical changes do not create new substances, while chemical reactions rearrange atoms into new substances. Matter is always conserved.',
    keyConcepts: [
      { label: 'Physical Change', desc: 'Changes size, shape, state, or mixes substances without forming a new substance (cutting paper, melting ice, dissolving salt in water).' },
      { label: 'Chemical Change (Reaction)', desc: 'Forms one or more brand-new substances with different properties (burning wood, rusting iron, baking a cake, vinegar + baking soda).' },
      { label: 'Signs of Chemical Change', desc: 'Unexpected color change, fizzing gas bubbles, formation of a solid precipitate, new odor, or release of heat/light.' },
      { label: 'Law of Conservation of Matter', desc: 'Matter is neither created nor destroyed during heating, cooling, dissolving, or chemical reactions in a closed system—total mass stays exactly the same!' },
    ],
    equation: '20g Salt + 100g Water = 120g Saltwater Solution (Mass is Conserved)',
    tacticalNote: 'To separate dissolved salt from water, evaporate the water so solid salt crystals are left behind.',
  },
  {
    id: 'g5_survival_plants',
    stage: 'Grade 5',
    title: 'Inspire Unit 2: Survival of Plants',
    summary: 'McGraw Hill Inspire Science (Grade 5): Plants acquire the matter they need to grow primarily from AIR and WATER (not soil), using sunlight energy to make sugar via photosynthesis.',
    keyConcepts: [
      { label: 'Where Plant Mass Comes From', desc: 'Plants build their stems, leaves, and roots chiefly from carbon dioxide (air) and water—proven by Van Helmont’s willow tree experiment and hydroponics!' },
      { label: 'Stomata', desc: 'Microscopic pores on the underside of leaves that open to take in CO₂ gas and release O₂ and water vapor (transpiration).' },
      { label: 'Xylem & Phloem', desc: 'Xylem tubes carry water and minerals UP from roots to leaves; Phloem tubes carry sugar food from leaves to the rest of the plant.' },
      { label: 'Hydroponics', desc: 'Growing plants in nutrient-rich water without soil, proving soil is only for anchorage and trace minerals.' },
    ],
    equation: 'Carbon Dioxide (from Air) + Water (from Roots) --(Sunlight)--> Sugar (Glucose) + Oxygen',
    tacticalNote: 'If a plant’s stomata are blocked, it cannot take in carbon dioxide to make food.',
  },
  {
    id: 'g5_matter_ecosystems',
    stage: 'Grade 5',
    title: 'Inspire Unit 2: Matter in Ecosystems',
    summary: 'McGraw Hill Inspire Science (Grade 5): Energy flows one way from the Sun through food webs, while matter is continuously recycled between producers, consumers, decomposers, and the environment.',
    keyConcepts: [
      { label: 'Energy Source & Producers', desc: 'The Sun is the primary energy source; producers (plants/algae) capture sunlight to make chemical food.' },
      { label: 'Consumers', desc: 'Herbivores eat only plants; Carnivores eat only animals; Omnivores eat both plants and animals.' },
      { label: 'Decomposers (Nature’s Recyclers)', desc: 'Fungi (mushrooms), bacteria, and earthworms break down dead organisms and waste, returning vital nutrients to soil and air.' },
      { label: 'Biotic vs. Abiotic Factors', desc: 'Biotic = living things (trees, animals, bacteria); Abiotic = nonliving parts (sunlight, water, air, soil, rocks, temperature).' },
      { label: 'Invasive Species', desc: 'Non-native organisms introduced to an ecosystem that spread rapidly and outcompete native species for resources.' },
    ],
    tacticalNote: 'Energy flows ONE WAY (Sun → organisms → heat), whereas Matter CYCLES over and over!',
  },
  {
    id: 'g5_earth_space_systems',
    stage: 'Grade 5',
    title: 'Inspire Unit 3 & 4: Earth & Space Systems',
    summary: 'McGraw Hill Inspire Science (Grade 5): Earth’s 4 spheres interact continuously; 97% of Earth’s water is saltwater; gravity pulls toward Earth’s center; rotation & orbit cause sky patterns.',
    keyConcepts: [
      { label: 'Earth’s 4 Major Spheres', desc: 'Geosphere (rock, soil, core), Hydrosphere (all water & ice), Atmosphere (78% N₂, 21% O₂, trace gases), and Biosphere (all living things).' },
      { label: 'Earth’s Water Distribution', desc: '97% is ocean salt water; only ~3% is fresh water (most fresh water—~69%—is frozen in glaciers and polar ice caps, ~30% is groundwater, <1% is surface rivers/lakes).' },
      { label: 'Weathering vs. Erosion', desc: 'Weathering breaks rock into sediment; Erosion moves sediment via wind, water, or ice; Rain Shadow Effect makes leeward mountain sides dry.' },
      { label: 'Gravity, Rotation & Orbit', desc: 'Gravity pulls toward Earth’s center. 24-hour rotation causes day/night and shadow changes (shortest at noon). 365-day orbit causes seasonal constellations.' },
      { label: 'Star Brightness', desc: 'The Sun appears much brighter and larger than other stars because it is vastly closer to Earth.' },
    ],
    tacticalNote: 'Sun thermal energy + Earth’s gravity drive the entire Water Cycle (evaporation, condensation, precipitation, runoff).',
  },
  {
    id: 'cells',
    stage: 'Stage 7',
    title: 'Cells & Cell Structures',
    summary: 'The cell is the basic structural and functional unit of all living organisms. Eukaryotic cells possess membrane-bound organelles.',
    keyConcepts: [
      { label: 'Nucleus', desc: 'Contains chromosomes (DNA) and controls all cellular biochemical activities.' },
      { label: 'Cytoplasm', desc: 'Jelly-like aqueous fluid containing dissolved enzymes and solutes where metabolic reactions occur.' },
      { label: 'Cell Membrane', desc: 'Selectively permeable barrier regulating the entry and exit of molecules.' },
      { label: 'Cell Wall (Plants Only)', desc: 'Rigid layer made of cellulose that provides structural support and prevents osmotic lysis.' },
      { label: 'Chloroplasts (Plants Only)', desc: 'Contain chlorophyll pigment to capture light energy for photosynthesis.' },
      { label: 'Vacuole (Large & Permanent in Plants)', desc: 'Contains cell sap, maintaining internal turgor pressure against the cell wall.' },
      { label: 'Mitochondria', desc: 'Site of aerobic respiration where glucose is broken down to release ATP energy.' },
    ],
    tacticalNote: 'Animal cells lack cell walls and chloroplasts. Plant cells have both plus a large central vacuole.',
  },
  {
    id: 'breathing',
    stage: 'Stage 7',
    title: 'Breathing System & Gas Exchange',
    summary: 'Ventilation moves air in and out of the thoracic cavity to replenish oxygen and expel carbon dioxide from alveolar surfaces.',
    keyConcepts: [
      { label: 'Inhalation Mechanics', desc: 'Diaphragm contracts and moves down; external intercostal muscles pull ribs up and out; volume increases, pressure falls below atmospheric, drawing air in.' },
      { label: 'Exhalation Mechanics', desc: 'Diaphragm relaxes and domes upward; ribs drop down and in; volume decreases, pressure rises, air forced out.' },
      { label: 'Alveoli Adaptations', desc: 'Enormous surface area, wall is one cell thick for minimal diffusion distance, moist lining dissolves gases, rich capillary network.' },
      { label: 'Limewater Test', desc: 'Turns milky/cloudy with white calcium carbonate precipitate when bubbled with CO2.' },
      { label: 'Tar & Cilia', desc: 'Tar paralyzes cilia in respiratory epithelium, blocking mucus clearance and causing smoker\'s cough.' },
    ],
    tacticalNote: 'Breathing is mechanical ventilation; Respiration is intracellular biochemical energy release.',
  },
  {
    id: 'respiration',
    stage: 'Stage 7',
    title: 'Respiration & Bio-energetics',
    summary: 'The chemical breakdown of nutrient molecules inside living cells to release energy for metabolic work.',
    keyConcepts: [
      { label: 'Aerobic Respiration', desc: 'Requires oxygen. Completely breaks down glucose into CO2 and H2O, yielding high energy (ATP).' },
      { label: 'Anaerobic in Humans', desc: 'Glucose -> Lactic acid (+ small energy). Occurs during vigorous exercise, creating oxygen debt.' },
      { label: 'Anaerobic in Yeast', desc: 'Glucose -> Ethanol + Carbon dioxide (+ small energy). Used in bread rising and brewing.' },
      { label: 'Oxygen Debt', desc: 'Extra oxygen needed during recovery to oxidize accumulated lactic acid in the liver back into harmless products.' },
    ],
    equation: 'Glucose + Oxygen → Carbon Dioxide + Water (+ Energy)',
    tacticalNote: 'All living plant and animal cells respire continuously 24 hours a day to sustain life.',
  },
  {
    id: 'diffusion',
    stage: 'Stage 7',
    title: 'Diffusion & Transport',
    summary: 'The passive net movement of particles from a region of higher concentration to a region of lower concentration down a concentration gradient.',
    keyConcepts: [
      { label: 'Concentration Gradient', desc: 'Difference in particle concentration between two areas; steeper gradient accelerates net rate.' },
      { label: 'Kinetic Motion', desc: 'Higher temperatures increase particle thermal kinetic energy, causing faster diffusion.' },
      { label: 'Osmosis', desc: 'Specialized diffusion of water molecules across a partially permeable membrane from high water potential to low water potential.' },
      { label: 'Lysis vs Turgidity', desc: 'Animal cells burst (lyse) in pure water. Plant cells become firm and turgid due to rigid cellulose walls.' },
    ],
    tacticalNote: 'Diffusion is 100% passive; no ATP energy is spent by the cell.',
  },
  {
    id: 'ecosystems',
    stage: 'Stage 7',
    title: 'Ecosystems & Food Webs',
    summary: 'Interactions between biotic organisms and abiotic physical factors in natural habitats.',
    keyConcepts: [
      { label: 'Producers', desc: 'Photosynthetic autotrophs (plants, phytoplankton) that make chemical food from solar energy.' },
      { label: 'Trophic Levels', desc: 'Feeding positions in a food chain: Producer → Primary Consumer → Secondary Consumer → Apex Predator.' },
      { label: '10% Energy Rule', desc: 'Only ~10% of energy transfers between levels; 90% is lost to metabolic respiration, heat, and waste.' },
      { label: 'Bioaccumulation', desc: 'Non-biodegradable toxins (DDT, heavy metals) concentrate at higher trophic levels, devastating apex predators.' },
    ],
    tacticalNote: 'Food chain arrows always point in the direction of energy and biomass flow.',
  },
  {
    id: 'pathogens_immune',
    stage: 'Stage 8',
    title: 'Microorganisms, Immunity & Circulation',
    summary: 'Host defense mechanisms and the cardiovascular system transporting immune effectors.',
    keyConcepts: [
      { label: 'Phagocytes', desc: 'White blood cells that engulf and digest pathogens through phagocytosis and lysosomal enzymes.' },
      { label: 'Lymphocytes', desc: 'Produce Y-shaped antibodies tailored to complementary pathogen surface antigens.' },
      { label: 'Antibiotics vs Viruses', desc: 'Antibiotics kill bacteria by destroying cell walls/ribosomes; viruses have no cell walls and are unaffected.' },
      { label: 'Double Circulation', desc: 'Pulmonary circuit (heart-lungs-heart) and Systemic circuit (heart-body-heart).' },
      { label: 'Arteries vs Veins', desc: 'Arteries have thick elastic muscular walls for high pressure; veins have thin walls and valves to prevent backflow.' },
    ],
    tacticalNote: 'Platelets release clotting factors to convert soluble fibrinogen into an insoluble fibrin mesh scab.',
  },
  {
    id: 'photosynthesis',
    stage: 'Stage 8',
    title: 'Photosynthesis & Leaf Anatomy',
    summary: 'Synthesis of organic carbohydrates using light energy captured by chloroplasts.',
    keyConcepts: [
      { label: 'Balanced Reaction', desc: 'Carbon dioxide + Water → Glucose + Oxygen.' },
      { label: 'Palisade Mesophyll', desc: 'Packed columnar cells below upper epidermis containing maximum chloroplasts.' },
      { label: 'Stomata & Guard Cells', desc: 'Pores on leaf undersides regulating gas exchange (CO2 uptake, O2 release) and transpiration.' },
      { label: 'Starch Storage Test', desc: 'Iodine reagent turns blue-black in the presence of stored insoluble starch.' },
      { label: 'Xylem & Phloem', desc: 'Xylem transports water/minerals up; Phloem translocates sucrose and amino acids bidirectionally.' },
    ],
    equation: 'Carbon Dioxide + Water --(Light & Chlorophyll)--> Glucose + Oxygen',
    tacticalNote: 'Plants store carbohydrates as insoluble starch to avoid disrupting cellular osmotic water potential.',
  },
  {
    id: 'digestion',
    stage: 'Stage 8',
    title: 'Human Digestion & Enzymes',
    summary: 'Chemical and mechanical breakdown of large insoluble polymers into small soluble molecules.',
    keyConcepts: [
      { label: 'Amylase (Carbohydrase)', desc: 'Hydrolyses starch into simple maltose sugars in mouth and small intestine.' },
      { label: 'Protease (Pepsin & Trypsin)', desc: 'Breaks down protein polymers into amino acid monomers for growth and repair.' },
      { label: 'Lipase', desc: 'Breaks down fats (lipids) into fatty acids and glycerol.' },
      { label: 'Stomach Acid (HCl)', desc: 'Kills swallowed bacteria and provides optimal acidic pH (~2) for pepsin protease.' },
      { label: 'Bile Function', desc: 'Produced in liver, stored in gallbladder; neutralizes stomach acid and emulsifies fat droplets.' },
      { label: 'Villi & Microvilli', desc: 'Enormous surface area with central lacteals absorbing fatty acids and capillaries absorbing glucose.' },
    ],
    tacticalNote: 'Extreme temperatures above 45°C denature enzyme active sites permanently.',
  },
];

export const IntelArchive: React.FC<IntelArchiveProps> = ({ onClose }) => {
  const [selectedTopicId, setSelectedTopicId] = useState<string>('cells');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const activeTopic = CAMBRIDGE_TOPICS.find((t) => t.id === selectedTopicId) || CAMBRIDGE_TOPICS[0];

  const filteredTopics = CAMBRIDGE_TOPICS.filter((t) =>
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.stage.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-2 sm:p-5">
      <div className="relative w-full max-w-4xl h-[92vh] bg-slate-950 border border-slate-700 rounded-lg shadow-2xl flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-3 sm:p-4 bg-slate-900/60">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base sm:text-lg font-display font-bold text-white tracking-wider uppercase">
              CAMBRIDGE CHECKPOINT SCIENCE DOSSIER (STAGE 7 & 8)
            </h2>
          </div>
          <button
            onClick={() => {
              sounds.playRadioChirp();
              onClose();
            }}
            className="p-1 rounded bg-slate-800 border border-slate-700 hover:border-slate-500 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar & Split View */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          
          {/* Left Sidebar: Topics List */}
          <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col bg-slate-950/80">
            <div className="p-3 border-b border-slate-800">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 transform -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter curriculum..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded bg-slate-900 border border-slate-800 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-2 space-y-1.5">
              {filteredTopics.map((topic) => {
                const isSelected = topic.id === selectedTopicId;
                return (
                  <button
                    key={topic.id}
                    onClick={() => {
                      sounds.playRadioChirp();
                      setSelectedTopicId(topic.id);
                    }}
                    className={`w-full text-left p-2.5 rounded text-xs font-display transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-950/80 border border-cyan-500 text-cyan-200 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                        : 'bg-slate-900/40 border border-slate-800/60 hover:border-slate-700 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                      <span>{topic.stage}</span>
                    </div>
                    <div className="font-bold text-slate-200 mt-0.5">{topic.title}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Topic Dossier View */}
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-slate-900/30">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300">
                  {activeTopic.stage} CHECKPOINT SYLLABUS
                </span>
                <h3 className="text-xl sm:text-2xl font-display font-bold text-white mt-1">
                  {activeTopic.title}
                </h3>
              </div>
            </div>

            <p className="text-sm font-tactical text-slate-300 mb-6 leading-relaxed">
              {activeTopic.summary}
            </p>

            {activeTopic.equation && (
              <div className="my-4 p-3.5 rounded bg-amber-950/30 border border-amber-600/60 text-amber-300 font-mono text-xs sm:text-sm">
                <span className="font-bold text-amber-400 block mb-1">CHEMICAL EQUATION FORMULA:</span>
                {activeTopic.equation}
              </div>
            )}

            {/* Key Concepts Breakdown */}
            <div className="space-y-3 mb-6">
              <h4 className="text-xs font-mono uppercase tracking-widest text-slate-400">
                CORE SYLLABUS CONCEPTS & DEFINITIONS
              </h4>
              <div className="grid grid-cols-1 gap-2.5">
                {activeTopic.keyConcepts.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded bg-slate-900/60 border border-slate-800/80 text-xs font-mono"
                  >
                    <strong className="text-cyan-400 block mb-0.5 text-sm font-display">
                      {item.label}
                    </strong>
                    <span className="text-slate-300 leading-normal">{item.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tactical Exam Tip */}
            <div className="p-3.5 rounded bg-emerald-950/30 border border-emerald-600/50 text-emerald-300 text-xs font-mono">
              <strong className="text-emerald-400 block mb-0.5 font-display">
                TACTICAL CHECKPOINT EXAM NOTE:
              </strong>
              {activeTopic.tacticalNote}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
