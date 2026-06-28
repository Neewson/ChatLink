import { 
  User, 
  Chat, 
  Message, 
  Call, 
  ContactRequest, 
  UserSession, 
  SystemStats, 
  ReportedMessage, 
  AuditLog, 
  CreateChatPayload 
} from "../types";

// In-Memory & LocalStorage backed DB
class MockDatabase {
  users: User[] = [];
  chats: Chat[] = [];
  messages: Message[] = [];
  calls: Call[] = [];
  contactRequests: ContactRequest[] = [];
  sessions: UserSession[] = [];
  reports: ReportedMessage[] = [];
  auditLogs: AuditLog[] = [];
  currentUser: User | null = null;

  constructor() {
    this.loadFromStorage();
    if (this.users.length === 0) {
      this.seedInitialData();
    }
  }

  loadFromStorage() {
    try {
      const u = localStorage.getItem("cl_users");
      const c = localStorage.getItem("cl_chats");
      const m = localStorage.getItem("cl_messages");
      const ca = localStorage.getItem("cl_calls");
      const cr = localStorage.getItem("cl_contactRequests");
      const s = localStorage.getItem("cl_sessions");
      const r = localStorage.getItem("cl_reports");
      const l = localStorage.getItem("cl_auditLogs");
      const cur = localStorage.getItem("chatlink_user");

      if (u) this.users = JSON.parse(u);
      if (c) this.chats = JSON.parse(c);
      if (m) this.messages = JSON.parse(m);
      if (ca) this.calls = JSON.parse(ca);
      if (cr) this.contactRequests = JSON.parse(cr);
      if (s) this.sessions = JSON.parse(s);
      if (r) this.reports = JSON.parse(r);
      if (l) this.auditLogs = JSON.parse(l);
      if (cur) this.currentUser = JSON.parse(cur);
    } catch (_) {}
  }

  saveToStorage() {
    try {
      localStorage.setItem("cl_users", JSON.stringify(this.users));
      localStorage.setItem("cl_chats", JSON.stringify(this.chats));
      localStorage.setItem("cl_messages", JSON.stringify(this.messages));
      localStorage.setItem("cl_calls", JSON.stringify(this.calls));
      localStorage.setItem("cl_contactRequests", JSON.stringify(this.contactRequests));
      localStorage.setItem("cl_sessions", JSON.stringify(this.sessions));
      localStorage.setItem("cl_reports", JSON.stringify(this.reports));
      localStorage.setItem("cl_auditLogs", JSON.stringify(this.auditLogs));
      if (this.currentUser) {
        localStorage.setItem("chatlink_user", JSON.stringify(this.currentUser));
      } else {
        localStorage.removeItem("chatlink_user");
        localStorage.removeItem("chatlink_token");
      }
    } catch (_) {}
  }

  seedInitialData() {
    // 1. Create seed users
    const userNilson: User = {
      id: "nilson",
      email: "camargonilson07@gmail.com",
      username: "nilson_dev",
      firstName: "Nilson",
      lastName: "Santos",
      bio: "Desenvolvedor de Software Comercial.",
      status: "online",
      isAdmin: true,
      isBanned: false,
      twoFactorEnabled: true,
      mutedChats: [],
      photoUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=nilson",
      createdAt: new Date().toISOString(),
      privacySettings: {
        whoSeesPhoto: "everyone",
        whoSeesStatus: "everyone",
        whoSeesLastActive: "everyone",
        whoSeesBio: "everyone",
        whoCanMessage: "everyone",
        whoCanCall: "everyone",
        whoCanAddGroup: "everyone",
        whoFindsByUsername: "everyone"
      }
    };

    const userAna: User = {
      id: "ana",
      email: "ana@empresa.com",
      username: "ana_gerente",
      firstName: "Ana",
      lastName: "Oliveira",
      bio: "Gerente de Projetos de TI.",
      status: "online",
      isAdmin: false,
      isBanned: false,
      twoFactorEnabled: false,
      mutedChats: [],
      photoUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=ana",
      createdAt: new Date().toISOString(),
      privacySettings: {
        whoSeesPhoto: "everyone",
        whoSeesStatus: "everyone",
        whoSeesLastActive: "everyone",
        whoSeesBio: "everyone",
        whoCanMessage: "everyone",
        whoCanCall: "everyone",
        whoCanAddGroup: "everyone",
        whoFindsByUsername: "everyone"
      }
    };

    const userRobo: User = {
      id: "bot_financeiro",
      email: "bot@chatlink.com",
      username: "bot_financeiro",
      firstName: "Bot",
      lastName: "Financeiro",
      bio: "Robô automatizado comercial do ChatLink.",
      status: "busy",
      isAdmin: false,
      isBanned: false,
      twoFactorEnabled: false,
      mutedChats: [],
      photoUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=robo",
      createdAt: new Date().toISOString(),
      privacySettings: {
        whoSeesPhoto: "everyone",
        whoSeesStatus: "everyone",
        whoSeesLastActive: "everyone",
        whoSeesBio: "everyone",
        whoCanMessage: "everyone",
        whoCanCall: "everyone",
        whoCanAddGroup: "everyone",
        whoFindsByUsername: "everyone"
      }
    };

    this.users = [userNilson, userAna, userRobo];

    // 2. Initial Chats
    const chat1: Chat = {
      id: "ana",
      name: "Ana Oliveira",
      username: "ana_gerente",
      type: "individual",
      avatarUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=ana",
      unreadCount: 1,
      lastMessage: "Nilson, você finalizou a homologação da Sprint?",
      lastMessageTime: "10:30"
    };

    const chat2: Chat = {
      id: "grupo_marketing",
      name: "Comunicação Marketing",
      type: "group",
      avatarUrl: "https://api.dicebear.com/7.x/identicon/svg?seed=marketing",
      unreadCount: 0,
      lastMessage: "Nova campanha aprovada pela diretoria comercial.",
      lastMessageTime: "Ontem"
    };

    const chat3: Chat = {
      id: "canal_avisos",
      name: "Comunicados Importantes",
      type: "channel",
      avatarUrl: "https://api.dicebear.com/7.x/identicon/svg?seed=avisos",
      unreadCount: 0,
      lastMessage: "Expediente reduzido no feriado de terça-feira.",
      lastMessageTime: "25/06"
    };

    this.chats = [chat1, chat2, chat3];

    // 3. Messages
    this.messages = [
      {
        id: "msg1",
        chatId: "ana",
        senderId: "ana",
        senderName: "Ana Oliveira",
        senderUsername: "ana_gerente",
        senderPhoto: "https://api.dicebear.com/7.x/adventurer/svg?seed=ana",
        type: "text",
        content: "Olá Nilson! Bem-vindo ao ChatLink.",
        timestamp: new Date(Date.now() - 3600000 * 2).toISOString()
      },
      {
        id: "msg2",
        chatId: "ana",
        senderId: "ana",
        senderName: "Ana Oliveira",
        senderUsername: "ana_gerente",
        senderPhoto: "https://api.dicebear.com/7.x/adventurer/svg?seed=ana",
        type: "text",
        content: "Nilson, você finalizou a homologação da Sprint?",
        timestamp: new Date(Date.now() - 600000).toISOString()
      },
      {
        id: "msg3",
        chatId: "grupo_marketing",
        senderId: "ana",
        senderName: "Ana Oliveira",
        senderUsername: "ana_gerente",
        senderPhoto: "https://api.dicebear.com/7.x/adventurer/svg?seed=ana",
        type: "text",
        content: "Nova campanha aprovada pela diretoria comercial.",
        timestamp: new Date(Date.now() - 3600000 * 24).toISOString()
      },
      {
        id: "msg4",
        chatId: "canal_avisos",
        senderId: "nilson",
        senderName: "Nilson Santos",
        senderUsername: "nilson_dev",
        senderPhoto: "https://api.dicebear.com/7.x/adventurer/svg?seed=nilson",
        type: "text",
        content: "Expediente reduzido no feriado de terça-feira.",
        timestamp: new Date(Date.now() - 3600000 * 48).toISOString()
      }
    ];

    // 4. Seed Audit Logs
    this.auditLogs = [
      {
        id: "log1",
        action: "USER_SIGNUP",
        username: "nilson_dev",
        details: "Conta comercial criada e autenticada com sucesso.",
        timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
        ip: "186.223.10.45",
        device: "Chrome / Windows 11 Desktop"
      },
      {
        id: "log2",
        action: "2FA_ENABLED",
        username: "nilson_dev",
        details: "Autenticação por duplo fator ativada pelo administrador.",
        timestamp: new Date(Date.now() - 3600000 * 3.8).toISOString(),
        ip: "186.223.10.45",
        device: "Chrome / Windows 11 Desktop"
      }
    ];

    // 5. Sessions list
    this.sessions = [
      {
        id: "sess_curr",
        device: "Chrome Browser (Windows 11 PC)",
        ip: "186.223.10.45",
        lastActive: new Date().toISOString(),
        isCurrent: true
      },
      {
        id: "sess_mobile",
        device: "ChatLink Mobile App (iPhone 15 Pro)",
        ip: "177.89.20.12",
        lastActive: new Date(Date.now() - 1800000).toISOString(),
        isCurrent: false
      }
    ];

    this.saveToStorage();
  }
}

const db = new MockDatabase();

// Exportable storage and auth session key controllers
export function saveSession(token: string, user: User) {
  localStorage.setItem("chatlink_token", token);
  localStorage.setItem("chatlink_user", JSON.stringify(user));
  db.currentUser = user;
}

export function clearSession() {
  localStorage.removeItem("chatlink_token");
  localStorage.removeItem("chatlink_user");
  db.currentUser = null;
}

export const api = {
  // Login
  async login(payload: any): Promise<{ token: string; user: User; requireTwoFactor?: boolean; tempToken: string }> {
    const user = db.users.find(u => u.email === payload.email);
    if (!user) {
      throw new Error("E-mail não cadastrado no ChatLink.");
    }
    
    if (user.isBanned) {
      throw new Error("Esta conta comercial foi banida por violação de termos de uso.");
    }

    // Logger
    db.auditLogs.unshift({
      id: Math.random().toString(),
      action: "LOGIN_SUCCESS",
      username: user.username,
      details: `Login efetuado. Lembrar-me: ${payload.rememberMe ? "Sim" : "Não"}`,
      timestamp: new Date().toISOString(),
      ip: "186.223.10.45",
      device: "Navegador Web / Desktop"
    });
    db.saveToStorage();

    if (user.twoFactorEnabled) {
      return {
        token: "",
        user,
        requireTwoFactor: true,
        tempToken: `temp_${user.id}_${Date.now()}`
      };
    }

    return {
      token: `token_${user.id}`,
      user,
      tempToken: ""
    };
  },

  // Verification 2FA code
  async verify2FA(tempToken: string, code: string): Promise<{ user: User }> {
    if (code !== "123456") {
      throw new Error("Código de segurança incorreto. Tente '123456'.");
    }
    const userId = tempToken.split("_")[1];
    const user = db.users.find(u => u.id === userId);
    if (!user) throw new Error("Sessão expirada.");

    return { user };
  },

  // Register account with name validation checks
  async register(payload: any): Promise<{ token: string; user: User }> {
    const emailExists = db.users.some((u) => u.email === payload.email);
    if (emailExists) {
      throw new Error("O e-mail informado já está em uso.");
    }

    const usernameExists = db.users.some((u) => u.username === payload.username);
    if (usernameExists) {
      throw new Error("O nome de usuário já está reservado.");
    }

    const newUser: User = {
      id: `user_${Date.now()}`,
      email: payload.email,
      username: payload.username,
      firstName: payload.firstName,
      lastName: payload.lastName,
      bio: payload.bio || "Olá, estou no ChatLink!",
      dateOfBirth: payload.dateOfBirth,
      photoUrl: payload.photoUrl,
      coverUrl: "",
      city: "",
      country: "",
      status: "online",
      isAdmin: false,
      isBanned: false,
      twoFactorEnabled: false,
      mutedChats: [],
      createdAt: new Date().toISOString(),
      privacySettings: {
        whoSeesPhoto: "everyone",
        whoSeesStatus: "everyone",
        whoSeesLastActive: "everyone",
        whoSeesBio: "everyone",
        whoCanMessage: "everyone",
        whoCanCall: "everyone",
        whoCanAddGroup: "everyone",
        whoFindsByUsername: "everyone"
      }
    };

    db.users.push(newUser);
    db.auditLogs.unshift({
      id: Math.random().toString(),
      action: "USER_SIGNUP",
      username: newUser.username,
      details: "Nova conta comercial registrada com e-mail.",
      timestamp: new Date().toISOString(),
      ip: "186.223.10.45",
      device: "Navegador Web / Desktop"
    });
    db.saveToStorage();

    return {
      token: `token_${newUser.id}`,
      user: newUser
    };
  },

  // Unique username check with automatic suffix suggestions if taken
  async checkUsername(username: string): Promise<{ available: boolean; suggestions?: string[] }> {
    const clean = username.replace(/[@\s]/g, "").trim().toLowerCase();
    const taken = db.users.some((u) => u.username.toLowerCase() === clean);
    
    if (!taken) {
      return { available: true };
    }

    // Generate smart suggestions
    const suggestions = [
      `${clean}_oficial`,
      `${clean}_${new Date().getFullYear()}`,
      `${clean}_dev`,
      `comercial_${clean}`
    ];

    return {
      available: false,
      suggestions
    };
  },

  // Password Recovery simulate
  async recovery(email: string): Promise<{ message: string; simulatedDetails: any }> {
    const user = db.users.find(u => u.email === email);
    if (!user) {
      throw new Error("Nenhuma conta corporativa encontrada para este e-mail.");
    }

    const recoveryCode = Math.floor(100000 + Math.random() * 900000).toString();
    const tempPass = `Reset${Math.floor(1000 + Math.random() * 9000)}`;

    return {
      message: `Código enviado para o e-mail: ${email}. Siga as instruções para acessar.`,
      simulatedDetails: {
        code: recoveryCode,
        tempPassword: tempPass
      }
    };
  },

  // Get active lists
  async getChats(): Promise<Chat[]> {
    return [...db.chats];
  },

  // Create Chat
  async createChat(payload: CreateChatPayload): Promise<Chat> {
    if (payload.type === "individual") {
      const targetUser = db.users.find(u => u.username.toLowerCase() === payload.targetUsername?.toLowerCase());
      if (!targetUser) {
        throw new Error("Nenhum usuário comercial encontrado com este @username.");
      }
      
      // Check if direct already exists
      const existing = db.chats.find(c => c.type === "individual" && c.id === targetUser.id);
      if (existing) return existing;

      const newDirect: Chat = {
        id: targetUser.id,
        name: `${targetUser.firstName} ${targetUser.lastName}`,
        username: targetUser.username,
        type: "individual",
        avatarUrl: targetUser.photoUrl,
        unreadCount: 0,
        lastMessage: "Iniciou uma nova conversa direta.",
        lastMessageTime: "Agora"
      };

      db.chats.unshift(newDirect);
      db.saveToStorage();
      return newDirect;
    } else {
      const newChat: Chat = {
        id: `chat_${Date.now()}`,
        name: payload.name || "Novo Canal/Grupo",
        type: payload.type,
        avatarUrl: payload.avatarUrl || "https://api.dicebear.com/7.x/identicon/svg?seed=novo",
        description: payload.description,
        unreadCount: 0,
        lastMessage: `Criou este ${payload.type === "group" ? "Grupo" : "Canal"} seguro.`,
        lastMessageTime: "Agora"
      };

      db.chats.unshift(newChat);
      db.saveToStorage();
      return newChat;
    }
  },

  // Get Messages
  async getMessages(chatId: string): Promise<Message[]> {
    return db.messages.filter(m => m.chatId === chatId && !m.isDeleted);
  },

  // Send Message
  async sendMessage(chatId: string, payload: any): Promise<Message> {
    const sender = db.currentUser || db.users[0];
    const newMsg: Message = {
      id: `msg_${Date.now()}`,
      chatId,
      senderId: sender.id,
      senderName: `${sender.firstName} ${sender.lastName}`,
      senderUsername: sender.username,
      senderPhoto: sender.photoUrl,
      type: payload.type,
      content: payload.content,
      timestamp: new Date().toISOString(),
      reactions: {},
      replyToId: payload.replyToId,
      pinned: false,
      ...payload
    };

    if (payload.replyToId) {
      const original = db.messages.find(m => m.id === payload.replyToId);
      if (original) {
        newMsg.replyToSender = original.senderUsername;
        newMsg.replyToText = original.content;
      }
    }

    db.messages.push(newMsg);

    // Update Chat last message preview
    const chat = db.chats.find(c => c.id === chatId);
    if (chat) {
      chat.lastMessage = payload.type === "text" ? payload.content : `[Anexo de ${payload.type}]`;
      chat.lastMessageTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    db.saveToStorage();

    // Trigger window custom event for real-time emulation
    const ev = new CustomEvent("chatlink-sync-event", {
      detail: { type: "NEW_MESSAGE", data: { chatId } }
    });
    window.dispatchEvent(ev);

    return newMsg;
  },

  // Edit Message
  async editMessage(messageId: string, newContent: string): Promise<Message> {
    const msg = db.messages.find(m => m.id === messageId);
    if (!msg) throw new Error("Mensagem não localizada.");
    
    msg.content = newContent;
    msg.isEdited = true;
    db.saveToStorage();
    return msg;
  },

  // Delete message for everyone
  async deleteMessage(messageId: string, forEveryone: boolean): Promise<void> {
    const msg = db.messages.find(m => m.id === messageId);
    if (!msg) throw new Error("Mensagem não localizada.");

    if (forEveryone) {
      msg.isDeleted = true;
    } else {
      db.messages = db.messages.filter(m => m.id !== messageId);
    }
    db.saveToStorage();
  },

  // React Emoji
  async reactToMessage(messageId: string, emoji: string): Promise<void> {
    const msg = db.messages.find(m => m.id === messageId);
    if (!msg) throw new Error("Mensagem não localizada.");
    
    if (!msg.reactions) msg.reactions = {};
    const sender = db.currentUser || db.users[0];
    msg.reactions[sender.id] = emoji;
    db.saveToStorage();
  },

  // Pin message
  async pinMessage(messageId: string, pinned: boolean): Promise<void> {
    const msg = db.messages.find(m => m.id === messageId);
    if (msg) {
      msg.pinned = pinned;
      db.saveToStorage();
    }
  },

  // Report inappropriate content
  async reportMessage(messageId: string, reason: string): Promise<void> {
    const msg = db.messages.find(m => m.id === messageId);
    if (!msg) return;

    db.reports.unshift({
      id: `rep_${Date.now()}`,
      messageId: msg.id,
      content: msg.content,
      reportedUserId: msg.senderId,
      reportedUsername: msg.senderUsername,
      reason,
      resolved: false,
      timestamp: new Date().toISOString()
    });
    db.saveToStorage();
  },

  // Vote Poll
  async votePoll(messageId: string, optionId: string): Promise<void> {
    const msg = db.messages.find(m => m.id === messageId);
    if (msg && msg.pollOptions) {
      const sender = db.currentUser || db.users[0];
      msg.pollOptions.forEach((opt) => {
        // Toggle vote on selected option, remove on others
        if (opt.id === optionId) {
          if (opt.votes.includes(sender.id)) {
            opt.votes = opt.votes.filter(id => id !== sender.id);
          } else {
            opt.votes.push(sender.id);
          }
        } else {
          opt.votes = opt.votes.filter(id => id !== sender.id);
        }
      });
      db.saveToStorage();
    }
  },

  // File Upload emulater
  async uploadFile(name: string, type: string, file: any): Promise<{ url: string; fileSize: number }> {
    // Return standard dummy secure cloud asset URL
    return {
      url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800",
      fileSize: 4124000 // 4MB
    };
  },

  // Mute Chats
  async muteChat(chatId: string, mute: boolean): Promise<void> {
    if (db.currentUser) {
      if (mute) {
        if (!db.currentUser.mutedChats.includes(chatId)) {
          db.currentUser.mutedChats.push(chatId);
        }
      } else {
        db.currentUser.mutedChats = db.currentUser.mutedChats.filter(id => id !== chatId);
      }
      db.saveToStorage();
    }
  },

  // Update profile
  async updateProfile(updates: any): Promise<User> {
    if (!db.currentUser) throw new Error("Não autenticado.");
    
    // Find inside list and merge
    const user = db.users.find(u => u.id === db.currentUser?.id);
    if (user) {
      Object.assign(user, updates);
      db.currentUser = user;
      db.saveToStorage();
      return user;
    }
    throw new Error("Erro ao salvar dados.");
  },

  // Contacts
  async getContactRequests(): Promise<ContactRequest[]> {
    return db.contactRequests.filter(r => r.status === "pending");
  },

  async sendContactRequest(email: string): Promise<void> {
    const target = db.users.find(u => u.email === email);
    if (!target) throw new Error("Usuário comercial não localizado no ChatLink.");
    const sender = db.currentUser || db.users[0];

    db.contactRequests.unshift({
      id: `req_${Date.now()}`,
      senderId: sender.id,
      senderName: `${sender.firstName} ${sender.lastName}`,
      senderUsername: sender.username,
      receiverId: target.id,
      status: "pending",
      createdAt: new Date().toISOString()
    });
    db.saveToStorage();
  },

  async acceptContactRequest(reqId: string): Promise<void> {
    const req = db.contactRequests.find(r => r.id === reqId);
    if (req) {
      req.status = "accepted";
      
      // Auto establish Chat between them
      const senderUser = db.users.find(u => u.id === req.senderId);
      if (senderUser) {
        db.chats.unshift({
          id: senderUser.id,
          name: `${senderUser.firstName} ${senderUser.lastName}`,
          username: senderUser.username,
          type: "individual",
          avatarUrl: senderUser.photoUrl,
          unreadCount: 0,
          lastMessage: "Você aceitou a solicitação de contato comercial.",
          lastMessageTime: "Agora"
        });
      }
      db.saveToStorage();
    }
  },

  async declineContactRequest(reqId: string): Promise<void> {
    const req = db.contactRequests.find(r => r.id === reqId);
    if (req) {
      req.status = "declined";
      db.saveToStorage();
    }
  },

  // Calls
  async createCall(payload: any): Promise<Call> {
    const sender = db.currentUser || db.users[0];
    const newCall: Call = {
      id: `call_${Date.now()}`,
      callerId: sender.id,
      callerName: `${sender.firstName} ${sender.lastName}`,
      callerPhoto: sender.photoUrl,
      receiverId: payload.receiverId,
      receiverName: payload.receiverName,
      receiverPhoto: payload.receiverPhoto,
      type: payload.type,
      status: "ringing",
      timestamp: new Date().toISOString()
    };

    db.calls.unshift(newCall);
    db.saveToStorage();
    return newCall;
  },

  async getIncomingCall(): Promise<Call | null> {
    const user = db.currentUser;
    if (!user) return null;

    // Search for active calls on status ringing targeting user
    const found = db.calls.find(c => c.receiverId === user.id && c.status === "ringing");
    return found || null;
  },

  async updateCall(callId: string, status: Call["status"], duration?: number): Promise<Call> {
    const call = db.calls.find(c => c.id === callId);
    if (!call) throw new Error("Chamada inativa.");
    
    call.status = status;
    if (duration) call.durationSeconds = duration;
    
    db.saveToStorage();
    return call;
  },

  // Sessions
  async getSessions(): Promise<UserSession[]> {
    return db.sessions;
  },

  async logoutOtherSessions(): Promise<void> {
    db.sessions = db.sessions.filter(s => s.isCurrent);
    db.saveToStorage();
  },

  // Admin operations
  async getAdminStats(): Promise<{ stats: SystemStats; users: User[]; reports: ReportedMessage[]; logs: AuditLog[] }> {
    const stats: SystemStats = {
      totalUsers: db.users.length,
      activeUsers24h: Math.round(db.users.length * 0.8) || 1,
      totalMessages: db.messages.length,
      totalGroups: db.chats.filter(c => c.type === "group").length,
      totalChannels: db.chats.filter(c => c.type === "channel").length,
      totalCommunities: db.chats.filter(c => c.type === "community").length,
      storageUsedBytes: db.messages.filter(m => m.mediaUrl).length * 4124000
    };

    return {
      stats,
      users: db.users,
      reports: db.reports,
      logs: db.auditLogs
    };
  },

  async adminToggleBan(userId: string, ban: boolean): Promise<void> {
    const user = db.users.find(u => u.id === userId);
    if (user) {
      user.isBanned = ban;
      db.auditLogs.unshift({
        id: Math.random().toString(),
        action: ban ? "USER_BANNED" : "USER_UNBANNED",
        username: "admin",
        details: `Alterado status de banimento para @${user.username}`,
        timestamp: new Date().toISOString(),
        ip: "186.223.10.45",
        device: "Painel do Administrador"
      });
      db.saveToStorage();
    }
  },

  async adminResolveReport(reportId: string): Promise<void> {
    const rep = db.reports.find(r => r.id === reportId);
    if (rep) {
      rep.resolved = true;
      db.saveToStorage();
    }
  }
};
