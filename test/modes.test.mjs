import test from 'node:test';
import assert from 'node:assert/strict';
import { EVIL, KIND, captionPrompt, cleanSettings, imagePrompt, publicMode, resolveMode } from '../server/modes.mjs';

const SCARY = /blood|gore|wound|gash|skull|rotting|decay|demon|corpse|dead|hollow|terrif|nightmare/i;

test('allt utom exakt "evil" blir snällt läge', () => {
  for (const value of [undefined, null, '', 'Evil', 'EVIL', 'evil ', 'ond', 'not-so-scary', 0, true]) {
    assert.equal(resolveMode(value), KIND);
  }
  assert.equal(resolveMode('evil'), EVIL);
});

test('snälla prompter innehåller aldrig något läskigt, oavsett reglage och tema', () => {
  const { themes, sliders } = publicMode(KIND);
  for (const theme of themes) {
    for (const value of [0, 25, 50, 75, 100]) {
      const input = { theme: theme.id, sliders: Object.fromEntries(sliders.map((s) => [s.id, value])) };
      const prompt = imagePrompt(KIND, cleanSettings(KIND, input)).replace('no blood, no skulls', '');
      assert.doesNotMatch(prompt, SCARY, prompt);
    }
  }
});

test('ett ont tema och onda reglage från klienten gör ingenting i snällt läge', () => {
  const settings = cleanSettings(KIND, { theme: 'zombie', sliders: { blod: 100, rot: 100, skrack: 100 } });
  assert.equal(settings.theme, 'spoke');
  assert.deepEqual(Object.keys(settings.sliders).sort(), ['bus', 'glitter', 'godis', 'slime']);
  assert.doesNotMatch(imagePrompt(KIND, settings).replace('no blood, no skulls', ''), SCARY);
});

test('reglagen kläms till 0–100 och skräp blir ett giltigt värde', () => {
  const s = cleanSettings(EVIL, { theme: 'spoke', sliders: { skrack: 900, blod: -4, rot: 'x', sallskap: 49.6 } });
  assert.deepEqual(s.sliders, { skrack: 100, blod: 0, rot: 0, sallskap: 50 });
});

test('reglagen ändrar prompten, och nivå 100 hamnar på sista steget', () => {
  const at = (blod) => imagePrompt(EVIL, cleanSettings(EVIL, { theme: 'zombie', sliders: { blod } }));
  assert.match(at(0), /No blood at all/);
  assert.match(at(100), /Drenched in dark blood/);
});

test('mildring tar bort blodet helt i sista steget', () => {
  const s = cleanSettings(EVIL, { theme: 'zombie', sliders: { blod: 100, rot: 100, skrack: 100 } });
  assert.match(imagePrompt(EVIL, s, 2), /No blood at all/);
  assert.doesNotMatch(imagePrompt(EVIL, s, 2), /Drenched/);
});

test('alla teman ger olika prompter och bildtexten följer skräcknivån', () => {
  const { themes } = publicMode(EVIL);
  const prompts = themes.map((t) => imagePrompt(EVIL, cleanSettings(EVIL, { theme: t.id })));
  assert.equal(new Set(prompts).size, themes.length);
  const low = captionPrompt(EVIL, cleanSettings(EVIL, { sliders: { skrack: 0 } }));
  const high = captionPrompt(EVIL, cleanSettings(EVIL, { sliders: { skrack: 100 } }));
  assert.notEqual(low, high);
});

test('klienten får aldrig se prompterna', () => {
  for (const mode of [EVIL, KIND]) {
    const text = JSON.stringify(publicMode(mode));
    assert.doesNotMatch(text, /tiers|prompt|Keep each person/i);
  }
});
