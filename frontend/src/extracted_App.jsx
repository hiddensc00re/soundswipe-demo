import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : 'http://127.0.0.1:8000/api';
const MEDIA_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const getMediaUrl = (path) => {
  if (!path) return '';
  return path.startsWith('http') ? path : `${MEDIA_BASE}${path}`;
};

function App() {
  // Authentication & Session
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('soundswipe_user');
    return saved ? JSON.parse(saved) : null;
  });
  
  // UI Navigation
  const [currentTab, setCurrentTab] = useState('swipe'); // 'swipe', 'saved', 'chats', 'upload'
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  
  // Swipe Deck State
  const [deck, setDeck] = useState([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState(null); // 'left', 'right', or null
  
  // Feedback comment modal
  const [commentingTrack, setCommentingTrack] = useState(null);
  const [feedbackComment, setFeedbackComment] = useState('');
  
  // Mock Payment Flow
  const [showPayment, setShowPayment] = useState(false);
  const [paymentStep, setPaymentStep] = useState('checkout'); // 'checkout', 'processing', 'success'
  const [pendingFeedback, setPendingFeedback] = useState(null); // stores track_id and comment before payment
  
  // Audio Player State (Global instance)
  const [playingTrackId, setPlayingTrackId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);
  
  // Chat Room State
  const [rooms, setRooms] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsgContent, setNewMsgContent] = useState('');
  
  // Blockchain Ledger Overlay
  const [selectedMsgForBc, setSelectedMsgForBc] = useState(null);
  const [showBcModal, setShowBcModal] = useState(false);
  const [bcStatus, setBcStatus] = useState('idle'); // 'idle', 'signing', 'done'
  const [bcHash, setBcHash] = useState('');

  // Saved Tracks State
  const [savedTracks, setSavedTracks] = useState([]);
  
  // Auth Form Inputs
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [roleInput, setRoleInput] = useState('listener'); // 'listener' or 'creator'
  const [authError, setAuthError] = useState('');

  // Upload Form Inputs
  const [uploadTrackName, setUploadTrackName] = useState('');
  const [uploadArtistName, setUploadArtistName] = useState('');
  const [uploadTargetFeedback, setUploadTargetFeedback] = useState('');
  const [uploadMaxListeners, setUploadMaxListeners] = useState(5);
  const [uploadAudioFile, setUploadAudioFile] = useState(null);
  const [uploadCoverImage, setUploadCoverImage] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');

  // Contract Toggle State
  const [contractActive, setContractActive] = useState(false);

  // Headers helper
  const getHeaders = () => {
    const headers = { 'Content-Type': 'application/json' };
    if (user) {
      headers['X-User-ID'] = String(user.user_id);
    }
    return headers;
  };

  // 1. Fetch swipe deck on mount or user change
  useEffect(() => {
    if (user) {
      fetchDeck();
      fetchChats();
      fetchSavedTracks();
    } else {
      setDeck([]);
      setRooms([]);
      setSavedTracks([]);
    }
    // Stop playing audio
    setIsPlaying(false);
    setPlayingTrackId(null);
  }, [user]);

  // Audio update listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  // Poll active chat room messages
  useEffect(() => {
    if (!activeRoomId) return;
    fetchMessages(activeRoomId);
    const interval = setInterval(() => {
      fetchMessages(activeRoomId);
    }, 3000);
    return () => clearInterval(interval);
  }, [activeRoomId]);

  // API Call: Fetch Deck
  const fetchDeck = async () => {
    try {
      const res = await fetch(`${API_BASE}/deck/`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setDeck(data);
        setCurrentCardIndex(0);
      }
    } catch (err) {
      console.error('Error fetching deck', err);
    }
  };

  // API Call: Fetch Saved Tracks
  const fetchSavedTracks = async () => {
    try {
      const res = await fetch(`${API_BASE}/saved/`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSavedTracks(data);
      }
    } catch (err) {
      console.error('Error fetching saved tracks', err);
    }
  };

  // API Call: Fetch Private Chats
  const fetchChats = async () => {
    try {
      const res = await fetch(`${API_BASE}/chats/`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setRooms(data);
      }
    } catch (err) {
      console.error('Error fetching chats', err);
    }
  };

  // API Call: Fetch Messages in active room
  const fetchMessages = async (roomId) => {
    try {
      const res = await fetch(`${API_BASE}/chats/${roomId}/`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (err) {
      console.error('Error fetching messages', err);
    }
  };

  // Handle Authentication submit
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    const endpoint = authMode === 'login' ? 'login' : 'register';
    const body = authMode === 'login' 
      ? { username: usernameInput, password: passwordInput }
      : { username: usernameInput, password: passwordInput, role: roleInput };

    try {
      const res = await fetch(`${API_BASE}/${endpoint}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data);
        localStorage.setItem('soundswipe_user', JSON.stringify(data));
        setShowAuthModal(false);
        setUsernameInput('');
        setPasswordInput('');
      } else {
        setAuthError(data.error || 'Authentication failed');
      }
    } catch (err) {
      setAuthError('Connection error');
    }
  };

  // Handle Logout
  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('soundswipe_user');
    setCurrentTab('swipe');
    setActiveRoomId(null);
    setActiveRoom(null);
  };

  // Handle drag/swipe mechanics
  const handleDragStart = (e) => {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setDragStart({ x: clientX, y: clientY });
    setIsDragging(true);
  };

  const handleDragMove = (e) => {
    if (!isDragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const offsetX = clientX - dragStart.x;
    const offsetY = clientY - dragStart.y;
    setDragOffset({ x: offsetX, y: offsetY });

    if (offsetX > 80) setSwipeDirection('right');
    else if (offsetX < -80) setSwipeDirection('left');
    else setSwipeDirection(null);
  };

  const handleDragEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    const threshold = 120;
    if (dragOffset.x > threshold) {
      // Swipe Right (Trigger feedback comment)
      handleSwipeRightAction();
    } else if (dragOffset.x < -threshold) {
      // Swipe Left (Skip)
      handleSwipeLeftAction();
    } else {
      // Return to center
      setDragOffset({ x: 0, y: 0 });
      setSwipeDirection(null);
    }
  };

  const handleSwipeLeftAction = () => {
    // Left = Skip/Next
    setDragOffset({ x: -400, y: 0 });
    setTimeout(() => {
      nextCard();
      setDragOffset({ x: 0, y: 0 });
      setSwipeDirection(null);
    }, 200);
  };

  const handleSwipeRightAction = () => {
    // Right = Suggest Improvement (Opens comment input modal)
    if (!user) {
      setShowAuthModal(true);
      setDragOffset({ x: 0, y: 0 });
      setSwipeDirection(null);
      return;
    }
    const currentTrack = deck[currentCardIndex];
    setCommentingTrack(currentTrack);
    setDragOffset({ x: 0, y: 0 });
    setSwipeDirection(null);
  };

  const nextCard = () => {
    // If playing, pause audio
    setIsPlaying(false);
    setPlayingTrackId(null);
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setCurrentCardIndex((prev) => prev + 1);
  };

  // Submit Feedback & Mock Payment trigger
  const handleFeedbackSubmit = () => {
    if (!feedbackComment.trim()) return;
    
    // Save pending feedback and trigger payment modal
    setPendingFeedback({
      track_id: commentingTrack.id,
      comment: feedbackComment
    });
    setCommentingTrack(null);
    setFeedbackComment('');
    setPaymentStep('checkout');
    setShowPayment(true);
  };

  // Complete Payment Mock
  const processMockPayment = async () => {
    setPaymentStep('processing');
    
    // Simulate API delay
    setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/feedback/`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify(pendingFeedback)
        });
        
        if (res.ok) {
          const data = await res.json();
          setPaymentStep('success');
          // Refresh deck and chats
          fetchDeck();
          fetchChats();
        } else {
          alert('Failed to submit feedback API error');
          setShowPayment(false);
        }
      } catch (err) {
        console.error(err);
        alert('API error');
        setShowPayment(false);
      }
    }, 2000);
  };

  // Save Track Action
  const handleSaveTrack = async (trackId) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/saved/`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ track_id: trackId })
      });
      if (res.ok) {
        fetchSavedTracks();
        // Visual indicator (skip to next card or keep)
        alert('Track saved in preferences!');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Saved Track
  const handleDeleteSaved = async (trackId) => {
    try {
      const res = await fetch(`${API_BASE}/saved/`, {
        method: 'DELETE',
        headers: getHeaders(),
        body: JSON.stringify({ track_id: trackId })
      });
      if (res.ok) {
        fetchSavedTracks();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Play/Pause Audio
  const togglePlayAudio = (track) => {
    const audioUrl = getMediaUrl(track.audio_url);
    const audio = audioRef.current;
    
    if (playingTrackId === track.id) {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        audio.play();
        setIsPlaying(true);
      }
    } else {
      setPlayingTrackId(track.id);
      setIsPlaying(true);
      audio.src = audioUrl;
      audio.play().catch(e => {
        console.error("Audio playback blocked/failed:", e);
        setIsPlaying(false);
      });
    }
  };

  // Creator Upload Track Action
  const handleUploadTrack = async (e) => {
    e.preventDefault();
    if (!uploadTrackName || !uploadAudioFile) {
      setUploadStatus('Track name and audio file are required');
      return;
    }
    
    setUploadStatus('Uploading track...');
    const formData = new FormData();
    formData.append('track_name', uploadTrackName);
    formData.append('artist_name', uploadArtistName || user.username);
    formData.append('target_feedback', uploadTargetFeedback);
    formData.append('max_listeners', uploadMaxListeners);
    formData.append('audio_file', uploadAudioFile);
    if (uploadCoverImage) {
      formData.append('cover_image', uploadCoverImage);
    }

    try {
      const res = await fetch(`${API_BASE}/tracks/`, {
        method: 'POST',
        headers: {
          'X-User-ID': String(user.user_id)
        },
        body: formData
      });
      if (res.ok) {
        setUploadStatus('Track uploaded successfully! Visible to listeners.');
        setUploadTrackName('');
        setUploadArtistName('');
        setUploadTargetFeedback('');
        setUploadAudioFile(null);
        setUploadCoverImage(null);
        fetchDeck();
      } else {
        const errData = await res.json();
        setUploadStatus(errData.error || 'Upload failed');
      }
    } catch (err) {
      setUploadStatus('Network upload error');
    }
  };

  // Send message in active room
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMsgContent.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/chats/${activeRoomId}/`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ content: newMsgContent })
      });
      if (res.ok) {
        setNewMsgContent('');
        fetchMessages(activeRoomId);
        fetchChats();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Blockchain workflow
  const handleRequestBlockchain = async (msg) => {
    setSelectedMsgForBc(msg);
    setBcStatus('signing');
    setShowBcModal(true);
    
    try {
      const res = await fetch(`${API_BASE}/messages/${msg.id}/blockchain/`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ action: 'request' })
      });
      if (res.ok) {
        fetchMessages(activeRoomId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleApproveBlockchain = async (msg) => {
    setBcStatus('signing');
    try {
      const res = await fetch(`${API_BASE}/messages/${msg.id}/blockchain/`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ action: 'approve' })
      });
      if (res.ok) {
        const data = await res.json();
        setBcHash(data.blockchain_tx_hash);
        setBcStatus('done');
        fetchMessages(activeRoomId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Format timestamp helper
  const formatTime = (time) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const currentTrackInDeck = deck[currentCardIndex];

  return (
    <div className="app-container">
      {/* Invisible HTML5 Audio Tag */}
      <audio ref={audioRef} />

      {/* Header */}
      <header className="app-header">
        <div className="logo" onClick={() => setCurrentTab('swipe')}>SoundSwipe</div>
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className={`user-badge ${user.role}`}>
              {user.role === 'creator' ? 'Artist' : 'Listener'}: @{user.username}
            </div>
            <button 
              onClick={handleLogout} 
              style={{ background: 'none', border: 'none', color: '#ec4899', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              LOGOUT
            </button>
          </div>
        ) : (
          <button className="btn-pulse" style={{ padding: '6px 14px', fontSize: '12px' }} onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}>
            LOGIN
          </button>
        )}
      </header>

      {/* Main Content Area */}
      <main className="app-content">
        
        {/* VIEW 1: Tinder Deck Swiper */}
        {currentTab === 'swipe' && (
          <div className="swipe-deck-container">
            {currentTrackInDeck ? (
              <div className="card-container">
                <div 
                  className="swipe-card"
                  onMouseDown={handleDragStart}
                  onMouseMove={handleDragMove}
                  onMouseUp={handleDragEnd}
                  onMouseLeave={handleDragEnd}
                  onTouchStart={handleDragStart}
                  onTouchMove={handleDragMove}
                  onTouchEnd={handleDragEnd}
                  style={{
                    transform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0) rotate(${dragOffset.x * 0.04}deg)`,
                    boxShadow: swipeDirection === 'right' 
                      ? '0 0 30px hsl(var(--accent-purple) / 0.4)' 
                      : swipeDirection === 'left' 
                      ? '0 0 30px hsl(350 90% 60% / 0.4)' 
                      : '0 15px 30px rgba(0,0,0,0.5)'
                  }}
                >
                  {/* Card Cover Art */}
                  <div 
                    className="card-cover" 
                    style={{ backgroundImage: `url(${getMediaUrl(currentTrackInDeck.cover_url)})` }}
                  >
                    <div className="cover-overlay" />
                    <div className="card-meta">
                      <div className="track-title">{currentTrackInDeck.track_name}</div>
                      <div className="artist-name">by {currentTrackInDeck.artist_name}</div>
                    </div>
                  </div>

                  {/* Player & Details Area */}
                  <div className="card-details" onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
                    <div className="card-prompt">
                      <div className="prompt-title">What I need feedback on:</div>
                      {currentTrackInDeck.target_feedback || "No specific feedback instructions given. Just swipe right to comment and share your advice!"}
                    </div>

                    {/* Audio Player bar */}
                    <div className="audio-player">
                      <button className="play-btn" onClick={() => togglePlayAudio(currentTrackInDeck)}>
                        {playingTrackId === currentTrackInDeck.id && isPlaying ? '⏸' : '▶'}
                      </button>
                      <div className="visualizer">
                        {Array.from({ length: 18 }).map((_, i) => (
                          <div 
                            key={i} 
                            className={`bar ${playingTrackId === currentTrackInDeck.id && isPlaying ? 'active' : ''}`}
                            style={{
                              height: playingTrackId === currentTrackInDeck.id && isPlaying 
                                ? undefined 
                                : `${Math.max(10, Math.sin(i * 0.4) * 80 + 10)}%`
                            }}
                          />
                        ))}
                      </div>
                      <div className="time-stamp">
                        {playingTrackId === currentTrackInDeck.id 
                          ? `${formatTime(currentTime)}` 
                          : '0:00'}
                      </div>
                    </div>

                    {/* Swipe Controls inside card layout */}
                    <div className="swipe-actions">
                      <button className="action-btn dislike" title="Skip (Swipe Left)" onClick={handleSwipeLeftAction}>
                        ✖
                      </button>
                      <button className="action-btn star" title="Save Track" onClick={() => handleSaveTrack(currentTrackInDeck.id)}>
                        ⭐
                      </button>
                      <button className="action-btn comment" title="Suggest Help (Swipe Right)" onClick={handleSwipeRightAction}>
                        💬
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-deck">
                <div className="empty-icon">🎧</div>
                <h3>No Tracks Available</h3>
                <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '13px' }}>
                  {user 
                    ? "You've swiped on all the tracks! Check back later or upload your own song." 
                    : "Login to unlock personalized music swipes."}
                </p>
                {user?.role === 'creator' && (
                  <button className="btn-primary" style={{ width: 'auto', padding: '10px 20px' }} onClick={() => setCurrentTab('upload')}>
                    Upload a Track
                  </button>
                )}
                {!user && (
                  <button className="btn-pulse" onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}>
                    Log In
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: Preferences / Saved Tracks */}
        {currentTab === 'saved' && (
          <div className="saved-container">
            <h3 style={{ padding: '20px 20px 0', textAlign: 'left', fontSize: '18px', borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '12px' }}>
              Saved Tracks ({savedTracks.length})
            </h3>
            {savedTracks.length > 0 ? (
              <div className="saved-list">
                {savedTracks.map((item) => (
                  <div key={item.id} className="saved-item">
                    <div 
                      className="saved-img" 
                      style={{ backgroundImage: `url(${getMediaUrl(item.cover_url)})` }}
                    />
                    <div className="saved-meta">
                      <div className="saved-title">{item.track_name}</div>
                      <div className="saved-artist">{item.artist_name}</div>
                      <div style={{ fontSize: '10px', color: 'hsl(var(--accent-purple))', fontWeight: 'bold' }}>
                        Saved for feedback
                      </div>
                    </div>
                    <button className="btn-saved-play" onClick={() => togglePlayAudio(item)}>
                      {playingTrackId === item.id && isPlaying ? '⏸' : '▶'}
                    </button>
                    <button className="btn-saved-delete" onClick={() => handleDeleteSaved(item.id)}>
                      🗑
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'hsl(var(--text-secondary))' }}>
                <div style={{ fontSize: '32px', marginBottom: '10px' }}>⭐</div>
                <p>No saved tracks found. Use the star button on tracks to save them for later!</p>
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: Chat List & Chat Room Workspace */}
        {currentTab === 'chats' && (
          <div style={{ height: '100%' }}>
            {!activeRoomId ? (
              <div>
                <h3 style={{ padding: '20px 20px 0', textAlign: 'left', fontSize: '18px', borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '12px' }}>
                  Private Feedback Chats
                </h3>
                {rooms.length > 0 ? (
                  <div className="chat-list">
                    {rooms.map((room) => (
                      <div key={room.id} className="chat-item" onClick={() => { setActiveRoomId(room.id); setActiveRoom(room); }}>
                        <div className="chat-avatar">
                          {room.other_username.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="chat-info">
                          <div className="chat-room-title">{room.track_name}</div>
                          <div className="chat-artist">@{room.other_username} ({room.other_role === 'creator' ? 'Artist' : 'Listener'})</div>
                          <div className="chat-snippet">{room.last_message || "Chat started..."}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: 'hsl(var(--text-secondary))' }}>
                    <div style={{ fontSize: '32px', marginBottom: '10px' }}>💬</div>
                    <p>No active chats. Complete feedback on an artist's track to start a private chat room!</p>
                  </div>
                )}
              </div>
            ) : (
              /* Inside active private chat room */
              <div className="chat-workspace">
                <div className="chat-workspace-header">
                  <button className="btn-back" onClick={() => { setActiveRoomId(null); setActiveRoom(null); }}>
                    ←
                  </button>
                  <div>
                    <div className="chat-room-title">{activeRoom.track_name}</div>
                    <div style={{ fontSize: '11px', color: 'hsl(var(--text-secondary))' }}>
                      Chatting with <strong>@{activeRoom.other_username}</strong>
                    </div>
                  </div>
                </div>

                <div className="messages-area">
                  {messages.map((msg) => {
                    const isSentByMe = msg.sender_id === user.user_id;
                    return (
                      <div 
                        key={msg.id} 
                        className={`msg-bubble-container ${isSentByMe ? 'sent' : 'received'}`}
                      >
                        <div 
                          className="msg-bubble"
                          title="Click message to write to Blockchain"
                          onClick={() => {
                            if (isSentByMe && !msg.is_blockchain_pending && !msg.is_blockchain_written) {
                              handleRequestBlockchain(msg);
                            } else if (!isSentByMe && msg.is_blockchain_pending) {
                              // If received and other user requested consensus, I approve
                              handleApproveBlockchain(msg);
                            }
                          }}
                        >
                          {msg.content}
                          
                          {/* Blockchain consensus visual indicators */}
                          {msg.is_blockchain_pending && (
                            <div style={{ marginTop: '6px', textAlign: 'right' }}>
                              <span className="bc-badge pending">
                                🔗 Consent Requested
                              </span>
                            </div>
                          )}
                          {msg.is_blockchain_written && (
                            <div style={{ marginTop: '6px', textAlign: 'right' }}>
                              <span className="bc-badge signed">
                                🧬 Blockchain Ledger Written
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="msg-meta">
                          {msg.sender_username} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {msg.is_blockchain_written && (
                            <span style={{ color: 'hsl(var(--accent-cyan))', cursor: 'help' }} title={`Tx Hash: ${msg.blockchain_tx_hash}`}>
                              (Ledger Verified)
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <form className="chat-input-bar" onSubmit={handleSendMessage}>
                  <input 
                    type="text" 
                    className="chat-textbox"
                    placeholder="Type a suggestion or chat message..."
                    value={newMsgContent}
                    onChange={(e) => setNewMsgContent(e.target.value)}
                  />
                  <button type="submit" className="btn-send">
                    ✈
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* VIEW 4: Upload Track */}
        {currentTab === 'upload' && (
          <div className="upload-container">
            <h3 style={{ fontSize: '18px', borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '12px' }}>
              Upload Unfinished Track
            </h3>
            {user?.role === 'creator' ? (
              <form onSubmit={handleUploadTrack} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Track Name *</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. Midnight Melancholy (Synth Demo)"
                    value={uploadTrackName}
                    onChange={(e) => setUploadTrackName(e.target.value)}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Artist Name (Optional)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder={user.username}
                    value={uploadArtistName}
                    onChange={(e) => setUploadArtistName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">What feedback are you looking for? *</label>
                  <textarea 
                    className="form-input" 
                    style={{ height: '80px', resize: 'none' }}
                    placeholder="e.g. Is the vocal EQ too bright? How is the baseline structure?"
                    value={uploadTargetFeedback}
                    onChange={(e) => setUploadTargetFeedback(e.target.value)}
                    required
                  />
                </div>

                <div className="slider-group">
                  <div className="slider-header">
                    <span className="form-label">Max Random Listeners</span>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'hsl(var(--accent-purple))' }}>
                      {uploadMaxListeners} people
                    </span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="5" 
                    className="slider-input"
                    value={uploadMaxListeners}
                    onChange={(e) => setUploadMaxListeners(parseInt(e.target.value))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Audio Track File (.mp3, .wav) *</label>
                  <div className="file-dropzone" onClick={() => document.getElementById('audioFileSelector').click()}>
                    <div className="dropzone-icon">🎵</div>
                    <span style={{ fontSize: '12px' }}>Click to select audio file</span>
                    {uploadAudioFile && <div className="selected-file-name">{uploadAudioFile.name}</div>}
                  </div>
                  <input 
                    id="audioFileSelector" 
                    type="file" 
                    accept="audio/*" 
                    style={{ display: 'none' }} 
                    onChange={(e) => setUploadAudioFile(e.target.files[0])}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Cover Artwork Image</label>
                  <div className="file-dropzone" onClick={() => document.getElementById('coverFileSelector').click()}>
                    <div className="dropzone-icon">🎨</div>
                    <span style={{ fontSize: '12px' }}>Click to select artwork cover</span>
                    {uploadCoverImage && <div className="selected-file-name">{uploadCoverImage.name}</div>}
                  </div>
                  <input 
                    id="coverFileSelector" 
                    type="file" 
                    accept="image/*" 
                    style={{ display: 'none' }} 
                    onChange={(e) => setUploadCoverImage(e.target.files[0])}
                  />
                </div>

                {uploadStatus && (
                  <div style={{ fontSize: '12px', color: 'hsl(var(--accent-cyan))', fontWeight: '600', marginTop: '6px' }}>
                    {uploadStatus}
                  </div>
                )}

                <button type="submit" className="btn-primary">
                  Publish demo track
                </button>
              </form>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <p>Only Creators can upload tracks. Please register a Creator account to post your music demos.</p>
              </div>
            )}
          </div>
        )}

      </main>

      {/* BOTTOM NAVIGATION MENU */}
      <nav className="bottom-nav">
        
        {/* BUTTON 1: Contract Toggle */}
        <button 
          className={`nav-item ${contractActive ? 'active' : ''}`}
          onClick={() => setContractActive(!contractActive)}
        >
          <div className="nav-icon" style={{ color: contractActive ? 'hsl(45 100% 50%)' : undefined }}>
            {contractActive ? '⚡' : '📜'}
          </div>
          <span>Contract {contractActive ? 'Active' : 'Off'}</span>
        </button>

        {/* BUTTON 2: Login Modal Toggle */}
        <button 
          className="nav-item"
          onClick={() => {
            if (user) {
              // If logged in, show upload if creator, else saved tracks
              setCurrentTab(user.role === 'creator' ? 'upload' : 'saved');
            } else {
              setAuthMode('login');
              setShowAuthModal(true);
            }
          }}
        >
          <div className="nav-icon">👤</div>
          <span>{user ? 'Account' : 'Login'}</span>
        </button>

        {/* BUTTON 3: Preferences / Saved Songs */}
        <button 
          className={`nav-item ${currentTab === 'saved' ? 'active' : ''}`}
          onClick={() => {
            if (!user) setShowAuthModal(true);
            else setCurrentTab('saved');
          }}
        >
          <div className="nav-icon">⭐</div>
          <span>Preferences</span>
        </button>

        {/* BUTTON 4: Swipe Feed */}
        <button 
          className={`nav-item ${currentTab === 'swipe' ? 'active' : ''}`}
          onClick={() => setCurrentTab('swipe')}
        >
          <div className="nav-icon">🎧</div>
          <span>Swipe deck</span>
        </button>
      </nav>

      {/* MODAL 1: Authentication (Login / Signup) */}
      {showAuthModal && (
        <div className="modal-overlay" onClick={() => setShowAuthModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="btn-close" onClick={() => setShowAuthModal(false)}>✖</button>
            <h3 className="modal-title">
              {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
            </h3>
            
            <form onSubmit={handleAuthSubmit}>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={usernameInput} 
                  onChange={(e) => setUsernameInput(e.target.value)} 
                  required 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input 
                  type="password" 
                  className="form-input" 
                  value={passwordInput} 
                  onChange={(e) => setPasswordInput(e.target.value)} 
                  required 
                />
              </div>

              {authMode === 'register' && (
                <div className="form-group">
                  <label className="form-label">I want to...</label>
                  <div className="role-selector">
                    <button 
                      type="button" 
                      className={`role-btn ${roleInput === 'listener' ? 'active' : ''}`}
                      onClick={() => setRoleInput('listener')}
                    >
                      Listen & Help
                    </button>
                    <button 
                      type="button" 
                      className={`role-btn ${roleInput === 'creator' ? 'active' : ''}`}
                      onClick={() => setRoleInput('creator')}
                    >
                      Get Feedback
                    </button>
                  </div>
                </div>
              )}

              {authError && (
                <div style={{ color: 'hsl(350 90% 60%)', fontSize: '12px', marginBottom: '10px', textAlign: 'center' }}>
                  {authError}
                </div>
              )}

              <button type="submit" className="btn-primary">
                {authMode === 'login' ? 'Login' : 'Sign Up'}
              </button>
            </form>

            <div className="auth-toggle" onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>
              {authMode === 'login' ? (
                <>Don't have an account? <span>Sign Up</span></>
              ) : (
                <>Already have an account? <span>Log In</span></>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Swipe Comment Overlay */}
      {commentingTrack && (
        <div className="modal-overlay" onClick={() => setCommentingTrack(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="btn-close" onClick={() => setCommentingTrack(null)}>✖</button>
            <h3 style={{ fontSize: '18px', marginBottom: '16px', textTransform: 'uppercase', color: 'hsl(var(--accent-pink))' }}>
              Suggest Improvement
            </h3>
            <p style={{ fontSize: '11px', color: 'hsl(var(--text-secondary))', marginBottom: '12px' }}>
              Leaving feedback creates a private chat with <strong>{commentingTrack.artist_name}</strong>.
            </p>
            
            <div className="comment-overlay-container">
              <textarea 
                className="comment-textarea"
                placeholder="Suggest what the artist could do to improve... (e.g. Try panning the high-hats left, adjust the reverb size...)"
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
              />
              <button className="btn-primary" onClick={handleFeedbackSubmit}>
                Confirm feedback ($9.99)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Stripe Mock Payment screen */}
      {showPayment && (
        <div className="modal-overlay">
          <div className="modal-content payment-modal">
            {paymentStep === 'checkout' && (
              <>
                <div className="payment-header">
                  <div className="payment-badge">💳 Secure checkout</div>
                  <h3 style={{ fontSize: '20px', marginTop: '12px' }}>Unlock Feedback Delivery</h3>
                  <p style={{ fontSize: '12px', color: 'hsl(var(--text-secondary))', marginTop: '6px' }}>
                    Deliver your advice to complete the track.
                  </p>
                </div>
                
                <div style={{ fontSize: '24px', fontWeight: '800', textAlign: 'center', margin: '14px 0', color: 'white' }}>
                  $9.99
                </div>

                <div className="card-form">
                  <div className="form-group">
                    <label className="form-label">Cardholder Name</label>
                    <input type="text" className="form-input" placeholder="Sarah Ears" defaultValue="Sarah Ears" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Card Number</label>
                    <input type="text" className="form-input" placeholder="4242 4242 4242 4242" defaultValue="4242 4242 4242 4242" />
                  </div>
                  <div className="card-row">
                    <div>
                      <label className="form-label">Expiry</label>
                      <input type="text" className="form-input" placeholder="MM/YY" defaultValue="12/28" />
                    </div>
                    <div>
                      <label className="form-label">CVC</label>
                      <input type="text" className="form-input" placeholder="123" defaultValue="123" />
                    </div>
                    <div>
                      <label className="form-label">ZIP</label>
                      <input type="text" className="form-input" placeholder="90210" defaultValue="94103" />
                    </div>
                  </div>
                </div>

                <button className="btn-primary pay-btn" onClick={processMockPayment}>
                  Authorize Payment
                </button>
                <button 
                  className="auth-toggle" 
                  style={{ display: 'block', margin: '12px auto 0' }}
                  onClick={() => setShowPayment(false)}
                >
                  Cancel
                </button>
              </>
            )}

            {paymentStep === 'processing' && (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div className="empty-icon" style={{ animation: 'glowPulse 1s infinite' }}>🔒</div>
                <h4 style={{ marginTop: '16px' }}>Processing Payment...</h4>
                <p style={{ fontSize: '12px', color: 'hsl(var(--text-secondary))', marginTop: '6px' }}>
                  Validating sandbox credit card details via mock Stripe gateway.
                </p>
              </div>
            )}

            {paymentStep === 'success' && (
              <div className="success-visual">
                <div className="success-check">✓</div>
                <h3>Payment Approved!</h3>
                <p style={{ fontSize: '13px', color: 'hsl(var(--text-secondary))' }}>
                  Your comments have been delivered. A private chat room has been opened with the artist.
                </p>
                <button className="btn-primary" onClick={() => { setShowPayment(false); setCurrentTab('chats'); }}>
                  Enter Private Chat
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 4: Blockchain consensus visualizer */}
      {showBcModal && (
        <div className="modal-overlay" onClick={() => setShowBcModal(false)}>
          <div className="modal-content bc-modal" onClick={(e) => e.stopPropagation()}>
            <button className="btn-close" onClick={() => setShowBcModal(false)}>✖</button>
            <h3 style={{ fontSize: '18px', color: 'hsl(var(--accent-cyan))', marginBottom: '12px' }}>
              🧬 Blockchain Consensus Ledger
            </h3>
            
            {bcStatus === 'signing' && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div className="empty-icon" style={{ animation: 'float 2s infinite' }}>🔗</div>
                <h4>Signing Cryptographic Block...</h4>
                <p style={{ fontSize: '12px', color: 'hsl(var(--text-secondary))', marginTop: '6px' }}>
                  Waiting for dual authorization protocol signature.
                </p>
              </div>
            )}

            {bcStatus === 'done' && (
              <div>
                <p style={{ fontSize: '13px', color: 'hsl(var(--text-secondary))', marginBottom: '14px' }}>
                  Both users have signed the transaction. The message content is now written to the ledger block.
                </p>

                <div className="bc-ledger">
                  <div className="bc-line"><span className="bc-highlight">BLOCK #:</span> 1488523</div>
                  <div className="bc-line"><span className="bc-highlight">SIGNER A (Listener):</span> @{activeRoom.listener === user?.username ? user?.username : activeRoom.other_username}</div>
                  <div className="bc-line"><span className="bc-highlight">SIGNER B (Artist):</span> @{activeRoom.uploader === user?.username ? user?.username : activeRoom.other_username}</div>
                  <div className="bc-line"><span className="bc-highlight">MESSAGE DATA:</span> "{selectedMsgForBc?.content}"</div>
                  <div className="bc-line" style={{ marginTop: '12px' }}><span className="bc-highlight">TRANSACTION HASH:</span></div>
                  <div className="bc-line" style={{ color: 'hsl(var(--accent-emerald))', fontSize: '9px' }}>{bcHash}</div>
                </div>

                <button className="btn-primary" onClick={() => setShowBcModal(false)}>
                  Close Ledger
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
