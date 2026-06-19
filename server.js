import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Path for configurations
const CONFIG_FILE = path.join(__dirname, 'config.json');
const HISTORY_FILE = path.join(__dirname, 'history.json');

// Default configurations
const DEFAULT_CONFIG = {
  kickChannel: 'my_kick_stream',
  kickChannelId: '',
  kickToken: '',
  aiProvider: 'gemini', // gemini
  aiApiKey: '',
  aiModel: 'gemini-2.5-flash',
  botPersona: 'standard',
  botLanguage: 'French',
  botLanguages: ['French'],
  botMood: 'neutral',
  currentGame: 'Counter-Strike',
  messageSize: 'mixed',
  customPrompt: 'Tu es un spectateur actif sur un stream Kick. Écris un court message de chat réaliste, spontané et dynamique par rapport au stream. Utilise du vocabulaire de gamer, des abréviations (gg, wtf, mdr, ptdr, jpp) et parfois des fautes d\'orthographe volontaires. Écris exclusivement en minuscules (sans aucune majuscule, même en début de phrase) et n\'utilise jamais de virgule dans le message. Ne mets jamais d\'émojis. Évite d\'utiliser systématiquement des points d\'exclamation (!) ou des points (.) à la fin des messages (laisse-les bruts la plupart du temps). Varie énormément ton vocabulaire et tes phrases pour que les messages ne se ressemblent pas. Le message doit être très court. Ne mentionne jamais que tu es un bot ou une IA.',
  frequencyMin: 30, // seconds
  frequencyMax: 90, // seconds
  isEnabled: false,
  isMockMode: true,
  webhookUrl: '',
  friends: [],
  streamerConfigSpecs: '',
  channelInfo: ''
};

// Load configuration
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    }
  } catch (error) {
    console.error('Error loading config:', error);
  }
  return { ...DEFAULT_CONFIG };
}

// Save configuration
function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error saving config:', error);
    return false;
  }
}

// Load message history
function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading history:', error);
  }
  return [];
}

// Save message history
function saveHistory(history) {
  try {
    // Keep only the last 150 messages
    const slicedHistory = history.slice(-150);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(slicedHistory, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving history:', error);
  }
}

let config = loadConfig();
let history = loadHistory();
let logListeners = [];
let botTimeoutId = null;

// Logger helper that pushes messages to terminal and to SSE clients
function logMessage(level, text, details = '') {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level, // 'info', 'success', 'warning', 'error'
    text,
    details
  };
  console.log(`[${logEntry.level.toUpperCase()}] ${text} ${details}`);
  
  // Push to SSE clients
  logListeners.forEach(listener => {
    listener.write(`data: ${JSON.stringify(logEntry)}\n\n`);
  });
}

// Predefined Gaming Mood Prompts
const MOOD_PROMPTS = {
  neutral: "Tu es un spectateur standard de stream sympathique qui réagit normalement à ce qui se passe.",
  hype: "Tu es super excité et enthousiaste. Tu célèbres les beaux gestes les victoires et les éliminations. Tu utilises des expressions comme 'incroyable' ou 'quel clutch' ou 'c'est fou' ou 'gg' ou 'pogchamp'.",
  salty: "Tu es un râleur salé / rageux. Tu réagis quand le streamer meurt ou rate un tir ou perd. Tu dis qu'il y a du cheat ou que c'est de la chance ou que le jeu bugge (ex: 'c'est quoi ce tickrate' ou 'hitbox cassée' ou 'il a pas de shoot' ou 'quelle chatte' ou 'jpp de ce jeu').",
  troll: "Tu aimes taquiner gentiment le streamer ou rigoler de ses échecs ou de ses morts stupides ou faire des commentaires ironiques sans être insultant ou haineux (ex: 'bien joué le fail' ou 't'es sûr de ton viseur' ou 'mdrrr t'es nul' ou 'kappa').",
  backseat: "Tu donnes des conseils de jeu et des directions au streamer en tant que spectateur averti (ex: 'prends l'awp' ou 'attention à droite' ou 'pose la bombe' ou 'économise ce round' ou 't'aurais dû buy').",
  analytic: "Tu commentes la stratégie globale de manière sérieuse et tactique (ex: 'leur éco est cassée là' ou 'le plan a était bon mais mal timé' ou 'bon placement' ou 'faut jouer le time')."
};

// Helper to get detailed language description
function getLanguageInstruction(langKey) {
  switch (langKey) {
    case 'Kabyle':
      return "Kabyle (langue berbère d'Algérie écrite principalement en caractères latins familiers de type chat internet - ex: 'azul', 'azul fellawen', 'tanemmirt', 'acuyyan'). Le message doit être informel et naturel.";
    case 'Algerian_Darija':
      return "Daridja Algérienne (dialecte algérien écrit en caractères latins / alphabet latin, SMS franco-algérien utilisant des chiffres comme 3 pour 'a', 7 pour 'h', 9 pour 'q' si nécessaire - ex: 'sahbi', 'ya kho', 'rak ghaya', 'wesh') combinée avec du français (mélange franco-algérien très naturel pour des viewers).";
    case 'Algerian_Darija_Arabic':
      return "Daridja Algérienne écrite exclusivement en caractères arabes (alphabet arabe classique - ex: 'واش يا خو', 'راك غايا', 'صحبي'). Le message doit être très informel, naturel et typique d'un spectateur de chat.";
    case 'French':
      return "Français familier de type chat Internet";
    case 'English':
      return "Anglais internet / gamer";
    case 'Spanish':
      return "Espagnol";
    case 'German':
      return "Allemand";
    case 'Italian':
      return "Italien";
    case 'Portuguese':
      return "Portugais";
    default:
      return langKey || "Français";
  }
}

// Helper to perform Gemini API calls with automatic retries for transient errors (503, 429, etc.)
async function generateWithRetry(model, prompt, retries = 5, delayMs = 3000) {
  let attempt = 0;
  while (attempt < retries) {
    try {
      attempt++;
      return await model.generateContent(prompt);
    } catch (error) {
      if (attempt >= retries) {
        throw error;
      }
      
      const errorMsg = error && error.message ? String(error.message) : String(error || '');
      const isRateLimit = errorMsg.includes('429') || 
                          errorMsg.toLowerCase().includes('quota') || 
                          (error && error.status === 429);
      
      let waitTimeMs = delayMs;
      
      if (isRateLimit) {
        // Try parsing "Please retry in X.XXXXs" from the Gemini API error
        const match = errorMsg.match(/Please retry in ([\d.]+)s/i);
        if (match) {
          const waitSec = parseFloat(match[1]);
          // Add 1.5s buffer to be safe
          waitTimeMs = Math.ceil((waitSec + 1.5) * 1000);
          logMessage('warning', `API Gemini a atteint son quota (429). Attente recommandée de ${waitSec}s (+1.5s de marge). Tentative ${attempt}/${retries} dans ${Math.ceil(waitTimeMs/1000)}s...`);
        } else {
          // Exponential backoff if duration not found
          waitTimeMs = delayMs * Math.pow(3, attempt - 1);
          logMessage('warning', `API Gemini a atteint son quota (429). Tentative ${attempt}/${retries} dans ${waitTimeMs/1000}s avec backoff...`);
        }
      } else {
        logMessage('warning', `Erreur API Gemini temporaire (erreur ${(error && error.status) || 'surcharge'}). Tentative ${attempt}/${retries} dans ${delayMs/1000}s...`);
      }
      
      await new Promise(resolve => setTimeout(resolve, waitTimeMs));
    }
  }
}

// Generate AI message using Gemini
async function generateAIMessage(userConfig) {
  const apiKey = userConfig.aiApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Clé API Gemini manquante. Veuillez la configurer.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = userConfig.aiModel || 'gemini-2.5-flash';
  const model = genAI.getGenerativeModel({ model: modelName });

  const mood = userConfig.botMood || 'neutral';
  const moodPrompt = MOOD_PROMPTS[mood] || MOOD_PROMPTS.neutral;
  
  // Handle language selection
  let selectedLanguage = 'French';
  if (userConfig.botLanguages && userConfig.botLanguages.length > 0) {
    const languages = userConfig.botLanguages;
    selectedLanguage = languages[Math.floor(Math.random() * languages.length)];
  } else if (userConfig.botLanguage) {
    selectedLanguage = userConfig.botLanguage;
  }

  const langInstruction = getLanguageInstruction(selectedLanguage);

  // Handle message sizes
  let sizeInstruction = "";
  let minChars = 10;
  let maxChars = 90;
  const size = userConfig.messageSize || 'mixed';
  if (size === 'short') {
    sizeInstruction = "Le message doit être TRÈS court, concis, typique d'un chat rapide (ex: 2 à 5 mots, entre 10 et 40 caractères maximum).";
    maxChars = 40;
  } else if (size === 'medium') {
    sizeInstruction = "Le message doit être de taille moyenne, contenant une réaction simple (entre 40 et 80 caractères maximum).";
    minChars = 40;
    maxChars = 80;
  } else if (size === 'long') {
    sizeInstruction = "Le message doit être long pour un chat, plus détaillé ou structuré (entre 80 et 160 caractères maximum).";
    minChars = 80;
    maxChars = 160;
  } else {
    sizeInstruction = "Le message doit avoir une taille aléatoire : parfois très court, parfois de taille moyenne, parfois long (entre 10 et 160 caractères maximum).";
    maxChars = 160;
  }

  const gameContext = userConfig.currentGame ? `Le streamer joue actuellement au jeu : **${userConfig.currentGame}**.` : "Le streamer est en cours de stream.";

  // Construct the prompt
  const fullPrompt = `
Instruction principale:
${userConfig.customPrompt}

Contexte du Stream:
${gameContext}

Consigne de Tempérament / Humeur du spectateur:
${moodPrompt}

Consigne de Taille de message:
${sizeInstruction}

Consigne de Langue:
Génère le message en respectant précisément cette directive de langue : ${langInstruction}.

Contraintes additionnelles:
1. Ne mets aucun guillemet autour du message.
2. Ne mets aucun préambule comme "Voici ton message: " ou "Message généré: ". Renvoie uniquement le texte brut du message de chat.
3. Rends-le très naturel et spontané. Écris EXCLUSIVEMENT en minuscules (sans aucune majuscule, même au début du message, du début des phrases ou pour les noms propres). N'utilise jamais de virgules (,) au milieu du message (les gens dans le chat n'écrivent jamais de virgules, remplace-les par des espaces ou sépare tes phrases sans ponctuation).
4. Respecte scrupuleusement la contrainte de taille : entre ${minChars} et ${maxChars} caractères.
5. N'utilise JAMAIS d'émojis dans tes messages générés (ils ne sont pas supportés par la plateforme et ne doivent sous aucun prétexte apparaître).
6. N'ajoute pas systématiquement de ponctuation finale comme des points d'exclamation (!) ou des points (.) à la fin du message. Laisse le message brut sans ponctuation finale la plupart du temps. Varie au maximum tes tournures et tes expressions pour éviter les répétitions.
`;

  const result = await generateWithRetry(model, fullPrompt);
  let text = result.response.text().trim();
  
  // Clean up potential surrounding quotes
  if (text.startsWith('"') && text.endsWith('"')) {
    text = text.substring(1, text.length - 1);
  }
  if (text.startsWith("'") && text.endsWith("'")) {
    text = text.substring(1, text.length - 1);
  }
  
  return text;
}

// Send message to Kick chat
async function sendMessageToKick(messageText, userConfig) {
  if (userConfig.isMockMode) {
    logMessage('info', 'Mode Simulation actif. Message simulé:', `"${messageText}" pour la chaîne ${userConfig.kickChannel}`);
    return { success: true, simulated: true };
  }

  // Handle Webhook sending if configured
  if (userConfig.webhookUrl) {
    try {
      logMessage('info', 'Envoi du message au Webhook...', userConfig.webhookUrl);
      const response = await fetch(userConfig.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'KickBot AI',
          content: messageText,
          channel: userConfig.kickChannel,
          platform: 'kick'
        })
      });
      if (response.ok) {
        logMessage('success', 'Message envoyé avec succès au Webhook.');
      } else {
        logMessage('error', 'Échec de l\'envoi au Webhook:', `Statut ${response.status}`);
      }
    } catch (err) {
      logMessage('error', 'Erreur de connexion au Webhook:', err.message);
    }
  }

  // Send to official Kick API if credentials exist
  if (userConfig.kickToken) {
    try {
      logMessage('info', `Envoi du message à l'API Kick (Chaîne: ${userConfig.kickChannel})...`);
      
      // Official API url: https://api.kick.com/public/v1/chat/messages
      // or similar depending on the exact official route.
      const url = 'https://api.kick.com/public/v1/chat/messages';
      
      const payload = {
        content: messageText,
        type: 'bot',
      };
      
      if (userConfig.kickChannelId) {
        payload.channel_id = userConfig.kickChannelId;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userConfig.kickToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const resData = await response.json().catch(() => ({}));
        logMessage('success', 'Message envoyé sur Kick avec succès !', `"${messageText}"`);
        return { success: true, response: resData };
      } else {
        const errText = await response.text();
        logMessage('error', `Erreur API Kick (${response.status}):`, errText);
        return { success: false, error: `Kick API error: ${response.status}`, details: errText };
      }
    } catch (err) {
      logMessage('error', 'Erreur lors de l\'envoi Kick:', err.message);
      return { success: false, error: err.message };
    }
  }

  logMessage('warning', 'Aucun token Kick ni Webhook configuré. Message simulé en local.', `"${messageText}"`);
  return { success: true, simulated: true };
}

// Bot logic scheduler loop
function runScheduler() {
  if (botTimeoutId) {
    clearTimeout(botTimeoutId);
    botTimeoutId = null;
  }

  if (!config.isEnabled) {
    logMessage('info', 'Le planificateur est arrêté.');
    return;
  }

  // Calculate random delay
  const min = Math.min(config.frequencyMin, config.frequencyMax);
  const max = Math.max(config.frequencyMin, config.frequencyMax);
  const delaySec = Math.floor(Math.random() * (max - min + 1)) + min;
  
  logMessage('info', `Prochain message planifié dans ${delaySec} secondes.`);

  botTimeoutId = setTimeout(async () => {
    try {
      logMessage('info', 'Génération d\'un nouveau message de chat par l\'IA...');
      const messageText = await generateAIMessage(config);
      
      logMessage('info', 'Message généré:', `"${messageText}"`);

      const sendResult = await sendMessageToKick(messageText, config);
      
      const historyItem = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        content: messageText,
        persona: config.botMood || config.botPersona,
        channel: config.kickChannel,
        status: sendResult.simulated ? 'simulated' : (sendResult.success ? 'sent' : 'failed'),
        error: sendResult.error || null
      };

      history.push(historyItem);
      saveHistory(history);

      // Broadcast history updates via SSE if needed, or frontend polls.
      // We push a system log event with the history item
      logListeners.forEach(listener => {
        listener.write(`event: historyUpdate\ndata: ${JSON.stringify(historyItem)}\n\n`);
      });

    } catch (error) {
      logMessage('error', 'Erreur dans la boucle du planificateur:', error.message);
    } finally {
      // Continue the scheduler loop if still enabled
      if (config.isEnabled) {
        runScheduler();
      }
    }
  }, delaySec * 1000);
}

// API Routes

// Get configs
app.get('/api/config', (req, res) => {
  res.json(config);
});

// Save configs
app.post('/api/config', (req, res) => {
  const updatedConfig = { ...config, ...req.body };
  
  // Force clean numbers
  updatedConfig.frequencyMin = parseInt(updatedConfig.frequencyMin) || 30;
  updatedConfig.frequencyMax = parseInt(updatedConfig.frequencyMax) || 90;
  
  config = updatedConfig;
  saveConfig(config);
  
  logMessage('success', 'Configuration mise à jour avec succès.');
  
  // If scheduler status changed, apply
  if (config.isEnabled) {
    runScheduler();
  } else if (botTimeoutId) {
    clearTimeout(botTimeoutId);
    botTimeoutId = null;
    logMessage('info', 'Planificateur désactivé suite au changement de configuration.');
  }

  res.json({ success: true, config });
});

// Toggle Bot Status
app.post('/api/bot/toggle', (req, res) => {
  const { enabled } = req.body;
  config.isEnabled = !!enabled;
  saveConfig(config);

  if (config.isEnabled) {
    logMessage('success', 'Planificateur activé.');
    runScheduler();
  } else {
    if (botTimeoutId) {
      clearTimeout(botTimeoutId);
      botTimeoutId = null;
    }
    logMessage('warning', 'Planificateur désactivé.');
  }

  res.json({ success: true, isEnabled: config.isEnabled });
});

// Get History
app.get('/api/history', (req, res) => {
  res.json(history);
});

// Clear History
app.post('/api/history/clear', (req, res) => {
  history = [];
  saveHistory(history);
  logMessage('info', 'Historique des messages effacé.');
  res.json({ success: true });
});

// Generate N AI messages in a single API call (respects 5 RPM free tier limits)
async function generateAIBatchMessages(userConfig, batchCount) {
  const apiKey = userConfig.aiApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Clé API Gemini manquante. Veuillez la configurer.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = userConfig.aiModel || 'gemini-2.5-flash';
  const model = genAI.getGenerativeModel({ model: modelName });

  const mood = userConfig.botMood || 'neutral';
  const moodPrompt = MOOD_PROMPTS[mood] || MOOD_PROMPTS.neutral;
  
  // Languages list
  let languagesList = [];
  if (userConfig.botLanguages && userConfig.botLanguages.length > 0) {
    languagesList = userConfig.botLanguages.map(getLanguageInstruction);
  } else if (userConfig.botLanguage) {
    languagesList = [getLanguageInstruction(userConfig.botLanguage)];
  } else {
    languagesList = [getLanguageInstruction('French')];
  }
  
  let langInstructionPrompt = "";
  if (languagesList.length === 1) {
    langInstructionPrompt = `Génère chaque message de la liste EXCLUSIVEMENT dans cette langue (ne traduis pas et ne mélange pas avec d'autres langues) : ${languagesList[0]}.`;
  } else {
    langInstructionPrompt = `Génère chaque message de la liste dans l'une de ces langues sélectionnées de façon aléatoire : [${languagesList.join(' / ')}]. Varie les langues d'une ligne à l'autre de manière équilibrée.`;
  }

  // Handle message sizes
  let sizeInstruction = "";
  let minChars = 10;
  let maxChars = 90;
  const size = userConfig.messageSize || 'mixed';
  if (size === 'short') {
    sizeInstruction = "Chaque message doit être TRÈS court, concis (ex: 2 à 5 mots, entre 10 et 40 caractères maximum).";
    maxChars = 40;
  } else if (size === 'medium') {
    sizeInstruction = "Chaque message doit être de taille moyenne (entre 40 et 80 caractères maximum).";
    minChars = 40;
    maxChars = 80;
  } else if (size === 'long') {
    sizeInstruction = "Chaque message doit être long pour un chat (entre 80 et 160 caractères maximum).";
    minChars = 80;
    maxChars = 160;
  } else {
    sizeInstruction = "Chaque message doit avoir une taille aléatoire : certains très courts, d'autres moyens ou longs (entre 10 et 160 caractères maximum).";
    maxChars = 160;
  }

  const gameContext = userConfig.currentGame ? `Le streamer joue actuellement au jeu : **${userConfig.currentGame}**.` : "Le streamer est en cours de stream.";
  const streamerName = userConfig.kickChannel || "le streamer";
  const friendsList = (userConfig.friends && userConfig.friends.length > 0)
    ? `Le streamer joue en coop/groupe avec ses amis nommés : ${userConfig.friends.join(', ')}.`
    : "Le streamer joue seul (aucun ami listé).";
  const configSpecs = userConfig.streamerConfigSpecs
    ? `Configuration/Specs PC du streamer : ${userConfig.streamerConfigSpecs}.`
    : "La configuration PC du streamer n'est pas précisée.";
  const channelInfo = userConfig.channelInfo
    ? `Informations sur le planning/chaîne Kick : ${userConfig.channelInfo}.`
    : "Aucune information de chaîne spécifiée.";

  const friendsInstruction = (userConfig.friends && userConfig.friends.length > 0)
    ? `- Certains messages (environ 15-20% de la liste) doivent taquiner ou vanner de manière humoristique et amicale ses amis (${userConfig.friends.join(', ')}) par rapport à leur jeu ou leurs fails (ex: "Ami t'es aveugle ?", "gg la flash Ami mdr", etc.).`
    : "";

  const fullPrompt = `
Instruction principale:
Génère une liste de exactement ${batchCount} messages de chat distincts et réalistes pour un stream Kick.
Renvoie un message par ligne (séparés par un retour à la ligne classique).

Contexte du Stream:
- ${gameContext}
- Nom de la chaîne Kick du streamer : ${streamerName}
- ${friendsList}
- ${configSpecs}
- ${channelInfo}

Consignes de comportement et de style:
- ${userConfig.customPrompt}
${friendsInstruction}
- Certains messages (environ 20% de la liste) doivent s'adresser directement au streamer (${streamerName}) pour lui poser des questions ou réagir par rapport à sa configuration PC (les specs citées ci-dessus), ses composants, ou sa chaîne Kick (planning, horaires, questions sur son stream). Ex: "c'est quoi ton gpu ?", "t'as un clavier optique ?", "tu stream demain ?", "jolie la config !".

Consigne de Tempérament / Humeur du spectateur:
${moodPrompt}

Consigne de Taille de message:
${sizeInstruction}

Consigne de Langue:
${langInstructionPrompt}

Contraintes de format STRICTES (Crucial pour le parsing):
1. Renvoie exactement ${batchCount} lignes de texte. Chaque ligne doit correspondre à un seul message de chat brut.
2. Ne mets aucun guillemet autour des messages.
3. Ne mets aucune numérotation (PAS de "1.", "2.", "-", etc.) au début des lignes.
4. N'écris aucun préambule comme "Voici ta liste:" ou "Messages:" et aucun commentaire de fin. Renvoie uniquement les lignes de messages bruts.
5. Respecte les tailles pour chaque ligne : entre ${minChars} et ${maxChars} caractères.
`;

  const result = await generateWithRetry(model, fullPrompt);
  let text = result.response.text().trim();
  
  // Parse response lines
  const lines = text.split('\n')
    .map(line => line.trim())
    .map(line => {
      let cleaned = line;
      cleaned = cleaned.replace(/^[-*•]\s+/, '');
      cleaned = cleaned.replace(/^\d+[\RightParenthesis\.]\s+/, '');
      if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
        cleaned = cleaned.substring(1, cleaned.length - 1);
      }
      if (cleaned.startsWith("'") && cleaned.endsWith("'")) {
        cleaned = cleaned.substring(1, cleaned.length - 1);
      }
      return cleaned.trim();
    })
    .filter(line => line.length > 0);

  // Fallback if the AI returned fewer lines than requested
  while (lines.length < batchCount) {
    lines.push("GG ! 🔥");
  }

  return lines.slice(0, batchCount);
}

// Batch Generation Route
app.post('/api/generate-batch', async (req, res) => {
  const { count, config: userConfig } = req.body;
  const batchCount = Math.min(Math.max(parseInt(count) || 5, 1), 100); // limit to 1-100
  logMessage('info', `Génération d'un lot de ${batchCount} messages...`);

  try {
    // Generate messages in a single API call (respects 5 RPM)
    const results = await generateAIBatchMessages(userConfig, batchCount);
    
    logMessage('success', `${batchCount} messages générés avec succès.`);
    
    // Format history items
    const newItems = results.map(text => ({
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      content: text,
      persona: userConfig.botMood || 'neutral',
      channel: userConfig.kickChannel || 'stream',
      status: 'generated'
    }));

    history.push(...newItems);
    saveHistory(history);

    // Stream updates via SSE
    logListeners.forEach(listener => {
      newItems.forEach(item => {
        listener.write(`event: historyUpdate\ndata: ${JSON.stringify(item)}\n\n`);
      });
    });

    res.json({ success: true, messages: results });
  } catch (error) {
    logMessage('error', 'Erreur lors de la génération du lot:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test Generation Now
app.post('/api/generate-now', async (req, res) => {
  try {
    const tempConfig = { ...config, ...req.body };
    logMessage('info', 'Génération manuelle unique demandée...');
    const messageText = await generateAIMessage(tempConfig);
    
    logMessage('success', 'Message généré avec succès:', `"${messageText}"`);
    res.json({ success: true, content: messageText });
  } catch (error) {
    logMessage('error', 'Erreur de génération:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// SSE Route for streaming live server logs
app.get('/api/logs', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  logListeners.push(res);
  
  // Send an initial handshake log
  const handshake = {
    timestamp: new Date().toISOString(),
    level: 'info',
    text: 'Console de streaming de logs connectée au serveur.',
    details: ''
  };
  res.write(`data: ${JSON.stringify(handshake)}\n\n`);

  // Send the active status
  const botStatusLog = {
    timestamp: new Date().toISOString(),
    level: config.isEnabled ? 'success' : 'warning',
    text: `Statut du planificateur : ${config.isEnabled ? 'ACTIF' : 'INACTIF'}.`,
    details: `Mode simulation : ${config.isMockMode ? 'OUI' : 'NON'}`
  };
  res.write(`data: ${JSON.stringify(botStatusLog)}\n\n`);

  req.on('close', () => {
    logListeners = logListeners.filter(listener => listener !== res);
  });
});

// Serve static assets in production
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*everything', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('Server is running. Run "npm run build" to serve the frontend too.');
  });
}

// Start bot scheduler if enabled on startup
if (config.isEnabled) {
  runScheduler();
  console.log('[SCHEDULER] Planificateur lancé au démarrage.');
}

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
