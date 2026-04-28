import React from 'react';

/**
 * ErrorBoundary: 자식 컴포넌트에서 런타임 에러가 발생해도
 * 해당 섹션만 에러 메시지를 표시하고 나머지 앱은 정상 동작합니다.
 * 
 * 사용법: <ErrorBoundary fallbackMessage="통계를 불러올 수 없습니다.">
 *           <StatisticsView ... />
 *         </ErrorBoundary>
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error(`[ErrorBoundary] ${this.props.name || 'Component'} crashed:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-rose-500/10 flex items-center justify-center">
            <span className="text-xl">⚠️</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {this.props.fallbackMessage || '이 섹션을 불러오는 중 오류가 발생했습니다.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="text-xs text-primary hover:underline"
          >
            다시 시도
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
