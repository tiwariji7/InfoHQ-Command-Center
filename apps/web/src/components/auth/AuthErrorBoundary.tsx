import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class AuthErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error?.message || 'An error occurred while loading the authentication service.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('Auth component error captured by boundary:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full flex flex-col items-center text-center p-4">
          <div className="w-10 h-10 rounded-full bg-brand-errorBg flex items-center justify-center text-brand-destructive mb-3">
            <AlertCircle size={20} />
          </div>
          <div className="text-sm font-semibold text-brand-heading mb-1">
            Unable to connect to Clerk
          </div>
          <p className="text-xs text-brand-muted mb-4 max-w-xs">
            {this.state.errorMessage}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="hq-btn-secondary text-xs py-2 px-3 flex items-center gap-2"
          >
            <RefreshCw size={14} />
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
