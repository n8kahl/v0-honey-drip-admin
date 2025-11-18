import { Component, ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[v0] Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const isEnvError = this.state.error?.message?.includes('environment variables') ||
                        this.state.error?.message?.includes('VITE_SUPABASE');

      return (
        <div className="min-h-screen w-full bg-[#0A0A0B] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#18181B] border border-[#27272A] rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h1 className="text-lg font-semibold text-white">Configuration Error</h1>
            </div>
            
            {isEnvError ? (
              <>
                <p className="text-sm text-zinc-400">
                  Missing required environment variables. Please configure the following in your Railway dashboard:
                </p>
                <div className="bg-[#0A0A0B] border border-[#27272A] rounded p-3 font-mono text-xs space-y-1">
                  <div className="text-zinc-300">VITE_SUPABASE_URL</div>
                  <div className="text-zinc-300">VITE_SUPABASE_ANON_KEY</div>
                  <div className="text-zinc-300">MASSIVE_API_KEY</div>
                </div>
                <p className="text-xs text-zinc-500">
                  After adding these variables, redeploy your application.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-zinc-400">
                  An unexpected error occurred while loading the application.
                </p>
                <div className="bg-[#0A0A0B] border border-[#27272A] rounded p-3 font-mono text-xs text-red-400">
                  {this.state.error?.message || 'Unknown error'}
                </div>
              </>
            )}
            
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 bg-[#27272A] hover:bg-[#3F3F46] text-white text-sm rounded transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
