"use client"

import { Component, type ErrorInfo, type ReactNode } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

interface GiftBoxPanelErrorBoundaryProps {
  children: ReactNode
}

interface GiftBoxPanelErrorBoundaryState {
  hasError: boolean
  message?: string
}

class GiftBoxPanelErrorBoundary extends Component<
  GiftBoxPanelErrorBoundaryProps,
  GiftBoxPanelErrorBoundaryState
> {
  state: GiftBoxPanelErrorBoundaryState = {
    hasError: false,
    message: undefined,
  }

  static getDerivedStateFromError(error: Error): GiftBoxPanelErrorBoundaryState {
    return { hasError: true, message: error?.message }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("GiftBoxAdminPanel crashed", error, info)
  }

  private handleRetry = () => {
    this.setState({ hasError: false, message: undefined })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>
              {this.state.message || "The Gift Box module failed to load. Please try again."}
            </AlertDescription>
          </Alert>
          <Button onClick={this.handleRetry} variant="secondary">
            Try again
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}

export function GiftBoxPanelBoundary({ children }: GiftBoxPanelErrorBoundaryProps) {
  return <GiftBoxPanelErrorBoundary>{children}</GiftBoxPanelErrorBoundary>
}
