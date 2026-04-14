export type GameStatus = 'playing' | 'guessing' | 'finished';
export type Answer = 'yes' | 'no' | 'maybe' | 'probably' | 'probably_not';

export interface GameSession {
  id: string;
  workScores: Map<number, number>;
  askedFeatures: Set<number>;
  /** feature_ids that have already been guessed wrong */
  guessedWorkIds: Set<number>;
  /** feature_id of the currently pending question awaiting user answer */
  pendingFeatureId: number | null;
  questionCount: number;
  status: GameStatus;
  createdAt: Date;
}

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

export interface AnswerRequest {
  answer: Answer;
}

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

export interface GuessRequest {
  correct: boolean;
}

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
