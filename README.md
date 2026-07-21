# Élus School Pro

Application de gestion scolaire pour le **Complexe Scolaire Privé Bilingue Les Élus du Christ** (écoles Agouna et Avogbana).

> **État du projet — Phases 1 à 5 : application complète**
> Toutes les phases prévues sont livrées : fondations (connexion, rôles, écoles, PWA), Élèves, Académique, **Finances** (paramétrage des frais, paiements, reçus, réductions, retards, tableau de bord), et **Administration** (gestion des utilisateurs, journal des activités, rapports avec graphiques et export CSV, paramètres). Le détail de chaque module et quelques simplifications assumées sont expliqués plus bas.

---

## Ce dont vous avez besoin

- Un compte Google (pour Firebase).
- Un compte [GitHub](https://github.com) (gratuit).
- Un compte [Vercel](https://vercel.com) (gratuit, connexion possible directement avec GitHub).

Aucune installation de logiciel sur votre ordinateur n'est nécessaire.

---

## Étape 1 — Créer le projet Firebase

1. Allez sur [console.firebase.google.com](https://console.firebase.google.com) et connectez-vous avec votre compte Google.
2. Cliquez sur **Ajouter un projet**. Nommez-le par exemple `elus-school-pro`.
3. Désactivez Google Analytics si proposé (non nécessaire), puis **Créer le projet**.

### Activer l'authentification
1. Dans le menu de gauche : **Build > Authentication** > **Get started**.
2. Onglet **Sign-in method** > cliquez sur **E-mail/Mot de passe** > **Activer** > **Enregistrer**.
3. Onglet **Users** > **Add user** > créez le compte du tout premier Administrateur Général :
   - E-mail : `evangelisteanicette@gmail.com`
   - Mot de passe : choisissez un mot de passe fort et notez-le.

   *(C'est cette adresse exacte qui recevra automatiquement le rôle Administrateur Général dès sa première connexion à l'application.)*

### Activer Firestore (la base de données)
1. Menu de gauche : **Build > Firestore Database** > **Create database**.
2. Choisissez **Production mode**, puis une région proche (ex. `eur3 (europe-west)`).
3. Une fois créée, allez dans l'onglet **Rules**, effacez le contenu, et collez-y **tout le contenu du fichier `firestore.rules`** fourni dans ce projet. Cliquez sur **Publish**.

### Activer Storage (photos, logos, documents)
1. Menu de gauche : **Build > Storage** > **Get started** > suivez les étapes par défaut.

### Récupérer la configuration
1. Cliquez sur l'icône ⚙️ en haut à gauche > **Paramètres du projet**.
2. Dans l'onglet **Général**, descendez jusqu'à **Vos applications** > cliquez sur l'icône **</> (Web)**.
3. Donnez un nom (ex. `Élus School Pro Web`) > **Enregistrer l'application**.
4. Un bloc de code `firebaseConfig` apparaît. **Copiez ces valeurs.**

---

## Étape 2 — Coller la configuration dans le projet

1. Ouvrez le fichier **`js/firebase-config.js`**.
2. Remplacez les valeurs `COLLEZ_ICI_...` par celles copiées à l'étape précédente.
3. Enregistrez le fichier.

C'est le **seul fichier à modifier**. Ne touchez à rien d'autre.

---

## Étape 3 — Déposer le projet sur GitHub

1. Allez sur [github.com](https://github.com) et connectez-vous (ou créez un compte).
2. Cliquez sur **New repository**. Nommez-le `elus-school-pro`. Laissez-le **Public** ou **Private** selon votre préférence. Cliquez sur **Create repository**.
3. Sur la page du dépôt vide, cliquez sur **uploading an existing file**.
4. Glissez-déposez **tous les fichiers et dossiers de ce projet** (en gardant la même structure de dossiers : `css/`, `js/`, `assets/`, `index.html`, `manifest.json`, `service-worker.js`, `firestore.rules`, `README.md`).
5. Cliquez sur **Commit changes**.

---

## Étape 4 — Déployer sur Vercel

1. Allez sur [vercel.com](https://vercel.com) et connectez-vous **avec votre compte GitHub**.
2. Cliquez sur **Add New... > Project**.
3. Choisissez le dépôt `elus-school-pro` > **Import**.
4. Aucune configuration n'est nécessaire (le projet est un site statique). Cliquez sur **Deploy**.
5. Après quelques secondes, Vercel affiche un lien du type `elus-school-pro.vercel.app`. C'est l'adresse de votre application, accessible depuis un téléphone, une tablette ou un ordinateur.

### Installer l'application comme une vraie app
- **Android / ordinateur (Chrome/Edge)** : ouvrez le lien, une icône d'installation apparaît dans la barre d'adresse (ou menu ⋮ > "Installer l'application").
- **iPhone/iPad (Safari)** : ouvrez le lien > bouton Partager > **Sur l'écran d'accueil**.

---

## Étape 5 — Première connexion

1. Ouvrez l'application déployée.
2. Connectez-vous avec l'e-mail `evangelisteanicette@gmail.com` et le mot de passe défini à l'étape 1.
3. L'application vous attribue automatiquement le rôle **Administrateur Général**, crée les deux écoles de départ (Agouna, Avogbana) et initialise l'année scolaire active (2026-2027, modifiable ensuite).
4. Depuis le menu **Écoles**, vous pouvez consulter et ajouter des écoles.
5. Depuis le menu **Élèves**, vous pouvez inscrire un nouvel élève : le matricule (ex. `AGO-2026-0001`) est généré automatiquement et ne change plus jamais, même en cas de réinscription les années suivantes.
6. Depuis le menu **Utilisateurs**, créez les comptes Directeur, Comptable et Enseignant. Chaque nouvel utilisateur reçoit un e-mail Firebase pour définir lui-même son mot de passe — vous n'avez aucun mot de passe à communiquer.
7. Depuis **Finances > Paramètres des frais**, saisissez les montants d'inscription, des tranches et leurs échéances pour l'année scolaire active avant d'encaisser le premier paiement.

---

## Mettre à jour l'application plus tard

Quand une nouvelle phase du projet est livrée :
1. Remplacez les fichiers modifiés sur GitHub (bouton **Add file > Upload files**, en écrasant les anciens).
2. Vercel redéploie automatiquement la nouvelle version en quelques secondes — rien d'autre à faire.

---

## Structure du projet

```
elus-school-pro/
├── index.html              Page unique (écran de connexion + application)
├── manifest.json            Fiche d'identité de l'app installable (PWA)
├── service-worker.js        Fonctionnement hors ligne
├── firestore.rules          Règles de sécurité à publier dans Firebase
├── css/
│   └── styles.css           Habillage visuel (couleurs, typographie, mode sombre)
├── js/
│   ├── firebase-config.js   ⚠️ Seul fichier à modifier (vos identifiants Firebase)
│   ├── firebase-init.js     Connexion au projet Firebase
│   ├── auth.js               Connexion / déconnexion / attribution des rôles
│   ├── roles.js               Définition des rôles et permissions
│   ├── schools.js             Gestion des écoles
│   ├── academicYears.js       Année scolaire active
│   ├── classes.js             Liste des classes (CI à CM2)
│   ├── students.js            Inscription, réinscription, matricule, recherche
│   ├── academic.js            Matières, notes, moyennes, classements, bulletins
│   ├── finance.js             Frais, paiements, reçus, réductions, retards
│   ├── users.js                Création et gestion des comptes utilisateurs
│   ├── institution.js          Informations générales de l'établissement
│   ├── csv.js                   Export CSV (Excel / LibreOffice / Sheets)
│   ├── logger.js              Journal des activités
│   ├── theme.js                Mode clair / sombre
│   ├── icons.js                 Icônes de l'interface
│   ├── ui.js                     Affichage de l'ensemble de l'application
│   └── app.js                     Démarrage de l'application
└── assets/icons/             Logo et icônes de l'application
```

## Feuille de route — toutes les phases livrées

| Phase | Contenu |
|---|---|
| 1 | Connexion, rôles, écoles, PWA, thème clair/sombre |
| 2 | Élèves : inscription, réinscription, matricule automatique, dossier élève, recherche |
| 3 | Académique : matières, notes, moyennes, classements, validation, bulletins, observations, présences |
| 4 | Finances : paramétrage des frais et échéances, paiements, reçus numérotés, réductions, détection automatique des retards |
| 5 | Utilisateurs, tableau de bord complet par rôle, rapports avec graphiques, export CSV, journal des activités, paramètres |

## Comment tester les différents rôles

1. Connectez-vous en tant qu'Administrateur Général (`evangelisteanicette@gmail.com`).
2. Menu **Utilisateurs** > **Créer un compte** > choisissez le rôle (Directeur, Comptable ou Enseignant) et l'école.
3. La personne reçoit un e-mail Firebase pour définir son mot de passe, puis se connecte normalement.
4. Chaque rôle ne voit que les menus et les données qui le concernent (voir §19 du cahier des charges, repris dans `js/roles.js`).

## Limites connues et simplifications assumées

Pour rester livrable dans un projet à fichiers statiques (sans serveur ni Cloud Functions), certains points ont été simplifiés :

- **Export Excel** : les exports utilisent le format **CSV**, ouvrable directement dans Excel, LibreOffice et Google Sheets (§77). Un fichier `.xlsx` binaire natif nécessiterait une bibliothèque supplémentaire non incluse par défaut.
- **Export PDF** : bulletins, reçus et rapports utilisent l'impression du navigateur (bouton **Imprimer**, puis choisir "Enregistrer au format PDF" comme imprimante). C'est la méthode la plus fiable sans service serveur dédié à la génération de PDF.
- **Suppression de compte utilisateur** : un compte peut être **désactivé** (il ne peut plus se connecter) directement depuis l'application. La suppression définitive du compte de connexion (Firebase Authentication) doit se faire depuis la Firebase Console, le SDK navigateur ne le permettant pas pour un compte autre que soi-même.
- **Notifications push / SMS / e-mail automatiques** (§66, §78, §79) : non incluses dans cette version — l'architecture (journal des activités, alertes de retard déjà calculées) est prête à les recevoir dans une évolution future, comme prévu par le cahier des charges.
- **Frais de scolarité** : un seul barème (inscription + 3 tranches) s'applique à l'ensemble du complexe pour une année scolaire donnée. Un barème différent par école ou par classe est possible en évolution future si nécessaire.
- **Photos et pièces jointes** (onglet Documents du dossier élève) : non encore connectées à Firebase Storage.

Aucune de ces simplifications ne bloque l'usage quotidien décrit dans le cahier des charges ; elles concernent des finitions qui peuvent être ajoutées sans reconstruire l'architecture existante (§99).

## Note technique : index Firestore

Certaines listes (paiements d'un élève, notes d'une classe, etc.) utilisent des requêtes combinant plusieurs conditions. La première fois que vous les utiliserez, Firestore peut afficher dans la console du navigateur un lien **"créez l'index requis en cliquant ici"** — cliquez dessus, patientez une minute, puis réessayez. C'est un comportement normal de Firestore, à faire une seule fois par type de requête.

---

## Besoin d'aide ?

Si un écran affiche une erreur liée à Firebase, vérifiez en priorité que :
- les valeurs dans `js/firebase-config.js` sont correctement collées (sans espace ni guillemet manquant) ;
- l'authentification par e-mail/mot de passe est bien activée dans Firebase ;
- les règles Firestore ont bien été publiées.
