# Olivia IA 3.5 — EON NOVA STUDIOS

Le panneau reprend le design crème et anthracite du widget de `o7digital/suitesmine-bot`, avec les accents verts EON NOVA. Le Shadow DOM isole ses styles des animations du site. Le chat reste en espagnol et demande un accord avant tout envoi ; les réponses sont affichées en texte brut.

## Connexion

Navigateur → fonction Vercel `POST /api/olivia` → passerelle authentifiée `https://olivia.o7digitalgroup.com/eon2/chat` → moteur privé Olivia **3.5.0** `/v1/chat`.

Tenant fixé côté serveur : `eon-nova-studios`. Compte de service dédié, contexte approuvé dans `infrastructure/olivia/knowledge.txt`, identifiants de conversation signés et limite de 12 messages par IP/minute. Le navigateur ne reçoit ni clé de passerelle ni identifiants Olivia. La fonction filtre les origines, le consentement, la taille et le format des requêtes. La passerelle n'expose aucun outil ni action du moteur.

La clé sensible `OLIVIA_GATEWAY_KEY` est configurée dans l'environnement Vercel production. Les déploiements preview nécessitent leur propre configuration côté hébergeur pour utiliser le chat ; sans clé, l'API renvoie une indisponibilité explicite.

Fichiers VPS : `/opt/o7/apps/eon2-olivia`. `.env` et `.owner-credentials.json` restent privés sur le serveur. Les fichiers suivis de la passerelle sont dans `infrastructure/olivia`. La route Nginx exacte `/eon2/chat` rejoint uniquement cette passerelle. Le moteur reste privé ; aucun DNS ni réglage de messagerie modifié.

## Périmètre

Design digital, animation 2D/3D, courts métrages et séries animées. Série 2D propre en développement, sans titre ni date inventés. Les explorations du Motion Lab ne sont pas un portfolio client. Aucun prix, délai ou contact non validé. Le chat ne collecte pas de leads et ne promet pas d'envoi ou de suivi commercial.

## Vérification et maintenance

`npm test` vérifie le contrat API et la protection des identifiants. `npm run build` construit le site statique ; Vercel déploie aussi la fonction native `api/olivia.mjs`.

Après modification des instructions, recopier `gateway.mjs` et `knowledge.txt` dans le dossier VPS, mettre à jour le contexte documentaire du tenant si nécessaire et recréer uniquement `eon2-olivia-gateway`. Ne pas modifier le moteur partagé.

Pour retirer le chat : enlever `OliviaAI` du layout et redéployer. Sa passerelle dédiée peut être arrêtée sans arrêter les autres sites.
