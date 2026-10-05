import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./CommandPalette.module.css";
import { soundFx } from "../services/soundFx";
import { useToast } from "../context/ToastContext";
import { getModels } from "../services/api";

export default function CommandPalette({ isOpen, onClose }) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [models, setModels] = useState([]);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const toast = useToast();

  // Load models on open for quick instant search
  useEffect(() => {
    if (isOpen) {
      soundFx.playChime();
      getModels({ limit: 20 })
        .then((res) => {
          const list = res.data?.models || (Array.isArray(res.data) ? res.data : []);
          setModels(list);
        })
        .catch(() => {});
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Handle global shortcut (Cmd+K / Ctrl+K / Escape)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          soundFx.playClick();
          // parent controls open state
        }
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Static Navigation Items
  const navItems = [
    { id: "nav-market", title: "Marketplace", sub: "Explore AI models, weights & benchmarks", icon: "🛒", path: "/marketplace", category: "Navigation" },
    { id: "nav-bounties", title: "AI Model Bounties (RFM)", sub: "Off-chain prototype requests for models", icon: "🏆", path: "/bounties", category: "Navigation" },
    { id: "nav-dev", title: "Developer API Gateway", sub: "OpenAI-compatible inference keys & SDKs", icon: "⚡", path: "/developers", category: "Navigation" },
    { id: "nav-dash", title: "Creator Dashboard", sub: "View model listings and recorded primary sales", icon: "📊", path: "/dashboard", category: "Navigation" },
    { id: "nav-upload", title: "Publish AI Model", sub: "Upload weights, IPFS pin and list on-chain", icon: "🚀", path: "/upload", category: "Navigation" },
    { id: "nav-gov", title: "Governance prototype", sub: "Off-chain proposals and wallet-signature voting", icon: "🏛️", path: "/governance", category: "Navigation" },
    { id: "nav-lead", title: "Creator Leaderboard", sub: "Top ranked verified AI model architects", icon: "🎖️", path: "/leaderboard", category: "Navigation" },
    { id: "nav-wallet", title: "Neural Wallet", sub: "Manage ETH, $NEURAL and NFT licenses", icon: "👛", path: "/wallet", category: "Navigation" },
  ];

  // Quick Action Items
  const actionItems = [
    {
      id: "act-sound",
      title: "Toggle Interface Sound Effects",
      sub: soundFx.isEnabled() ? "Sound FX: Enabled (Click to mute)" : "Sound FX: Muted (Click to enable)",
      icon: soundFx.isEnabled() ? "🔊" : "🔇",
      category: "Quick Actions",
      action: () => {
        const state = soundFx.toggle();
        toast.info("Sound FX", state ? "Procedural Web Audio enabled" : "Interface audio muted");
      },
    },
    {
      id: "act-primary-sale",
      title: "Primary-sale payment split",
      sub: "Review creator, platform, and lineage payment shares",
      icon: "💎",
      category: "Quick Actions",
      action: () => {
        navigate("/dashboard");
        toast.info("Primary-sale payments", "Secondary resale royalties are not implemented.");
      },
    },
  ];

  // Filter models based on query
  const modelItems = models
    .filter((m) => {
      if (!query.trim()) return false;
      const q = query.toLowerCase();
      return (
        m.name?.toLowerCase().includes(q) ||
        m.category?.toLowerCase().includes(q) ||
        m.description?.toLowerCase().includes(q)
      );
    })
    .map((m) => ({
      id: `model-${m._id || m.id}`,
      title: m.name,
      sub: `${m.category} · ${m.price ? `Ξ ${m.price}` : "Free"} · ${m.downloads || 0} downloads`,
      icon: "🧠",
      path: `/model/${m._id || m.id}`,
      category: "AI Models",
    }));

  // Combine and filter
  const q = query.toLowerCase().trim();
  const filteredNav = navItems.filter((i) => !q || i.title.toLowerCase().includes(q) || i.sub.toLowerCase().includes(q));
  const filteredActions = actionItems.filter((i) => !q || i.title.toLowerCase().includes(q) || i.sub.toLowerCase().includes(q));
  
  const allResults = [...modelItems, ...filteredNav, ...filteredActions];

  const handleSelect = (item) => {
    soundFx.playClick();
    onClose();
    if (item.action) {
      item.action();
    } else if (item.path) {
      navigate(item.path);
    }
  };

  const handleKeyDownList = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (allResults.length || 1));
      soundFx.playClick();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + (allResults.length || 1)) % (allResults.length || 1));
      soundFx.playClick();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (allResults[selectedIndex]) {
        handleSelect(allResults[selectedIndex]);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.palette} onClick={(e) => e.stopPropagation()}>
        <div className={styles.inputWrapper}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            ref={inputRef}
            className={styles.input}
            placeholder="Search AI models, bounties, actions, pages... (Type / or ?)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDownList}
          />
          <span className={styles.escBadge}>ESC</span>
        </div>

        <div className={styles.resultsList}>
          {allResults.length === 0 ? (
            <div style={{ padding: "32px 16px", textAlign: "center", color: "#64748b" }}>
              No matches found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            allResults.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const isFirstInCategory =
                idx === 0 || allResults[idx - 1].category !== item.category;

              return (
                <React.Fragment key={item.id}>
                  {isFirstInCategory && (
                    <div className={styles.sectionHeader}>{item.category}</div>
                  )}
                  <div
                    className={`${styles.item} ${isSelected ? styles.itemActive : ""}`}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <div className={styles.itemLeft}>
                      <span className={styles.itemIcon}>{item.icon}</span>
                      <div>
                        <div className={styles.itemTitle}>{item.title}</div>
                        <div className={styles.itemSub}>{item.sub}</div>
                      </div>
                    </div>
                    {item.path && <span className={styles.itemTag}>Jump ↵</span>}
                    {item.action && <span className={styles.itemTag}>Run ⚡</span>}
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>

        <div className={styles.footer}>
          <div className={styles.shortcuts}>
            <span className={styles.keyHint}>
              <span className={styles.key}>↑</span>
              <span className={styles.key}>↓</span> navigate
            </span>
            <span className={styles.keyHint}>
              <span className={styles.key}>↵</span> select
            </span>
            <span className={styles.keyHint}>
              <span className={styles.key}>esc</span> close
            </span>
          </div>
          <div>NeuralChain AI SuperCore v2.4</div>
        </div>
      </div>
    </div>
  );
}
