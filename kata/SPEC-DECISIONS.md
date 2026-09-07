# Journal des décisions de spécification — kata RPG Combat

Comportements bloqués en phase THINK, story « Damage and Health »
(`kata/rpg-combat.md`) : impossible de formuler une assertion sans trancher
un point que la spec ne précise pas. Voir `.claude/skills/tdd-agentic`.

**Q1, Q2 et Q3 sont désormais tranchées et implémentées** (voir statuts
ci-dessous). Toute la story « Damage and Health » est couverte.

**Story « Levels » complète** — Level (départ 1), plafond de santé 1500 au
niveau 6, modificateurs de dégâts ±50% selon l'écart de niveau, et
l'arrondi des dégâts modifiés (Q4) sont implémentés.

**Story « Factions » complète** — appartenance (aucune au départ),
`join`/`leave`, `isAllyOf`, interdiction de dégâts entre alliés (Q5) et
soin réservé aux alliés (Q6) sont implémentés.

**Property-based testing (fast-check)** ajouté dans
`kata/tests/character.properties.test.ts`, en complément des tests
exemple. A découvert un bug réel non couvert par les tests exemple : ni
`dealDamage` ni `heal` ne validaient que `amount` soit strictement
positif — un montant nul ou négatif contournait les gardes métier
existantes (`dealDamage(target, -1)` avec un modificateur d'augmentation
soignait la cible au lieu de la blesser ; `heal(-50)` blessait au lieu de
soigner). Corrigé par une garde `requirePositiveAmount` partagée (exception,
cohérent avec Q1/Q2/Q5/Q6), cycle think-red-green-refactor complet.

---

## Q1 — Un personnage ne peut pas s'infliger de dégâts à lui-même

**Spec en cause :** *« A Character cannot Deal Damage to itself »*
**Cas d'entrée problématique :** `character.dealDamage(character, amount)`

Impossible de poser l'ASSERT : la spec dit *que* c'est interdit, pas ce qui
est **observable** quand on tente l'action.

**Interprétations candidates :**

| # | Comportement | Conséquences |
|---|---|---|
| A | No-op silencieux : `health` inchangé, pas d'erreur | Simple, mais masque l'erreur d'appel côté code appelant (bug silencieux) |
| B | Lève une exception (ex. `Error("Cannot deal damage to self")`) | Feedback immédiat 🍀 (cohérent avec la phase THINK/ACT du skill) ; oblige l'appelant à gérer le cas |
| C | Retourne un résultat (`{ success: false }`) au lieu de `void` | Évite l'exception, mais change la signature de `dealDamage` (impacte le comportement déjà testé au cycle 3-4, qui suppose `void`) |

**Recommandation :** B — lever une exception. Cohérent avec le principe du
skill *« Est-ce que des exceptions sont levées alors que je ne les
attendais pas ? feedback immédiat »* : ici l'exception est **attendue**, ce
qui est le signal le plus net et le moins ambigu à tester (`expect(() =>
...).toThrow()`), sans changer la signature déjà validée par les tests
existants.

**Statut :** ✅ **tranché par l'humain (2026-09-04) : option B — exception.**
Implémenté (cycle think-red-green-refactor complet) : `dealDamage` lève
`Error("A character cannot deal damage to itself")` quand la cible est
`this`, vérifié en garde avant `receiveDamage`.

---

## Q2 — Un personnage mort ne peut pas se soigner

**Spec en cause :** *« Dead characters cannot heal »*
**Cas d'entrée problématique :** `deadCharacter.heal(amount)`

Même blocage que Q1 : « ne peut pas » n'indique pas l'effet observable.

**Interprétations candidates :**

| # | Comportement | Conséquences |
|---|---|---|
| A | No-op silencieux : `health` reste à 0 | Cohérent avec « mort = 0, reste 0 » mais masque un appel invalide |
| B | Lève une exception | Cohérent avec Q1-B si cette réponse est retenue (même politique d'erreur dans tout le domaine) |
| C | Retourne un booléen de succès | Même réserve que Q1-C (changement de signature) |

**Recommandation :** B, pour la même raison que Q1, **et par cohérence** :
adopter la même politique d'erreur (exception) pour toutes les actions
interdites du domaine (auto-dégât, soin d'un mort) plutôt que de mélanger
les styles selon le cas.

**Statut :** ✅ **tranché par l'humain (2026-09-04) : option B — exception**
(cohérent avec Q1). Implémenté (cycle think-red-green-refactor complet) :
`heal` lève `Error("A dead character cannot heal")` quand `!isAlive`,
vérifié en garde avant l'application du soin.

---

## Q3 — Plafond de soin au-delà de 1000

**Spec en cause :** *« Health, starting at 1000 »* + *« A Character can Heal
themselves »* — aucun plafond de santé maximale n'est mentionné.
**Cas d'entrée problématique :** `character.heal(amount)` quand
`character.health + amount > 1000`.

**Interprétations candidates :**

| # | Comportement | Conséquences |
|---|---|---|
| A | Plafonné à 1000 (health max implicite = health de départ) | Cohérent avec les RPG classiques, mais **1000 n'est jamais présenté comme un maximum** dans la spec — seulement comme la valeur de départ |
| B | Pas de plafond : `health` peut dépasser 1000 | Fidèle au texte strict de la spec, mais contre-intuitif pour un jeu de rôle |
| C | Plafond configurable (`maxHealth`, par défaut 1000) | Sur-conception non demandée par la spec actuelle — écarté (YAGNI) |

**Recommandation :** A — plafonner à 1000. C'est l'hypothèse la plus sûre
pour un système de combat (évite l'inflation de vie via le soin, qui
casserait l'équilibre du jeu), mais **ce n'est pas écrit** dans la spec :
décision à valider avant implémentation, pas déduite silencieusement.

**Statut :** ✅ **tranché par l'humain (2026-09-04) : option A — plafond à
1000.** Implémenté (cycle think-red-green-refactor complet) :
`Character.heal` plafonne `currentHealth` à `MAX_HEALTH` via `Math.min`.
Renommage `STARTING_HEALTH` → `MAX_HEALTH` en phase REFACTOR, la constante
portant désormais les deux rôles (valeur de départ = plafond).

---

## Q4 (latente, non bloquante) — Arrondi des dégâts modifiés par l'écart de niveau

**Spec en cause :** *« Damage is reduced/increased by 50% »* — aucun cas
testé jusqu'ici ne produit de valeur non entière (100 × 0.5 = 50,
100 × 1.5 = 150, tous ronds).

**Cas d'entrée qui la déclencherait :** un montant de dégâts impair avec un
modificateur actif, ex. `dealDamage(target, 101)` avec écart de niveau ≥ 5
→ `50.5`. `Character.health` accepte aujourd'hui des `number` non entiers
sans contrainte — le comportement actuel (pas d'arrondi) reste cohérent
tant qu'aucun test n'exige un entier.

**Statut :** ✅ **tranché par l'humain (2026-09-05) : arrondi arithmétique
standard** (`Math.round` — .5 arrondit vers le haut). Implémenté (cycle
think-red-green-refactor complet) : `adjustDamageForLevelGap` applique
`Math.round` sur les deux branches modifiées (réduction et augmentation).
Ex. `101 × 0.5 = 50.5 → 51` ; `101 × 1.5 = 151.5 → 152`.

---

## Q5 — Les alliés ne peuvent pas se combattre

**Spec en cause :** *« Allies cannot Deal Damage to one another »*
**Cas d'entrée problématique :** `attacker.dealDamage(target, amount)`
quand `attacker.isAllyOf(target)`.

Même blocage que Q1 : la spec dit *que* c'est interdit, pas ce qui est
**observable** quand on tente l'action.

**Interprétations candidates :**

| # | Comportement | Conséquences |
|---|---|---|
| A | No-op silencieux : `health` inchangé, pas d'erreur | Masque un appel invalide, incohérent avec Q1 |
| B | Lève une exception | Cohérent avec Q1/Q2 : même politique d'erreur pour toute action interdite du domaine |
| C | Retourne un statut | Change la signature déjà établie et testée |

**Recommandation :** B, par cohérence stricte avec Q1 et Q2 — le domaine
a déjà adopté « action interdite → exception » deux fois ; changer de
politique ici introduirait une incohérence non justifiée par la spec.

**Statut :** ✅ **tranché par l'humain (2026-09-05) : option B — exception**
(cohérent avec Q1/Q2). Implémenté (cycle think-red-green-refactor
complet) : `dealDamage` lève `Error("A character cannot deal damage to an
ally")` quand `this.isAllyOf(target)`, vérifié en garde avant le calcul
des dégâts.

---

## Q6 — Soigner un allié / soin refusé à un non-allié

**Spec en cause :** *« Allies can Heal one another and non-allies cannot »*

Deux points, dont un seul bloque réellement :

1. **Signal de conception (résolu sans escalade)** : `heal(amount)`
   n'existe aujourd'hui que pour se soigner soi-même. La spec introduit un
   soin **ciblé** vers un autre personnage. Choix retenu : nouvelle
   méthode `healAlly(target, amount)`, cohérente avec `dealDamage(target,
   amount)` — `heal(amount)` (auto-soin, déjà testé) reste inchangée.
2. **Ambiguïté réelle (bloquante)** : quel est l'effet observable quand la
   cible n'est pas une alliée ? Même nature que Q1/Q2/Q5.

**Cas d'entrée problématique :** `healer.healAlly(target, amount)` quand
`!healer.isAllyOf(target)`.

**Interprétations candidates :**

| # | Comportement | Conséquences |
|---|---|---|
| A | No-op silencieux | Incohérent avec Q1/Q2/Q5 |
| B | Lève une exception | Cohérent avec la politique déjà adoptée trois fois |
| C | Retourne un statut | Change la signature de la nouvelle méthode dès sa création |

**Recommandation :** B, même raisonnement que Q5.

**Statut :** ✅ **tranché par l'humain (2026-09-05) : option B — exception**
(cohérent avec Q1/Q2/Q5). Implémenté (cycle think-red-green-refactor
complet, en deux temps) : nouvelle méthode `healAlly(ally, amount)` qui
délègue à `ally.heal(amount)` (Tell Don't Ask) après une garde
`Error("A character can only heal an ally")` quand `!this.isAllyOf(ally)`.
`heal(amount)` (auto-soin) reste inchangée.

---

## Comportements implémentés

- Health démarre à 1000.
- Un personnage démarre Alive.
- `attacker.dealDamage(target, amount)` réduit `target.health`.
- Des dégâts qui dépassent `health` amènent `health` à 0 et `isAlive` à
  `false`.
- `character.heal(amount)` augmente `character.health`, plafonné à 1000
  (Q3).
- `character.dealDamage(character, amount)` lève une exception (Q1).
- Un personnage mort (`!isAlive`) qui appelle `heal` lève une exception
  (Q2).
- Un personnage démarre au niveau 1.
- Le plafond de santé passe à 1500 à partir du niveau 6 (en dessous : 1000).
- Les dégâts sont réduits de 50% si la cible a un niveau ≥ attaquant+5, et
  augmentés de 50% si la cible a un niveau ≤ attaquant-5.
- Les dégâts modifiés par l'écart de niveau sont arrondis à l'entier le
  plus proche, arrondi arithmétique standard (Q4).
- Un personnage démarre dans aucune faction.
- `character.join(factionName)` / `character.leave(factionName)` — quitter
  une faction jamais rejointe est un no-op.
- `a.isAllyOf(b)` — vrai si `a` et `b` partagent au moins une faction.
- `attacker.dealDamage(target, amount)` lève une exception si `attacker`
  et `target` sont alliés (Q5).
- `healer.healAlly(target, amount)` soigne `target` s'ils sont alliés,
  lève une exception sinon (Q6).
- `dealDamage` et `heal` lèvent une exception pour un montant ≤ 0 (bug
  trouvé par PBT, garde `requirePositiveAmount` partagée).
