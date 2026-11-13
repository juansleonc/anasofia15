import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { createTriviaState, answer, progress, isDone, score, resultMessage } from '../trivia';
import { triviaQuestions, resultMessages } from '../../data/trivia';

describe('trivia pure logic', () => {
  // Adversarial cases first: the ways this could silently score wrong or drift from the data file.

  it('consumes all questions from the trivia data module', () => {
    expect(triviaQuestions).toHaveLength(10);
  });

  it('holds the ten confirmed questions with their exact options and answer keys', () => {
    expect(triviaQuestions).toEqual([
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
        options: [
          'Tusa y Mamiii',
          'Provenza y La Bachata',
          'Mónaco y Hey Mor',
          'Spicy y Do You Mind',
        ],
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
        options: [
          'Pop y rock',
          'Rap, reguetón y salsa',
          'Vallenato y merengue',
          'Electrónica y K-pop',
        ],
        correctIndex: 1,
      },
      {
        prompt: '¿Qué le gusta hacer a Ana Sofía en su tiempo libre?',
        options: [
          'Ver series y maquillarse',
          'Cocinar y cantar',
          'Dibujar y leer',
          'Jugar fútbol y correr',
        ],
        correctIndex: 0,
      },
    ]);
  });

  it('marks the confirmed answer as the correct option of each question', () => {
    const confirmed = [
      'Rosado',
      'Sushi',
      'Spicy y Do You Mind',
      'Myke Towers y Anuel AA',
      'A todos los chicos de los que me enamoré',
      'Conejos',
      'Día',
      'Playa',
      'Rap, reguetón y salsa',
      'Ver series y maquillarse',
    ];
    expect(triviaQuestions.map((q) => q.options[q.correctIndex])).toEqual(confirmed);
  });

  it('leaves no placeholder marker in the data file source', () => {
    const source = readFileSync(new URL('../../data/trivia.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/PLACEHOLDER|confirmar con la familia/i);
  });

  it('asks nothing about school subjects or a favourite month', () => {
    for (const question of triviaQuestions) {
      expect(question.prompt).not.toMatch(/materias|mes favorito/i);
    }
  });

  it('keeps every correctIndex within its own options array (no out-of-range answer key)', () => {
    for (const question of triviaQuestions) {
      expect(question.correctIndex).toBeGreaterThanOrEqual(0);
      expect(question.correctIndex).toBeLessThan(question.options.length);
    }
  });

  it('exposes exactly the eleven result messages, one per achievable score', () => {
    expect(resultMessages).toEqual([
      '¡Ups! Casi no conoces a Ana Sofía, pero seguro bailarás increíble igual 💃',
      'Vas empezando a conocer a Ana Sofía 🌱',
      'Ya vas agarrando el hilo 😉',
      '¡Vas mejorando! Conoces varias cosas de Ana Sofía.',
      '¡Nada mal! Ya sabes bastante de ella.',
      '¡Vas por la mitad y la conoces bien! 🎉',
      '¡Muy bien! Se nota que le pones atención a Ana Sofía.',
      '¡Impresionante! La conoces de verdad.',
      '¡Wow! Eres de sus personas más cercanas 🌸',
      '¡Solo una te faltó! Casi fan #1.',
      '¡Perfecto! Eres su fan #1 🌸',
    ]);
    expect(resultMessages).toHaveLength(triviaQuestions.length + 1);
  });

  it('does not increment the score on a wrong answer', () => {
    const state = createTriviaState();
    const wrongIndex = triviaQuestions[0].options.findIndex(
      (_, i) => i !== triviaQuestions[0].correctIndex,
    );

    const next = answer(state, wrongIndex);

    expect(score(next)).toBe(0);
  });

  it('increments the score on a correct answer', () => {
    const state = createTriviaState();

    const next = answer(state, triviaQuestions[0].correctIndex);

    expect(score(next)).toBe(1);
  });

  it('advances progress by one per answered question', () => {
    const state = createTriviaState();
    expect(progress(state)).toBe(0);

    const next = answer(state, triviaQuestions[0].correctIndex);

    expect(progress(next)).toBe(1);
  });

  it('yields a done state with the correct final score after answering every question', () => {
    let state = createTriviaState();
    let expectedScore = 0;

    // Walk every question in the data file, alternating correct/wrong answers, and derive the
    // expected score from the walk itself rather than a hardcoded question count.
    for (const [i, question] of triviaQuestions.entries()) {
      const answerCorrectly = i % 2 === 0;
      if (answerCorrectly) {
        expectedScore += 1;
        state = answer(state, question.correctIndex);
      } else {
        const wrongIndex = question.options.findIndex((_, idx) => idx !== question.correctIndex);
        state = answer(state, wrongIndex);
      }
    }

    expect(isDone(state)).toBe(true);
    expect(score(state)).toBe(expectedScore);
    expect(progress(state)).toBe(triviaQuestions.length);
  });

  it('maps a perfect score to the matching resultMessages entry', () => {
    let state = createTriviaState();
    for (const q of triviaQuestions) {
      state = answer(state, q.correctIndex);
    }

    expect(score(state)).toBe(triviaQuestions.length);
    expect(resultMessage(state)).toBe(resultMessages[triviaQuestions.length]);
  });

  it('has a defined, non-empty message for every achievable score', () => {
    expect(resultMessages).toHaveLength(triviaQuestions.length + 1);

    for (let correct = 0; correct <= triviaQuestions.length; correct++) {
      // Build a finished state from answers: the first `correct` questions right, the rest wrong.
      const answers = triviaQuestions.map((q, i) =>
        i < correct ? q.correctIndex : (q.correctIndex + 1) % q.options.length,
      );
      const message = resultMessage({ answers });
      expect(typeof message).toBe('string');
      expect(message.trim().length).toBeGreaterThan(0);
    }
  });

  it('is a no-op when answering after the trivia is already done (guard)', () => {
    let state = createTriviaState();
    for (const q of triviaQuestions) {
      state = answer(state, q.correctIndex);
    }
    const doneState = state;

    const afterExtraAnswer = answer(doneState, 0);

    expect(afterExtraAnswer).toEqual(doneState);
  });

  it('appends the chosen option index in order', () => {
    let state = createTriviaState();
    state = answer(state, 3);
    state = answer(state, 0);
    state = answer(state, 2);

    expect(state.answers).toEqual([3, 0, 2]);
  });

  it('counts only answers that match the correct index in score', () => {
    const q = triviaQuestions;
    const state = { answers: [q[0].correctIndex, (q[1].correctIndex + 1) % 4, q[2].correctIndex] };

    expect(score(state)).toBe(2);
  });

  it('flips isDone only after the 10th answer', () => {
    let state = createTriviaState();
    for (const [i, q] of triviaQuestions.entries()) {
      expect(isDone(state)).toBe(false);
      expect(progress(state)).toBe(i);
      state = answer(state, q.correctIndex);
    }

    expect(isDone(state)).toBe(true);
  });

  it('does not mutate the state passed to answer (immutability)', () => {
    const state = createTriviaState();
    const before = state.answers;

    const next = answer(state, triviaQuestions[0].correctIndex);

    expect(state.answers).toBe(before);
    expect(state.answers).toEqual([]);
    expect(next.answers).not.toBe(before);
  });
});
