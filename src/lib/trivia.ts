/**
 * Pure trivia game logic: given the current state and a chosen option index, returns a NEW state
 * (immutable) reflecting the answer. Reveal timing, confetti, and any other DOM/animation concern
 * belong to the consuming island — this module only tracks step/score/done against the questions
 * in `src/data/trivia.ts`.
 */

import { triviaQuestions, resultMessages } from '../data/trivia';

export interface TriviaState {
  /** Index (0-based) of the next unanswered question; equals `triviaQuestions.length` when done. */
  step: number;
  /** Number of correct answers so far. */
  score: number;
  /** True once every question has been answered. */
  done: boolean;
}

export function createTriviaState(): TriviaState {
  return { step: 0, score: 0, done: false };
}

export function answer(state: TriviaState, optionIndex: number): TriviaState {
  // Guard: once the trivia is done there is no current question left to answer against.
  if (state.done) {
    return state;
  }

  const question = triviaQuestions[state.step];
  const correct = optionIndex === question.correctIndex;
  const step = state.step + 1;

  return {
    step,
    score: state.score + (correct ? 1 : 0),
    done: step >= triviaQuestions.length,
  };
}

/** Number of questions answered so far (0..triviaQuestions.length). */
export function progress(state: TriviaState): number {
  return state.step;
}

/** The closing message matching the player's final score, once `state.done` is true. */
export function resultMessage(state: TriviaState): string {
  return resultMessages[state.score];
}
