import React from 'react';
import ReactDOM from 'react-dom/client';
import { Landing } from '@plannotator/ui/components/Landing';
import { ThemeProvider } from '@plannotator/ui/components/ThemeProvider';
import '@plannotator/editor/styles';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="dark">
      <Landing />
    </ThemeProvider>
  </React.StrictMode>
);
