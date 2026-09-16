import { createRoot } from 'react-dom/client';
import { Component, type ReactNode } from 'react';
import App from './App';
import './styles.css';
import './imageStyles.css';
class RecoveryBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <main><section className="page-heading"><div><h1>Let’s try that again.</h1><p>The app may have updated since this tab was opened. Your saved searches are still on this device.</p><button className="button primary" onClick={() => window.location.reload()}>Reload Stock Finder</button></div></section></main> : this.props.children; }
}
createRoot(document.getElementById('root')!).render(<RecoveryBoundary><App/></RecoveryBoundary>);
