# Architecture

`Product` n'est plus une god class : chaque responsabilité a son propre fichier.

| Fichier | Rôle |
|---|---|
| `Product.ts` | Le métier : `Product`, `Price`, `Supplier`, `Warehouse`, les règles (stock, remises, transitions de statut) et les erreurs métier. Aucun import Prisma. |
| `NotificationService.ts` | Construit les notifications (sujets, textes, destinataires) à partir de faits transmis par `Product`. |
| `PrismaProductRepository.ts` | La persistance : seul fichier qui utilise Prisma. |

## Comment ça s'articule

- `Product` dépend d'une **interface** `ProductRepository` (définie dans
  `Product.ts`), pas de Prisma.
- En production, on lui passe un `PrismaProductRepository`.
- Par défaut, il utilise `InMemoryProductRepository`, qui ne fait rien : un
  `Product` se crée et se teste sans base de données ni mock.

```ts
const product = new Product(/* ... */, warehouse, new PrismaProductRepository());
```

## Règles garanties

- **Cohérence (#22)** : chaque mutateur écrit via le repository d'abord, puis
  modifie l'objet. Si l'écriture échoue, l'objet reste inchangé.
- **Statut (#21)** : les transitions autorisées sont définies une seule fois
  (`ALLOWED_TRANSITIONS`).
- **Notifications (#23, #24)** : construites par `NotificationService`,
  stockées en attente dans `Product`, enregistrées et vidées par
  `flushNotifications()`.
