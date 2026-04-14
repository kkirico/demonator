export interface QuestionDTO {
  featureId: number;
  category: string;
  displayName: string;
  text: string;
}

export interface WorkDTO {
  id: number;
  title: string;
  author: string | null;
  thumbnailUrl: string | null;
  platform: string | null;
  externalId: string | null;
}

export interface StartResponse {
  sessionId: string;
  question: QuestionDTO;
  totalWorks: number;
  questionNumber: number;
}

export type Answer = 'yes' | 'no' | 'maybe';

export interface AnswerResponseQuestion {
  type: 'question';
  question: QuestionDTO;
  remainingCandidates: number;
  topCandidate: { title: string; confidence: number };
  questionNumber: number;
}

export interface AnswerResponseGuess {
  type: 'guess';
  guess: { work: WorkDTO; confidence: number };
  questionNumber: number;
}

export type AnswerResponse = AnswerResponseQuestion | AnswerResponseGuess;

export interface GuessResponseCorrect {
  result: 'correct';
  totalQuestions: number;
}

export interface GuessResponseWrong {
  result: 'wrong';
  nextGuess?: { work: WorkDTO; confidence: number };
  question?: QuestionDTO;
  questionNumber: number;
}

export interface GuessResponseGiveUp {
  result: 'give_up';
  totalQuestions: number;
}

export type GuessResponse =
  | GuessResponseCorrect
  | GuessResponseWrong
  | GuessResponseGiveUp;
