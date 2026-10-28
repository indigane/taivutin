'use strict';

// Taivutin - suomen kielen sanoja taivuttava salasanageneraattori.
// Reads the same data files as taivutin.py: a list of partial words with an
// index into a shared table of inflection endings.

const WORDLISTS = {
  wiktionary: { name: 'Wikisanakirja', files: ['data/sanapalat.txt', 'data/taivutuspalat.txt'] },
  kotus: { name: 'Kotus', files: ['data/kotus-sanapalat.txt', 'data/kotus-taivutuspalat.txt'] },
};
const DEFAULT_WORDLIST = 'wiktionary';

class Wordlist {
  constructor(wordsText, inflectionsText) {
    this.partialWords = [];
    this.inflectionIndices = [];
    this.cumulativeCounts = [];
    this.totalCount = 0;
    for (const line of splitLines(wordsText)) {
      const [partialWord, inflectionIndex, inflectionCount] = line.split('\t');
      this.partialWords.push(partialWord);
      this.inflectionIndices.push(Number(inflectionIndex));
      this.totalCount += Number(inflectionCount);
      this.cumulativeCounts.push(this.totalCount);
    }
    this.inflections = [];
    for (const line of splitLines(inflectionsText)) {
      // A line may be empty: an uninflected word has the single ending ''.
      this.inflections.push(line.split('\t'));
    }
  }

  // Returns the inflected word number `index` (0 <= index < totalCount).
  getInflectedWord(index) {
    // Find the first word whose cumulative count is greater than index.
    let low = 0;
    let high = this.cumulativeCounts.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (this.cumulativeCounts[mid] <= index) low = mid + 1;
      else high = mid;
    }
    const start = low > 0 ? this.cumulativeCounts[low - 1] : 0;
    return this.partialWords[low] + this.inflections[this.inflectionIndices[low]][index - start];
  }

  getRandomInflectedWord() {
    return this.getInflectedWord(randomBelow(this.totalCount));
  }

  get bitsPerWord() {
    return Math.log2(this.totalCount);
  }
}

// Splits file contents into lines, dropping only the empty string after the final newline.
function splitLines(text) {
  const lines = text.split('\n');
  if (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

// Uniform random integer in [0, n) from the cryptographic random source.
function randomBelow(n) {
  if (!(n > 0 && n <= 0x100000000)) throw new RangeError('randomBelow: n out of range');
  const limit = 0x100000000 - (0x100000000 % n);
  const buffer = new Uint32Array(1);
  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0] >= limit);
  return buffer[0] % n;
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function generate(wordlist, wordCount) {
  let result = '';
  for (let i = 0; i < wordCount; i++) {
    result += capitalize(wordlist.getRandomInflectedWord());
  }
  return result;
}

const loadedWordlists = {};

async function loadWordlist(name) {
  if (!loadedWordlists[name]) {
    loadedWordlists[name] = Promise.all(WORDLISTS[name].files.map(async (url) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(url + ': ' + response.status + ' ' + response.statusText);
      return response.text();
    })).then(([wordsText, inflectionsText]) => new Wordlist(wordsText, inflectionsText));
    loadedWordlists[name].catch(() => { delete loadedWordlists[name]; });
  }
  return loadedWordlists[name];
}

// Page wiring. Skipped when the script is loaded outside a browser.
if (typeof document !== 'undefined') {
  const SETTINGS_KEY = 'taivutin';
  const LIMITS = { words: [1, 12], lines: [1, 20] };
  const settings = { words: 3, lines: 5, wordlist: DEFAULT_WORDLIST };
  try {
    Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {});
  } catch (error) { /* ignore unreadable settings */ }
  for (const key of Object.keys(LIMITS)) settings[key] = clamp(key, settings[key]);
  if (!WORDLISTS[settings.wordlist]) settings.wordlist = DEFAULT_WORDLIST;

  function clamp(key, value) {
    const [min, max] = LIMITS[key];
    return Math.max(min, Math.min(max, Math.floor(Number(value)) || min));
  }

  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) { /* ignore, e.g. storage disabled */ }
  }

  const form = document.getElementById('form');
  const wordlistFieldset = document.getElementById('wordlist');
  const passwordList = document.getElementById('passwords');
  const entropyText = document.getElementById('entropy');
  const statusText = document.getElementById('status');

  for (const [key, wordlist] of Object.entries(WORDLISTS)) {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'wordlist';
    input.value = key;
    input.checked = key === settings.wordlist;
    input.addEventListener('change', () => {
      settings.wordlist = key;
      saveSettings();
      run();
    });
    label.append(input, document.createTextNode(wordlist.name));
    wordlistFieldset.appendChild(label);
  }

  for (const stepper of document.querySelectorAll('.stepper')) {
    const key = stepper.dataset.setting;
    const valueOutput = stepper.querySelector('[data-value]');
    const buttons = stepper.querySelectorAll('[data-step]');
    const render = () => {
      valueOutput.textContent = settings[key];
      for (const button of buttons) {
        const next = settings[key] + Number(button.dataset.step);
        button.disabled = next < LIMITS[key][0] || next > LIMITS[key][1];
      }
    };
    for (const button of buttons) {
      button.addEventListener('click', () => {
        settings[key] = clamp(key, settings[key] + Number(button.dataset.step));
        saveSettings();
        render();
        run();
      });
    }
    render();
  }

  function createCopyButton(getText) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'copy';
    button.title = 'Kopioi';
    button.setAttribute('aria-label', 'Kopioi');
    button.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(getText());
        button.classList.add('copied');
        button.title = 'Kopioitu';
      } catch (error) {
        button.title = 'Kopiointi epäonnistui';
      }
      setTimeout(() => { button.classList.remove('copied'); button.title = 'Kopioi'; }, 1500);
    });
    return button;
  }

  async function run() {
    const name = settings.wordlist;
    if (!loadedWordlists[name]) {
      statusText.textContent = 'Ladataan sanalistaa…';
    }
    try {
      const wordlist = await loadWordlist(name);
      if (name !== settings.wordlist) return; // another list was chosen meanwhile
      passwordList.replaceChildren();
      for (let i = 0; i < settings.lines; i++) {
        const item = document.createElement('li');
        const text = document.createElement('span');
        text.className = 'password';
        text.textContent = generate(wordlist, settings.words);
        item.append(text, createCopyButton(() => text.textContent));
        passwordList.appendChild(item);
      }
      entropyText.textContent = (settings.words * wordlist.bitsPerWord).toFixed(1) + ' bittiä salasanaa kohti (' +
        wordlist.totalCount.toLocaleString('fi-FI') + ' sanamuotoa)';
      statusText.textContent = '';
    } catch (error) {
      statusText.textContent = 'Sanalistan lataus epäonnistui: ' + error.message;
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    run();
  });

  run();
}
