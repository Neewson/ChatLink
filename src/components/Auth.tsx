import React, { useState, useEffect } from "react";
import { api, saveSession } from "../utils/api";
import { User, UserStatus } from "../types";
import { KeyRound, Mail, User as UserIcon, Calendar, FileText, Check, AlertCircle, RefreshCw } from "lucide-react";

interface AuthProps {
  onAuthSuccess: (user: User) => void;
}

export default function Auth({ onAuthSuccess }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  
  // Registration additional fields
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [bio, setBio] = useState("Olá! Estou usando o ChatLink.");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  
  // Username check states
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);
  
  // Two-Factor Auth states
  const [require2FA, setRequire2FA] = useState(false);
  const [tempToken, setTempToken] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  
  // Password Recovery States
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [simulatedCode, setSimulatedCode] = useState<{ code: string; tempPassword: string } | null>(null);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Debounce username check
  useEffect(() => {
    if (isLogin || !username) {
      setUsernameStatus("idle");
      setUsernameSuggestions([]);
      return;
    }

    const clean = username.replace(/[@\s]/g, "").trim();
    if (clean.length < 3) {
      setUsernameStatus("idle");
      setUsernameSuggestions([]);
      return;
    }

    setUsernameStatus("checking");
    const timer = setTimeout(async () => {
      try {
        const res = await api.checkUsername(clean);
        if (res.available) {
          setUsernameStatus("available");
          setUsernameSuggestions([]);
        } else {
          setUsernameStatus("taken");
          setUsernameSuggestions(res.suggestions || []);
        }
      } catch (_) {
        setUsernameStatus("idle");
      }
    }, 600); // Debounce check dynamically

    return () => clearTimeout(timer);
  }, [username, isLogin]);

  // Handle instant validation trigger
  const triggerUsernameCheck = async () => {
    const clean = username.replace(/[@\s]/g, "").trim();
    if (clean.length < 3) return;
    setUsernameStatus("checking");
    try {
      const res = await api.checkUsername(clean);
      if (res.available) {
        setUsernameStatus("available");
        setUsernameSuggestions([]);
      } else {
        setUsernameStatus("taken");
        setUsernameSuggestions(res.suggestions || []);
      }
    } catch (_) {
      setUsernameStatus("idle");
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.login({ email, password, rememberMe });
      if (res.requireTwoFactor) {
        setRequire2FA(true);
        setTempToken(res.tempToken);
      } else {
        saveSession(res.token, res.user);
        onAuthSuccess(res.user);
      }
    } catch (err: any) {
      setError(err.message || "Erro de credenciais.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password || !username || !firstName || !lastName) {
      setError("Preencha todos os campos obrigatórios.");
      return;
    }

    if (usernameStatus === "taken") {
      setError("O nome de usuário já está em uso.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        email,
        password,
        username: username.replace(/[@\s]/g, ""),
        firstName,
        lastName,
        bio,
        dateOfBirth,
        photoUrl: photoUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${username}`,
        city: "",
        country: ""
      };
      const res = await api.register(payload);
      saveSession(res.token, res.user);
      onAuthSuccess(res.user);
    } catch (err: any) {
      setError(err.message || "Erro ao realizar cadastro.");
    } finally {
      setLoading(false);
    }
  };

  const handle2FAVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.verify2FA(tempToken, twoFactorCode);
      saveSession(tempToken, res.user);
      onAuthSuccess(res.user);
    } catch (err: any) {
      setError(err.message || "Código inválido.");
    } finally {
      setLoading(false);
    }
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setRecoveryMessage("");
    setSimulatedCode(null);
    setLoading(true);

    try {
      const res = await api.recovery(email);
      setRecoveryMessage(res.message);
      if (res.simulatedDetails) {
        setSimulatedCode(res.simulatedDetails);
      }
    } catch (err: any) {
      setError(err.message || "Não foi possível recuperar senha.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="auth-container" className="min-h-screen flex items-center justify-center bg-[#020617] text-slate-100 p-4 font-sans select-none relative overflow-hidden">
      {/* Ambient background glow elements for realistic glass reflection */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[140px] pointer-events-none"></div>

      <div className="w-full max-w-[370px] bg-slate-950/30 backdrop-blur-2xl rounded-3xl p-6 border border-white/10 shadow-2xl relative overflow-hidden">
        {/* Subtle internal glows */}
        <div className="absolute -top-12 -left-12 w-28 h-28 bg-blue-600/20 rounded-full blur-xl pointer-events-none"></div>
        <div className="absolute -bottom-12 -right-12 w-28 h-28 bg-emerald-600/15 rounded-full blur-xl pointer-events-none"></div>

        {/* Head Branding */}
        <div className="text-center mb-6 relative z-10">
          <div className="w-14 h-14 bg-gradient-to-tr from-blue-600 to-blue-500 rounded-2xl flex items-center justify-center font-extrabold text-2xl shadow-lg shadow-blue-500/35 mx-auto mb-3 border border-white/10">
            CL
          </div>
          <h2 className="text-xl font-black tracking-tight bg-gradient-to-b from-white to-slate-300 bg-clip-text text-transparent">ChatLink</h2>
          <p className="text-[10px] text-slate-400 mt-0.5 leading-normal">Sua plataforma moderna de mensagens e chamadas</p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 2FA Mode */}
        {require2FA ? (
          <form onSubmit={handle2FAVerify} className="space-y-4">
            <div className="text-center mb-4">
              <h3 className="text-base font-bold">Autenticação de Duplo Fator</h3>
              <p className="text-xs text-slate-400 mt-1">Este dispositivo exige um código de segurança ativo.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2">Código de Verificação de 6 Dígitos</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ex: 123456"
                  maxLength={6}
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ""))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-center tracking-widest text-lg font-bold focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-2 text-center">Para testes, utilize o código padrão: <b className="text-slate-300">123456</b></p>
            </div>
            <button
              type="submit"
              disabled={loading || twoFactorCode.length < 6}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-all active:scale-98 cursor-pointer shadow-lg shadow-blue-600/20"
            >
              {loading ? "Verificando..." : "Verificar Código"}
            </button>
            <button
              type="button"
              onClick={() => {
                setRequire2FA(false);
                setTempToken("");
              }}
              className="w-full text-center text-xs text-slate-400 hover:text-slate-300 mt-2 block"
            >
              Voltar ao login
            </button>
          </form>
        ) : isRecovering ? (
          /* Password Recovery Mode */
          <form onSubmit={handleRecoverySubmit} className="space-y-4">
            <div className="mb-4">
              <h3 className="text-sm font-bold text-slate-200">Recuperar minha senha</h3>
              <p className="text-xs text-slate-400 mt-1">Enviaremos um código e senha provisória de acesso.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Insira seu e-mail cadastrado</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="seuemail@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-xs focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-slate-100"
                />
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              </div>
            </div>

            {recoveryMessage && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs">
                {recoveryMessage}
              </div>
            )}

            {simulatedCode && (
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs space-y-1">
                <p className="font-bold text-blue-400">Simulação de E-mail de Recuperação:</p>
                <p className="text-slate-300">Código: <span className="font-mono bg-slate-900 px-1 py-0.5 rounded text-white">{simulatedCode.code}</span></p>
                <p className="text-slate-300">Senha provisória: <span className="font-mono bg-slate-900 px-1 py-0.5 rounded text-white">{simulatedCode.tempPassword}</span></p>
                <p className="text-[10px] text-slate-400 mt-1">Copie a senha acima para fazer login e redefini-la.</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all active:scale-98 cursor-pointer"
            >
              {loading ? "Processando..." : "Enviar Código de Recuperação"}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsRecovering(false);
                setRecoveryMessage("");
                setSimulatedCode(null);
              }}
              className="w-full text-center text-xs text-blue-400 hover:underline mt-2 block"
            >
              Voltar ao login
            </button>
          </form>
        ) : isLogin ? (
          /* Login Form */
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Endereço de E-mail</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="seuemail@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-xs focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 text-slate-100 placeholder-slate-500 transition-all"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-semibold text-slate-400">Senha de Acesso</label>
                <button
                  type="button"
                  onClick={() => setIsRecovering(true)}
                  className="text-xs text-blue-400 hover:underline cursor-pointer font-medium"
                >
                  Esqueceu a senha?
                </button>
              </div>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="Sua senha secreta"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-xs focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 text-slate-100 placeholder-slate-500 transition-all"
                />
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="remember"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-white/10 bg-white/5 text-blue-500 focus:ring-blue-500/20"
              />
              <label htmlFor="remember" className="text-xs text-slate-400 cursor-pointer select-none">Lembrar meu acesso neste aparelho</label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-xl text-xs font-bold transition-all active:scale-98 cursor-pointer shadow-lg shadow-blue-500/20 border border-white/10"
            >
              {loading ? "Entrando..." : "Entrar no ChatLink"}
            </button>

            <div className="text-center pt-2">
              <span className="text-xs text-slate-400">Ainda não possui conta? </span>
              <button
                type="button"
                onClick={() => setIsLogin(false)}
                className="text-xs text-blue-400 hover:underline font-semibold cursor-pointer"
              >
                Cadastre-se agora
              </button>
            </div>
          </form>
        ) : (
          /* Registration Form */
          <form onSubmit={handleRegisterSubmit} className="space-y-3 max-h-[460px] overflow-y-auto pr-1 custom-scrollbar">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 mb-1">Nome *</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Nilson"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-blue-500 text-slate-100"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 mb-1">Sobrenome *</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Santos"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-blue-500 text-slate-100"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-400 mb-1">Escolha seu Username exclusivo *</label>
              <div className="relative flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    required
                    placeholder="ex: nilson"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-7 pr-3 text-xs focus:outline-none focus:border-blue-500 text-slate-100"
                  />
                  <span className="absolute left-3 top-2 text-xs text-slate-500 font-bold">@</span>
                </div>
                <button
                  type="button"
                  onClick={triggerUsernameCheck}
                  disabled={username.length < 3}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-3 rounded-xl border border-slate-700 font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Verificar
                </button>
              </div>

              {/* Username Validation Info */}
              {usernameStatus === "checking" && (
                <p className="text-[10px] text-yellow-400 mt-1 flex items-center gap-1">Verificando disponibilidade...</p>
              )}
              {usernameStatus === "available" && (
                <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Username disponível!</p>
              )}
              {usernameStatus === "taken" && (
                <div className="mt-1.5 space-y-1 bg-red-500/5 p-2 rounded-lg border border-red-500/10">
                  <p className="text-[10px] text-red-400 flex items-center gap-1">Username indisponível. Sugestões de nomes:</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {usernameSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => {
                          setUsername(suggestion);
                          setUsernameStatus("available");
                          setUsernameSuggestions([]);
                        }}
                        className="text-[9px] bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 border border-blue-500/20 px-2 py-0.5 rounded-full font-bold transition-all"
                      >
                        @{suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-400 mb-1">E-mail *</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="seuemail@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-9 pr-3 text-xs focus:outline-none focus:border-blue-500 text-slate-100"
                />
                <Mail className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-400 mb-1">Senha de Segurança *</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-9 pr-3 text-xs focus:outline-none focus:border-blue-500 text-slate-100"
                />
                <KeyRound className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 mb-1">Data de Nascimento (Opcional)</label>
                <div className="relative">
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-blue-500 text-slate-100"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-400 mb-1">URL da Foto de Perfil (Opcional)</label>
              <input
                type="text"
                placeholder="https://exemplo.com/suafoto.jpg"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-blue-500 text-slate-100"
              />
              <p className="text-[9px] text-slate-500 mt-1">Se em branco, geramos um avatar criativo em tempo real.</p>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-400 mb-1">Biografia Curta</label>
              <textarea
                rows={2}
                placeholder="Uma frase sobre seu trabalho ou estilo..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs focus:outline-none focus:border-blue-500 text-slate-100 resize-none"
              ></textarea>
            </div>

            <button
              type="submit"
              disabled={loading || usernameStatus === "checking"}
              className="w-full mt-2 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all active:scale-98 cursor-pointer"
            >
              {loading ? "Cadastrando..." : "Finalizar Cadastro"}
            </button>

            <div className="text-center pt-2">
              <span className="text-xs text-slate-400">Já possui uma conta? </span>
              <button
                type="button"
                onClick={() => setIsLogin(true)}
                className="text-xs text-blue-400 hover:underline font-semibold cursor-pointer"
              >
                Acessar conta
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
