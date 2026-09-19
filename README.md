# ReWire Operations

Prompt pour Lovable — Application de gestion (conversion plastique → câbles)

Copie-colle tout le texte ci-dessous dans Lovable.

---

Crée une application web professionnelle de gestion d'entreprise pour une société spécialisée dans la conversion du plastique en câbles. L'application doit être moderne, responsive, dynamique et très soignée visuellement — le design doit donner une impression de sérieux et de fiabilité industrielle, capable de convaincre un client professionnel dès le premier coup d'œil.

Direction artistique

- Palette de couleurs professionnelle inspirée du secteur industriel/tech : un bleu foncé ou bleu-gris comme couleur principale (confiance, technologie), associé à un accent orange ou cyan vif pour les call-to-action et les indicateurs importants (énergie, alertes), sur fond clair neutre (blanc cassé / gris très clair) pour les zones de contenu. Mode sombre optionnel pour le dashboard.

- Typographie moderne et lisible (type Inter, Poppins ou Manrope), hiérarchie claire entre titres, sous-titres et texte.

- Interface type "dashboard SaaS industriel" : cartes statistiques avec légères ombres, coins arrondis modérés, icônes cohérentes (type Lucide), micro-animations discrètes au survol et lors du chargement des données (transitions fluides, pas d'effets excessifs).

- Design 100% responsive : adaptation fluide desktop / tablette / mobile, avec menu latéral qui se transforme en menu burger sur mobile.

Structure générale

- Barre latérale (sidebar) fixe avec navigation : Dashboard, Employés, Clients, Produits, Énergie, Fournisseurs, Paramètres, Déconnexion.

- Barre supérieure avec titre de la page, icône de notifications et profil administrateur.

- Page de connexion (login) avec email + mot de passe, design épuré et professionnel, écran de bienvenue soigné.

Rôles

- Administrateur : accès complet à tous les modules (ajout, modification, suppression, consultation, statistiques).

- Employé : accès limité à ses propres heures de travail, historique de présence et informations personnelles.

Module Dashboard

Page d'accueil avec cartes statistiques dynamiques et graphiques :

- Nombre total d'employés / employés présents aujourd'hui

- Total des heures travaillées

- Nombre total de clients / nouveaux clients

- Nombre total de produits, produits disponibles vs en rupture

- Consommation énergétique du jour et coût énergétique mensuel (graphique d'évolution)

- Nombre total de fournisseurs

- Section "activité récente"

Module Employés

- Liste des employés avec recherche et bouton "Ajouter"

- Tableau : nom, prénom, poste, heure d'entrée, heure de sortie, actions (modifier/supprimer)

- Fiche détaillée par employé : informations personnelles, poste, date d'embauche, calendrier mensuel des jours travaillés, total des heures

- Enregistrement heure d'entrée / heure de sortie, calcul automatique des heures travaillées

- Vue mensuelle listant tous les employés avec leurs heures

Module Clients

- Liste des clients avec recherche, date d'inscription, nombre de factures

- Fiche détaillée par client : informations de contact, historique, liste de ses factures

- Gestion des factures : numéro, date, produits achetés, quantité, prix, montant total, statut de paiement (payé / en attente / en retard, avec badge coloré)

Module Produits

- Liste des produits avec recherche et indicateurs visuels de stock (disponible / stock faible / rupture, avec couleurs distinctes)

- Ajout / modification / suppression de produit (nom, catégorie, description, quantité, prix, date d'ajout, statut)

- Suivi des entrées/sorties de stock

Module Énergie

- Formulaire d'enregistrement de la consommation quotidienne (type d'énergie, quantité, coût, machine concernée)

- Vues et graphiques de consommation par jour, semaine, mois et année (courbes ou barres)

- Calcul automatique du coût énergétique

Module Fournisseurs

- Liste des fournisseurs avec recherche

- Fiche détaillée : informations de contact, produits fournis, historique des commandes

Exigences techniques

- Application entièrement responsive et fluide sur ordinateur, tablette et mobile

- Authentification sécurisée par email / mot de passe avec gestion des rôles et permissions

- Recherche rapide et filtres sur toutes les listes (employés, clients, produits, fournisseurs)

- Base de données pour stocker toutes les informations de façon persistante

- Interface simple, intuitive, navigation fluide, temps de chargement rapide

- Utilise des données de démonstration réalistes pour peupler chaque module afin de visualiser immédiatement le rendu final

Objectif final

Le résultat doit ressembler à un vrai produit SaaS professionnel destiné à une entreprise industrielle : crédible, moderne, agréable à utiliser, et visuellement convaincant pour un client qui découvre l'outil pour la première fois.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/77f97688-a579-4d0f-a4be-9f394c84d477).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
