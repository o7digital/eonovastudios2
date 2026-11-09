# EON NOVA Studio

Interface éditoriale sur mesure : https://studio-production-3757.up.railway.app

L'adresse `https://www.eonovastudios.com/admin/` ouvre ce Studio. La navigation, la connexion, les formulaires et la médiathèque sont propres à EON NOVA. Directus reste le stockage des contenus et des images, avec un accès technique distinct.

## Utilisation

Se connecter avec les identifiants EON existants. Le mot de passe initial se trouve dans Railway → `eon-nova-cms` → `production` → `directus` → `ADMIN_PASSWORD`, sauf si le propriétaire l'a changé depuis.

Le menu suit le site : **Vue d'ensemble, Accueil, Motion Lab, Le studio, Services & contact, Pied de page, Langues & interface, Images du site**. Les compteurs proviennent des contenus réels. Les liens « Voir la rubrique » ouvrent la bonne langue et la bonne ancre du site.

Dans chaque rubrique, choisir Español, English ou Français, modifier les champs puis utiliser **Enregistrer la rubrique**. Les trois langues sont éditables ; aucune traduction automatique n'est exécutée. La recherche filtre les textes de la rubrique. Les saisies non enregistrées restent en mémoire pendant la navigation dans le Studio. Un rechargement ou une fermeture peut les perdre : le navigateur affiche un rappel. La déconnexion demande une confirmation en présence de saisies.

Les titres conservent les balises inline existantes (`br`, `em`, `span`, `strong`) pour préserver leur mise en forme sur le site. Le rendu public filtre les balises et attributs non autorisés.

Les images se gèrent par emplacement : accueil, studio, service graphique et service digital. Ajouter ou remplacer le fichier, remplir ses descriptions dans les trois langues, puis enregistrer. Formats : JPG, PNG, WebP, AVIF, GIF ; 25 Mo maximum. **Retrouver l'original** archive l'enregistrement, sans supprimer le fichier, et rétablit le visuel intégré au prochain déploiement.

Enregistrer et publier sont deux étapes distinctes. Le bouton de publication est **préparé mais désactivé**, conformément au choix du propriétaire. Les contenus peuvent déjà être enregistrés et être inclus dans un déploiement manuel du site. Les statuts Publié/Brouillon/Archivé gardent le comportement décrit dans [le guide CMS](../README.md).

## Déploiement et secrets

Projet Railway `eon-nova-cms`, environnement `production`, service `studio`. Le service a son propre secret de session. Il conserve seulement les fichiers applicatifs ; les données restent dans les volumes Directus et PostgreSQL existants.

Variables serveur : `DIRECTUS_URL`, `STUDIO_ORIGIN` (origine HTTPS exacte, sans slash final), `STUDIO_SESSION_SECRET` (32 caractères minimum), `NODE_ENV=production`, `PORT=4381`. Les secrets ne sont ni dans Git ni dans le navigateur.

Le cookie de session est chiffré et authentifié par AES-256-GCM, HttpOnly, Secure en production, SameSite Strict, avec une durée maximale de huit heures. Les jetons de l'utilisateur sont renouvelés côté serveur et restent dans le cookie chiffré. Chaque requête utilise les permissions Directus du compte connecté. Aucun jeton administrateur partagé n'est utilisé. Les écritures exigent l'origine du Studio ; les routes et champs sont limités aux contenus EON. Les médias exigent une session et ont un cache privé. La publication reste refusée côté serveur tant qu'elle est désactivée.

Pour connecter la publication plus tard, renseigner `VERCEL_DEPLOY_TOKEN` dans Vercel production et redéployer le site, puis passer `STUDIO_PUBLISH_ENABLED=true` sur le service `studio` et le redéployer. `CMS_PUBLISH_SECRET` doit correspondre au secret de la fonction Vercel ; il est déjà configuré sur le service. L'interface confirme une demande de build, jamais une réussite anticipée du déploiement.

Déploiement depuis la racine du dépôt :

```sh
railway up cms/studio --path-as-root --service studio --environment production --detach
```

Le Dockerfile utilise seulement Node 24 et des fichiers locaux, sans installation de dépendances. Les polices DM Sans et Space Grotesk sont servies localement et leurs licences sont incluses dans l'image. `/health` vérifie le processus. Le contexte de build est `cms/studio`, avec son propre `railway.json`.

Le [Compose du CMS](../compose.yaml) inclut le Studio pour la future migration VPS. Conserver `STUDIO_SESSION_SECRET`, restaurer la base et les images, mettre à jour `STUDIO_ORIGIN`, installer le proxy HTTPS du Studio et modifier `STUDIO_URL` dans Vercel. Les identifiants utilisateurs restent dans Directus.

## Vérifications

```sh
npm --prefix cms/studio run check
npm --prefix cms/studio test
npm test
npm run build
```

Les tests serveur couvrent les sessions, l'origine des écritures, les champs non autorisés, la validation des lots avant écriture, les permissions de lecture seule et la publication différée. Les contrôles navigateur utilisent le vrai CMS pour la connexion et une édition temporaire, puis restaurent la valeur d'origine. Les fichiers et enregistrements temporaires de contrôle sont supprimés. Aucune publication automatique ni aucun envoi externe n'est exécuté.
