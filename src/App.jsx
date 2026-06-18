import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  Send,
  Zap,
  RefreshCw,
  Trash2,
  HelpCircle,
  Activity,
  Wifi,
  Globe,
  Terminal,
  Copy,
  Check,
  Database,
  Sliders,
  MessageSquare,
  FileText,
  Download
} from 'lucide-react';
import './App.css';

// Predefined gaming moods
const GAMING_MOODS = [
  { id: 'neutral', name: 'Standard 😐', desc: 'Réagit normalement aux événements.' },
  { id: 'hype', name: 'Enthousiaste 🔥', desc: 'Célèbre les belles actions, écrit en majuscules.' },
  { id: 'salty', name: 'Rageux / Salé 🧂', desc: 'Râle après les morts, blame le jeu ou la chance.' },
  { id: 'troll', name: 'Taquin / Troll 😜', desc: 'Rigole gentiment des fails du streamer.' },
  { id: 'backseat', name: 'Backseater 🧠', desc: 'Donne des conseils tactiques (AWP, buy, bomb).' },
  { id: 'analytic', name: 'Analyste 📋', desc: 'Commente la stratégie et l\'économie.' }
];

const GAME_PRESETS = [
  "Counter-Strike",
  "Valorant",
  "League of Legends",
  "GTA V",
  "Just Chatting",
  "Apex Legends",
  "Minecraft"
];

const MESSAGE_SIZES = [
  { id: 'short', name: 'Court ⚡', desc: '10 à 40 car.' },
  { id: 'medium', name: 'Moyen 💬', desc: '40 à 80 car.' },
  { id: 'long', name: 'Long 📝', desc: '80 à 160 car.' },
  { id: 'mixed', name: 'Aléatoire 🎲', desc: 'Mélange les tailles' }
];

const LANGUAGE_OPTIONS = [
  { id: 'French', name: 'Français 🇫🇷' },
  { id: 'Algerian_Darija', name: 'Daridja (Latin) 🇩🇿' },
  { id: 'Algerian_Darija_Arabic', name: 'Daridja (Arabe) 🇩🇿' },
  { id: 'English', name: 'Anglais 🇺🇸' },
  { id: 'Spanish', name: 'Espagnol 🇪🇸' },
  { id: 'German', name: 'Allemand 🇩🇪' },
  { id: 'Italian', name: 'Italien 🇮🇹' },
  { id: 'Portuguese', name: 'Portugais 🇵🇹' }
];

function App() {
  const DEFAULT_CONFIG = {
    kickChannel: 'my_kick_stream',
    aiProvider: 'gemini',
    aiApiKey: '',
    aiModel: 'gemini-2.5-flash',
    botLanguage: 'French',
    botLanguages: ['French', 'Algerian_Darija', 'Algerian_Darija_Arabic'],
    botMood: 'neutral',
    currentGame: 'Counter-Strike',
    messageSize: 'mixed',
    customPrompt: 'Tu es un spectateur actif sur un stream Kick. Écris un court message de chat réaliste, spontané et dynamique par rapport au stream. Utilise du vocabulaire de gamer, des abréviations (gg, wtf, mdr, ptdr, jpp), parfois des fautes d\'orthographe volontaires ou des émojis. Le message doit être très court. Ne mentionne jamais que tu es un bot ou une IA.',
    supabaseUrl: '',
    supabaseKey: '',
    friends: [],
    streamerConfigSpecs: '',
    channelInfo: ''
  };

  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem('kick_chat_ai_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_CONFIG, ...parsed };
      } catch (e) {
        return DEFAULT_CONFIG;
      }
    }
    return DEFAULT_CONFIG;
  });

  const [batchCount, setBatchCount] = useState(10);
  const [currentBatch, setCurrentBatch] = useState([]);
  const [isGeneratingBatch, setIsGeneratingBatch] = useState(false);
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('streamer'); // Default to streamer tab
  const [isConnected, setIsConnected] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [friendInput, setFriendInput] = useState('');

  const terminalEndRef = useRef(null);
  const eventSourceRef = useRef(null);

  // Initialize and load configurations and logs
  useEffect(() => {
    fetchConfig();
    addLocalLog('info', 'Console d\'activité prête. Toutes les actions seront enregistrées ici.');
  }, []);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollTop = terminalEndRef.current.scrollHeight;
    }
  }, [logs]);

  // Setup Server-Sent Events for logs
  const setupSSE = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource('/api/logs');
    eventSourceRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
      addLocalLog('info', 'Connecté au serveur de logs SSE.');
    };

    es.onerror = () => {
      setIsConnected(false);
      addLocalLog('error', 'Erreur de connexion SSE. Tentative de reconnexion...');
    };

    es.onmessage = (event) => {
      const logData = JSON.parse(event.data);
      setLogs((prev) => [...prev, logData]);
    };
  };

  const addLocalLog = (level, text) => {
    const log = {
      timestamp: new Date().toISOString(),
      level,
      text,
      details: ''
    };
    setLogs((prev) => [...prev, log]);
  };

  const fetchConfig = async () => {
    const saved = localStorage.getItem('kick_chat_ai_config');
    if (!saved) {
      try {
        const response = await fetch('/api/config');
        if (response.ok) {
          const data = await response.json();
          // Merge with DEFAULT_CONFIG template
          const merged = { ...DEFAULT_CONFIG, ...data };
          setConfig(merged);
          localStorage.setItem('kick_chat_ai_config', JSON.stringify(merged));
          addLocalLog('info', 'Configuration par défaut chargée depuis le serveur.');
        }
      } catch (error) {
        addLocalLog('error', 'Impossible de charger la configuration par défaut du serveur.');
      }
    } else {
      addLocalLog('info', 'Configuration chargée depuis la mémoire locale de votre navigateur.');
    }
  };

  const handleSaveConfig = (updatedConfig = config) => {
    try {
      localStorage.setItem('kick_chat_ai_config', JSON.stringify(updatedConfig));
      setConfig(updatedConfig);
      addLocalLog('success', 'Configuration sauvegardée localement dans votre navigateur.');
    } catch (error) {
      addLocalLog('error', 'Échec de la sauvegarde de la configuration locale.');
    }
  };

  const handleAddFriend = (e) => {
    e.preventDefault();
    if (!friendInput.trim()) return;
    const currentFriends = config.friends || [];
    if (currentFriends.includes(friendInput.trim())) {
      setFriendInput('');
      return;
    }
    const newFriends = [...currentFriends, friendInput.trim()];
    const newConfig = { ...config, friends: newFriends };
    setConfig(newConfig);
    handleSaveConfig(newConfig);
    setFriendInput('');
    addLocalLog('info', `Ami ajouté : ${friendInput.trim()}`);
  };

  const handleGenerateBatch = async () => {
    if (!config.aiApiKey) {
      addLocalLog('error', 'Génération impossible : Veuillez configurer votre clé API Gemini.');
      alert('Veuillez d\'abord renseigner votre clé API Gemini dans l\'onglet de configuration.');
      return;
    }

    setIsGeneratingBatch(true);
    setCurrentBatch([]); // Clear current list at startup

    const totalCount = batchCount;
    const chunkSize = 100;
    const numChunks = Math.ceil(totalCount / chunkSize);
    let accumulatedMessages = [];
    
    addLocalLog('info', `Lancement de la génération globale de ${totalCount} messages (en ${numChunks} vagues de max ${chunkSize} messages)...`);

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    try {
      for (let i = 0; i < numChunks; i++) {
        // Calculate size of this chunk
        const currentChunkCount = Math.min(chunkSize, totalCount - (i * chunkSize));
        
        // Pacing delay to avoid rate limit (5 RPM = 1 request every 12 seconds)
        if (i > 0) {
          const delaySec = 12;
          addLocalLog('info', `Pacing : Attente de ${delaySec} secondes avant le lot ${i + 1}/${numChunks} pour respecter le quota de 5 requêtes/min de votre clé API de niveau gratuit...`);
          for (let sec = delaySec; sec > 0; sec--) {
            await sleep(1000);
          }
        }
        
        addLocalLog('info', `Génération du lot ${i + 1}/${numChunks} (${currentChunkCount} messages)...`);
        
        const response = await fetch('/api/generate-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ count: currentChunkCount, config })
        });
        
        if (response.ok) {
          const data = await response.json();
          accumulatedMessages = [...accumulatedMessages, ...data.messages];
          setCurrentBatch(accumulatedMessages);
          addLocalLog('success', `Lot ${i + 1}/${numChunks} généré avec succès ! Total accumulé : ${accumulatedMessages.length}/${totalCount}`);
        } else {
          const err = await response.json();
          addLocalLog('error', `Erreur de génération au lot ${i + 1}/${numChunks} : ${err.error}`);
          break; // Stop loop on error
        }
      }
      
      if (accumulatedMessages.length > 0) {
        addLocalLog('success', `Génération terminée ! ${accumulatedMessages.length} messages sont prêts.`);
      }
    } catch (error) {
      addLocalLog('error', 'Erreur réseau lors de la génération.');
    } finally {
      setIsGeneratingBatch(false);
    }
  };

  const handleCopySingle = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
    addLocalLog('info', `Message copié : "${text.substring(0, 20)}..."`);
  };

  const handleCopyAll = () => {
    if (currentBatch.length === 0) return;
    const content = currentBatch.join('\n');
    navigator.clipboard.writeText(content);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
    addLocalLog('success', 'Toute la liste a été copiée dans le presse-papier.');
  };

  const handleExportTxt = () => {
    if (currentBatch.length === 0) return;
    const content = currentBatch.join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `messages_kick_${config.currentGame.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addLocalLog('success', 'Fichier .txt exporté avec succès !');
  };

  const handleClearBatch = () => {
    setCurrentBatch([]);
    addLocalLog('info', 'Liste des messages effacée.');
  };

  // Helper to format timestamps
  const formatTime = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  return (
    <div className="app-container">
      {/* App Header */}
      <header className="app-header">
        <div className="logo-container">
          <div className="logo-icon">K</div>
          <div className="logo-text">
            <h1>KICK Chat AI Batch Generator</h1>
            <p>Générez des lots de messages réalistes prêts à être copiés ou exportés</p>
          </div>
        </div>

        <div className="header-status">
          <span className={`status-badge ${isConnected ? 'active' : 'inactive'}`} style={{ fontSize: '12px' }}>
            <Wifi size={14} style={{ marginRight: '6px' }} />
            Connexion Serveur : {isConnected ? 'Actif' : 'Hors ligne'}
          </span>
        </div>
      </header>

      {/* Quick Stats Grid */}
      <div className="status-cards-row">
        <div className="status-card highlighted">
          <div className="status-card-icon">
            <MessageSquare size={18} />
          </div>
          <div className="status-card-details">
            <span className="status-card-label">Jeu configuré</span>
            <span className="status-card-value">{config.currentGame || 'Non spécifié'}</span>
          </div>
        </div>

        <div className="status-card">
          <div className="status-card-icon">
            <Activity size={18} />
          </div>
          <div className="status-card-details">
            <span className="status-card-label">Humeur Active</span>
            <span className="status-card-value">
              {GAMING_MOODS.find(m => m.id === config.botMood)?.name || config.botMood}
            </span>
          </div>
        </div>

        <div className="status-card">
          <div className="status-card-icon">
            <Zap size={18} />
          </div>
          <div className="status-card-details">
            <span className="status-card-label">Taille demandée</span>
            <span className="status-card-value">
              {MESSAGE_SIZES.find(s => s.id === config.messageSize)?.name || config.messageSize}
            </span>
          </div>
        </div>

        <div className="status-card">
          <div className="status-card-icon">
            <Globe size={18} />
          </div>
          <div className="status-card-details">
            <span className="status-card-label">Langues cochées</span>
            <span className="status-card-value">
              {config.botLanguages ? config.botLanguages.length : 1}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="dashboard-grid">
        
        {/* Left Side - Configuration Panels */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">
              <Settings size={18} /> Paramètres de génération
            </span>
          </div>

          <div className="panel-body">
            {/* Tabs */}
            {/* Tabs */}
            <div className="tabs">
              <button
                className={`tab ${activeTab === 'streamer' ? 'active' : ''}`}
                onClick={() => setActiveTab('streamer')}
              >
                <Globe size={14} style={{ marginRight: '6px', display: 'inline' }} />
                Profil Streamer
              </button>
              <button
                className={`tab ${activeTab === 'game' ? 'active' : ''}`}
                onClick={() => setActiveTab('game')}
              >
                <Sliders size={14} style={{ marginRight: '6px', display: 'inline' }} />
                Amis & Jeu
              </button>
              <button
                className={`tab ${activeTab === 'prompt' ? 'active' : ''}`}
                onClick={() => setActiveTab('prompt')}
              >
                <MessageSquare size={14} style={{ marginRight: '6px', display: 'inline' }} />
                Prompt & Clé API
              </button>
              <button
                className={`tab ${activeTab === 'supabase' ? 'active' : ''}`}
                onClick={() => setActiveTab('supabase')}
              >
                <Database size={14} style={{ marginRight: '6px', display: 'inline' }} />
                Supabase / Cloud
              </button>
            </div>

            {/* Tab Contents */}
            {activeTab === 'streamer' && (
              <div className="tab-content">
                <div className="form-group">
                  <label>Nom de votre chaîne Kick</label>
                  <input
                    type="text"
                    value={config.kickChannel || ''}
                    onChange={(e) => setConfig({ ...config, kickChannel: e.target.value })}
                    onBlur={() => handleSaveConfig()}
                    placeholder="mon_stream_kick"
                  />
                  <span className="label-hint">Ce nom sera utilisé pour simuler les messages qui vous sont adressés.</span>
                </div>

                <div className="form-group">
                  <label>Configuration PC (Specs / Composants)</label>
                  <textarea
                    rows={3}
                    value={config.streamerConfigSpecs || ''}
                    onChange={(e) => setConfig({ ...config, streamerConfigSpecs: e.target.value })}
                    onBlur={() => handleSaveConfig()}
                    placeholder="GPU: RTX 4070, CPU: Intel i7, RAM: 32Go, Clavier: optique..."
                  />
                  <span className="label-hint">L'IA s'en servira pour générer des questions réalistes des viewers sur votre matériel.</span>
                </div>

                <div className="form-group">
                  <label>Infos sur la chaîne / Planning</label>
                  <textarea
                    rows={3}
                    value={config.channelInfo || ''}
                    onChange={(e) => setConfig({ ...config, channelInfo: e.target.value })}
                    onBlur={() => handleSaveConfig()}
                    placeholder="Stream tous les soirs à 21h, orienté Counter-Strike compétitif..."
                  />
                  <span className="label-hint">L'IA pourra simuler des questions sur vos prochains lives ou votre planning.</span>
                </div>
              </div>
            )}

            {activeTab === 'game' && (
              <div className="tab-content">
                <div className="form-row double">
                  <div className="form-group">
                    <label>Jeu en cours de stream</label>
                    <select
                      value={config.currentGame}
                      onChange={(e) => {
                        const newConfig = { ...config, currentGame: e.target.value };
                        setConfig(newConfig);
                        handleSaveConfig(newConfig);
                      }}
                    >
                      {GAME_PRESETS.map((game) => (
                        <option key={game} value={game}>{game}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Jeu personnalisé (si non listé)</label>
                    <input
                      type="text"
                      value={config.currentGame || ''}
                      onChange={(e) => {
                        const newConfig = { ...config, currentGame: e.target.value };
                        setConfig(newConfig);
                      }}
                      onBlur={() => handleSaveConfig()}
                      placeholder="Nom du jeu..."
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Amis avec qui vous jouez (Vannes IA)</label>
                  <form onSubmit={handleAddFriend} style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={friendInput}
                      onChange={(e) => setFriendInput(e.target.value)}
                      placeholder="Ajouter un pseudo d'ami..."
                    />
                    <button type="submit" className="btn btn-primary" style={{ padding: '0 16px' }}>Ajouter</button>
                  </form>
                  
                  {/* Friends tag badges */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                    {config.friends && config.friends.map(friend => (
                      <span key={friend} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--kick-green-glow)', color: 'var(--kick-green)', border: '1px solid rgba(83, 252, 24, 0.3)', padding: '4px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: '500' }}>
                        {friend}
                        <button
                          type="button"
                          onClick={() => {
                            const newFriends = config.friends.filter(f => f !== friend);
                            const newConfig = { ...config, friends: newFriends };
                            setConfig(newConfig);
                            handleSaveConfig(newConfig);
                          }}
                          style={{ background: 'none', border: 'none', color: 'var(--status-error)', cursor: 'pointer', padding: 0, fontWeight: 'bold', display: 'inline-flex', alignItems: 'center' }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    {(!config.friends || config.friends.length === 0) && (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Aucun ami listé.</span>
                    )}
                  </div>
                  <span className="label-hint" style={{ marginTop: '6px' }}>Les messages générés contiendront des vannes ou commentaires humoristiques sur eux.</span>
                </div>

                <div className="form-group">
                  <label>Humeur / Tempérament des spectateurs AI</label>
                  <div className="persona-grid">
                    {GAMING_MOODS.map((m) => (
                      <div
                        key={m.id}
                        className={`persona-option ${config.botMood === m.id ? 'selected' : ''}`}
                        onClick={() => {
                          const newConfig = { ...config, botMood: m.id };
                          setConfig(newConfig);
                          handleSaveConfig(newConfig);
                        }}
                      >
                        <span className="persona-name">{m.name}</span>
                        <span className="persona-desc">{m.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>Taille du message de chat</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                    {MESSAGE_SIZES.map((sz) => (
                      <div
                        key={sz.id}
                        className={`persona-option ${config.messageSize === sz.id ? 'selected' : ''}`}
                        onClick={() => {
                          const newConfig = { ...config, messageSize: sz.id };
                          setConfig(newConfig);
                          handleSaveConfig(newConfig);
                        }}
                        style={{ padding: '8px' }}
                      >
                        <span className="persona-name" style={{ fontSize: '12px' }}>{sz.name}</span>
                        <span className="persona-desc" style={{ fontSize: '9px' }}>{sz.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>Langues du chat (Sélection multiple possible)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', padding: '10px', backgroundColor: 'var(--bg-input)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    {LANGUAGE_OPTIONS.map((lang) => {
                      const isChecked = config.botLanguages ? config.botLanguages.includes(lang.id) : config.botLanguage === lang.id;
                      return (
                        <label key={lang.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, cursor: 'pointer', fontSize: '13px', color: '#fff' }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              let newLangs = [...(config.botLanguages || [])];
                              if (e.target.checked) {
                                if (!newLangs.includes(lang.id)) {
                                  newLangs.push(lang.id);
                                }
                              } else {
                                newLangs = newLangs.filter(l => l !== lang.id);
                              }
                              if (newLangs.length === 0) {
                                newLangs = [lang.id];
                              }
                              const newConfig = { ...config, botLanguages: newLangs, botLanguage: newLangs[0] };
                              setConfig(newConfig);
                              handleSaveConfig(newConfig);
                            }}
                            style={{ width: 'auto', marginRight: '4px' }}
                          />
                          {lang.name}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'prompt' && (
              <div className="tab-content">
                <div className="form-row double">
                  <div className="form-group">
                    <label>Modèle d'IA (Gemini)</label>
                    <select
                      value={config.aiModel}
                      onChange={(e) => {
                        const newConfig = { ...config, aiModel: e.target.value };
                        setConfig(newConfig);
                        handleSaveConfig(newConfig);
                      }}
                    >
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash (Recommandé)</option>
                      <option value="gemini-2.0-flash">Gemini 2.0 Flash (Rapide)</option>
                      <option value="gemini-2.5-pro">Gemini 2.5 Pro (Ultra précis)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Clé API Gemini</label>
                    <input
                      type="password"
                      value={config.aiApiKey || ''}
                      onChange={(e) => setConfig({ ...config, aiApiKey: e.target.value })}
                      onBlur={() => handleSaveConfig()}
                      placeholder="AIzaSy..."
                    />
                    <span className="label-hint">Votre clé est conservée localement sur le serveur.</span>
                  </div>
                </div>

                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label>Instructions Système de base (Prompt)</label>
                    <span className="label-hint">L'IA adaptera ce prompt au jeu et à la taille</span>
                  </div>
                  <textarea
                    rows={4}
                    value={config.customPrompt}
                    onChange={(e) => setConfig({ ...config, customPrompt: e.target.value })}
                    onBlur={() => handleSaveConfig()}
                    placeholder="Consignes données à l'IA..."
                  />
                </div>
              </div>
            )}

            {activeTab === 'supabase' && (
              <div className="tab-content">
                <div className="form-group">
                  <label>Supabase URL</label>
                  <input
                    type="text"
                    value={config.supabaseUrl || ''}
                    onChange={(e) => setConfig({ ...config, supabaseUrl: e.target.value })}
                    onBlur={() => handleSaveConfig()}
                    placeholder="https://your-project.supabase.co"
                  />
                </div>

                <div className="form-group">
                  <label>Supabase API Key (Anon/Service)</label>
                  <input
                    type="password"
                    value={config.supabaseKey || ''}
                    onChange={(e) => setConfig({ ...config, supabaseKey: e.target.value })}
                    onBlur={() => handleSaveConfig()}
                    placeholder="eyJhbGciOi..."
                  />
                </div>
              </div>
            )}

            {/* Quick Config Links */}
            <div className="file-links-panel" style={{ display: 'flex', justifyContent: 'center', padding: '10px 0' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px', textAlign: 'center' }}>
                🔒 Note : Votre clé API Gemini et votre configuration sont stockées localement dans votre propre navigateur.
              </span>
            </div>
          </div>
        </div>

        {/* Right Side - Batch Generator Panel & Console */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Batch Generator Panel */}
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">
                <FileText size={18} /> Générateur de messages par lot
              </span>
              {currentBatch.length > 0 && (
                <button className="btn btn-secondary btn-icon-only" onClick={handleClearBatch} title="Effacer la liste">
                  <Trash2 size={15} />
                </button>
              )}
            </div>

            <div className="panel-body">
              {/* Count selector and Launch Action */}
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '180px' }}>
                  <label>Nombre de messages à générer</label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={batchCount}
                    onChange={(e) => setBatchCount(Math.min(Math.max(parseInt(e.target.value) || 1, 1), 1000))}
                    style={{ padding: '8px 12px' }}
                  />
                </div>
                
                <div style={{ display: 'flex', gap: '8px', alignSelf: 'flex-end', marginTop: '12px' }}>
                  {[10, 50, 100, 500, 1000].map(n => (
                    <button
                      key={n}
                      className={`btn btn-secondary`}
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                      onClick={() => setBatchCount(n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>

                <button
                  className="btn btn-primary"
                  style={{ alignSelf: 'flex-end', height: '40px', minWidth: '180px', marginTop: '12px' }}
                  onClick={handleGenerateBatch}
                  disabled={isGeneratingBatch}
                >
                  {isGeneratingBatch ? (
                    <>
                      <RefreshCw size={16} className="spin-anim" /> Génération...
                    </>
                  ) : (
                    <>
                      <Zap size={16} /> Générer la liste
                    </>
                  )}
                </button>
              </div>

              {currentBatch.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  {/* Actions Row */}
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button className="btn btn-secondary" onClick={handleCopyAll}>
                      {copiedAll ? <Check size={16} style={{ color: 'var(--kick-green)' }} /> : <Copy size={16} />}
                      {copiedAll ? 'Copié !' : 'Tout copier (brut)'}
                    </button>
                    <button className="btn btn-secondary" onClick={handleExportTxt}>
                      <Download size={16} /> Exporter en .txt
                    </button>
                  </div>

                  {/* Split Visual List & Raw Textarea */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                    
                    {/* Visual List format */}
                    <div>
                      <label style={{ marginBottom: '8px' }}>Liste des messages (Cliquer pour copier individuellement)</label>
                      <div className="chat-container" style={{ height: '260px' }}>
                        <div className="chat-messages" style={{ padding: '10px' }}>
                          {currentBatch.map((msg, index) => (
                            <div
                              key={index}
                              className={`chat-message-row bot-message-row ${copiedId === index ? 'copied-glow' : ''}`}
                              onClick={() => handleCopySingle(msg, index)}
                              style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', margin: '2px 0', cursor: 'pointer' }}
                              title="Cliquer pour copier"
                            >
                              <span dir="auto" style={{ color: 'var(--text-primary)', fontSize: '13px' }}>{msg}</span>
                              <button
                                className="btn-icon-only"
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginLeft: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                {copiedId === index ? <Check size={12} style={{ color: 'var(--kick-green)' }} /> : <Copy size={12} />}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Raw Text block format */}
                    <div>
                      <label style={{ marginBottom: '8px' }}>Copier tout le texte brut (sélectionnable)</label>
                      <textarea
                        dir="auto"
                        readOnly
                        rows={6}
                        value={currentBatch.join('\n')}
                        onClick={(e) => e.target.select()}
                        style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', whiteSpace: 'pre-wrap', backgroundColor: '#0d0f12' }}
                        placeholder="Le texte brut apparaîtra ici..."
                      />
                    </div>

                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border-color)', borderRadius: '8px', padding: '48px', color: 'var(--text-muted)', gap: '12px' }}>
                  <FileText size={36} style={{ opacity: 0.5 }} />
                  <p style={{ textAlign: 'center' }}>Aucun message généré pour le moment. Choisissez vos paramètres de jeu et cliquez sur "Générer la liste".</p>
                </div>
              )}
            </div>
          </div>

          {/* Console / Log Terminal */}
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">
                <Terminal size={18} /> Console d'activité du Serveur
              </span>
            </div>
            
            <div className="panel-body" style={{ padding: '12px' }}>
              <div className="terminal-container" ref={terminalEndRef}>
                {logs.map((log, index) => (
                  <div key={index} className={`terminal-line level-${log.level}`}>
                    <span className="terminal-time">[{formatTime(log.timestamp)}]</span>
                    <span className="terminal-indicator">
                      {log.level === 'success' && '✓'}
                      {log.level === 'error' && '✗'}
                      {log.level === 'warning' && '⚠'}
                      {log.level === 'info' && '⚙'}
                    </span>
                    <div dir="auto" className="terminal-text">
                      {log.text}
                      {log.details && <span className="terminal-details">{log.details}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

      </div>

      <footer className="app-footer">
        <p>
          Développé pour KICK Chat Automation • Console d'administration locale.
        </p>
      </footer>
    </div>
  );
}

export default App;
