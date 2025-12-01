import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Eye, EyeOff } from "lucide-react";
import { branding } from "../lib/config/branding";

export function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [discordHandle, setDiscordHandle] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showResetSuccess, setShowResetSuccess] = useState(false);

  const { signIn, signUp, resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validate passwords match on signup
    if (isSignUp && password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      if (isForgotPassword) {
        const { error } = await resetPassword(email);
        if (error) throw error;
        setShowResetSuccess(true);
      } else if (isSignUp) {
        const { error } = await signUp(email, password, displayName);
        if (error) throw error;
        setShowSuccess(true);
      } else {
        const { error } = await signIn(email, password);
        if (error) throw error;
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (showResetSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] p-4">
        <div className="w-full max-w-md bg-[var(--surface-1)] rounded-[var(--radius)] border border-[var(--border-hairline)] p-8 shadow-xl">
          <div className="flex justify-center mb-6">
            <img
              src={branding.logoUrl || "/placeholder.svg"}
              alt={branding.appName}
              className="w-32 h-32 rounded-lg"
            />
          </div>
          <h2 className="text-2xl font-bold text-[var(--text-high)] mb-4 text-center">
            Check your email
          </h2>
          <p className="text-[var(--text-muted)] mb-6 text-center">
            We've sent you a password reset email. Please check your inbox and click the link to
            reset your password.
          </p>
          <button
            onClick={() => {
              setShowResetSuccess(false);
              setIsForgotPassword(false);
              setEmail("");
            }}
            className="w-full bg-[var(--brand-primary)] text-white py-2.5 rounded-[var(--radius)] hover:opacity-90 transition-opacity font-medium"
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

  if (showSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] p-4">
        <div className="w-full max-w-md bg-[var(--surface-1)] rounded-[var(--radius)] border border-[var(--border-hairline)] p-8 shadow-xl">
          <div className="flex justify-center mb-6">
            <img
              src={branding.logoUrl || "/placeholder.svg"}
              alt={branding.appName}
              className="w-32 h-32 rounded-lg"
            />
          </div>
          <h2 className="text-2xl font-bold text-[var(--text-high)] mb-4 text-center">
            Check your email
          </h2>
          <p className="text-[var(--text-muted)] mb-6 text-center">
            We've sent you a confirmation email. Please check your inbox and click the link to
            verify your account.
          </p>
          <button
            onClick={() => {
              setShowSuccess(false);
              setIsSignUp(false);
              setEmail("");
              setPassword("");
              setConfirmPassword("");
              setDisplayName("");
              setDiscordHandle("");
            }}
            className="w-full bg-[var(--brand-primary)] text-white py-2.5 rounded-[var(--radius)] hover:opacity-90 transition-opacity font-medium"
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] p-4">
      <div className="w-full max-w-md bg-[var(--surface-1)] rounded-[var(--radius)] border border-[var(--border-hairline)] p-8 shadow-xl">
        {/* Logo and Title */}
        <div className="flex justify-center mb-6">
          <img
            src={branding.logoUrl || "/placeholder.svg"}
            alt={branding.appName}
            className="w-32 h-32 rounded-lg"
          />
        </div>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[var(--text-high)] mb-3">{branding.appName}</h1>
          <p className="text-[var(--text-muted)] text-sm">
            {isForgotPassword
              ? "Reset your password"
              : isSignUp
                ? "Create your account"
                : "Log in to manage trade alerts"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Display Name - Sign Up Only */}
          {isSignUp && !isForgotPassword && (
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">
                Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required={isSignUp}
                className="w-full bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded-[var(--radius)] px-3 py-2.5 text-[var(--text-high)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] transition-shadow"
                placeholder="Your name"
              />
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded-[var(--radius)] px-3 py-2.5 text-[var(--text-high)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] transition-shadow"
              placeholder="you@example.com"
            />
          </div>

          {/* Password - Not shown in forgot password mode */}
          {!isForgotPassword && (
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded-[var(--radius)] px-3 py-2.5 pr-10 text-[var(--text-high)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] transition-shadow"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-high)] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Confirm Password - Sign Up Only */}
          {isSignUp && !isForgotPassword && (
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required={isSignUp}
                  className="w-full bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded-[var(--radius)] px-3 py-2.5 pr-10 text-[var(--text-high)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] transition-shadow"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-high)] transition-colors"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Discord Handle - Sign Up Only (Optional) */}
          {isSignUp && !isForgotPassword && (
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">
                Discord Handle <span className="text-xs">(optional)</span>
              </label>
              <input
                type="text"
                value={discordHandle}
                onChange={(e) => setDiscordHandle(e.target.value)}
                className="w-full bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded-[var(--radius)] px-3 py-2.5 text-[var(--text-high)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] transition-shadow"
                placeholder="@honeydrip_nate"
              />
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-[var(--radius)] p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[var(--brand-primary)] text-white py-2.5 rounded-[var(--radius)] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading
              ? "Please wait..."
              : isForgotPassword
                ? "Send reset email"
                : isSignUp
                  ? "Create account"
                  : "Log In"}
          </button>

          {/* Forgot Password - Login Only */}
          {!isSignUp && !isForgotPassword && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setIsForgotPassword(true);
                  setError(null);
                }}
                className="text-sm text-[var(--text-muted)] hover:text-[var(--brand-primary)] transition-colors"
              >
                Forgot password?
              </button>
            </div>
          )}

          {/* Back to Login - Forgot Password Mode */}
          {isForgotPassword && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setIsForgotPassword(false);
                  setError(null);
                  setEmail("");
                }}
                className="text-sm text-[var(--text-muted)] hover:text-[var(--brand-primary)] transition-colors"
              >
                Back to login
              </button>
            </div>
          )}
        </form>

        {/* Toggle Sign Up/Login */}
        {!isForgotPassword && (
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
                setPassword("");
                setConfirmPassword("");
              }}
              className="text-sm text-[var(--brand-primary)] hover:underline"
            >
              {isSignUp ? "Already have an account? Log in" : "Need an account? Sign up"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
