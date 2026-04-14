import { useState } from 'react';
import { CatCharacter } from './CatCharacter';
import { SpeechBubble } from './SpeechBubble';
import type { QuestionDTO, WorkDTO, Answer } from '../types/game';
import styles from './GameScreen.module.css';

interface GameScreenProps {
  question: QuestionDTO | null;
  guess: { work: WorkDTO; confidence: number } | null;
  questionNumber: number;
  remainingCandidates: number;
  onAnswer: (answer: Answer) => Promise<void>;
  onGuessResponse: (correct: boolean) => Promise<void>;
}

export function GameScreen({
  question,
  guess,
  questionNumber,
  remainingCandidates,
  onAnswer,
  onGuessResponse,
}: GameScreenProps) {
  const [loading, setLoading] = useState(false);

  const handleAnswer = async (answer: Answer) => {
    if (loading) return;
    setLoading(true);
    try {
      await onAnswer(answer);
    } finally {
      setLoading(false);
    }
  };

  const handleGuess = async (correct: boolean) => {
    if (loading) return;
    setLoading(true);
    try {
      await onGuessResponse(correct);
    } finally {
      setLoading(false);
    }
  };

  const isGuessing = guess !== null;

  return (
    <div className={styles.container}>
      <div className={styles.progress}>
        <span className={styles.questionNum}>Q{questionNumber}</span>
        {remainingCandidates > 0 && (
          <span className={styles.candidates}>
            후보 {remainingCandidates}개
          </span>
        )}
      </div>

      <div className={styles.gameArea}>
        <div className={styles.catSide}>
          <CatCharacter size="medium" animated />
        </div>

        <div className={styles.interactionSide}>
          {isGuessing ? (
            <div className={styles.guessMode} key={`guess-${guess.work.id}`}>
              <SpeechBubble>
                <p className={styles.guessText}>혹시 이 작품인가요?</p>
                <div className={styles.guessWork}>
                  {guess.work.thumbnailUrl && (
                    <img
                      className={styles.guessThumbnail}
                      src={guess.work.thumbnailUrl}
                      alt={guess.work.title}
                    />
                  )}
                  <div className={styles.guessInfo}>
                    <strong className={styles.guessTitle}>
                      {guess.work.title}
                    </strong>
                    {guess.work.author && (
                      <span className={styles.guessAuthor}>
                        {guess.work.author}
                      </span>
                    )}
                  </div>
                </div>
              </SpeechBubble>
              <div className={styles.guessButtons}>
                <button
                  className={styles.btn}
                  onClick={() => handleGuess(true)}
                  disabled={loading}
                >
                  맞아요!
                </button>
                <button
                  className={styles.btn}
                  onClick={() => handleGuess(false)}
                  disabled={loading}
                >
                  아니에요
                </button>
              </div>
            </div>
          ) : question ? (
            <div className={styles.questionMode} key={`q-${question.featureId}-${questionNumber}`}>
              <SpeechBubble>
                <p className={styles.questionText}>{question.text}</p>
              </SpeechBubble>
              <div className={styles.answerButtons}>
                <button
                  className={styles.btn}
                  onClick={() => handleAnswer('yes')}
                  disabled={loading}
                >
                  예
                </button>
                <button
                  className={styles.btn}
                  onClick={() => handleAnswer('no')}
                  disabled={loading}
                >
                  아니오
                </button>
                <button
                  className={styles.btn}
                  onClick={() => handleAnswer('maybe')}
                  disabled={loading}
                >
                  모르겠어요
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
