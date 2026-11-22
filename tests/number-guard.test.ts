import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { currencyAmounts, extractNumbers, numberDiff, numberIssue, onlyKnownNumbers, sameNumbers } from "@/lib/number-check";

// What the AI is told about the shop, in the same shape buildKnowledge writes it.
const KB = `Products (prices in US dollars):
- Silk scarf: $40. Colours: red, blue. In stock.
- Brass lamp: $12.5. In stock.
- Tea set: $1,200. Currently out of stock.
Shipping is free for orders above $50, otherwise $6. Delivery takes 7 days. Returns within 14 days.`;

describe("reading numbers", () => {
  it("digits in any script and every common way of writing a decimal or thousands", () => {
    assert.deepEqual(extractNumbers("१२ डॉलर"), ["12"]);
    assert.deepEqual(extractNumbers("௫௦ ரூபாய்"), ["50"]);
    assert.deepEqual(extractNumbers("٣٫٥"), ["3.5"]);
    assert.deepEqual(extractNumbers("5.50"), ["5.5"]);
    assert.deepEqual(extractNumbers("$1,200.50"), ["1200.5"]);
    assert.deepEqual(extractNumbers("12,50 €"), ["12.5"]);
    assert.deepEqual(extractNumbers("1.200,50 €"), ["1200.5"]);
    assert.deepEqual(extractNumbers("₹1,00,000"), ["100000"]);
    assert.deepEqual(extractNumbers("₹10,00,000"), ["1000000"]);
    assert.deepEqual(extractNumbers("1\u202f200 €"), ["1200"]);
    assert.deepEqual(extractNumbers("3 items, 12 colours"), ["3", "12"]);
  });

  it("finds amounts next to a currency sign, code or word, and nothing else", () => {
    assert.deepEqual(currencyAmounts("$40"), ["40"]);
    assert.deepEqual([...currencyAmounts("12 USD and USD 7")].sort(), ["12", "7"]);
    assert.deepEqual(currencyAmounts("₹500"), ["500"]);
    assert.deepEqual(currencyAmounts("12,50 €"), ["12.5"]);
    assert.deepEqual(currencyAmounts("रुपये 500"), ["500"]);
    assert.deepEqual(currencyAmounts("5 euros"), ["5"]);
    assert.deepEqual(currencyAmounts("3 pieces, 7 days, 5.5 metres"), []);
  });
});

describe("a translation must keep every number", () => {
  it("accepts faithful translations in other scripts and number formats", () => {
    assert.equal(sameNumbers("The lamp costs $12.50 and ships in 7 days.", "La lámpara cuesta 12,50 $ y se envía en 7 días."), true);
    assert.equal(sameNumbers("Total $1,200", "Gesamt 1.200 $"), true);
    assert.equal(sameNumbers("It costs $50.", "इसकी कीमत $५० है।"), true);
    assert.equal(sameNumbers("Total ₹1,00,000", "कुल ₹१,००,०००"), true);
    assert.equal(sameNumbers("Hello, thank you!", "Hola, ¡gracias!"), true);
  });

  it("rejects a changed, added or dropped number", () => {
    assert.equal(sameNumbers("The lamp costs $12.", "La lámpara cuesta $21."), false);
    assert.equal(sameNumbers("The lamp costs $12.", "La lámpara cuesta $12.50."), false);
    assert.equal(sameNumbers("Two lamps for $24.", "Lámparas por $24."), false);
    assert.equal(sameNumbers("Lamps for $24.", "Tres lámparas por $24."), false);
    assert.equal(sameNumbers("Delivery takes 7 days.", "La entrega tarda 17 días."), false);
  });

  it("treats a spelled-out number and a digit as the same, and a changed spelled-out number as different", () => {
    assert.equal(sameNumbers("Two lamps for $24.", "2 lámparas por $24."), true);
    assert.equal(sameNumbers("2 lamps", "dos lámparas"), true);
    assert.equal(sameNumbers("five lamps", "cinco lámparas"), true);
    assert.equal(sameNumbers("five lamps", "seis lámparas"), false);
    assert.equal(sameNumbers("five lamps", "sieben Lampen"), false);
    assert.equal(sameNumbers("twenty-five lamps", "25 lámparas"), true);
    assert.equal(sameNumbers("twenty-five lamps", "35 lámparas"), false);
  });

  it("one and its translations are articles as well as numbers, so they excuse a 1 but are never required", () => {
    assert.equal(sameNumbers("1 lamp", "una lámpara"), true);
    assert.equal(sameNumbers("one lamp", "1 lámpara"), true);
    assert.equal(sameNumbers("one moment please", "un momento por favor"), true);
    assert.equal(sameNumbers("one lamp", "dos lámparas"), false);
  });
});

describe("an AI answer may only use numbers the shop gave", () => {
  const ok = (answer: string, ...extra: string[]) => assert.equal(numberIssue(answer, KB, ...extra), null, answer);
  const blocked = (answer: string, pattern: RegExp, ...extra: string[]) => {
    const issue = numberIssue(answer, KB, ...extra);
    assert.match(issue ?? "", pattern, answer);
    assert.equal(onlyKnownNumbers(answer, KB, ...extra), false);
  };

  it("allows the shop's own prices, shipping and delivery time in any format or language", () => {
    ok("The silk scarf is $40 and comes in red and blue.");
    ok("The brass lamp costs $12.50.");
    ok("La lámpara de latón cuesta 12,50 $.");
    ok("Shipping is free above $50, otherwise $6.");
    ok("Delivery takes seven days.");
    ok("La livraison prend 7 jours.");
    ok("Returns are accepted within 14 days.");
    ok("Hello! How can I help you today?");
    ok("One moment, I will check.");
  });

  it("allows a number the customer wrote, so follow-ups work", () => {
    ok("Yes, 3 scarves are available at $40 each.", "I want 3 scarves");
  });

  it("blocks an invented or altered price", () => {
    blocked("The silk scarf is $45.", /45/);
    blocked("The brass lamp costs $12.", /12/);
    blocked("La lámpara cuesta 15,50 $.", /15\.5/);
    blocked("The tea set is $1,000.", /1000/);
  });

  it("blocks a price that is really another number: stock, days or a quantity used as money", () => {
    blocked("The lamp is $7.", /7/); // 7 is the delivery time, not a price
    blocked("The scarf is $14.", /14/); // 14 is the return window, not a price
  });

  it("blocks a price converted into another currency", () => {
    blocked("The silk scarf costs about ₹3,300.", /3300/);
    blocked("The silk scarf costs about 37 euros.", /37/);
  });

  it("blocks a spelled-out number that is not in the shop information, in several languages", () => {
    blocked("Delivery takes five days.", /5/);
    blocked("La entrega tarda cinco días.", /5/);
    blocked("Die Lieferung dauert neun Tage.", /9/);
    blocked("Delivery takes twenty-five days.", /25/);
  });

  it("blocks a quantity claim, because the shop information only says in stock or out of stock", () => {
    blocked("We have only 3 left.", /3|stock/);
    blocked("There are 12 pieces in stock.", /stock|12/);
    blocked("Current stock of 8.", /stock|8/);
    ok("The brass lamp is in stock.");
    ok("The tea set is currently out of stock.");
  });

  it("does not mistake colours, sizes or measurements for stock claims", () => {
    ok("It is available in 2 colours: red and blue.", "I need 2 colours");
    ok("A 7 day delivery window applies.");
  });
});

describe("number words with scales, and the diff shown to the agent", () => {
  it("reads hundred, thousand, lakh and crore phrases as values", () => {
    assert.equal(sameNumbers("It costs two hundred and fifty dollars.", "Cuesta 250 dólares."), true);
    assert.equal(sameNumbers("A hundred", "100"), true);
    assert.equal(sameNumbers("one thousand two hundred", "1,200"), true);
    assert.equal(sameNumbers("three lakh", "300000"), true);
    assert.equal(sameNumbers("two hundred", "300"), false);
    assert.equal(sameNumbers("a thousand", "100"), false);
  });

  it("keeps two separate number words separate and ignores words that merely contain one", () => {
    assert.equal(sameNumbers("five or six", "5 o 6"), true);
    assert.equal(sameNumbers("five six", "11"), false);
    assert.equal(sameNumbers("someone gone", "alguien"), true);
    assert.equal(sameNumbers("twenty-one", "21"), true);
  });

  it("blocks an AI answer that invents a spelled-out price", () => {
    assert.equal(onlyKnownNumbers("The scarf is one hundred dollars.", KB), false);
    assert.equal(onlyKnownNumbers("The scarf is forty dollars.", KB), true);
    assert.equal(onlyKnownNumbers("The tea set is twelve hundred dollars.", KB), true);
    assert.equal(onlyKnownNumbers("The tea set is eleven hundred dollars.", KB), false);
  });

  it("numberDiff says which numbers were lost, added and kept", () => {
    assert.deepEqual(numberDiff("2 lamps for $24", "2 lámparas por $42"), { missing: ["24"], added: ["42"], checked: ["2"] });
    assert.deepEqual(numberDiff("Ships in seven days", "Se envía en 7 días"), { missing: [], added: [], checked: ["7"] });
    assert.deepEqual(numberDiff("Hello", "Hola"), { missing: [], added: [], checked: [] });
  });
});
