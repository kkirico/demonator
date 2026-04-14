import styles from './CatCharacter.module.css';

interface CatCharacterProps {
  size?: 'large' | 'medium';
  animated?: boolean;
}

export function CatCharacter({ size = 'medium', animated = false }: CatCharacterProps) {
  return (
    <div className={`${styles.cat} ${styles[size]} ${animated ? styles.animated : ''}`}>
      <img
        src="/assets/cat.png"
        alt="고양이 캐릭터"
        className={styles.image}
        draggable={false}
      />
    </div>
  );
}
