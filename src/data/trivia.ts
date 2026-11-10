/**
 * === THE ONE PLACE THE FAMILY EDITS: trivia questions + result messages ===
 * The Trivia section/island renders these questions; none are hardcoded in markup. Edit the
 * `prompt`/`options`/`correctIndex` fields below to change the quiz, and `resultMessages` to
 * change the closing message shown for each possible score (index = number of correct answers,
 * 0..11). Every question below is a placeholder — confirm the real answer with the family before
 * launch (see the inline marker on each entry).
 */

export interface TriviaQuestion {
  /** Question prompt text. */
  prompt: string;
  /** Answer choices shown to the player. */
  options: string[];
  /** Index into `options` of the correct answer. */
  correctIndex: number;
}

export const triviaQuestions: TriviaQuestion[] = [
  {
    // PLACEHOLDER — confirmar con la familia
    prompt: '¿Cuál es el color favorito de Ana Sofía?',
    options: ['Rosado', 'Morado', 'Verde', 'Azul'],
    correctIndex: 0,
  },
  {
    // PLACEHOLDER — confirmar con la familia
    prompt: '¿Cuál es la comida favorita de Ana Sofía?',
    options: ['Pizza', 'Arroz con pollo', 'Hamburguesa', 'Pasta'],
    correctIndex: 1,
  },
  {
    // PLACEHOLDER — confirmar con la familia
    prompt: '¿Cuál es la canción favorita de Ana Sofía?',
    options: ['Provenza', 'TQG', 'Cositas que hacíamos', 'La bicicleta'],
    correctIndex: 2,
  },
  {
    // PLACEHOLDER — confirmar con la familia
    prompt: '¿Cuál es la artista favorita de Ana Sofía?',
    options: ['Feid', 'Karol G', 'Bad Bunny', 'Shakira'],
    correctIndex: 1,
  },
  {
    // PLACEHOLDER — confirmar con la familia
    prompt: '¿Cuál es la película favorita de Ana Sofía?',
    options: ['Frozen', 'Moana', 'Enredados', 'La Sirenita'],
    correctIndex: 2,
  },
  {
    // PLACEHOLDER — confirmar con la familia
    prompt: '¿Qué prefiere Ana Sofía?',
    options: ['Gatos', 'Perros', 'Conejos', 'Hámsters'],
    correctIndex: 1,
  },
  {
    // PLACEHOLDER — confirmar con la familia
    prompt: '¿Qué prefiere Ana Sofía?',
    options: ['Día', 'Tarde', 'Noche', 'Madrugada'],
    correctIndex: 2,
  },
  {
    // PLACEHOLDER — confirmar con la familia
    prompt: '¿Qué prefiere Ana Sofía?',
    options: ['Piscina', 'Playa', 'Río', 'Lago'],
    correctIndex: 1,
  },
  {
    // PLACEHOLDER — confirmar con la familia
    prompt: '¿Cuáles son las materias favoritas de Ana Sofía?',
    options: [
      'Español y Sociales',
      'Inglés y Artística',
      'Matemáticas y Ciencias Naturales',
      'Educación Física y Tecnología',
    ],
    correctIndex: 1,
  },
  {
    // PLACEHOLDER — confirmar con la familia
    prompt: '¿Cuál es el mes favorito de Ana Sofía?',
    options: ['Enero', 'Junio', 'Diciembre', 'Agosto'],
    correctIndex: 2,
  },
  {
    // PLACEHOLDER — confirmar con la familia
    prompt: '¿Cuáles son los hobbies de Ana Sofía?',
    options: ['Cocinar y cantar', 'Bailar y maquillarse', 'Dibujar y leer', 'Jugar y correr'],
    correctIndex: 2,
  },
];

/**
 * Closing message shown once all questions are answered, indexed by the player's final score
 * (0 correct .. 11 correct). Family-editable — keep exactly 12 entries (one per possible score).
 */
export const resultMessages: string[] = [
  '¡Ups! Casi no conoces a Ana Sofía, pero seguro bailarás increíble igual 💃',
  'Vas empezando a conocer a Ana Sofía 🌱',
  'Ya vas agarrando el hilo 😉',
  '¡Vas mejorando! Conoces varias cosas de Ana Sofía.',
  '¡Nada mal! Ya sabes bastante de ella.',
  '¡Vas por la mitad y la conoces bien! 🎉',
  '¡Muy bien! Se nota que le pones atención a Ana Sofía.',
  '¡Impresionante! La conoces de verdad.',
  '¡Casi perfecto! Solo te faltaron poquitas.',
  '¡Wow! Eres de sus personas más cercanas 🌸',
  '¡Solo una te faltó! Casi fan #1.',
  '¡Perfecto! Eres su fan #1 🌸',
];
