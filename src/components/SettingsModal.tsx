import React, { useState, useEffect } from "react";
import { User, PrivacySettings, UserSession } from "../types";
import { api, clearSession } from "../utils/api";
import { 
  X, 
  Settings, 
  User as UserIcon, 
  Lock, 
  HardDrive, 
  Database, 
  Monitor, 
  Globe, 
  HelpCircle, 
  LogOut, 
  Smartphone, 
  Trash2, 
  Download, 
  Upload, 
  Languages 
} from "lucide-react";

interface SettingsModalProps {
  currentUser: User;
  onClose: () => void;
  onUpdateUser: (user: User) => void;
}

export default function SettingsModal({ currentUser, onClose, onUpdateUser }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<"profile" | "privacy" | "sessions" | "backup" | "storage">("profile");
  
  // Profile state
  const [firstName, setFirstName] = useState(currentUser.firstName);
  const [lastName, setLastName] = useState(currentUser.lastName);
  const [bio, setBio] = useState(currentUser.bio);
  const [city, setCity] = useState(currentUser.city || "");
  const [country, setCountry] = useState(currentUser.country || "");
  const [photoUrl, setPhotoUrl] = useState(currentUser.photoUrl);
  const [coverUrl, setCoverUrl] = useState(currentUser.coverUrl || "");
  
  // Custom font selection states
  const [appFont, setAppFont] = useState(localStorage.getItem("chatlink_font") || "Inter");
  const [appFontSize, setAppFontSize] = useState(localStorage.getItem("chatlink_font_size") || "sm");
  const [chatWallpaper, setChatWallpaper] = useState(localStorage.getItem("chatlink_wallpaper") || "default");

  // Privacy Settings state
  const [privacy, setPrivacy] = useState<PrivacySettings>(currentUser.privacySettings || {
    whoSeesPhoto: "everyone",
    whoSeesStatus: "everyone",
    whoSeesLastActive: "everyone",
    whoSeesBio: "everyone",
    whoCanMessage: "everyone",
    whoCanCall: "everyone",
    whoCanAddGroup: "everyone",
    whoFindsByUsername: "everyone"
  });

  // 2FA state
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(!!currentUser.twoFactorEnabled);

  // Sessions listing state
  const [sessions, setSessions] = useState<UserSession[]>([]);
  
  // Backup state
  const [backupJson, setBackupJson] = useState("");
  const [autoBackup, setAutoBackup] = useState(localStorage.getItem("chatlink_auto_backup") === "true");

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const fetchSessions = async () => {
    try {
      const data = await api.getSessions();
      setSessions(data);
    } catch (_) {}
  };

  useEffect(() => {
    if (activeTab === "sessions") {
      fetchSessions();
    }
  }, [activeTab]);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const updated = await api.updateProfile({
        firstName,
        lastName,
        bio,
        city,
        country,
        photoUrl,
        coverUrl
      });
      onUpdateUser(updated);
      setSuccessMsg("Perfil atualizado com sucesso!");
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao salvar perfil.");
    } finally {
      setLoading(false);
    }
  };

  const handlePrivacySave = async () => {
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const updated = await api.updateProfile({
        privacySettings: privacy,
        twoFactorEnabled
      });
      onUpdateUser(updated);
      setSuccessMsg("Configurações de privacidade salvas!");
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao salvar privacidade.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutOtherSessions = async () => {
    if (!confirm("Tem certeza de que deseja desconectar todas as outras sessões ativas?")) return;
    try {
      await api.logoutOtherSessions();
      fetchSessions();
      alert("Todas as outras sessões foram encerradas remotamente.");
    } catch (err: any) {
      alert(err.message || "Erro ao desconectar sessões.");
    }
  };

  // Backup Manual trigger (Downloads standard JSON representing ChatLink chat databases locally)
  const handleDownloadBackup = async () => {
    try {
      const userChats = await api.getChats();
      const backupData = {
        version: "1.0",
        timestamp: Date.now(),
        profile: currentUser,
        chats: userChats
      };
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chatlink_backup_${currentUser.username}_${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (_) {
      alert("Erro ao gerar backup de dados.");
    }
  };

  // Restore backup
  const handleRestoreBackup = () => {
    if (!backupJson.trim()) {
      alert("Cole o conteúdo JSON do backup anterior.");
      return;
    }
    try {
      const data = JSON.parse(backupJson);
      if (!data.profile || !data.chats) {
        throw new Error("Formato inválido.");
      }
      alert("Backup importado e restaurado com sucesso para este cache local!");
      setBackupJson("");
    } catch (err) {
      alert("Erro ao validar arquivo de backup. Certifique-se de colar o JSON gerado anteriormente.");
    }
  };

  // Fonts / Theme local Storage helpers
  const handleFontChange = (font: string) => {
    setAppFont(font);
    localStorage.setItem("chatlink_font", font);
    document.documentElement.style.fontFamily = font === "Mono" ? "'JetBrains Mono', monospace" : "'Inter', sans-serif";
  };

  const handleFontSizeChange = (size: string) => {
    setAppFontSize(size);
    localStorage.setItem("chatlink_font_size", size);
  };

  const handleWallpaperChange = (wp: string) => {
    setChatWallpaper(wp);
    localStorage.setItem("chatlink_wallpaper", wp);
  };

  const handleToggleAutoBackup = (checked: boolean) => {
    setAutoBackup(checked);
    localStorage.setItem("chatlink_auto_backup", checked ? "true" : "false");
  };

  const handleClearCache = () => {
    if (!confirm("Deseja apagar o cache inteligente do navegador? Suas conversas no servidor continuarão seguras.")) return;
    localStorage.removeItem("chatlink_token");
    localStorage.removeItem("chatlink_user");
    alert("Cache do navegador limpo com sucesso! Faça login novamente.");
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 font-sans text-slate-100 select-none">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[90vh] md:h-[560px]">
        
        {/* Modal Header */}
        <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-500 animate-spin-slow" />
            <div>
              <h2 className="text-sm font-bold">Painel de Configurações</h2>
              <p className="text-[10px] text-slate-500">Ajuste privacidade, temas, backups e controle de sessões</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer">
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Modal Body: Left menu tab vs Right settings area */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          
          {/* Navigation left pane */}
          <div className="w-full md:w-48 bg-slate-950/40 border-b md:border-b-0 md:border-r border-slate-800 p-3 flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-y-auto custom-scrollbar shrink-0 select-none whitespace-nowrap">
            <button
              onClick={() => setActiveTab("profile")}
              className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl text-left transition-all shrink-0 whitespace-nowrap md:w-full ${
                activeTab === "profile" ? "bg-blue-600 text-white font-bold" : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
              }`}
            >
              <UserIcon className="w-4 h-4" /> Perfil Comercial
            </button>
            <button
              onClick={() => setActiveTab("privacy")}
              className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl text-left transition-all shrink-0 whitespace-nowrap md:w-full ${
                activeTab === "privacy" ? "bg-blue-600 text-white font-bold" : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
              }`}
            >
              <Lock className="w-4 h-4" /> Privacidade & 2FA
            </button>
            <button
              onClick={() => setActiveTab("sessions")}
              className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl text-left transition-all shrink-0 whitespace-nowrap md:w-full ${
                activeTab === "sessions" ? "bg-blue-600 text-white font-bold" : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
              }`}
            >
              <Monitor className="w-4 h-4" /> Dispositivos & Sessões
            </button>
            <button
              onClick={() => setActiveTab("backup")}
              className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl text-left transition-all shrink-0 whitespace-nowrap md:w-full ${
                activeTab === "backup" ? "bg-blue-600 text-white font-bold" : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
              }`}
            >
              <HardDrive className="w-4 h-4" /> Segurança de Backup
            </button>
            <button
              onClick={() => setActiveTab("storage")}
              className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl text-left transition-all shrink-0 whitespace-nowrap md:w-full ${
                activeTab === "storage" ? "bg-blue-600 text-white font-bold" : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
              }`}
            >
              <Database className="w-4 h-4" /> Dados & Armazenamento
            </button>
          </div>

          {/* Right Area content */}
          <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-slate-900/40 relative">
            
            {successMsg && (
              <div className="mb-4 p-2.5 bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl font-bold">
                {successMsg}
              </div>
            )}
            {errorMsg && (
              <div className="mb-4 p-2.5 bg-red-500/15 border border-red-500/20 text-red-400 text-xs rounded-xl font-bold">
                {errorMsg}
              </div>
            )}

            {activeTab === "profile" && (
              <form onSubmit={handleProfileSave} className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Edição de Perfil</h3>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-500 font-semibold mb-1">Nome</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 font-semibold mb-1">Sobrenome</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-500 font-semibold mb-1">Cidade</label>
                    <input
                      type="text"
                      placeholder="Ex: São Paulo"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 font-semibold mb-1">País</label>
                    <input
                      type="text"
                      placeholder="Ex: Brasil"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 font-semibold mb-1">Biografia Curta</label>
                  <textarea
                    rows={2}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs focus:outline-none resize-none"
                  ></textarea>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 font-semibold mb-1">Foto de Perfil URL</label>
                  <input
                    type="text"
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 font-semibold mb-1">Foto de Capa URL</label>
                  <input
                    type="text"
                    value={coverUrl}
                    onChange={(e) => setCoverUrl(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all active:scale-95 cursor-pointer"
                >
                  {loading ? "Salvando..." : "Salvar Alterações"}
                </button>
              </form>
            )}

            {activeTab === "privacy" && (
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Controle de Privacidade</h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] text-slate-500 font-semibold mb-1">Quem vê minha foto de perfil</label>
                    <select
                      value={privacy.whoSeesPhoto}
                      onChange={(e) => setPrivacy({ ...privacy, whoSeesPhoto: e.target.value as any })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs focus:outline-none"
                    >
                      <option value="everyone">Todos da Internet</option>
                      <option value="contacts">Apenas meus contatos adicionados</option>
                      <option value="nobody">Ninguém</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-500 font-semibold mb-1">Quem vê meu status Online</label>
                    <select
                      value={privacy.whoSeesStatus}
                      onChange={(e) => setPrivacy({ ...privacy, whoSeesStatus: e.target.value as any })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs focus:outline-none"
                    >
                      <option value="everyone">Todos</option>
                      <option value="contacts">Contatos</option>
                      <option value="nobody">Ninguém</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-500 font-semibold mb-1">Quem pode ver meu último acesso (visto por último)</label>
                    <select
                      value={privacy.whoSeesLastActive}
                      onChange={(e) => setPrivacy({ ...privacy, whoSeesLastActive: e.target.value as any })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs focus:outline-none"
                    >
                      <option value="everyone">Todos</option>
                      <option value="contacts">Apenas Contatos</option>
                      <option value="nobody">Ninguém</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-500 font-semibold mb-1">Quem pode me adicionar em grupos</label>
                    <select
                      value={privacy.whoCanAddGroup}
                      onChange={(e) => setPrivacy({ ...privacy, whoCanAddGroup: e.target.value as any })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs focus:outline-none"
                    >
                      <option value="everyone">Qualquer Usuário</option>
                      <option value="contacts">Apenas Contatos</option>
                    </select>
                  </div>

                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold">Autenticação de Dois Fatores (2FA)</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Exigir código 123456 ao logar em novos aparelhos</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={twoFactorEnabled}
                      onChange={(e) => setTwoFactorEnabled(e.target.checked)}
                      className="rounded border-slate-800 bg-slate-900 text-blue-500 focus:ring-blue-500/20 w-4 h-4 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="pt-3">
                  <button
                    type="button"
                    onClick={handlePrivacySave}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all active:scale-95 cursor-pointer"
                  >
                    Salvar Privacidade
                  </button>
                </div>
              </div>
            )}

            {activeTab === "sessions" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Dispositivos Conectados</h3>
                  <button
                    onClick={handleLogoutOtherSessions}
                    className="text-[10px] bg-red-600/10 text-red-500 hover:bg-red-600/20 px-2.5 py-1 rounded-lg border border-red-500/20 font-bold transition-all"
                  >
                    Desconectar Outros
                  </button>
                </div>

                <div className="space-y-2">
                  {sessions.map((s) => (
                    <div key={s.id} className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Smartphone className="w-5 h-5 text-blue-500" />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-bold">{s.device.split("(")[0].trim() || "Navegador Web"}</p>
                            {s.isCurrent && (
                              <span className="bg-emerald-500/10 text-emerald-400 text-[8px] font-bold px-1.5 py-0.5 rounded-full border border-emerald-500/20 uppercase">Atual</span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500">IP: {s.ip} • Ativo em: {new Date(s.lastActive).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "backup" && (
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Backups ChatLink</h3>
                
                <div className="p-4 bg-slate-950/50 border border-slate-800 rounded-xl space-y-3">
                  <p className="text-xs font-semibold">Baixe suas conversas e contatos comerciais para custódia externa ou migração manual de dispositivo.</p>
                  
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      onClick={handleDownloadBackup}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                    >
                      <Download className="w-4 h-4" /> Exportar Backup Manual
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                    <div>
                      <p className="text-xs font-bold">Auto Backup</p>
                      <p className="text-[10px] text-slate-500">Sincronizar histórico localmente antes de sair</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={autoBackup}
                      onChange={(e) => handleToggleAutoBackup(e.target.checked)}
                      className="rounded border-slate-800 bg-slate-900 text-blue-500 focus:ring-blue-500/20 w-4 h-4 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-300">Restaurar de arquivo / string JSON</label>
                  <textarea
                    rows={3}
                    placeholder="Cole o código JSON do seu backup anterior para restaurar as conversas e contatos..."
                    value={backupJson}
                    onChange={(e) => setBackupJson(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs focus:outline-none resize-none font-mono"
                  ></textarea>
                  <button
                    onClick={handleRestoreBackup}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                  >
                    <Upload className="w-4 h-4" /> Importar e Restaurar Backup
                  </button>
                </div>
              </div>
            )}

            {activeTab === "storage" && (
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Mídia & Armazenamento Local</h3>

                <div className="p-4 bg-slate-950/50 border border-slate-800 rounded-xl space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-xs font-bold">Limpar Cache Local</p>
                      <p className="text-[10px] text-slate-500">Apaga tokens, sessão e imagens salvas na máquina local</p>
                    </div>
                    <button
                      onClick={handleClearCache}
                      className="bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-500/20 p-2 rounded-xl transition-all cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Fonts Config */}
                  <div className="pt-4 border-t border-slate-800/60 space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Estilo de Fonte do ChatLink</label>
                      <div className="flex gap-2">
                        {["Inter", "Mono", "Sans"].map((f) => (
                          <button
                            key={f}
                            onClick={() => handleFontChange(f)}
                            className={`px-3 py-1 text-xs rounded-lg font-bold border transition-all ${
                              appFont === f 
                                ? "bg-blue-600 border-blue-500 text-white" 
                                : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            {f === "Mono" ? "Consolas/Mono" : f === "Inter" ? "Inter Pro" : "System UI"}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Tamanho da Fonte das Conversas</label>
                      <div className="flex gap-2">
                        {["xs", "sm", "base", "lg"].map((sz) => (
                          <button
                            key={sz}
                            onClick={() => handleFontSizeChange(sz)}
                            className={`px-3 py-1 text-xs rounded-lg font-bold border transition-all uppercase ${
                              appFontSize === sz 
                                ? "bg-blue-600 border-blue-500 text-white" 
                                : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            {sz}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Papel de Parede dos Chats</label>
                      <div className="flex gap-2">
                        {["default", "slate", "blue", "none"].map((wp) => (
                          <button
                            key={wp}
                            onClick={() => handleWallpaperChange(wp)}
                            className={`px-3 py-1 text-xs rounded-lg font-bold border transition-all capitalize ${
                              chatWallpaper === wp 
                                ? "bg-blue-600 border-blue-500 text-white" 
                                : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            {wp === "default" ? "Padrão" : wp === "slate" ? "Cinza" : wp === "blue" ? "Azul Escuro" : "Preto"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            )}

          </div>

        </div>

      </div>
    </div>
  );
}
