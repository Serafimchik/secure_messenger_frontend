import { useState } from 'react';

function LoginScreen({ onBack, onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = { email, password };

    try {
      const response = await fetch("/login", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const text = await response.text();

      if (response.ok) {
        const data = JSON.parse(text);
        console.log('Login successful:', data);

        localStorage.setItem('token', data.token);

        setMessage('Вход выполнен успешно!');
        setError(false);

        onLogin(); 
      } else {
        setError(true);

        if (response.status === 401) {
          if (text.includes('locked')) {
            setMessage('Аккаунт временно заблокирован из-за множества неудачных попыток входа.');
          } else if (text.includes('not found')) {
            setMessage('Пользователь с таким email не найден.');
          } else {
            setMessage('Неверный email или пароль.');
          }
        } else {
          setMessage('Произошла ошибка входа. Попробуйте позже.');
        }
      }
    } catch (err) {
      console.error('Ошибка при входе:', err);
      setMessage('Сервер недоступен или ошибка сети');
      setError(true);
    }
  };

  return (
    <div className="card">
      <h1>Вход</h1>
      <form onSubmit={handleSubmit} className="form">
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
        <button type="submit" className="btn green">Войти</button>
      </form>

      {message && (
        <p className={`message ${error ? 'error' : 'success'}`}>
          {message}
        </p>
      )}

      <button onClick={onBack} className="link-button">Назад</button>
    </div>
  );
}

export default LoginScreen;
