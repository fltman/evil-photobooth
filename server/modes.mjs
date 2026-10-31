// Allt som skiljer de två lägena åt: teman, reglage, prompter och texter.
// Klienten skickar bara ett tema-id och reglagevärden. Prompterna byggs här, så läget i
// config.json går inte att runda från webbläsaren.

export const EVIL = 'evil';
export const KIND = 'not-so-scary';

const MODES = {
  [EVIL]: {
    title: 'Den onda spegeln',
    tagline: 'Den har väntat på dig.',
    enter: 'Kliv fram',
    button: 'Framkalla',
    again: 'En gång till',
    galleryTitle: 'De som stannade',
    galleryEmpty: 'Ingen har vågat än.',
    errorLine: 'Spegeln vände bort blicken. Försök igen.',
    softenedNote: 'Spegeln mildrade blodet. Modellen vägrade visa mer.',
    waitLines: ['Stå still.', 'Den lär sig ditt ansikte.', 'Blunda inte.', 'Snart minns du inte hur du såg ut.', 'Den är nästan klar med dig.', 'Det var inte du som log nyss.'],
    fallbackCaptions: ['Du kom in ensam. Spegeln räknar två.', 'Det här är det sista fotot av dig. Det här är det första av den andra.', 'Ingen minns när du slutade blinka.'],
    themes: [
      { id: 'spoke', label: 'Spöke', prompt: 'vengeful ghosts: translucent pale bodies, hollow black eye sockets, hair floating as if underwater, edges of the face smeared by long exposure, cold blue moonlight' },
      { id: 'zombie', label: 'Zombie', prompt: 'the walking dead: grey-green skin, milky clouded eyes, cracked lips, dirt in the hair, sickly cold light' },
      { id: 'monster', label: 'Monster', prompt: 'creatures that used to be human: a stretched jaw with too many teeth, ridged brow, mottled hide, long claws, low red light' },
      { id: 'alien', label: 'Alien', prompt: 'something alien wearing a human shape: elongated skull, huge glossy black eyes, translucent skin with faintly glowing veins, a thin lipless mouth, cold green light from nowhere' },
      { id: 'vampyr', label: 'Vampyr', prompt: 'ancient vampires: bloodless white skin, dark veins at the temples, glowing red irises, long fangs, flickering candlelight' },
      { id: 'demon', label: 'Demon', prompt: 'demons: cracked charcoal skin with embers glowing in the cracks, curved horns, burning eyes, drifting smoke, hellish orange light' },
      { id: 'docka', label: 'Docka', prompt: 'haunted porcelain dolls: glazed cracked porcelain skin, painted cheeks and lips, glass eyes staring slightly the wrong way, hinged jaw, dusty nursery light' },
      { id: 'drunknad', label: 'Drunknad', prompt: 'the drowned: waterlogged bluish skin, wet hair stuck to the face, black water running from the eyes and mouth, weeds in the hair, murky green light' },
    ],
    sliders: [
      {
        id: 'skrack', label: 'Skräck', low: 'Olustigt', high: 'Mardröm', value: 75,
        tiers: [
          'Keep it subtle: they look almost normal, just slightly wrong.',
          'Uncanny and unsettling.',
          'Clearly frightening.',
          'Deeply terrifying, an image that lingers.',
          'Absolute nightmare, maximum dread, the full transformation.',
        ],
      },
      {
        id: 'blod', label: 'Blod', low: 'Torrt', high: 'Slakthus', value: 45,
        tiers: [
          'No blood at all.',
          'A thin trickle of blood from the nose.',
          'Streaks of dark blood on the chin and on the clothes.',
          'Dark blood running from the mouth and soaking the collar, a deep gash across one cheek.',
          'Drenched in dark blood from head to chest, deep open wounds on the face and neck.',
        ],
      },
      {
        id: 'rot', label: 'Förruttnelse', low: 'Färskt', high: 'Urgammalt', value: 45,
        tiers: [
          'Healthy skin texture.',
          'Dark rings under the eyes and a slight waxy pallor.',
          'Bruised, blotchy skin with visible veins.',
          'Rotting patches of skin, sunken cheeks, dry cracked lips.',
          'Advanced decay: skin peeling away in places, sunken eyes, the shape of the skull showing through.',
        ],
      },
      {
        id: 'sallskap', label: 'Sällskap', low: 'Ensam', high: 'Precis bakom dig', value: 55,
        tiers: [
          'The room behind them is empty.',
          'A faint dark shape stands far back in the shadows, barely visible.',
          'A tall thin silhouette is standing in the background, watching.',
          'A pale faceless figure stands close behind them.',
          'A long-fingered pale hand rests on a shoulder, and a tall faceless figure leans in right behind them.',
        ],
      },
    ],
  },

  [KIND]: {
    title: 'Spökspegeln',
    tagline: 'Vem bor i spegeln idag?',
    enter: 'Kom in',
    button: 'Trolla',
    again: 'En gång till',
    galleryTitle: 'Alla våra spöken',
    galleryEmpty: 'Här är det tomt. Bli först!',
    errorLine: 'Oj, trollformeln tog slut. Prova igen!',
    softenedNote: '',
    waitLines: ['Trollformeln blandas…', 'Stå stilla, det kittlas lite!', 'Hokus pokus…', 'Lite mer glitter…', 'Snart, snart, snart…'],
    fallbackCaptions: ['Det snällaste spöket i hela huset!', 'Bu! Sa spöket, och fnittrade.', 'Hej hej från andra sidan spegeln!'],
    themes: [
      { id: 'spoke', label: 'Snällt spöke', prompt: 'adorable friendly little ghosts in soft glowing white sheets, with rosy cheeks and big happy eyes' },
      { id: 'monster', label: 'Gosemonster', prompt: 'fluffy cuddly friendly monsters in bright colors, with one tiny tooth and a huge smile' },
      { id: 'alien', label: 'Rymdkompis', prompt: 'cute friendly little space creatures with tiny antennas and shiny silver suits, waving hello' },
      { id: 'trollkarl', label: 'Trollkarl', prompt: 'cheerful little wizards and witches with starry pointy hats and sparkling magic wands' },
      { id: 'vampyr', label: 'Snäll vampyr', prompt: 'sweet funny vampires with big red bow ties, little capes and two tiny cute toy fangs, laughing' },
      { id: 'pumpa', label: 'Pumpakompis', prompt: 'happy pumpkin characters with big jolly smiles and little green leaf hats' },
      { id: 'katt', label: 'Svart katt', prompt: 'cute black kittens with big shiny eyes, whiskers and fuzzy ears, wearing tiny orange scarves' },
      { id: 'fladdermus', label: 'Fladdermus', prompt: 'tiny cheerful bats with soft round ears and little felt wings, hanging out and smiling' },
    ],
    sliders: [
      {
        id: 'bus', label: 'Busighet', low: 'Snäll', high: 'Jättebusig', value: 50,
        tiers: ['Calm sweet smiles.', 'Happy smiles.', 'Playful grins.', 'Big silly laughing faces.', 'Wildly silly faces with tongues out, everyone laughing.'],
      },
      {
        id: 'slime', label: 'Slime', low: 'Inget', high: 'Massor', value: 20,
        tiers: ['No slime.', 'A tiny drop of green jelly slime on a nose.', 'Funny green jelly slime dribbling from a hat.', 'Lots of funny bright green jelly slime on hats and shoulders.', 'A huge silly splash of bright green jelly slime everywhere, like a game show.'],
      },
      {
        id: 'glitter', label: 'Glitter', low: 'Lite', high: 'Överallt', value: 50,
        tiers: ['A few soft sparkles.', 'Gentle sparkles in the air.', 'Glitter drifting through the air.', 'Clouds of colorful glitter and stars.', 'An explosion of glitter, stars and confetti everywhere.'],
      },
      {
        id: 'godis', label: 'Godis', low: 'Lite', high: 'Berg', value: 40,
        tiers: ['One small lollipop.', 'A small bowl of sweets.', 'Bowls of colorful sweets around them.', 'Heaps of candy and lollipops all around.', 'Enormous mountains of candy filling the whole room.'],
      },
    ],
  },
};

// Allt utom exakt "evil" blir snällt läge: ett stavfel i config.json får aldrig ge blod på ett barnkalas.
export const resolveMode = (name) => (name === EVIL ? EVIL : KIND);

const clamp = (n) => Math.max(0, Math.min(100, Math.round(Number(n)) || 0));
const tierOf = (value, tiers) => tiers[Math.min(tiers.length - 1, Math.floor((value / 100) * tiers.length))];

// Moderering sker per genererad bild, så varje nytt försök drar ned blod och förruttnelse.
const SOFTENING = [{}, { blod: 45, rot: 60, skrack: 80 }, { blod: 0, rot: 30, skrack: 60 }];
export const SOFTENING_STEPS = SOFTENING.length;

export function cleanSettings(mode, input = {}) {
  const def = MODES[mode];
  const theme = def.themes.find((t) => t.id === input.theme) ?? def.themes[0];
  const sliders = Object.fromEntries(def.sliders.map((s) => [s.id, clamp(input.sliders?.[s.id] ?? s.value)]));
  return { theme: theme.id, sliders };
}

export function imagePrompt(mode, { theme, sliders }, softening = 0) {
  const def = MODES[mode];
  const t = def.themes.find((x) => x.id === theme);
  const caps = SOFTENING[softening];
  const parts = def.sliders.map((s) => tierOf(Math.min(sliders[s.id], caps[s.id] ?? 100), s.tiers));

  if (mode === KIND) {
    return [
      `Turn the people in this photo into ${t.prompt}, at a cheerful Halloween party.`,
      'Keep the same pose and framing, and keep each person recognizable by their hair, face shape and smile.',
      ...parts,
      'Warm orange and purple party light, paper bats and pumpkins. Colorful picture book illustration.',
      'Cute, funny and safe for small children: nothing scary, no blood, no skulls, no dark mood. No text, no picture frame.',
    ].join(' ');
  }
  return [
    'Edit this photo into a still from a high-budget horror film, made with practical special-effects makeup.',
    'Keep each person recognizable: same pose, framing, face shape, hairstyle, clothing and the same room.',
    'Everyone stays fully clothed and nothing is sexual. Photorealistic, not a cartoon. No text, no picture frame.',
    `Theme: ${t.prompt}.`,
    ...parts,
  ].join(' ');
}

const CAPTION_RULES = 'Skriv idiomatisk svenska. Högst två korta meningar och högst fjorton ord totalt: hellre för kort än för långt. Tilltala med du om det är en person på bilden och ni om de är flera. Svara bara med bildtexten, utan citattecken, hashtaggar eller emoji. Gissa aldrig vem personerna är och använd inga namn.';

export function captionPrompt(mode, { theme, sliders }) {
  const def = MODES[mode];
  const t = def.themes.find((x) => x.id === theme);
  if (mode === KIND) {
    return `Du är den snälla spökspegeln på ett barnkalas och skriver en bildtext till fotot, där gästerna blivit ${t.label.toLowerCase()}. Texten ska vara rolig och varm och får gärna rimma, men bara om rimmet låter naturligt. Busighet ${sliders.bus} av 100. Nämn något man faktiskt ser i bilden. Aldrig läskigt på riktigt: ingen död, inga hot, inget ont. ${CAPTION_RULES}`;
  }
  const dread = tierOf(sliders.skrack, ['Stämningen är lågmäld och bara lite fel, som något man nästan missar.', 'Stämningen är kuslig och antydande.', 'Stämningen är hotfull.', 'Stämningen är djupt obehaglig.', 'Stämningen är ren, kall fasa utan någon tröst.']);
  const bloody = sliders.blod >= 60 ? 'Du får gärna vara kroppslig och blodig i språket.' : 'Skrämmer med antydan, inte med blod.';
  return `Du är den onda spegeln i en fotobox på en halloweenfest och skriver bildtexten till fotot, där gästerna förvandlats. Tema: ${t.label}. Tala direkt till personerna på bilden. Ta fasta på en konkret detalj du ser, till exempel ett plagg, ett rum eller en blick, och vänd den till något skrämmande. Undvik klyschor som "mörkret" och "för evigt". Stilprov på längd och ton, som du inte får kopiera: "Handen du höjer minns dig. Du minns inte den." ${dread} ${bloody} ${CAPTION_RULES}`;
}

export function fallbackCaption(mode) {
  const list = MODES[mode].fallbackCaptions;
  return list[Math.floor(Math.random() * list.length)];
}

// Det klienten får se: aldrig prompterna, bara det som behövs för att rita gränssnittet.
export function publicMode(mode) {
  const { themes, sliders, fallbackCaptions, ...copy } = MODES[mode];
  return {
    mode,
    ...copy,
    themes: themes.map(({ id, label }) => ({ id, label })),
    sliders: sliders.map(({ id, label, low, high, value }) => ({ id, label, low, high, value })),
  };
}

export const themeLabel = (mode, id) => MODES[mode].themes.find((t) => t.id === id)?.label ?? '';
