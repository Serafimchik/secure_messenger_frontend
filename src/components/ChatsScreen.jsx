import { useEffect, useState } from 'react';

function ChatsScreen({ onLogout }) {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchChats() {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:8080/api/chats', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setChats(data.chats || []);
        } else {
          console.error('Ошибка при загрузке чатов');
        }
      } catch (error) {
        console.error('Ошибка сети при загрузке чатов:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchChats();
  }, []);

  return (
    <div className="chats-screen">
      <div className="chats-header">
        <h1>Чаты</h1>
        <button onClick={onLogout} className="btn red">Выйти</button>
      </div>

      {loading ? (
        <p>Загрузка чатов...</p>
      ) : chats.length > 0 ? (
        <ul className="chat-list">
          {chats.map((chat) => (
            <li key={chat.id} className="chat-item">
              <div className="chat-name">{chat.name}</div>
              <div className="chat-last-message">{chat.lastMessage || 'Нет сообщений'}</div>
            </li>
          ))}
        </ul>
      ) : (
        <p>Чатов пока нет</p>
      )}
    </div>
  );
}

export default ChatsScreen;
