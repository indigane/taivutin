#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
import bisect
import os
import secrets
import sys


DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')

# In order of preference; the first one is the default.
WORDLISTS = ['kotuskarsittu', 'kotusfull', 'wikisanakirja']
DEFAULT_WORDLIST = WORDLISTS[0]


class Wordlist:
  def __init__(self, words_path, inflections_path):
    self.partial_words = []
    self.inflection_indices = []
    self.cumulative_counts = []
    self.total_count = 0
    with open(words_path, 'r', newline='\n', encoding='utf-8') as word_file:
      for line in word_file:
        partial_word, inflection_index, inflection_count = line.rstrip('\n').split('\t')
        self.partial_words.append(partial_word)
        self.inflection_indices.append(int(inflection_index))
        self.total_count += int(inflection_count)
        self.cumulative_counts.append(self.total_count)
    self.inflections = []
    with open(inflections_path, 'r', newline='\n', encoding='utf-8') as inflection_file:
      for line in inflection_file:
        self.inflections.append(line.rstrip('\n').split('\t'))

  def get_inflected_word(self, index):
    """Return the inflected word number `index` (0 <= index < total_count)."""
    word_index = bisect.bisect_right(self.cumulative_counts, index)
    start = self.cumulative_counts[word_index - 1] if word_index > 0 else 0
    partial_word = self.partial_words[word_index]
    inflection = self.inflections[self.inflection_indices[word_index]][index - start]
    return partial_word + inflection

  def get_random_inflected_word(self):
    return self.get_inflected_word(secrets.randbelow(self.total_count))


def load_wordlist(name):
  return Wordlist(os.path.join(DATA_DIR, name + '-sanapalat.txt'), os.path.join(DATA_DIR, name + '-taivutuspalat.txt'))


def generate(wordlist, word_count):
  return ''.join(wordlist.get_random_inflected_word().capitalize() for n in range(word_count))


def main():
  parser = argparse.ArgumentParser(description='Suomen kielen sanoja taivuttava salasanageneraattori.')
  parser.add_argument('count', nargs='?', type=int, default=3, help='sanojen määrä (oletus 3)')
  parser.add_argument('-w', '--wordlist', choices=WORDLISTS, default=DEFAULT_WORDLIST,
                      help='sanalista (oletus %(default)s)')
  args = parser.parse_args()
  try:
    wordlist = load_wordlist(args.wordlist)
  except FileNotFoundError as error:
    sys.exit('Sanalistaa "%s" ei löydy: %s' % (args.wordlist, error.filename))
  print(generate(wordlist, args.count))


if __name__ == '__main__':
  main()
