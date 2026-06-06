import { useState } from 'react';
import { motion } from 'framer-motion';
import { BriefcaseBusiness, Lock, Phone, ArrowRight, Loader2, UserPlus, AlertCircle, Key, HelpCircle } from 'lucide-react';
import { validateUser, createUser, performResetPassword, type User } from '../lib/auth';

interface LoginPageProps {
  onLogin: (user: User) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityKey, setSecurityKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async () => {
    if (!phone.trim() || !securityKey.trim() || !password.trim()) {
      setError('请输入所有必填字段');
      return;
    }
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    if (password.length < 6) {
      setError('密码长度不能小于6位');
      return;
    }
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      await performResetPassword(phone.trim(), securityKey.trim(), password.trim());
      setSuccessMessage('密码重置成功，请使用新密码登录！');
      setTimeout(() => {
        setIsResetting(false);
        setPassword('');
        setConfirmPassword('');
        setSecurityKey('');
        setSuccessMessage(null);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '重置密码失败');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!phone.trim() || !password.trim()) {
      setError('请输入手机号和密码');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const user = await validateUser(phone.trim(), password.trim());
      if (user) {
        onLogin(user);
      } else {
        setError('手机号或密码错误');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!phone.trim() || !password.trim()) {
      setError('请输入手机号和密码');
      return;
    }
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    if (phone.trim().length < 5) {
      setError('手机号格式不正确');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const user = await createUser(phone.trim(), password.trim());
      onLogin(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FFF9FA] p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-pink-500 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-pink-200">
            <BriefcaseBusiness className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
            I Want A Job
          </h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2">
            个人求职智能助手
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl border border-pink-100 shadow-xl shadow-pink-100/50 p-8">
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-6 text-center">
            {isResetting ? '重置密码' : isRegistering ? '注册新账号' : '账号登录'}
          </h2>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 text-rose-700 text-xs font-bold flex items-center gap-2 border border-rose-100">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold flex items-center gap-2 border border-emerald-100">
              <AlertCircle className="w-4 h-4 text-emerald-500" /> {successMessage}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2 block flex items-center gap-2">
                <Phone className="w-3 h-3" /> 手机号
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="请输入手机号"
                className="w-full bg-white border border-slate-200 rounded-lg p-4 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 transition-all"
                onKeyDown={(e) => e.key === 'Enter' && !isRegistering && !isResetting && handleLogin()}
              />
            </div>

            {isResetting && (
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2 block flex items-center gap-2">
                  <Key className="w-3 h-3" /> 安全密钥
                </label>
                <input
                  type="password"
                  value={securityKey}
                  onChange={(e) => setSecurityKey(e.target.value)}
                  placeholder="请输入部署时配置的管理员安全密钥"
                  className="w-full bg-white border border-slate-200 rounded-lg p-4 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 transition-all"
                  onKeyDown={(e) => e.key === 'Enter' && handleResetPassword()}
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  * 默认密钥为 '123456'，或在 Vercel 环境变量中配置的 ADMIN_RESET_PIN。
                </p>
              </div>
            )}

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2 block flex items-center gap-2">
                <Lock className="w-3 h-3" /> {isResetting ? '新密码' : '密码'}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isResetting ? '请输入新密码' : '请输入密码'}
                className="w-full bg-white border border-slate-200 rounded-lg p-4 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 transition-all"
                onKeyDown={(e) => e.key === 'Enter' && !isRegistering && !isResetting && handleLogin()}
              />
            </div>

            {(isRegistering || isResetting) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
              >
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2 block flex items-center gap-2">
                  <Lock className="w-3 h-3" /> 确认密码
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="请再次输入密码"
                  className="w-full bg-white border border-slate-200 rounded-lg p-4 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 transition-all"
                  onKeyDown={(e) => e.key === 'Enter' && (isResetting ? handleResetPassword() : handleRegister())}
                />
              </motion.div>
            )}

            <button
              onClick={isResetting ? handleResetPassword : isRegistering ? handleRegister : handleLogin}
              disabled={loading}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-lg font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  {isResetting ? '确认重置密码' : isRegistering ? '注册' : '登录'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="flex flex-col gap-2 pt-2 text-center">
              {isResetting ? (
                <button
                  onClick={() => {
                    setIsResetting(false);
                    setError(null);
                    setConfirmPassword('');
                    setSecurityKey('');
                  }}
                  className="text-[11px] text-slate-400 hover:text-slate-600 font-bold transition-colors flex items-center gap-1.5 mx-auto"
                >
                  返回账号登录
                </button>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setIsRegistering(!isRegistering);
                      setError(null);
                      setConfirmPassword('');
                    }}
                    className="text-[11px] text-pink-500 hover:text-pink-600 font-bold transition-colors flex items-center gap-1.5 mx-auto"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    {isRegistering ? '已有账号？去登录' : '没有账号？去注册'}
                  </button>
                  {!isRegistering && (
                    <button
                      onClick={() => {
                        setIsResetting(true);
                        setError(null);
                        setConfirmPassword('');
                        setSecurityKey('');
                      }}
                      className="text-[10px] text-slate-400 hover:text-slate-500 transition-colors flex items-center gap-1 mx-auto mt-1"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      忘记密码？
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
