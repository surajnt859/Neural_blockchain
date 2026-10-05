import styles from "../pages/Marketplace.module.css";

export default function SkeletonCard() {
  return (
    <div className={styles.skeletonCard}>
      <div className={styles.skeletonCover}></div>
      <div className={styles.skeletonContent}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div className={`${styles.skeletonLine} ${styles.badge}`}></div>
          <div className={`${styles.skeletonLine} ${styles.badge}`}></div>
        </div>
        <div className={`${styles.skeletonLine} ${styles.title}`}></div>
        <div className={styles.skeletonLine}></div>
        <div className={`${styles.skeletonLine} ${styles.medium}`}></div>
        <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
          <div className={`${styles.skeletonLine} ${styles.short}`}></div>
        </div>
      </div>
    </div>
  );
}
