import { FluentProvider } from '@fluentui/react-components';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Use a minimal theme that doesn't override VS Code colors
const vscodeTheme = {
  colorNeutralBackground1: 'var(--vscode-editor-background)',
  colorNeutralForeground1: 'var(--vscode-editor-foreground)',
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <FluentProvider theme={vscodeTheme as any}>
      <App />
    </FluentProvider>
  </React.StrictMode>,
);
