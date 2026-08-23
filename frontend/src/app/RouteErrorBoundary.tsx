import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '../widgets/ui/Primitives';

type Props = { children: ReactNode };
type State = { error: Error | null; diagnosticId: string };

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null, diagnosticId: crypto.randomUUID() };
  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('route_render_error', { diagnosticId: this.state.diagnosticId, error, info });
  }
  render() {
    if (!this.state.error) return this.props.children;
    const retry = () => {
      this.setState({ error: null, diagnosticId: crypto.randomUUID() });
    };
    return (
      <main className="state-screen danger" role="alert">
        <h1>这一页暂时无法显影</h1>
        <p>页面遇到意外中断。你的旅程数据仍在服务端，重新载入即可继续。</p>
        <code>诊断编号：{this.state.diagnosticId}</code>
        <div className="dialog-actions">
          <Button context="dialog" onClick={retry}>
            重新载入
          </Button>
          <button className="ghost-button" onClick={() => window.location.assign('/')}>
            返回首页
          </button>
          <button className="ghost-button" onClick={() => void navigator.clipboard?.writeText(this.state.diagnosticId)}>
            复制诊断编号
          </button>
        </div>
      </main>
    );
  }
}
