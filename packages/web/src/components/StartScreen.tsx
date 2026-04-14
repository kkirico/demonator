import { useState } from 'react';
import { CatCharacter } from './CatCharacter';
import { SpeechBubble } from './SpeechBubble';
import styles from './StartScreen.module.css';

interface StartScreenProps {
  onStart: () => Promise<void>;
}

export function StartScreen({ onStart }: StartScreenProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    try {
      await onStart();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '알 수 없는 오류';
      setError(`서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해 주세요.\n(${msg})`);
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>Demonator</h1>

        <SpeechBubble direction="bottom">
          <p className={styles.greeting}>
            안녕하세요!
            <br />
            당신이 생각하는 웹소설을 맞춰볼게요!
            <br />
            함께 작품을 찾아볼까요?
          </p>
        </SpeechBubble>

        <div className={styles.character}>
          <CatCharacter size="large" animated />
        </div>

        <button
          className={styles.startButton}
          onClick={handleStart}
          disabled={loading}
        >
          {loading ? '준비 중...' : '시작하기'}
        </button>

        {error && <p className={styles.error}>{error}</p>}
      </div>
    </div>
  );
}
