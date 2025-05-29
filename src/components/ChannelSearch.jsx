import React, { useState } from 'react';

const ChannelSearch = ({ onJoin }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!query.trim()) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/channels/search?query=${encodeURIComponent(query)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Ошибка при поиске каналов');
      const data = await res.json();
      setResults(data);
    } catch (err) {
      console.error(err);
      setError('Ошибка при поиске каналов');
    }
  };

  return (
    <div className="channel-search">
      <div className="search-bar">
        <input
          type="text"
          value={query}
          placeholder="🔍 Найти канал по названию"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button onClick={handleSearch}>Поиск</button>
      </div>

      {error && <div className="error">{error}</div>}

      {results.length > 0 && (
        <ul className="results">
          {results.map((channel) => (
            <li key={channel.id}>
              <div className="channel-info">
                <strong>{channel.name}</strong>
                <small>ID: {channel.id}</small>
              </div>
              <button onClick={() => onJoin(channel.id)}>Присоединиться</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ChannelSearch;
