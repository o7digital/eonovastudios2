# EON NOVA Studio

Interface éditoriale sur mesure : https://studio-production-3757.up.railway.app

L'adresse `https://www.eonovastudios.com/admin/` ouvre ce Studio. La navigation, la connexion, les formulaires et la médiathèque sont propres à EON NOVA. Directus reste le stockage des contenus et des images, avec un accès technique distinct.

## Utilisation

Se connecter avec les identifiants EON existants. Le mot de passe initial se trouve dans Railway → `eon-nova-cms` → `production` → `directus` → `ADMIN_PASSWORD`, sauf si le propriétaire l'a changé depuis.

Le menu suit le site : **Vue d'ensemble, Accueil, Motion Lab, Le studio, Services & contact, Pied de page, Langues & interface, Images du site**. Les compteurs proviennent des contenus réels. Les liens « Voir la rubrique » ouvrent la bonne langue et la bonne ancre du site.

Le groupe **Faire vivre le Studio** ajoute **Agenda, Contacts, Réseaux sociaux, Mailing & newsletter, Connexions**. Ces modules sont reliés à l'espace O7 existant d'EON NOVA ; les contenus de Nathalie ne sont ni utilisés ni copiés.

## Agenda, contacts et communications

- **Agenda** : calendrier mensuel privé, ajout et modification de rendez-vous, types (production, échéance, rendez-vous, événement, personnel), lieu, notes, statuts et export ICS authentifié. Les horaires sont enregistrés en UTC avec le fuseau IANA choisi. Les heures inexistantes ou ambiguës lors des changements d'heure sont refusées. L'export n'active aucune synchronisation Google Calendar.
- **Contacts** : création et édition dans le carnet O7 propre à EON, recherche et informations de relation. Ajouter un contact ne déclenche aucun message et ne l'inscrit pas automatiquement à une campagne.
- **Réseaux sociaux** : brouillons persistants, texte, photo ou vidéo, aperçu, comptes destinataires, calendrier et programmation jusqu'à 90 jours, confirmation avant envoi, annulation tant que l'envoi n'a pas commencé et journal par destination. Le moteur natif O7 couvre Instagram, Facebook, YouTube et X. Les autorisations et les publications réelles ne sont pas simulées.
- **Mailing & newsletter** : campagnes e-mail communes, objet, pré-en-tête, titre, paragraphes, image HTTPS, bouton, signature, aperçu HTML de la version enregistrée, brouillon ou prête à envoyer, sélection de 1 à 100 contacts, test personnel, envoi confirmé et brouillon Mailchimp. Le moteur ajoute les liens de désinscription et respecte les désinscriptions connues. La date éditoriale classe la campagne dans le planning ; elle ne programme pas un envoi automatique.
- **Connexions** : configuration SMTP/Mailcow et Mailchimp côté serveur ; les secrets ne sont jamais réaffichés. Les réseaux utilisent OAuth, un retour de connexion dédié et une sélection explicite des comptes. Enregistrer les réglages ne déclenche aucun envoi.

**État des connexions** : aucun expéditeur SMTP ni compte Mailchimp n'est encore configuré pour EON. Les applications O7 Meta, Google/YouTube et X n'ont pas encore leurs identifiants développeur. Les brouillons et le calendrier sont utilisables ; les actions qui exigent une connexion restent indisponibles. Le propriétaire doit fournir ses profils et son expéditeur, puis autoriser les comptes. Aucune clé d'application sociale ne doit être enregistrée dans Vercel ou dans le navigateur.

La sélection des destinataires inclut une confirmation du propriétaire. Un test part vers l'alias technique affiché dans la confirmation (`olivier.steineur+eon-studio@icloud.com`) ; le service ne choisit pas une autre adresse silencieusement. Le moteur O7 fixe l'identité d'expédition selon la connexion du client. Les actions d'envoi et de création de brouillon Mailchimp sont bloquées si leur connexion n'est pas configurée, avant la création d'une entrée de traitement.

Les brouillons et les écrans ont été contrôlés avec des données temporaires, puis nettoyés. Aucun e-mail, publication, invitation, achat ou paiement n'a été déclenché pendant la livraison.

### Stockage et raccordement O7

L'espace EON existant est le tenant `229dd065-2d9c-40fd-81e0-04e2ea009412`, souscription administrative `3ce2e29b-7ea7-4324-af19-aeb1d83fc077`. Le compte technique dédié occupe son unique siège existant. Le réglage Social est activé sur cette souscription existante, sans créer ni modifier une connexion Stripe, un tarif, une échéance ou un paiement. L'interface n'ouvre aucun checkout.

Les contacts, campagnes et publications restent dans l'API O7 `https://api.crm.o7digitalgroup.com/api`, déjà hébergée sur le VPS. L'agenda privé est dans `studio_events`, dans la base Directus EON ; les médias sociaux sont dans son dossier privé **EON NOVA · Réseaux sociaux**. Le compte Website build n'a aucune permission sur l'agenda. Le chargeur du site ne copie que les images explicitement référencées par les collections publiques.

Chaque requête de communication résout à nouveau le propriétaire depuis Directus, puis vérifie que l'identité O7 appartient au tenant EON fixé côté serveur. Les données `tenantId`, URL d'API et adresses OAuth envoyées par le navigateur ne servent jamais à choisir le client. Le compte technique n'est pas partagé avec Nathalie. Ses jetons restent en mémoire serveur. Les collaborateurs Directus non propriétaires peuvent toujours utiliser les rubriques auxquelles leurs permissions donnent accès ; ils ne reçoivent pas automatiquement l'accès aux contacts ou communications.

Les photos sociales sont optimisées en JPEG 1440 × 1440 ; les originaux sont conservés. Images : 25 Mo maximum ; vidéo MP4 : 250 Mo maximum, transférée en flux. Les médias ne sont accessibles anonymement que par une URL signée et limitée à une courte fenêtre autour de la publication explicitement approuvée. Cette URL est liée à la version du fichier. Les aperçus ordinaires nécessitent une session. Un résultat d'envoi ambigu reste à vérifier : aucun renvoi automatique susceptible de créer un doublon.

L'API O7 autorise explicitement l'origine du Studio EON pour les retours OAuth et médias, en conservant l'origine Nathalie existante. Un changement de domaine du Studio impose de mettre à jour `SOCIAL_ALLOWED_ORIGINS`, `SOCIAL_MEDIA_ORIGINS` et les URL de retour chez les fournisseurs. L'adresse actuelle de retour est `https://studio-production-3757.up.railway.app/social-callback.html`.

Initialisation de l'agenda et du dossier média, avec les variables Directus EON :

```sh
railway run --no-local --service directus -- node cms/studio/provision-suite.mjs
```

`provision-workspace.cjs` s'exécute seulement dans le conteneur de l'API CRM existante, avec une capture privée de stdout : il peut retourner le mot de passe du compte technique lors de sa création. Ne jamais afficher cette sortie ni la conserver dans Git. Une réexécution retrouve le compte sans renouveler son mot de passe. Les secrets sont conservés dans Railway sur le service Studio.

Variables supplémentaires : `ARM_API_URL`, `ARM_TENANT_ID`, `ARM_SERVICE_EMAIL`, `ARM_SERVICE_PASSWORD`, `STUDIO_OWNER_EMAIL`, `STUDIO_MEDIA_READ_TOKEN`. Préserver ces variables pour la migration du Studio sur VPS. Migrer Directus ne déplace pas les données de l'API O7 : elles restent dans son tenant et ses sauvegardes existants. L'export et la restauration du CRM sont des opérations séparées.

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
