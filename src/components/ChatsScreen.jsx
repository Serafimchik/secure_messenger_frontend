import { useEffect, useState, useRef, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';
import '../styles/chatsScreen.css';

function ChatsScreen({ onLogout }) {
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [newChatEmail, setNewChatEmail] = useState('');
  const [chatError, setChatError] = useState('');
  const [messageError, setMessageError] = useState('');
  const [loading, setLoading] = useState(true);
  const socketRef = useRef(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const lastMessageRef = useRef(null);

  const fetchChats = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:8080/api/chats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setChats(data);
      setChatError('');
    } catch {
      setChatError('Не удалось загрузить чаты');
    } finally {
      setLoading(false);
    }
  };

  const connectWebSocket = useCallback(() => {
    const token = localStorage.getItem('token');
    const ws = new WebSocket(`ws://localhost:8080/ws?token=${encodeURIComponent(token)}`);

    ws.onopen = () => {
      ws.send(JSON.stringify({ event: 'auth', token }));
    };

    ws.onmessage = (e) => {
      const message = JSON.parse(e.data);
      console.log("Получено сообщение по WebSocket:", message);

      if (message.event === 'new_message') {
        const data = typeof message.data === 'string' ? JSON.parse(message.data) : message.data;
        if (+data.sender_id === +currentUserId && !data.username) {
          data.username = 'Вы';
        }

        if (+data.chat_id === selectedChat?.id) {
          setMessages((prev) => [...prev, data]);
        }
      }

      if (message.event === 'new_chat') {
        fetchChats();
      }

      if (message.event === 'error') {
        console.error("WebSocket ошибка:", message.data?.message);
      }
    };

    ws.onerror = () => {
      console.error('Ошибка WebSocket соединения');
    };

    socketRef.current = ws;
  }, [currentUserId, selectedChat]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setCurrentUserId(decoded.user_id);
      } catch (e) {
        console.error("Ошибка декодирования токена", e);
      }
    }

    fetchChats();
    connectWebSocket();

    return () => socketRef.current?.close();
  }, [connectWebSocket]);

  useEffect(() => {
    if (lastMessageRef.current) {
      lastMessageRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleCreateChat = () => {
    if (!newChatEmail.match(/^[^@\s]+@[^@\s]+\.[^@\s]+$/)) {
      setChatError('Введите корректный email');
      return;
    }
    const payload = {
      event: 'create_chat',
      chat_id: 0,
      content: JSON.stringify({
        recipient_email: newChatEmail,
        type: 'direct',
        name: null,
      }),
    };
    socketRef.current.send(JSON.stringify(payload));
    setNewChatEmail('');
  };

  const fetchMessages = async (chatId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:8080/api/chats/${chatId}?page=1&limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const sortedMessages = [...data.messages].sort((a, b) => new Date(a.sent_at) - new Date(b.sent_at));
      setMessages(sortedMessages);
      setMessageError('');
    } catch {
      setMessages([]);
      setMessageError('Не удалось загрузить сообщения');
    }
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedChat) return;
    socketRef.current.send(
      JSON.stringify({
        event: 'send_message',
        chat_id: selectedChat.id,
        content: newMessage,
      })
    );
    setNewMessage('');
  };

  const selectChat = (chat) => {
    setSelectedChat(chat);
    setMessages([]);
    setMessageError('');
    fetchMessages(chat.id);
  };

  return (
    <div className="chat-screen">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>Мои чаты</h2>
          <button onClick={onLogout} className="logout-btn">Выйти</button>
        </div>

        <div className="new-chat-form">
          <input
            type="email"
            placeholder="Email собеседника"
            value={newChatEmail}
            onChange={(e) => setNewChatEmail(e.target.value)}
          />
          <button onClick={handleCreateChat} className="btn green">Создать</button>
        </div>

        {loading ? (
          <div className="empty-chat">Загрузка чатов...</div>
        ) : chatError ? (
          <div className="empty-chat error">{chatError}</div>
        ) : (
          <ul className="chat-list">
            {chats.map((chat) => (
              <li
                key={chat.id}
                className="chat-item"
                onClick={() => selectChat(chat)}
              >
                <div className="chat-name">
                  {chat.name || `Чат #${chat.id}`}
                </div>
                {chat.last_message_content && (
                  <div className="chat-last-message">
                    {chat.last_message_content}
                    <div className="message-time">
                      {new Date(chat.last_message_sent_at).toLocaleString()}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section className="chat-area">
        {!selectedChat ? (
          <div className="empty-chat">Выберите чат для отображения сообщений</div>
        ) : (
          <div className="chat-window">
            <div className="chat-header">
              <h3>{selectedChat.name || `Чат #${selectedChat.id}`}</h3>
            </div>
            <div className="chat-messages">
              {messages.length === 0 ? (
                <div className="empty-chat">Ваша переписка пуста</div>
              ) : (
                messages.map((msg, i) => (
                  <div
                    key={i}
                    ref={i === messages.length - 1 ? lastMessageRef : null}
                    className={`chat-message ${+msg.sender_id === +currentUserId ? 'own-message' : ''}`}
                  >
                    <div className="message-header">
                      <span className="sender-name">
                        {+msg.sender_id === +currentUserId ? 'Вы' : msg.username || `Пользователь #${msg.sender_id}`}
                      </span>
                      <span className="message-time">
                        {msg.sent_at ? new Date(msg.sent_at).toLocaleTimeString() : '...'}
                      </span>
                    </div>
                    <div className="message-content">{msg.content}</div>
                  </div>
                ))
              )}
            </div>
            <div className="chat-input">
              <input
                type="text"
                placeholder="Введите сообщение"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              />
              <button onClick={handleSendMessage} className="btn send-btn">
                Отправить
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default ChatsScreen;
