import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { Web3Provider } from "./context/Web3Context.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <Web3Provider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </Web3Provider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
