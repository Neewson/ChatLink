import React, { useState, useEffect } from "react";
import { api } from "../utils/api";
import { SystemStats, AuditLog, ReportedMessage } from "../types";
import { 
  Users, 
  MessageSquare, 
  ShieldAlert, 
  Database, 
  UserX, 
  UserCheck, 
  FileLock, 
  CheckCircle2, 
  AlertOctagon, 
  Search, 
  Activity 
} from "lucide-react";

export default function AdminPanel() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [reports, setReports] = useState<ReportedMessage[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  
  const [searchUserQuery, setSearchUserQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"users" | "reports" | "logs">("users");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchAdminData = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.getAdminStats();
      setStats(data.stats);
      setUsers(data.users || []);
      setReports(data.reports || []);
      setLogs(data.logs || []);
    } catch (err: any) {
      setError(err.message || "Erro ao obter painel de controle administrativo.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleToggleBan = async (targetUserId: string, currentBanStatus: boolean) => {
    try {
      await api.adminToggleBan(targetUserId, !currentBanStatus);
      // reload lists
      await fetchAdminData();
    } catch (err: any) {
      alert(err.message || "Não foi possível alterar status de banimento.");
    }
  };

  const handleResolveReport = async (reportId: string) => {
    try {
      await api.adminResolveReport(reportId);
      await fetchAdminData();
    } catch (err: any) {
      alert(err.message || "Não foi possível resolver denúncia.");
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Filter users
  const filteredUsers = users.filter((u) => {
    const q = searchUserQuery.toLowerCase();
    return (
      u.username.toLowerCase().includes(q) ||
      u.firstName.toLowerCase().includes(q) ||
      u.lastName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 text-slate-400 p-8">
        <Activity className="w-10 h-10 text-blue-500 animate-spin mb-3" />
        <p className="text-sm">Carregando métricas e relatórios do ChatLink...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 text-red-400 p-8 text-center">
        <AlertOctagon className="w-12 h-12 mb-3" />
        <h3 className="text-base font-bold">Acesso Restrito</h3>
        <p className="text-xs text-slate-500 max-w-sm mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-950 text-slate-200 overflow-y-auto custom-scrollbar p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header Summary */}
        <div className="flex justify-between items-center pb-2">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Painel do Administrador</h1>
            <p className="text-xs text-slate-500 mt-0.5">Visão consolidada de recursos, dados de segurança e relatórios</p>
          </div>
          <button
            onClick={fetchAdminData}
            className="text-xs font-bold text-blue-500 hover:bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-xl transition-all active:scale-95 cursor-pointer"
          >
            Sincronizar Métricas
          </button>
        </div>

        {/* Stats Grid Layout */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            
            <div className="glass rounded-2xl p-4 border border-slate-800/80 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-600/10 text-blue-500">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-500">Total Usuários</p>
                <p className="text-lg font-bold text-slate-100">{stats.totalUsers}</p>
                <p className="text-[9px] text-emerald-400 font-medium">({stats.activeUsers24h} ativos hoje)</p>
              </div>
            </div>

            <div className="glass rounded-2xl p-4 border border-slate-800/80 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-purple-600/10 text-purple-500">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-500">Mensagens Enviadas</p>
                <p className="text-lg font-bold text-slate-100">{stats.totalMessages}</p>
                <p className="text-[9px] text-slate-500">Fluxo em tempo real</p>
              </div>
            </div>

            <div className="glass rounded-2xl p-4 border border-slate-800/80 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-amber-600/10 text-amber-500">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-500">Canais e Comunidades</p>
                <p className="text-lg font-bold text-slate-100">{stats.totalChannels + stats.totalCommunities}</p>
                <p className="text-[9px] text-slate-500">Grupos: {stats.totalGroups}</p>
              </div>
            </div>

            <div className="glass rounded-2xl p-4 border border-slate-800/80 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-emerald-600/10 text-emerald-500">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-500">Uso de Armazenamento</p>
                <p className="text-lg font-bold text-slate-100">{formatBytes(stats.storageUsedBytes)}</p>
                <p className="text-[9px] text-slate-500">Arquivos & Uploads</p>
              </div>
            </div>

          </div>
        )}

        {/* Tab Selection */}
        <div className="flex border-b border-slate-800 gap-2">
          <button
            onClick={() => setActiveTab("users")}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === "users" ? "border-blue-500 text-slate-100" : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            Gerenciar Usuários ({filteredUsers.length})
          </button>
          <button
            onClick={() => setActiveTab("reports")}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === "reports" ? "border-blue-500 text-slate-100" : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            Denúncias de Spam / Bots ({reports.filter((r) => !r.resolved).length})
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === "logs" ? "border-blue-500 text-slate-100" : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            Logs de Auditoria ({logs.length})
          </button>
        </div>

        {/* Tab Contents */}
        {activeTab === "users" && (
          <div className="space-y-4">
            
            {/* User Search Input */}
            <div className="relative max-w-sm">
              <input
                type="text"
                placeholder="Pesquisar por @username ou email..."
                value={searchUserQuery}
                onChange={(e) => setSearchUserQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-9 pr-4 text-xs focus:outline-none focus:border-blue-500"
              />
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            </div>

            {/* Users list table */}
            <div className="glass rounded-2xl border border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900/60 border-b border-slate-800 text-slate-500 font-bold">
                      <th className="p-3">Usuário</th>
                      <th className="p-3">E-mail</th>
                      <th className="p-3">Cadastro</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-900/35">
                        <td className="p-3 flex items-center gap-2.5">
                          <img src={u.photoUrl} alt="User Avatar" className="w-7 h-7 rounded-lg object-cover bg-slate-850" />
                          <div>
                            <p className="font-semibold">{u.firstName} {u.lastName}</p>
                            <p className="text-[10px] text-blue-400 font-mono">@{u.username}</p>
                          </div>
                        </td>
                        <td className="p-3 text-slate-400">{u.email}</td>
                        <td className="p-3 text-slate-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                        <td className="p-3 text-center">
                          {u.isBanned ? (
                            <span className="bg-red-500/10 text-red-400 text-[9px] font-bold px-2 py-0.5 rounded-full border border-red-500/20">
                              Banido
                            </span>
                          ) : (
                            <span className="bg-emerald-500/10 text-emerald-400 text-[9px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">
                              Ativo
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleToggleBan(u.id, !!u.isBanned)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                              u.isBanned 
                                ? "bg-emerald-600/15 text-emerald-500 hover:bg-emerald-600/25 border border-emerald-500/20" 
                                : "bg-red-600/15 text-red-500 hover:bg-red-600/25 border border-red-500/20"
                            }`}
                          >
                            {u.isBanned ? (
                              <span className="flex items-center gap-1"><UserCheck className="w-3.5 h-3.5" /> Reativar</span>
                            ) : (
                              <span className="flex items-center gap-1"><UserX className="w-3.5 h-3.5" /> Banir</span>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-slate-500">Nenhum usuário correspondente encontrado.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {activeTab === "reports" && (
          <div className="space-y-4">
            
            <div className="glass rounded-2xl border border-slate-800 overflow-hidden">
              <div className="p-4 bg-slate-900/30 border-b border-slate-800">
                <h3 className="text-xs font-bold text-slate-300">Conteúdos Denunciados para Moderação</h3>
              </div>
              <div className="divide-y divide-slate-800">
                {reports.map((r) => (
                  <div key={r.id} className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${r.resolved ? "opacity-60 bg-slate-900/10" : "bg-red-500/5"}`}>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold bg-red-500/15 text-red-400 px-2.5 py-0.5 rounded-full border border-red-500/20 uppercase">
                          {r.reason}
                        </span>
                        <span className="text-[10px] text-slate-500">{new Date(r.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="text-xs font-semibold text-slate-200">
                        Mensagem enviada por <span className="text-blue-400">@{r.reportedUsername}</span>
                      </p>
                      <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-xs font-mono text-slate-300 max-w-xl">
                        "{r.content}"
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {r.resolved ? (
                        <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold px-3 py-1 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                          <CheckCircle2 className="w-4 h-4" /> Resolvido
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => handleToggleBan(r.reportedUserId, false)}
                            className="bg-red-600 hover:bg-red-500 text-white text-xs px-3 py-1.5 rounded-xl font-bold active:scale-95 transition-all cursor-pointer"
                          >
                            Banir Remetente
                          </button>
                          <button
                            onClick={() => handleResolveReport(r.id)}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-3 py-1.5 rounded-xl border border-slate-700 font-bold active:scale-95 transition-all cursor-pointer"
                          >
                            Ignorar / Arquivar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}

                {reports.length === 0 && (
                  <div className="p-8 text-center text-slate-500">Nenhum conteúdo denunciado atualmente. Tudo limpo!</div>
                )}
              </div>
            </div>

          </div>
        )}

        {activeTab === "logs" && (
          <div className="glass rounded-2xl border border-slate-800 overflow-hidden">
            <div className="p-4 bg-slate-900/30 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-300">Registro Histórico de Auditoria do Sistema</h3>
              <FileLock className="w-4 h-4 text-slate-500" />
            </div>

            <div className="divide-y divide-slate-800 font-mono text-[11px] max-h-[420px] overflow-y-auto custom-scrollbar">
              {logs.map((log) => (
                <div key={log.id} className="p-3 hover:bg-slate-900/40 flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                      <span className="text-blue-400 font-bold">{log.action}</span>
                      <span className="text-slate-300 font-semibold">{log.username}</span>
                    </div>
                    <p className="text-slate-400">{log.details}</p>
                  </div>
                  <div className="text-right text-[10px] text-slate-500 flex flex-col md:items-end">
                    <p>IP: {log.ip}</p>
                    <p className="truncate max-w-[200px]" title={log.device}>{log.device}</p>
                  </div>
                </div>
              ))}

              {logs.length === 0 && (
                <div className="p-8 text-center text-slate-500 font-sans">Nenhum registro de auditoria disponível no momento.</div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
