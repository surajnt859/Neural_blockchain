import { Suspense, lazy, useState, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Footer from "./components/Footer.jsx";
import CommandPalette from "./components/CommandPalette.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import { useWeb3 } from "./context/Web3Context.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import PageLoader from "./components/PageLoader.jsx";
import { soundFx } from "./services/soundFx.js";

// Lazy load pages for better performance
const Home = lazy(() => import("./pages/Home.jsx"));
const Marketplace = lazy(() => import("./pages/Marketplace.jsx"));
const ModelDetail = lazy(() => import("./pages/ModelDetail.jsx"));
const Upload = lazy(() => import("./pages/Upload.jsx"));
const Login = lazy(() => import("./pages/Login.jsx"));
const Register = lazy(() => import("./pages/Register.jsx"));
const Compare = lazy(() => import("./pages/Compare.jsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const Governance = lazy(() => import("./pages/Governance.jsx"));
const Leaderboard = lazy(() => import("./pages/Leaderboard.jsx"));
const Wallet = lazy(() => import("./pages/Wallet.jsx"));
const Bounties = lazy(() => import("./pages/Bounties.jsx"));
const DeveloperPortal = lazy(() => import("./pages/DeveloperPortal.jsx"));
const Admin = lazy(() => import("./pages/Admin.jsx"));

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const { account } = useWeb3();
  const location = useLocation();
  if (loading) return <PageLoader />;
  return (user || account) ? children : <Navigate to="/login" state={{ from: location }} replace />;
}

export default function App() {
  const [cmdOpen, setCmdOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <Navbar onOpenCommandPalette={() => setCmdOpen(true)} />
      <CommandPalette isOpen={cmdOpen} onClose={() => setCmdOpen(false)} />
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <div key={location.pathname} className="route-frame">
          <Routes>
            <Route path="/" element={<Home onOpenCommandPalette={() => setCmdOpen(true)} />} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/bounties" element={<Bounties />} />
            <Route path="/developers" element={<DeveloperPortal />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/model/:id" element={<ModelDetail />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/governance" element={<ProtectedRoute><Governance /></ProtectedRoute>} />
            <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
            <Route
              path="/upload"
              element={
                <ProtectedRoute>
                  <Upload />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </div>
        </Suspense>
      </ErrorBoundary>
      <Footer />
    </>
  );
}
