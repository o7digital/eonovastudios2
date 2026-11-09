# EON NOVA · Content Studio

Studio éditorial : https://studio-production-3757.up.railway.app

Le site expose aussi `/admin/`, qui ouvre l'interface EON NOVA sur mesure. Le [guide du Studio](studio/README.md) décrit son utilisation quotidienne. Directus **12.6.1** et PostgreSQL **18** conservent les données dans le projet Railway `eon-nova-cms`, environnement `production`. L'administration technique Directus reste sur https://directus-production-7591.up.railway.app/admin/. Les identifiants non sensibles sont dans `deployment.json`. Le site reste hébergé par Vercel, projet `eon2`, sources sur la branche `dev`. Aucun VPS existant n'a été modifié.

## Se connecter

Le compte propriétaire est `olivier.steineur@icloud.com`. Son mot de passe initial aléatoire est dans **Railway → eon-nova-cms → production → directus → Variables → ADMIN_PASSWORD**. Aucun mot de passe n'est suivi dans Git. Après un changement de mot de passe dans Directus, la variable d'installation ne reflète plus le mot de passe courant. Le service mail de réinitialisation n'est pas configuré.

Le Studio reprend les couleurs du site avec une connexion dédiée, une navigation par rubrique, des formulaires et une médiathèque. Le plan Core Directus suffit aux collections et aux comptes utilisés. Aucun plan Directus payant n'a été souscrit ; l'hébergement des trois services, les volumes et les sauvegardes Railway sont facturés sur le compte existant.

Directus peut demander de déclarer le propriétaire du projet et d'accepter ses conditions à la première connexion. Cette formalité reste à effectuer par le propriétaire ; aucune acceptation n'a été faite en son nom.

## Contenus stockés dans Directus

- **Textes & traductions** : 138 textes d'origine, classés par rubrique. Modifier Español, English et Français. Les clés techniques sont masquées et les libellés conservés pour retrouver les textes. Le Motion Lab utilise les mêmes contenus, y compris lors du changement de discipline.
- **Images du site** : un visuel facultatif pour l'accueil, le studio, le service graphique et le service digital. Choisir l'emplacement, importer une image et fournir les trois descriptions accessibles. Formats : JPG, PNG, WebP, AVIF, GIF, 25 Mo maximum. Archiver l'image rétablit l'illustration animée d'origine.
- **Publié** inclut un enregistrement dans le prochain build. **Brouillon** et **Archivé** l'excluent. Un texte exclu reprend sa valeur intégrée d'origine ; cela ne conserve pas la dernière modification publiée. Utiliser les versions de contenu pour préparer une révision tout en conservant la fiche publiée, puis promouvoir la version avant la publication du site.

Les champs texte conservent leur mise en forme inline : `<br>`, `<em>`, `<strong>`, `<span>`. Les scripts, attributs et autres balises sont supprimés au rendu. Les liens de navigation, adresses de contact, métadonnées SEO et animations restent dans le code.

Dans le Studio, **Enregistrer la rubrique** conserve les contenus ; la publication automatique reste désactivée jusqu'à sa connexion ultérieure. Dans Directus technique, le bouton **Publier** d'une fiche enregistre également son contenu. Le Flow **Publier le site** est préparé, mais ne peut pas aboutir sans le jeton Vercel permanent. Une fois connecté, il génère le site avec les fiches marquées Publié. La version précédente reste accessible jusqu'au build réussi. Une erreur de traduction, d'image ou de lecture du CMS fait échouer le nouveau build.

## Connexion de la publication automatique

Les variables de production Vercel `DIRECTUS_URL`, `DIRECTUS_READ_TOKEN` et `CMS_PUBLISH_SECRET` sont configurées. Le Flow et la fonction `POST /api/cms-publish` sont préparés.

**Il manque un jeton permanent Vercel.** La session CLI autorise les déploiements manuels mais refuse la création d'un jeton (`Cannot create tokens for this app`, HTTP 403). Son jeton temporaire expire et n'est pas utilisé comme secret de publication.

Créer un jeton dédié depuis https://vercel.com/account/settings/tokens, avec accès au projet `eon2`, puis l'enregistrer dans la variable **Production** `VERCEL_DEPLOY_TOKEN` et redéployer. Le jeton reste uniquement dans la fonction serveur Vercel. Ne jamais le placer dans Directus, dans Git ou dans une variable `PUBLIC_*`. Après connexion, vérifier le Flow jusqu'à un déploiement `READY`, puis mettre à jour le panneau d'accueil avec `CMS_PUBLISH_READY=true` lors du bootstrap.

L'endpoint refuse les appels sans le secret dédié, fixe le projet, la branche `dev` et la cible production, et limite les publications rapprochées. Il ne modifie pas la branche de production Git configurée dans Vercel. Les futurs commits de `dev` doivent être vérifiés par GitHub pour les déploiements via API ; utiliser une signature reconnue ou `createCommitOnBranch` avec contrôle du commit parent. Ne pas désactiver l'exigence de commits vérifiés.

Publication manuelle avec les accès CLI existants :

```sh
vercel deploy --prod --yes
```

## Lecture et builds

`npm run build` prépare un instantané dans `.cms/` et les images dans `public/_cms/` **avant** le build Astro. Ces dossiers sont ignorés par Git. Les images sont ensuite servies par Vercel ; le navigateur ne reçoit aucun jeton Directus et n'a pas besoin du CMS pour consulter le site. `npm run dev` effectue la même préparation.

Sans `DIRECTUS_URL`, les contenus intégrés sont utilisés. Avec cette variable, un jeton de lecture est obligatoire et toute erreur bloque le build. Les trois langues doivent être remplies. Les préviews Vercel non configurées conservent les contenus locaux ; les variables CMS sont actuellement configurées pour la production.

L'identité `Website build` a uniquement accès en lecture aux deux collections et aux fichiers. Aucun accès anonyme aux contenus ou médias éditoriaux. Le plan Core n'autorise pas les filtres de permissions avancés : le compte serveur peut lire les brouillons, et le loader ne sélectionne que `published`. Les éléments de marque nécessaires à la connexion sont accessibles par Directus.

Réexécuter la configuration avec les secrets Railway, sans les imprimer :

```sh
railway run --no-local --service directus --environment production -- node cms/bootstrap.mjs
```

Le bootstrap conserve les valeurs éditées. Il recrée les textes initiaux supprimés : les archiver plutôt que les supprimer. Un changement du mot de passe propriétaire impose de fournir le mot de passe courant au bootstrap.

## Persistance, sauvegardes et VPS

Railway conserve PostgreSQL et `/directus/uploads` dans deux volumes distincts. Les sauvegardes natives quotidiennes et hebdomadaires sont activées sur les deux. Prévoir aussi une copie chiffrée hors Railway et un exercice de restauration ; ces deux étapes ne sont pas automatisées ici.

La configuration du service Directus est reproduite dans `railway.json`. Railway démarre le conteneur avec `RAILWAY_RUN_UID=0` pour attribuer le volume au compte `node`, puis lance Directus sous ce compte. Le health check utilise `/server/ping`.

`compose.yaml` prépare la future instance sur VPS. Cible de dimensionnement pour ce CMS et sa base : **2 vCPU / 4 Go de RAM**, à ajuster aux autres services et aux tailles des médias. Ce dimensionnement reste à valider par mesure ; il ne réserve ni ne provisionne un VPS.

1. Préparer Docker Compose, un reverse proxy HTTPS et les sauvegardes sur le futur VPS. Garder le port 8055 limité à localhost. Copier `.env.example` vers `.env` et renseigner les secrets hors Git.
2. Suspendre brièvement les écritures et exporter PostgreSQL avec `pg_dump` version 18 (`-Fc`). Copier **tout** le volume uploads. Conserver le `SECRET` Directus, les comptes, rôles, jetons et identifiants de fichiers.
3. Restaurer dans PostgreSQL 18 avec `pg_restore --no-owner --no-privileges -U eon_nova -d eon_nova`. Copier les médias dans le volume uploads et attribuer les fichiers au compte Directus (`node`, UID/GID à vérifier dans l'image). Ne pas démarrer contre une base vide en conservant seulement les médias.
4. Lancer la configuration avec `docker compose --env-file .env -f compose.yaml up -d`. Tester la connexion, une édition, un upload et un build avec une URL HTTPS temporaire. Les montages PostgreSQL sont adaptés à l'image officielle PostgreSQL 18.
5. Après validation, effectuer une dernière synchronisation pendant la suspension des écritures, modifier `PUBLIC_URL` sur le VPS et `DIRECTUS_URL` dans Vercel, puis redéployer le site. Mettre à jour `deployment.json`, la cible de bootstrap et la route `/admin/` générée.
6. Garder Railway sans nouvelles écritures pendant la validation. Pour revenir en arrière, rétablir l'ancienne URL et redéployer. Les nouvelles écritures sur le VPS nécessitent une resynchronisation avant tout retour.

Les variables de publication restent dans Vercel ; le Flow restauré conserve son URL et son secret d'appel, donc la migration du CMS ne nécessite pas de changer le site public ni son DNS.
