import { useState } from 'react';
import '../styles/createChatModal.css';

export default function CreateChatModal({ isOpen, onClose, onCreate }) {
    const [chatType, setChatType] = useState('direct');
    const [groupName, setGroupName] = useState('');
    const [email, setEmail] = useState('');
    const [participants, setParticipants] = useState([]);
    const [newParticipant, setNewParticipant] = useState('');

    if (!isOpen) return null;

    const handleAddParticipant = () => {
      const trimmed = newParticipant.trim();
      if (trimmed && !participants.includes(trimmed)) {
        setParticipants([...participants, trimmed]);
        setNewParticipant('');
      }
    };

    const handleRemoveParticipant = (emailToRemove) => {
      setParticipants(participants.filter((p) => p !== emailToRemove));
    };

    const handleCreate = () => {
      if (chatType === 'direct' && email.trim()) {
        onCreate({ type: 'direct', emails: [email.trim()] });
      } else if (chatType === 'group' && groupName.trim() && participants.length > 0) {
        onCreate({ type: 'group', name: groupName.trim(), emails: participants });
      } else if (chatType === 'channel' && groupName.trim()) {
        onCreate({ type: 'channel', name: groupName.trim(), emails: participants });
      }
      onClose();
    };

    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <h2>Создать</h2>

          <div className="chat-type-buttons">
            <button
              onClick={() => setChatType('direct')}
              className={chatType === 'direct' ? 'selected' : 'unselected'}
            >
              Личный
            </button>
            <button
              onClick={() => setChatType('group')}
              className={chatType === 'group' ? 'selected' : 'unselected'}
            >
              Групповой
            </button>
            <button
              onClick={() => setChatType('channel')}
              className={chatType === 'channel' ? 'selected' : 'unselected'}
            >
              Канал
            </button>
          </div>

          {chatType === 'direct' && (
            <>
              <label>Email пользователя</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@example.com"
              />
            </>
          )}

          {(chatType === 'group' || chatType === 'channel') && (
            <>
              <label>{chatType === 'channel' ? 'Название канала' : 'Название группы'}</label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Введите название"
              />

              <label>Участники</label>
              <div className="participant-input">
                <input
                  type="email"
                  placeholder="Email участника"
                  value={newParticipant}
                  onChange={(e) => setNewParticipant(e.target.value)}
                />
                <button onClick={handleAddParticipant}>Добавить</button>
              </div>

              <ul className="participant-list">
                {participants.map((email) => (
                  <li key={email}>
                    <span>{email}</span>
                    <button onClick={() => handleRemoveParticipant(email)}>Удалить</button>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="modal-actions">
            <button onClick={onClose} className="cancel-btn">Отмена</button>
            <button onClick={handleCreate} className="create-btn">Создать</button>
          </div>
        </div>
      </div>
    );
  }
