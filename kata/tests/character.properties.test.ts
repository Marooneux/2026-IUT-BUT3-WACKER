import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { Character } from "../src/character.js";

describe("Damage modified by level gap — properties", () => {
  it("always applies an integer amount of damage, regardless of rounding", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 2000 }), fc.integer({ min: 1, max: 20 }), (amount, levelGap) => {
        const attacker = new Character();
        const target = new Character();
        target.level = attacker.level + levelGap;
        const healthBefore = target.health;

        attacker.dealDamage(target, amount);

        const damageApplied = healthBefore - target.health;
        expect(Number.isInteger(damageApplied)).toBe(true);
      }),
    );
  });

  it("never applies more than 150% or less than 50% of the base damage", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 2000 }), fc.integer({ min: -20, max: 20 }), (amount, levelGap) => {
        const attacker = new Character();
        const target = new Character();
        target.level = Math.max(1, attacker.level + levelGap);
        const healthBefore = target.health;

        attacker.dealDamage(target, amount);

        const damageApplied = healthBefore - target.health;
        expect(damageApplied).toBeGreaterThanOrEqual(Math.round(amount * 0.5));
        expect(damageApplied).toBeLessThanOrEqual(Math.round(amount * 1.5));
      }),
    );
  });

  it("never brings health below 0, however large the damage", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1_000_000 }), fc.integer({ min: -20, max: 20 }), (amount, levelGap) => {
        const attacker = new Character();
        const target = new Character();
        target.level = Math.max(1, attacker.level + levelGap);

        attacker.dealDamage(target, amount);

        expect(target.health).toBeGreaterThanOrEqual(0);
      }),
    );
  });

  it("throws for a zero or negative damage amount, never mutating health", () => {
    fc.assert(
      fc.property(fc.integer({ min: -1000, max: 0 }), fc.integer({ min: -20, max: 20 }), (amount, levelGap) => {
        const attacker = new Character();
        const target = new Character();
        target.level = Math.max(1, attacker.level + levelGap);
        const healthBefore = target.health;

        expect(() => attacker.dealDamage(target, amount)).toThrow();
        expect(target.health).toBe(healthBefore);
      }),
    );
  });
});

describe("Healing — properties", () => {
  it("never exceeds the character's max health, however large the heal amount", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1_000_000 }), fc.integer({ min: 1, max: 10 }), (amount, level) => {
        const character = new Character();
        character.level = level;

        character.heal(amount);

        const maxHealth = level >= 6 ? 1500 : 1000;
        expect(character.health).toBeLessThanOrEqual(maxHealth);
      }),
    );
  });

  it("throws for a zero or negative heal amount, never mutating health", () => {
    fc.assert(
      fc.property(fc.integer({ min: -1000, max: 0 }), fc.integer({ min: 1, max: 10 }), (amount, level) => {
        const character = new Character();
        character.level = level;
        const healthBefore = character.health;

        expect(() => character.heal(amount)).toThrow();
        expect(character.health).toBe(healthBefore);
      }),
    );
  });
});
