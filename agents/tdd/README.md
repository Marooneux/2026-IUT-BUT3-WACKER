# TDD agentique

Ce dossier documente le skill **`tdd-agentic`**
(`.claude/skills/tdd-agentic/SKILL.md`), qui impose aux agents la boucle
complète du vrai TDD : **think → red → green → refactor**.

## Source

Le support de référence est `TDD is dead _ (1_3) (1).pdf` (dans ce dossier).
Idées clés reprises dans le skill :

- Le TDD est un **procédé basé sur le feedback** — une **boucle de
  réflexion**, pas une simple discipline « tests d'abord ».
- Avant même d'avoir un test rouge, la question est : *comment je pose le
  code du test ?* — quels objets j'expose (ARRANGE), quel état de départ
  (ARRANGE), quelle situation je déclenche (ACT), quel comportement
  j'attends (ASSERT).
- Le test doit être **rouge pour les bonnes raisons** : chaque difficulté
  rencontrée en posant le test (dépendances toxiques, trop de setup,
  couplage temporel, `void` intestable, « je teste A mais je vérifie B »)
  est un **signal de conception**, pas un obstacle à contourner.
- Bénéfices : code prévu pour les tests, code unitaire (SRP, philosophie
  Unix), non-régression, documentation vivante.
- 🧠 + 🤖 : le TDD agentique est un élément indispensable du **harnais**
  (harness) sur les parties critiques d'un produit logiciel.

## Ce que le skill ajoute : la remontée aux spécifications

La boucle de réflexion ne s'arrête pas à la conception : quand une question
posée en phase THINK ne peut pas être tranchée par la spécification
(ambiguë, incomplète, contradictoire), l'agent **remonte à la spec** — sous
**supervision humaine** :

1. l'agent formule précisément la question et propose 2-3 interprétations
   avec leurs conséquences, plus une recommandation ;
2. l'**humain tranche** (jamais l'agent) ;
3. la décision est consignée dans un journal (`SPEC-DECISIONS.md`) et la
   spec est mise à jour si l'humain le valide ;
4. la boucle reprend en phase SPEC sur le comportement débloqué.

En session autonome, l'agent stoppe le comportement bloqué, avance sur les
comportements non ambigus, et liste les questions en attente dans son
rapport final.

## Utilisation

- Invocation explicite : `/tdd-agentic` (ou demander à l'agent de
  développer « en TDD agentique »).
- Le skill s'applique à tout développement de code : feature, bugfix, kata.
