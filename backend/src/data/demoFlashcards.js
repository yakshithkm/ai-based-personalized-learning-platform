/**
 * Demo Flashcards content for the demo accounts (see scripts/seedDemoFlashcards.js).
 *
 * The decks below are hand-written, standard textbook facts. They are NOT presented as AI-generated
 * (decks are seeded with source "manual"). Seeding goes through the real flashcardService, so the
 * tier deck cap, validation, spaced-repetition scheduling and study history behave exactly as they do
 * for a real student.
 *
 * Text is plain (no Markdown/LaTeX) and kept inside the card limits (front <= 200, back <= 400).
 */

const DEMO_DECKS = {
  'bio-cell': {
    subject: 'Biology',
    title: 'Cell Biology Essentials',
    topic: 'Cell: The Unit of Life',
    difficulty: 'beginner',
    cardStyle: 'qa',
    description: 'Core facts about cell theory and cell organelles.',
    cards: [
      { front: 'Who proposed the cell theory, and who added that new cells arise from pre-existing cells?', back: 'Schleiden and Schwann proposed that all plants and animals are made of cells. Virchow added that new cells arise from pre-existing cells (omnis cellula-e cellula).' },
      { front: 'Which organelle is called the powerhouse of the cell, and why?', back: 'The mitochondrion. It produces most of the cell’s ATP through aerobic respiration (oxidative phosphorylation).' },
      { front: 'Which organelle is called the suicide bag of the cell?', back: 'The lysosome, because its hydrolytic enzymes can digest the cell’s own contents if the membrane ruptures.' },
      { front: 'What is the function of ribosomes, and what are the ribosome sizes in prokaryotes and eukaryotes?', back: 'Ribosomes carry out protein synthesis (translation). Prokaryotic ribosomes are 70S and eukaryotic ribosomes are 80S.' },
      { front: 'How do rough ER and smooth ER differ?', back: 'Rough ER has ribosomes on its surface and is involved in protein synthesis and secretion. Smooth ER has no ribosomes and is involved in lipid synthesis and detoxification.' },
      { front: 'Which substance is the main component of the plant cell wall?', back: 'Cellulose.' },
      { front: 'What does the fluid mosaic model describe?', back: 'Singer and Nicolson’s model of the plasma membrane: a fluid lipid bilayer with proteins embedded in or attached to it, able to move sideways within the layer.' },
      { front: 'Which cell organelles contain their own DNA?', back: 'Mitochondria and chloroplasts. They also have their own 70S ribosomes.' },
    ],
  },

  'bio-genetics': {
    subject: 'Biology',
    title: 'Molecular Basis of Inheritance',
    topic: 'Molecular Basis of Inheritance',
    difficulty: 'intermediate',
    cardStyle: 'qa',
    description: 'DNA as genetic material, replication, transcription and the genetic code.',
    cards: [
      { front: 'Who showed that DNA is the genetic material in bacteriophages, and how?', back: 'Hershey and Chase (1952). They labelled phage DNA with radioactive phosphorus (32P) and protein with radioactive sulphur (35S); only the DNA entered the bacterial cells.' },
      { front: 'What does Chargaff’s rule state?', back: 'In double-stranded DNA the amount of adenine equals thymine and guanine equals cytosine (A = T, G = C), so purines equal pyrimidines.' },
      { front: 'How many hydrogen bonds join the A–T and G–C base pairs?', back: 'A–T has two hydrogen bonds; G–C has three.' },
      { front: 'What is semi-conservative DNA replication, and who proved it?', back: 'Each daughter DNA molecule has one parental strand and one newly made strand. Meselson and Stahl proved it in E. coli using the heavy nitrogen isotope 15N.' },
      { front: 'Which enzyme synthesises mRNA from a DNA template?', back: 'RNA polymerase, during transcription.' },
      { front: 'Name the three stop codons.', back: 'UAA, UAG and UGA. They do not code for any amino acid.' },
      { front: 'Which codon is the start codon, and which amino acid does it code for?', back: 'AUG. It codes for methionine and marks the start of translation.' },
      { front: 'The lac operon is an example of what kind of regulation, and who proposed it?', back: 'An inducible (negative) operon in E. coli, switched on when lactose (allolactose) is present. It was proposed by Jacob and Monod.' },
    ],
  },

  'chem-bonding': {
    subject: 'Chemistry',
    title: 'Chemical Bonding Basics',
    topic: 'Chemical Bonding and Molecular Structure',
    difficulty: 'intermediate',
    cardStyle: 'conceptual',
    description: 'Octet rule, molecular shapes, hybridisation and bond order.',
    cards: [
      { front: 'What does the octet rule state?', back: 'Atoms tend to gain, lose or share electrons until they have eight electrons in their valence shell, like a noble gas. Hydrogen, lithium, beryllium and boron are common exceptions.' },
      { front: 'Which type of bond forms by the complete transfer of electrons?', back: 'An ionic (electrovalent) bond.' },
      { front: 'What are the shape and bond angle of methane (CH4)?', back: 'Tetrahedral, with a bond angle of 109.5 degrees (sp3 hybridisation).' },
      { front: 'Why is the H–N–H angle in NH3 (about 107 degrees) smaller than 109.5 degrees?', back: 'The lone pair repels the bond pairs more strongly than bond pairs repel each other, which squeezes the bond angle. The shape is trigonal pyramidal.' },
      { front: 'What is the hybridisation of carbon in ethene (C2H4)?', back: 'sp2: trigonal planar with 120 degree angles, and one pi bond between the two carbons.' },
      { front: 'Define bond order and how it relates to bond strength.', back: 'Bond order = (bonding electrons − antibonding electrons) / 2. A higher bond order means a shorter, stronger bond.' },
      { front: 'Which is paramagnetic, O2 or N2, and why?', back: 'O2. Molecular orbital theory puts two unpaired electrons in its pi* antibonding orbitals. N2 has no unpaired electrons, so it is diamagnetic.' },
      { front: 'Why does hydrogen bonding make water boil at a higher temperature than H2S?', back: 'Water molecules form strong intermolecular hydrogen bonds (H bonded to very electronegative O). Extra energy is needed to break them, so the boiling point is higher.' },
    ],
  },

  'chem-mole': {
    subject: 'Chemistry',
    title: 'Mole Concept and Stoichiometry',
    topic: 'Some Basic Concepts of Chemistry',
    difficulty: 'beginner',
    cardStyle: 'qa',
    description: 'Moles, molar volume, concentration terms and yield.',
    cards: [
      { front: 'Define one mole.', back: 'The amount of substance that contains 6.022 × 10^23 elementary entities (Avogadro’s number).' },
      { front: 'What is the molar mass of water?', back: 'About 18 g/mol (2 × 1 for hydrogen plus 16 for oxygen).' },
      { front: 'What volume does one mole of an ideal gas occupy at STP (0 °C and 1 atm)?', back: '22.4 litres. (At 0 °C and 1 bar it is about 22.7 litres.)' },
      { front: 'What is the difference between an empirical formula and a molecular formula?', back: 'The empirical formula is the simplest whole-number ratio of atoms. The molecular formula gives the actual number of atoms and equals n times the empirical formula.' },
      { front: 'What is a limiting reagent?', back: 'The reactant that is completely used up first, so it limits the amount of product formed.' },
      { front: 'Write the formula for molarity.', back: 'Molarity = moles of solute / volume of solution in litres (mol/L). It changes with temperature because volume changes.' },
      { front: 'How does molality differ from molarity?', back: 'Molality is moles of solute per kilogram of solvent. It does not change with temperature, whereas molarity does.' },
      { front: 'Write the formula for percentage yield.', back: 'Percentage yield = (actual yield / theoretical yield) × 100.' },
    ],
  },

  'phy-motion': {
    subject: 'Physics',
    title: 'Kinematics and Laws of Motion',
    topic: 'Laws of Motion',
    difficulty: 'beginner',
    cardStyle: 'qa',
    description: 'Equations of motion, Newton’s laws and projectile motion.',
    cards: [
      { front: 'Write the first equation of motion for uniform acceleration.', back: 'v = u + at, where u is initial velocity, v is final velocity, a is acceleration and t is time.' },
      { front: 'Write the second equation of motion.', back: 's = ut + (1/2)at^2, which gives the displacement s after time t.' },
      { front: 'Write the third equation of motion.', back: 'v^2 = u^2 + 2as, which links velocity and displacement without time.' },
      { front: 'State Newton’s first law of motion.', back: 'A body stays at rest or in uniform motion along a straight line unless a net external force acts on it (law of inertia).' },
      { front: 'State Newton’s second law of motion.', back: 'The net force on a body equals the rate of change of its momentum: F = dp/dt, which becomes F = ma for constant mass.' },
      { front: 'State Newton’s third law of motion.', back: 'For every action there is an equal and opposite reaction. The two forces act on different bodies.' },
      { front: 'Define the newton, the SI unit of force.', back: 'One newton is the force that gives a mass of 1 kg an acceleration of 1 m/s^2.' },
      { front: 'Give the formulas for the maximum height and range of a projectile launched at angle θ with speed u.', back: 'Maximum height H = u^2 sin^2θ / (2g). Range R = u^2 sin 2θ / g, which is greatest at θ = 45 degrees.' },
    ],
  },

  'phy-electro': {
    subject: 'Physics',
    title: 'Current Electricity Formulas',
    topic: 'Current Electricity',
    difficulty: 'intermediate',
    cardStyle: 'definitions',
    description: 'Ohm’s law, resistor combinations, Kirchhoff’s laws and power.',
    cards: [
      { front: 'State Ohm’s law.', back: 'For a conductor at constant temperature, the current is proportional to the potential difference across it: V = IR.' },
      { front: 'Write the relation between resistance, resistivity, length and area.', back: 'R = ρL / A, where ρ is the resistivity of the material, L the length and A the cross-sectional area.' },
      { front: 'What is the equivalent resistance of resistors in series?', back: 'R = R1 + R2 + R3 + ... The same current flows through each resistor.' },
      { front: 'What is the equivalent resistance of resistors in parallel?', back: '1/R = 1/R1 + 1/R2 + 1/R3 + ... The same potential difference is across each resistor.' },
      { front: 'State Kirchhoff’s current law (junction rule).', back: 'The algebraic sum of the currents meeting at a junction is zero. It expresses conservation of charge.' },
      { front: 'State Kirchhoff’s voltage law (loop rule).', back: 'The algebraic sum of the potential differences around any closed loop is zero. It expresses conservation of energy.' },
      { front: 'Give three expressions for electrical power.', back: 'P = VI = I^2 R = V^2 / R.' },
      { front: 'What is the balance condition of a Wheatstone bridge?', back: 'P/Q = R/S. When it holds, no current flows through the galvanometer.' },
    ],
  },

  'math-trig': {
    subject: 'Mathematics',
    title: 'Trigonometric Identities',
    topic: 'Trigonometric Functions',
    difficulty: 'beginner',
    cardStyle: 'definitions',
    description: 'The identities you need for most trigonometry questions.',
    cards: [
      { front: 'Write the basic Pythagorean identity.', back: 'sin^2θ + cos^2θ = 1.' },
      { front: 'Write the two other Pythagorean identities.', back: '1 + tan^2θ = sec^2θ and 1 + cot^2θ = cosec^2θ.' },
      { front: 'Write the double-angle formula for sine.', back: 'sin 2θ = 2 sinθ cosθ.' },
      { front: 'Write the three forms of cos 2θ.', back: 'cos 2θ = cos^2θ − sin^2θ = 2cos^2θ − 1 = 1 − 2sin^2θ.' },
      { front: 'Write the formula for sin(A + B).', back: 'sin(A + B) = sinA cosB + cosA sinB.' },
      { front: 'Write the formula for cos(A + B).', back: 'cos(A + B) = cosA cosB − sinA sinB.' },
      { front: 'Write the formula for tan(A + B).', back: 'tan(A + B) = (tanA + tanB) / (1 − tanA tanB).' },
      { front: 'What are the values of sin 30°, cos 60° and tan 45°?', back: 'sin 30° = 1/2, cos 60° = 1/2 and tan 45° = 1.' },
    ],
  },

  'math-calculus': {
    subject: 'Mathematics',
    title: 'Differentiation and Integration Rules',
    topic: 'Calculus',
    difficulty: 'intermediate',
    cardStyle: 'definitions',
    description: 'The standard derivative and integral rules.',
    cards: [
      { front: 'What is the derivative of x^n?', back: 'd/dx (x^n) = n x^(n−1).' },
      { front: 'What are the derivatives of sin x and cos x?', back: 'd/dx (sin x) = cos x and d/dx (cos x) = −sin x.' },
      { front: 'State the product rule.', back: 'd(uv)/dx = u (dv/dx) + v (du/dx).' },
      { front: 'State the chain rule.', back: 'If y = f(u) and u = g(x), then dy/dx = (dy/du) × (du/dx).' },
      { front: 'What is the integral of x^n for n not equal to −1?', back: '∫ x^n dx = x^(n+1) / (n + 1) + C.' },
      { front: 'What is the integral of 1/x?', back: '∫ (1/x) dx = ln|x| + C.' },
      { front: 'State the formula for integration by parts.', back: '∫ u dv = uv − ∫ v du. The mnemonic ILATE helps choose u (Inverse, Log, Algebraic, Trigonometric, Exponential).' },
      { front: 'What are the derivative and the integral of e^x?', back: 'd/dx (e^x) = e^x and ∫ e^x dx = e^x + C.' },
    ],
  },
};

/**
 * Which decks each demo account gets, and the study history to build for them.
 * `sessions` are study runs through the real session service: `daysAgo` (>= 1) places the session
 * in the past, `mode` defaults to "all" for a deck's first run and "due" afterwards, and `partial`
 * (0-1) ends the run early so the history includes a session finished before every card was rated.
 * A deck with no sessions stays unstudied (shows "Not studied yet" and all-new cards).
 *
 * The three tier demos get the same five decks, which is exactly the Free plan's deck limit: the
 * Free demo opens at its cap (creating a sixth shows the upgrade prompt) while Pro and Premium
 * can keep adding decks.
 */
const TIER_DEMO_PLAN = [
  { deck: 'math-trig', sessions: [{ daysAgo: 13 }, { daysAgo: 6 }, { daysAgo: 2 }] },
  { deck: 'math-calculus', sessions: [{ daysAgo: 10 }, { daysAgo: 3 }] },
  { deck: 'phy-motion', sessions: [{ daysAgo: 8, partial: 0.6 }, { daysAgo: 1 }] },
  { deck: 'phy-electro', sessions: [{ daysAgo: 4 }] },
  { deck: 'chem-mole', sessions: [], createdDaysAgo: 3 },
];

const DEMO_FLASHCARD_PLANS = {
  neet: [
    { deck: 'bio-cell', sessions: [{ daysAgo: 15 }, { daysAgo: 7 }, { daysAgo: 2 }] },
    { deck: 'bio-genetics', sessions: [{ daysAgo: 11 }, { daysAgo: 3 }] },
    { deck: 'chem-bonding', sessions: [{ daysAgo: 5, partial: 0.5 }] },
    { deck: 'phy-motion', sessions: [], createdDaysAgo: 2 },
  ],
  cet: [
    { deck: 'math-trig', sessions: [{ daysAgo: 14 }, { daysAgo: 6 }, { daysAgo: 1 }] },
    { deck: 'math-calculus', sessions: [{ daysAgo: 9 }, { daysAgo: 2 }] },
    { deck: 'phy-motion', sessions: [{ daysAgo: 5 }] },
    { deck: 'chem-bonding', sessions: [{ daysAgo: 4, partial: 0.5 }] },
    { deck: 'bio-cell', sessions: [], createdDaysAgo: 2 },
  ],
  jee: [
    { deck: 'math-calculus', sessions: [{ daysAgo: 12 }, { daysAgo: 5 }, { daysAgo: 1 }] },
    { deck: 'math-trig', sessions: [{ daysAgo: 8 }, { daysAgo: 2 }] },
    { deck: 'phy-electro', sessions: [{ daysAgo: 6, partial: 0.6 }] },
    { deck: 'chem-mole', sessions: [], createdDaysAgo: 2 },
  ],
  'free-demo': TIER_DEMO_PLAN,
  'pro-demo': TIER_DEMO_PLAN,
  'premium-demo': TIER_DEMO_PLAN,
};

module.exports = { DEMO_DECKS, DEMO_FLASHCARD_PLANS };