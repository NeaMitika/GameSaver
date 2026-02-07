import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { Toaster } from './components/ui/sonner';
import './styles.css';
import 'sonner/dist/styles.css';

document.documentElement.classList.add('dark');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <Toaster />
  </React.StrictMode>
);
