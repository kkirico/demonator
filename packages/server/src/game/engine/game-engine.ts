import { Injectable } from '@nestjs/common';
import { WorkFeatureCache } from '../cache/work-feature.cache';
import { SessionStore } from '../../session/session.store';
import {
  selectNextQuestion,
  selectTiebreakerQuestion,
  detectTiedCandidates,
  buildQuestionText,
} from './question-selector';
import { updateScores, getTopCandidates } from './score-updater';
import type {
  GameSession,
  Answer,
  QuestionDTO,
  WorkDTO,
  StartResponse,
  AnswerResponse,
  GuessResponse,
} from '../../session/session.types';

const MAX_QUESTIONS = 20;
const GUESS_THRESHOLD = 0.6;
const TOP3_THRESHOLD = 0.8;
const MAX_GUESSES = 10;

@Injectable()
export class GameEngine {
  constructor(
    private readonly cache: WorkFeatureCache,
    private readonly sessionStore: SessionStore,
  ) {}

  startGame(): StartResponse {
    const workIds = this.cache.getAllWorkIds();
    if (workIds.length === 0) {
      throw new Error('No works available in the database');
    }
    
    const session = this.sessionStore.create(workIds);
    const feature = selectNextQuestion(session, this.cache);
    if (!feature) {
      throw new Error('No features available for questioning');
    }

    session.pendingFeatureId = feature.id;

    return {
      sessionId: session.id,
      question: this.buildQuestion(feature.id),
      totalWorks: workIds.length,
      questionNumber: 1,
    };
  }

  processAnswer(sessionId: string, answer: Answer): AnswerResponse {
    const session = this.getSession(sessionId);

    if (session.pendingFeatureId == null) {
      throw new Error('No pending question in session');
    }

    updateScores(session, session.pendingFeatureId, answer, this.cache);
    session.pendingFeatureId = null;

    if (this.shouldGuess(session)) {
      return this.buildGuessResponse(session);
    }

    return this.buildNextQuestionResponse(session);
  }

  processGuessResponse(sessionId: string, correct: boolean): GuessResponse {
    const session = this.getSession(sessionId);

    if (correct) {
      session.status = 'finished';
      return { result: 'correct', totalQuestions: session.questionCount };
    }

    // Mark the top candidate as wrong
    const top = getTopCandidates(session, 1, session.guessedWorkIds);
    if (top.length > 0) {
      session.guessedWorkIds.add(top[0].workId);
    }

    // Try next best guess
    if (session.guessedWorkIds.size < MAX_GUESSES) {
      const nextTop = getTopCandidates(session, 1, session.guessedWorkIds);
      if (nextTop.length > 0 && nextTop[0].score > 0.1) {
        const work = this.cache.getWork(nextTop[0].workId)!;
        return {
          result: 'wrong',
          nextGuess: {
            work: this.toWorkDTO(work),
            confidence: Math.round(nextTop[0].score * 100) / 100,
          },
          questionNumber: session.questionCount,
        };
      }
    }

    // Continue asking if possible
    if (session.questionCount < MAX_QUESTIONS) {
      session.status = 'playing';
      const feature = selectNextQuestion(session, this.cache);
      if (feature) {
        session.pendingFeatureId = feature.id;
        return {
          result: 'wrong',
          question: this.buildQuestion(feature.id),
          questionNumber: session.questionCount + 1,
        };
      }
    }

    session.status = 'finished';
    return { result: 'give_up', totalQuestions: session.questionCount };
  }

  private shouldGuess(session: GameSession): boolean {
    if (session.questionCount >= MAX_QUESTIONS) return true;

    const top = getTopCandidates(session, 3, session.guessedWorkIds);
    if (top.length === 0) return false;

    if (top[0].score >= GUESS_THRESHOLD) return true;

    const top3Sum = top.reduce((sum, c) => sum + c.score, 0);
    if (top3Sum >= TOP3_THRESHOLD) {
      const tiedIds = detectTiedCandidates(top);
      if (tiedIds) {
        const tb = selectTiebreakerQuestion(session, this.cache, tiedIds);
        if (tb) {
          session.pendingFeatureId = tb.id;
          return false;
        }
      }
      return true;
    }

    return false;
  }

  private buildGuessResponse(session: GameSession): AnswerResponse {
    session.status = 'guessing';
    const top = getTopCandidates(session, 1, session.guessedWorkIds);

    if (top.length === 0) {
      return this.buildNextQuestionResponse(session);
    }

    const work = this.cache.getWork(top[0].workId)!;
    return {
      type: 'guess',
      guess: {
        work: this.toWorkDTO(work),
        confidence: Math.round(top[0].score * 100) / 100,
      },
      questionNumber: session.questionCount,
    };
  }

  private buildNextQuestionResponse(session: GameSession): AnswerResponse {
    const feature = selectNextQuestion(session, this.cache);

    if (!feature) {
      return this.buildGuessResponse(session);
    }

    session.pendingFeatureId = feature.id;

    const top = getTopCandidates(session, 1);
    const topWork = top.length > 0 ? this.cache.getWork(top[0].workId) : null;
    const remaining = this.countEffectiveCandidates(session);

    return {
      type: 'question',
      question: this.buildQuestion(feature.id),
      remainingCandidates: remaining,
      topCandidate: {
        title: topWork?.title ?? '',
        confidence: top.length > 0 ? Math.round(top[0].score * 100) / 100 : 0,
      },
      questionNumber: session.questionCount + 1,
    };
  }

  private buildQuestion(featureId: number): QuestionDTO {
    const feature = this.cache.getFeature(featureId)!;
    return {
      featureId: feature.id,
      category: feature.category,
      displayName: feature.displayName,
      text: buildQuestionText(feature),
    };
  }

  private toWorkDTO(work: {
    id: number;
    title: string;
    author: string | null;
    thumbnailUrl: string | null;
    platform: string | null;
    externalId: string | null;
  }): WorkDTO {
    return {
      id: work.id,
      title: work.title,
      author: work.author,
      thumbnailUrl: work.thumbnailUrl,
      platform: work.platform,
      externalId: work.externalId,
    };
  }

  private getSession(sessionId: string): GameSession {
    const session = this.sessionStore.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    return session;
  }

  private countEffectiveCandidates(session: GameSession): number {
    let count = 0;
    const threshold = 1.0 / (session.workScores.size * 10);
    for (const score of session.workScores.values()) {
      if (score > threshold) count++;
    }
    return count;
  }
}
