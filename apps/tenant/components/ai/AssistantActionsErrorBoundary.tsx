"use client";

import React, { Component, ReactNode } from "react";
import Alert from "@/components/ui/alert/Alert";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class AssistantActionsErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("AssistantActions error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
          <Alert
            variant="error"
            title="Error loading assistant actions"
            message={
              this.state.error?.message ||
              "An unexpected error occurred. Please refresh the page and try again."
            }
          />
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export { AssistantActionsErrorBoundary };
export default AssistantActionsErrorBoundary;
