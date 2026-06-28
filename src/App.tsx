/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import Auth from "./components/Auth";
import MainLayout from "./components/MainLayout";
import { User } from "./types";

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function validateSessionOnStartup() {
      try {
        const token = localStorage.getItem("chatlink_token");
        const userStr = localStorage.getItem("chatlink_user");
        if (token && userStr) {
          // Verify with backend to ensure session is still active (not lost due to server restart)
          const res = await fetch("/api/auth/me", {
            headers: {
              "Authorization": `Bearer ${token}`
            }
          });
          if (res.ok) {
            const user = await res.json();
            setCurrentUser(user);
          } else if (res.status === 404) {
            // Server not found / static hosting (Vercel). Transition to local simulation!
            console.log("ChatLink server not found (404). Activating Client-Side Persistent Fallback...");
            try {
              setCurrentUser(JSON.parse(userStr));
            } catch (e) {
              localStorage.removeItem("chatlink_token");
              localStorage.removeItem("chatlink_user");
            }
          } else {
            // Invalid token (401, 403, etc.)
            localStorage.removeItem("chatlink_token");
            localStorage.removeItem("chatlink_user");
          }
        }
      } catch (_) {
        // Fallback to local storage if network is offline or unreachable
        const userStr = localStorage.getItem("chatlink_user");
        if (userStr) {
          try {
            setCurrentUser(JSON.parse(userStr));
          } catch (e) {
            localStorage.removeItem("chatlink_token");
            localStorage.removeItem("chatlink_user");
          }
        }
      } finally {
        setLoading(false);
      }
    }

    validateSessionOnStartup();

    // Global listener for unauthorized sessions (e.g. server restarted during active session)
    const handleUnauthorized = () => {
      setCurrentUser(null);
    };

    window.addEventListener("chatlink-unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("chatlink-unauthorized", handleUnauthorized);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center text-slate-400 font-sans">
        <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl animate-pulse mb-4">
          CL
        </div>
        <p className="text-xs uppercase tracking-widest font-semibold text-slate-500">Iniciando Canais Seguros ChatLink...</p>
      </div>
    );
  }

  return currentUser ? (
    <MainLayout 
      currentUser={currentUser} 
      onLogout={() => setCurrentUser(null)} 
      onUpdateCurrentUser={(user) => setCurrentUser(user)}
    />
  ) : (
    <Auth onAuthSuccess={(user) => setCurrentUser(user)} />
  );
}

