import React, { useState } from 'react';
import '../styles/groupChatParticipants.css';
const GroupChatParticipants = ({ participants, currentUserId, onAdd, onRemove }) => {
  const [newEmail, setNewEmail] = useState('');
  const [error, setError] = useState('');

  const handleAdd = () => {
    if (!newEmail.trim()) {
      setError('Введите email');
      return;
    }

    setError('');
    onAdd(newEmail);
    setNewEmail('');
  };

  return (
    <div className="participants-panel">
      <h4>Участники</h4>
      <ul className="participants-list">
        {participants.map((user) => (
          <li key={user.id} className="participant-item">
            <span>{user.username || `Пользователь #${user.id}`} ({user.email})</span>
            {user.id !== currentUserId && (
              <button
                className="remove-btn"
                onClick={() => onRemove(user.id)}
              >
                Удалить
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="add-participant">
        <input
          type="email"
          placeholder="Email нового участника"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
        />
        <button onClick={handleAdd}>Добавить</button>
        {error && <div className="error-text">{error}</div>}
      </div>
    </div>
  );
};

export default GroupChatParticipants;
