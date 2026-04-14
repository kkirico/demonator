import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { WorkDTO } from '../types/game';
import styles from './ResultScreen.module.css';

interface ResultScreenProps {
  result: 'correct' | 'give_up';
  work: WorkDTO | null;
  totalQuestions: number;
  onRestart: () => void;
}

const BEAM_COUNT = 100;
const SHOCKWAVE_DELAYS = [100, 800, 1500];

function getWorkUrl(work: WorkDTO): string | null {
  if (work.platform === 'ridi' && work.externalId) {
    return `https://ridibooks.com/books/${work.externalId}`;
  }
  return null;
}

export function ResultScreen({
  result,
  work,
  totalQuestions,
  onRestart,
}: ResultScreenProps) {
  if (result === 'correct' && work) {
    return (
      <CorrectScreen
        work={work}
        totalQuestions={totalQuestions}
        onRestart={onRestart}
      />
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.failCard}>
        <div className={styles.failBadge}>아쉬워요...</div>
        <p className={styles.failMessage}>
          이번에는 맞추지 못했어요.
          <br />
          다음에 다시 도전해 주세요!
        </p>
        <button className={styles.restartButton} onClick={onRestart}>
          다시 하기
        </button>
      </div>
    </div>
  );
}

function CorrectScreen({
  work,
  totalQuestions,
  onRestart,
}: {
  work: WorkDTO;
  totalQuestions: number;
  onRestart: () => void;
}) {
  const [showFooter, setShowFooter] = useState(false);
  const [shaking, setShaking] = useState(false);

  const shockwavesRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<number[]>([]);

  const addTimer = useCallback((fn: () => void, ms: number) => {
    timersRef.current.push(window.setTimeout(fn, ms));
  }, []);

  const BLACKOUT_HOLD = 1000;

  useEffect(() => {
    addTimer(() => {
      setShaking(true);
      addTimer(() => setShaking(false), 600);
    }, BLACKOUT_HOLD);

    SHOCKWAVE_DELAYS.forEach((delay) => {
      addTimer(() => {
        const wave = document.createElement('div');
        wave.className = styles.shockwave!;
        shockwavesRef.current?.appendChild(wave);
        wave.addEventListener('animationend', () => wave.remove());
      }, BLACKOUT_HOLD + delay);
    });

    addTimer(() => setShowFooter(true), BLACKOUT_HOLD + 4500);

    return () => {
      timersRef.current.forEach(clearTimeout);
    };
  }, [addTimer]);

  const beams = useMemo(
    () =>
      Array.from({ length: BEAM_COUNT }, (_, i) => (
        <div
          key={i}
          className={styles.beam}
          style={{
            '--angle': `${(i * 360) / BEAM_COUNT + Math.random() * 3}deg`,
            animationDelay: `${(i / BEAM_COUNT) * -1.5}s`,
          } as React.CSSProperties}
        />
      )),
    [],
  );

  const workUrl = getWorkUrl(work);

  return (
    <div className={`${styles.scene} ${shaking ? styles.shakeScene : ''}`}>
      <div className={styles.blackout} />

      {/* Layer 1: Light beams */}
      <div
        className={`${styles.effectsOverlay} ${styles.bgAndBeams} ${styles.effectsOverlayActive}`}
        style={
          showFooter
            ? { transition: 'opacity 2s ease', opacity: 0.2 }
            : undefined
        }
      >
        <div className={styles.lightBeams}>{beams}</div>
      </div>

      {/* Layer 2: Shockwaves */}
      <div
        className={`${styles.effectsOverlay} ${styles.shockwavesLayer} ${styles.effectsOverlayActive}`}
        style={
          showFooter
            ? { transition: 'opacity 2s ease', opacity: 0 }
            : undefined
        }
      >
        <div ref={shockwavesRef} className={styles.shockwaves} />
      </div>

      {/* Layer 3: Card */}
      <div className={`${styles.cardWrapper} ${styles.revealingWrapper}`}>
        <div className={`${styles.card} ${styles.revealingCard}`}>
          <div className={`${styles.cardFace} ${styles.cardFront}`}>
            {work.thumbnailUrl && (
              <img
                className={styles.cardThumbnail}
                src={work.thumbnailUrl}
                alt={work.title}
              />
            )}
            <h2 className={styles.cardTitle}>{work.title}</h2>
            {work.author && (
              <p className={styles.cardAuthor}>{work.author}</p>
            )}
            {workUrl && (
              <a
                className={styles.cardLink}
                href={workUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                작품 보러가기
              </a>
            )}
          </div>
          <div className={`${styles.cardFace} ${styles.cardBack}`} />
        </div>
      </div>

      {/* Footer: appears after reveal */}
      <div
        className={`${styles.revealFooter} ${showFooter ? styles.revealFooterVisible : ''}`}
      >
        <p className={styles.stats}>
          {totalQuestions}개의 질문만에 맞췄어요!
        </p>
        <button className={styles.restartButton} onClick={onRestart}>
          다시 하기
        </button>
      </div>
    </div>
  );
}
