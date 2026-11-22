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

Le build est dans `dist/`. L’indexation nécessite **à la fois** `VERCEL_ENV=production` et `SITE_INDEXABLE=true`. Les builds locaux et les préviews restent `noindex`, même si le drapeau de production est hérité. Domaine canonique : **https://www.eonovastudios.com/**. Le sitemap contient les six pages publiques et leurs liens de langue ; `/robots.txt` annonce ce sitemap en production. `/admin/` et `/api/` sont exclus de l’indexation. Le build contrôle ces règles avant tout déploiement.

Hébergement : projet Vercel `eon2`, domaine public `www.eonovastudios.com`. Les aperçus restent distincts de la production. Configuration dans `vercel.json`.

Chat visiteurs : Olivia IA 3.5, avec passerelle et tenant dédiés. Voir [la documentation de connexion](docs/olivia.md). Vérification du contrat API : `npm test`.

Les traductions partagées sont centralisées dans `src/i18n/translations.json` et rendues au build. Contact public unique : **info@eonovastudios.com** (contact, pied de page et confidentialité dans les trois langues). Les pages de confidentialité sont `/aviso-de-privacidad/`, `/en/privacy-policy/` et `/fr/confidentialite/`. Elles décrivent le traitement des données sur le site EON, son hébergement Vercel et le service Olivia, avec le contact EON.

Depuis `/admin/`, **Editar mi página** permet de modifier les textes directement sur le design, avec aperçu ordinateur, tablette et mobile. Les rubriques proposent aussi un éditeur visuel avec negrita, énfasis et sauts de ligne. **Fotos, videos y logo** gère le logo commun de l’en-tête et du pied de page, les photos et vidéos MP4/WebM des quatre emplacements, une bibliothèque réutilisable et le cadrage sans altérer les originaux. Images : 25 Mo ; vidéos : 100 Mo.

La sauvegarde CMS est opérationnelle. Le bouton de publication autonome reste désactivé tant que le jeton permanent `VERCEL_DEPLOY_TOKEN` n’est pas configuré dans Vercel Production (la session CLI ne peut pas le créer : HTTP 403). Les déploiements manuels fonctionnent via `vercel deploy --prod --yes`.

Les métadonnées comprennent les titres et descriptions par langue, les liens canoniques et hreflang, Open Graph, les cartes sociales et les données structurées Organization / WebSite / WebPage. L’entité utilise uniquement les coordonnées EON connues ; aucune adresse ou information juridique n’est inventée.

Les images fixes venant du CMS sont optimisées au build en WebP et AVIF, avec plusieurs largeurs adaptées aux écrans et aux écrans Retina, sans agrandissement ni recadrage des fichiers. Le logo utilise un WebP sans perte pour préserver les contours et la transparence. Les dimensions intrinsèques, descriptions accessibles et priorités de chargement sont renseignées. Les animations GIF/WebP et les vidéos sont conservées ; les originaux restent dans Directus. Les couleurs, typographies, animations et règles CSS de présentation du site restent les mêmes.
