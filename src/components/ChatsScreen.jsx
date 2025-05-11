import { useEffect, useState, useRef, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';
import { importPublicKey, arrayBufferToBase64, decryptMessage } from '../utils/cryptoUtils';
import { loadPrivateKey } from '../utils/indexedDB';
import '../styles/chatsScreen.css';

function ChatsScreen({ onLogout }) {
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [newChatEmail, setNewChatEmail] = useState('');
  const [chatError, setChatError] = useState('');
  const [loading, setLoading] = useState(true);
  const socketRef = useRef(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const lastMessageRef = useRef(null);
  const selectedChatRef = useRef(null);

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

  const currentUserIdRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setCurrentUserId(decoded.user_id);
        currentUserIdRef.current = decoded.user_id;  
        fetchChats();
        connectWebSocket();
      } catch (e) {
        console.error("Ошибка декодирования токена", e);
      }
    }
  
    return () => socketRef.current?.close();
  }, []);
  
  const connectWebSocket = useCallback(() => {
    const token = localStorage.getItem('token');
    const ws = new WebSocket(`ws://localhost:8080/ws?token=${encodeURIComponent(token)}`);
  
    ws.onopen = () => {
      ws.send(JSON.stringify({ event: 'auth', token }));
    };
  
    ws.onmessage = async (e) => {
      const message = JSON.parse(e.data);
  
      if (message.event === 'new_message') {
        const data = typeof message.data === 'string' ? JSON.parse(message.data) : message.data;
        data.id = data.message_id;
      
        const isOwn = +data.sender_id === +currentUserIdRef.current;
        const currentChatId = selectedChatRef.current?.id;
      
        if (isOwn && !data.username) {
          data.username = 'Вы';
        }
      
        try {
          const privateKey = await loadPrivateKey();
          const currentUserId = currentUserIdRef.current;
      
          if (privateKey) {
            const content = typeof data.content === 'string' ? JSON.parse(data.content) : data.content;
            const block = content.encrypted_messages.find(b => +b.user_id === currentUserId);
      
            if (!block) {
              data.content = '[Нет блока для пользователя]';
            } else {
              data.content = await decryptMessage(privateKey, block.payload);
            }
          } else {
            data.content = '[Нет приватного ключа]';
          }
        } catch (e) {
          console.warn('Ошибка при расшифровке сообщения по WebSocket:', e);
          data.content = '[Ошибка расшифровки]';
        }
      
        if (+data.chat_id === +currentChatId) {
          setMessages((prev) => [...prev, data]);
      
          if (!isOwn) {
            sendReadReceipt(data.chat_id, data.message_id);
          }
        } else {
          setChats((prevChats) =>
            prevChats.map((chat) =>
              +chat.id === +data.chat_id
                ? { ...chat, unread_count: (chat.unread_count || 0) + 1 }
                : chat
            )
          );
        }
      }
      
      if (message.event === 'new_chat') {
        fetchChats();
      }
  
      if (message.event === 'message_read') {
        const { chat_id, message_ids, read_at } = message.data;
      
        if (!Array.isArray(message_ids) || !read_at) {
          console.warn("Некорректные данные в message_read:", message.data);
          return;
        }   
        const currentSelected = selectedChatRef.current;
         
        if (+chat_id === +currentSelected?.id) {   
          const messageIdSet = new Set(message_ids.map(String));      
          setMessages(prevMessages => {
            const updatedMessages = prevMessages.map(msg => {
              if (messageIdSet.has(String(msg.id))) {
                return { ...msg, read_at }; 
              }
              return msg;
            });
            return [...updatedMessages];
          });
        }
      }
  
      if (message.event === 'error') {
        console.error("WebSocket ошибка:", message.data?.message);
      }
    };
  
    ws.onerror = () => {
      console.error('Ошибка WebSocket соединения');
    };
  
    socketRef.current = ws;
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setCurrentUserId(decoded.user_id);        
        fetchChats();
        connectWebSocket();
      } catch (e) {
        console.error("Ошибка декодирования токена", e);
      }
    }

    return () => socketRef.current?.close();
  }, []);

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
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload));
    } else {
      console.warn("WebSocket еще не подключен — создание чата отменено");
    }
    setNewChatEmail('');
  };

  const fetchMessages = async (chatId, limit = 20) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:8080/api/chats/${chatId}?limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
  
      if (!res.ok) throw new Error();
      const data = await res.json();
  
      const sortedMessages = [...data.messages].sort(
        (a, b) => new Date(a.sent_at) - new Date(b.sent_at)
      );
  
      const privateKey = await loadPrivateKey();
      const currentUserId = currentUserIdRef.current
  
      const decryptedMessages = await Promise.all(
        sortedMessages.map(async (msg) => {
          if (!privateKey) {
            msg.content = '[Нет приватного ключа]';
            return msg;
          }
  
          try {
            const content = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
            const block = content.encrypted_messages.find(b => +b.user_id === currentUserId);
  
            if (!block) {
              msg.content = '[Нет блока для пользователя]';
            } else {
              const decrypted = await decryptMessage(privateKey, block.payload);
              msg.content = decrypted;
            }
          } catch (e) {
            console.warn(`Ошибка расшифровки сообщения (id: ${msg.id}):`, e);
            msg.content = '[Ошибка дешифровки]';
          }
  
          return msg;
        })
      );
  
      setMessages(decryptedMessages);
    } catch (e) {
      console.error('Ошибка при загрузке сообщений:', e);
      setMessages([]);
    }
  };
  
   
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChat) return;
    try {
      const participants = selectedChat.participants;
      const encryptedMessages = [];

      const aesKey = await window.crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
      );
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const encodedMessage = new TextEncoder().encode(newMessage);
      const ciphertext = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        aesKey,
        encodedMessage
      );
      const rawAesKey = await window.crypto.subtle.exportKey("raw", aesKey);
      for (const participant of participants) {
        if (!participant.public_key) {
          console.warn(`Нет публичного ключа у участника с id ${participant.id}`);
          continue;
        }
        try {
          const publicKey = await importPublicKey(participant.public_key);
          const encryptedKey = await window.crypto.subtle.encrypt(
            { name: "RSA-OAEP" },
            publicKey,
            rawAesKey
          );
          encryptedMessages.push({
            user_id: participant.id,
            payload: {
              encrypted_key: arrayBufferToBase64(encryptedKey),
              iv: arrayBufferToBase64(iv),
              ciphertext: arrayBufferToBase64(ciphertext),
            },
          });
        } catch (err) {
          console.error(`Ошибка шифрования для user_id=${participant.id}:`, err);
        }
      }
      const encryptedContent = JSON.stringify({
        encrypted_messages: encryptedMessages,
      });
      socketRef.current?.send(
        JSON.stringify({
          event: 'send_message',
          chat_id: selectedChat.id,
          content: encryptedContent,
        })
      );
      setNewMessage('');
    } catch (error) {
      console.error("Ошибка при отправке сообщения:", error);
    }
  };
  
  const selectChat = (chat) => {
    setSelectedChat(chat);
    selectedChatRef.current = chat; 
    setMessages([]);
    fetchMessages(chat.id);
    setChats(prevChats =>
      prevChats.map(c =>
        c.id === chat.id ? { ...c, unread_count: 0 } : c
      )
    );
  };

  const sendReadReceipt = useCallback((chatId, lastReadMessageId) => {
    return new Promise((resolve, reject) => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        const numericLastReadMessageId = Number(lastReadMessageId);
        if (isNaN(numericLastReadMessageId)) {
          console.error("Некорректный lastReadMessageId:", lastReadMessageId);
          return;
        } 
        socketRef.current.send(
          JSON.stringify({
            event: 'message_read',
            chat_id: chatId,
            content: JSON.stringify({
              event: 'message_read',
              data: {
                chat_id: chatId,
                last_read_message_id: numericLastReadMessageId, 
              },
            }),
          })
        );
        resolve(); 
      } else {
        reject(new Error("WebSocket соединение закрыто")); 
      }
    });
  }, []);

  useEffect(() => {
    const container = document.querySelector('.chat-messages');
    if (!container) return;
  
    let isProcessingReadReceipt = false; 
  
    const handleScroll = () => {
      if (!selectedChat || messages.length === 0) return;
  
      const unreadMessages = messages.filter(
        msg => +msg.sender_id !== +currentUserId && !msg.read_at
      );
  
      if (unreadMessages.length === 0) return;
  
      const isVisible = unreadMessages.some(msg => {
        const messageElement = document.querySelector(`[data-message-id="${msg.id}"]`);
        if (!messageElement) return false;
        const rect = messageElement.getBoundingClientRect();
        return rect.top >= 0 && rect.bottom <= window.innerHeight;
      });
  
      if (isVisible && !isProcessingReadReceipt) {
        isProcessingReadReceipt = true; 
  
        const lastUnreadMessage = unreadMessages[unreadMessages.length - 1];
  
        sendReadReceipt(selectedChat.id, lastUnreadMessage.id)
          .then(() => {
            setMessages(prevMessages =>
              prevMessages.map(msg =>
                msg.id === lastUnreadMessage.id
                  ? { ...msg, read_at: new Date().toISOString() }
                  : msg
              )
            );
          })
          .finally(() => {
            isProcessingReadReceipt = false; 
          });
      }
    };
  
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [messages, selectedChat, currentUserId, sendReadReceipt]);

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
                  {chat.unread_count > 0 && (
                    <span className="unread-badge">{chat.unread_count}</span>
                  )}
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
              {messages.map((msg) => (
                <div
                  key={msg.id} 
                  ref={msg.id === messages[messages.length - 1].id ? lastMessageRef : null}
                  className={`chat-message ${+msg.sender_id === +currentUserId ? 'own-message' : ''}`}
                  data-message-id={msg.id}
                >
                  <div className="message-header">
                    <span className="sender-name">
                      {+msg.sender_id === +currentUserId ? 'Вы' : msg.username || `Пользователь #${msg.sender_id}`}
                    </span>
                    <span className="message-time">
                      {msg.sent_at ? new Date(msg.sent_at).toLocaleTimeString() : '...'}
                      {+msg.sender_id === +currentUserId && (
                        <span
                          className={`read-status ${msg.read_at ? 'read' : 'delivered'}`}
                          style={{ color: msg.read_at ? 'blue' : 'gray' }}
                        >
                          ✔✔
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="message-content">{msg.content}</div>
                </div>
              ))}
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
