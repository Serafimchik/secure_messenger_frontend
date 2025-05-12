import { useState, useEffect } from 'react';
import WelcomeScreen from './components/WelcomeScreen';
import LoginScreen from './components/LoginScreen';
import RegisterScreen from './components/RegisterScreen';
import ChatsScreen from './components/ChatsScreen';
import './styles/auth.css';
import './styles/chatMessages.css';
import './styles/chatSidebar.css';
import './styles/chatLayout.css';
import './styles/global.css';


function App() {
  const [screen, setScreen] = useState('welcome'); 

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setScreen('chats');
    }
  }, []);

  const handleLoginSuccess = () => {
    setScreen('chats');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setScreen('welcome');
  };

  return (
    <div className="app">
      {screen === 'welcome' && <WelcomeScreen onNavigate={setScreen} />}
      {screen === 'login' && <LoginScreen onBack={() => setScreen('welcome')} onLogin={handleLoginSuccess} />}
      {screen === 'register' && <RegisterScreen onBack={() => setScreen('welcome')} />}
      {screen === 'chats' && <ChatsScreen onLogout={handleLogout} />}
    </div>
  );
}

export default App;
