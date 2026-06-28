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

// Shadow global fetch to automatically catch 401 Unauthorized errors (e.g. from server restart)
async function fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await window.fetch(input, init);
  if (res.status === 401 && localStorage.getItem("chatlink_token") && !String(input).includes("/api/auth/login")) {
    triggerUnauthorized();
  }
  return res;
}

// SSE Realtime Sync Engine Manager
let eventSource: EventSource | null = null;
let lastIncomingCall: Call | null = null;

export function initEventSource() {
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
        // Doing a quick check. If it returns 401, the fetch interceptor will trigger logout.
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

  // Register real-time event handlers propagated from Express backend
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
        } else if (evtName === "call-updated" && lastIncomingCall && lastIncomingCall.id === data.id) {
          lastIncomingCall = data;
        }

        // Propagate to components via window CustomEvent listener
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
  initEventSource();
}

export function clearSession() {
  closeEventSource();
  localStorage.removeItem("chatlink_token");
  localStorage.removeItem("chatlink_user");
}

// REST Client bound to the production server
export const api = {
  // Login
  async login(payload: any): Promise<{ token: string; user: User; requireTwoFactor?: boolean; tempToken: string }> {
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
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao registrar conta comercial.");
    }

    return await res.json();
  },

  // Username validation lookup
  async checkUsername(username: string): Promise<{ available: boolean; suggestions?: string[] }> {
    const clean = username.replace(/[@\s]/g, "").trim();
    const res = await fetch(`/api/auth/username-check?username=${encodeURIComponent(clean)}`);
    if (!res.ok) {
      throw new Error("Erro ao consultar disponibilidade de username.");
    }
    return await res.json();
  },

  // Password Recovery simulator
  async recovery(email: string): Promise<{ message: string; simulatedDetails: any }> {
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
          throw new Error("Nenhum usuário comercial encontrado com este @username.");
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
      throw new Error(err.error || "Falha no upload do arquivo corporativo.");
    }

    const data = await res.json();
    return {
      url: data.url,
      fileSize: data.fileSize || 0
    };
  },

  // Mute / Unmute Chat
  async muteChat(chatId: string, mute: boolean): Promise<void> {
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
      throw new Error(err.error || "Erro ao iniciar ligação comercial.");
    }

    return await res.json();
  },

  // Fetch ring-status call
  async getIncomingCall(): Promise<Call | null> {
    // Rely on real-time SSE triggers or fallback to last ring state
    return lastIncomingCall;
  },

  // Update Call State (ringing, connected, declined, ended)
  async updateCall(callId: string, status: Call["status"], duration?: number): Promise<Call> {
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
if (typeof window !== "undefined" && localStorage.getItem("chatlink_token")) {
  setTimeout(() => {
    initEventSource();
  }, 200);
}
