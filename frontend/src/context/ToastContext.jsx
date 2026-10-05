import React, { createContext, useContext, useState, useCallback } from "react";
import styles from "./Toast.module.css";
import { soundFx } from "../services/soundFx";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(({ title, message, type = "info", duration = 4000, icon }) => {
    const id = "toast_" + Math.random().toString(36).slice(2, 9);
    
    if (type === "success") {
      soundFx.playSuccess();
    } else if (type === "error") {
      soundFx.playWarning();
    } else {
      soundFx.playPop();
    }

    const newToast = { id, title, message, type, duration, icon };
    setToasts((prev) => [...prev.slice(-4), newToast]); // keep max 5

    setTimeout(() => {
      removeToast(id);
    }, duration);

    return id;
  }, [removeToast]);

  const success = useCallback((title, message, duration) => {
    return addToast({ title, message, type: "success", icon: "✨", duration });
  }, [addToast]);

  const error = useCallback((title, message, duration) => {
    return addToast({ title, message, type: "error", icon: "⚠️", duration });
  }, [addToast]);

  const info = useCallback((title, message, duration) => {
    return addToast({ title, message, type: "info", icon: "⚡", duration });
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ addToast, success, error, info, removeToast }}>
      {children}
      <div className={styles.toastContainer} aria-live="polite">
        {toasts.map((toast) => {
          let typeClass = styles.toastInfo;
          if (toast.type === "success") typeClass = styles.toastSuccess;
          if (toast.type === "error") typeClass = styles.toastError;

          return (
            <div key={toast.id} className={`${styles.toast} ${typeClass}`}>
              <div className={styles.icon}>{toast.icon || (toast.type === "success" ? "✨" : toast.type === "error" ? "⚠️" : "⚡")}</div>
              <div className={styles.content}>
                {toast.title && <div className={styles.title}>{toast.title}</div>}
                {toast.message && <div className={styles.message}>{toast.message}</div>}
              </div>
              <button
                className={styles.closeBtn}
                onClick={() => removeToast(toast.id)}
                aria-label="Close"
              >
                ✕
              </button>
              <div
                className={styles.progressBar}
                style={{ animationDuration: `${toast.duration}ms` }}
              />
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
