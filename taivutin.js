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
  const form = document.getElementById('form');
  const countInput = document.getElementById('count');
  const wordlistSelect = document.getElementById('wordlist');
  const passwordOutput = document.getElementById('password');
  const copyButton = document.getElementById('copy');
  const entropyText = document.getElementById('entropy');
  const statusText = document.getElementById('status');

  for (const [key, wordlist] of Object.entries(WORDLISTS)) {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = wordlist.name;
    option.selected = key === DEFAULT_WORDLIST;
    wordlistSelect.appendChild(option);
  }

  async function run() {
    const wordCount = Math.max(1, Math.min(32, Math.floor(Number(countInput.value)) || 3));
    countInput.value = wordCount;
    const name = wordlistSelect.value;
    copyButton.hidden = true;
    entropyText.textContent = '';
    if (!loadedWordlists[name]) {
      statusText.textContent = 'Ladataan sanalistaa…';
    }
    try {
      const wordlist = await loadWordlist(name);
      passwordOutput.textContent = generate(wordlist, wordCount);
      entropyText.textContent = (wordCount * wordlist.bitsPerWord).toFixed(1) + ' bittiä (' +
        wordlist.totalCount.toLocaleString('fi-FI') + ' sanamuotoa)';
      copyButton.hidden = false;
      statusText.textContent = '';
    } catch (error) {
      statusText.textContent = 'Sanalistan lataus epäonnistui: ' + error.message;
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    run();
  });
  wordlistSelect.addEventListener('change', run);

  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(passwordOutput.textContent);
      copyButton.textContent = 'Kopioitu';
    } catch (error) {
      copyButton.textContent = 'Kopiointi epäonnistui';
    }
    setTimeout(() => { copyButton.textContent = 'Kopioi'; }, 1500);
  });

  run();
}
