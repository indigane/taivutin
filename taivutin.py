#!/usr/bin/env python
# -*- coding: utf-8 -*-

import random
import sys


total_count = 0

words = []
with open('data/sanapalat.txt', 'r', newline='\n', encoding='utf-8') as word_file:
  line_number = 1
  for line in word_file:
    try:
      partial_word, inflection_index, inflection_count = line.rstrip().split('\t')
    except:
      import pdb; pdb.set_trace()
    words.append((partial_word, int(inflection_index), int(inflection_count)))
    total_count += int(inflection_count)
    line_number += 1

inflections = {}
with open('data/taivutuspalat.txt', 'r', newline='\n', encoding='utf-8') as inflection_file:
  inflection_index = 0
  for line in inflection_file:
    inflected_words = line.rstrip().split('\t')
    inflections[int(inflection_index)] = tuple(inflected_words)
    inflection_index += 1


def get_random_inflected_word():
  random_number = random.randint(0, total_count - 1)
  counter = 0
  for partial_word, inflection_index, inflection_count in words:
    if counter + inflection_count > random_number:
      return partial_word + inflections[inflection_index][random_number - counter]
    counter += inflection_count


def main():
  try:
    word_count_to_generate = int(sys.argv[1])
  except (IndexError, ValueError):
    word_count_to_generate = 3
  generated_phrase = ''
  for n in range(0, word_count_to_generate):
    generated_phrase += get_random_inflected_word().capitalize()
  print(generated_phrase)


if __name__ == '__main__':
  main()
