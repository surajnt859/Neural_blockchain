import { memo } from "react";
import { Link } from "react-router-dom";
import styles from "./ModelCard.module.css";
import { soundFx } from "../services/soundFx";

const CATEGORY_ICONS = {
  "Computer Vision": "👁️",
  "NLP": "💬",
  "Generative AI": "🎨",
  "Finance": "📈",
  "Audio": "🎙️",
  "General": "🤖",
};

const getHueFromString = (str) => {
  let hash = 0;
  if (!str) return 210;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
};

const ModelCard = memo(({ model }) => {
  const icon = CATEGORY_ICONS[model.category] || "🤖";
  const isFree = model.price === 0;

  const hue1 = getHueFromString(model.id || model._id || model.name);
  const hue2 = (hue1 + 45) % 360;
  const gradient = `linear-gradient(135deg, hsl(${hue1}, 75%, 45%) 0%, hsl(${hue2}, 85%, 25%) 100%)`;

  const modelId = model.id || model._id;

  return (
    <Link
      to={`/model/${modelId}`}
      className={styles.card}
      onClick={() => soundFx.playClick()}
    >
      {/* Dynamic Cover Graphic */}
      <div className={styles.cover} style={{ background: gradient }}>
        <div className={styles.coverOverlay} />
        <span className={styles.coverIcon}>{icon}</span>
        <span className={styles.royaltyPill}>⚡ 90% Royalty</span>
      </div>

      <div className={styles.content}>
        {/* Header (Price & Badges) */}
        <div className={styles.header}>
          <div className={styles.badges}>
            <span className="badge badge-purple">{model.category}</span>
            {model.verificationStatus === "verified" ? (
              <span className="badge badge-green" title="Cryptographically Verified SHA-256">
                ✓ Verified
              </span>
            ) : model.contractModelId ? (
              <span className="badge badge-cyan" title="On-chain Listed">
                ⛓️ On-Chain
              </span>
            ) : null}
          </div>

          <div className={styles.price}>
            {isFree ? (
              <span className="badge badge-green">FREE</span>
            ) : (
              <span className={styles.ethPrice}>
                <span className={styles.ethSymbol}>Ξ</span>
                {model.price}
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className={styles.body}>
          <h3 className={styles.name}>{model.name}</h3>
          <p className={styles.desc}>{model.description}</p>
        </div>

        {/* Tags */}
        {model.tags && model.tags.length > 0 && (
          <div className={styles.tags}>
            {model.tags.slice(0, 3).map((tag) => (
              <span key={tag} className={styles.tag}>
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className={styles.footer}>
          <div className={styles.meta}>
            <span>⬇️ {model.downloads || 0}</span>
            <span>⭐ {model.rating || 5.0}</span>
          </div>
          <div className={styles.owner}>by {model.owner?.username || "Architect"}</div>
        </div>
      </div>

      {/* Hover CTA */}
      <div className={styles.ctaOverlay}>
        <span>Inspect & Launch Studio →</span>
      </div>
    </Link>
  );
});

export default ModelCard;
