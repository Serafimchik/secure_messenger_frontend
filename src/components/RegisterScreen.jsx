import React, { useState, useEffect } from 'react';

function RegisterScreen({ onBack }) {
  const [generateKeyPair, setGenerateKeyPair] = useState(null);
  const [message, setMessage] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    import('../utils/crypto')
      .then(mod => setGenerateKeyPair(() => mod.generateKeyPair))
      .catch(() => setMessage('Ошибка загрузки криптографии'));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!generateKeyPair) {
      setMessage('Загрузка криптографии...');
      return;
    }

    try {
      const publicKey = await generateKeyPair();

      const payload = {
        username,
        email,
        password,
        public_key: publicKey,
      };

      const response = await fetch("/register", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok || response.status === 201) {
        setMessage(`Успешно зарегистрирован! ID: ${data.user_id}`);
      } else {
        setMessage(data.message || 'Ошибка регистрации');
      }
    } catch (error) {
      console.error(error);
      setMessage('Ошибка генерации ключа или сервер недоступен');
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
          onChange={e => setUsername(e.target.value)}
          required
        />
        <input
          type="email"
          placeholder="Электронная почта"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={e => setPassword(e.target.value)}
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
