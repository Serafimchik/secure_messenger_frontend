import { useEffect, useState, useRef, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';
import { decryptAESMessage, importAESKey, base64ToArrayBuffer } from '../utils/cryptoUtils';
import { loadPrivateKey } from '../utils/indexedDB';
import '../styles/chatsScreen.css';
import GroupChatParticipants from './GroupChatParticipants';
import CreateChatModal from './CreateChatModal';
import ChannelSearch from './ChannelSearch';
import '../styles/channelSearch.css';

function ChatsScreen({ onLogout }) {
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatError, setChatError] = useState('');
  const [loading, setLoading] = useState(true);
  const socketRef = useRef(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const lastMessageRef = useRef(null);
  const selectedChatRef = useRef(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);

  const currentUserIdRef = useRef(null);
  const aesKeysCache = useRef(new Map());

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

  const fetchChats = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch("/api/chats", {
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

  const fetchMessages = async (chatId, limit = 20) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/chats/${chatId}?limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const sortedMessages = [...data.messages].sort((a, b) => new Date(a.sent_at) - new Date(b.sent_at));

      let aesKey = aesKeysCache.current.get(chatId);
      if (!aesKey) {
        const chat = chats.find(c => c.id === chatId);
        const encryptedKeyBase64 = chat?.encrypted_chat_key;
        if (!encryptedKeyBase64) throw new Error('Отсутствует зашифрованный AES ключ');
        const encryptedKey = base64ToArrayBuffer(encryptedKeyBase64);
        const privateKey = await loadPrivateKey();
        const rawKey = await window.crypto.subtle.decrypt({ name: "RSA-OAEP" }, privateKey, encryptedKey);
        aesKey = await importAESKey(rawKey);
        aesKeysCache.current.set(chatId, aesKey);
      }

      const decryptedMessages = await Promise.all(
        sortedMessages.map(async (msg) => {
          try {
            const content = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
            msg.content = await decryptAESMessage(content, aesKey);
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

  const updateParticipants = async (chatId) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/chats/${chatId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const updatedChat = await res.json();
  
      const hasCurrentUser = updatedChat.participants.some(
        (p) => p.id === currentUserIdRef.current
      );
  
      if (!hasCurrentUser) {
        updatedChat.participants.push({
          id: currentUserIdRef.current,
          username: 'Вы',
          email: '', 
        });
      }
  
      setSelectedChat(prev => ({
        ...prev,
        participants: updatedChat.participants
      }));
      
    } catch (e) {
      console.warn('Не удалось обновить список участников:', e);
    }
  };
  
  const connectWebSocket = useCallback(() => {
    const token = localStorage.getItem('token');
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.host;
    const ws = new WebSocket(`${protocol}://${host}/ws?token=${encodeURIComponent(token)}`);
  
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
          let aesKey = aesKeysCache.current.get(data.chat_id);
          if (!aesKey) {
            const chat = chats.find(c => c.id === data.chat_id);
            const encryptedKeyBase64 = chat?.encrypted_chat_key;
            if (!encryptedKeyBase64) throw new Error('Нет зашифрованного AES ключа');
            const encryptedKey = base64ToArrayBuffer(encryptedKeyBase64);
            const privateKey = await loadPrivateKey();
            const rawKey = await window.crypto.subtle.decrypt({ name: "RSA-OAEP" }, privateKey, encryptedKey);
            aesKey = await importAESKey(rawKey);
            aesKeysCache.current.set(data.chat_id, aesKey);
          }
      
          const content = typeof data.content === 'string' ? JSON.parse(data.content) : data.content;
          data.content = await decryptAESMessage(content, aesKey);
          
        } catch (e) {
          console.warn('Ошибка расшифровки входящего сообщения:', e);
          data.content = '[Ошибка расшифровки]';
        }
      
        if (+data.chat_id === +currentChatId) {
          setMessages(prev => [...prev, data]);
      
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

      if (message.event === 'participant_added' || message.event === 'participant_removed') {
        const chatId = message.data?.chat_id;      
        if (selectedChatRef.current?.id === chatId) {
          updateParticipants(chatId);
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
    if (lastMessageRef.current) {
      lastMessageRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleCreateChat = async ({ type, emails, name }) => {
    const allValid = emails.every(email =>
      email.match(/^[^@\s]+@[^@\s]+\.[^@\s]+$/)
    );
    if (!allValid) {
      setChatError('Введите корректные email-адреса');
      return;
    }
    const token = localStorage.getItem('token');
    const allEmails = [...new Set([...emails])];
    try {
      const response = await fetch('/api/users/public-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ emails: allEmails }),
      });
      const data = await response.json();
      const publicKeys = data.keys;
      const aesKey = await window.crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
      );
      const exportedAES = await window.crypto.subtle.exportKey("raw", aesKey);
      const exportedAESBase64 = btoa(String.fromCharCode(...new Uint8Array(exportedAES)));
      const encryptedKeys = await Promise.all(
        publicKeys.map(async ({ email, public_key }) => {
          const jwk = JSON.parse(atob(public_key));
          const importedKey = await window.crypto.subtle.importKey(
            "jwk",
            jwk,
            { name: "RSA-OAEP", hash: "SHA-256" },
            true,
            ["encrypt"]
          );
          const encryptedKey = await window.crypto.subtle.encrypt(
            { name: "RSA-OAEP" },
            importedKey,
            exportedAES
          );
          return {
            email,
            encrypted_key: btoa(String.fromCharCode(...new Uint8Array(encryptedKey)))
          };
        })
      );
  
      const chatContent = {
        type,
        name: (type === 'group' || type === 'channel') ? name : undefined,
        recipient_email: type === 'direct' ? emails[0] : undefined,
        emails: (type === 'group' || type === 'channel') ? emails : undefined,
        encrypted_keys: encryptedKeys,
      };
  
      if (type === 'channel') {
        chatContent.raw_aes_key = exportedAESBase64;
      }
  
      const payload = {
        event: 'create_chat',
        chat_id: 0,
        content: JSON.stringify(chatContent),
      };
  
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify(payload));
        console.log('Отправка через WebSocket:', {
          event: 'create_chat',
          chat_id: 0,
          content: JSON.stringify(chatContent),
        });
      } else {
        console.warn('WebSocket ещё не подключен — создание отменено');
      }
  
      setIsModalOpen(false);
    } catch (error) {
      console.error('Ошибка при создании чата/канала:', error);
      setChatError('Не удалось создать. Попробуйте позже.');
    }
  };  
     
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChat) return;
    try {
      let aesKey = aesKeysCache.current.get(selectedChat.id);
      if (!aesKey) {
        const chat = chats.find(c => c.id === selectedChat.id);
        const encryptedKeyBase64 = chat?.encrypted_chat_key;
        if (!encryptedKeyBase64) {
          console.warn('Зашифрованный AES ключ не найден');
          return;
        }
        const encryptedKey = base64ToArrayBuffer(encryptedKeyBase64);
        const privateKey = await loadPrivateKey();
        const rawKey = await window.crypto.subtle.decrypt({ name: "RSA-OAEP" }, privateKey, encryptedKey);
        aesKey = await importAESKey(rawKey);
        aesKeysCache.current.set(selectedChat.id, aesKey);
      }
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const encodedMessage = new TextEncoder().encode(newMessage);
      const ciphertext = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        encodedMessage
      );
      const encryptedContent = JSON.stringify({
        iv: btoa(String.fromCharCode(...iv)),
        ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext)))
      });
      if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
        console.warn('WebSocket не подключен');
        return;
      }
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

  const handleAddParticipant = async (email) => {
    if (!selectedChat) return;
  
    const token = localStorage.getItem('token');
    try {
      let aesKey = aesKeysCache.current.get(selectedChat.id);
      if (!aesKey) {
        const chat = chats.find(c => c.id === selectedChat.id);
        const encryptedKeyBase64 = chat?.encrypted_chat_key;
        if (!encryptedKeyBase64) throw new Error('Зашифрованный AES-ключ не найден');
        const encryptedKey = base64ToArrayBuffer(encryptedKeyBase64);
        const privateKey = await loadPrivateKey();
        const rawKey = await window.crypto.subtle.decrypt(
          { name: "RSA-OAEP" },
          privateKey,
          encryptedKey
        );
        aesKey = await importAESKey(rawKey);
        aesKeysCache.current.set(selectedChat.id, aesKey);
      }
      const exportedAES = await window.crypto.subtle.exportKey("raw", aesKey);
      const resKeys = await fetch('/api/users/public-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ emails: [email] }),
      });
      if (!resKeys.ok) throw new Error('Не удалось получить публичный ключ пользователя');
      const { keys } = await resKeys.json();
      const userKeyObj = keys.find(k => k.email === email);
      if (!userKeyObj) throw new Error('Публичный ключ пользователя не найден');
      const jwk = JSON.parse(atob(userKeyObj.public_key));
      const importedPubKey = await window.crypto.subtle.importKey(
        'jwk',
        jwk,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        true,
        ['encrypt']
      );
  
      const encryptedAESKey = await window.crypto.subtle.encrypt(
        { name: 'RSA-OAEP' },
        importedPubKey,
        exportedAES
      );
      const encrypted_key = btoa(String.fromCharCode(...new Uint8Array(encryptedAESKey)));

      const res = await fetch(`/api/chats/${selectedChat.id}/participants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email, encrypted_key }),
      });
  
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Ошибка при добавлении участника');
      }
  
    } catch (err) {
      console.error('Ошибка при добавлении участника:', err.message);
    }
  };
  
  const handleRemoveParticipant = async (userId) => {
    if (!selectedChat) return;
  
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/chats/${selectedChat.id}/participants`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ user_id: userId }),
      });
      
  
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Ошибка при удалении участника');
      }

    } catch (err) {
      console.error('Ошибка при удалении участника:', err.message);
    }
  };
  
  const handleJoinChannel = async (channelId) => {
    try {
      const res = await fetch(`/api/channels/${channelId}/join`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
  
      if (res.ok) {
        const updatedChat = await res.json();
        setChats((prev) => [...prev, updatedChat]);
      } else {
        console.error('Не удалось подписаться на канал');
      }
    } catch (err) {
      console.error('Ошибка при подписке на канал:', err);
    }
  }; 

  const isChannel = selectedChat?.type === 'channel';
  const isChannelOwner = selectedChat?.created_by === currentUserId; 
  const canSendMessages = !isChannel || isChannelOwner;

  const leaveChannel = async (chatId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/channels/${chatId}/leave`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
  
      if (!res.ok) {
        throw new Error('Не удалось отписаться от канала');
      }
      setChats(prev => prev.filter(c => c.id !== chatId));
      setSelectedChat(null);
      setMessages([]);
    } catch (error) {
      console.error('Ошибка при отписке от канала:', error);
      alert('Ошибка при отписке от канала');
    }
  };
  
  return (
    <div className="chat-screen">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>Мои чаты</h2>
          <button onClick={onLogout} className="logout-btn">Выйти</button>
        </div>
        <div className="new-chat-form">
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn green w-full"
          >
            Создать чат/канал
          </button>
        </div>
        <ChannelSearch onJoin={handleJoinChannel} />
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
                onClick={() => {
                  selectChat(chat);
                  setShowParticipants(false); 
                }}
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
              <div className="chat-title">
                <h3>{selectedChat.name || `Чат #${selectedChat.id}`}</h3>
                {selectedChat.type === 'group' && (
                  <button
                    onClick={() => setShowParticipants((prev) => !prev)}
                    className="participants-toggle-btn"
                    title="Участники чата"
                  >
                    👥
                  </button>
                )}
                {selectedChat?.type === 'channel' && (
                  <button onClick={() => leaveChannel(selectedChat.id)} className="leave-button">
                    Отписаться
                  </button>
                )}
              </div>
              {selectedChat.type === 'group' && showParticipants && (
                <GroupChatParticipants
                  participants={selectedChat?.participants || []}
                  currentUserId={currentUserId}
                  onAdd={handleAddParticipant}
                  onRemove={handleRemoveParticipant}
                />
              )}
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
            {canSendMessages && (
              <div className="chat-input">
                <input
                  type="text"
                  placeholder="Введите сообщение..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <button onClick={handleSendMessage}>Отправить</button>
              </div>
            )}
          </div>
        )}
      </section>
      <CreateChatModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreateChat}
      />
    </div>
  );  
}

export default ChatsScreen;