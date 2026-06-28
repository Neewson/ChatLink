import React, { useState, useEffect } from "react";
import { User, Chat, Call, ContactRequest, CreateChatPayload } from "../types";
import { api, clearSession } from "../utils/api";
import { 
  MessageSquare, 
  Users, 
  Tv, 
  PhoneCall, 
  Layers, 
  Settings, 
  ShieldAlert, 
  LogOut, 
  Search, 
  Plus, 
  Bell, 
  UserPlus, 
  Volume2, 
  Video, 
  X, 
  MessageCircle, 
  Globe, 
  Clock, 
  Check, 
  Activity, 
  ChevronRight, 
  AlertCircle 
} from "lucide-react";
import ChatArea from "./ChatArea";
import AdminPanel from "./AdminPanel";
import SettingsModal from "./SettingsModal";
import CallModal from "./CallModal";

interface MainLayoutProps {
  currentUser: User;
  onLogout: () => void;
  onUpdateCurrentUser: (user: User) => void;
}

export default function MainLayout({ currentUser, onLogout, onUpdateCurrentUser }: MainLayoutProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  
  // Tab selector
  const [activeNavTab, setActiveNavTab] = useState<"direct" | "group" | "channel" | "calls" | "communities" | "admin">("direct");
  
  // Search query
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modal togglers
  const [showSettings, setShowSettings] = useState(false);
  const [showCreateChatModal, setShowCreateChatModal] = useState(false);
  const [createChatType, setCreateChatType] = useState<Chat["type"]>("individual");
  
  // Create chat payload
  const [newChatName, setNewChatName] = useState("");
  const [newChatUsername, setNewChatUsername] = useState("");
  const [newChatDesc, setNewChatDesc] = useState("");
  const [newChatAvatar, setNewChatAvatar] = useState("");

  // Contacts flow
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [contactSearchQuery, setContactSearchQuery] = useState("");
  const [contactRequestEmail, setContactRequestEmail] = useState("");
  const [contactRequests, setContactRequests] = useState<ContactRequest[]>([]);
  
  // Active call
  const [activeCall, setActiveCall] = useState<Call | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Sync Lists
  const fetchChats = async () => {
    try {
      const allChats = await api.getChats();
      setChats(allChats);
    } catch (_) {}
  };

  const fetchContactRequests = async () => {
    try {
      const reqs = await api.getContactRequests();
      setContactRequests(reqs);
    } catch (_) {}
  };

  useEffect(() => {
    fetchChats();
    fetchContactRequests();

    // Setup checking for incoming calls
    const callTimer = setInterval(async () => {
      try {
        const currentCall = await api.getIncomingCall();
        if (currentCall) {
          setActiveCall(currentCall);
        }
      } catch (_) {}
    }, 3000);

    return () => clearInterval(callTimer);
  }, []);

  const handleCreateChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    try {
      const payload: CreateChatPayload = {
        type: createChatType,
        name: createChatType === "individual" ? "" : newChatName,
        targetUsername: createChatType === "individual" ? newChatUsername.replace("@", "") : undefined,
        description: newChatDesc,
        avatarUrl: newChatAvatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${newChatName || newChatUsername}`
      };

      const created = await api.createChat(payload);
      setChats([created, ...chats]);
      setActiveChat(created);
      
      // Reset
      setShowCreateChatModal(false);
      setNewChatName("");
      setNewChatUsername("");
      setNewChatDesc("");
      setNewChatAvatar("");
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao estabelecer conversa.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddContactRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (!contactRequestEmail) return;

    try {
      await api.sendContactRequest(contactRequestEmail);
      alert("Convite de contato enviado com sucesso!");
      setContactRequestEmail("");
      fetchContactRequests();
    } catch (err: any) {
      alert(err.message || "Erro ao convidar contato.");
    }
  };

  const handleAcceptContact = async (reqId: string) => {
    try {
      await api.acceptContactRequest(reqId);
      fetchContactRequests();
      fetchChats();
    } catch (_) {}
  };

  const handleDeclineContact = async (reqId: string) => {
    try {
      await api.declineContactRequest(reqId);
      fetchContactRequests();
    } catch (_) {}
  };

  // Start Call Trigger
  const handleStartCall = async (type: "voice" | "video") => {
    if (!activeChat) return;
    try {
      const call = await api.createCall({
        receiverId: activeChat.id, // chat id represents user id in direct conversation mock schema
        receiverName: activeChat.name,
        receiverPhoto: activeChat.avatarUrl,
        type
      });
      setActiveCall(call);
    } catch (err: any) {
      alert("Não foi possível iniciar a chamada: " + err.message);
    }
  };

  // Logout trigger
  const handleUserLogout = () => {
    clearSession();
    onLogout();
  };

  // Change user availability online status
  const handleToggleOnlineStatus = async (status: User["status"]) => {
    try {
      const updated = await api.updateProfile({ status });
      onUpdateCurrentUser(updated);
    } catch (_) {}
  };

  // Filtering chats based on selected sidebar Tab & query
  const filteredChats = chats.filter((c) => {
    // 1. Filter by search query
    const q = searchQuery.toLowerCase();
    const matchesSearch = 
      c.name.toLowerCase().includes(q) || 
      (c.username && c.username.toLowerCase().includes(q)) ||
      (c.lastMessage && c.lastMessage.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    // 2. Filter by tab
    if (activeNavTab === "direct") return c.type === "individual";
    if (activeNavTab === "group") return c.type === "group";
    if (activeNavTab === "channel") return c.type === "channel";
    if (activeNavTab === "communities") return c.type === "community";
    return true;
  });

  return (
    <div className="flex h-screen w-screen bg-[#020617] text-slate-100 overflow-hidden font-sans">
      
      {/* 1. STRUCTURAL SLIDER BAR PANE (Narrow Navigation bar with small elegant icons) */}
      <aside className={`w-16 bg-slate-950 border-r border-slate-800/80 flex flex-col justify-between items-center py-4 select-none ${activeChat ? "hidden md:flex" : "flex"}`}>
        
        {/* Core Brand Badge */}
        <div className="w-11 h-11 bg-gradient-to-tr from-blue-600 to-blue-500 rounded-2xl flex items-center justify-center font-black text-xl shadow-lg shadow-blue-500/20">
          CL
        </div>

        {/* Top/Middle Navigation triggers */}
        <div className="flex-1 flex flex-col items-center justify-center gap-2 w-full px-2 mt-8 space-y-1">
          <button
            onClick={() => { setActiveNavTab("direct"); setActiveChat(null); }}
            className={`p-3 rounded-2xl transition-all cursor-pointer relative ${
              activeNavTab === "direct" ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
            }`}
            title="Conversas Privadas"
          >
            <MessageSquare className="w-5 h-5" />
            {chats.some(c => c.type === "individual" && c.unreadCount > 0) && (
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-950"></span>
            )}
          </button>

          <button
            onClick={() => { setActiveNavTab("group"); setActiveChat(null); }}
            className={`p-3 rounded-2xl transition-all cursor-pointer relative ${
              activeNavTab === "group" ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
            }`}
            title="Grupos de Trabalho"
          >
            <Users className="w-5 h-5" />
            {chats.some(c => c.type === "group" && c.unreadCount > 0) && (
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-950"></span>
            )}
          </button>

          <button
            onClick={() => { setActiveNavTab("channel"); setActiveChat(null); }}
            className={`p-3 rounded-2xl transition-all cursor-pointer relative ${
              activeNavTab === "channel" ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
            }`}
            title="Canais Corporativos"
          >
            <Layers className="w-5 h-5" />
            {chats.some(c => c.type === "channel" && c.unreadCount > 0) && (
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-950"></span>
            )}
          </button>

          <button
            onClick={() => { setActiveNavTab("communities"); setActiveChat(null); }}
            className={`p-3 rounded-2xl transition-all cursor-pointer relative ${
              activeNavTab === "communities" ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
            }`}
            title="Comunidades em Massa"
          >
            <Tv className="w-5 h-5" />
          </button>

          {/* Admin panel tab shortcut */}
          {currentUser.isAdmin && (
            <button
              onClick={() => { setActiveNavTab("admin"); setActiveChat(null); }}
              className={`p-3 rounded-2xl transition-all cursor-pointer ${
                activeNavTab === "admin" ? "bg-blue-600 text-slate-100" : "text-amber-500/80 hover:bg-amber-500/10"
              }`}
              title="Painel Administrador"
            >
              <ShieldAlert className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Bottom controls panel */}
        <div className="flex flex-col gap-3.5 w-full items-center">
          
          {/* Notifications request count */}
          {contactRequests.length > 0 && (
            <button
              onClick={() => setShowContactsModal(true)}
              className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400 hover:bg-emerald-500/20 relative animate-bounce"
              title="Solicitações de contato pendentes"
            >
              <Bell className="w-4.5 h-4.5" />
              <span className="absolute -top-1 -right-1 bg-emerald-500 text-slate-950 font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
                {contactRequests.length}
              </span>
            </button>
          )}

          {/* Settings modal trigger */}
          <button
            onClick={() => setShowSettings(true)}
            className="p-3 text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded-2xl transition-all cursor-pointer"
            title="Minhas Configurações"
          >
            <Settings className="w-5 h-5" />
          </button>

          {/* Simple Dynamic Profile Picture with Presence selection */}
          <div className="relative group">
            <button className="w-10 h-10 rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 p-0.5 cursor-pointer">
              <img src={currentUser.photoUrl} alt="User Profile" className="w-full h-full object-cover rounded-xl" />
            </button>
            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-950 ${
              currentUser.status === "online" ? "bg-emerald-500" :
              currentUser.status === "busy" ? "bg-amber-500" : "bg-red-500"
            }`}></div>
            
            {/* Quick status dropdown on hover / click */}
            <div className="absolute bottom-12 left-1 bg-slate-900 border border-slate-800 rounded-xl p-2 w-32 shadow-2xl space-y-1 invisible group-hover:visible z-30">
              <p className="text-[9px] text-slate-500 uppercase font-bold text-center border-b border-slate-800 pb-1 mb-1">Presença</p>
              <button onClick={() => handleToggleOnlineStatus("online")} className="w-full text-left text-[10px] font-bold text-emerald-400 hover:bg-slate-800 p-1 rounded">● Disponível</button>
              <button onClick={() => handleToggleOnlineStatus("busy")} className="w-full text-left text-[10px] font-bold text-amber-400 hover:bg-slate-800 p-1 rounded">● Ocupado</button>
              <button onClick={() => handleToggleOnlineStatus("dnd")} className="w-full text-left text-[10px] font-bold text-red-400 hover:bg-slate-800 p-1 rounded">● Não Perturbe</button>
              <button onClick={handleUserLogout} className="w-full text-left text-[10px] font-bold text-slate-400 hover:bg-slate-800 hover:text-white p-1 rounded border-t border-slate-800 mt-1 flex items-center gap-1.5"><LogOut className="w-3.5 h-3.5" /> Sair</button>
            </div>
          </div>

        </div>
      </aside>

      {/* 2. CHATS DIRECTORY MIDDLE SIDEBAR */}
      {activeNavTab !== "admin" && (
        <section className={`w-full md:w-80 bg-slate-950/60 border-r border-slate-800/80 flex flex-col select-none ${activeChat ? "hidden md:flex" : "flex"}`}>
          
          {/* Header Search & Create */}
          <div className="p-4 space-y-3 border-b border-slate-800/80">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-base font-bold tracking-tight">ChatLink</h1>
                <p className="text-[10px] text-slate-500 font-semibold uppercase">
                  {activeNavTab === "direct" ? "Mensagens Diretas" : activeNavTab === "group" ? "Grupos de Trabalho" : activeNavTab === "channel" ? "Canais de Mídia" : "Comunidades Ativas"}
                </p>
              </div>

              {/* Action buttons triggers */}
              <div className="flex gap-1.5">
                <button
                  onClick={() => setShowContactsModal(true)}
                  className="p-1.5 bg-slate-900 border border-slate-800 hover:text-white rounded-xl text-slate-400 transition-all cursor-pointer"
                  title="Contatos Comerciais"
                >
                  <UserPlus className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    const mappedType: Chat["type"] = 
                      activeNavTab === "direct" ? "individual" :
                      activeNavTab === "group" ? "group" :
                      activeNavTab === "channel" ? "channel" : "community";
                    setCreateChatType(mappedType);
                    setShowCreateChatModal(true);
                  }}
                  className="p-1.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-white transition-all shadow-md shadow-blue-600/10 cursor-pointer"
                  title="Criar novo canal / conversa"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick Filter field */}
            <div className="relative">
              <input
                type="text"
                placeholder="Filtrar por nome ou conteúdo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800/80 rounded-xl py-2 pl-9 pr-4 text-xs focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 text-slate-200 placeholder-slate-500"
              />
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            </div>
          </div>

          {/* Scrollable list */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40 custom-scrollbar">
            {filteredChats.map((item) => {
              const isActive = activeChat?.id === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setActiveChat(item);
                    // clear locally simulated unread badge on click
                    item.unreadCount = 0;
                  }}
                  className={`p-3.5 flex items-start gap-3 cursor-pointer transition-all ${
                    isActive 
                      ? "bg-slate-900/60 border-l-4 border-blue-500" 
                      : "hover:bg-slate-900/30"
                  }`}
                >
                  <div className="relative">
                    <img src={item.avatarUrl} alt="Chat Avatar" className="w-10 h-10 rounded-xl object-cover bg-slate-850" />
                    {item.type === "individual" && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-950 bg-emerald-500"></div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <h4 className="text-xs font-bold text-slate-200 truncate pr-2">{item.name}</h4>
                      <span className="text-[9px] text-slate-500 font-semibold">{item.lastMessageTime}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate pr-4">{item.lastMessage || "Nenhuma mensagem gravada."}</p>
                  </div>

                  {/* Badges indicators */}
                  {item.unreadCount > 0 && (
                    <span className="bg-blue-600 text-white font-bold text-[9px] w-4.5 h-4.5 rounded-full flex items-center justify-center mt-1">
                      {item.unreadCount}
                    </span>
                  )}
                </div>
              );
            })}

            {filteredChats.length === 0 && (
              <div className="p-8 text-center text-slate-500">
                <MessageCircle className="w-10 h-10 mx-auto text-slate-800 mb-2" />
                <p className="text-xs">Nenhuma conversa nesta categoria.</p>
                <button
                  onClick={() => setShowCreateChatModal(true)}
                  className="text-xs text-blue-400 hover:underline font-bold mt-2 inline"
                >
                  Estabelecer nova agora
                </button>
              </div>
            )}
          </div>

        </section>
      )}

      {/* 3. ACTIVE CHAT AREA OR ADMIN CONSOLE AREA */}
      {activeNavTab === "admin" ? (
        <AdminPanel />
      ) : activeChat ? (
        <ChatArea 
          chat={activeChat} 
          currentUser={currentUser} 
          onRefreshChats={fetchChats}
          onStartCall={handleStartCall}
          onBack={() => setActiveChat(null)}
        />
      ) : (
        /* Empty default state dashboard */
        <div className={`flex-1 flex flex-col items-center justify-center p-8 text-center select-none bg-[#020617] relative ${activeChat ? "flex" : "hidden md:flex"}`}>
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-600/5 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-emerald-600/5 rounded-full blur-3xl pointer-events-none"></div>

          <div className="w-20 h-20 bg-slate-900 border border-slate-800 rounded-3xl flex items-center justify-center font-bold text-4xl shadow-xl shadow-blue-500/5 mb-6 text-blue-500 animate-pulse">
            CL
          </div>

          <h2 className="text-lg font-extrabold tracking-tight">Bem-vindo ao ChatLink</h2>
          <p className="text-xs text-slate-400 max-w-sm mt-1 leading-relaxed">
            Sua central corporativa segura e confiável de comunicação. Desenvolva projetos, compartilhe ideias e faça chamadas completas E2E sem precisar de número telefônico.
          </p>

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => { setCreateChatType("individual"); setShowCreateChatModal(true); }}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-600/10 cursor-pointer"
            >
              Criar Conversa Direta
            </button>
            <button
              onClick={() => setShowContactsModal(true)}
              className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 font-bold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer"
            >
              Verificar Contatos
            </button>
          </div>
        </div>
      )}

      {/* --- SOLICITAÇÕES / ADICIONAR CONTATOS MODAL --- */}
      {showContactsModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-500" />
                <h3 className="text-sm font-bold">Contatos do ChatLink</h3>
              </div>
              <button onClick={() => setShowContactsModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form to request contact via email */}
            <form onSubmit={handleAddContactRequestSubmit} className="space-y-2">
              <label className="block text-[10px] text-slate-500 font-bold uppercase">Adicionar Contato por E-mail</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  required
                  placeholder="ex: seuamigo@exemplo.com"
                  value={contactRequestEmail}
                  onChange={(e) => setContactRequestEmail(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs focus:outline-none"
                />
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3.5 rounded-xl transition-all cursor-pointer"
                >
                  Convidar
                </button>
              </div>
            </form>

            {/* List Contact Requests pending */}
            <div className="space-y-2">
              <p className="text-[10px] text-slate-500 font-bold uppercase">Solicitações de Contato Pendentes ({contactRequests.length})</p>
              <div className="divide-y divide-slate-800 max-h-48 overflow-y-auto custom-scrollbar">
                {contactRequests.map((req) => (
                  <div key={req.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-xs font-bold uppercase">
                        {req.senderName.substring(0,2)}
                      </div>
                      <div>
                        <p className="text-xs font-bold">{req.senderName}</p>
                        <p className="text-[10px] text-slate-500">@{req.senderUsername}</p>
                      </div>
                    </div>

                    <div className="flex gap-1">
                      <button
                        onClick={() => handleAcceptContact(req.id)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg"
                      >
                        Aceitar
                      </button>
                      <button
                        onClick={() => handleDeclineContact(req.id)}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-400 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-slate-700"
                      >
                        Recusar
                      </button>
                    </div>
                  </div>
                ))}

                {contactRequests.length === 0 && (
                  <p className="text-xs text-slate-500 text-center py-4">Nenhuma solicitação pendente.</p>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* --- CREATE CHANNEL / GROUP MODAL --- */}
      {showCreateChatModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleCreateChatSubmit} className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold capitalize">
                Criar {createChatType === "individual" ? "Nova Conversa" : createChatType === "group" ? "Novo Grupo" : createChatType === "channel" ? "Novo Canal" : "Comunidade"}
              </h3>
              <button type="button" onClick={() => setShowCreateChatModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-2.5 bg-red-500/15 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center gap-1.5 font-bold">
                <AlertCircle className="w-4 h-4" />
                <span>{errorMsg}</span>
              </div>
            )}

            {createChatType === "individual" ? (
              <div>
                <label className="block text-[10px] text-slate-500 font-bold mb-1">Informe o Username do usuário (@)</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="ex: nilson_santos"
                    value={newChatUsername}
                    onChange={(e) => setNewChatUsername(e.target.value.toLowerCase().replace(/[@\s]/g, ""))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-7 pr-3 text-xs focus:outline-none"
                  />
                  <span className="absolute left-3 top-2 text-xs font-bold text-slate-500">@</span>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-[10px] text-slate-500 font-bold mb-1">Nome do {createChatType === "group" ? "Grupo" : "Canal"}</label>
                  <input
                    type="text"
                    required
                    placeholder={`Ex: Marketing Digital`}
                    value={newChatName}
                    onChange={(e) => setNewChatName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 font-bold mb-1">URL do Avatar / Logotipo</label>
                  <input
                    type="text"
                    placeholder="https://exemplo.com/logo.jpg"
                    value={newChatAvatar}
                    onChange={(e) => setNewChatAvatar(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 font-bold mb-1">Breve Descrição Informativa</label>
                  <textarea
                    rows={2}
                    placeholder="Sobre o que é este canal ou grupo..."
                    value={newChatDesc}
                    onChange={(e) => setNewChatDesc(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs focus:outline-none resize-none"
                  ></textarea>
                </div>
              </>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <button type="button" onClick={() => setShowCreateChatModal(false)} className="text-xs text-slate-400 px-3 py-2">Cancelar</button>
              <button 
                type="submit" 
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer"
              >
                {loading ? "Estabelecendo..." : "Confirmar"}
              </button>
            </div>

          </form>
        </div>
      )}

      {/* --- SETTINGS PANE MODAL --- */}
      {showSettings && (
        <SettingsModal 
          currentUser={currentUser} 
          onClose={() => setShowSettings(false)} 
          onUpdateUser={onUpdateCurrentUser}
        />
      )}

      {/* --- CALL ACTIVE WINDOW OVERLAY MODAL --- */}
      {activeCall && (
        <CallModal 
          call={activeCall} 
          currentUser={currentUser} 
          onClose={() => setActiveCall(null)}
        />
      )}

    </div>
  );
}
