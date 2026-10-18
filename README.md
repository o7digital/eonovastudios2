# EON NOVA STUDIOS

Site statique Astro, en espagnol, issu de la maquette fournie. Node.js 22.12+ requis.

```sh
npm ci
npm run dev
npm run build
npm run preview
```

Les composants sont dans `src/components`, les animations Canvas dans `src/scripts/studio.js`. Polices hébergées localement. Les fichiers de référence originaux sont conservés dans `reference/original` et ne sont jamais copiés dans le site public.

Le build est dans `dist/`. Les aperçus sont `noindex` par défaut. L'indexation est activée par `SITE_INDEXABLE=true`, uniquement après validation du domaine final. Canonical : https://eonovastudios.com/. Aucun changement DNS ou courrier n'est nécessaire.

Ne pas relier le domaine avant validation de l'aperçu. Hébergement : projet Vercel `eon2`, aperçu indépendant du site historique. Configuration dans `vercel.json`.

Chat visiteurs : Olivia IA 3.5, avec passerelle et tenant dédiés. Voir [la documentation de connexion](docs/olivia.md). Vérification du contrat API : `npm test`.
