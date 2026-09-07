import { describe, it, expect } from "vitest";
import { Character } from "../src/character.js";

describe("Character creation", () => {
  it("starts with 1000 health", () => {
    const character = new Character();

    expect(character.health).toBe(1000);
  });

  it("starts alive", () => {
    const character = new Character();

    expect(character.isAlive).toBe(true);
  });

  it("starts at level 1", () => {
    const character = new Character();

    expect(character.level).toBe(1);
  });

  it("starts in no faction", () => {
    const character = new Character();

    expect(character.factions).toEqual([]);
  });
});

describe("Factions", () => {
  it("joins a faction", () => {
    const character = new Character();

    character.join("orcs");

    expect(character.factions).toEqual(["orcs"]);
  });

  it("leaves a faction", () => {
    const character = new Character();
    character.join("orcs");

    character.leave("orcs");

    expect(character.factions).toEqual([]);
  });

  it("does nothing when leaving a faction it never joined", () => {
    const character = new Character();
    character.join("orcs");

    character.leave("elves");

    expect(character.factions).toEqual(["orcs"]);
  });

  it("considers two characters in the same faction as allies", () => {
    const a = new Character();
    const b = new Character();
    a.join("orcs");
    b.join("orcs");

    expect(a.isAllyOf(b)).toBe(true);
  });

  it("does not consider two characters in different factions as allies", () => {
    const a = new Character();
    const b = new Character();
    a.join("orcs");
    b.join("elves");

    expect(a.isAllyOf(b)).toBe(false);
  });
});

describe("Dealing damage", () => {
  it("reduces the target's health by the damage amount", () => {
    const attacker = new Character();
    const target = new Character();

    attacker.dealDamage(target, 100);

    expect(target.health).toBe(900);
  });

  it("brings health to 0 and kills the target when damage exceeds current health", () => {
    const attacker = new Character();
    const target = new Character();

    attacker.dealDamage(target, 1500);

    expect(target.health).toBe(0);
    expect(target.isAlive).toBe(false);
  });

  it("reduces damage by 50% when the target is 5 or more levels above the attacker", () => {
    const attacker = new Character();
    const target = new Character();
    target.level = 6;

    attacker.dealDamage(target, 100);

    expect(target.health).toBe(950);
  });

  it("increases damage by 50% when the target is 5 or more levels below the attacker", () => {
    const attacker = new Character();
    attacker.level = 6;
    const target = new Character();

    attacker.dealDamage(target, 100);

    expect(target.health).toBe(850);
  });

  it("rounds reduced damage to the nearest integer", () => {
    const attacker = new Character();
    const target = new Character();
    target.level = 6;

    attacker.dealDamage(target, 101);

    expect(target.health).toBe(949);
  });

  it("rounds increased damage to the nearest integer", () => {
    const attacker = new Character();
    attacker.level = 6;
    const target = new Character();

    attacker.dealDamage(target, 101);

    expect(target.health).toBe(848);
  });

  it("throws when a character deals damage to itself", () => {
    const character = new Character();

    expect(() => character.dealDamage(character, 100)).toThrow();
  });

  it("throws when an ally deals damage to another ally", () => {
    const attacker = new Character();
    const target = new Character();
    attacker.join("orcs");
    target.join("orcs");

    expect(() => attacker.dealDamage(target, 100)).toThrow();
  });
});

describe("Healing", () => {
  it("increases the character's own health by the heal amount", () => {
    const character = new Character();
    const other = new Character();
    other.dealDamage(character, 300);

    character.heal(100);

    expect(character.health).toBe(800);
  });

  it("caps health at 1000 when healing would exceed the maximum", () => {
    const character = new Character();
    const other = new Character();
    other.dealDamage(character, 100);

    character.heal(500);

    expect(character.health).toBe(1000);
  });

  it("throws when a dead character tries to heal", () => {
    const character = new Character();
    const other = new Character();
    other.dealDamage(character, 1000);

    expect(() => character.heal(100)).toThrow();
  });

  it("caps health at 1500 from level 6 onward", () => {
    const character = new Character();
    character.level = 6;
    const other = new Character();
    other.dealDamage(character, 100);

    character.heal(600);

    expect(character.health).toBe(1500);
  });

  it("heals an ally", () => {
    const healer = new Character();
    const ally = new Character();
    healer.join("orcs");
    ally.join("orcs");
    const attacker = new Character();
    attacker.dealDamage(ally, 300);

    healer.healAlly(ally, 100);

    expect(ally.health).toBe(800);
  });

  it("throws when healing a non-ally", () => {
    const healer = new Character();
    const target = new Character();

    expect(() => healer.healAlly(target, 100)).toThrow();
  });
});
