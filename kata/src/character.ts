const MAX_HEALTH = 1000;
const HIGH_LEVEL_MAX_HEALTH = 1500;
const HIGH_LEVEL_THRESHOLD = 6;
const LEVEL_GAP_FOR_DAMAGE_MODIFIER = 5;
const DAMAGE_REDUCTION_FACTOR = 0.5;
const DAMAGE_INCREASE_FACTOR = 1.5;

export class Character {
  level = 1;
  private currentHealth = this.maxHealth;
  private readonly factionNames: string[] = [];

  get factions(): string[] {
    return [...this.factionNames];
  }

  join(factionName: string): void {
    this.factionNames.push(factionName);
  }

  leave(factionName: string): void {
    const index = this.factionNames.indexOf(factionName);
    if (index === -1) {
      return;
    }
    this.factionNames.splice(index, 1);
  }

  isAllyOf(other: Character): boolean {
    return this.factionNames.some((factionName) => other.hasFaction(factionName));
  }

  private hasFaction(factionName: string): boolean {
    return this.factionNames.includes(factionName);
  }

  private get maxHealth(): number {
    return this.level >= HIGH_LEVEL_THRESHOLD ? HIGH_LEVEL_MAX_HEALTH : MAX_HEALTH;
  }

  get health(): number {
    return this.currentHealth;
  }

  get isAlive(): boolean {
    return this.currentHealth > 0;
  }

  dealDamage(target: Character, amount: number): void {
    this.requirePositiveAmount(amount, "Damage amount must be positive");
    if (target === this) {
      throw new Error("A character cannot deal damage to itself");
    }
    if (this.isAllyOf(target)) {
      throw new Error("A character cannot deal damage to an ally");
    }
    target.receiveDamage(this.adjustDamageForLevelGap(amount, target));
  }

  private adjustDamageForLevelGap(amount: number, target: Character): number {
    const levelGap = target.level - this.level;
    if (levelGap >= LEVEL_GAP_FOR_DAMAGE_MODIFIER) {
      return Math.round(amount * DAMAGE_REDUCTION_FACTOR);
    }
    if (levelGap <= -LEVEL_GAP_FOR_DAMAGE_MODIFIER) {
      return Math.round(amount * DAMAGE_INCREASE_FACTOR);
    }
    return amount;
  }

  heal(amount: number): void {
    this.requirePositiveAmount(amount, "Heal amount must be positive");
    if (!this.isAlive) {
      throw new Error("A dead character cannot heal");
    }
    this.currentHealth = Math.min(this.maxHealth, this.currentHealth + amount);
  }

  private requirePositiveAmount(amount: number, message: string): void {
    if (amount <= 0) {
      throw new Error(message);
    }
  }

  healAlly(ally: Character, amount: number): void {
    if (!this.isAllyOf(ally)) {
      throw new Error("A character can only heal an ally");
    }
    ally.heal(amount);
  }

  private receiveDamage(amount: number): void {
    this.currentHealth = Math.max(0, this.currentHealth - amount);
  }
}
