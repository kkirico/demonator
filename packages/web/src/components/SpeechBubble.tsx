import type { ReactNode } from 'react';
import styles from './SpeechBubble.module.css';

interface SpeechBubbleProps {
  children: ReactNode;
  direction?: 'left' | 'bottom';
}

export function SpeechBubble({ children, direction = 'left' }: SpeechBubbleProps) {
  return (
    <div className={`${styles.bubble} ${styles[direction]}`}>
      <div className={styles.tail} />
      <div className={styles.content}>{children}</div>
    </div>
  );
}
