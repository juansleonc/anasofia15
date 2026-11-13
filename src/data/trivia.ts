/**
 * === THE ONE PLACE THE FAMILY EDITS: trivia questions + result messages ===
 * The Trivia section/island renders these questions; none are hardcoded in markup. Edit the
 * `prompt`/`options`/`correctIndex` fields below to change the quiz, and `resultMessages` to
 * change the closing message shown for each possible score (index = number of correct answers,
 * 0..10). Keep exactly one more message than there are questions (11 entries for 10 questions).
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
    prompt: '¿Cuál es el color favorito de Ana Sofía?',
    options: ['Morado', 'Azul', 'Rosado', 'Verde'],
    correctIndex: 2,
  },
  {
    prompt: '¿Cuál es la comida favorita de Ana Sofía?',
    options: ['Pizza', 'Sushi', 'Hamburguesa', 'Pasta'],
    correctIndex: 1,
  },
  {
    prompt: '¿Cuáles son las canciones favoritas de Ana Sofía?',
    options: ['Tusa y Mamiii', 'Provenza y La Bachata', 'Mónaco y Hey Mor', 'Spicy y Do You Mind'],
    correctIndex: 3,
  },
  {
    prompt: '¿Quiénes son los artistas favoritos de Ana Sofía?',
    options: ['Myke Towers y Anuel AA', 'Bad Bunny y Feid', 'Karol G y Shakira', 'J Balvin y Maluma'],
    correctIndex: 0,
  },
  {
    prompt: '¿Cuál es la película favorita de Ana Sofía?',
    options: [
      'Yo antes de ti',
      'Después de',
      'A todos los chicos de los que me enamoré',
      'El stand de los besos',
    ],
    correctIndex: 2,
  },
  {
    prompt: '¿Qué prefiere Ana Sofía?',
    options: ['Perros', 'Gatos', 'Conejos', 'Hámsters'],
    correctIndex: 2,
  },
  {
    prompt: '¿Qué prefiere Ana Sofía?',
    options: ['Día', 'Tarde', 'Noche', 'Madrugada'],
    correctIndex: 0,
  },
  {
    prompt: '¿Qué prefiere Ana Sofía?',
    options: ['Piscina', 'Río', 'Lago', 'Playa'],
    correctIndex: 3,
  },
  {
    prompt: '¿Cuáles son los géneros musicales favoritos de Ana Sofía?',
    options: ['Pop y rock', 'Rap, reguetón y salsa', 'Vallenato y merengue', 'Electrónica y K-pop'],
    correctIndex: 1,
  },
  {
    prompt: '¿Qué le gusta hacer a Ana Sofía en su tiempo libre?',
    options: ['Ver series y maquillarse', 'Cocinar y cantar', 'Dibujar y leer', 'Jugar fútbol y correr'],
    correctIndex: 0,
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
