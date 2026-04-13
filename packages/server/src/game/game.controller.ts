import {
  Controller,
  Post,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { GameEngine } from './engine/game-engine';
import type {
  StartResponse,
  AnswerRequest,
  AnswerResponse,
  GuessRequest,
  GuessResponse,
  Answer,
} from '../session/session.types';

const VALID_ANSWERS: Answer[] = ['yes', 'no', 'maybe', 'probably', 'probably_not'];

@Controller('game')
export class GameController {
  constructor(private readonly engine: GameEngine) {}

  @Post('start')
  @HttpCode(HttpStatus.CREATED)
  start(): StartResponse {
    return this.engine.startGame();
  }

  @Post(':sessionId/answer')
  @HttpCode(HttpStatus.OK)
  answer(
    @Param('sessionId') sessionId: string,
    @Body() body: AnswerRequest,
  ): AnswerResponse {
    if (!body.answer || !VALID_ANSWERS.includes(body.answer)) {
      throw new BadRequestException(
        `Invalid answer. Must be one of: ${VALID_ANSWERS.join(', ')}`,
      );
    }
    try {
      return this.engine.processAnswer(sessionId, body.answer);
    } catch (e: any) {
      if (e.message?.includes('not found')) {
        throw new NotFoundException(e.message);
      }
      throw e;
    }
  }

  @Post(':sessionId/guess-response')
  @HttpCode(HttpStatus.OK)
  guessResponse(
    @Param('sessionId') sessionId: string,
    @Body() body: GuessRequest,
  ): GuessResponse {
    if (typeof body.correct !== 'boolean') {
      throw new BadRequestException('correct must be a boolean');
    }
    try {
      return this.engine.processGuessResponse(sessionId, body.correct);
    } catch (e: any) {
      if (e.message?.includes('not found')) {
        throw new NotFoundException(e.message);
      }
      throw e;
    }
  }
}
