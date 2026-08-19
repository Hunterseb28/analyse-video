# Analyse Video — Safari Web Extension

Cette extension ajoute directement à la page Safari un panneau d'analyse audio synchronisé avec la vidéo HTML5 détectée.

## Contenu

- `manifest.json` — configuration WebExtension Manifest V3.
- `content.js` — panneau, analyse Web Audio, détection des pics et synchronisation.
- `overlay.css` — interface injectée dans la page.

## Packaging iOS sans Mac

Apple permet désormais de téléverser les ressources d'une Safari Web Extension dans App Store Connect via **Safari Web Extension Packager**, puis de générer une build distribuable par TestFlight. Cela nécessite l'Apple Developer Program.

1. Ouvrir App Store Connect.
2. Créer une nouvelle app iOS, par exemple `Analyse Video`.
3. Choisir un Bundle ID unique, par exemple `com.hunterseb.analysevideo`.
4. Ouvrir l'onglet **Xcode Cloud** puis **Safari Web Extension Packager**.
5. Compresser **le contenu de ce dossier** (`manifest.json`, `content.js`, `overlay.css`) en ZIP, sans inclure le dossier parent `safari-extension`.
6. Téléverser le ZIP.
7. Une fois la build créée, utiliser TestFlight pour l'installer sur l'iPhone.
8. Dans iOS : Réglages > Apps > Safari > Extensions, activer `Analyse Video` et autoriser l'accès aux sites nécessaires.

## Limite actuelle

L'extension ne contourne pas les protections d'un site. Elle analyse uniquement le média auquel Safari expose réellement l'accès. Certains lecteurs, flux HLS ou politiques CORS peuvent empêcher Web Audio d'accéder au signal sonore même si la vidéo est parfaitement audible.
