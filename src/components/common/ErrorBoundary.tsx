import React from 'react'

type Props = {
  children: React.ReactNode
}

type State = {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error) {
    // Keep this minimal to avoid failing inside error handling.
    // eslint-disable-next-line no-console
    console.error('Unhandled UI error:', error)
  }

  private reset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="min-h-screen bg-background-dark text-text-dark-primary">
        <div className="mx-auto flex max-w-2xl flex-col gap-4 px-6 py-16">
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-6">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-red-400">
                error
              </span>
              <div className="flex flex-col gap-1">
                <h1 className="text-lg font-bold">Something went wrong</h1>
                <p className="text-sm text-text-dark-secondary">
                  The app hit an unexpected error. You can try again, or reload
                  the page.
                </p>
              </div>
            </div>

            {this.state.error ? (
              <details className="mt-4 rounded bg-background-dark p-3 text-xs text-text-dark-secondary">
                <summary className="cursor-pointer font-semibold">
                  Error details
                </summary>
                <pre className="mt-2 whitespace-pre-wrap break-words font-mono">
                  {this.state.error.message}
                </pre>
              </details>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-background-dark hover:opacity-90"
                onClick={this.reset}
              >
                Try again
              </button>
              <button
                type="button"
                className="rounded-md border border-border-dark bg-transparent px-4 py-2 text-sm font-semibold text-text-dark-secondary hover:bg-white/5"
                onClick={() => window.location.reload()}
              >
                Reload page
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }
}


