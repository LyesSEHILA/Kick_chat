# 🤖 Kick Chat AI Batch Generator

Un outil moderne et performant pour générer des **lots de messages de chat réalistes** grâce à l'intelligence artificielle (Google Gemini) pour votre stream **Kick.com** (ex: vos lives *Counter-Strike*).

L'outil n'est pas un bot automatique mais un **générateur à la demande** : il crée instantanément une liste de messages personnalisés (nombre déterminé par vos soins) que vous pouvez copier individuellement, copier d'un coup ou exporter au format `.txt` pour les utiliser dans vos propres outils.

---

## 🛠️ Fonctionnalités clés

1.  **Génération par lots personnalisables** : Choisissez le nombre de messages à générer d'un coup (de 1 à 50) et l'IA s'occupe du reste en quelques secondes.
2.  **Copie ultra-rapide (Presse-papier)** :
    *   **Individuelle** : Cliquez sur n'importe quelle ligne de la liste générée pour copier le message instantanément. Une animation verte indique la réussite de la copie.
    *   **Globale** : Cliquez sur le bouton *Tout copier (brut)* pour copier toute la liste dans votre presse-papier (un message par ligne).
3.  **Exportation .txt** : Cliquez sur *Exporter en .txt* pour télécharger directement un fichier texte contenant les messages générés.
4.  **Personnalisation avancée** :
    *   *Jeu actuel* (ex: **Counter-Strike**) pour contextualiser les messages générés avec du vocabulaire précis (armes, stratégies, cris de joie ou de seum).
    *   *Humeur active* (Standard, Enthousiaste, Rageux/Salé, Troll taquin, Backseater, Analyste tactique).
    *   *Taille du message* (Court, Moyen, Long ou Aléatoire).
    *   *Multi-langues* (Sélectionnez plusieurs langues et le générateur mixera le tout ou choisira aléatoirement pour chaque message).

---

## 🚀 Démarrage rapide

### 1. Démarrer l'application (Développement)

Pour lancer le serveur backend (port `5000`) et le serveur de développement frontend Vite (port `5173`) simultanément :

```bash
npm run dev
```

Ouvrez ensuite votre navigateur sur [http://localhost:5173](http://localhost:5173).

### 2. Démarrer en Production

Pour compiler l'interface et lancer le serveur tout-en-un servant le frontend et le backend sur le port `5000` :

```bash
npm start
```

Accédez ensuite à l'application sur [http://localhost:5000](http://localhost:5000).

---

## ⚙️ Configuration de l'IA

*   **Clé API Gemini** : Obtenez une clé gratuite en 1 clic sur [Google AI Studio](https://aistudio.google.com/) et collez-la dans l'onglet **Persona & Prompt** du tableau de bord.
*   Votre configuration est automatiquement sauvegardée dans le fichier local [config.json](file:///home/atlas/Bureau/KICK/config.json).

---

## 📂 Liens vers les fichiers locaux

*   ⚙️ [Configuration du bot (config.json)](file:///home/atlas/Bureau/KICK/config.json)
*   🖥️ [Code Backend (server.js)](file:///home/atlas/Bureau/KICK/server.js)
*   ⚛️ [Composant Principal React (src/App.jsx)](file:///home/atlas/Bureau/KICK/src/App.jsx)
*   🎨 [Styles CSS (src/App.css)](file:///home/atlas/Bureau/KICK/src/App.css)
