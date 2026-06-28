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
    try {
      const token = localStorage.getItem("chatlink_token");
      const userStr = localStorage.getItem("chatlink_user");
      if (token && userStr) {
        setCurrentUser(JSON.parse(userStr));
      }
    } catch (_) {
      localStorage.removeItem("chatlink_token");
      localStorage.removeItem("chatlink_user");
    } finally {
      setLoading(false);
    }
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

