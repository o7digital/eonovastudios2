# EON NOVA STUDIOS

Site statique Astro en espagnol (`/`), anglais (`/en/`) et français (`/fr/`), issu de la maquette fournie. Node.js 22.12+ requis.

```sh
npm ci
npm run dev
npm run build
npm run preview
```

Les composants sont dans `src/components`, les animations Canvas dans `src/scripts/studio.js`. Polices hébergées localement. Les fichiers de référence originaux sont conservés dans `reference/original` et ne sont jamais copiés dans le site public.

Administration de contenu : **EON NOVA Studio**, interface sur mesure hébergée sur Railway et reliée à Directus. Connexion, textes en trois langues et médiathèque : [guide du Studio](cms/studio/README.md). Sauvegardes et migration future vers VPS : [guide du CMS](cms/README.md). Le build charge le CMS lorsque `DIRECTUS_URL` et `DIRECTUS_READ_TOKEN` sont configurés ; sans ces variables, il utilise les contenus locaux.

Le Studio inclut aussi un agenda privé avec export ICS, le carnet de contacts EON, les brouillons et calendriers des réseaux sociaux, et l'éditeur de mailings/newsletters avec aperçu et journal. Les communications utilisent l'espace O7 existant d'EON. Les envois exigent la configuration de l'expéditeur ou des comptes sociaux et une confirmation dans l'interface ; aucun envoi n'est déclenché par une simple sauvegarde.

Le build est dans `dist/`. Les aperçus sont `noindex` par défaut. L'indexation est activée par `SITE_INDEXABLE=true`, uniquement après validation du domaine final. Canonical : https://eonovastudios.com/. Aucun changement DNS ou courrier n'est nécessaire.

Ne pas relier le domaine avant validation de l'aperçu. Hébergement : projet Vercel `eon2`, aperçu indépendant du site historique. Configuration dans `vercel.json`.

Chat visiteurs : Olivia IA 3.5, avec passerelle et tenant dédiés. Voir [la documentation de connexion](docs/olivia.md). Vérification du contrat API : `npm test`.

Les traductions partagées sont centralisées dans `src/i18n/translations.json` et rendues au build. Les pages de confidentialité sont `/aviso-de-privacidad/`, `/en/privacy-policy/` et `/fr/confidentialite/`. Elles reprennent les informations publiées sur https://www.o7digital.com/privacy-policy et précisent le traitement des conversations Olivia. Le contact utilise l’adresse o7 publiée sur cette page.
