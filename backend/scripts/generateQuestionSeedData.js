const fs = require('fs');
const path = require('path');

const outputDir = path.join(__dirname, '..', 'src', 'data', 'question-seeds');

const difficultyCycle = ['Easy', 'Medium', 'Hard'];
const mistakeTypes = ['concept', 'calculation', 'trap'];

const ensureDir = (dirPath) => {
  fs.mkdirSync(dirPath, { recursive: true });
};

const pickDifficulty = (index) => difficultyCycle[index % difficultyCycle.length];
const pickMistakeType = (index) => mistakeTypes[index % mistakeTypes.length];

const makeQuestion = ({
  examType,
  subject,
  topic,
  subtopic,
  difficulty,
  text,
  options,
  correctAnswerIndex,
  explanation,
  mistakeType,
}) => ({
  examType,
  subject,
  topic,
  subtopic,
  difficulty,
  text,
  options,
  correctAnswer: options[correctAnswerIndex],
  correctAnswerIndex,
  explanation,
  mistakeType,
});

const algebraQuestions = () => {
  const values = [
    [2, 3, 11],
    [3, 4, 19],
    [4, 5, 25],
    [5, 7, 32],
    [6, 9, 45],
    [7, 8, 36],
    [8, 11, 59],
    [9, 6, 33],
    [10, 13, 73],
    [11, 12, 56],
  ];

  return values.map(([a, b, c], index) => {
    const x = (c - b) / a;
    return makeQuestion({
      examType: 'JEE',
      subject: 'Mathematics',
      topic: 'Algebra',
      subtopic: index % 2 === 0 ? 'Linear Equations' : 'Expression Simplification',
      difficulty: pickDifficulty(index),
      text: `Solve ${a}x + ${b} = ${c}.`,
      options: [`x = ${x - 1}`, `x = ${x}`, `x = ${x + 1}`, `x = ${x + 2}`],
      correctAnswerIndex: 1,
      explanation: `Subtract ${b} and divide by ${a} to get x = ${x}.`,
      mistakeType: pickMistakeType(index),
    });
  });
};

const quadraticQuestions = () => {
  const roots = [
    [1, 4],
    [2, 5],
    [3, 6],
    [2, 7],
    [1, 8],
    [4, 5],
    [3, 8],
    [2, 9],
    [5, 6],
    [4, 7],
  ];

  return roots.map(([r1, r2], index) => {
    const sum = r1 + r2;
    const product = r1 * r2;
    return makeQuestion({
      examType: 'JEE',
      subject: 'Mathematics',
      topic: 'Quadratic Equations',
      subtopic: index % 2 === 0 ? 'Roots' : 'Factorization',
      difficulty: pickDifficulty(index + 1),
      text: `If the roots of x^2 - ${sum}x + ${product} = 0 are required, what are they?`,
      options: [
        `${r1} and ${r2}`,
        `${r1 + 1} and ${r2 + 1}`,
        `${r1 - 1} and ${r2 + 2}`,
        `${r1 + 2} and ${r2 - 1}`,
      ],
      correctAnswerIndex: 0,
      explanation: `The equation factors as (x - ${r1})(x - ${r2}) = 0.`,
      mistakeType: pickMistakeType(index + 1),
    });
  });
};

const probabilityQuestions = () => {
  const templates = [
    { text: 'What is the probability of getting a head in one fair coin toss?', answer: '1/2', options: ['1/4', '1/2', '2/3', '1'], explanation: 'A fair coin has two equally likely outcomes.' },
    { text: 'What is the probability of drawing an ace from a standard deck of 52 cards?', answer: '1/13', options: ['1/4', '1/13', '1/52', '4/13'], explanation: 'There are 4 aces in 52 cards.' },
    { text: 'What is the probability of rolling a 6 on a fair die?', answer: '1/6', options: ['1/2', '1/3', '1/6', '1/12'], explanation: 'One favorable outcome out of six total.' },
    { text: 'What is the probability of getting an even number on a die?', answer: '1/2', options: ['1/6', '1/3', '1/2', '2/3'], explanation: 'Three even outcomes out of six.' },
    { text: 'What is the probability of getting two heads in two coin tosses?', answer: '1/4', options: ['1/2', '1/4', '1/8', '3/4'], explanation: 'The outcomes HH, HT, TH, TT are equally likely.' },
    { text: 'What is the probability of drawing a king from a standard deck?', answer: '1/13', options: ['1/4', '1/13', '4/13', '1/52'], explanation: 'There are 4 kings among 52 cards.' },
    { text: 'What is the probability of getting a number greater than 4 on a die?', answer: '1/3', options: ['1/2', '1/3', '2/3', '1/6'], explanation: 'Possible outcomes are 5 and 6.' },
    { text: 'What is the probability of selecting a red ball from 3 red and 2 blue balls?', answer: '3/5', options: ['2/5', '3/5', '1/2', '4/5'], explanation: 'Three favorable outcomes out of five total.' },
    { text: 'What is the probability of getting tails in one fair coin toss?', answer: '1/2', options: ['1/2', '1/3', '1/4', '1'], explanation: 'Heads and tails are equally likely.' },
    { text: 'What is the probability of drawing a spade from a standard deck?', answer: '1/4', options: ['1/2', '1/13', '1/4', '4/13'], explanation: 'There are 13 spades in 52 cards.' },
  ];

  return templates.map((item, index) =>
    makeQuestion({
      examType: 'JEE',
      subject: 'Mathematics',
      topic: 'Probability',
      subtopic: index % 2 === 0 ? 'Basic Probability' : 'Counting Outcomes',
      difficulty: pickDifficulty(index + 2),
      text: item.text,
      options: item.options,
      correctAnswerIndex: item.options.indexOf(item.answer),
      explanation: item.explanation,
      mistakeType: pickMistakeType(index + 2),
    })
  );
};

const trigonometryQuestions = () => {
  const templates = [
    ['What is sin 30°?', ['1/2', '1', '0', '√3/2'], '1/2', 'Sine of 30 degrees is 1/2.'],
    ['What is cos 60°?', ['1/2', '0', '1', '√3/2'], '1/2', 'Cosine of 60 degrees is 1/2.'],
    ['What is tan 45°?', ['0', '1', '√3', '1/√3'], '1', 'Tan 45 degrees equals 1.'],
    ['What is sin^2 θ + cos^2 θ?', ['0', '1', '2', 'Depends on θ'], '1', 'This is the fundamental trigonometric identity.'],
    ['What is cos 0°?', ['0', '1/2', '1', '√3/2'], '1', 'Cosine of 0 degrees is 1.'],
    ['What is sin 90°?', ['0', '1/2', '1', '√3/2'], '1', 'Sine of 90 degrees is 1.'],
    ['What is tan 30°?', ['1/√3', '√3', '1', '1/2'], '1/√3', 'Tan 30 degrees equals 1/√3.'],
    ['What is cos 45°?', ['1/2', '1', '√2/2', '√3/2'], '√2/2', 'Cosine of 45 degrees is √2/2.'],
    ['What is sec 0°?', ['0', '1', '2', 'undefined'], '1', 'Secant is 1/cos, so sec 0° = 1.'],
    ['What is cot 45°?', ['0', '1', '√3', '1/√3'], '1', 'Cotangent of 45 degrees is 1.'],
  ];

  return templates.map(([text, options, answer, explanation], index) =>
    makeQuestion({
      examType: 'JEE',
      subject: 'Mathematics',
      topic: 'Trigonometry',
      subtopic: index % 2 === 0 ? 'Trigonometric Values' : 'Identities',
      difficulty: pickDifficulty(index),
      text,
      options,
      correctAnswerIndex: options.indexOf(answer),
      explanation,
      mistakeType: pickMistakeType(index),
    })
  );
};

const calculusQuestions = () => {
  const templates = [
    ['Find the derivative of x^2.', ['x', '2x', 'x^3', '2'], '2x', 'Power rule gives d/dx(x^2) = 2x.'],
    ['Find the derivative of 3x^2.', ['3x', '6x', 'x^2', '9x'], '6x', 'Differentiate 3x^2 to get 6x.'],
    ['What is the integral of 2x dx?', ['x^2 + C', '2x^2 + C', 'x + C', '2 + C'], 'x^2 + C', 'Integral of 2x is x^2 + C.'],
    ['Find the derivative of x^3.', ['3x', 'x^2', '3x^2', 'x^3'], '3x^2', 'Power rule gives 3x^2.'],
    ['What is the derivative of a constant 7?', ['7', '1', '0', 'x'], '0', 'Derivative of a constant is zero.'],
    ['What is the integral of 4 dx?', ['4x + C', 'x^4 + C', '4 + C', 'x + C'], '4x + C', 'Integral of a constant 4 is 4x + C.'],
    ['Find d/dx of 5x.', ['5', 'x^5', '25', '0'], '5', 'Derivative of 5x is 5.'],
    ['What is d/dx of x^4?', ['4x^3', 'x^3', '4x', 'x^4'], '4x^3', 'Power rule gives 4x^3.'],
    ['What is the integral of x^2 dx?', ['x^3/3 + C', 'x^2/2 + C', '2x + C', '3x + C'], 'x^3/3 + C', 'Use the reverse power rule.'],
    ['What is d/dx of 2x^3?', ['2x^2', '6x^2', '3x^2', 'x^3'], '6x^2', 'Differentiate using the power rule.'],
  ];

  return templates.map(([text, options, answer, explanation], index) =>
    makeQuestion({
      examType: 'JEE',
      subject: 'Mathematics',
      topic: 'Calculus',
      subtopic: index % 2 === 0 ? 'Differentiation' : 'Integration',
      difficulty: pickDifficulty(index + 1),
      text,
      options,
      correctAnswerIndex: options.indexOf(answer),
      explanation,
      mistakeType: pickMistakeType(index + 1),
    })
  );
};

const physicsKinematics = () => {
  const templates = [
    { text: 'A body starts from rest and accelerates at 2 m/s^2 for 5 s. What is its final velocity?', options: ['5 m/s', '8 m/s', '10 m/s', '12 m/s'], answer: '10 m/s', explanation: 'Use v = u + at = 0 + 2 × 5.' },
    { text: 'A particle moves with constant velocity 6 m/s for 4 s. What distance does it cover?', options: ['10 m', '18 m', '24 m', '30 m'], answer: '24 m', explanation: 'Distance = speed × time = 6 × 4.' },
    { text: 'A car slows from 20 m/s to 10 m/s in 5 s. What is its acceleration?', options: ['-2 m/s^2', '-5 m/s^2', '2 m/s^2', '5 m/s^2'], answer: '-2 m/s^2', explanation: 'a = (v - u)/t = (10 - 20)/5.' },
    { text: 'A body covers 30 m in 3 s. What is its average speed?', options: ['5 m/s', '8 m/s', '10 m/s', '12 m/s'], answer: '10 m/s', explanation: 'Average speed = distance/time.' },
    { text: 'A particle has velocity 12 m/s and acceleration 3 m/s^2 for 2 s. What is its final velocity?', options: ['15 m/s', '16 m/s', '18 m/s', '20 m/s'], answer: '18 m/s', explanation: 'v = u + at = 12 + 3 × 2.' },
    { text: 'What is the SI unit of acceleration?', options: ['m/s', 'm/s^2', 'm^2/s', 'N'], answer: 'm/s^2', explanation: 'Acceleration is change in velocity per unit time.' },
    { text: 'A ball is thrown vertically upward. At the highest point, velocity is:', options: ['Maximum', 'Zero', 'Constant', 'Negative'], answer: 'Zero', explanation: 'At the top, instantaneous velocity becomes zero.' },
    { text: 'If displacement is zero, average velocity over the interval is:', options: ['Zero', 'Positive', 'Negative', 'Infinite'], answer: 'Zero', explanation: 'Average velocity = displacement/time.' },
    { text: 'A car travels 100 km in 2 h. What is average speed?', options: ['25 km/h', '50 km/h', '75 km/h', '100 km/h'], answer: '50 km/h', explanation: 'Average speed = 100/2.' },
    { text: 'What is the slope of a distance-time graph for uniform motion?', options: ['Acceleration', 'Force', 'Velocity', 'Momentum'], answer: 'Velocity', explanation: 'Slope of a distance-time graph gives speed/velocity.' },
  ];

  return templates.map((item, index) =>
    makeQuestion({
      examType: 'JEE',
      subject: 'Physics',
      topic: 'Kinematics',
      subtopic: index % 2 === 0 ? 'Motion in One Dimension' : 'Graphs',
      difficulty: pickDifficulty(index),
      text: item.text,
      options: item.options,
      correctAnswerIndex: item.options.indexOf(item.answer),
      explanation: item.explanation,
      mistakeType: pickMistakeType(index),
    })
  );
};

const physicsDynamics = () => {
  const templates = [
    ['What is the SI unit of force?', ['Joule', 'Newton', 'Watt', 'Pascal'], 'Newton', 'Force is measured in newtons.' ],
    ['If mass is 5 kg and acceleration is 2 m/s^2, force is?', ['7 N', '8 N', '10 N', '12 N'], '10 N', 'Use F = ma.' ],
    ['The net force on a body in equilibrium is:', ['Zero', 'Maximum', 'Minimum', 'Infinite'], 'Zero', 'Equilibrium means no net force.' ],
    ['Friction always acts:', ['Along motion', 'Opposite relative motion', 'Upward', 'Downward'], 'Opposite relative motion', 'Friction opposes relative motion.' ],
    ['If force doubles and mass remains constant, acceleration:', ['Halves', 'Doubles', 'Becomes zero', 'Unchanged'], 'Doubles', 'By F = ma, a is proportional to force.' ],
    ['A body of 4 kg experiences 20 N force. Acceleration is?', ['2 m/s^2', '4 m/s^2', '5 m/s^2', '8 m/s^2'], '5 m/s^2', 'a = F/m = 20/4.' ],
    ['What law explains action and reaction?', ['Newton first', 'Newton second', 'Newton third', 'Law of gravitation'], 'Newton third', 'Every action has equal and opposite reaction.' ],
    ['Momentum is the product of:', ['Mass and velocity', 'Force and time', 'Mass and acceleration', 'Pressure and area'], 'Mass and velocity', 'p = mv.' ],
    ['Impulse equals change in:', ['Energy', 'Momentum', 'Power', 'Work'], 'Momentum', 'Impulse = change in momentum.' ],
    ['The unit of momentum is:', ['kg m/s', 'N/m', 'J/s', 'N'], 'kg m/s', 'Momentum has unit kg·m/s.' ],
  ];

  return templates.map(([text, options, answer, explanation], index) =>
    makeQuestion({
      examType: 'JEE',
      subject: 'Physics',
      topic: 'Dynamics',
      subtopic: index % 2 === 0 ? 'Newton Laws' : 'Momentum',
      difficulty: pickDifficulty(index + 2),
      text,
      options,
      correctAnswerIndex: options.indexOf(answer),
      explanation,
      mistakeType: pickMistakeType(index + 2),
    })
  );
};

const physicsElectricity = () => {
  const templates = [
    ['What is the SI unit of electric current?', ['Volt', 'Ampere', 'Ohm', 'Coulomb'], 'Ampere', 'Current is measured in amperes.'],
    ['Equivalent resistance of two 6 Ω resistors in parallel is?', ['12 Ω', '6 Ω', '3 Ω', '1.5 Ω'], '3 Ω', 'For equal resistors in parallel, Req = R/2.'],
    ['Ohm’s law is V =', ['IR', 'I/R', 'R/I', 'IV'], 'IR', 'Voltage equals current times resistance.'],
    ['If V = 12 V and R = 4 Ω, current is?', ['2 A', '3 A', '4 A', '6 A'], '3 A', 'Use I = V/R = 12/4.' ],
    ['Electrical power is given by:', ['VI', 'V/I', 'IR', 'I^2/R'], 'VI', 'Power is voltage times current.' ],
    ['Unit of resistance is:', ['Ampere', 'Volt', 'Ohm', 'Watt'], 'Ohm', 'Resistance is measured in ohms.' ],
    ['In a series circuit, current is:', ['Divided', 'Same through all components', 'Zero', 'Infinite'], 'Same through all components', 'Current remains same in series.' ],
    ['In a parallel circuit, voltage is:', ['Divided', 'Same across branches', 'Zero', 'Infinite'], 'Same across branches', 'Voltage is same in parallel branches.' ],
    ['A 2 Ω and 3 Ω resistor in series have total resistance:', ['1 Ω', '5 Ω', '6 Ω', '1.5 Ω'], '5 Ω', 'Series resistance adds directly.' ],
    ['What does a fuse protect against?', ['Low voltage', 'Overcurrent', 'Low frequency', 'Noise'], 'Overcurrent', 'A fuse melts when current is excessive.'],
  ];

  return templates.map(([text, options, answer, explanation], index) =>
    makeQuestion({
      examType: 'JEE',
      subject: 'Physics',
      topic: 'Current Electricity',
      subtopic: index % 2 === 0 ? 'Circuits' : 'Ohm Law',
      difficulty: pickDifficulty(index),
      text,
      options,
      correctAnswerIndex: options.indexOf(answer),
      explanation,
      mistakeType: pickMistakeType(index),
    })
  );
};

const physicsThermodynamics = () => {
  const templates = [
    ['SI unit of temperature is:', ['Kelvin', 'Celsius', 'Fahrenheit', 'Joule'], 'Kelvin', 'The SI unit of temperature is Kelvin.'],
    ['Heat is transferred spontaneously from:', ['Cold to hot', 'Hot to cold', 'Low pressure to high pressure', 'None'], 'Hot to cold', 'Heat flows from higher to lower temperature.'],
    ['One calorie is approximately equal to:', ['4.18 J', '10 J', '1 J', '100 J'], '4.18 J', '1 calorie ≈ 4.18 joules.'],
    ['At constant pressure, process related to gas heating is:', ['Isobaric', 'Isochoric', 'Isothermal', 'Adiabatic'], 'Isobaric', 'Pressure stays constant in an isobaric process.'],
    ['The first law of thermodynamics is a statement of conservation of:', ['Mass', 'Energy', 'Momentum', 'Charge'], 'Energy', 'Energy cannot be created or destroyed.'],
    ['A system with no heat exchange is:', ['Isothermal', 'Adiabatic', 'Isobaric', 'Cyclic'], 'Adiabatic', 'Adiabatic means no heat transfer.'],
    ['Internal energy of an ideal gas depends on:', ['Pressure only', 'Temperature only', 'Volume only', 'Mass only'], 'Temperature only', 'For ideal gas, internal energy depends on temperature.'],
    ['What happens to temperature during melting of ice at 0°C?', ['Increases', 'Decreases', 'Remains constant', 'Becomes infinite'], 'Remains constant', 'Heat is used as latent heat.'],
    ['The SI unit of heat is:', ['Watt', 'Joule', 'Newton', 'Kelvin'], 'Joule', 'Heat is a form of energy.'],
    ['Efficiency of a heat engine is always:', ['100%', '< 100%', '> 100%', '0%'], '< 100%', 'No heat engine can be 100% efficient.'],
  ];

  return templates.map(([text, options, answer, explanation], index) =>
    makeQuestion({
      examType: 'JEE',
      subject: 'Physics',
      topic: 'Thermodynamics',
      subtopic: index % 2 === 0 ? 'Laws of Thermodynamics' : 'Thermal Processes',
      difficulty: pickDifficulty(index + 1),
      text,
      options,
      correctAnswerIndex: options.indexOf(answer),
      explanation,
      mistakeType: pickMistakeType(index + 1),
    })
  );
};

const physicsWaves = () => {
  const templates = [
    ['The SI unit of frequency is:', ['Watt', 'Newton', 'Hertz', 'Joule'], 'Hertz', 'Frequency is measured in hertz.'],
    ['Wavelength is measured in:', ['m/s', 'meter', 'Hz', 'N'], 'meter', 'Wavelength is a length quantity.'],
    ['Speed of wave =', ['Frequency / wavelength', 'Wavelength × frequency', 'Wavelength / frequency', 'Frequency + wavelength'], 'Wavelength × frequency', 'v = fλ.'],
    ['A wave with higher frequency has:', ['Longer wavelength', 'Shorter wavelength', 'Same wavelength', 'No wavelength'], 'Shorter wavelength', 'For fixed speed, frequency and wavelength are inversely related.'],
    ['Sound cannot travel through:', ['Water', 'Air', 'Vacuum', 'Steel'], 'Vacuum', 'Sound needs a material medium.'],
    ['The loudness of sound depends on:', ['Amplitude', 'Frequency', 'Speed', 'Wavelength'], 'Amplitude', 'Loudness is related to amplitude.'],
    ['The pitch of sound depends on:', ['Amplitude', 'Frequency', 'Wavelength', 'Speed'], 'Frequency', 'Pitch depends on frequency.'],
    ['The unit of amplitude is the same as:', ['Frequency', 'Wave speed', 'Displacement', 'Time'], 'Displacement', 'Amplitude is maximum displacement.'],
    ['A wave traveling with speed 20 m/s and frequency 5 Hz has wavelength:', ['2 m', '4 m', '5 m', '10 m'], '4 m', 'Use λ = v/f = 20/5.' ],
    ['A reflection of a wave from a fixed end causes:', ['Rarefaction', 'Inversion', 'No change', 'Absorption'], 'Inversion', 'Reflected wave inverts at a fixed end.'],
  ];

  return templates.map(([text, options, answer, explanation], index) =>
    makeQuestion({
      examType: 'JEE',
      subject: 'Physics',
      topic: 'Waves',
      subtopic: index % 2 === 0 ? 'Wave Properties' : 'Sound Waves',
      difficulty: pickDifficulty(index),
      text,
      options,
      correctAnswerIndex: options.indexOf(answer),
      explanation,
      mistakeType: pickMistakeType(index),
    })
  );
};

const chemistryMoleConcept = () => {
  const templates = [
    ['How many molecules are present in 1 mole of a substance?', ['6.022 × 10^23', '3.01 × 10^23', '1.0 × 10^22', '9.11 × 10^31'], '6.022 × 10^23', 'One mole contains Avogadro’s number of entities.'],
    ['How many moles are present in 44 g of CO2?', ['0.5 mole', '1 mole', '2 mole', '4 mole'], '1 mole', 'Molar mass of CO2 is 44 g/mol.'],
    ['Molar mass of H2O is:', ['16 g/mol', '18 g/mol', '20 g/mol', '22 g/mol'], '18 g/mol', '2 + 16 = 18 g/mol.'],
    ['How many atoms are in 2 moles of helium?', ['6.022 × 10^23', '1.204 × 10^24', '3.01 × 10^23', '2.0 × 10^23'], '1.204 × 10^24', 'Multiply Avogadro’s number by 2.'],
    ['Volume of 1 mole of ideal gas at STP is:', ['11.2 L', '22.4 L', '44.8 L', '1.0 L'], '22.4 L', 'Molar volume at STP is 22.4 L.'],
    ['How many moles are in 11.2 L of ideal gas at STP?', ['0.25 mole', '0.5 mole', '1 mole', '2 mole'], '0.5 mole', '11.2 is half of 22.4.'],
    ['If 2 moles contain x particles, x equals:', ['3.01 × 10^23', '6.02 × 10^23', '1.204 × 10^24', '2.408 × 10^24'], '1.204 × 10^24', '2 × Avogadro’s number.'],
    ['How many molecules are in 0.5 mole of a substance?', ['3.01 × 10^23', '6.02 × 10^23', '1.2 × 10^24', '9.0 × 10^22'], '3.01 × 10^23', 'Half of Avogadro’s number.'],
    ['Molar mass of NaCl is approximately:', ['23 g/mol', '35.5 g/mol', '58.5 g/mol', '60 g/mol'], '58.5 g/mol', 'Na + Cl = 23 + 35.5.'],
    ['Mass of 1 mole of oxygen gas O2 is:', ['16 g', '24 g', '32 g', '44 g'], '32 g', 'O2 has atomic mass 16 × 2.'],
  ];

  return templates.map(([text, options, answer, explanation], index) =>
    makeQuestion({
      examType: 'NEET',
      subject: 'Chemistry',
      topic: 'Mole Concept',
      subtopic: index % 2 === 0 ? 'Mole and Mass' : 'Avogadro Number',
      difficulty: pickDifficulty(index),
      text,
      options,
      correctAnswerIndex: options.indexOf(answer),
      explanation,
      mistakeType: pickMistakeType(index),
    })
  );
};

const chemistryAtomicStructure = () => {
  const templates = [
    ['Atomic number of Carbon is:', ['4', '6', '8', '12'], '6', 'Carbon has 6 protons.'],
    ['Which particle has a positive charge?', ['Electron', 'Neutron', 'Proton', 'Photon'], 'Proton', 'Protons are positively charged.'],
    ['Electrons were discovered by:', ['Rutherford', 'Thomson', 'Bohr', 'Mendel'], 'Thomson', 'J. J. Thomson discovered the electron.'],
    ['Maximum electrons in the first shell is:', ['2', '8', '18', '32'], '2', 'First shell has only 2 electrons.'],
    ['The mass number is the sum of:', ['Protons and electrons', 'Protons and neutrons', 'Neutrons and electrons', 'Only protons'], 'Protons and neutrons', 'Mass number equals protons + neutrons.'],
    ['The charge of an electron is:', ['+1', '0', '-1', '+2'], '-1', 'Electron has negative charge.'],
    ['Which of these is neutral?', ['Proton', 'Electron', 'Neutron', 'Positron'], 'Neutron', 'Neutrons carry no charge.'],
    ['Bohr model explained:', ['Particle spin', 'Hydrogen spectrum', 'Chemical bonding', 'Radioactivity'], 'Hydrogen spectrum', 'Bohr explained line spectrum of hydrogen.'],
    ['The number of electrons in a neutral sodium atom is:', ['10', '11', '12', '23'], '11', 'Neutral atom has electrons equal to atomic number.'],
    ['Which shell is closest to the nucleus?', ['K shell', 'L shell', 'M shell', 'N shell'], 'K shell', 'K shell is the first shell.'],
  ];

  return templates.map(([text, options, answer, explanation], index) =>
    makeQuestion({
      examType: 'NEET',
      subject: 'Chemistry',
      topic: 'Atomic Structure',
      subtopic: index % 2 === 0 ? 'Subatomic Particles' : 'Bohr Model',
      difficulty: pickDifficulty(index + 1),
      text,
      options,
      correctAnswerIndex: options.indexOf(answer),
      explanation,
      mistakeType: pickMistakeType(index + 1),
    })
  );
};

const chemistryPeriodicTable = () => {
  const templates = [
    ['The first element in the periodic table is:', ['Helium', 'Hydrogen', 'Lithium', 'Oxygen'], 'Hydrogen', 'Hydrogen has atomic number 1.'],
    ['Group 18 elements are called:', ['Alkali metals', 'Halogens', 'Noble gases', 'Transition metals'], 'Noble gases', 'They are chemically inert in general.'],
    ['Periodic table is arranged by increasing:', ['Mass number', 'Atomic number', 'Valency', 'Density'], 'Atomic number', 'Modern periodic table follows atomic number.'],
    ['Which is an alkali metal?', ['Sodium', 'Chlorine', 'Oxygen', 'Argon'], 'Sodium', 'Sodium belongs to group 1.'],
    ['Which of these has the highest electronegativity?', ['Fluorine', 'Sodium', 'Potassium', 'Calcium'], 'Fluorine', 'Fluorine is most electronegative.'],
    ['Elements in the same group have similar:', ['Atomic mass', 'Valency', 'Density', 'State only'], 'Valency', 'Same group generally have similar valence electrons.'],
    ['Which is a halogen?', ['Neon', 'Fluorine', 'Magnesium', 'Iron'], 'Fluorine', 'Fluorine is group 17.'],
    ['The number of periods in the periodic table is:', ['5', '6', '7', '8'], '7', 'There are 7 periods.'],
    ['What is the symbol of sodium?', ['Na', 'So', 'Sd', 'Sn'], 'Na', 'Sodium symbol is Na.'],
    ['Which element is in group 2?', ['Magnesium', 'Chlorine', 'Carbon', 'Neon'], 'Magnesium', 'Magnesium is an alkaline earth metal.'],
  ];

  return templates.map(([text, options, answer, explanation], index) =>
    makeQuestion({
      examType: 'NEET',
      subject: 'Chemistry',
      topic: 'Periodic Table',
      subtopic: index % 2 === 0 ? 'Groups' : 'Periods',
      difficulty: pickDifficulty(index),
      text,
      options,
      correctAnswerIndex: options.indexOf(answer),
      explanation,
      mistakeType: pickMistakeType(index),
    })
  );
};

const chemistryBonding = () => {
  const templates = [
    ['Which bond involves complete transfer of electrons?', ['Covalent', 'Ionic', 'Hydrogen', 'Metallic'], 'Ionic', 'Ionic bonding involves electron transfer.'],
    ['A bond formed by sharing electrons is:', ['Ionic', 'Covalent', 'Coordinate only', 'Metallic'], 'Covalent', 'Covalent bonds involve sharing.'],
    ['The bond between Na and Cl in NaCl is:', ['Ionic', 'Covalent', 'Hydrogen', 'Van der Waals'], 'Ionic', 'Sodium transfers electron to chlorine.'],
    ['Which molecule has a coordinate bond?', ['NH4+', 'O2', 'H2', 'Cl2'], 'NH4+', 'Ammonium ion forms through coordinate donation.'],
    ['Hydrogen bonding is strongest in:', ['H2S', 'H2O', 'HCl', 'CH4'], 'H2O', 'Water shows strong hydrogen bonding.'],
    ['Metallic bonding is found in:', ['NaCl', 'Copper', 'CO2', 'NH3'], 'Copper', 'Metals exhibit metallic bonding.'],
    ['A covalent bond usually forms between:', ['Metal and non-metal', 'Two non-metals', 'Two metals', 'Noble gases'], 'Two non-metals', 'Covalent bonding usually occurs between non-metals.'],
    ['What is the main reason atoms form bonds?', ['To become unstable', 'To lower energy', 'To increase charge', 'To decrease mass'], 'To lower energy', 'Bond formation lowers potential energy.'],
    ['Which force holds positive and negative ions together?', ['Magnetic force', 'Electrostatic attraction', 'Centrifugal force', 'Gravity'], 'Electrostatic attraction', 'Oppositely charged ions attract each other.'],
    ['Which is a non-polar covalent molecule?', ['H2O', 'NH3', 'O2', 'HCl'], 'O2', 'Two identical atoms share electrons equally.'],
  ];

  return templates.map(([text, options, answer, explanation], index) =>
    makeQuestion({
      examType: 'NEET',
      subject: 'Chemistry',
      topic: 'Chemical Bonding',
      subtopic: index % 2 === 0 ? 'Bond Type' : 'Molecular Structure',
      difficulty: pickDifficulty(index + 2),
      text,
      options,
      correctAnswerIndex: options.indexOf(answer),
      explanation,
      mistakeType: pickMistakeType(index + 2),
    })
  );
};

const chemistryEquilibrium = () => {
  const templates = [
    ['At equilibrium, the rates of forward and reverse reactions are:', ['Unequal', 'Equal', 'Zero', 'Infinite'], 'Equal', 'Dynamic equilibrium means equal rates.'],
    ['Equilibrium constant is denoted by:', ['Kc', 'Ke', 'Kr', 'Kv'], 'Kc', 'Kc is commonly used for concentration equilibrium.'],
    ['Le Chatelier’s principle predicts the system will:', ['Oppose change', 'Amplify change', 'Ignore change', 'Stop reaction'], 'Oppose change', 'A system counteracts applied stress.'],
    ['If product concentration increases, equilibrium shifts:', ['Left', 'Right', 'No shift', 'Stops'], 'Left', 'System reduces added product.'],
    ['A catalyst at equilibrium:', ['Changes Kc', 'Shifts equilibrium', 'Speeds both directions equally', 'Stops reaction'], 'Speeds both directions equally', 'Catalyst lowers activation energy for both directions.'],
    ['For endothermic forward reaction, increasing temperature shifts equilibrium:', ['Left', 'Right', 'No shift', 'Depends only on pressure'], 'Right', 'Heat acts like a reactant.'],
    ['For exothermic forward reaction, increasing temperature shifts equilibrium:', ['Left', 'Right', 'No shift', 'Stops'], 'Left', 'System tries to absorb the extra heat.'],
    ['A dynamic equilibrium exists in:', ['Open system only', 'Closed system', 'Vacuum only', 'Solid state only'], 'Closed system', 'Equilibrium requires no net exchange with surroundings.'],
    ['If pressure increases for a gaseous equilibrium, system shifts to:', ['More moles of gas', 'Fewer moles of gas', 'No change', 'Solid products only'], 'Fewer moles of gas', 'Higher pressure favors fewer gas molecules.'],
    ['Concentration of reactants at equilibrium is:', ['Always zero', 'Constant', 'Always increasing', 'Always decreasing'], 'Constant', 'At equilibrium concentrations remain constant.'],
  ];

  return templates.map(([text, options, answer, explanation], index) =>
    makeQuestion({
      examType: 'NEET',
      subject: 'Chemistry',
      topic: 'Equilibrium',
      subtopic: index % 2 === 0 ? 'Chemical Equilibrium' : 'Le Chatelier Principle',
      difficulty: pickDifficulty(index + 1),
      text,
      options,
      correctAnswerIndex: options.indexOf(answer),
      explanation,
      mistakeType: pickMistakeType(index + 1),
    })
  );
};

const biologyCellStructure = () => {
  const templates = [
    ['Powerhouse of the cell is:', ['Nucleus', 'Mitochondria', 'Golgi body', 'Ribosome'], 'Mitochondria', 'Mitochondria produce ATP.'],
    ['The site of protein synthesis is:', ['Ribosome', 'Lysosome', 'Vacuole', 'Nucleus'], 'Ribosome', 'Ribosomes synthesize proteins.'],
    ['Cell membrane is mainly made of:', ['Protein only', 'Phospholipid bilayer', 'Cellulose', 'Starch'], 'Phospholipid bilayer', 'Membrane structure follows the fluid mosaic model.'],
    ['The control center of the cell is:', ['Nucleus', 'Mitochondria', 'ER', 'Golgi body'], 'Nucleus', 'Nucleus contains genetic material.'],
    ['Which organelle digests waste?', ['Golgi body', 'Lysosome', 'Chloroplast', 'Ribosome'], 'Lysosome', 'Lysosomes contain digestive enzymes.'],
    ['Plant cells have:', ['Centrioles', 'Cell wall', 'No vacuole', 'No nucleus'], 'Cell wall', 'Plant cells have a cellulose cell wall.'],
    ['Organelle responsible for photosynthesis is:', ['Mitochondria', 'Chloroplast', 'Lysosome', 'Nucleus'], 'Chloroplast', 'Chloroplast contains chlorophyll.'],
    ['The fluid inside the cell is:', ['Cytoplasm', 'Plasma', 'Xylem', 'Sap'], 'Cytoplasm', 'Cytoplasm is the cell’s internal fluid matrix.'],
    ['Which structure stores genetic material?', ['Nucleus', 'Vacuole', 'Ribosome', 'Cell wall'], 'Nucleus', 'DNA is housed in the nucleus.'],
    ['The basic structural unit of life is:', ['Tissue', 'Organ', 'Cell', 'System'], 'Cell', 'Cells are the fundamental units of life.'],
  ];

  return templates.map(([text, options, answer, explanation], index) =>
    makeQuestion({
      examType: 'NEET',
      subject: 'Biology',
      topic: 'Cell Structure',
      subtopic: index % 2 === 0 ? 'Cell Organelle' : 'Cell Membrane',
      difficulty: pickDifficulty(index),
      text,
      options,
      correctAnswerIndex: options.indexOf(answer),
      explanation,
      mistakeType: pickMistakeType(index),
    })
  );
};

const biologyGenetics = () => {
  const templates = [
    ['Father of Genetics is:', ['Darwin', 'Mendel', 'Lamarck', 'Watson'], 'Mendel', 'Gregor Mendel discovered inheritance laws.'],
    ['Genes are located on:', ['Ribosomes', 'Chromosomes', 'Lysosomes', 'Centrioles'], 'Chromosomes', 'Genes are segments of DNA on chromosomes.'],
    ['A dominant trait appears in:', ['Only homozygous state', 'Heterozygous and homozygous dominant', 'Only recessive state', 'Neither state'], 'Heterozygous and homozygous dominant', 'Dominant alleles mask recessive alleles.'],
    ['The process of passing traits from parents to offspring is:', ['Evolution', 'Inheritance', 'Mutation', 'Replication'], 'Inheritance', 'Inheritance transmits traits.'],
    ['A genotype is:', ['Physical appearance', 'Genetic makeup', 'Habit', 'Environment'], 'Genetic makeup', 'Genotype describes the allele combination.'],
    ['A phenotype is:', ['Genetic code', 'Physical appearance', 'Chromosome number', 'Protein synthesis'], 'Physical appearance', 'Phenotype is the observable trait.'],
    ['Offspring from TT × tt will be:', ['All Tt', 'All tt', 'All TT', '1:1 ratio'], 'All Tt', 'Each offspring gets one allele from each parent.'],
    ['Mutation means:', ['Unchanged gene', 'Sudden change in DNA', 'Protein folding', 'Cell division',], 'Sudden change in DNA', 'Mutation is a change in genetic material.'],
    ['Which scientist worked on pea plants?', ['Mendel', 'Darwin', 'Miller', 'Morse'], 'Mendel', 'Mendel performed pea plant experiments.'],
    ['Alleles are:', ['Different forms of a gene', 'Different organs', 'Different proteins', 'Different cells'], 'Different forms of a gene', 'Alleles are alternate gene forms.'],
  ];

  return templates.map(([text, options, answer, explanation], index) =>
    makeQuestion({
      examType: 'NEET',
      subject: 'Biology',
      topic: 'Genetics',
      subtopic: index % 2 === 0 ? 'Mendelian Inheritance' : 'Genetic Terms',
      difficulty: pickDifficulty(index + 1),
      text,
      options,
      correctAnswerIndex: options.indexOf(answer),
      explanation,
      mistakeType: pickMistakeType(index + 1),
    })
  );
};

const biologyHumanPhysiology = () => {
  const templates = [
    ['The normal human heart has how many chambers?', ['2', '3', '4', '5'], '4', 'The heart has two atria and two ventricles.'],
    ['The oxygen-carrying pigment in blood is:', ['Chlorophyll', 'Hemoglobin', 'Myoglobin', 'Keratin'], 'Hemoglobin', 'Hemoglobin carries oxygen in red blood cells.'],
    ['The largest organ in the human body is:', ['Heart', 'Brain', 'Skin', 'Liver'], 'Skin', 'Skin is the largest organ.'],
    ['Digestion of proteins begins in the:', ['Mouth', 'Stomach', 'Small intestine', 'Large intestine'], 'Stomach', 'Pepsin in the stomach starts protein digestion.'],
    ['The functional unit of kidney is:', ['Nephron', 'Neuron', 'Alveolus', 'Villus'], 'Nephron', 'Nephrons filter blood.'],
    ['The main function of lungs is:', ['Digestion', 'Exchange gases', 'Pump blood', 'Store bile'], 'Exchange gases', 'Lungs exchange oxygen and carbon dioxide.'],
    ['The hormone that lowers blood glucose is:', ['Adrenaline', 'Insulin', 'Thyroxine', 'Estrogen'], 'Insulin', 'Insulin reduces blood sugar levels.'],
    ['The valve between left atrium and left ventricle is:', ['Tricuspid', 'Bicuspid', 'Semilunar', 'Mitral only'], 'Bicuspid', 'Also called mitral valve.'],
    ['The normal resting pulse rate is approximately:', ['20-30', '40-50', '60-100', '120-140'], '60-100', 'Adult resting pulse is around this range.'],
    ['The process of taking in oxygen and giving out carbon dioxide is called:', ['Respiration', 'Photosynthesis', 'Transpiration', 'Osmosis'], 'Respiration', 'Respiration involves gas exchange and energy release.'],
  ];

  return templates.map(([text, options, answer, explanation], index) =>
    makeQuestion({
      examType: 'NEET',
      subject: 'Biology',
      topic: 'Human Physiology',
      subtopic: index % 2 === 0 ? 'Circulatory System' : 'Respiration and Excretion',
      difficulty: pickDifficulty(index),
      text,
      options,
      correctAnswerIndex: options.indexOf(answer),
      explanation,
      mistakeType: pickMistakeType(index),
    })
  );
};

const biologyEcology = () => {
  const templates = [
    ['The number of organisms in a food chain is usually:', ['Always equal', 'Decreasing at higher levels', 'Increasing at higher levels', 'Irrelevant'], 'Decreasing at higher levels', 'Energy transfer limits higher trophic levels.'],
    ['Green plants in an ecosystem are:', ['Consumers', 'Producers', 'Decomposers', 'Parasites'], 'Producers', 'Plants make their own food.'],
    ['A food chain starts with:', ['Consumers', 'Producers', 'Decomposers', 'Predators'], 'Producers', 'Energy enters through producers.'],
    ['Which gas do plants absorb for photosynthesis?', ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'], 'Carbon dioxide', 'Plants use CO2 in photosynthesis.'],
    ['The study of interactions of organisms and environment is:', ['Genetics', 'Ecology', 'Anatomy', 'Physiology'], 'Ecology', 'Ecology studies organism-environment relations.'],
    ['Decomposers are mainly:', ['Birds', 'Fungi and bacteria', 'Herbivores', 'Insects only'], 'Fungi and bacteria', 'They break down dead matter.'],
    ['The 10% law is related to:', ['Cell division', 'Energy transfer', 'Osmosis', 'Mutation'], 'Energy transfer', 'Only about 10% energy passes to the next trophic level.'],
    ['Biodiversity refers to:', ['Only plants', 'Variety of life forms', 'Only animals', 'Only microbes'], 'Variety of life forms', 'Biodiversity includes all living organisms.'],
    ['An example of a primary consumer is:', ['Lion', 'Grasshopper', 'Fungus', 'Snake'], 'Grasshopper', 'Primary consumers eat producers.'],
    ['The water cycle is powered mainly by:', ['Wind', 'Sun', 'Moon', 'Pressure'], 'Sun', 'Solar energy drives evaporation.'],
  ];

  return templates.map(([text, options, answer, explanation], index) =>
    makeQuestion({
      examType: 'NEET',
      subject: 'Biology',
      topic: 'Ecology',
      subtopic: index % 2 === 0 ? 'Food Chains' : 'Ecosystem Cycles',
      difficulty: pickDifficulty(index + 2),
      text,
      options,
      correctAnswerIndex: options.indexOf(answer),
      explanation,
      mistakeType: pickMistakeType(index + 2),
    })
  );
};

const biologyPlantPhysiology = () => {
  const templates = [
    ['Transport of water in plants occurs through:', ['Phloem', 'Xylem', 'Cambium', 'Stomata'], 'Xylem', 'Xylem carries water and minerals.'],
    ['Loss of water vapor from leaves is:', ['Respiration', 'Transpiration', 'Photosynthesis', 'Germination'], 'Transpiration', 'Transpiration occurs mainly through stomata.'],
    ['The green pigment in plants is:', ['Hemoglobin', 'Chlorophyll', 'Keratin', 'Myosin'], 'Chlorophyll', 'Chlorophyll captures light energy.'],
    ['Opening and closing of stomata are controlled by:', ['Guard cells', 'Root hairs', 'Xylem', 'Phloem'], 'Guard cells', 'Guard cells regulate stomatal aperture.'],
    ['Photosynthesis mainly occurs in:', ['Roots', 'Leaves', 'Stem bark', 'Flowers'], 'Leaves', 'Leaves contain chloroplast-rich mesophyll cells.'],
    ['Mineral absorption in plants occurs mainly through:', ['Leaves', 'Root hairs', 'Stomata', 'Seeds'], 'Root hairs', 'Root hairs absorb water and minerals.'],
    ['Food manufactured in leaves is transported by:', ['Xylem', 'Phloem', 'Stomata', 'Cuticle'], 'Phloem', 'Phloem carries prepared food.'],
    ['The process by which seeds sprout is:', ['Pollination', 'Germination', 'Fertilization', 'Transpiration'], 'Germination', 'Germination is sprouting of the seed.'],
    ['Plants absorb sunlight using:', ['Ribosomes', 'Chlorophyll', 'Cell wall', 'Vacuole'], 'Chlorophyll', 'Chlorophyll absorbs light energy.'],
    ['The gas released during photosynthesis is:', ['Carbon dioxide', 'Oxygen', 'Nitrogen', 'Hydrogen'], 'Oxygen', 'Oxygen is released as a byproduct.'],
  ];

  return templates.map(([text, options, answer, explanation], index) =>
    makeQuestion({
      examType: 'NEET',
      subject: 'Biology',
      topic: 'Plant Physiology',
      subtopic: index % 2 === 0 ? 'Transport' : 'Photosynthesis',
      difficulty: pickDifficulty(index),
      text,
      options,
      correctAnswerIndex: options.indexOf(answer),
      explanation,
      mistakeType: pickMistakeType(index),
    })
  );
};

const subjectBanks = {
  mathematics: algebraQuestions().concat(quadraticQuestions(), probabilityQuestions(), trigonometryQuestions(), calculusQuestions()),
  physics: physicsKinematics().concat(physicsDynamics(), physicsElectricity(), physicsThermodynamics(), physicsWaves()),
  chemistry: chemistryMoleConcept().concat(chemistryAtomicStructure(), chemistryPeriodicTable(), chemistryBonding(), chemistryEquilibrium()),
  biology: biologyCellStructure().concat(biologyGenetics(), biologyHumanPhysiology(), biologyEcology(), biologyPlantPhysiology()),
};

ensureDir(outputDir);

Object.entries(subjectBanks).forEach(([filename, questions]) => {
  const filePath = path.join(outputDir, `${filename}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(questions, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${questions.length} questions to ${path.relative(process.cwd(), filePath)}`);
});
