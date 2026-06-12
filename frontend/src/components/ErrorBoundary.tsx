import { Component, ErrorInfo, ReactNode } from 'react'

interface Props  { children: ReactNode }
interface State  { hasError: boolean; message: string }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary] ${new Date().toISOString()}`, error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <div className="panel p-8 max-w-md text-center space-y-4">
          <div className="w-12 h-12 rounded-full border-2 border-alert mx-auto flex items-center justify-center">
            <span className="text-alert font-mono font-bold">!</span>
          </div>
          <p className="font-mono text-sm text-alert tracking-widest">SYSTEM ERROR</p>
          <p className="font-mono text-xs text-white/50">Contact Admin — {this.state.message}</p>
          <button
            className="btn-primary text-xs"
            onClick={() => this.setState({ hasError: false, message: '' })}
          >
            RETRY
          </button>
        </div>
      </div>
    )
  }
}
