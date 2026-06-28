import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { 
  User, 
  UserStatus, 
  Chat, 
  Message, 
  Community, 
  Call, 
  ReportedMessage, 
  AuditLog, 
  SystemStats,
  ContactRequest
} from "./src/types.js";

// Ensure data and uploads directories exist
const DATA_DIR = path.join(process.cwd(), "data");
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const DB_FILE = path.join(DATA_DIR, "db.json");

// In-Memory Database State
let users: Record<string, User & { passwordHash: string }> = {};
let chats: Record<string, Chat> = {};
let messages: Record<string, Message[]> = {}; // Keyed by chatId
let communities: Record<string, Community> = {};
let calls: Record<string, Call> = {};
let reports: ReportedMessage[] = [];
let auditLogs: AuditLog[] = [];
let contactRequests: Record<string, ContactRequest> = {};

// Load DB from file if exists
if (fs.existsSync(DB_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
    users = data.users || {};
    chats = data.chats || {};
    messages = data.messages || {};
    communities = data.communities || {};
    calls = data.calls || {};
    reports = data.reports || [];
    auditLogs = data.auditLogs || [];
    contactRequests = data.contactRequests || {};
    console.log("Database successfully loaded from storage.");
  } catch (err) {
    console.error("Error reading database file, starting fresh:", err);
  }
}

// Save DB helper
function saveDb() {
  try {
    const data = { users, chats, messages, communities, calls, reports, auditLogs, contactRequests };
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving database:", err);
  }
}

// Simple security token store (in-memory)
const activeSessions: Record<string, { userId: string; device: string; ip: string; lastActive: number }> = {};

// SSE connections (for real-time push events)
interface SSEConnection {
  res: any;
  userId: string;
}
let sseConnections: SSEConnection[] = [];

function broadcastToUser(userId: string, event: string, data: any) {
  // Push to SSE clients
  sseConnections
    .filter((conn) => conn.userId === userId)
    .forEach((conn) => {
      conn.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    });
}

function broadcastToChatMembers(chatId: string, event: string, data: any) {
  const chat = chats[chatId];
  if (!chat) return;
  chat.members.forEach((memberId) => {
    broadcastToUser(memberId, event, data);
  });
}

// Password hashing utility
function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

// Generate secure tokens
function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// Logs actions
function addAuditLog(userId: string, action: string, details: string, req: express.Request) {
  const user = users[userId];
  const username = user ? `@${user.username}` : "Anonymous";
  const log: AuditLog = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    action,
    userId,
    username,
    details,
    ip: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1",
    device: req.headers["user-agent"] || "Unknown Device"
  };
  auditLogs.unshift(log);
  if (auditLogs.length > 500) auditLogs.pop(); // limit size
  saveDb();
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON Body parser limit (for handling file base64 uploads)
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Serve static files from uploads folder
  app.use("/uploads", express.static(UPLOADS_DIR));

  // Middleware: Authentication Guard
  const authenticateUser = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Acesso não autorizado. Faça login novamente." });
      return;
    }
    const token = authHeader.split(" ")[1];
    const session = activeSessions[token];
    if (!session) {
      res.status(401).json({ error: "Sessão expirada ou inválida." });
      return;
    }
    const user = users[session.userId];
    if (!user) {
      res.status(404).json({ error: "Usuário não encontrado." });
      return;
    }
    if (user.isBanned) {
      res.status(403).json({ error: "Esta conta foi banida por violação de termos de serviço." });
      return;
    }
    // Update active status
    session.lastActive = Date.now();
    user.lastActive = Date.now();
    user.status = user.status === UserStatus.INVISIBLE ? UserStatus.INVISIBLE : UserStatus.ONLINE;
    
    req.body.currentUserId = session.userId;
    req.body.currentSessionToken = token;
    next();
  };

  // --- API ROUTES ---

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: Date.now() });
  });

  // Check Username Availability & Suggest Alternatives
  app.get("/api/auth/username-check", (req, res) => {
    const username = (req.query.username as string)?.toLowerCase().replace(/[@\s]/g, "");
    if (!username || username.length < 3) {
      res.json({ available: false, suggestions: [] });
      return;
    }

    const exists = Object.values(users).some((u) => u.username.toLowerCase() === username);
    if (!exists) {
      res.json({ available: true, suggestions: [] });
      return;
    }

    // Generate suggestions
    const year = new Date().getFullYear();
    const suggestions = [
      `${username}${Math.floor(Math.random() * 90) + 10}`,
      `${username}${year}`,
      `${username}_oficial`,
      `${username}_link`,
      `chat_${username}`
    ].filter(s => !Object.values(users).some((u) => u.username.toLowerCase() === s));

    res.json({ available: false, suggestions });
  });

  // User Register
  app.post("/api/auth/register", (req, res) => {
    const { email, password, username, firstName, lastName, photoUrl, bio, dateOfBirth } = req.body;

    if (!email || !password || !username || !firstName || !lastName) {
      res.status(400).json({ error: "Preencha todos os campos obrigatórios." });
      return;
    }

    const cleanUsername = username.toLowerCase().replace(/[@\s]/g, "");
    const emailLower = email.toLowerCase();

    // Check email
    const emailExists = Object.values(users).some((u) => u.email.toLowerCase() === emailLower);
    if (emailExists) {
      res.status(400).json({ error: "E-mail já cadastrado." });
      return;
    }

    // Check username
    const usernameExists = Object.values(users).some((u) => u.username.toLowerCase() === cleanUsername);
    if (usernameExists) {
      res.status(400).json({ error: "Nome de usuário já ocupado." });
      return;
    }

    const userId = crypto.randomUUID();
    const newUser: User & { passwordHash: string } = {
      id: userId,
      email: emailLower,
      username: cleanUsername,
      firstName,
      lastName,
      passwordHash: hashPassword(password),
      photoUrl: photoUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${cleanUsername}`,
      coverUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200",
      bio: bio || "Olá! Estou usando o ChatLink.",
      city: req.body.city || "",
      country: req.body.country || "",
      language: req.body.language || "pt-BR",
      status: UserStatus.ONLINE,
      createdAt: Date.now(),
      lastActive: Date.now(),
      privacySettings: {
        whoSeesPhoto: "everyone",
        whoSeesStatus: "everyone",
        whoSeesLastActive: "everyone",
        whoSeesBio: "everyone",
        whoCanMessage: "everyone",
        whoCanCall: "everyone",
        whoCanAddGroup: "everyone",
        whoFindsByUsername: "everyone"
      },
      blockedUsers: [],
      mutedUsers: [],
      mutedChats: []
    };

    users[userId] = newUser;
    saveDb();

    // Create session
    const token = generateToken();
    activeSessions[token] = {
      userId,
      device: req.headers["user-agent"] || "Browser Web",
      ip: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1",
      lastActive: Date.now()
    };

    addAuditLog(userId, "Registro de Usuário", `Registrado com sucesso como @${cleanUsername}`, req);

    res.json({
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        username: newUser.username,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        photoUrl: newUser.photoUrl,
        bio: newUser.bio,
        status: newUser.status,
        privacySettings: newUser.privacySettings
      }
    });
  });

  // User Login
  app.post("/api/auth/login", (req, res) => {
    const { email, password, rememberMe } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "E-mail e senha são obrigatórios." });
      return;
    }

    const emailLower = email.toLowerCase();
    const user = Object.values(users).find((u) => u.email.toLowerCase() === emailLower);

    if (!user || user.passwordHash !== hashPassword(password)) {
      res.status(401).json({ error: "E-mail ou senha incorretos." });
      return;
    }

    if (user.isBanned) {
      res.status(403).json({ error: "Esta conta foi banida por violação de termos de serviço." });
      return;
    }

    const token = generateToken();
    activeSessions[token] = {
      userId: user.id,
      device: req.headers["user-agent"] || "Browser Web",
      ip: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1",
      lastActive: Date.now()
    };

    user.status = UserStatus.ONLINE;
    user.lastActive = Date.now();
    saveDb();

    addAuditLog(user.id, "Login de Usuário", `Fez login via ${rememberMe ? "Lembrar acesso" : "Sessão simples"}`, req);

    // If 2FA is enabled, require second step
    if (user.twoFactorEnabled) {
      res.json({
        requireTwoFactor: true,
        tempToken: token
      });
      return;
    }

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        photoUrl: user.photoUrl,
        coverUrl: user.coverUrl,
        bio: user.bio,
        city: user.city,
        country: user.country,
        language: user.language,
        status: user.status,
        privacySettings: user.privacySettings,
        blockedUsers: user.blockedUsers,
        mutedUsers: user.mutedUsers,
        mutedChats: user.mutedChats,
        twoFactorEnabled: user.twoFactorEnabled
      }
    });
  });

  // 2FA Verification Action
  app.post("/api/auth/2fa-verify", (req, res) => {
    const { tempToken, code } = req.body;
    const session = activeSessions[tempToken];
    if (!session) {
      res.status(401).json({ error: "Token de autenticação temporário inválido." });
      return;
    }

    const user = users[session.userId];
    if (!user) {
      res.status(404).json({ error: "Usuário não encontrado." });
      return;
    }

    // Standard simulated code 2FA: "123456" or matching their preset secret
    if (code !== "123456" && code !== user.twoFactorSecret) {
      res.status(400).json({ error: "Código de verificação incorreto." });
      return;
    }

    res.json({
      token: tempToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        photoUrl: user.photoUrl,
        coverUrl: user.coverUrl,
        bio: user.bio,
        city: user.city,
        country: user.country,
        language: user.language,
        status: user.status,
        privacySettings: user.privacySettings,
        blockedUsers: user.blockedUsers,
        mutedUsers: user.mutedUsers,
        mutedChats: user.mutedChats,
        twoFactorEnabled: user.twoFactorEnabled
      }
    });
  });

  // Recovery Password Simulate
  app.post("/api/auth/recovery", (req, res) => {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: "E-mail é obrigatório." });
      return;
    }

    const user = Object.values(users).find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      res.status(404).json({ error: "Não encontramos uma conta associada a este e-mail." });
      return;
    }

    // In a real application, an email is sent. Here we simulate it beautifully and output recovery details.
    res.json({
      success: true,
      message: "Instruções de recuperação enviadas para o seu e-mail.",
      simulatedDetails: {
        code: "CHL-9824",
        tempPassword: "chatlink_temp_pass"
      }
    });
  });

  // Get Current User Profile info
  app.get("/api/auth/me", authenticateUser, (req, res) => {
    const { currentUserId } = req.body;
    const user = users[currentUserId];
    res.json(user);
  });

  // User sessions
  app.get("/api/auth/sessions", authenticateUser, (req, res) => {
    const { currentUserId, currentSessionToken } = req.body;
    const list = Object.entries(activeSessions)
      .filter(([token, session]) => session.userId === currentUserId)
      .map(([token, session]) => ({
        id: token,
        device: session.device,
        ip: session.ip,
        lastActive: session.lastActive,
        isCurrent: token === currentSessionToken
      }));
    res.json(list);
  });

  // End other user sessions remotey
  app.post("/api/auth/sessions/logout-other", authenticateUser, (req, res) => {
    const { currentUserId, currentSessionToken } = req.body;
    Object.keys(activeSessions).forEach((token) => {
      if (activeSessions[token].userId === currentUserId && token !== currentSessionToken) {
        delete activeSessions[token];
      }
    });
    addAuditLog(currentUserId, "Encerramento de Sessões", "Encerrou todas as outras sessões ativas remotamente", req);
    res.json({ success: true });
  });

  // Set Profile Status or Privacy
  app.post("/api/users/profile", authenticateUser, (req, res) => {
    const { currentUserId, firstName, lastName, bio, photoUrl, coverUrl, city, country, language, status, privacySettings, twoFactorEnabled, twoFactorSecret } = req.body;
    const user = users[currentUserId];

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (bio !== undefined) user.bio = bio;
    if (photoUrl) user.photoUrl = photoUrl;
    if (coverUrl) user.coverUrl = coverUrl;
    if (city !== undefined) user.city = city;
    if (country !== undefined) user.country = country;
    if (language) user.language = language;
    if (status) user.status = status as UserStatus;
    if (privacySettings) user.privacySettings = { ...user.privacySettings, ...privacySettings };
    if (twoFactorEnabled !== undefined) {
      user.twoFactorEnabled = twoFactorEnabled;
      user.twoFactorSecret = twoFactorSecret || "123456";
    }

    user.lastActive = Date.now();
    saveDb();

    // Broadcast update to chats
    Object.values(chats).forEach((chat) => {
      if (chat.members.includes(currentUserId)) {
        broadcastToChatMembers(chat.id, "user-profile-update", {
          userId: currentUserId,
          status: user.status,
          photoUrl: user.photoUrl,
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
          bio: user.bio,
          lastActive: user.lastActive
        });
      }
    });

    res.json(user);
  });

  // Block User Action
  app.post("/api/users/block", authenticateUser, (req, res) => {
    const { currentUserId, targetUserId } = req.body;
    const user = users[currentUserId];
    if (!users[targetUserId]) {
      res.status(404).json({ error: "Usuário alvo não encontrado." });
      return;
    }
    if (currentUserId === targetUserId) {
      res.status(400).json({ error: "Não é possível bloquear a si mesmo." });
      return;
    }
    if (!user.blockedUsers.includes(targetUserId)) {
      user.blockedUsers.push(targetUserId);
      saveDb();
      addAuditLog(currentUserId, "Bloqueio de Usuário", `Bloqueou o usuário @${users[targetUserId].username}`, req);
    }
    res.json({ blockedUsers: user.blockedUsers });
  });

  // Unblock User
  app.post("/api/users/unblock", authenticateUser, (req, res) => {
    const { currentUserId, targetUserId } = req.body;
    const user = users[currentUserId];
    user.blockedUsers = user.blockedUsers.filter((id) => id !== targetUserId);
    saveDb();
    addAuditLog(currentUserId, "Desbloqueio de Usuário", `Desbloqueou o usuário @${users[targetUserId]?.username || targetUserId}`, req);
    res.json({ blockedUsers: user.blockedUsers });
  });

  // Mute / Unmute chats/groups
  app.post("/api/users/mute-chat", authenticateUser, (req, res) => {
    const { currentUserId, chatId, mute } = req.body;
    const user = users[currentUserId];
    if (mute) {
      if (!user.mutedChats.includes(chatId)) {
        user.mutedChats.push(chatId);
      }
    } else {
      user.mutedChats = user.mutedChats.filter((id) => id !== chatId);
    }
    saveDb();
    res.json({ mutedChats: user.mutedChats });
  });

  // Global Search Users and chats
  app.get("/api/search", authenticateUser, (req, res) => {
    const { query } = req.query;
    const { currentUserId } = req.body;
    const q = (query as string || "").toLowerCase().trim();

    if (!q) {
      res.json({ users: [], chats: [] });
      return;
    }

    // Search active registered users
    const resultsUsers = Object.values(users)
      .filter((u) => u.id !== currentUserId && !u.isBanned && (
        u.username.toLowerCase().includes(q) ||
        u.firstName.toLowerCase().includes(q) ||
        u.lastName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      ))
      .map((u) => ({
        id: u.id,
        username: u.username,
        firstName: u.firstName,
        lastName: u.lastName,
        photoUrl: u.photoUrl,
        bio: u.bio,
        status: u.privacySettings.whoSeesStatus === "everyone" ? u.status : UserStatus.INVISIBLE
      }));

    // Search public channels or active groups
    const resultsChats = Object.values(chats)
      .filter((c) => c.members.includes(currentUserId) && c.name.toLowerCase().includes(q))
      .map((c) => ({
        id: c.id,
        type: c.type,
        name: c.name,
        avatarUrl: c.avatarUrl,
        description: c.description
      }));

    res.json({ users: resultsUsers, chats: resultsChats });
  });

  // Get Chats List for current logged user
  app.get("/api/chats", authenticateUser, (req, res) => {
    const { currentUserId } = req.body;

    const userChats = Object.values(chats)
      .filter((chat) => chat.members.includes(currentUserId))
      .map((chat) => {
        let finalName = chat.name;
        let finalAvatar = chat.avatarUrl;
        let peerStatus: UserStatus = UserStatus.INVISIBLE;
        let peerLastActive = 0;
        let peerId = "";

        // If it is an individual chat, dynamically resolve the peer's name and photo (respect privacy rules)
        if (chat.type === "individual") {
          const peerUserId = chat.members.find((id) => id !== currentUserId) || currentUserId;
          peerId = peerUserId;
          const peer = users[peerUserId];
          if (peer) {
            finalName = `${peer.firstName} ${peer.lastName}`;
            finalAvatar = peer.privacySettings.whoSeesPhoto === "everyone" || (peer.privacySettings.whoSeesPhoto === "contacts" && !peer.blockedUsers.includes(currentUserId)) ? peer.photoUrl : "https://api.dicebear.com/7.x/initials/svg?seed=CL";
            peerStatus = peer.privacySettings.whoSeesStatus === "everyone" ? peer.status : UserStatus.INVISIBLE;
            peerLastActive = peer.privacySettings.whoSeesLastActive === "everyone" ? peer.lastActive : 0;
          } else {
            finalName = "Usuário Desconhecido";
          }
        }

        const chatMessages = messages[chat.id] || [];
        const lastMsg = chatMessages[chatMessages.length - 1];

        return {
          ...chat,
          name: finalName,
          avatarUrl: finalAvatar,
          peerId,
          peerStatus,
          peerLastActive,
          lastMessageText: lastMsg ? (lastMsg.isDeletedForEveryone ? "Mensagem apagada" : lastMsg.content || `[${lastMsg.type}]`) : chat.description || "Nenhuma mensagem ainda.",
          lastMessageTimestamp: lastMsg ? lastMsg.timestamp : chat.lastMessageTimestamp || 0
        };
      })
      .sort((a, b) => (b.lastMessageTimestamp || 0) - (a.lastMessageTimestamp || 0));

    res.json(userChats);
  });

  // Create Chat / Group / Channel
  app.post("/api/chats/create", authenticateUser, (req, res) => {
    const { currentUserId, type, name, description, avatarUrl, peerUserId, channelCommentsEnabled } = req.body;

    if (type === "individual") {
      if (!peerUserId) {
        res.status(400).json({ error: "Identificador do contato é obrigatório." });
        return;
      }

      // Check if chat already exists
      const existing = Object.values(chats).find(
        (c) => c.type === "individual" && c.members.includes(currentUserId) && c.members.includes(peerUserId)
      );

      if (existing) {
        res.json(existing);
        return;
      }

      const peerUser = users[peerUserId];
      if (!peerUser) {
        res.status(404).json({ error: "Usuário não encontrado." });
        return;
      }

      const chatId = crypto.randomUUID();
      const newChat: Chat = {
        id: chatId,
        type: "individual",
        name: `${peerUser.firstName} ${peerUser.lastName}`,
        avatarUrl: peerUser.photoUrl,
        members: [currentUserId, peerUserId],
        admins: [currentUserId, peerUserId],
        lastMessageText: "Conversa iniciada",
        lastMessageTimestamp: Date.now()
      };

      chats[chatId] = newChat;
      messages[chatId] = [];
      saveDb();

      broadcastToUser(peerUserId, "chat-created", newChat);

      res.json(newChat);
      return;
    }

    // Group or Channel
    if (!name) {
      res.status(400).json({ error: "Nome do grupo/canal é obrigatório." });
      return;
    }

    const chatId = crypto.randomUUID();
    const cleanAvatar = avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${name}`;
    const newChat: Chat = {
      id: chatId,
      type: type as any,
      name,
      description: description || "",
      avatarUrl: cleanAvatar,
      members: [currentUserId],
      admins: [currentUserId],
      inviteCode: crypto.randomBytes(6).toString("hex"),
      lastMessageText: `${type === "channel" ? "Canal" : "Grupo"} criado com sucesso.`,
      lastMessageTimestamp: Date.now(),
      channelCommentsEnabled: !!channelCommentsEnabled,
      groupPermissions: {
        whoCanSend: "all",
        whoCanChangeInfo: "admins",
        whoCanAddMembers: "all",
        whoCanPinMessages: "admins"
      }
    };

    // Add extra members if provided
    if (req.body.memberIds && Array.isArray(req.body.memberIds)) {
      req.body.memberIds.forEach((mId: string) => {
        if (users[mId] && !newChat.members.includes(mId)) {
          newChat.members.push(mId);
        }
      });
    }

    chats[chatId] = newChat;
    messages[chatId] = [];
    saveDb();

    newChat.members.forEach((mId) => {
      broadcastToUser(mId, "chat-created", newChat);
    });

    addAuditLog(currentUserId, `Criação de ${type}`, `Criou o ${type} "${name}"`, req);

    res.json(newChat);
  });

  // Join group via invite code
  app.post("/api/chats/join", authenticateUser, (req, res) => {
    const { currentUserId, inviteCode } = req.body;
    if (!inviteCode) {
      res.status(400).json({ error: "Código de convite obrigatório." });
      return;
    }

    const chat = Object.values(chats).find((c) => c.inviteCode === inviteCode);
    if (!chat) {
      res.status(404).json({ error: "Código de convite inválido ou expirado." });
      return;
    }

    if (chat.members.includes(currentUserId)) {
      res.json({ message: "Você já é membro deste grupo.", chat });
      return;
    }

    chat.members.push(currentUserId);
    chat.lastMessageTimestamp = Date.now();
    saveDb();

    // Broadcast member joined
    const systemMsgId = crypto.randomUUID();
    const systemMsg: Message = {
      id: systemMsgId,
      chatId: chat.id,
      senderId: "system",
      senderName: "Sistema",
      senderUsername: "system",
      senderPhoto: "",
      type: "text",
      content: `@${users[currentUserId].username} entrou no grupo através do link.`,
      timestamp: Date.now()
    };
    messages[chat.id].push(systemMsg);
    saveDb();

    broadcastToChatMembers(chat.id, "member-joined", { chat, user: users[currentUserId], systemMsg });

    res.json({ message: "Inscrito com sucesso!", chat });
  });

  // Get Messages for chat
  app.get("/api/chats/:chatId/messages", authenticateUser, (req, res) => {
    const { chatId } = req.params;
    const { currentUserId } = req.body;

    const chat = chats[chatId];
    if (!chat || !chat.members.includes(currentUserId)) {
      res.status(403).json({ error: "Você não tem permissão para ver estas mensagens." });
      return;
    }

    const chatMsgs = messages[chatId] || [];
    res.json(chatMsgs);
  });

  // Send Message (Supports Texts, emojis, coordinates, media details, polls, ephemeral timers, etc.)
  app.post("/api/chats/:chatId/messages/send", authenticateUser, (req, res) => {
    const { chatId } = req.params;
    const { 
      currentUserId, 
      type, 
      content, 
      mediaUrl, 
      fileName, 
      fileSize, 
      fileType, 
      audioDuration, 
      locationLat, 
      locationLng, 
      locationName,
      contactName,
      contactUsername,
      pollQuestion,
      pollOptions,
      replyToId,
      ephemeralDuration
    } = req.body;

    const chat = chats[chatId];
    if (!chat || !chat.members.includes(currentUserId)) {
      res.status(403).json({ error: "Acesso negado. Você não é participante deste chat." });
      return;
    }

    // Check permissions
    if (chat.type === "group" && chat.groupPermissions?.whoCanSend === "admins" && !chat.admins.includes(currentUserId)) {
      res.status(403).json({ error: "Somente administradores podem enviar mensagens neste grupo." });
      return;
    }

    if (chat.type === "channel" && !chat.admins.includes(currentUserId)) {
      res.status(403).json({ error: "Somente administradores podem publicar no canal." });
      return;
    }

    const sender = users[currentUserId];
    const messageId = crypto.randomUUID();

    // Build poll options structure
    let formattedPollOptions = undefined;
    if (type === "poll" && pollQuestion && pollOptions && Array.isArray(pollOptions)) {
      formattedPollOptions = pollOptions.map((opt: string) => ({
        id: crypto.randomUUID(),
        text: opt,
        votes: []
      }));
    }

    // Resolve reply parameters
    let replyText = undefined;
    let replySender = undefined;
    if (replyToId) {
      const origMsg = messages[chatId]?.find((m) => m.id === replyToId);
      if (origMsg) {
        replyText = origMsg.content || `[${origMsg.type}]`;
        replySender = origMsg.senderName;
      }
    }

    const newMsg: Message = {
      id: messageId,
      chatId,
      senderId: currentUserId,
      senderName: `${sender.firstName} ${sender.lastName}`,
      senderUsername: sender.username,
      senderPhoto: sender.photoUrl,
      type: type || "text",
      content: content || "",
      mediaUrl,
      fileName,
      fileSize,
      fileType,
      audioDuration,
      locationLat,
      locationLng,
      locationName,
      contactName,
      contactUsername,
      pollQuestion,
      pollOptions: formattedPollOptions,
      timestamp: Date.now(),
      replyToId,
      replyToText: replyText,
      replyToSender: replySender,
      reactions: {},
      ephemeralDuration: ephemeralDuration ? Number(ephemeralDuration) : undefined
    };

    if (!messages[chatId]) messages[chatId] = [];
    messages[chatId].push(newMsg);

    chat.lastMessageText = content || `[${type}]`;
    chat.lastMessageTimestamp = Date.now();
    saveDb();

    // Realtime broadcast to members
    broadcastToChatMembers(chatId, "message", newMsg);

    res.json(newMsg);
  });

  // Edit Message
  app.post("/api/messages/:messageId/edit", authenticateUser, (req, res) => {
    const { messageId } = req.params;
    const { currentUserId, content } = req.body;

    let targetMsg: Message | null = null;
    let targetChatId = "";

    for (const [chatId, list] of Object.entries(messages)) {
      const found = list.find((m) => m.id === messageId);
      if (found) {
        targetMsg = found;
        targetChatId = chatId;
        break;
      }
    }

    if (!targetMsg) {
      res.status(404).json({ error: "Mensagem não encontrada." });
      return;
    }

    if (targetMsg.senderId !== currentUserId) {
      res.status(403).json({ error: "Você só pode editar suas próprias mensagens." });
      return;
    }

    targetMsg.content = content;
    targetMsg.isEdited = true;
    saveDb();

    broadcastToChatMembers(targetChatId, "message-edited", targetMsg);

    res.json(targetMsg);
  });

  // Delete message for everyone
  app.post("/api/messages/:messageId/delete", authenticateUser, (req, res) => {
    const { messageId } = req.params;
    const { currentUserId, deleteForEveryone } = req.body;

    let targetMsg: Message | null = null;
    let targetChatId = "";

    for (const [chatId, list] of Object.entries(messages)) {
      const found = list.find((m) => m.id === messageId);
      if (found) {
        targetMsg = found;
        targetChatId = chatId;
        break;
      }
    }

    if (!targetMsg) {
      res.status(404).json({ error: "Mensagem não encontrada." });
      return;
    }

    const chat = chats[targetChatId];

    if (deleteForEveryone) {
      // Must be sender or chat admin/co-admin/moderator
      const isSender = targetMsg.senderId === currentUserId;
      const isAdmin = chat && (chat.admins.includes(currentUserId) || chat.coAdmins?.includes(currentUserId));
      
      if (!isSender && !isAdmin) {
        res.status(403).json({ error: "Sem permissão para apagar esta mensagem para todos." });
        return;
      }

      // Completely remove from messages list
      const list = messages[targetChatId] || [];
      const idx = list.findIndex((m) => m.id === messageId);
      if (idx !== -1) {
        list.splice(idx, 1);
      }
    } else {
      // Delete for me: remove from messages list as well
      const list = messages[targetChatId] || [];
      const idx = list.findIndex((m) => m.id === messageId);
      if (idx !== -1) {
        list.splice(idx, 1);
      }
    }

    saveDb();

    broadcastToChatMembers(targetChatId, "message-deleted", { messageId, deleteForEveryone });

    res.json({ success: true, messageId });
  });

  // React to Message
  app.post("/api/messages/:messageId/react", authenticateUser, (req, res) => {
    const { messageId } = req.params;
    const { currentUserId, emoji } = req.body;

    let targetMsg: Message | null = null;
    let targetChatId = "";

    for (const [chatId, list] of Object.entries(messages)) {
      const found = list.find((m) => m.id === messageId);
      if (found) {
        targetMsg = found;
        targetChatId = chatId;
        break;
      }
    }

    if (!targetMsg) {
      res.status(404).json({ error: "Mensagem não encontrada." });
      return;
    }

    if (!targetMsg.reactions) targetMsg.reactions = {};

    if (targetMsg.reactions[currentUserId] === emoji) {
      delete targetMsg.reactions[currentUserId]; // toggle off
    } else {
      targetMsg.reactions[currentUserId] = emoji;
    }

    saveDb();

    broadcastToChatMembers(targetChatId, "message-reaction", {
      messageId,
      reactions: targetMsg.reactions
    });

    res.json(targetMsg);
  });

  // Pin / Unpin message
  app.post("/api/messages/:messageId/pin", authenticateUser, (req, res) => {
    const { messageId } = req.params;
    const { currentUserId, pin } = req.body;

    let targetMsg: Message | null = null;
    let targetChatId = "";

    for (const [chatId, list] of Object.entries(messages)) {
      const found = list.find((m) => m.id === messageId);
      if (found) {
        targetMsg = found;
        targetChatId = chatId;
        break;
      }
    }

    if (!targetMsg) {
      res.status(404).json({ error: "Mensagem não encontrada." });
      return;
    }

    const chat = chats[targetChatId];
    if (!chat) {
      res.status(404).json({ error: "Chat não encontrado." });
      return;
    }

    // Permission check
    const isGroup = chat.type === "group" || chat.type === "channel";
    if (isGroup && chat.groupPermissions?.whoCanPinMessages === "admins" && !chat.admins.includes(currentUserId)) {
      res.status(403).json({ error: "Somente administradores podem fixar mensagens." });
      return;
    }

    targetMsg.pinned = !!pin;
    saveDb();

    broadcastToChatMembers(targetChatId, "message-pin", {
      messageId,
      pinned: targetMsg.pinned
    });

    res.json(targetMsg);
  });

  // Vote in Poll
  app.post("/api/messages/poll-vote", authenticateUser, (req, res) => {
    const { currentUserId, messageId, optionId } = req.body;

    let targetMsg: Message | null = null;
    let targetChatId = "";

    for (const [chatId, list] of Object.entries(messages)) {
      const found = list.find((m) => m.id === messageId);
      if (found) {
        targetMsg = found;
        targetChatId = chatId;
        break;
      }
    }

    if (!targetMsg || !targetMsg.pollOptions) {
      res.status(404).json({ error: "Enquete não encontrada." });
      return;
    }

    // Process vote (user can toggle their vote, or select multiple, here we let them toggle single choice)
    targetMsg.pollOptions.forEach((opt) => {
      if (opt.id === optionId) {
        if (opt.votes.includes(currentUserId)) {
          opt.votes = opt.votes.filter((uId) => uId !== currentUserId); // remove vote
        } else {
          opt.votes.push(currentUserId); // add vote
        }
      } else {
        // Option: remove from other options if single select (we allow multiselect by default)
      }
    });

    saveDb();

    broadcastToChatMembers(targetChatId, "poll-vote-update", {
      messageId,
      pollOptions: targetMsg.pollOptions
    });

    res.json(targetMsg);
  });

  // Report message
  app.post("/api/messages/report", authenticateUser, (req, res) => {
    const { currentUserId, messageId, reason } = req.body;

    let targetMsg: Message | null = null;
    for (const [chatId, list] of Object.entries(messages)) {
      const found = list.find((m) => m.id === messageId);
      if (found) {
        targetMsg = found;
        break;
      }
    }

    if (!targetMsg) {
      res.status(404).json({ error: "Mensagem não encontrada." });
      return;
    }

    const report: ReportedMessage = {
      id: crypto.randomUUID(),
      messageId,
      reportedUserId: targetMsg.senderId,
      reportedUsername: targetMsg.senderUsername,
      reporterUserId: currentUserId,
      reason: reason || "Spam / Conteúdo Impróprio",
      content: targetMsg.content,
      timestamp: Date.now(),
      resolved: false
    };

    reports.unshift(report);
    saveDb();

    addAuditLog(currentUserId, "Denúncia de Mensagem", `Denunciou mensagem de @${targetMsg.senderUsername}. Motivo: ${reason}`, req);

    res.json({ success: true, report });
  });

  // --- GROUPS, CHANNELS, COMMUNITIES MANAGEMENT ---

  // Update Group/Channel Permissions
  app.post("/api/groups/:chatId/permissions", authenticateUser, (req, res) => {
    const { chatId } = req.params;
    const { currentUserId, whoCanSend, whoCanChangeInfo, whoCanAddMembers, whoCanPinMessages } = req.body;

    const chat = chats[chatId];
    if (!chat || !chat.admins.includes(currentUserId)) {
      res.status(403).json({ error: "Somente administradores podem alterar as permissões." });
      return;
    }

    chat.groupPermissions = {
      whoCanSend: whoCanSend || chat.groupPermissions?.whoCanSend || "all",
      whoCanChangeInfo: whoCanChangeInfo || chat.groupPermissions?.whoCanChangeInfo || "admins",
      whoCanAddMembers: whoCanAddMembers || chat.groupPermissions?.whoCanAddMembers || "all",
      whoCanPinMessages: whoCanPinMessages || chat.groupPermissions?.whoCanPinMessages || "admins"
    };

    saveDb();

    broadcastToChatMembers(chatId, "group-permissions-updated", chat);

    res.json(chat);
  });

  // Manage Group Roles (Assign Admin, Co-admin, Moderator, Participant)
  app.post("/api/groups/:chatId/assign-role", authenticateUser, (req, res) => {
    const { chatId } = req.params;
    const { currentUserId, targetUserId, role } = req.body; // role = 'admin' | 'coAdmin' | 'moderator' | 'participant'

    const chat = chats[chatId];
    if (!chat || !chat.admins.includes(currentUserId)) {
      res.status(403).json({ error: "Somente o administrador principal pode atribuir funções de destaque." });
      return;
    }

    if (!chat.coAdmins) chat.coAdmins = [];
    if (!chat.moderators) chat.moderators = [];

    // Reset memberships first
    chat.coAdmins = chat.coAdmins.filter((id) => id !== targetUserId);
    chat.moderators = chat.moderators.filter((id) => id !== targetUserId);
    chat.admins = chat.admins.filter((id) => id !== targetUserId);

    if (role === "admin") {
      chat.admins.push(targetUserId);
    } else if (role === "coAdmin") {
      chat.coAdmins.push(targetUserId);
    } else if (role === "moderator") {
      chat.moderators.push(targetUserId);
    }

    saveDb();

    broadcastToChatMembers(chatId, "roles-updated", chat);

    res.json(chat);
  });

  // Communities API
  app.get("/api/communities", authenticateUser, (req, res) => {
    res.json(Object.values(communities));
  });

  app.post("/api/communities/create", authenticateUser, (req, res) => {
    const { currentUserId, name, description, avatarUrl, groupIds } = req.body;
    if (!name) {
      res.status(400).json({ error: "Nome da comunidade é obrigatório." });
      return;
    }

    const id = crypto.randomUUID();
    const newCommunity: Community = {
      id,
      name,
      description: description || "",
      avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/shapes/svg?seed=${name}`,
      creatorId: currentUserId,
      groupIds: groupIds || [],
      announcements: [],
      events: []
    };

    communities[id] = newCommunity;
    saveDb();

    addAuditLog(currentUserId, "Comunidade Criada", `Criou a comunidade "${name}"`, req);

    res.json(newCommunity);
  });

  app.post("/api/communities/:id/events", authenticateUser, (req, res) => {
    const { id } = req.params;
    const { currentUserId, title, description, date, location } = req.body;

    const comm = communities[id];
    if (!comm || comm.creatorId !== currentUserId) {
      res.status(403).json({ error: "Somente o criador pode criar eventos de comunidade." });
      return;
    }

    const event = {
      id: crypto.randomUUID(),
      title,
      description,
      date: Number(date) || Date.now(),
      location,
      creatorId: currentUserId
    };

    comm.events.unshift(event);
    saveDb();

    res.json(comm);
  });

  app.post("/api/communities/:id/announcements", authenticateUser, (req, res) => {
    const { id } = req.params;
    const { currentUserId, announcement } = req.body;

    const comm = communities[id];
    if (!comm || comm.creatorId !== currentUserId) {
      res.status(403).json({ error: "Somente administradores de comunidade podem postar comunicados." });
      return;
    }

    comm.announcements.unshift(announcement);
    saveDb();

    res.json(comm);
  });

  // --- CONTACTS / CONTACT REQUESTS ---

  // Get Contact Requests for current user (pending)
  app.get("/api/contacts/requests", authenticateUser, (req, res) => {
    const { currentUserId } = req.body;
    const list = Object.values(contactRequests).filter(
      (r) => r.receiverId === currentUserId && r.status === "pending"
    );
    res.json(list);
  });

  // Send a Contact Request
  app.post("/api/contacts/requests", authenticateUser, (req, res) => {
    const { currentUserId, email } = req.body;
    if (!email) {
      res.status(400).json({ error: "O e-mail do contato é obrigatório." });
      return;
    }

    const sender = users[currentUserId];
    const target = Object.values(users).find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && !u.isBanned
    );

    if (!target) {
      res.status(404).json({ error: "Nenhum usuário encontrado com este e-mail no ChatLink." });
      return;
    }

    if (target.id === currentUserId) {
      res.status(400).json({ error: "Você não pode enviar uma solicitação de contato para si mesmo." });
      return;
    }

    // Check if there is already a request or they are already connected
    const existing = Object.values(contactRequests).find(
      (r) => (r.senderId === currentUserId && r.receiverId === target.id) ||
             (r.senderId === target.id && r.receiverId === currentUserId)
    );

    if (existing) {
      if (existing.status === "pending") {
        res.status(400).json({ error: "Já existe uma solicitação pendente entre vocês." });
        return;
      } else if (existing.status === "accepted") {
        res.status(400).json({ error: "Você já está conectado com este contato." });
        return;
      }
    }

    const reqId = crypto.randomUUID();
    const newRequest: ContactRequest = {
      id: reqId,
      senderId: currentUserId,
      senderName: `${sender.firstName} ${sender.lastName}`,
      senderUsername: sender.username,
      receiverId: target.id,
      status: "pending",
      createdAt: new Date().toISOString()
    };

    contactRequests[reqId] = newRequest;
    saveDb();

    // Notify target in real-time
    broadcastToUser(target.id, "contact-request", newRequest);

    res.json(newRequest);
  });

  // Accept Contact Request
  app.post("/api/contacts/requests/:id/accept", authenticateUser, (req, res) => {
    const { id } = req.params;
    const { currentUserId } = req.body;

    const request = contactRequests[id];
    if (!request) {
      res.status(404).json({ error: "Solicitação não encontrada." });
      return;
    }

    if (request.receiverId !== currentUserId) {
      res.status(403).json({ error: "Apenas o destinatário pode aceitar a solicitação." });
      return;
    }

    request.status = "accepted";
    saveDb();

    // Establish dynamic direct chat between them
    const senderUser = users[request.senderId];
    const receiverUser = users[currentUserId];

    if (senderUser && receiverUser) {
      // Check if chat already exists
      const existingChat = Object.values(chats).find(
        (c) => c.type === "individual" && c.members.includes(request.senderId) && c.members.includes(currentUserId)
      );

      if (!existingChat) {
        const chatId = crypto.randomUUID();
        const newChat: Chat = {
          id: chatId,
          type: "individual",
          name: `${senderUser.firstName} ${senderUser.lastName}`,
          avatarUrl: senderUser.photoUrl,
          members: [request.senderId, currentUserId],
          admins: [request.senderId, currentUserId],
          lastMessageText: "Solicitação de contato aceita.",
          lastMessageTimestamp: Date.now()
        };

        chats[chatId] = newChat;
        messages[chatId] = [];
        saveDb();

        broadcastToUser(request.senderId, "chat-created", newChat);
        broadcastToUser(currentUserId, "chat-created", newChat);
      }
    }

    broadcastToUser(request.senderId, "contact-request-accepted", request);

    res.json({ success: true, request });
  });

  // Decline Contact Request
  app.post("/api/contacts/requests/:id/decline", authenticateUser, (req, res) => {
    const { id } = req.params;
    const { currentUserId } = req.body;

    const request = contactRequests[id];
    if (!request) {
      res.status(404).json({ error: "Solicitação não encontrada." });
      return;
    }

    if (request.receiverId !== currentUserId) {
      res.status(403).json({ error: "Apenas o destinatário pode recusar a solicitação." });
      return;
    }

    request.status = "declined";
    saveDb();

    broadcastToUser(request.senderId, "contact-request-declined", request);

    res.json({ success: true, request });
  });

  // --- CALLS ENGINE ---

  // Trigger outbound call
  app.post("/api/calls/trigger", authenticateUser, (req, res) => {
    const { currentUserId, receiverId, type } = req.body; // type = 'voice' | 'video'
    const caller = users[currentUserId];
    const receiver = users[receiverId];

    if (!receiver) {
      res.status(404).json({ error: "Destinatário não encontrado." });
      return;
    }

    const callId = crypto.randomUUID();
    const call: Call = {
      id: callId,
      callerId: currentUserId,
      callerName: `${caller.firstName} ${caller.lastName}`,
      callerPhoto: caller.photoUrl,
      receiverId,
      receiverName: `${receiver.firstName} ${receiver.lastName}`,
      receiverPhoto: receiver.photoUrl,
      type: type || "voice",
      status: "ringing",
      timestamp: Date.now()
    };

    calls[callId] = call;
    saveDb();

    // Push ringing alert to target user
    broadcastToUser(receiverId, "incoming-call", call);

    res.json(call);
  });

  // Update Call Status
  app.post("/api/calls/:callId/update", authenticateUser, (req, res) => {
    const { callId } = req.params;
    const { status, duration } = req.body; // status = 'connected' | 'ended' | 'declined' | 'missed'

    const call = calls[callId];
    if (!call) {
      res.status(404).json({ error: "Ligação não encontrada." });
      return;
    }

    call.status = status;
    if (duration) call.duration = Number(duration);
    saveDb();

    // Signal both sides
    broadcastToUser(call.callerId, "call-updated", call);
    broadcastToUser(call.receiverId, "call-updated", call);

    res.json(call);
  });

  // Call history
  app.get("/api/calls/history", authenticateUser, (req, res) => {
    const { currentUserId } = req.body;
    const history = Object.values(calls)
      .filter((c) => c.callerId === currentUserId || c.receiverId === currentUserId)
      .sort((a, b) => b.timestamp - a.timestamp);
    res.json(history);
  });

  // --- FILE UPLOADS ---
  app.post("/api/upload", authenticateUser, (req, res) => {
    const { fileName, fileType, base64Data } = req.body;

    if (!fileName || !base64Data) {
      res.status(400).json({ error: "Nome do arquivo e conteúdo em base64 são necessários." });
      return;
    }

    try {
      // Decode base64
      const buffer = Buffer.from(base64Data, "base64");
      const safeName = `${crypto.randomBytes(8).toString("hex")}-${fileName.replace(/\s+/g, "_")}`;
      const filePath = path.join(UPLOADS_DIR, safeName);

      fs.writeFileSync(filePath, buffer);

      const fileUrl = `/uploads/${safeName}`;
      res.json({
        url: fileUrl,
        fileName: safeName,
        fileSize: buffer.length
      });
    } catch (err: any) {
      res.status(500).json({ error: "Erro ao salvar arquivo.", details: err.message });
    }
  });

  // --- ADMINISTRATOR ENDPOINTS ---

  // Check if current user is admin (using admin emails list or simple logic)
  const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const { currentUserId } = req.body;
    const user = users[currentUserId];
    // Allow prompt developer (e.g. nilson, or userEmail from metadata/headers)
    const isAdminEmail = user && (
      user.email.toLowerCase() === "camargonilson07@gmail.com" || 
      user.username === "nilson" || 
      user.username === "admin"
    );
    if (!isAdminEmail) {
      res.status(403).json({ error: "Acesso negado. Apenas administradores do ChatLink possuem acesso." });
      return;
    }
    next();
  };

  // Admin: Get Dashboard statistics
  app.get("/api/admin/stats", authenticateUser, requireAdmin, (req, res) => {
    const userList = Object.values(users);
    const chatList = Object.values(chats);
    
    // Calculate storage bytes
    let storageUsedBytes = 0;
    try {
      if (fs.existsSync(UPLOADS_DIR)) {
        const files = fs.readdirSync(UPLOADS_DIR);
        files.forEach((f) => {
          const stats = fs.statSync(path.join(UPLOADS_DIR, f));
          storageUsedBytes += stats.size;
        });
      }
    } catch (_) {}

    const stats: SystemStats = {
      totalUsers: userList.length,
      totalMessages: Object.values(messages).reduce((acc, curr) => acc + curr.length, 0),
      totalGroups: chatList.filter((c) => c.type === "group").length,
      totalChannels: chatList.filter((c) => c.type === "channel").length,
      totalCommunities: Object.keys(communities).length,
      storageUsedBytes,
      activeUsers24h: userList.filter((u) => Date.now() - u.lastActive < 24 * 60 * 60 * 1000).length
    };

    res.json({
      stats,
      users: userList.map((u) => ({
        id: u.id,
        email: u.email,
        username: u.username,
        firstName: u.firstName,
        lastName: u.lastName,
        photoUrl: u.photoUrl,
        status: u.status,
        lastActive: u.lastActive,
        createdAt: u.createdAt,
        isBanned: !!u.isBanned
      })),
      reports,
      logs: auditLogs.slice(0, 100) // latest 100 logs
    });
  });

  // Admin: Toggle Ban User
  app.post("/api/admin/ban", authenticateUser, requireAdmin, (req, res) => {
    const { currentUserId, targetUserId, ban } = req.body;
    const user = users[targetUserId];
    if (!user) {
      res.status(404).json({ error: "Usuário não encontrado." });
      return;
    }

    if (targetUserId === currentUserId) {
      res.status(400).json({ error: "Você não pode banir a si mesmo!" });
      return;
    }

    user.isBanned = !!ban;
    saveDb();

    // Terminate active sessions of banned user
    if (ban) {
      Object.keys(activeSessions).forEach((token) => {
        if (activeSessions[token].userId === targetUserId) {
          delete activeSessions[token];
        }
      });
    }

    addAuditLog(currentUserId, "Ação Administrativa", `${ban ? "Baniu" : "Desbaniu"} usuário @${user.username}`, req);

    res.json({ success: true, targetUserId, isBanned: user.isBanned });
  });

  // Admin: Resolve report
  app.post("/api/admin/reports/:reportId/resolve", authenticateUser, requireAdmin, (req, res) => {
    const { reportId } = req.params;
    const rep = reports.find((r) => r.id === reportId);
    if (!rep) {
      res.status(404).json({ error: "Denúncia não encontrada." });
      return;
    }
    rep.resolved = true;
    saveDb();
    res.json(rep);
  });

  // --- SSE REALTIME SYNC ENGINE ---
  app.get("/api/sync", (req, res) => {
    const token = req.query.token as string;
    const session = activeSessions[token];

    if (!token || !session) {
      res.status(401).send("Unauthorized");
      return;
    }

    // Server-Sent Events setup headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    });

    res.write("retry: 10000\n\n");

    const userId = session.userId;
    const connection: SSEConnection = { res, userId };
    sseConnections.push(connection);

    console.log(`SSE connection started for user ${userId}`);

    // Ping interval to keep connection alive
    const interval = setInterval(() => {
      res.write(": keepalive\n\n");
    }, 20000);

    req.on("close", () => {
      clearInterval(interval);
      sseConnections = sseConnections.filter((conn) => conn.res !== res);
      console.log(`SSE connection closed for user ${userId}`);
    });
  });

  // --- VITE INTERFACE HANDLERS ---

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`ChatLink server successfully running on port ${PORT}`);
  });
}

startServer();
