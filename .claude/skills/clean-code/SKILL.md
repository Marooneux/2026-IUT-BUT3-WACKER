---
name: clean-code
description: >
  Règles de conception et de refactoring du code de production (design
  simple, code smells, Object Calisthenics, Tell Don't Ask, testabilité).
  À appliquer en phase REFACTOR de tdd-agentic et lors de toute revue ou
  écriture de code. Méthode : un smell à la fois, tests verts après chaque
  pas, s'arrêter quand c'est « assez bien ».
---

# Clean code — règles opérationnelles pour agents

Source pédagogique : `cours/03-que-chercher.md` (module 3). Ce skill en est
la version exécutable : des règles à appliquer, pas un cours.

## Ordre des priorités

1. **Comportement** (bugs, cas limites) — jamais sacrifié à la forme.
2. **Conception** (ce skill).
3. **Lisibilité** (noms, clarté).
4. **Style** (formatage → laisser faire le linter).

## Critère d'acceptation : le design simple (Kent Beck, dans l'ordre)

1. **Passe les tests** — condition d'entrée ET de sortie de tout refactor.
2. **Exprime l'intention** — on comprend pourquoi chaque élément existe.
3. **Ne duplique pas** — chaque connaissance existe une seule fois (DRY).
4. **Est minimal** — rien d'inutile (KISS, YAGNI). Pas de pattern, de
   paramètre ou de généralisation « au cas où » : le code non demandé est
   du code mort ou du code non testé.

## Table des smells → correctifs

| Smell | Signal | Correctif |
|---|---|---|
| Duplication | même logique à 2+ endroits | extraire une fonction/constante unique |
| Fonction longue | > ~10 lignes ou 2+ responsabilités (calcul ET affichage ET sauvegarde…) | découper : une fonction = une raison de changer |
| Trop de paramètres | > 3-4 params, ou un booléen en paramètre | regrouper en objet ; un booléen = deux fonctions |
| Valeur magique | nombre/chaîne en dur | constante nommée (`STARTING_HEALTH`, pas `1000`) |
| Commentaire « quoi » | le commentaire répète le code | renommer le code ; ne garder que les commentaires « pourquoi » (décision, contrainte) |
| Code mort | fonction/param/variable jamais utilisés, code commenté, branche « au cas où » | supprimer (git garde l'historique) |
| Abréviation | `calc`, `t`, `it`, `q` | noms complets qui disent l'intention |
| Ask au lieu de Tell | `obj.data * obj.other` calculé depuis l'extérieur ; getters/setters systématiques | déplacer la logique là où sont les données : `obj.subtotal()` |
| Cascade if/else sur un code/type | `if (code === "A") … if (code === "B") …` | table de stratégies (Record/Map de fonctions) — seulement si la cascade existe déjà, YAGNI sinon |
| État global / effet de bord caché | fonction `void` qui mute un état extérieur | fonction pure (entrée → sortie) quand c'est possible |
| Dépendance créée en dur | `new Database()` dans un constructeur | injecter la dépendance (paramètre de constructeur) |

## Object Calisthenics (9 règles)

1. **Un seul niveau d'indentation** par fonction (extraire le reste).
2. **Pas de `else`** — gardes et retours anticipés ; le cas invalide est
   écarté en tête, le reste suit le chemin normal.
3. **Envelopper les primitifs** porteurs de sens métier (`Money`, pas
   `number` nu partout).
4. **Collections de première classe** (pas de tableaux nus qui circulent).
5. **Un seul point par ligne** (pas de `a.b.c.d`).
6. **Pas d'abréviations.**
7. **Tout petit** : fonctions, classes, fichiers.
8. **≤ 2 attributs par classe** (au-delà : une classe se cache dedans).
9. **Pas de getters/setters systématiques** → Tell, Don't Ask : ne demande
   pas les données pour décider à la place de l'objet — dis-lui de faire.

## Méthode de refactoring — un smell à la fois

Ordre éprouvé (chaque étape laisse le code compilable et **les tests
verts** — les relancer après chaque pas) :

1. **Nommer** : supprimer les abréviations (logique inchangée).
2. **Nommer les valeurs** : extraire les constantes magiques.
3. **Gardes** : éliminer les `else`, réduire l'indentation à 1 niveau.
4. **Extraire et encapsuler** : une responsabilité par fonction, primitifs
   enveloppés, logique déplacée là où sont les données (Tell Don't Ask).
5. **Style fonctionnel** : remplacer boucle + accumulateur mutable par
   `filter` / `map` / `reduce`, chaque étape nommée par un prédicat ou une
   transformation.

**S'arrêter dès que le code est « assez bien »** pour être relu : pousser
jusqu'à l'étape 5 n'est pas un but en soi (YAGNI s'applique aussi au
refactoring).

## Testabilité (concevoir pour tester)

- **Déterministe** : mêmes entrées → mêmes sorties (horloge, aléa, réseau
  injectés, jamais créés en dur).
- **Découplé** : l'infrastructure (BDD, réseau, fichiers) est remplaçable.
- **Sans état global caché.**
- Si c'est dur à tester, c'est mal conçu : corriger la conception, pas le
  test (cohérent avec la phase THINK de `tdd-agentic`).

## Anti-patterns à ne pas introduire

God Object (une classe qui sait tout), Golden Hammer (le même outil
partout), optimisation prématurée (complexité sans mesure), pattern
plaqué sans besoin (sur-ingénierie).

## Checklist de sortie

- [ ] tests verts, comportement observable inchangé ;
- [ ] pas de duplication ;
- [ ] fonctions courtes, une responsabilité, ≤ 1 niveau d'indentation ;
- [ ] pas de valeur magique, pas d'abréviation, pas de `else` évitable ;
- [ ] pas de code mort, pas de généralisation non demandée ;
- [ ] la logique vit là où sont les données (Tell Don't Ask) ;
- [ ] dépendances injectées, pas d'état global caché.
