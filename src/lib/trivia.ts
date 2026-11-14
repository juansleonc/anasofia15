/**
 * Pure trivia game logic: given the current state and a chosen option index, returns a NEW state
 * (immutable) reflecting the answer. Reveal timing, confetti, and any other DOM/animation concern
 * belong to the consuming island — this module derives progress/score/done from the ordered answers against the questions
 * in `src/data/trivia.ts`.
 */

import { triviaQuestions, resultMessages } from '../data/trivia';
import { event } from '../data/event';

export interface TriviaState {
  /** Chosen option index for each answered question, in the order they were answered. */
  answers: readonly number[];
}

export function createTriviaState(): TriviaState {
  return { answers: [] };
}

/** Number of questions answered so far (0..triviaQuestions.length). */
export function progress(state: TriviaState): number {
  return state.answers.length;
}

/** True once every question has been answered. */
export function isDone(state: TriviaState): boolean {
  return progress(state) >= triviaQuestions.length;
}

/** Number of answers matching their question's correct index. */
export function score(state: TriviaState): number {
  return state.answers.filter((choice, i) => choice === triviaQuestions[i].correctIndex).length;
}

export function answer(state: TriviaState, optionIndex: number): TriviaState {
  // Guard: once the trivia is done there is no current question left to answer against.
  if (isDone(state)) {
    return state;
  }
  return { answers: [...state.answers, optionIndex] };
}

/** The closing message matching the player's final score, once `isDone(state)` is true. */
export function resultMessage(state: TriviaState): string {
  return resultMessages[score(state)];
}

export interface TriviaResultPayload {
  access_key: string;
  subject: string;
  name: string;
  from_name: string;
  puntaje: string;
  respuestas: string;
  botcheck: string;
}

/** Web3Forms payload reporting a finished game: score plus one line per question with the chosen option. */
export function buildTriviaResultPayload(
  name: string,
  state: TriviaState,
  accessKey: string,
): TriviaResultPayload {
  const trimmed = name.trim();
  const puntaje = `${score(state)}/${triviaQuestions.length}`;
  const respuestas = triviaQuestions
    .map((q, i) => {
      const mark = state.answers[i] === q.correctIndex ? '✓' : '✗';
      return `${i + 1}. ${q.prompt} → ${q.options[state.answers[i]]} ${mark}`;
    })
    .join('\n');
  return {
    access_key: accessKey,
    subject: `Resultado de trivia · XV años · ${event.celebrantName} · ${trimmed} · ${puntaje}`,
    name: trimmed,
    from_name: trimmed,
    puntaje,
    respuestas,
    botcheck: '',
  };
}
