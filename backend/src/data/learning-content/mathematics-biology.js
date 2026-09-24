// Curated internal TutorMind study material. Prerequisites are topic names from the question
// bank, so the engine can gate content on the student's real accuracy in those topics.
module.exports = [
  // ---------------------------------------------------------------- Mathematics
  {
    subject: 'Mathematics', topic: 'Sets',
    title: 'Sets: Core Concepts', contentType: 'concept', difficulty: 'Easy', estimatedMinutes: 7,
    description: 'Set notation, types of sets, subsets, power sets and the basic operations.',
    learningObjectives: ['Use set notation', 'Count subsets with 2ⁿ', 'Apply n(A ∪ B) = n(A) + n(B) - n(A ∩ B)'],
    tags: ['sets', 'venn-diagram'],
    body: `## Basics
A set is a well-defined collection of objects. We write x ∈ A if x belongs to A. Sets can be written in roster form {1, 2, 3} or set-builder form {x : x is a natural number less than 4}.

## Types of sets
- Empty set ∅ has no elements. A singleton has exactly one element.
- Finite and infinite sets. Equal sets have exactly the same elements.
- A is a subset of B if every element of A is in B. A set with n elements has 2ⁿ subsets, and its power set has 2ⁿ elements.

## Operations
- Union A ∪ B: elements in A or B or both.
- Intersection A ∩ B: elements in both.
- Difference A - B: elements in A but not in B.
- Complement A': elements of the universal set not in A.

## Useful results
- n(A ∪ B) = n(A) + n(B) - n(A ∩ B)
- De Morgan's laws: (A ∪ B)' = A' ∩ B' and (A ∩ B)' = A' ∪ B'`,
  },
  {
    subject: 'Mathematics', topic: 'Sets',
    title: 'Set Operations and Venn Diagram Problems', contentType: 'example', difficulty: 'Medium', estimatedMinutes: 9,
    description: 'Worked examples of set operations, power sets and the inclusion-exclusion counting rule.',
    learningObjectives: ['Solve two-set counting problems', 'Compute unions, intersections and differences'],
    tags: ['worked-example', 'venn-diagram'],
    body: `## Example 1: operations
Let A = {1, 2, 3, 4} and B = {3, 4, 5}.
- A ∪ B = {1, 2, 3, 4, 5}
- A ∩ B = {3, 4}
- A - B = {1, 2}
- Symmetric difference = {1, 2, 5}

## Example 2: counting with a Venn diagram
In a class of 60, 35 like tea, 30 like coffee and 10 like both.
- n(T ∪ C) = 35 + 30 - 10 = 55
- Students who like neither = 60 - 55 = 5
- Students who like only tea = 35 - 10 = 25

## Example 3: subsets
A set with 3 elements has 2³ = 8 subsets, of which 7 are proper subsets.

## Method
Fill the intersection first, then the "only" regions, then the outside region. Check that the parts add up to the universal set.`,
  },
  {
    subject: 'Mathematics', topic: 'Cartesian Product of Sets', prerequisites: ['Sets'],
    title: 'Cartesian Product: Core Concepts', contentType: 'concept', difficulty: 'Easy', estimatedMinutes: 6,
    description: 'Ordered pairs, the Cartesian product A × B and its counting and algebraic properties.',
    learningObjectives: ['Write A × B', 'Use n(A × B) = n(A) n(B)'],
    tags: ['cartesian-product', 'ordered-pairs'],
    body: `## Ordered pairs
(a, b) is an ordered pair, so (a, b) = (c, d) only when a = c and b = d. Order matters: (1, 2) is not (2, 1).

## Cartesian product
A × B = {(a, b) : a ∈ A, b ∈ B}.
- If A = {1, 2} and B = {x, y}, then A × B = {(1, x), (1, y), (2, x), (2, y)}.
- n(A × B) = n(A) × n(B).
- In general A × B ≠ B × A, unless A = B or one of them is empty.

## Properties
- A × (B ∪ C) = (A × B) ∪ (A × C)
- A × (B ∩ C) = (A × B) ∩ (A × C)
- A × ∅ = ∅
- R × R is the whole coordinate plane.`,
  },
  {
    subject: 'Mathematics', topic: 'Relations', prerequisites: ['Sets', 'Cartesian Product of Sets'],
    title: 'Relations: Core Concepts', contentType: 'concept', difficulty: 'Easy', estimatedMinutes: 7,
    description: 'Relations as subsets of A × B, domain and range, and reflexive, symmetric and transitive relations.',
    learningObjectives: ['Define a relation and its domain and range', 'Test for equivalence relations'],
    tags: ['relations', 'equivalence'],
    body: `## Definition
A relation R from A to B is any subset of A × B. The set of first elements is the domain, the set of second elements is the range, and B is the codomain. If n(A) = m and n(B) = n, the number of relations from A to B is 2^(mn).

## Types of relations on a set A
- **Reflexive**: (a, a) ∈ R for every a in A.
- **Symmetric**: (a, b) ∈ R implies (b, a) ∈ R.
- **Transitive**: (a, b) ∈ R and (b, c) ∈ R imply (a, c) ∈ R.
- **Equivalence relation**: reflexive, symmetric and transitive together.

## Example
On A = {1, 2, 3}, R = {(1, 1), (2, 2), (3, 3), (1, 2), (2, 1)} is reflexive and symmetric. It is also transitive, so it is an equivalence relation.

## Tip
To disprove a property, one counter-example pair is enough. To prove it you must argue for every element.`,
  },
  {
    subject: 'Mathematics', topic: 'Functions', prerequisites: ['Relations'],
    title: 'Functions: Core Concepts', contentType: 'concept', difficulty: 'Easy', estimatedMinutes: 8,
    description: 'Definition of a function, one-one and onto functions, composition and inverse.',
    learningObjectives: ['Decide whether a relation is a function', 'Classify one-one, onto and bijective functions'],
    tags: ['functions', 'one-one', 'onto'],
    body: `## Definition
A function f from A to B assigns to every element of A exactly one element of B. A is the domain, B is the codomain and the set of actual outputs is the range.

## Types
- **One-one (injective)**: different inputs give different outputs.
- **Onto (surjective)**: every element of the codomain is an output, so range = codomain.
- **Bijective**: both one-one and onto.

## Counting
If n(A) = m and n(B) = n, the number of functions from A to B is n^m.

## Composition and inverse
- (f ∘ g)(x) = f(g(x)). Composition is generally not commutative.
- f has an inverse exactly when f is bijective.

## Horizontal and vertical line tests
A vertical line meets a function's graph at most once. If every horizontal line meets it at most once, the function is one-one.`,
  },
  {
    subject: 'Mathematics', topic: 'Functions', prerequisites: ['Relations'],
    title: 'Domain, Range and Types of Functions', contentType: 'notes', difficulty: 'Medium', estimatedMinutes: 9,
    description: 'Techniques for finding domain and range, and counting one-one functions.',
    learningObjectives: ['Find domains quickly', 'Count one-one functions'],
    tags: ['domain', 'range'],
    body: `## Finding the domain
- A denominator must not be zero.
- The expression under an even root must be greater than or equal to zero.
- The argument of a logarithm must be positive.

## Examples
- f(x) = 1 / (x² - 4) has domain R except x = ±2.
- f(x) = √(x - 2) has domain [2, ∞).

## Finding the range
Express x in terms of y and find which y-values give a valid x, or use known bounds such as 0 ≤ sin²x ≤ 1.

## Counting one-one functions
From a set with m elements to a set with n elements (m ≤ n), the number of one-one functions is n! / (n - m)!. If m > n there are none.

## Even and odd
f is even if f(-x) = f(x) and odd if f(-x) = -f(x). A function that is even and odd at once must be zero everywhere.`,
  },
  {
    subject: 'Mathematics', topic: 'Matrices',
    title: 'Matrices: Core Concepts', contentType: 'concept', difficulty: 'Easy', estimatedMinutes: 8,
    description: 'Order, types of matrices, basic operations and the rules of matrix multiplication.',
    learningObjectives: ['Identify types of matrices', 'Multiply compatible matrices', 'Use transpose properties'],
    tags: ['matrices', 'multiplication'],
    body: `## Basics
A matrix is a rectangular array of numbers. A matrix with m rows and n columns has order m × n.

## Types
- Row matrix, column matrix, square matrix.
- Diagonal, scalar and identity matrices (I has 1s on the diagonal).
- Symmetric (Aᵀ = A) and skew-symmetric (Aᵀ = -A). The diagonal of a skew-symmetric matrix is zero.

## Operations
- Addition needs matrices of the same order and works element by element.
- Scalar multiplication multiplies every element.
- The product AB exists only when the number of columns of A equals the number of rows of B.
- In general AB ≠ BA, and AB = O does not force A = O or B = O.
- (AB)ᵀ = BᵀAᵀ.`,
  },
  {
    subject: 'Mathematics', topic: 'Matrices',
    title: 'Matrix Operations and Determinants: Worked Examples', contentType: 'example', difficulty: 'Medium', estimatedMinutes: 10,
    description: 'A worked product, determinant and inverse of a 2 × 2 matrix plus determinant properties.',
    learningObjectives: ['Multiply 2 × 2 matrices', 'Find a determinant and an inverse'],
    tags: ['determinant', 'inverse', 'worked-example'],
    body: `## Example 1: product
Let A = [[1, 2], [3, 4]] and B = [[0, 1], [1, 0]].
- Row 1 of AB: 1×0 + 2×1 = 2 and 1×1 + 2×0 = 1
- Row 2 of AB: 3×0 + 4×1 = 4 and 3×1 + 4×0 = 3
- So AB = [[2, 1], [4, 3]].

## Example 2: determinant and inverse
For the same A, |A| = 1×4 - 2×3 = -2.
- adj A = [[4, -2], [-3, 1]]
- A⁻¹ = (1 / |A|) adj A = [[-2, 1], [1.5, -0.5]]

## Determinant properties
- |AB| = |A||B|
- |kA| = kⁿ|A| for an n × n matrix
- A · adj A = |A| I
- A matrix is invertible exactly when |A| ≠ 0.`,
  },
  {
    subject: 'Mathematics', topic: 'Matrices',
    title: 'Matrices: Inverse and Systems of Equations', contentType: 'article', difficulty: 'Hard', estimatedMinutes: 12,
    description: 'Solving linear systems with the inverse and Cramer\'s rule, and deciding consistency.',
    learningObjectives: ['Solve AX = B', 'Decide whether a system has no, one or infinitely many solutions'],
    tags: ['linear-systems', 'advanced', 'consistency'],
    body: `## Solving AX = B
If |A| ≠ 0 the system has a unique solution X = A⁻¹B.

## Example
x + y = 3 and x - y = 1 gives A = [[1, 1], [1, -1]] and |A| = -2.
Solving gives x = 2 and y = 1.

## Consistency of a square system
- |A| ≠ 0: unique solution.
- |A| = 0 and (adj A)B ≠ O: no solution (inconsistent).
- |A| = 0 and (adj A)B = O: the system is consistent with infinitely many solutions in the standard treatment for these problems.

## Useful facts
- For an n × n matrix, |adj A| = |A|ⁿ⁻¹.
- (AB)⁻¹ = B⁻¹A⁻¹.
- Cramer's rule gives x = |A_x| / |A| when |A| ≠ 0.`,
  },

  // ---------------------------------------------------------------- Biology
  {
    subject: 'Biology', topic: 'Cell Cycle',
    title: 'Cell Cycle: Phases and Checkpoints', contentType: 'concept', difficulty: 'Easy', estimatedMinutes: 7,
    description: 'Interphase (G1, S, G2), M phase, the quiescent stage and the control of the cycle.',
    learningObjectives: ['Name the phases of the cell cycle', 'State what happens in S phase', 'Explain the G0 stage'],
    tags: ['cell-cycle', 'interphase'],
    body: `## Two big phases
- **Interphase** is the long preparatory phase. It has G1 (growth and normal metabolism), S (DNA replication) and G2 (further growth and preparation for division).
- **M phase** is the actual division: mitosis (karyokinesis) followed by cytokinesis.

## Key numbers
In a typical human cell the cycle lasts about 24 hours, of which mitosis takes only about an hour. In S phase the DNA content doubles from 2C to 4C, but the chromosome number stays the same.

## G0 (quiescent stage)
Cells that do not divide for a time leave G1 and enter G0. They stay metabolically active. Many differentiated cells, such as neurons, remain in G0.

## Control
Checkpoints (at the end of G1, at G2/M and at the spindle stage) check that DNA is intact and replicated before the cell proceeds. Cyclins and cyclin-dependent kinases regulate these transitions.`,
  },
  {
    subject: 'Biology', topic: 'Mitosis', prerequisites: ['Cell Cycle'],
    title: 'Mitosis: Stages and Significance', contentType: 'notes', difficulty: 'Medium', estimatedMinutes: 8,
    description: 'Prophase, metaphase, anaphase, telophase and cytokinesis, with why mitosis matters.',
    learningObjectives: ['Describe each stage of mitosis', 'Contrast cytokinesis in plants and animals'],
    tags: ['mitosis', 'equational-division'],
    body: `## Stages
- **Prophase**: chromatin condenses into chromosomes, each with two chromatids. The nucleolus and nuclear envelope disappear and the spindle begins to form.
- **Metaphase**: spindle fibres attach to kinetochores and the chromosomes line up on the metaphase plate.
- **Anaphase**: centromeres split and the chromatids move to opposite poles.
- **Telophase**: chromosomes decondense, and the nuclear envelope and nucleolus reappear around each set.

## Cytokinesis
In animal cells a cleavage furrow pinches the cell in two. In plant cells a cell plate forms in the middle and grows outward.

## Significance
Mitosis is an equational division: the daughter cells have the same chromosome number as the parent. It supports growth, repair and asexual reproduction, and it keeps the cell's nucleus-to-cytoplasm ratio balanced.`,
  },
  {
    subject: 'Biology', topic: 'Meiosis', prerequisites: ['Cell Cycle', 'Mitosis'],
    title: 'Meiosis I and II Compared with Mitosis', contentType: 'notes', difficulty: 'Medium', estimatedMinutes: 9,
    description: 'Substages of prophase I, the separation of homologous chromosomes and the outcome of meiosis.',
    learningObjectives: ['Order the substages of prophase I', 'Explain how meiosis creates variation'],
    tags: ['meiosis', 'crossing-over'],
    body: `## Meiosis I (reductional)
Prophase I is long and has five substages:
- **Leptotene**: chromosomes begin to condense.
- **Zygotene**: homologous chromosomes pair up (synapsis) and form the synaptonemal complex.
- **Pachytene**: crossing over occurs between non-sister chromatids of homologous chromosomes.
- **Diplotene**: the complex dissolves and the chromosomes stay attached at chiasmata.
- **Diakinesis**: chiasmata move to the ends (terminalisation) and the nuclear envelope breaks down.

In anaphase I whole homologous chromosomes separate, so the chromosome number is halved.

## Meiosis II (equational)
It resembles mitosis: sister chromatids separate. The result is four haploid cells.

## Significance
Meiosis keeps the chromosome number constant across generations, and crossing over plus independent assortment produce genetic variation.

## Compare with mitosis
Mitosis gives two identical diploid cells with one division. Meiosis gives four haploid cells after two divisions and has pairing of homologous chromosomes.`,
  },
  {
    subject: 'Biology', topic: 'Enzymes',
    title: 'Enzymes: Core Concepts', contentType: 'concept', difficulty: 'Easy', estimatedMinutes: 7,
    description: 'What enzymes are, how they work, cofactors and the six enzyme classes.',
    learningObjectives: ['Explain how enzymes lower activation energy', 'Distinguish cofactors', 'List the six classes'],
    tags: ['enzymes', 'cofactors'],
    body: `## What enzymes are
Enzymes are biological catalysts. Almost all are proteins, though some RNA molecules (ribozymes) also act as enzymes. Each enzyme has an active site whose shape fits a specific substrate.

## How they work
An enzyme lowers the activation energy of a reaction, so the reaction speeds up, without changing the overall energy change or being used up.

## Cofactors
- **Prosthetic group**: tightly bound to the protein part.
- **Coenzyme**: loosely bound, often derived from vitamins (for example NAD and NADP contain niacin).
- **Metal ions**: for example zinc in carboxypeptidase.

## Six classes
1. Oxidoreductases
2. Transferases
3. Hydrolases
4. Lyases
5. Isomerases
6. Ligases`,
  },
  {
    subject: 'Biology', topic: 'Enzymes',
    title: 'Enzyme Kinetics and Inhibition', contentType: 'notes', difficulty: 'Medium', estimatedMinutes: 9,
    description: 'Effects of temperature, pH and substrate concentration, Vmax, Km and enzyme inhibition.',
    learningObjectives: ['Read a rate versus substrate curve', 'Contrast competitive and non-competitive inhibition'],
    tags: ['kinetics', 'inhibition', 'km'],
    body: `## Factors affecting activity
- Each enzyme has an optimum temperature and pH. Extreme values denature the protein and reduce activity.
- Rate rises with substrate concentration and then levels off at Vmax when all active sites are occupied.
- **Km** is the substrate concentration at which the rate is half of Vmax. A lower Km means a higher affinity.

## Inhibition
- **Competitive inhibitor**: resembles the substrate and competes for the active site. It can be overcome by adding more substrate. A classic example is malonate inhibiting succinate dehydrogenase.
- **Non-competitive inhibitor**: binds elsewhere and changes the enzyme's shape, so adding substrate does not fully reverse it.
- **Feedback inhibition**: the end product of a pathway inhibits an early enzyme in that pathway.

## Exam tip
For a competitive inhibitor Vmax is unchanged but a higher substrate concentration is needed to reach it.`,
  },
  {
    subject: 'Biology', topic: 'Site of Photosynthesis and Photosynthetic Pigments',
    title: 'Chloroplast and Photosynthetic Pigments', contentType: 'concept', difficulty: 'Easy', estimatedMinutes: 6,
    description: 'Structure of the chloroplast and the main photosynthetic pigments.',
    learningObjectives: ['Locate the light and dark reactions in the chloroplast', 'Name the pigments and their colours'],
    tags: ['chloroplast', 'pigments'],
    body: `## Chloroplast structure
A chloroplast has an outer and an inner membrane enclosing the stroma. Inside are flattened sacs called thylakoids, stacked into grana. The light reactions happen in the thylakoid membranes and the carbon-fixing reactions happen in the stroma.

## Pigments
- **Chlorophyll a**: bright or blue-green and the main pigment of the reaction centres.
- **Chlorophyll b**: yellow-green.
- **Xanthophylls**: yellow.
- **Carotenoids**: yellow to yellow-orange.
Accessory pigments absorb other wavelengths and pass energy to chlorophyll a.

## Absorption
Chlorophyll absorbs mainly in the blue and red regions. The action spectrum of photosynthesis follows the absorption spectrum closely.`,
  },
  {
    subject: 'Biology', topic: 'Mechanism of Photosynthesis', prerequisites: ['Site of Photosynthesis and Photosynthetic Pigments'],
    title: 'Photosynthesis: Light Reactions and the Calvin Cycle', contentType: 'concept', difficulty: 'Easy', estimatedMinutes: 9,
    description: 'Photosystems, photophosphorylation, the Calvin cycle and the C4 pathway.',
    learningObjectives: ['Describe the light reactions', 'State the three phases of the Calvin cycle', 'Compare C3 and C4 plants'],
    tags: ['light-reaction', 'calvin-cycle', 'c4'],
    body: `## Light reactions (thylakoid membrane)
- Photosystem II (P680) and photosystem I (P700) absorb light.
- Water is split at photosystem II, releasing oxygen, protons and electrons.
- **Non-cyclic photophosphorylation** uses both photosystems and produces ATP and NADPH.
- **Cyclic photophosphorylation** uses only photosystem I and produces ATP only.
- ATP is made by chemiosmosis through ATP synthase.

## Calvin cycle (stroma)
1. **Carboxylation**: RuBisCO combines CO₂ with RuBP to give two molecules of 3-PGA.
2. **Reduction**: ATP and NADPH convert 3-PGA to sugar.
3. **Regeneration**: RuBP is regenerated using ATP.
To make one glucose, 6 CO₂ are fixed using 18 ATP and 12 NADPH.

## C4 pathway
Plants such as maize have Kranz anatomy. PEP carboxylase fixes CO₂ into oxaloacetate (a 4-carbon acid) in mesophyll cells, and CO₂ is then released in bundle sheath cells for the Calvin cycle. This reduces photorespiration.`,
  },
  {
    subject: 'Biology', topic: 'Mendelian Inheritance',
    title: 'Mendel\'s Laws: Core Concepts', contentType: 'concept', difficulty: 'Easy', estimatedMinutes: 8,
    description: 'Dominance, segregation, independent assortment and the extensions of Mendelian inheritance.',
    learningObjectives: ['State Mendel\'s three laws', 'Recall the standard ratios'],
    tags: ['mendel', 'genetics'],
    body: `## Mendel's laws
- **Law of dominance**: in a heterozygote, one allele (dominant) hides the effect of the other (recessive).
- **Law of segregation**: the two alleles of a gene separate during gamete formation, so each gamete carries only one. This is also called the law of purity of gametes.
- **Law of independent assortment**: alleles of different genes assort independently when the genes are on different chromosomes.

## Standard ratios
- Monohybrid cross: phenotypic 3 : 1 and genotypic 1 : 2 : 1.
- Dihybrid cross: phenotypic 9 : 3 : 3 : 1.
- Test cross (with the recessive parent): a heterozygote gives 1 : 1.

## Extensions
- **Incomplete dominance**: the heterozygote is intermediate, so the ratio is 1 : 2 : 1 for phenotype as well.
- **Co-dominance**: both alleles are expressed, as in the AB blood group.
- **Multiple alleles**: more than two alleles exist in a population, as in the ABO system (Iᴬ, Iᴮ, i).`,
  },
  {
    subject: 'Biology', topic: 'Mendelian Inheritance',
    title: 'Monohybrid and Dihybrid Crosses: Worked Examples', contentType: 'example', difficulty: 'Medium', estimatedMinutes: 10,
    description: 'Worked crosses using the Punnett square and the product rule.',
    learningObjectives: ['Work out genotype and phenotype ratios', 'Use the product rule for dihybrid crosses'],
    tags: ['punnett-square', 'worked-example', 'abo'],
    body: `## Example 1: monohybrid cross Tt × Tt
Gametes: T or t from each parent.
- Genotypes: 1 TT : 2 Tt : 1 tt
- Phenotypes: 3 tall : 1 dwarf

## Example 2: test cross Tt × tt
- Offspring: 1 Tt : 1 tt, so 1 tall : 1 dwarf.

## Example 3: dihybrid cross RrYy × RrYy
Treat each gene separately and multiply probabilities (product rule).
- Probability of round = 3/4 and yellow = 3/4, so round and yellow = 9/16.
- Phenotype ratio 9 : 3 : 3 : 1, with 9 different genotypes.

## Example 4: ABO blood groups
Parents Iᴬi × Iᴮi:
- Offspring: IᴬIᴮ (AB), Iᴬi (A), Iᴮi (B) and ii (O) in the ratio 1 : 1 : 1 : 1.

## Tip
Write the gametes first, keep each gene separate, and multiply probabilities only for independent events.`,
  },
  {
    subject: 'Biology', topic: 'Glycolysis and Fermentation',
    title: 'Glycolysis: Steps and Energy Balance', contentType: 'concept', difficulty: 'Easy', estimatedMinutes: 7,
    description: 'Glycolysis in the cytoplasm, its net yield, and the fate of pyruvate under anaerobic conditions.',
    learningObjectives: ['State the net ATP and NADH yield', 'Contrast lactic acid and alcoholic fermentation'],
    tags: ['glycolysis', 'fermentation'],
    body: `## Glycolysis
Glycolysis occurs in the cytoplasm of all living cells. One glucose (6C) is converted to two pyruvate (3C).
- Energy investment phase: 2 ATP are used.
- Energy payoff phase: 4 ATP are made by substrate-level phosphorylation.
- Net gain: 2 ATP and 2 NADH per glucose.

## Fate of pyruvate
- With oxygen, pyruvate enters the mitochondria (aerobic respiration).
- Without oxygen, fermentation regenerates NAD⁺ so that glycolysis can continue.

## Fermentation
- **Lactic acid fermentation** (for example in muscle cells): pyruvate is reduced to lactic acid.
- **Alcoholic fermentation** (for example in yeast): pyruvate is converted to acetaldehyde and then to ethanol, releasing CO₂.
Fermentation releases only a small fraction of the energy stored in glucose, with a net gain of just 2 ATP.`,
  },
  {
    subject: 'Biology', topic: 'Aerobic Respiration', prerequisites: ['Glycolysis and Fermentation'],
    title: 'Aerobic Respiration: Krebs Cycle and the Electron Transport System', contentType: 'notes', difficulty: 'Medium', estimatedMinutes: 10,
    description: 'Link reaction, Krebs cycle, electron transport and oxidative phosphorylation.',
    learningObjectives: ['Follow pyruvate through the mitochondrion', 'State the products of one Krebs cycle turn'],
    tags: ['krebs-cycle', 'ets', 'atp'],
    body: `## Link reaction
Pyruvate enters the mitochondrial matrix and undergoes oxidative decarboxylation to form acetyl CoA, releasing CO₂ and producing NADH.

## Krebs cycle (matrix)
Acetyl CoA joins oxaloacetate to form citrate. In one turn of the cycle:
- Two CO₂ molecules are released.
- 3 NADH and 1 FADH₂ are produced.
- 1 ATP (or GTP) is made by substrate-level phosphorylation.
Since one glucose gives two acetyl CoA, the cycle turns twice per glucose.

## Electron transport system (inner mitochondrial membrane)
NADH and FADH₂ pass electrons through complexes I to IV. Oxygen is the final electron acceptor and forms water. The proton gradient drives ATP synthase (complex V).

## Total ATP
Textbooks differ: older texts quote about 36 to 38 ATP per glucose, while newer estimates are about 30 to 32. Use the figure your prescribed syllabus uses.`,
  },
];