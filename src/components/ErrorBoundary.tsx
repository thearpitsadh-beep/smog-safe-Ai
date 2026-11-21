import React from 'react';
import { FIREBASE_CONSOLE_UPGRADE_URL } from '../lib/firebase.ts';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
  isQuotaError: boolean;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '', isQuotaError: false };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const raw = error instanceof Error ? error.message : String(error);
    let parsedMsg = raw;
    try {
      const parsed = JSON.parse(raw) as { error?: string; operationType?: string; path?: string };
      if (parsed && typeof parsed.error === 'string') {
        parsedMsg = `${parsed.error} (${parsed.operationType ?? 'operation'} at ${parsed.path ?? 'firestore'})`;
      }
    } catch {
      // Plain error message
    }
    const isQuotaError = /Quota exceeded/i.test(parsedMsg);
    return {
      hasError: true,
      message: parsedMsg || 'Unexpected application error.',
      isQuotaError,
    };
  }

  componentDidCatch(error: unknown) {
    console.error('Application ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-shell" role="alert">
          <div className="card error-boundary-card">
            <div className="eyebrow-mini">SMOGSAFE RECOVERY</div>
            <h1>Something interrupted this view</h1>
            <p>{this.state.message}</p>
            {this.state.isQuotaError && (
              <p>
                Free-tier Firestore quota resets the next day. You can review quota details on the{' '}
                <a
                  href="https://firebase.google.com/pricing#cloud-firestore"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  Firebase Firestore pricing page
                </a>{' '}
                or{' '}
                <a href={FIREBASE_CONSOLE_UPGRADE_URL} target="_blank" rel="noreferrer noopener">
                  open database settings
                </a>
                .
              </p>
            )}
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => this.setState({ hasError: false, message: '', isQuotaError: false })}
            >
              Restore workspace
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
