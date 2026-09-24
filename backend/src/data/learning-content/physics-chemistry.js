// Curated internal TutorMind study material (no external links). Topic names match the
// question bank exactly so the recommendation engine can join content to student data.
module.exports = [
  // ---------------------------------------------------------------- Physics: Current Electricity
  {
    subject: 'Physics', topic: 'Current Electricity',
    title: 'Current Electricity: Core Concepts', contentType: 'concept', difficulty: 'Easy', estimatedMinutes: 8,
    description: 'Current, potential difference, resistance, Ohm\'s law, power and combining resistors.',
    learningObjectives: ['Define current, potential difference and resistance', 'Apply V = IR and P = VI', 'Combine resistors in series and parallel'],
    tags: ['ohms-law', 'resistance', 'power'],
    body: `## What is electric current?
Electric current is the rate of flow of charge: I = Q / t. Its SI unit is the ampere (1 A = 1 C per second). Conventional current flows from the positive to the negative terminal, opposite to the drift of electrons.

## Key ideas
- **Potential difference (V)** is the work done per unit charge between two points, measured in volts.
- **Resistance (R)** measures how strongly a conductor opposes current: R = V / I, measured in ohms.
- **Ohm's law**: for an ohmic conductor at constant temperature, V is proportional to I, so V = IR.
- **Resistivity**: R = ρL / A. Resistance grows with length and shrinks with cross-section area; ρ depends on the material and temperature.
- **Power**: P = VI = I²R = V²/R. Energy in kWh = power in kW × time in hours.

## Series and parallel
- Series: the same current flows through every resistor, and R_total = R1 + R2 + R3.
- Parallel: the same voltage is across every resistor, and 1/R_total = 1/R1 + 1/R2 + 1/R3.

## Common mistakes
- Adding parallel resistances directly instead of adding their reciprocals.
- Forgetting that a real cell has internal resistance r, so its terminal voltage is V = E - Ir.`,
  },
  {
    subject: 'Physics', topic: 'Current Electricity', concept: 'Ohm\'s Law',
    title: 'Ohm\'s Law, Resistivity and Drift Velocity', contentType: 'notes', difficulty: 'Medium', estimatedMinutes: 10,
    description: 'Microscopic view of current: drift velocity, relaxation time, resistivity and temperature dependence.',
    learningObjectives: ['Use v_d = I / (n e A)', 'Explain why resistivity changes with temperature', 'Recognise non-ohmic behaviour'],
    tags: ['drift-velocity', 'resistivity'],
    body: `## Drift velocity
Free electrons move randomly, but an electric field adds a small average velocity called the drift velocity: v_d = I / (n e A), where n is the free-electron density, e the electron charge and A the cross-section area. It is typically of the order of 10⁻⁴ m/s, even though the electric signal travels almost at the speed of light.

## Relaxation time and resistivity
- The average time between collisions is the relaxation time τ, and v_d = (eE / m) τ.
- Resistivity is ρ = m / (n e² τ), so it depends only on the material and its temperature, not on the shape of the wire.

## Temperature dependence
- In metals, resistivity increases with temperature because collisions become more frequent.
- In semiconductors, resistivity decreases with temperature because more charge carriers become available.

## Non-ohmic conductors
A diode, a filament lamp and a thermistor do not follow V = IR with a constant R, so their V-I graphs are not straight lines through the origin.

## Cells
n identical cells in series give EMF nE and internal resistance nr. n identical cells in parallel give EMF E and internal resistance r/n.`,
  },
  {
    subject: 'Physics', topic: 'Current Electricity', concept: 'Kirchhoff\'s Laws',
    title: 'Kirchhoff\'s Laws: Rules and Worked Examples', contentType: 'example', difficulty: 'Medium', estimatedMinutes: 9,
    description: 'The junction and loop rules with sign conventions and two fully worked circuits.',
    learningObjectives: ['State the junction and loop rules', 'Apply sign conventions correctly', 'Solve a loop with two cells'],
    tags: ['kirchhoff', 'circuits', 'worked-example'],
    body: `## The two rules
- **Junction rule**: the total current entering a junction equals the total current leaving it. This is conservation of charge.
- **Loop rule**: the algebraic sum of potential changes around any closed loop is zero. This is conservation of energy.

## Sign convention for the loop rule
- Crossing a resistor in the direction of the current: -IR. Against the current: +IR.
- Crossing a cell from its negative to its positive terminal: +E. From positive to negative: -E.

## Worked example 1: junction
Currents of 3 A and 2 A enter a junction and one wire leaves it. The leaving current is 3 + 2 = 5 A.

## Worked example 2: loop with two cells
A 12 V cell and a 4 V cell are connected in series-opposition in one loop with a total resistance of 4 Ω. Take the current I in the direction of the 12 V cell.
- Loop rule: +12 - 4 - I(4) = 0
- So 4I = 8 and I = 2 A.
Check: net EMF is 12 - 4 = 8 V and 8 V / 4 Ω = 2 A.

## Exam tip
Choose a current direction for every branch first. If you get a negative answer, the real current flows the other way, which is not an error.`,
  },
  {
    subject: 'Physics', topic: 'Current Electricity',
    title: 'Current Electricity: Exam Formula Sheet', contentType: 'formula-sheet', difficulty: 'Medium', estimatedMinutes: 5,
    description: 'One-page revision of every formula you need for Current Electricity questions.',
    learningObjectives: ['Recall the standard formulas quickly'],
    tags: ['formula-sheet', 'revision'],
    body: `## Formula sheet
- Current: I = Q / t and I = n e A v_d
- Ohm's law: V = IR
- Resistivity: R = ρL / A
- Temperature: R_T = R_0 (1 + αΔT)
- Series: R = R1 + R2 + ...
- Parallel: 1/R = 1/R1 + 1/R2 + ...
- Power: P = VI = I²R = V²/R
- Cell: terminal voltage V = E - Ir (discharging) and V = E + Ir (charging)
- Maximum power transfer: external R = r, giving P_max = E² / 4r
- Balanced Wheatstone bridge: P/Q = R/S
- Energy: 1 kWh = 3.6 × 10⁶ J`,
  },
  {
    subject: 'Physics', topic: 'Current Electricity',
    title: 'Advanced Circuits: Bridges and the Potentiometer', contentType: 'article', difficulty: 'Hard', estimatedMinutes: 12,
    description: 'Wheatstone bridge, meter bridge and potentiometer applications for exam-level problems.',
    learningObjectives: ['Use the balance condition of a bridge', 'Compare EMFs with a potentiometer', 'Find internal resistance from balancing lengths'],
    tags: ['wheatstone', 'meter-bridge', 'potentiometer', 'advanced'],
    body: `## Wheatstone bridge
When the bridge is balanced no current flows through the galvanometer and P/Q = R/S. You can then remove the galvanometer branch and treat the two arms as simple series-parallel combinations.

## Meter bridge
If the unknown resistance X is in the left gap, the known resistance R is in the right gap and the balance point is at length l from the left end, then X = R l / (100 - l).

## Potentiometer
- A uniform wire carrying a steady current has a constant potential gradient k = V / L.
- Comparing two EMFs: E1 / E2 = l1 / l2, the ratio of balancing lengths.
- Internal resistance: if l1 is the balancing length for the open-circuit cell and l2 is the length when a resistance R is connected across it, then r = R (l1 - l2) / l2.
- At balance the potentiometer draws no current from the cell, so it measures the true EMF, unlike a voltmeter.

## Strategy
Redraw a complicated circuit by marking equal-potential points, then simplify step by step before writing any equations.`,
  },

  // ---------------------------------------------------------------- Physics: Motion in a Straight Line
  {
    subject: 'Physics', topic: 'Motion in a Straight Line',
    title: 'Motion in a Straight Line: Core Concepts', contentType: 'concept', difficulty: 'Easy', estimatedMinutes: 8,
    description: 'Position, displacement, speed, velocity and acceleration for one-dimensional motion.',
    learningObjectives: ['Distinguish distance from displacement', 'Distinguish speed from velocity', 'Define average and instantaneous quantities'],
    tags: ['kinematics', 'velocity', 'acceleration'],
    body: `## Describing motion in one dimension
- **Distance** is the total path length and is never negative. **Displacement** is the change in position, with sign and direction.
- **Average speed** = total distance / total time. **Average velocity** = displacement / total time.
- **Instantaneous velocity** is the rate of change of position at an instant: v = dx/dt.
- **Acceleration** is the rate of change of velocity: a = dv/dt. Negative acceleration does not always mean slowing down: it depends on the direction of velocity.

## Sign convention
Pick a positive direction and keep to it. Velocity and acceleration in the opposite direction are negative.

## Uniform motion
If velocity is constant, acceleration is zero and displacement is v × t.

## Common mistakes
- Using distance where displacement is needed, especially when the body turns back.
- Assuming that a body with zero velocity has zero acceleration. At the top of a vertical throw, v = 0 but a = g downward.`,
  },
  {
    subject: 'Physics', topic: 'Motion in a Straight Line',
    title: 'Equations of Uniform Acceleration: Worked Examples', contentType: 'example', difficulty: 'Medium', estimatedMinutes: 10,
    description: 'The three kinematic equations and free fall applied to typical exam problems.',
    learningObjectives: ['Choose the right kinematic equation', 'Handle braking and free-fall problems'],
    tags: ['kinematics', 'worked-example', 'free-fall'],
    body: `## The equations (constant acceleration)
- v = u + at
- s = ut + ½at²
- v² = u² + 2as
- Distance in the nth second: s_n = u + a(2n - 1)/2

## Example 1: starting from rest
A car starts from rest with a = 2 m/s² for 10 s.
- v = 0 + 2 × 10 = 20 m/s
- s = ½ × 2 × 10² = 100 m

## Example 2: braking
A car at 20 m/s brakes with a deceleration of 5 m/s².
- Stopping distance: v² = u² + 2as gives 0 = 400 - 10s, so s = 40 m.
- Stopping time: 0 = 20 - 5t gives t = 4 s.

## Example 3: free fall (g = 10 m/s²)
A stone is dropped from a height of 80 m.
- Time: 80 = ½ × 10 × t² gives t = 4 s.
- Speed on landing: v = gt = 40 m/s.

## Method
1. Write down u, v, a, s, t and mark the unknown.
2. Pick the equation that does not contain the quantity you neither know nor need.
3. Apply signs consistently.`,
  },
  {
    subject: 'Physics', topic: 'Motion in a Straight Line',
    title: 'Motion Graphs: Reading Slopes and Areas', contentType: 'notes', difficulty: 'Medium', estimatedMinutes: 9,
    description: 'How to read position-time, velocity-time and acceleration-time graphs.',
    learningObjectives: ['Use slope to get velocity and acceleration', 'Use area under a v-t graph to get displacement'],
    tags: ['graphs', 'kinematics'],
    body: `## Position-time (x-t) graph
- The slope at a point is the instantaneous velocity.
- A straight line means constant velocity. A curve means changing velocity.
- A horizontal line means the body is at rest.

## Velocity-time (v-t) graph
- The slope is the acceleration.
- The area between the graph and the time axis is the displacement. Area below the axis counts as negative displacement.
- Total distance is the sum of the magnitudes of all areas.

## Acceleration-time (a-t) graph
The area under the graph is the change in velocity.

## Quick checks
- A straight v-t line means uniform acceleration.
- If the v-t graph crosses the time axis, the body reverses its direction at that instant.
- Two graphs that intersect on an x-t plot mean the two bodies are at the same place at that time, not that their velocities are equal.`,
  },
  {
    subject: 'Physics', topic: 'Motion in a Straight Line',
    title: 'Kinematics Formula Sheet', contentType: 'formula-sheet', difficulty: 'Easy', estimatedMinutes: 4,
    description: 'Quick revision sheet for one-dimensional kinematics.',
    learningObjectives: ['Recall the kinematic equations'],
    tags: ['formula-sheet', 'revision'],
    body: `## Formula sheet
- Average velocity = displacement / time
- v = u + at
- s = ut + ½at²
- v² = u² + 2as
- Free fall: v = gt, h = ½gt², v² = 2gh
- Maximum height of an upward throw: u² / 2g and time of flight 2u / g
- Relative velocity in one dimension: v_AB = v_A - v_B`,
  },

  // ---------------------------------------------------------------- Chemistry: Solutions
  {
    subject: 'Chemistry', topic: 'Solutions',
    title: 'Solutions: Concentration Terms', contentType: 'concept', difficulty: 'Easy', estimatedMinutes: 8,
    description: 'Molarity, molality, mole fraction, mass percent and ppm, with the differences that matter in exams.',
    learningObjectives: ['Calculate molarity, molality and mole fraction', 'Know which units change with temperature'],
    tags: ['molarity', 'molality', 'mole-fraction'],
    body: `## Ways to express concentration
- **Mass percent** = (mass of solute / mass of solution) × 100.
- **Mole fraction** x_A = moles of A / total moles. The mole fractions of all components add up to 1.
- **Molarity (M)** = moles of solute / litres of solution.
- **Molality (m)** = moles of solute / kilograms of solvent.
- **ppm** = (parts of solute / parts of solution) × 10⁶.

## Which ones change with temperature?
Molarity depends on the volume of solution, which changes with temperature. Molality, mole fraction and mass percent depend only on masses or moles, so they do not change.

## Quick example
4 g of NaOH (molar mass 40 g/mol) is dissolved to make 500 mL of solution.
- Moles = 4 / 40 = 0.1 mol
- Molarity = 0.1 / 0.5 = 0.2 M

## Common mistakes
- Dividing by the volume of the solvent instead of the volume of the solution for molarity.
- Using grams of solvent instead of kilograms for molality.`,
  },
  {
    subject: 'Chemistry', topic: 'Solutions',
    title: 'Raoult\'s Law and Colligative Properties', contentType: 'notes', difficulty: 'Medium', estimatedMinutes: 10,
    description: 'Vapour pressure, ideal and non-ideal solutions, and the four colligative properties.',
    learningObjectives: ['Apply Raoult\'s law', 'Explain positive and negative deviation', 'Use ΔT = K·m and π = CRT'],
    tags: ['raoult', 'colligative', 'osmotic-pressure'],
    body: `## Raoult's law
- For a volatile component: p_A = x_A p_A°.
- For a binary liquid mixture: p_total = x_A p_A° + x_B p_B°.
- For a non-volatile solute, the relative lowering of vapour pressure equals the mole fraction of the solute: (p° - p) / p° = x_solute.

## Ideal and non-ideal solutions
- An ideal solution obeys Raoult's law at all concentrations, with ΔH_mix = 0 and ΔV_mix = 0.
- **Positive deviation**: A-B attractions are weaker than A-A and B-B (for example ethanol and acetone). Vapour pressure is higher than expected and the mixture can form a minimum-boiling azeotrope.
- **Negative deviation**: A-B attractions are stronger (for example acetone and chloroform). Vapour pressure is lower than expected and the mixture can form a maximum-boiling azeotrope.

## Colligative properties
These depend on the number of solute particles, not their identity.
- Elevation of boiling point: ΔT_b = K_b m
- Depression of freezing point: ΔT_f = K_f m
- Osmotic pressure: π = CRT
- Relative lowering of vapour pressure.

## van't Hoff factor
i = observed colligative property / calculated value. Association gives i < 1. Dissociation gives i > 1. Multiply each formula by i for electrolytes.`,
  },
  {
    subject: 'Chemistry', topic: 'Solutions',
    title: 'Solutions: Worked Numericals', contentType: 'example', difficulty: 'Medium', estimatedMinutes: 10,
    description: 'Four fully worked numericals covering molality, freezing point depression, Raoult\'s law and osmotic pressure.',
    learningObjectives: ['Set up colligative-property numericals step by step'],
    tags: ['numericals', 'worked-example'],
    body: `## Example 1: molality
18 g of glucose (molar mass 180 g/mol) is dissolved in 500 g of water.
- Moles = 18 / 180 = 0.1 mol
- Molality = 0.1 / 0.5 kg = 0.2 m

## Example 2: freezing point depression
6 g of urea (molar mass 60 g/mol) is dissolved in 200 g of water. K_f of water is 1.86 K kg/mol.
- Moles = 0.1 mol, molality = 0.1 / 0.2 = 0.5 m
- ΔT_f = 1.86 × 0.5 = 0.93 K, so the solution freezes at about -0.93 °C.

## Example 3: Raoult's law
Pure A has p° = 80 kPa and pure B has p° = 40 kPa. For x_A = x_B = 0.5:
- p_total = 0.5 × 80 + 0.5 × 40 = 60 kPa
- Mole fraction of A in the vapour = 40 / 60 = 0.67

## Example 4: osmotic pressure
A 0.1 M solution of a non-electrolyte at 300 K (R = 0.0821 L atm / mol K):
- π = CRT = 0.1 × 0.0821 × 300 = 2.46 atm

## Method
Write the given quantities with units, convert to moles and kilograms first, and only then substitute into the formula.`,
  },
  {
    subject: 'Chemistry', topic: 'Solutions',
    title: 'Solutions Revision Sheet', contentType: 'revision', difficulty: 'Medium', estimatedMinutes: 5,
    description: 'One-page recap of formulas and traps for the Solutions chapter.',
    learningObjectives: ['Revise the main formulas and common traps'],
    tags: ['revision'],
    body: `## Revise in five minutes
- M = moles of solute / litres of solution. m = moles of solute / kg of solvent.
- p_total = x_A p_A° + x_B p_B°.
- ΔT_b = i K_b m, ΔT_f = i K_f m, π = i CRT.
- Positive deviation gives a minimum-boiling azeotrope. Negative deviation gives a maximum-boiling azeotrope.
- Association makes i < 1. Dissociation makes i > 1.

## Traps
- Molarity changes with temperature, molality does not.
- Colligative properties depend on particle count, so 0.1 m NaCl has roughly twice the effect of 0.1 m glucose.`,
  },

  // ---------------------------------------------------------------- Chemistry: Haloalkanes & Haloarenes
  {
    subject: 'Chemistry', topic: 'Haloalkanes & Haloarenes',
    title: 'Haloalkanes and Haloarenes: Core Concepts', contentType: 'concept', difficulty: 'Easy', estimatedMinutes: 8,
    description: 'Classification, nature of the C-X bond, physical properties and common preparations.',
    learningObjectives: ['Classify halogen compounds', 'Explain trends in bond strength and boiling point', 'Recall key preparations'],
    tags: ['haloalkanes', 'haloarenes', 'preparation'],
    body: `## Classification
- Haloalkanes have the halogen on an sp³ carbon and are primary, secondary or tertiary depending on that carbon.
- Haloarenes have the halogen directly on an aromatic ring (sp² carbon).
- Allylic and benzylic halides have the halogen on a carbon next to a double bond or a benzene ring. Vinylic halides have it on a double-bond carbon.

## The C-X bond
The bond is polar because halogens are more electronegative than carbon. Bond strength falls down the group: C-F > C-Cl > C-Br > C-I, so iodides are the most reactive.

## Physical properties
Boiling points rise with molecular mass and fall with branching. They are higher than those of alkanes of similar mass because of stronger dipole-dipole and van der Waals forces. Haloalkanes are only sparingly soluble in water.

## Preparation
- From alcohols: with SOCl₂ (best, because the by-products are gases), with PCl₅, or with HX in the presence of ZnCl₂.
- Free radical halogenation of alkanes gives mixtures.
- Addition of HX or X₂ to alkenes.`,
  },
  {
    subject: 'Chemistry', topic: 'Haloalkanes & Haloarenes',
    title: 'SN1 and SN2 Mechanisms Compared', contentType: 'notes', difficulty: 'Medium', estimatedMinutes: 10,
    description: 'How to decide between SN1 and SN2 from the substrate, nucleophile and solvent.',
    learningObjectives: ['Compare rate laws and stereochemistry', 'Predict the mechanism for a given substrate and solvent'],
    tags: ['sn1', 'sn2', 'mechanism'],
    body: `## SN2
- One step, with the nucleophile attacking from the side opposite the leaving group.
- Rate = k[RX][Nu], so it is bimolecular.
- Inversion of configuration (Walden inversion).
- Reactivity order: CH₃X > primary > secondary >> tertiary, because crowding blocks the attack.
- Favoured by strong nucleophiles and polar aprotic solvents.

## SN1
- Two steps: the leaving group departs to give a carbocation, then the nucleophile attacks.
- Rate = k[RX], so it is unimolecular.
- Racemisation, because the planar carbocation can be attacked from either side.
- Reactivity order: tertiary > secondary > primary, following carbocation stability. Allylic and benzylic halides also react well.
- Favoured by polar protic solvents.

## Competing elimination
Tertiary halides with a strong base tend to eliminate to give alkenes (Saytzeff rule: the more substituted alkene is the major product).

## Why aryl halides resist substitution
The C-X bond has partial double-bond character because of resonance, the carbon is sp² hybridised, and the phenyl cation is unstable, so simple nucleophilic substitution is difficult.`,
  },
  {
    subject: 'Chemistry', topic: 'Haloalkanes & Haloarenes',
    title: 'Named Reactions and Reagents: Quick Revision', contentType: 'revision', difficulty: 'Medium', estimatedMinutes: 6,
    description: 'The named reactions from this chapter with reagents and products.',
    learningObjectives: ['Recall reagents for Finkelstein, Swarts, Wurtz, Fittig and Sandmeyer reactions'],
    tags: ['named-reactions', 'revision'],
    body: `## Reactions to recall
- **Finkelstein**: R-Cl or R-Br with NaI in dry acetone gives R-I.
- **Swarts**: R-Cl or R-Br with AgF, Hg₂F₂ or SbF₃ gives R-F.
- **Wurtz**: 2 R-X with sodium in dry ether gives R-R.
- **Fittig**: 2 Ar-X with sodium in dry ether gives Ar-Ar.
- **Wurtz-Fittig**: Ar-X and R-X with sodium in dry ether gives Ar-R.
- **Sandmeyer**: a diazonium salt with CuCl or CuBr gives Ar-Cl or Ar-Br.
- **Gattermann**: a diazonium salt with copper powder and HX gives Ar-X.

## Rules
- **Markovnikov**: in the addition of HX to an unsymmetrical alkene, the halogen goes to the more substituted carbon.
- **Saytzeff**: in elimination, the more substituted alkene is the major product.`,
  },
];