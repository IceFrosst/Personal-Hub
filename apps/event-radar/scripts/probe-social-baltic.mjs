#!/usr/bin/env node
/**
 * Prints the social + organiser checklist for a weekly Baltic/PL discovery pass.
 * Does not call X API from production — run in agent session with x_keyword_search.
 */
const QUERIES = [
  'hackathon (Vilnius OR Kaunas OR Klaipėda) (2026 OR 2027)',
  'hackathon (Riga OR "Latvia") (2026 OR 2027)',
  'hackathon (Tallinn OR Tartu OR Estonia) (2026 OR 2027)',
  'hackathon (Warsaw OR Warszawa OR Kraków OR Krakow OR Wrocław OR Gdańsk OR Poland) (2026 OR 2027)',
  '("HackYeah" OR Garage48 OR Jaunaragiai OR "MAKE IT REAL" OR "sTARTUp Day") (hackathon OR hakaton)',
  'hakatonas (Vilnius OR Kaunas OR Lietuva)',
  'hakaton (Rīga OR Latvija)',
  'häkaton (Tallinn OR Eesti)',
]

const ORGANISERS = [
  ['Jaunaragiai', 'https://www.jaunaragiai.lt/en'],
  ['Startup Lithuania', 'https://www.startuplithuania.com/'],
  ['Garage48', 'https://garage48.org/'],
  ['sTARTUp Day', 'https://www.startupday.ee/'],
  ['HackYeah', 'https://hackyeah.pl/'],
  ['Crossweb PL', 'https://crossweb.pl/en/events/'],
  ['EDTH Luma', 'https://lu.ma/eurodefensetech'],
  ['Riga TechGirls', 'https://rigatechgirls.com/'],
]

console.log('=== X / LinkedIn queries (paste into agent) ===\n')
for (const q of QUERIES) console.log(`- ${q}`)
console.log('\n=== Organiser sites to open ===\n')
for (const [name, url] of ORGANISERS) console.log(`- ${name}: ${url}`)
console.log('\nDone. Promote any open-reg event into known-events or watches.')
