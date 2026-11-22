# EON NOVA Studio

Interface éditoriale sur mesure : https://studio-production-3757.up.railway.app

L'adresse `https://www.eonovastudios.com/admin/` ouvre ce Studio. La navigation, la connexion, les formulaires et la médiathèque sont propres à EON NOVA. Directus reste le stockage des contenus et des images, avec un accès technique distinct.

## Utilisation

L’interface du Studio est en espagnol pour le Mexique (`es-MX`) : connexion, navigation, formulaires, confirmations et erreurs propres au Studio. Les dates et le calendrier utilisent ce format ; le fuseau horaire reste celui du navigateur. Le choix Español / Inglés / Francés dans l’éditeur concerne uniquement les contenus du site et ne change pas la langue de l’administration.

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

Dans chaque rubrique, le vrai design est l’éditeur principal, comme dans Nathalie Studio. La barre **Ubicación → Subir foto / Subir video** permet de choisir directement un emplacement et transférer un fichier depuis l’ordinateur. Photos : JPG, PNG, WebP, AVIF ou GIF jusqu’à 25 Mo ; vidéos : MP4 ou WebM jusqu’à 100 Mo. Le logo accepte les images. Le mode **Vista previa** permet de lire les vidéos avant publication. Cliquer sur un texte pour écrire dans la page ou le panneau latéral ; cliquer sur une image ou le logo pour choisir un fichier, voir le résultat immédiatement et enregistrer les textes et les médias avec **Guardar cambios**. Les fichiers transférés restent des changements à enregistrer : ils ne remplacent pas le média du site avant cette sauvegarde. Les champs de texte détaillés restent disponibles dans **Campos de texto y opciones de idioma**, replié par défaut. Choisir Español, Inglés ou Francés pour modifier une version. Les trois langues sont éditables ; aucune traduction automatique n'est exécutée. La recherche filtre les textes de la rubrique. Les saisies non enregistrées restent en mémoire pendant la navigation dans le Studio. Un rechargement ou une fermeture peut les perdre : le navigateur affiche un rappel. La déconnexion demande une confirmation en présence de saisies.

Le menu du Studio reprend le logo enregistré dans le CMS et le bouton **Cambiar mi logo** ouvre directement son remplacement et son réglage de taille. Le logo choisi est conservé après sauvegarde et rechargement. La page de connexion reprend le logo déjà publié sur le site public ; elle ne lit aucun fichier privé du CMS.

Les titres conservent les balises inline existantes (`br`, `em`, `span`, `strong`) pour préserver leur mise en forme sur le site. Le rendu public filtre les balises et attributs non autorisés.

Les images se gèrent par emplacement : accueil, studio, service graphique et service digital. Ajouter ou remplacer le fichier, vérifier son rendu, puis enregistrer. Aucune saisie de description n’est obligatoire. **Más opciones** ouvre les réglages de cadrage, la bibliothèque et les descriptions facultatives ; les champs de langue sont repliés par défaut. Une description spécifique déjà enregistrée est conservée. Si elle est vide, une description localisée de l’emplacement est utilisée ; aucune description visuelle n’est inventée ni générée par IA. Formats : JPG, PNG, WebP, AVIF, GIF ; 25 Mo maximum. **Retrouver l'original** archive l'enregistrement, sans supprimer le fichier, et rétablit le visuel intégré au prochain déploiement.

Enregistrer et publier sont deux étapes distinctes : **Guardar cambios** conserve les textes, puis **Publicar mi sitio**, accessible dans la même barre, lance le build public après confirmation. Attendre sa fin avant de recharger le site. Les statuts Publié/Brouillon/Archivé gardent le comportement décrit dans [le guide CMS](../README.md).

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

## Édition visuelle et médias (novembre 2026)

**Editar mi página** affiche le vrai design dans un cadre privé, sans exécuter les scripts du site. Cliquer sur un texte permet de le modifier dans la page ou dans le panneau latéral. Cliquer sur une image ouvre l’inspecteur avec **Subir foto o video**, sans formulaire obligatoire. Les modes **Editar página / Vista previa**, l’agrandissement et l’onglet **Contenido** reprennent le parcours de Nathalie Studio. La taille du logo se règle directement dans cet inspecteur et reste en attente de **Guardar cambios**, comme les textes et les photos. Les trois langues et les tailles ordinateur, tablette et mobile sont disponibles. Les règles de clic de l’aperçu réactivent explicitement les textes que le design public rend non interactifs, notamment le titre et la description d’accueil. Les textes des expériences interactives restent aussi accessibles dans les rubriques. Les champs des rubriques utilisent désormais un éditeur visuel : negrita, énfasis, sauts de ligne, annuler/rétablir et couleur du texte. Sélectionner les lettres dans la page ou le panneau, puis choisir **Color** ou saisir un code **HEX** (par exemple `#FF6600`) et cliquer sur **Aplicar**. Sans sélection, la couleur s’applique à tout le texte actif. **Guardar cambios**, puis **Publicar mi sitio** conservent cette couleur sur le site public. Seules les balises inline autorisées sont conservées.

**Fotos, videos y logo** propose cinq emplacements : logo (en-tête et pied), accueil, studio, graphique, digital. Le logo exige une image ; les quatre autres acceptent aussi MP4 et WebM. Le réglage **Tamaño del logo** choisit une hauteur de 40 à 120 px (80 px par défaut), conservée après sauvegarde et publication. Les marges entièrement transparentes sont retirées avec le même calcul dans l’éditeur et au build. Le fichier original reste intact. La version mobile utilise 70 % de la hauteur choisie et adapte le menu. Images : 25 Mo, vidéos : 100 Mo. Upload avec progression, bibliothèque réutilisable des 100 fichiers les plus récents, aperçu privé, ajustement cover/contain et position horizontale/verticale. Les originaux sont conservés. Les vidéos publiques utilisent le lecteur natif, sans lecture automatique sonore. Les requêtes partielles permettent de déplacer la tête de lecture.

La migration additive `cms/upgrade-media.mjs` ajoute les champs de cadrage et le choix de logo ; elle ne remplace aucun contenu existant. Le bootstrap inclut ces champs pour une future installation. Le compte build garde ses droits de lecture existants. Les fichiers du site sont copiés dans le build public uniquement quand leur emplacement est inclus.

Les contrôles Firefox ont couvert une édition enregistrée puis restaurée, un upload de logo avec cadrage et un MP4 avec streaming partiel. Les fichiers et fiches de contrôle ont été supprimés.

## Comptes personnels et mots de passe

Chaque personne utilise son propre compte Directus. Le rôle **EON Studio editor** gère les textes, médias et rendez-vous, sans accès administrateur à Directus. L'adresse `STUDIO_OWNER_EMAIL` désigne la personne qui utilise les contacts et communications EON dans le Studio ; le compte technique O7 reste distinct.

Le menu **Mi cuenta** permet de remplacer son mot de passe avec vérification du mot de passe actuel et double saisie du nouveau (12 à 128 caractères). Les comptes créés avec `studio_password_temporary=true` peuvent utiliser toutes les fonctions autorisées du Studio immédiatement, sans changement de mot de passe imposé. Le titulaire peut choisir son mot de passe personnel quand il le souhaite dans **Mi cuenta**. Le changement renouvelle la session et efface le statut temporaire.

Préparation idempotente du champ, des rôles et de la connexion serveur :

```sh
railway run --no-local --service directus --environment production -- node cms/studio/provision-accounts.mjs
```

Le plan Core ne permet pas les règles personnalisées de permissions par ligne ou champ. Le service de compte a donc accès à la collection utilisateurs, exclusivement via le secret serveur `STUDIO_ACCOUNT_WRITE_TOKEN`. Aucun compte éditorial n'obtient ce jeton ou les permissions de ce service. La route publique ne reçoit jamais d'identifiant de compte à modifier : elle utilise l'identité de la session, vérifie à nouveau le mot de passe actuel et n'écrit que `password` et `studio_password_temporary`. Les échecs sont limités à cinq essais par période de dix minutes. Ne jamais accorder les permissions du service au rôle éditeur.

La création d'un compte personnel actif avec un mot de passe temporaire ne déclenche aucun e-mail d'invitation. Les mots de passe ne doivent figurer ni dans Git ni dans les journaux de déploiement. Préserver le jeton de service lors d'une migration VPS.

## Blog, Mi Book y Noticias

Chaque rubrique dispose de son propre interrupteur **Activar sección / Desactivar sección** et de publications libres. **Nueva publicación** crée une fiche avec titre, introduction, adresse et blocs de texte WYSIWYG, photos ou vidéos. Les blocs se réordonnent avec les flèches ; **Vista previa** montre le résultat avant sauvegarde. Photos : 25 Mo ; vidéos MP4/WebM : 100 Mo. Le texte peut utiliser la palette et les codes HEX existants.

L’espagnol est requis, les traductions anglaise et française sont facultatives. Une traduction absente reprend l’espagnol. **Borrador** et **Archivado** conservent la fiche hors du site ; **Listo para publicar en el sitio** l’inclut au prochain build si sa rubrique est activée. **Guardar publicación** conserve les données dans Directus. **Publicar mi sitio** applique les états et contenus au site public. Désactiver une rubrique retire ses liens, ses pages et son sitemap au prochain build, sans effacer ses publications. Les nouvelles rubriques sont initialement désactivées.

Les collections `journal_sections` et `journal_entries` sont ajoutées par `cms/upgrade-journal.mjs`, qui ne modifie aucun texte, logo ou compte existant. La politique EON Studio editor peut lire et mettre à jour les rubriques, puis lire, créer et mettre à jour les publications. Website build reçoit uniquement la lecture. Aucune lecture anonyme du CMS n’est ajoutée. Les fichiers publiés passent par le build Vercel ; les brouillons et rubriques désactivées ne sont pas exportés.

## Enlaces de redes

**Enlaces de redes** gère les URL publiques de Facebook, Instagram, TikTok, YouTube, Vimeo, LinkedIn, Behance, Dribbble, Pinterest, X et Threads. **Agregar otra red** ajoute un lien avec un nom libre. Chaque réseau possède son interrupteur : une URL vide reste désactivée, et un réseau désactivé conserve son URL. **Guardar enlaces**, puis **Publicar mi sitio** appliquent les liens au pied de page dans toutes les langues. Les réseaux sans URL ou désactivés ne sont pas affichés. Aucune URL de Jorge n’est devinée : les réglages initiaux sont vides et désactivés.

La migration additive `cms/upgrade-social-links.mjs` crée `social_links` et accorde la lecture à Website build et la lecture/création/modification à EON Studio editor. Elle conserve les valeurs déjà enregistrées. Les URL sont limitées aux liens HTTP/HTTPS sans identifiant ni mot de passe ; aucun jeton de réseau social n’est utilisé.
