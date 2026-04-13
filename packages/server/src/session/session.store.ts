import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import type { GameSession } from './session.types';

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class SessionStore {
  private readonly logger = new Logger(SessionStore.name);
  private readonly sessions = new Map<string, GameSession>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.cleanupTimer = setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS);
  }

  create(workIds: number[]): GameSession {
    const id = uuidv4();
    const workScores = new Map<number, number>();
    const initialScore = 1.0 / workIds.length;
    for (const workId of workIds) {
      workScores.set(workId, initialScore);
    }

    const session: GameSession = {
      id,
      workScores,
      askedFeatures: new Set(),
      guessedWorkIds: new Set(),
      pendingFeatureId: null,
      questionCount: 0,
      status: 'playing',
      createdAt: new Date(),
    };

    this.sessions.set(id, session);
    this.logger.log(`Session ${id} created with ${workIds.length} works`);
    return session;
  }

  get(id: string): GameSession | undefined {
    return this.sessions.get(id);
  }

  delete(id: string): void {
    this.sessions.delete(id);
  }

  private cleanup(): void {
    const now = Date.now();
    let removed = 0;
    for (const [id, session] of this.sessions) {
      if (now - session.createdAt.getTime() > SESSION_TTL_MS) {
        this.sessions.delete(id);
        removed++;
      }
    }
    if (removed > 0) {
      this.logger.log(`Cleaned up ${removed} expired sessions`);
    }
  }

  onModuleDestroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }
}
