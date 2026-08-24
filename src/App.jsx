import { BrowserRouter } from 'react-router-dom';
import { useEffect } from 'react';

import { AppProvider } from './services/AppContext';
import AppRoutes from './routes/AppRoutes';
import { testSupabase } from './services/testSupabase';

import './styles/global.css';

export default function App() {

  useEffect(() => {
    testSupabase();
  }, []);

  return (
    <BrowserRouter>
      <AppProvider>
        <AppRoutes />
      </AppProvider>
    </BrowserRouter>
  );
}