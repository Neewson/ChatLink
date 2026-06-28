export type UserStatus = "online" | "busy" | "dnd" | "offline";
export const UserStatus = {
  ONLINE: "online" as const,
  BUSY: "busy" as const,
  DND: "dnd" as const,
  INVISIBLE: "offline" as const
};

export interface PrivacySettings {
  whoSeesPhoto: "everyone" | "contacts" | "nobody";
  whoSeesStatus: "everyone" | "contacts" | "nobody";
  whoSeesLastActive: "everyone" | "contacts" | "nobody";
  whoSeesBio: "everyone" | "contacts" | "nobody";
  whoCanMessage: "everyone" | "contacts";
  whoCanCall: "everyone" | "contacts";
  whoCanAddGroup: "everyone" | "contacts";
  whoFindsByUsername: "everyone" | "contacts";
}

export interface User {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  bio: string;
  dateOfBirth?: string;
  photoUrl: string;
  coverUrl?: string;
  city?: string;
  country?: string;
  language?: string;
  status: UserStatus;
  isAdmin?: boolean;
  isBanned?: boolean;
  twoFactorEnabled?: boolean;
  twoFactorSecret?: string;
  mutedChats: string[];
  blockedUsers?: string[];
  mutedUsers?: string[];
  privacySettings: PrivacySettings;
  createdAt?: number | string;
  lastActive?: number;
}

export interface UserSession {
  id: string;
  device: string;
  ip: string;
  lastActive: string;
  isCurrent: boolean;
}

export interface Chat {
  id: string;
  name: string;
  username?: string;
  type: "individual" | "group" | "channel" | "community";
  avatarUrl: string;
  description?: string;
  unreadCount?: number;
  lastMessage?: string;
  lastMessageTime?: string;
  
  // Optional database properties
  members?: string[];
  admins?: string[];
  coAdmins?: string[];
  moderators?: string[];
  inviteCode?: string;
  lastMessageText?: string;
  lastMessageTimestamp?: any;
  channelCommentsEnabled?: boolean;
  groupPermissions?: {
    whoCanSend: string;
    whoCanChangeInfo: string;
    whoCanAddMembers: string;
    whoCanPinMessages: string;
  };
}

export type MessageType = "text" | "image" | "video" | "file" | "audio" | "poll" | "location" | "contact";

export interface PollOption {
  id: string;
  text: string;
  votes: string[]; // List of user IDs who voted
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderUsername: string;
  senderPhoto: string;
  type: MessageType;
  content: string;
  timestamp: any;
  reactions?: Record<string, string>; // userId -> emoji
  isEdited?: boolean;
  isDeleted?: boolean;
  isDeletedForEveryone?: boolean;
  replyToId?: string;
  replyToSender?: string;
  replyToText?: string;
  pinned?: boolean;
  ephemeralDuration?: number;
  
  // Media fields
  mediaUrl?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  audioDuration?: number;

  // Poll fields
  pollQuestion?: string;
  pollOptions?: PollOption[];

  // Geolocation fields
  locationLat?: number;
  locationLng?: number;
  locationName?: string;

  // Contact fields
  contactName?: string;
  contactUsername?: string;
}

export interface Community {
  id: string;
  name: string;
  description: string;
  avatarUrl: string;
  creatorId: string;
  groupIds: string[];
  announcements: any[];
  events: any[];
}

export interface Call {
  id: string;
  callerId: string;
  callerName: string;
  callerPhoto: string;
  receiverId: string;
  receiverName: string;
  receiverPhoto: string;
  type: "voice" | "video";
  status: "ringing" | "connected" | "declined" | "ended" | "missed";
  durationSeconds?: number;
  duration?: number;
  timestamp: any;
}

export interface ContactRequest {
  id: string;
  senderId: string;
  senderName: string;
  senderUsername: string;
  receiverId: string;
  status: "pending" | "accepted" | "declined";
  createdAt: string;
}

export interface CreateChatPayload {
  type: "individual" | "group" | "channel" | "community";
  name?: string;
  targetUsername?: string;
  description?: string;
  avatarUrl?: string;
}

export interface SystemStats {
  totalUsers: number;
  activeUsers24h: number;
  totalMessages: number;
  totalGroups: number;
  totalChannels: number;
  totalCommunities: number;
  storageUsedBytes: number;
}

export interface ReportedMessage {
  id: string;
  messageId: string;
  content: string;
  reportedUserId: string;
  reportedUsername: string;
  reporterUserId?: string;
  reason: string;
  resolved: boolean;
  timestamp: any;
}

export interface AuditLog {
  id: string;
  action: string;
  userId?: string;
  username: string;
  details: string;
  timestamp: any;
  ip: string;
  device: string;
}
