import { FluentProvider, webDarkTheme, webLightTheme } from '@fluentui/react-components';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Detect VS Code theme
const getTheme = () => {
  const isDark = document.body.classList.contains('vscode-dark') || 
                 document.body.classList.contains('vscode-high-contrast');
  return isDark ? webDarkTheme : webLightTheme;
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <FluentProvider theme={getTheme()}>
      <App />
    </FluentProvider>
  </React.StrictMode>,
);
