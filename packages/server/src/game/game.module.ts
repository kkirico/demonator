import { Module } from '@nestjs/common';
import { GameController } from './game.controller';
import { GameEngine } from './engine/game-engine';
import { WorkFeatureCache } from './cache/work-feature.cache';
import { SessionStore } from '../session/session.store';

@Module({
  controllers: [GameController],
  providers: [GameEngine, WorkFeatureCache, SessionStore],
  exports: [GameEngine, WorkFeatureCache],
})
export class GameModule {}
