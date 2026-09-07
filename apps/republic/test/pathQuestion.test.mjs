import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { GROUP_PHOTO_QUESTION, SCREENING_QUESTIONS } from '../lib/content.ts'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('group-photo question is excluded from the opening rotation', () => {
  assert.equal(SCREENING_QUESTIONS.some((item) => item.question === GROUP_PHOTO_QUESTION.question), false)
  assert.equal(GROUP_PHOTO_QUESTION.options.includes('MIDDLE. NATURAL LEADER.'), true)
})

test('Business asks the group-photo question only after proposal submission', () => {
  const source = read('components/visa-steps/BusinessStep.tsx')
  assert.match(source, /update\(\{ businessPitch: pitch\.trim\(\), businessPitchSubmitted: true \}\)[\s\S]*setStage\('photo'\)/)
  assert.match(source, /stage === 'photo'[\s\S]*<GroupPhotoQuestion/)
  assert.match(source, /answerPhotoQuestion[\s\S]*router\.push\('\/appointment'\)/)
})

test('Sidequest asks the group-photo question after the idea and before supplies', () => {
  const source = read('components/visa-steps/TouristStep.tsx')
  assert.match(source, /update\(\{ sidequestIdea: idea\.trim\(\), sidequestIdeaSubmitted: true \}\)[\s\S]*setStage\('photo'\)/)
  assert.match(source, /if \(stage === 'photo'\)[\s\S]*<GroupPhotoQuestion/)
  assert.match(source, /answerPhotoQuestion[\s\S]*setStage\('supplies'\)/)
})
