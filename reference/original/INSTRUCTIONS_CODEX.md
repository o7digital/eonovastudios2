# Instructions Codex — EON NOVA STUDIOS

## Objectif
Intégrer en Astro le site EON NOVA STUDIOS pour Jorge à partir de cette maquette validée. Domaine prévu : eonovastudios.com. Conserver fidèlement la direction artistique noire et verte, les compositions, la typographie, le Motion Lab et surtout le nouveau grand header animé. Ne pas refaire le design et ne pas réintroduire la photo verte abstraite.

## Fichiers de référence
- site/index.html : structure et textes de la maquette.
- site/style.css : styles et responsive.
- site/app.js : animations Canvas, Motion Lab, interactions et galeries.
- site/assets/ : visuels de la maquette.

La version fournie est en HTML/CSS/JavaScript natif, pas encore en Astro. Elle correspond à la maquette historique avec le header animé validé, et non à la variante « Beyond the frame ».

## Mise en œuvre
1. Lire les instructions du dépôt cible et vérifier les changements locaux avant toute modification. Si un projet Astro existe, l'intégrer à ce projet ; sinon initialiser un projet Astro statique.
2. Transformer la page en composants Astro : Layout, Header, HeroMotion, MotionLab, Studio et Footer. Réutiliser les CSS existants pour préserver le rendu. Aucun framework client n'est requis pour ces animations.
3. Placer les images dans public/assets et adapter les chemins absolus. Extraire le JavaScript dans src/scripts/studio.js et l'importer depuis un script Astro. Éviter l'initialisation en double et les collisions de variables. Si la navigation côté client est activée, prévoir le nettoyage des observers, listeners et boucles requestAnimationFrame.
4. Préserver les trois modes du header : 01 Ondas, 02 Órbitas, 03 Flujo, leurs boutons accessibles et leurs états aria-pressed. Garder la réaction douce au pointeur, le bouton pause global, prefers-reduced-motion, la suspension du rendu hors écran et quand l'onglet est masqué.
5. Préserver les quatre explorations du Motion Lab, le réglage de vitesse et les modales. Tester la coordination entre pause globale et pause du Motion Lab.

## Ajustements éditoriaux déjà demandés par Olivier
La maquette historique jointe contient encore certains anciens textes. Appliquer ces changements dans la version finale :
- Supprimer « Hola, soy Jorge » et la présentation scolaire/personnelle. Présenter EON NOVA STUDIOS comme un studio de design digital et d'animation, avec un ton premium.
- Ne pas annoncer les jeux vidéo pour le moment : masquer intégralement Nocturna, son lien de navigation et toute mention « GAMES », « VIDEOJUEGOS » ou « universos interactivos ». Conserver les fichiers sources et les images en réserve, sans les servir dans la version publique si non utilisés.
- En retirant Nocturna du DOM, rendre son JavaScript conditionnel ou isoler son module. Les sélecteurs actuels sans garde (#art-open, etc.) ne doivent pas empêcher le header de démarrer.
- Mettre en avant le design digital, l'animation 2D/3D, les courts métrages et les séries animées. La série 2D personnelle est en développement : ne pas inventer un titre, une date de sortie ou une production terminée.
- Garder les textes en espagnol. Ne pas inventer de références clients, prix, récompenses, diplômes, réseaux sociaux ou coordonnées.
- Les animations procédurales sont des explorations visuelles de la maquette, pas des réalisations de portfolio à attribuer à Jorge.

## Mise en ligne et qualité
- Site responsive : vérifier 390 px, 768 px et 1440 px ; pas de texte, boutons ou animations coupés ; le header doit être spectaculaire mais lisible.
- Vérifier réellement dans un navigateur : changement des trois modes du header, pause/reprise, Motion Lab, curseur de vitesse, ouverture/fermeture des modales avec Échap, navigation clavier, absence d'erreurs console.
- Limiter la densité de pixels et le nombre de tracés sur mobile si nécessaire ; ne pas figer l'animation par défaut hors préférence de mouvement réduit.
- Utiliser les polices existantes DM Sans et Space Grotesk, idéalement hébergées localement.
- Configurer titre, description, favicon, canonical https://eonovastudios.com, Open Graph et sitemap. Garder les environnements de prévisualisation en noindex.
- Ne pas inventer de formulaire fonctionnel ou d'adresse de contact ; connecter seulement les coordonnées validées.
- Exécuter le build Astro, corriger les erreurs et fournir un aperçu avant toute bascule du domaine.
- Ne modifier aucun DNS MX, SPF, DKIM, DMARC ni aucun réglage Mailcow/SMTP2GO du domaine. Le courrier Eonova fonctionne déjà et doit rester intact.
- Aucun secret, identifiant d'hébergement ou métadonnée privée de la maquette n'est nécessaire à l'intégration.

## Livrable attendu
Projet Astro complet et compilable avec assets, README de démarrage, aperçu de validation et résumé clair des changements. Ne pas présenter la version comme testée visuellement avant de l'avoir effectivement vérifiée.
