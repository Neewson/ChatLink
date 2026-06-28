import React, { useState, useEffect } from "react";
import { Call, User } from "../types";
import { Phone, PhoneOff, Video, Mic, MicOff, VideoOff, Volume2, VolumeX, Monitor, MonitorOff } from "lucide-react";
import { api } from "../utils/api";

interface CallModalProps {
  call: Call;
  currentUser: User;
  onClose: () => void;
}

export default function CallModal({ call, currentUser, onClose }: CallModalProps) {
  const [status, setStatus] = useState<Call["status"]>(call.status);
  const [isMuted, setIsMuted] = useState(false);
  const [videoActive, setVideoActive] = useState(call.type === "video");
  const [speakerActive, setSpeakerActive] = useState(true);
  const [screenShareActive, setScreenShareActive] = useState(false);
  const [duration, setDuration] = useState(0);

  const isCaller = call.callerId === currentUser.id;
  const peerName = isCaller ? call.receiverName : call.callerName;
  const peerPhoto = isCaller ? call.receiverPhoto : call.callerPhoto;

  useEffect(() => {
    setStatus(call.status);
    if (call.status === "ended" || call.status === "declined" || call.status === "missed") {
      const closeTimer = setTimeout(() => {
        onClose();
      }, 2000);
      return () => clearTimeout(closeTimer);
    }
  }, [call.status, onClose]);

  // Handle timer
  useEffect(() => {
    let timer: any = null;
    if (status === "connected") {
      timer = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [status]);

  const handleAccept = async () => {
    try {
      const updated = await api.updateCall(call.id, "connected");
      setStatus("connected");
    } catch (err) {
      console.error(err);
    }
  };

  const handleDecline = async () => {
    try {
      await api.updateCall(call.id, isCaller ? "missed" : "declined");
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEndCall = async () => {
    try {
      await api.updateCall(call.id, "ended", duration);
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-50 p-4 font-sans text-slate-100 select-none">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col items-center justify-between min-h-[480px] relative overflow-hidden">
        
        {/* Call Animation Rings */}
        {status === "ringing" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
            <div className="w-48 h-48 border border-blue-500 rounded-full animate-ping absolute"></div>
            <div className="w-64 h-64 border border-blue-500 rounded-full animate-ping absolute delay-150"></div>
          </div>
        )}

        {/* Header Call Meta */}
        <div className="text-center w-full z-10">
          <span className="text-[10px] font-bold tracking-wider uppercase bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full border border-blue-500/20">
            {call.type === "video" ? "Chamada de Vídeo" : "Chamada de Voz"} E2E
          </span>
          <p className="text-xs text-slate-400 mt-3">
            {status === "ringing" ? "Chamando..." : status === "connected" ? "Conectado" : "Finalizado"}
          </p>
        </div>

        {/* Profile and Media area */}
        <div className="flex flex-col items-center justify-center flex-1 my-6 relative z-10 w-full">
          {videoActive && status === "connected" ? (
            <div className="w-full h-44 bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 relative flex items-center justify-center">
              {screenShareActive ? (
                <div className="flex flex-col items-center gap-1.5 text-center px-4">
                  <Monitor className="w-8 h-8 text-blue-400 animate-pulse" />
                  <p className="text-xs font-semibold">Você está transmitindo sua tela</p>
                  <p className="text-[10px] text-slate-500">Outros participantes podem ver tudo na tela</p>
                </div>
              ) : (
                <>
                  <img src={peerPhoto} alt="Peer Camera" className="w-full h-full object-cover" />
                  {/* Miniature Self Camera preview */}
                  <div className="absolute bottom-2 right-2 w-16 h-20 bg-slate-900 border border-slate-700 rounded-lg overflow-hidden shadow-md">
                    <img src={currentUser.photoUrl} alt="Self" className="w-full h-full object-cover" />
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="relative">
              <div className="w-24 h-24 rounded-3xl overflow-hidden border-2 border-slate-700 shadow-xl p-1 bg-slate-850">
                <img src={peerPhoto} alt="Contact Photo" className="w-full h-full object-cover rounded-2xl" />
              </div>
              {status === "connected" && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-slate-900">
                  <Phone className="w-3 h-3 text-white fill-white" />
                </div>
              )}
            </div>
          )}

          <h3 className="text-lg font-bold mt-4 leading-tight">{peerName}</h3>
          
          {status === "connected" && (
            <p className="text-sm font-mono text-emerald-400 mt-2 tracking-widest font-semibold">
              {formatDuration(duration)}
            </p>
          )}
        </div>

        {/* Buttons / Controls Container */}
        <div className="w-full relative z-10 space-y-4">
          
          {/* Audio Video Toggles when active */}
          {status === "connected" && (
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                  isMuted 
                    ? "bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20" 
                    : "bg-slate-800 border-slate-700 text-slate-300 hover:text-white"
                }`}
                title={isMuted ? "Ativar Microfone" : "Mutar Microfone"}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              <button
                onClick={() => setVideoActive(!videoActive)}
                className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                  !videoActive 
                    ? "bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20" 
                    : "bg-slate-800 border-slate-700 text-slate-300 hover:text-white"
                }`}
                title={videoActive ? "Desativar Câmera" : "Ativar Câmera"}
              >
                {videoActive ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </button>

              <button
                onClick={() => setSpeakerActive(!speakerActive)}
                className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                  !speakerActive 
                    ? "bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20" 
                    : "bg-slate-800 border-slate-700 text-slate-300 hover:text-white"
                }`}
                title={speakerActive ? "Mudar para fone de ouvido" : "Mudar para alto-falante"}
              >
                {speakerActive ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </button>

              <button
                onClick={() => setScreenShareActive(!screenShareActive)}
                className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                  screenShareActive 
                    ? "bg-blue-500/20 border-blue-500/30 text-blue-400 hover:bg-blue-500/30" 
                    : "bg-slate-800 border-slate-700 text-slate-300 hover:text-white"
                }`}
                title={screenShareActive ? "Parar Compartilhamento" : "Compartilhar Tela"}
              >
                {screenShareActive ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
              </button>
            </div>
          )}

          {/* Accept / Decline / End calls triggers */}
          <div className="flex items-center justify-center gap-6 pt-2">
            {status === "ringing" && !isCaller ? (
              <>
                <button
                  onClick={handleDecline}
                  className="w-14 h-14 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center text-white cursor-pointer shadow-lg shadow-red-600/20 transition-all active:scale-95"
                  title="Recusar"
                >
                  <PhoneOff className="w-6 h-6" />
                </button>
                <button
                  onClick={handleAccept}
                  className="w-14 h-14 bg-emerald-600 hover:bg-emerald-500 rounded-full flex items-center justify-center text-white cursor-pointer shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
                  title="Atender"
                >
                  <Phone className="w-6 h-6" />
                </button>
              </>
            ) : (
              <button
                onClick={handleEndCall}
                className="w-14 h-14 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center text-white cursor-pointer shadow-lg shadow-red-600/20 transition-all active:scale-95"
                title="Desconectar"
              >
                <PhoneOff className="w-6 h-6" />
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
