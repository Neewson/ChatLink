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
  CreateChatPayload,
  MessageType
} from "../types";

// Helper to acquire authorization headers dynamically
function getHeaders() {
  const token = localStorage.getItem("chatlink_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { "Authorization": `Bearer ${token}` } : {})
  };
}

export function triggerUnauthorized() {
  clearSession();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("chatlink-unauthorized"));
  }
}

// Global toggle for frontend simulation when server is absent/404 (e.g. static platforms like Vercel)
export let useLocalSimulation = false;

if (typeof window !== "undefined") {
  const host = window.location.hostname;
  if (
    host.includes("vercel.app") || 
    host.includes("github.io") || 
    host.includes("stackblitz") || 
    (host.includes("localhost") === false && !host.includes("run.app"))
  ) {
    useLocalSimulation = true;
    console.log("ChatLink: Local Simulation Fallback enabled automatically based on static/serverless hostname.");
  }
}

// Shadow global fetch to automatically catch 401 Unauthorized errors (e.g. from server restart)
async function fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    const res = await window.fetch(input, init);
    if (res.status === 404 && !useLocalSimulation) {
      console.log("ChatLink: API returned 404. Switching to local simulation fallback...");
      useLocalSimulation = true;
    }
    if (res.status === 401 && localStorage.getItem("chatlink_token") && !String(input).includes("/api/auth/login")) {
      triggerUnauthorized();
    }
    return res;
  } catch (err) {
    if (!useLocalSimulation) {
      console.log("ChatLink: Connection failed. Switching to local simulation fallback...", err);
      useLocalSimulation = true;
    }
    throw err;
  }
}

// Default Privacy Settings for Simulated Users
const DEFAULT_PRIVACY: any = {
  whoSeesPhoto: "everyone",
  whoSeesStatus: "everyone",
  whoSeesLastActive: "everyone",
  whoSeesBio: "everyone",
  whoCanMessage: "everyone",
  whoCanCall: "everyone",
  whoCanAddGroup: "everyone",
  whoFindsByUsername: "everyone"
};

// Seed Users for local simulation mode
const SEED_USERS: Record<string, any> = {
  "admin-id": {
    id: "admin-id",
    username: "admin",
    email: "admin@chatlink.com",
    firstName: "Administrador",
    lastName: "Geral",
    photoUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=admin",
    role: "admin",
    status: "online",
    isBanned: false,
    twoFactorEnabled: false,
    bio: "Gerenciamento de rede e suporte geral.",
    createdAt: new Date().toISOString(),
    privacySettings: DEFAULT_PRIVACY,
    blockedUsers: [],
    mutedChats: []
  },
  "nilson-id": {
    id: "nilson-id",
    username: "nilson",
    email: "nilson@chatlink.com",
    firstName: "Nilson",
    lastName: "Camargo",
    photoUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=nilson",
    role: "user",
    status: "online",
    isBanned: false,
    twoFactorEnabled: false,
    bio: "Entusiasta de tecnologia e viagens.",
    createdAt: new Date().toISOString(),
    privacySettings: DEFAULT_PRIVACY,
    blockedUsers: [],
    mutedChats: []
  },
  "suporte-id": {
    id: "suporte-id",
    username: "suporte",
    email: "suporte@chatlink.com",
    firstName: "Suporte",
    lastName: "Oficial",
    photoUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=suporte",
    role: "user",
    status: "online",
    isBanned: false,
    twoFactorEnabled: false,
    bio: "Dúvidas e suporte do ChatLink.",
    createdAt: new Date().toISOString(),
    privacySettings: DEFAULT_PRIVACY,
    blockedUsers: [],
    mutedChats: []
  },
  "carla-id": {
    id: "carla-id",
    username: "carla",
    email: "carla@chatlink.com",
    firstName: "Carla",
    lastName: "Silva",
    photoUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=carla",
    role: "user",
    status: "online",
    isBanned: false,
    twoFactorEnabled: false,
    bio: "Especialista em design de produto.",
    createdAt: new Date().toISOString(),
    privacySettings: DEFAULT_PRIVACY,
    blockedUsers: [],
    mutedChats: []
  }
};

function getMockData(key: string, defaultVal: any) {
  if (typeof window === "undefined") return defaultVal;
  const stored = localStorage.getItem(`chatlink_mock_${key}`);
  if (!stored) {
    localStorage.setItem(`chatlink_mock_${key}`, JSON.stringify(defaultVal));
    return defaultVal;
  }
  try {
    return JSON.parse(stored);
  } catch (e) {
    return defaultVal;
  }
}

function saveMockData(key: string, data: any) {
  if (typeof window !== "undefined") {
    localStorage.setItem(`chatlink_mock_${key}`, JSON.stringify(data));
  }
}

function getLoggedInUserId(): string {
  try {
    const userStr = localStorage.getItem("chatlink_user");
    if (userStr) {
      const u = JSON.parse(userStr);
      return u.id || "user-id";
    }
  } catch (e) {}
  return "user-id";
}

// SSE Realtime Sync Engine Manager
let eventSource: EventSource | null = null;
let lastIncomingCall: Call | null = null;

export function initEventSource() {
  if (useLocalSimulation) return; // Simulated mode doesn't use EventSource
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }

  const token = localStorage.getItem("chatlink_token");
  if (!token) return;

  const origin = window.location.origin;
  eventSource = new EventSource(`${origin}/api/sync?token=${token}`);

  eventSource.onopen = () => {
    console.log("ChatLink Realtime SSE sync channel connected successfully.");
  };

  eventSource.onerror = async (err) => {
    console.error("ChatLink SSE connection error. Checking session status...", err);
    const token = localStorage.getItem("chatlink_token");
    if (token) {
      try {
        await fetch("/api/auth/me", {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
      } catch (e) {
        // Network offline or fetch failed, do not trigger logout
      }
    }
  };

  const sseEvents = [
    "message",
    "message-edited",
    "message-deleted",
    "message-reaction",
    "message-pin",
    "poll-vote-update",
    "chat-created",
    "member-joined",
    "contact-request",
    "contact-request-accepted",
    "contact-request-declined",
    "incoming-call",
    "call-updated",
    "group-permissions-updated",
    "roles-updated",
    "user-profile-update"
  ];

  sseEvents.forEach((evtName) => {
    eventSource?.addEventListener(evtName, (e: any) => {
      try {
        const data = JSON.parse(e.data);
        console.log(`[Realtime Event: ${evtName}]`, data);

        if (evtName === "incoming-call") {
          lastIncomingCall = data;
        } else if (evtName === "call-updated") {
          lastIncomingCall = data;
        }

        const ev = new CustomEvent("chatlink-sync-event", {
          detail: { type: evtName, data }
        });
        window.dispatchEvent(ev);
      } catch (err) {
        console.error(`Error parsing event data for ${evtName}:`, err);
      }
    });
  });
}

export function closeEventSource() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
    console.log("ChatLink Realtime SSE sync channel disconnected.");
  }
}

// Storage helpers
export function saveSession(token: string, user: User) {
  localStorage.setItem("chatlink_token", token);
  localStorage.setItem("chatlink_user", JSON.stringify(user));
  if (!useLocalSimulation) {
    initEventSource();
  }
}

export function clearSession() {
  closeEventSource();
  localStorage.removeItem("chatlink_token");
  localStorage.removeItem("chatlink_user");
}

// REST Client bound to the production server with auto simulated client-side fallback
export const api = {
  // Login
  async login(payload: any): Promise<{ token: string; user: User; requireTwoFactor?: boolean; tempToken: string }> {
    if (useLocalSimulation) {
      const mockUsers = getMockData("users", SEED_USERS) as any;
      let user = (Object.values(mockUsers) as any[]).find((u: any) => u.email.toLowerCase() === payload.email.toLowerCase());
      if (!user) {
        throw new Error("E-mail ou senha incorretos.");
      }
      return { token: "token_" + user.id, user, tempToken: "temp_" + user.id };
    }

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Falha ao autenticar no ChatLink.");
    }

    return await res.json();
  },

  // 2FA Verification Action
  async verify2FA(tempToken: string, code: string): Promise<{ token: string; user: User }> {
    if (useLocalSimulation) {
      const mockUsers = getMockData("users", SEED_USERS) as any;
      const userId = tempToken.replace("temp_", "");
      const user = mockUsers[userId] || (Object.values(mockUsers) as any[])[0];
      return { token: "token_" + user.id, user };
    }

    const res = await fetch("/api/auth/2fa-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tempToken, code })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Código de verificação incorreto.");
    }

    return await res.json();
  },

  // User Registration
  async register(payload: any): Promise<{ token: string; user: User }> {
    if (useLocalSimulation) {
      const mockUsers = getMockData("users", SEED_USERS) as any;
      const existsUsername = (Object.values(mockUsers) as any[]).some((u: any) => u.username.toLowerCase() === payload.username.toLowerCase());
      if (existsUsername) {
        throw new Error("Este nome de usuário já está sendo utilizado.");
      }
      const existsEmail = (Object.values(mockUsers) as any[]).some((u: any) => u.email.toLowerCase() === payload.email.toLowerCase());
      if (existsEmail) {
        throw new Error("Este e-mail já está cadastrado.");
      }
      const newUser = {
        id: "user_" + Math.random().toString(36).substring(2, 11),
        username: payload.username.toLowerCase(),
        email: payload.email,
        firstName: payload.firstName,
        lastName: payload.lastName,
        photoUrl: payload.photoUrl,
        bio: payload.bio || "Olá, estou usando o ChatLink!",
        role: "user",
        status: "online",
        isBanned: false,
        twoFactorEnabled: false,
        createdAt: new Date().toISOString(),
        privacySettings: DEFAULT_PRIVACY,
        blockedUsers: [],
        mutedChats: []
      };
      mockUsers[newUser.id] = newUser;
      saveMockData("users", mockUsers);
      return { token: "token_" + newUser.id, user: newUser as any };
    }

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao registrar conta.");
    }

    return await res.json();
  },

  // Username validation lookup
  async checkUsername(username: string): Promise<{ available: boolean; suggestions?: string[] }> {
    const clean = username.replace(/[@\s]/g, "").trim().toLowerCase();
    
    if (useLocalSimulation) {
      const mockUsers = getMockData("users", SEED_USERS) as any;
      const exists = (Object.values(mockUsers) as any[]).some((u: any) => u.username.toLowerCase() === clean);
      if (!exists) {
        return { available: true, suggestions: [] };
      }
      const suggestions = [
        `${clean}${Math.floor(Math.random() * 90) + 10}`,
        `${clean}2026`,
        `${clean}_oficial`,
        `${clean}_link`
      ];
      return { available: false, suggestions };
    }

    const res = await fetch(`/api/auth/username-check?username=${encodeURIComponent(clean)}`);
    if (!res.ok) {
      throw new Error("Erro ao consultar disponibilidade de username.");
    }
    return await res.json();
  },

  // Password Recovery simulator
  async recovery(email: string): Promise<{ message: string; simulatedDetails: any }> {
    if (useLocalSimulation) {
      const mockUsers = getMockData("users", SEED_USERS) as any;
      const exists = (Object.values(mockUsers) as any[]).some((u: any) => u.email.toLowerCase() === email.toLowerCase());
      if (!exists) {
        throw new Error("E-mail não cadastrado no ChatLink.");
      }
      return { message: "Instruções de recuperação de senha simuladas enviadas.", simulatedDetails: "Código: 549321" };
    }

    const res = await fetch("/api/auth/recovery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao solicitar recuperação de senha.");
    }

    return await res.json();
  },

  // Get current user chats
  async getChats(): Promise<Chat[]> {
    if (useLocalSimulation) {
      const currentUserId = getLoggedInUserId();
      const mockChats = getMockData("chats", {}) as any;
      const userChats = (Object.values(mockChats) as any[]).filter((c: any) => c.members.includes(currentUserId));
      return userChats.map((c: any) => {
        if (c.type === "individual") {
          const peerId = c.members.find((m: string) => m !== currentUserId);
          const mockUsers = getMockData("users", SEED_USERS) as any;
          const peer = mockUsers[peerId];
          if (peer) {
            return {
              ...c,
              name: `${peer.firstName} ${peer.lastName}`,
              avatarUrl: peer.photoUrl
            };
          }
        }
        return c;
      });
    }

    const res = await fetch("/api/chats", {
      headers: getHeaders()
    });
    if (!res.ok) {
      throw new Error("Falha ao recuperar conversas.");
    }
    return await res.json();
  },

  // Create Chat / Group / Channel
  async createChat(payload: CreateChatPayload): Promise<Chat> {
    if (useLocalSimulation) {
      const currentUserId = getLoggedInUserId();
      const mockUsers = getMockData("users", SEED_USERS) as any;
      const mockChats = getMockData("chats", {}) as any;
      
      let targetUser: any = null;
      if (payload.type === "individual" && payload.targetUsername) {
        const cleanTarget = payload.targetUsername.replace(/[@\s]/g, "").trim().toLowerCase();
        targetUser = (Object.values(mockUsers) as any[]).find((u: any) => u.username.toLowerCase() === cleanTarget);
        if (!targetUser) {
          throw new Error("Nenhum usuário encontrado com este @username.");
        }
      }

      const chatId = "chat_" + Math.random().toString(36).substring(2, 11);
      const newChat: any = {
        id: chatId,
        type: payload.type,
        name: payload.name || (targetUser ? `${targetUser.firstName} ${targetUser.lastName}` : "Nova Conversa"),
        description: payload.description || "",
        avatarUrl: payload.avatarUrl || (targetUser ? targetUser.photoUrl : "https://api.dicebear.com/7.x/initials/svg?seed=GP"),
        members: payload.type === "individual" ? [currentUserId, targetUser.id] : [currentUserId],
        admins: [currentUserId],
        lastMessageText: "Nova conversa iniciada",
        lastMessageTimestamp: Date.now()
      };

      mockChats[chatId] = newChat;
      saveMockData("chats", mockChats);
      
      const mockMessages = getMockData("messages", {}) as any;
      mockMessages[chatId] = [];
      saveMockData("messages", mockMessages);

      return newChat;
    }

    let peerUserId = "";

    if (payload.type === "individual" && payload.targetUsername) {
      const cleanTarget = payload.targetUsername.replace(/[@\s]/g, "").trim();
      const sResponse = await fetch(`/api/search?query=${encodeURIComponent(cleanTarget)}`, {
        headers: getHeaders()
      });
      if (sResponse.ok) {
        const sData = await sResponse.json();
        const found = sData.users?.find(
          (u: any) => u.username.toLowerCase() === cleanTarget.toLowerCase()
        );
        if (found) {
          peerUserId = found.id;
        } else {
          throw new Error("Nenhum usuário encontrado com este @username.");
        }
      } else {
        throw new Error("Falha ao pesquisar usuário.");
      }
    }

    const body = {
      type: payload.type,
      name: payload.name,
      description: payload.description,
      avatarUrl: payload.avatarUrl,
      peerUserId: peerUserId || undefined
    };

    const res = await fetch("/api/chats/create", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao estabelecer conversa.");
    }

    return await res.json();
  },

  // Get messages of a chat
  async getMessages(chatId: string): Promise<Message[]> {
    if (useLocalSimulation) {
      const mockMessages = getMockData("messages", {}) as any;
      return mockMessages[chatId] || [];
    }

    const res = await fetch(`/api/chats/${chatId}/messages`, {
      headers: getHeaders()
    });
    if (!res.ok) {
      throw new Error("Erro ao recuperar histórico de mensagens.");
    }
    return await res.json();
  },

  // Send message
  async sendMessage(chatId: string, payload: any): Promise<Message> {
    if (useLocalSimulation) {
      const currentUserId = getLoggedInUserId();
      const mockUsers = getMockData("users", SEED_USERS) as any;
      const mockChats = getMockData("chats", {}) as any;
      const mockMessages = getMockData("messages", {}) as any;
      
      const currentUser = mockUsers[currentUserId] || { firstName: "Você", lastName: "", username: "user", photoUrl: "" };
      
      const newMsg: Message = {
        id: "msg_" + Math.random().toString(36).substring(2, 11),
        chatId,
        senderId: currentUserId,
        senderName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
        senderUsername: currentUser.username,
        senderPhoto: currentUser.photoUrl,
        type: payload.type || "text",
        content: payload.content || "",
        timestamp: Date.now(),
        reactions: {},
        isEdited: false,
        isDeleted: false,
        replyToId: payload.replyToId || undefined,
        mediaUrl: payload.mediaUrl || undefined
      };

      if (!mockMessages[chatId]) {
        mockMessages[chatId] = [];
      }
      mockMessages[chatId].push(newMsg);
      saveMockData("messages", mockMessages);

      if (mockChats[chatId]) {
        mockChats[chatId].lastMessageText = payload.type === "text" ? payload.content : `[${payload.type}]`;
        mockChats[chatId].lastMessageTimestamp = Date.now();
        saveMockData("chats", mockChats);
      }

      const chat = mockChats[chatId];
      if (chat && chat.type === "individual") {
        const peerId = chat.members.find((m: string) => m !== currentUserId);
        if (peerId === "suporte-id" || peerId === "carla-id") {
          setTimeout(() => {
            const peerUser = mockUsers[peerId];
            if (peerUser) {
              const botMsg: Message = {
                id: "msg_bot_" + Math.random().toString(36).substring(2, 11),
                chatId,
                senderId: peerUser.id,
                senderName: `${peerUser.firstName} ${peerUser.lastName}`,
                senderUsername: peerUser.username,
                senderPhoto: peerUser.photoUrl,
                type: "text" as MessageType,
                content: `Olá! Este é o suporte virtual do ChatLink rodando no modo de demonstração. Recebi sua mensagem: "${payload.content}". Em que posso ajudar?`,
                timestamp: Date.now(),
                reactions: {},
                isEdited: false,
                isDeleted: false
              };
              
              const updatedMessages = getMockData("messages", {}) as any;
              if (!updatedMessages[chatId]) updatedMessages[chatId] = [];
              updatedMessages[chatId].push(botMsg);
              saveMockData("messages", updatedMessages);

              if (mockChats[chatId]) {
                mockChats[chatId].lastMessageText = botMsg.content;
                mockChats[chatId].lastMessageTimestamp = Date.now();
                saveMockData("chats", mockChats);
              }

              window.dispatchEvent(new CustomEvent("chatlink-sync-event", {
                detail: { type: "message", data: botMsg }
              }));
            }
          }, 1500);
        }
      }

      return newMsg;
    }

    const res = await fetch(`/api/chats/${chatId}/messages/send`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao transmitir mensagem.");
    }

    return await res.json();
  },

  // Edit Message
  async editMessage(messageId: string, newContent: string): Promise<Message> {
    if (useLocalSimulation) {
      const mockMessages = getMockData("messages", {}) as any;
      let foundMsg: any = null;
      
      for (const cid in mockMessages) {
        const list = mockMessages[cid];
        const idx = list.findIndex((m: any) => m.id === messageId);
        if (idx !== -1) {
          list[idx].content = newContent;
          list[idx].isEdited = true;
          foundMsg = list[idx];
          break;
        }
      }
      
      if (foundMsg) {
        saveMockData("messages", mockMessages);
        window.dispatchEvent(new CustomEvent("chatlink-sync-event", {
          detail: { type: "message-edited", data: foundMsg }
        }));
        return foundMsg;
      }
      throw new Error("Mensagem não encontrada.");
    }

    const res = await fetch(`/api/messages/${messageId}/edit`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ content: newContent })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao editar mensagem.");
    }

    return await res.json();
  },

  // Delete message
  async deleteMessage(messageId: string, forEveryone: boolean): Promise<void> {
    if (useLocalSimulation) {
      const mockMessages = getMockData("messages", {}) as any;
      let foundMsg: any = null;
      let foundChatId = "";
      
      for (const cid in mockMessages) {
        const list = mockMessages[cid];
        const idx = list.findIndex((m: any) => m.id === messageId);
        if (idx !== -1) {
          if (forEveryone) {
            list[idx].content = "Mensagem apagada.";
            list[idx].isDeleted = true;
            foundMsg = list[idx];
          } else {
            list.splice(idx, 1);
          }
          foundChatId = cid;
          break;
        }
      }
      
      saveMockData("messages", mockMessages);
      if (foundMsg) {
        window.dispatchEvent(new CustomEvent("chatlink-sync-event", {
          detail: { type: "message-deleted", data: { id: messageId, chatId: foundChatId, isDeleted: true } }
        }));
      }
      return;
    }

    const res = await fetch(`/api/messages/${messageId}/delete`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ deleteForEveryone: forEveryone })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao remover mensagem.");
    }
  },

  // React to message with emoji
  async reactToMessage(messageId: string, emoji: string): Promise<void> {
    if (useLocalSimulation) {
      const currentUserId = getLoggedInUserId();
      const mockMessages = getMockData("messages", {}) as any;
      let foundMsg: any = null;
      let foundChatId = "";
      
      for (const cid in mockMessages) {
        const list = mockMessages[cid];
        const idx = list.findIndex((m: any) => m.id === messageId);
        if (idx !== -1) {
          const msg = list[idx];
          if (!msg.reactions) msg.reactions = {};
          msg.reactions[currentUserId] = emoji;
          foundMsg = msg;
          foundChatId = cid;
          break;
        }
      }
      
      if (foundMsg) {
        saveMockData("messages", mockMessages);
        window.dispatchEvent(new CustomEvent("chatlink-sync-event", {
          detail: { type: "message-reaction", data: { messageId, chatId: foundChatId, reactions: foundMsg.reactions } }
        }));
      }
      return;
    }

    const res = await fetch(`/api/messages/${messageId}/react`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ emoji })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao reagir à mensagem.");
    }
  },

  // Pin / Unpin message
  async pinMessage(messageId: string, pinned: boolean): Promise<void> {
    if (useLocalSimulation) {
      const mockMessages = getMockData("messages", {}) as any;
      let foundMsg: any = null;
      let foundChatId = "";
      
      for (const cid in mockMessages) {
        const list = mockMessages[cid];
        const idx = list.findIndex((m: any) => m.id === messageId);
        if (idx !== -1) {
          list[idx].pinned = pinned;
          foundMsg = list[idx];
          foundChatId = cid;
          break;
        }
      }
      
      if (foundMsg) {
        saveMockData("messages", mockMessages);
        window.dispatchEvent(new CustomEvent("chatlink-sync-event", {
          detail: { type: "message-pin", data: { messageId, chatId: foundChatId, isPinned: pinned } }
        }));
      }
      return;
    }

    const res = await fetch(`/api/messages/${messageId}/pin`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ pin: pinned })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao fixar/desafixar mensagem.");
    }
  },

  // Report message content
  async reportMessage(messageId: string, reason: string): Promise<void> {
    if (useLocalSimulation) {
      const currentUserId = getLoggedInUserId();
      const mockReports = getMockData("reports", []) as any[];
      mockReports.push({
        id: "rep_" + Math.random().toString(36).substring(2, 11),
        messageId,
        content: "Mensagem simulada",
        reportedUserId: "reported-user",
        reportedUsername: "username",
        reportedBy: currentUserId,
        reason,
        timestamp: Date.now(),
        resolved: false
      });
      saveMockData("reports", mockReports);
      return;
    }

    const res = await fetch("/api/messages/report", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ messageId, reason })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao registrar denúncia.");
    }
  },

  // Vote in Poll
  async votePoll(messageId: string, optionId: string): Promise<void> {
    if (useLocalSimulation) {
      const currentUserId = getLoggedInUserId();
      const mockMessages = getMockData("messages", {}) as any;
      let foundMsg: any = null;
      
      for (const cid in mockMessages) {
        const list = mockMessages[cid];
        const idx = list.findIndex((m: any) => m.id === messageId);
        if (idx !== -1) {
          const msg = list[idx];
          if (msg.pollOptions) {
            msg.pollOptions.forEach((opt: any) => {
              if (!opt.votes) opt.votes = [];
              opt.votes = opt.votes.filter((vid: string) => vid !== currentUserId);
              if (opt.id === optionId) {
                opt.votes.push(currentUserId);
              }
            });
          }
          foundMsg = msg;
          break;
        }
      }
      
      if (foundMsg) {
        saveMockData("messages", mockMessages);
        window.dispatchEvent(new CustomEvent("chatlink-sync-event", {
          detail: { type: "poll-vote-update", data: { messageId, poll: foundMsg.pollOptions } }
        }));
      }
      return;
    }

    const res = await fetch("/api/messages/poll-vote", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ messageId, optionId })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao registrar voto na enquete.");
    }
  },

  // Upload file (Converts to Base64, then transmits to Express API safely)
  async uploadFile(name: string, type: string, file: any): Promise<{ url: string; fileSize: number }> {
    if (useLocalSimulation) {
      const mockUrl = file instanceof File ? URL.createObjectURL(file) : `https://api.dicebear.com/7.x/initials/svg?seed=${name}`;
      return { url: mockUrl, fileSize: 1024 * 50 };
    }

    let base64Data = "";

    if (file instanceof File || file instanceof Blob) {
      base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const commaIdx = result.indexOf(",");
          if (commaIdx !== -1) {
            resolve(result.substring(commaIdx + 1));
          } else {
            resolve(result);
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    } else if (typeof file === "string") {
      base64Data = file;
    }

    const res = await fetch("/api/upload", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ fileName: name, fileType: type, base64Data })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Falha no upload do arquivo.");
    }

    const data = await res.json();
    return {
      url: data.url,
      fileSize: data.fileSize || 0
    };
  },

  // Mute / Unmute Chat
  async muteChat(chatId: string, mute: boolean): Promise<void> {
    if (useLocalSimulation) {
      const currentUserId = getLoggedInUserId();
      const mockUsers = getMockData("users", SEED_USERS) as any;
      const user = mockUsers[currentUserId];
      if (user) {
        if (!user.mutedChats) user.mutedChats = [];
        if (mute) {
          if (!user.mutedChats.includes(chatId)) user.mutedChats.push(chatId);
        } else {
          user.mutedChats = user.mutedChats.filter((id: string) => id !== chatId);
        }
        mockUsers[currentUserId] = user;
        saveMockData("users", mockUsers);
      }
      return;
    }

    const res = await fetch("/api/users/mute-chat", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ chatId, mute })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao alterar mudo da conversa.");
    }
  },

  // Update profile status or settings
  async updateProfile(updates: any): Promise<User> {
    if (useLocalSimulation) {
      const currentUserId = getLoggedInUserId();
      const mockUsers = getMockData("users", SEED_USERS) as any;
      const user = mockUsers[currentUserId];
      if (user) {
        const updated = { ...user, ...updates };
        mockUsers[currentUserId] = updated;
        saveMockData("users", mockUsers);
        localStorage.setItem("chatlink_user", JSON.stringify(updated));
        return updated;
      }
      throw new Error("Usuário não encontrado na simulação.");
    }

    const res = await fetch("/api/users/profile", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(updates)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao atualizar dados cadastrais.");
    }

    return await res.json();
  },

  // Get Contact Requests for current logged-in user
  async getContactRequests(): Promise<ContactRequest[]> {
    if (useLocalSimulation) {
      const currentUserId = getLoggedInUserId();
      const mockRequests = getMockData("contactRequests", {}) as any;
      return (Object.values(mockRequests) as any[]).filter((r: any) => r.receiverId === currentUserId && r.status === "pending") as ContactRequest[];
    }

    const res = await fetch("/api/contacts/requests", {
      headers: getHeaders()
    });
    if (!res.ok) {
      throw new Error("Erro ao carregar solicitações de contato.");
    }
    return await res.json();
  },

  // Send contact request by email
  async sendContactRequest(email: string): Promise<void> {
    if (useLocalSimulation) {
      const currentUserId = getLoggedInUserId();
      const mockUsers = getMockData("users", SEED_USERS) as any;
      const mockRequests = getMockData("contactRequests", {}) as any;
      
      const sender = mockUsers[currentUserId] as any;
      const target = (Object.values(mockUsers) as any[]).find((u: any) => u.email.toLowerCase() === email.toLowerCase()) as any;
      
      if (!target) {
        throw new Error("Nenhum usuário encontrado com este e-mail no ChatLink.");
      }
      if (target.id === currentUserId) {
        throw new Error("Você não pode enviar uma solicitação de contato para si mesmo.");
      }

      const reqId = "req_" + Math.random().toString(36).substring(2, 11);
      const newReq: ContactRequest = {
        id: reqId,
        senderId: currentUserId,
        senderName: `${sender.firstName} ${sender.lastName}`,
        senderUsername: sender.username,
        receiverId: target.id,
        status: "pending",
        createdAt: new Date().toISOString()
      };

      mockRequests[reqId] = newReq;
      saveMockData("contactRequests", mockRequests);

      // Auto accept simulator for demonstration
      setTimeout(() => {
        const reqs = getMockData("contactRequests", {}) as any;
        if (reqs[reqId] && reqs[reqId].status === "pending") {
          reqs[reqId].status = "accepted";
          saveMockData("contactRequests", reqs);

          const mockChats = getMockData("chats", {}) as any;
          const chatId = "chat_" + Math.random().toString(36).substring(2, 11);
          const newChat = {
            id: chatId,
            type: "individual",
            name: `${target.firstName} ${target.lastName}`,
            avatarUrl: target.photoUrl,
            members: [currentUserId, target.id],
            admins: [currentUserId, target.id],
            lastMessageText: "Solicitação de contato aceita!",
            lastMessageTimestamp: Date.now()
          };
          mockChats[chatId] = newChat;
          saveMockData("chats", mockChats);

          const mockMessages = getMockData("messages", {}) as any;
          mockMessages[chatId] = [
            {
              id: "msg_" + Math.random().toString(36).substring(2, 11),
              chatId,
              senderId: target.id,
              senderName: `${target.firstName} ${target.lastName}`,
              senderUsername: target.username,
              senderPhoto: target.photoUrl,
              type: "text",
              content: `Olá! Fico feliz em nos conectarmos aqui no ChatLink. Vamos conversar!`,
              timestamp: Date.now(),
              reactions: {},
              isEdited: false,
              isDeleted: false
            }
          ];
          saveMockData("messages", mockMessages);

          window.dispatchEvent(new CustomEvent("chatlink-sync-event", {
            detail: { type: "chat-created", data: newChat }
          }));
        }
      }, 2000);

      return;
    }

    const res = await fetch("/api/contacts/requests", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ email })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Falha ao enviar solicitação de contato.");
    }
  },

  // Accept contact request
  async acceptContactRequest(reqId: string): Promise<void> {
    if (useLocalSimulation) {
      const mockRequests = getMockData("contactRequests", {}) as any;
      const req = mockRequests[reqId];
      if (req) {
        req.status = "accepted";
        saveMockData("contactRequests", mockRequests);
        
        const currentUserId = getLoggedInUserId();
        const mockUsers = getMockData("users", SEED_USERS) as any;
        const mockChats = getMockData("chats", {}) as any;
        const sender = mockUsers[req.senderId];
        
        const chatId = "chat_" + Math.random().toString(36).substring(2, 11);
        const newChat = {
          id: chatId,
          type: "individual",
          name: `${sender.firstName} ${sender.lastName}`,
          avatarUrl: sender.photoUrl,
          members: [currentUserId, req.senderId],
          admins: [currentUserId, req.senderId],
          lastMessageText: "Solicitação de contato aceita.",
          lastMessageTimestamp: Date.now()
        };
        mockChats[chatId] = newChat;
        saveMockData("chats", mockChats);
        
        const mockMessages = getMockData("messages", {}) as any;
        mockMessages[chatId] = [];
        saveMockData("messages", mockMessages);
        
        window.dispatchEvent(new CustomEvent("chatlink-sync-event", {
          detail: { type: "chat-created", data: newChat }
        }));
      }
      return;
    }

    const res = await fetch(`/api/contacts/requests/${reqId}/accept`, {
      method: "POST",
      headers: getHeaders()
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao aceitar solicitação de contato.");
    }
  },

  // Decline contact request
  async declineContactRequest(reqId: string): Promise<void> {
    if (useLocalSimulation) {
      const mockRequests = getMockData("contactRequests", {}) as any;
      const req = mockRequests[reqId];
      if (req) {
        req.status = "declined";
        saveMockData("contactRequests", mockRequests);
      }
      return;
    }

    const res = await fetch(`/api/contacts/requests/${reqId}/decline`, {
      method: "POST",
      headers: getHeaders()
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao recusar solicitação de contato.");
    }
  },

  // Calls
  async createCall(payload: any): Promise<Call> {
    if (useLocalSimulation) {
      const currentUserId = getLoggedInUserId();
      const mockUsers = getMockData("users", SEED_USERS) as any;
      const receiver = mockUsers[payload.receiverId] || { firstName: "Contato", lastName: "" };
      
      const callId = "call_" + Math.random().toString(36).substring(2, 11);
      const newCall: Call = {
        id: callId,
        callerId: currentUserId,
        callerName: "Você",
        callerPhoto: "https://api.dicebear.com/7.x/adventurer/svg?seed=caller",
        receiverId: payload.receiverId,
        receiverName: `${receiver.firstName} ${receiver.lastName}`,
        receiverPhoto: receiver.photoUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=receiver",
        type: payload.type,
        status: "ringing",
        timestamp: Date.now()
      };
      
      const mockCalls = getMockData("calls", {}) as any;
      mockCalls[callId] = newCall;
      saveMockData("calls", mockCalls);
      
      lastIncomingCall = newCall;

      // Simulate connection after 3 seconds
      setTimeout(() => {
        const calls = getMockData("calls", {}) as any;
        if (calls[callId] && calls[callId].status === "ringing") {
          calls[callId].status = "connected";
          saveMockData("calls", calls);
          lastIncomingCall = calls[callId];
          window.dispatchEvent(new CustomEvent("chatlink-sync-event", {
            detail: { type: "call-updated", data: calls[callId] }
          }));
        }
      }, 3000);

      return newCall;
    }

    const res = await fetch("/api/calls/trigger", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        receiverId: payload.receiverId,
        type: payload.type
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao iniciar ligação.");
    }

    return await res.json();
  },

  // Fetch ring-status call
  async getIncomingCall(): Promise<Call | null> {
    return lastIncomingCall;
  },

  // Update Call State (ringing, connected, declined, ended)
  async updateCall(callId: string, status: Call["status"], duration?: number): Promise<Call> {
    if (useLocalSimulation) {
      const mockCalls = getMockData("calls", {}) as any;
      const call = mockCalls[callId];
      if (call) {
        call.status = status;
        if (duration) call.duration = duration;
        mockCalls[callId] = call;
        saveMockData("calls", mockCalls);
        lastIncomingCall = call;
        window.dispatchEvent(new CustomEvent("chatlink-sync-event", {
          detail: { type: "call-updated", data: call }
        }));
        return call;
      }
      throw new Error("Chamada não encontrada.");
    }

    const res = await fetch(`/api/calls/${callId}/update`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ status, duration })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao alterar estado da chamada.");
    }

    const data = await res.json();
    if (lastIncomingCall && lastIncomingCall.id === callId) {
      lastIncomingCall = data;
    }
    return data;
  },

  // Sessions list
  async getSessions(): Promise<UserSession[]> {
    if (useLocalSimulation) {
      return [
        {
          id: "session_1",
          device: navigator.userAgent,
          ip: "127.0.0.1",
          lastActive: new Date().toISOString(),
          isCurrent: true
        }
      ];
    }

    const res = await fetch("/api/auth/me", {
      headers: getHeaders()
    });
    const userMeRes = await fetch("/api/auth/sessions", {
      headers: getHeaders()
    });
    if (!userMeRes.ok) {
      throw new Error("Erro ao recuperar sessões ativas.");
    }
    return await userMeRes.json();
  },

  // Remote logout
  async logoutOtherSessions(): Promise<void> {
    if (useLocalSimulation) return;

    const res = await fetch("/api/auth/sessions/logout-other", {
      method: "POST",
      headers: getHeaders()
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao deslogar outros terminais.");
    }
  },

  // Admin Statistics & Logs
  async getAdminStats(): Promise<{ stats: SystemStats; users: User[]; reports: ReportedMessage[]; logs: AuditLog[] }> {
    if (useLocalSimulation) {
      const mockUsers = getMockData("users", SEED_USERS) as any;
      const mockReports = getMockData("reports", []) as any[];
      
      const stats: SystemStats = {
        totalUsers: Object.keys(mockUsers).length,
        activeUsers24h: Object.keys(mockUsers).length,
        totalMessages: 150,
        totalGroups: Object.keys(getMockData("chats", {})).length,
        totalChannels: 0,
        totalCommunities: 0,
        storageUsedBytes: 1024 * 512
      };
      
      return {
        stats,
        users: Object.values(mockUsers) as any[],
        reports: mockReports,
        logs: []
      };
    }

    const res = await fetch("/api/admin/stats", {
      headers: getHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Acesso restrito. Painel disponível apenas para administradores.");
    }
    return await res.json();
  },

  // Toggle Banned Status
  async adminToggleBan(userId: string, ban: boolean): Promise<void> {
    if (useLocalSimulation) {
      const mockUsers = getMockData("users", SEED_USERS) as any;
      if (mockUsers[userId]) {
        mockUsers[userId].isBanned = ban;
        saveMockData("users", mockUsers);
      }
      return;
    }

    const res = await fetch("/api/admin/ban", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ targetUserId: userId, ban })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao atualizar status de banimento do usuário.");
    }
  },

  // Resolve reported message
  async adminResolveReport(reportId: string): Promise<void> {
    if (useLocalSimulation) {
      const mockReports = getMockData("reports", []) as any[];
      const idx = mockReports.findIndex((r: any) => r.id === reportId);
      if (idx !== -1) {
        mockReports[idx].resolved = true;
        saveMockData("reports", mockReports);
      }
      return;
    }

    const res = await fetch(`/api/admin/reports/${reportId}/resolve`, {
      method: "POST",
      headers: getHeaders()
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao marcar denúncia como resolvida.");
    }
  }
};

// Auto-boot SSE if already has a valid credentials token on startup
if (typeof window !== "undefined" && localStorage.getItem("chatlink_token") && !useLocalSimulation) {
  setTimeout(() => {
    initEventSource();
  }, 200);
}
