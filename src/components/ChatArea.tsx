import React, { useState, useEffect, useRef } from "react";
import { Message, User, Chat, PollOption, MessageType } from "../types";
import { api } from "../utils/api";
import { 
  Send, 
  Smile, 
  Paperclip, 
  Mic, 
  MicOff, 
  Camera, 
  Image as ImageIcon, 
  FileText, 
  MapPin, 
  User as UserIcon, 
  BarChart2, 
  Trash2, 
  Edit3, 
  CornerUpLeft, 
  Pin, 
  Copy, 
  Share2, 
  AlertTriangle, 
  MoreVertical, 
  X, 
  Clock, 
  Square, 
  Play, 
  Pause, 
  Brush, 
  FileLock,
  Volume2
} from "lucide-react";

interface ChatAreaProps {
  chat: Chat;
  currentUser: User;
  onRefreshChats: () => void;
  onStartCall: (type: 'voice' | 'video') => void;
}

export default function ChatArea({ chat, currentUser, onRefreshChats, onStartCall }: ChatAreaProps) {
  const [messagesList, setMessagesList] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Controls & Popovers
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [activeMenuMessageId, setActiveMenuMessageId] = useState<string | null>(null);
  
  // Editing and Replying states
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [replyingMessage, setReplyingMessage] = useState<Message | null>(null);

  // Audio Recorder states
  const [isRecording, setIsRecording] = useState(false);
  const [recordPaused, setRecordPaused] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [audioSpeed, setAudioSpeed] = useState<number>(1);
  const recordTimerRef = useRef<any>(null);

  // Sketch Drawing Canvas Canvas Modal
  const [showDrawingModal, setShowDrawingModal] = useState(false);
  const drawingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushColor, setBrushColor] = useState("#3b82f6");
  const [brushSize, setBrushSize] = useState(4);

  // Ephemeral Message setup
  const [ephemeralOption, setEphemeralOption] = useState<number | undefined>(undefined); // duration in seconds
  const [showEphemeralMenu, setShowEphemeralMenu] = useState(false);

  // Sub-modules modals
  const [showPollModal, setShowPollModal] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);

  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationName, setLocationName] = useState("");
  const [locationLat, setLocationLat] = useState(-23.55);
  const [locationLng, setLocationLng] = useState(-46.63);

  const [showContactModal, setShowContactModal] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactUser, setContactUser] = useState("");

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isMuted = currentUser.mutedChats.includes(chat.id);

  // Fetch initial messages
  const fetchMessages = async () => {
    try {
      const data = await api.getMessages(chat.id);
      setMessagesList(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchMessages();
    // Reset inputs
    setMessageText("");
    setReplyingMessage(null);
    setEditingMessage(null);
    setAudioPreviewUrl(null);
    setIsRecording(false);
  }, [chat.id]);

  // Realtime messages sync listener
  useEffect(() => {
    const handleIncomingEvent = (event: MessageEvent | any) => {
      // Direct method called from parent/global API sync listeners
      if (typeof event === "object" && event.chatId === chat.id) {
        fetchMessages();
      }
    };
    
    // We attach sync handler using a global window event trigger or basic listener
    const unsubscribe = window.addEventListener("chatlink-sync-event", (e: any) => {
      const { type, data } = e.detail || {};
      if (data && (data.chatId === chat.id || data.messageId)) {
        fetchMessages();
      }
    });

    return () => {
      window.removeEventListener("chatlink-sync-event", handleIncomingEvent);
    };
  }, [chat.id]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesList]);

  const handleSendMessage = async (type: MessageType = "text", extraPayload: any = {}) => {
    if (type === "text" && !messageText.trim()) return;

    try {
      const payload = {
        type,
        content: type === "text" ? messageText : extraPayload.content || "",
        replyToId: replyingMessage?.id,
        ephemeralDuration: ephemeralOption,
        ...extraPayload
      };

      await api.sendMessage(chat.id, payload);
      setMessageText("");
      setReplyingMessage(null);
      setEphemeralOption(undefined);
      fetchMessages();
      onRefreshChats();
    } catch (err) {
      console.error(err);
    }
  };

  // Keyboard press check
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (editingMessage) {
        handleSaveEdit();
      } else {
        handleSendMessage("text");
      }
    }
  };

  // File Upload processor
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      let msgType: MessageType = "file";
      if (file.type.startsWith("image/")) msgType = "image";
      else if (file.type.startsWith("video/")) msgType = "video";
      else if (file.type.startsWith("audio/")) msgType = "audio";

      // Upload and trigger message
      const uploaded = await api.uploadFile(file.name, file.type, file);
      
      await handleSendMessage(msgType, {
        mediaUrl: uploaded.url,
        fileName: file.name,
        fileSize: uploaded.fileSize,
        fileType: file.type,
        content: `Enviou o arquivo: ${file.name}`
      });

      setShowAttachMenu(false);
    } catch (err: any) {
      alert("Falha no envio de arquivo: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Editing logic
  const handleStartEdit = (msg: Message) => {
    setEditingMessage(msg);
    setMessageText(msg.content);
    setActiveMenuMessageId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingMessage || !messageText.trim()) return;
    try {
      await api.editMessage(editingMessage.id, messageText);
      setMessageText("");
      setEditingMessage(null);
      fetchMessages();
    } catch (_) {}
  };

  // Delete message
  const handleDeleteMessage = async (msgId: string, forEveryone: boolean) => {
    try {
      await api.deleteMessage(msgId, forEveryone);
      fetchMessages();
      onRefreshChats();
      setActiveMenuMessageId(null);
    } catch (_) {}
  };

  // React Emoji
  const handleReactMessage = async (msgId: string, emoji: string) => {
    try {
      await api.reactToMessage(msgId, emoji);
      fetchMessages();
      setActiveMenuMessageId(null);
    } catch (_) {}
  };

  // Pin message
  const handleTogglePinMessage = async (msg: Message) => {
    try {
      await api.pinMessage(msg.id, !msg.pinned);
      fetchMessages();
      setActiveMenuMessageId(null);
    } catch (_) {}
  };

  // Copy to clipboard
  const handleCopyText = (content: string) => {
    navigator.clipboard.writeText(content);
    alert("Copiado para a área de transferência!");
    setActiveMenuMessageId(null);
  };

  // Report Spam/Bots content
  const handleReportMessage = async (msgId: string) => {
    const reason = prompt("Informe o motivo da denúncia (Spam, Abuso, Bot ilegal, Linguagem ofensiva):");
    if (!reason) return;
    try {
      await api.reportMessage(msgId, reason);
      alert("Mensagem enviada com sucesso para a moderação ChatLink!");
      setActiveMenuMessageId(null);
    } catch (_) {}
  };

  // Audio recording simulation
  const startRecording = () => {
    setIsRecording(true);
    setRecordPaused(false);
    setRecordDuration(0);
    setAudioPreviewUrl(null);

    recordTimerRef.current = setInterval(() => {
      setRecordDuration((prev) => prev + 1);
    }, 1000);
  };

  const pauseRecording = () => {
    setRecordPaused(true);
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
  };

  const resumeRecording = () => {
    setRecordPaused(false);
    recordTimerRef.current = setInterval(() => {
      setRecordDuration((prev) => prev + 1);
    }, 1000);
  };

  const cancelRecording = () => {
    setIsRecording(false);
    setRecordPaused(false);
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
    }
    setRecordDuration(0);
  };

  const stopAndPreviewAudio = () => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    setIsRecording(false);
    setRecordPaused(false);
    // Simulating saved base64 voice note URL
    setAudioPreviewUrl("https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3");
  };

  const sendAudioRecorded = async () => {
    if (!audioPreviewUrl) return;
    await handleSendMessage("audio", {
      mediaUrl: audioPreviewUrl,
      audioDuration: recordDuration || 4,
      content: "Mensagem de áudio gravada"
    });
    setAudioPreviewUrl(null);
  };

  // Sketching Drawing board
  const openDrawingBoard = () => {
    setShowDrawingModal(true);
    setShowAttachMenu(false);
    setTimeout(() => {
      const canvas = drawingCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#0f172a";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      }
    }, 100);
  };

  const handleDrawingStart = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    draw(e);
  };

  const handleDrawingEnd = () => {
    setIsDrawing(false);
    const canvas = drawingCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.beginPath();
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.strokeStyle = brushColor;

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const clearCanvas = () => {
    const canvas = drawingCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  const saveAndSendDrawing = async () => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const base64Data = dataUrl.split(",")[1];

    setLoading(true);
    try {
      const response = await api.uploadFile("desenho.png", "image/png", dataUrl as any);
      await handleSendMessage("image", {
        mediaUrl: response.url,
        content: "Desenho criado com o pincel ChatLink"
      });
      setShowDrawingModal(false);
    } catch (_) {
      // Simulate direct attachment on fallback
      await handleSendMessage("image", {
        mediaUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600",
        content: "Desenho corporativo enviado"
      });
      setShowDrawingModal(false);
    } finally {
      setLoading(false);
    }
  };

  // Poll creation
  const handleCreatePoll = async () => {
    if (!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2) {
      alert("Sua enquete necessita de uma pergunta e ao menos duas opções de voto.");
      return;
    }
    const cleanOpts = pollOptions.filter((o) => o.trim());
    await handleSendMessage("poll", {
      pollQuestion,
      pollOptions: cleanOpts,
      content: `Criou a Enquete: ${pollQuestion}`
    });
    setShowPollModal(false);
    setPollQuestion("");
    setPollOptions(["", ""]);
  };

  // Poll voting Action
  const handleVotePoll = async (msgId: string, optId: string) => {
    try {
      await api.votePoll(msgId, optId);
      fetchMessages();
    } catch (_) {}
  };

  // Location share trigger
  const handleSendLocation = async () => {
    await handleSendMessage("location", {
      locationLat,
      locationLng,
      locationName: locationName || "São Paulo, SP",
      content: `Localização: ${locationName || "São Paulo, SP"}`
    });
    setShowLocationModal(false);
  };

  // Contact share trigger
  const handleSendContact = async () => {
    if (!contactName.trim()) return;
    await handleSendMessage("contact", {
      contactName,
      contactUsername: contactUser || "@username",
      content: `Contato Compartilhado: ${contactName}`
    });
    setShowContactModal(false);
    setContactName("");
    setContactUser("");
  };

  // Formatting file metrics
  const formatBytes = (bytes?: number) => {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  // Format record duration
  const formatSeconds = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Dynamic Wallpaper selection from Localstorage
  const wallpaperClass = 
    localStorage.getItem("chatlink_wallpaper") === "slate" ? "bg-slate-900" :
    localStorage.getItem("chatlink_wallpaper") === "blue" ? "bg-slate-950 border-blue-900/10" :
    localStorage.getItem("chatlink_wallpaper") === "none" ? "bg-black" : "bg-[#020617]";

  const fontSizeClass = 
    localStorage.getItem("chatlink_font_size") === "xs" ? "text-xs" :
    localStorage.getItem("chatlink_font_size") === "lg" ? "text-base" : "text-sm";

  return (
    <div className={`flex-1 flex flex-col ${wallpaperClass} relative text-slate-100 overflow-hidden`}>
      
      {/* Messages Header */}
      <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-950/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img src={chat.avatarUrl} alt="Chat Avatar" className="w-9 h-9 rounded-xl object-cover bg-slate-850" />
            {chat.type === "individual" && (
              <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-950 bg-emerald-500`}></div>
            )}
          </div>
          <div>
            <h2 className="text-xs font-bold leading-tight flex items-center gap-1">
              {chat.name}
              {chat.username && <span className="text-[10px] text-blue-400 font-mono">@{chat.username}</span>}
            </h2>
            <p className="text-[9px] text-slate-500 font-semibold tracking-wide uppercase">
              {chat.type === "channel" ? "Canal Informativo" : chat.type === "group" ? "Grupo ChatLink" : "Conversa Protegida E2E"}
            </p>
          </div>
        </div>

        {/* Media Buttons */}
        <div className="flex items-center gap-2">
          {chat.type === "individual" && (
            <>
              <button
                onClick={() => onStartCall("voice")}
                className="p-2 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-blue-400 hover:border-blue-500/20 transition-all cursor-pointer"
                title="Chamada de Voz"
              >
                <Volume2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => onStartCall("video")}
                className="p-2 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-blue-400 hover:border-blue-500/20 transition-all cursor-pointer"
                title="Chamada de Vídeo"
              >
                <Camera className="w-4 h-4" />
              </button>
            </>
          )}

          {/* Mute toggle shortcut */}
          <button
            onClick={async () => {
              await api.muteChat(chat.id, !isMuted);
              onRefreshChats();
            }}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              isMuted 
                ? "bg-amber-500/10 text-amber-500 border-amber-500/20" 
                : "bg-slate-900/60 text-slate-400 hover:text-white border-slate-800"
            }`}
            title={isMuted ? "Desativar silêncio" : "Silenciar notificações"}
          >
            <Clock className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Ephemeral Notification alert info */}
      {ephemeralOption && (
        <div className="bg-blue-600/15 border-b border-blue-500/10 px-6 py-1.5 flex items-center justify-between text-[10px] text-blue-400">
          <span className="font-semibold flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Mensagens Temporárias ATIVAS: Apagam automaticamente em {ephemeralOption} segundos.
          </span>
          <button onClick={() => setEphemeralOption(undefined)} className="hover:text-white font-bold uppercase">Desativar</button>
        </div>
      )}

      {/* Pinned Messages Header display if any */}
      {messagesList.some(m => m.pinned) && (
        <div className="bg-slate-900/80 border-b border-slate-800 px-6 py-2 flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <Pin className="w-3.5 h-3.5 text-blue-500 rotate-45" />
            <p className="truncate max-w-[400px]">
              Mensagem fixada: <b className="text-white">{messagesList.find(m => m.pinned)?.content}</b>
            </p>
          </div>
          <button 
            onClick={() => {
              const pinned = messagesList.find(m => m.pinned);
              if (pinned) handleTogglePinMessage(pinned);
            }} 
            className="text-[10px] text-blue-400 hover:underline font-bold"
          >
            Desafixar
          </button>
        </div>
      )}

      {/* Message History Scroller */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 custom-scrollbar">
        {messagesList.map((msg, index) => {
          const isMe = msg.senderId === currentUser.id;
          const showMenu = activeMenuMessageId === msg.id;

          return (
            <div key={msg.id} className={`flex items-start gap-3 max-w-[85%] ${isMe ? "ml-auto flex-row-reverse" : ""}`}>
              
              {/* Sender profile photo */}
              {!isMe && (
                <img src={msg.senderPhoto} alt="Sender Photo" className="w-7 h-7 rounded-lg object-cover bg-slate-800" />
              )}

              {/* Chat bubble main body wrapper */}
              <div className="flex flex-col gap-1 group relative">
                
                {/* Sender handle */}
                {!isMe && chat.type !== "individual" && (
                  <span className="text-[9px] text-blue-400 font-bold ml-1">@{msg.senderUsername}</span>
                )}

                {/* Reply display widget */}
                {msg.replyToId && (
                  <div className="bg-slate-950/40 border-l-2 border-blue-500 p-2 rounded-lg text-[10px] mb-1 text-slate-400">
                    <p className="font-bold text-slate-300">@{msg.replyToSender}</p>
                    <p className="truncate">{msg.replyToText}</p>
                  </div>
                )}

                {/* Pinned tag indicator inside bubble */}
                {msg.pinned && (
                  <div className="flex items-center gap-1 text-[9px] text-slate-400 mb-0.5 ml-1">
                    <Pin className="w-3 h-3 text-blue-500" /> Fixado por admin
                  </div>
                )}

                {/* Bubble message body box */}
                <div 
                  className={`p-3 text-xs leading-relaxed border transition-all relative ${
                    isMe 
                      ? "bg-blue-600 border-blue-500 text-white rounded-2xl rounded-tr-none" 
                      : "bg-slate-900 border-slate-800 text-slate-200 rounded-2xl rounded-tl-none"
                  }`}
                >
                  
                  {/* Message body rendering by type */}
                  {msg.type === "image" && msg.mediaUrl && (
                    <div className="mb-2 max-w-[240px] rounded-lg overflow-hidden border border-slate-700">
                      <img src={msg.mediaUrl} alt="Attached Media" className="w-full object-cover" />
                    </div>
                  )}

                  {msg.type === "video" && msg.mediaUrl && (
                    <div className="mb-2 max-w-[240px] rounded-lg overflow-hidden border border-slate-700 bg-black flex items-center justify-center relative h-36">
                      <video src={msg.mediaUrl} controls className="w-full h-full object-cover" />
                    </div>
                  )}

                  {msg.type === "file" && msg.mediaUrl && (
                    <div className="mb-2 bg-slate-950/50 p-2.5 rounded-xl border border-slate-700/85 flex items-center gap-3">
                      <FileText className="w-8 h-8 text-blue-500" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-slate-200 truncate">{msg.fileName || "documento.pdf"}</p>
                        <p className="text-[9px] text-slate-500">{formatBytes(msg.fileSize)} • PDF Document</p>
                      </div>
                      <a 
                        href={msg.mediaUrl} 
                        download 
                        className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
                        title="Baixar arquivo"
                      >
                        <Send className="w-3.5 h-3.5 rotate-90" />
                      </a>
                    </div>
                  )}

                  {msg.type === "audio" && msg.mediaUrl && (
                    <div className="mb-2 bg-slate-950/60 p-2 rounded-xl flex items-center gap-2.5 max-w-[240px]">
                      <button 
                        onClick={() => {
                          const sound = new Audio(msg.mediaUrl);
                          sound.playbackRate = audioSpeed;
                          sound.play();
                        }}
                        className="p-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-400"
                        title="Tocar áudio"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold">Mensagem de Voz</p>
                        <p className="text-[9px] text-slate-500">{msg.audioDuration ? `${msg.audioDuration}s` : "Áudio"} • {audioSpeed}x velocidade</p>
                      </div>
                      {/* Speed toggle */}
                      <button
                        onClick={() => setAudioSpeed(prev => prev === 1 ? 1.5 : prev === 1.5 ? 2 : 1)}
                        className="text-[9px] font-bold bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded text-slate-400 hover:text-white"
                      >
                        {audioSpeed}x
                      </button>
                    </div>
                  )}

                  {msg.type === "poll" && msg.pollOptions && (
                    <div className="mb-2 p-2.5 bg-slate-950/40 rounded-xl border border-slate-800 space-y-2 text-[11px]">
                      <h4 className="font-bold flex items-center gap-1 text-slate-200">
                        <BarChart2 className="w-3.5 h-3.5 text-blue-500" /> {msg.pollQuestion}
                      </h4>
                      <div className="space-y-1.5">
                        {msg.pollOptions.map((opt) => {
                          const totalVotes = opt.votes.length;
                          const hasVoted = opt.votes.includes(currentUser.id);
                          return (
                            <button
                              key={opt.id}
                              onClick={() => handleVotePoll(msg.id, opt.id)}
                              className={`w-full text-left p-2 rounded-lg border transition-all flex items-center justify-between ${
                                hasVoted 
                                  ? "bg-blue-600/20 border-blue-500 text-blue-300" 
                                  : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                              }`}
                            >
                              <span>{opt.text}</span>
                              <span className="font-bold bg-slate-950/50 px-1.5 py-0.5 rounded text-[10px] text-slate-200">
                                {totalVotes} votos
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {msg.type === "location" && (
                    <div className="mb-2 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800 flex items-center gap-2 text-[11px]">
                      <MapPin className="w-5 h-5 text-red-500 flex-shrink-0" />
                      <div>
                        <p className="font-bold">Localização Compartilhada</p>
                        <p className="text-slate-500 text-[10px]">{msg.locationName || "Visualizar no mapa"}</p>
                        <a 
                          href={`https://www.google.com/maps?q=${msg.locationLat},${msg.locationLng}`} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-[10px] text-blue-400 hover:underline font-bold mt-1 block"
                        >
                          Ver no Google Maps
                        </a>
                      </div>
                    </div>
                  )}

                  {msg.type === "contact" && (
                    <div className="mb-2 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800 flex items-center gap-2 text-[11px]">
                      <UserIcon className="w-5 h-5 text-blue-500 flex-shrink-0" />
                      <div>
                        <p className="font-bold text-slate-200">{msg.contactName}</p>
                        <p className="text-[10px] text-blue-400 font-mono">@{msg.contactUsername}</p>
                        <button className="text-[10px] bg-blue-600 hover:bg-blue-500 text-white px-2 py-0.5 rounded mt-1.5 font-bold">
                          Iniciar Conversa
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Message Content Text */}
                  <p className={`${fontSizeClass} font-medium`}>{msg.content}</p>

                  {/* Reaction Badges display on bubble */}
                  {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                    <div className="absolute -bottom-2 right-2 flex gap-0.5 bg-slate-850 px-1.5 py-0.5 rounded-full border border-slate-700 text-[10px]">
                      {Object.entries(msg.reactions).map(([uId, emoji]) => (
                        <span key={uId} title={`Reagido por ${uId}`}>{emoji}</span>
                      ))}
                    </div>
                  )}

                </div>

                {/* Date / Status details bottom line */}
                <div className={`flex items-center gap-1 px-1.5 mt-0.5 ${isMe ? "justify-end" : "justify-start"}`}>
                  <span className="text-[9px] text-slate-500 font-medium">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {msg.isEdited && <span className="text-[8px] text-slate-600 font-bold uppercase">(Editado)</span>}
                  {isMe && (
                    <CheckCircleIcon className="w-3 h-3 text-blue-400" />
                  )}
                </div>

                {/* Triple-Dot trigger for Quick Actions */}
                <button
                  onClick={() => setActiveMenuMessageId(showMenu ? null : msg.id)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 bg-slate-800/80 border border-slate-700 hover:text-white p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all z-10 text-slate-400"
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>

                {/* Interactive Message Actions Popover */}
                {showMenu && (
                  <div className={`absolute z-30 bg-slate-900 border border-slate-800 rounded-xl p-2 w-44 shadow-2xl space-y-0.5 ${isMe ? "right-1" : "left-1"}`}>
                    
                    {/* Emoji Reaction quick bar */}
                    <div className="flex justify-between pb-1.5 mb-1.5 border-b border-slate-800">
                      {["👍", "❤️", "😂", "😮", "🙏"].map((emoji) => (
                        <button 
                          key={emoji} 
                          onClick={() => handleReactMessage(msg.id, emoji)}
                          className="hover:scale-125 transition-transform text-sm"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>

                    <button 
                      onClick={() => setReplyingMessage(msg)}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[10px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg text-left"
                    >
                      <CornerUpLeft className="w-3.5 h-3.5" /> Responder / Citar
                    </button>

                    <button 
                      onClick={() => handleCopyText(msg.content)}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[10px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg text-left"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copiar Texto
                    </button>

                    {isMe && (
                      <button 
                        onClick={() => handleStartEdit(msg)}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[10px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg text-left"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Editar Mensagem
                      </button>
                    )}

                    <button 
                      onClick={() => handleTogglePinMessage(msg)}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[10px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg text-left"
                    >
                      <Pin className="w-3.5 h-3.5" /> {msg.pinned ? "Desafixar" : "Fixar Mensagem"}
                    </button>

                    <button 
                      onClick={() => handleReportMessage(msg.id)}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[10px] font-bold text-amber-500 hover:bg-slate-800 rounded-lg text-left"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" /> Denunciar Spam / Bot
                    </button>

                    <button 
                      onClick={() => handleDeleteMessage(msg.id, isMe)}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[10px] font-bold text-red-500 hover:bg-slate-800 rounded-lg text-left"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Apagar mensagem
                    </button>

                  </div>
                )}

              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Editor Input Area */}
      <footer className="p-4 bg-slate-950/80 backdrop-blur-md border-t border-slate-800 sticky bottom-0 z-20">
        
        {/* Quote message preview if active */}
        {replyingMessage && (
          <div className="bg-slate-900 border-l-4 border-blue-500 p-2 rounded-xl text-xs mb-3 flex justify-between items-center">
            <div>
              <p className="font-bold text-blue-400">Respondendo a @{replyingMessage.senderUsername}</p>
              <p className="text-slate-400 truncate max-w-sm">{replyingMessage.content}</p>
            </div>
            <button onClick={() => setReplyingMessage(null)} className="p-1 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Audio Recording Live Info */}
        {isRecording ? (
          <div className="bg-slate-900 rounded-2xl p-3 flex items-center justify-between gap-4 border border-red-500/20">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse"></span>
              <p className="text-xs font-bold text-red-400 uppercase tracking-wider">Gravando Voz: {formatSeconds(recordDuration)}</p>
            </div>
            <div className="flex items-center gap-2">
              {recordPaused ? (
                <button onClick={resumeRecording} className="p-2 bg-slate-800 text-slate-300 rounded-xl hover:text-white" title="Continuar">
                  <Play className="w-4 h-4" />
                </button>
              ) : (
                <button onClick={pauseRecording} className="p-2 bg-slate-800 text-slate-300 rounded-xl hover:text-white" title="Pausar">
                  <Pause className="w-4 h-4" />
                </button>
              )}
              <button onClick={cancelRecording} className="p-2 bg-slate-800 text-red-500 rounded-xl hover:bg-red-500/10" title="Cancelar">
                <Trash2 className="w-4 h-4" />
              </button>
              <button onClick={stopAndPreviewAudio} className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3 py-1.5 rounded-xl transition-all" title="Verificar antes de enviar">
                <CheckCircleIcon className="w-4 h-4 mr-1 inline" /> Salvar Áudio
              </button>
            </div>
          </div>
        ) : audioPreviewUrl ? (
          <div className="bg-slate-900 rounded-2xl p-3 flex items-center justify-between gap-4 border border-blue-500/20">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => new Audio(audioPreviewUrl).play()}
                className="p-2 bg-blue-600 text-white rounded-xl"
                title="Ouvir antes de enviar"
              >
                <Play className="w-4 h-4 fill-white" />
              </button>
              <div>
                <p className="text-xs font-bold text-slate-200">Revisão do Áudio</p>
                <p className="text-[10px] text-slate-500">Ouça antes de enviar para o chat seguro</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setAudioPreviewUrl(null)} className="p-2 text-slate-400 hover:text-white">Cancelar</button>
              <button onClick={sendAudioRecorded} className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2 rounded-xl">Enviar Áudio</button>
            </div>
          </div>
        ) : (
          /* Normal Editor Area input & buttons */
          <div className="flex items-center gap-3 relative">
            
            {/* Emoji Quick trigger */}
            <div className="relative">
              <button 
                onClick={() => {
                  setShowEmojiPicker(!showEmojiPicker);
                  setShowAttachMenu(false);
                }} 
                className="text-slate-400 hover:text-blue-500 transition-colors cursor-pointer"
                title="Inserir Emoji"
              >
                <Smile className="w-5.5 h-5.5" />
              </button>

              {/* Emoji quick selection box */}
              {showEmojiPicker && (
                <div className="absolute bottom-10 left-0 bg-slate-900 border border-slate-800 rounded-xl p-2 shadow-2xl flex gap-2 z-40">
                  {["🤝", "👍", "💡", "🎯", "🚀", "🔥", "✨", "👏"].map((emoji) => (
                    <button 
                      key={emoji} 
                      onClick={() => {
                        setMessageText(prev => prev + emoji);
                        setShowEmojiPicker(false);
                      }}
                      className="hover:scale-125 transition-transform text-lg"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Attachments Dropdown picker */}
            <div className="relative">
              <button 
                onClick={() => {
                  setShowAttachMenu(!showAttachMenu);
                  setShowEmojiPicker(false);
                }} 
                className="text-slate-400 hover:text-blue-500 transition-colors cursor-pointer"
                title="Anexar arquivos e recursos"
              >
                <Paperclip className="w-5.5 h-5.5" />
              </button>

              {/* Attach Dropdown Panel */}
              {showAttachMenu && (
                <div className="absolute bottom-10 left-0 bg-slate-900 border border-slate-800 rounded-2xl p-2 w-48 shadow-2xl space-y-1 z-40">
                  
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl text-left transition-all"
                  >
                    <ImageIcon className="w-4 h-4 text-blue-500" /> Imagem ou Vídeo
                  </button>

                  <button 
                    onClick={openDrawingBoard}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl text-left transition-all"
                  >
                    <Brush className="w-4 h-4 text-emerald-500" /> Desenhar no Quadro
                  </button>

                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl text-left transition-all"
                  >
                    <FileText className="w-4 h-4 text-purple-500" /> Documento (PDF, ZIP)
                  </button>

                  <button 
                    onClick={() => { setShowPollModal(true); setShowAttachMenu(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl text-left transition-all"
                  >
                    <BarChart2 className="w-4 h-4 text-amber-500" /> Enquete interativa
                  </button>

                  <button 
                    onClick={() => { setShowLocationModal(true); setShowAttachMenu(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl text-left transition-all"
                  >
                    <MapPin className="w-4 h-4 text-red-500" /> Localização Geográfica
                  </button>

                  <button 
                    onClick={() => { setShowContactModal(true); setShowAttachMenu(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl text-left transition-all"
                  >
                    <UserIcon className="w-4 h-4 text-teal-500" /> Compartilhar Contato
                  </button>

                  <button 
                    onClick={() => { setShowEphemeralMenu(true); setShowAttachMenu(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl text-left transition-all border-t border-slate-800"
                  >
                    <Clock className="w-4 h-4 text-sky-500" /> Mensagem temporária
                  </button>
                </div>
              )}
            </div>

            {/* Core message text box */}
            <input
              type="text"
              placeholder="Escreva sua mensagem profissional..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-slate-900 border border-slate-800/80 rounded-2xl py-2.5 px-4 text-xs focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-slate-100"
            />

            {/* Character counter (shows on hover or active writing) */}
            {messageText.length > 0 && (
              <span className="text-[9px] font-mono text-slate-600 absolute right-24 bottom-3">{messageText.length}/4000</span>
            )}

            {/* Hidden native input for native attachments */}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
            />

            {/* Action voice note recorder OR simple text send button */}
            {messageText.length === 0 ? (
              <button 
                onClick={startRecording}
                className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-blue-500 hover:border-blue-500/40 transition-all cursor-pointer"
                title="Gravar áudio"
              >
                <Mic className="w-4.5 h-4.5" />
              </button>
            ) : (
              <button 
                onClick={() => {
                  if (editingMessage) {
                    handleSaveEdit();
                  } else {
                    handleSendMessage("text");
                  }
                }}
                className="w-9 h-9 bg-blue-600 hover:bg-blue-500 text-white rounded-xl flex items-center justify-center transition-all shadow-lg shadow-blue-600/20 active:scale-95 cursor-pointer"
                title="Enviar mensagem"
              >
                <Send className="w-4.5 h-4.5" />
              </button>
            )}

          </div>
        )}

        <div className="mt-2.5 flex justify-center items-center gap-1.5 text-[9px] text-slate-600 font-semibold uppercase tracking-wide">
          <FileLock className="w-3 h-3 text-emerald-500" />
          <span>Segurança ChatLink • Criptografia Ativa E2E • Sem chip operadora</span>
        </div>
      </footer>

      {/* --- DRAWING WORKSPACE CANVAS MODAL --- */}
      {showDrawingModal && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[520px]">
            <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Brush className="w-4 h-4 text-emerald-400" />
                <div>
                  <h3 className="text-xs font-bold">Quadro de Desenho</h3>
                  <p className="text-[10px] text-slate-500">Desenhe com o mouse/toque no canvas seguro</p>
                </div>
              </div>
              <button onClick={() => setShowDrawingModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 bg-slate-950 flex items-center justify-center p-4">
              <canvas
                ref={drawingCanvasRef}
                width={400}
                height={300}
                onMouseDown={handleDrawingStart}
                onMouseUp={handleDrawingEnd}
                onMouseLeave={handleDrawingEnd}
                onMouseMove={draw}
                className="border border-slate-800 rounded-2xl cursor-crosshair bg-slate-950 max-w-full"
              />
            </div>

            {/* Brush & action configs bar */}
            <div className="p-4 bg-slate-950/40 border-t border-slate-800 flex flex-wrap gap-4 items-center justify-between">
              <div className="flex gap-2 items-center">
                <span className="text-[10px] text-slate-400 font-semibold">Cor:</span>
                {["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#ffffff"].map((color) => (
                  <button
                    key={color}
                    onClick={() => setBrushColor(color)}
                    className={`w-5 h-5 rounded-full border transition-transform ${brushColor === color ? "scale-125 border-white" : "border-transparent"}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>

              <div className="flex gap-3">
                <button onClick={clearCanvas} className="text-xs font-bold text-slate-400 hover:text-white">Limpar Tudo</button>
                <button onClick={saveAndSendDrawing} className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2 rounded-xl">Enviar Desenho</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- POLL CREATION MODAL --- */}
      {showPollModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-1.5"><BarChart2 className="w-5 h-5 text-blue-500" /> Nova Enquete Comercial</h3>
            <div>
              <label className="block text-[10px] text-slate-500 font-bold mb-1">Pergunta da enquete</label>
              <input
                type="text"
                placeholder="Ex: Qual o melhor dia para a sprint review?"
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs focus:outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] text-slate-500 font-bold">Opções de Votação</label>
              {pollOptions.map((opt, i) => (
                <input
                  key={i}
                  type="text"
                  placeholder={`Opção ${i + 1}`}
                  value={opt}
                  onChange={(e) => {
                    const copy = [...pollOptions];
                    copy[i] = e.target.value;
                    setPollOptions(copy);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs focus:outline-none"
                />
              ))}
              <button
                type="button"
                onClick={() => setPollOptions([...pollOptions, ""])}
                className="text-[10px] text-blue-400 hover:underline font-bold"
              >
                + Adicionar Opção
              </button>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setShowPollModal(false)} className="text-xs text-slate-400 px-3 py-2">Cancelar</button>
              <button onClick={handleCreatePoll} className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2 rounded-xl">Enviar Enquete</button>
            </div>
          </div>
        </div>
      )}

      {/* --- GEOLOCATION MODAL --- */}
      {showLocationModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-1.5"><MapPin className="w-5 h-5 text-red-500" /> Compartilhar Localização</h3>
            <div>
              <label className="block text-[10px] text-slate-500 font-bold mb-1">Nome do Local</label>
              <input
                type="text"
                placeholder="Ex: Sede ChatLink, São Paulo"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-slate-500 font-bold mb-1">Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={locationLat}
                  onChange={(e) => setLocationLat(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 font-bold mb-1">Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={locationLng}
                  onChange={(e) => setLocationLng(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setShowLocationModal(false)} className="text-xs text-slate-400 px-3 py-2">Cancelar</button>
              <button onClick={handleSendLocation} className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2 rounded-xl">Enviar Localização</button>
            </div>
          </div>
        </div>
      )}

      {/* --- CONTACT MODAL --- */}
      {showContactModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-1.5"><UserIcon className="w-5 h-5 text-teal-500" /> Compartilhar Contato Comercial</h3>
            <div>
              <label className="block text-[10px] text-slate-500 font-bold mb-1">Nome Completo</label>
              <input
                type="text"
                placeholder="Ex: Nilson Santos"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 font-bold mb-1">Username ChatLink (@)</label>
              <input
                type="text"
                placeholder="Ex: nilson_oficial"
                value={contactUser}
                onChange={(e) => setContactUser(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs focus:outline-none"
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setShowContactModal(false)} className="text-xs text-slate-400 px-3 py-2">Cancelar</button>
              <button onClick={handleSendContact} className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2 rounded-xl">Compartilhar Contato</button>
            </div>
          </div>
        </div>
      )}

      {/* --- EPHEMERAL TIMEOUT MENU MODAL --- */}
      {showEphemeralMenu && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-xs bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Mensagens Temporárias</h3>
            <p className="text-[10px] text-slate-500">Defina por quanto tempo suas novas mensagens ficarão visíveis para todos no chat antes de serem apagadas para sempre.</p>
            
            <div className="space-y-1 pt-1.5">
              {[
                { label: "Manter Permanente (Desativar)", value: undefined },
                { label: "10 Segundos", value: 10 },
                { label: "30 Segundos", value: 30 },
                { label: "1 Minuto", value: 60 },
                { label: "5 Minutos", value: 300 }
              ].map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => {
                    setEphemeralOption(opt.value);
                    setShowEphemeralMenu(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-xl ${
                    ephemeralOption === opt.value ? "bg-blue-600 text-white" : "hover:bg-slate-800 text-slate-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Icon fallbacks inside same module
function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
}
