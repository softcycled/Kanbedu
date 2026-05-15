"use client";

import React from "react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error | null;
}

export default class ClientErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("ClientErrorBoundary caught error:", error);
    this.setState({ error });
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          {this.props.fallback ?? <div className="text-sm text-muted">Something went wrong.</div>}
          <div className="mt-4">
            <button onClick={this.reset} className="px-3 py-1.5 rounded-lg text-sm border border-border">Retry</button>
          </div>
        </div>
      );
    }
    return this.props.children as any;
  }
}
