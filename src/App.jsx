import { useState, useEffect } from 'react';
import WelcomeScreen from './components/WelcomeScreen';
import LoginScreen from './components/LoginScreen';
import RegisterScreen from './components/RegisterScreen';
import ChatsScreen from './components/ChatsScreen';
import './App.css';

function App() {
  const [screen, setScreen] = useState('welcome'); 
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setIsAuthenticated(true);
      setScreen('chats');
    }
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
    setScreen('chats');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
    setScreen('welcome');
  };

  return (
    <div className="app">
      {screen === 'welcome' && <WelcomeScreen onNavigate={setScreen} />}
      {screen === 'login' && <LoginScreen onBack={() => setScreen('welcome')} onLogin={handleLogin} />}
      {screen === 'register' && <RegisterScreen onBack={() => setScreen('welcome')} />}
      {screen === 'chats' && <ChatsScreen onLogout={handleLogout} />}
    </div>
  );
}

export default App;
