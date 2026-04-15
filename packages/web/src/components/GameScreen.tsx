import { useState } from 'react';
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
          <img
            src={questionNumber > 3 ? "/assets/ridinator-angry.png" : "/assets/ridinator-hover.png"}
            alt="Ridinator"
            className={styles.characterImg}
          />
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
            <div className={styles.questionMode}>
              <div className={styles.questionCard}>
                <span className={styles.cornerTL} />
                <span className={styles.cornerTR} />
                <span className={styles.cornerBL} />
                <span className={styles.cornerBR} />
                <p className={styles.questionText} key={`q-${question.featureId}-${questionNumber}`}>
                  {question.text}
                </p>
              </div>
              <div className={styles.answerButtons}>
                <button
                  className={`${styles.answerBtn} ${styles.answerYes}`}
                  onClick={() => handleAnswer('yes')}
                  disabled={loading}
                >
                  <span className={`${styles.cornerTL} ${styles.cYes}`} />
                  <span className={`${styles.cornerTR} ${styles.cYes}`} />
                  <span className={`${styles.cornerBL} ${styles.cYes}`} />
                  <span className={`${styles.cornerBR} ${styles.cYes}`} />
                  맞다냥
                </button>
                <button
                  className={`${styles.answerBtn} ${styles.answerNo}`}
                  onClick={() => handleAnswer('no')}
                  disabled={loading}
                >
                  <span className={`${styles.cornerTL} ${styles.cNo}`} />
                  <span className={`${styles.cornerTR} ${styles.cNo}`} />
                  <span className={`${styles.cornerBL} ${styles.cNo}`} />
                  <span className={`${styles.cornerBR} ${styles.cNo}`} />
                  아니다냥
                </button>
                <button
                  className={`${styles.answerBtn} ${styles.answerMaybe}`}
                  onClick={() => handleAnswer('maybe')}
                  disabled={loading}
                >
                  <span className={`${styles.cornerTL} ${styles.cMaybe}`} />
                  <span className={`${styles.cornerTR} ${styles.cMaybe}`} />
                  <span className={`${styles.cornerBL} ${styles.cMaybe}`} />
                  <span className={`${styles.cornerBR} ${styles.cMaybe}`} />
                  모르겠다냥
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
