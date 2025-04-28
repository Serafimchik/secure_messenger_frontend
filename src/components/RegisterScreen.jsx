import { useState } from 'react';
import { generateKeyPair } from '../utils/crypto';

function RegisterScreen({ onBack }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
  
    const publicKey = await generateKeyPair();

    const payload = { 
      username, 
      email, 
      password, 
      public_key: publicKey.n 
    };
  
    try {
      const response = await fetch('http://localhost:8080/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
  
      const data = await response.json();
  
      if (response.ok || response.status === 201) {
        console.log('Регистрация успешна:', data);
        setMessage(`Успешно зарегистрирован! ID: ${data.user_id}`);
      } else {
        setMessage(data.message || 'Ошибка регистрации');
      }
    } catch (error) {
      console.error('Ошибка при регистрации:', error);
      setMessage('Сервер недоступен или ошибка сети');
    }
  };

  return (
    <div className="card">
      <h1>Регистрация</h1>
      <form onSubmit={handleSubmit} className="form">
        <input
          type="text"
          placeholder="Имя пользователя"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          type="email"
          placeholder="Электронная почта"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" className="btn green">Зарегистрироваться</button>
      </form>
      {message && <p className="message">{message}</p>}
      <button onClick={onBack} className="link-button">Назад</button>
    </div>
  );
}

export default RegisterScreen;
