# ROSLEN SETUP — version prête pour GitHub + Netlify

Cette version inclut :
- Page d’accueil blanc/orange et logo ROSLEN
- Six panneaux matériel et six liens Amazon fournis
- Version FR/EN, avec sélecteur de langue
- Lecteur Twitch (actif uniquement sur un site web HTTPS hébergé)
- Section des trois dernières vidéos YouTube synchronisées via une fonction Netlify

## Structure
- `public/index.html` : tout le site
- `netlify/functions/latest-videos.js` : récupère le flux RSS YouTube de @roslen_tv
- `netlify.toml` : publie `public` et route `/api/latest-videos` vers la fonction

## Envoi sur GitHub
1. Décompresser cette archive sur ton ordinateur.
2. Ouvrir https://github.com/roslen94/roslen-setup
3. Cliquer « uploading an existing file » (ou Add file > Upload files).
4. Déposer les éléments qui se trouvent DANS le dossier décompressé : `public/`, `netlify/` et `netlify.toml` (ainsi que ce README facultatif). Garder cette structure ; ne pas déposer le ZIP lui-même.
5. Cliquer « Commit changes ».

Si ton navigateur ne permet pas d’importer les dossiers directement, utilise GitHub Desktop pour ajouter et publier le contenu du dossier local.

## Mise en ligne sur Netlify
1. Sur https://app.netlify.com/start choisir l’import d’un projet existant depuis GitHub.
2. Autoriser Netlify à accéder au dépôt `roslen94/roslen-setup`.
3. Laisser Netlify lire `netlify.toml`, qui configure le dossier à publier (`public`) et les fonctions (`netlify/functions`).
4. Cliquer Deploy et ouvrir l’adresse en `.netlify.app`.
5. Vérifier `https://TON-SITE.netlify.app/api/latest-videos` : le résultat JSON doit présenter 3 vidéos réelles.
6. Vérifier Twitch sur le vrai domaine et tester les six liens Amazon.

## Si YouTube ne charge pas
La fonction tente de trouver l'identifiant YouTube permanent « UC... » depuis `@roslen_tv`.
Si le lien `/api/latest-videos` affiche une erreur « Unable to resolve YouTube channel ID », trouve l’ID dans YouTube Studio > Paramètres > Chaîne > Paramètres avancés.
Ajoute sur Netlify une variable d'environnement `YT_CHANNEL_ID` égale à cet ID puis redéploie le site.

La page vérifie les nouvelles vidéos toutes les 2 minutes tant qu'elle reste ouverte. Le flux RSS de YouTube peut être en retard de quelques minutes ; ce n'est pas une notification instantanée.

Les liens Amazon ont été fournis par l'utilisateur ; vérifier leur destination avant la publication. Les déclarations de partenariat figurent sur le site.
