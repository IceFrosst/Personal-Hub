import assert from 'node:assert/strict'
import test from 'node:test'

import { focusText } from '../lib/ingest/enrich'

test('keeps the page head', () => {
  const text = 'Welcome to MegaHack. '.repeat(50)
  assert.ok(focusText(text).startsWith('Welcome to MegaHack.'))
})

test('hoists a deep travel section into the model window', () => {
  const filler = 'x'.repeat(20000)
  const buried = 'We reimburse travel up to 500 EUR for accepted hackers.'
  const text = `Intro about the event. ${filler} FAQ: ${buried} ${filler}`
  const focused = focusText(text)
  // The travel sentence sits ~20k chars deep — a naive 9k head slice would miss it.
  assert.ok(text.slice(0, 9000).indexOf('reimburse travel') === -1)
  assert.ok(focused.includes('reimburse travel up to 500 EUR'))
})

test('stays within the budget', () => {
  const text = ('travel stipend accommodation hotel flight reimbursement ' + 'y'.repeat(400)).repeat(200)
  assert.ok(focusText(text, 9000).length <= 9000)
})

test('handles pages with no travel keywords by returning the head', () => {
  const text = 'A short description with nothing relevant here.'
  assert.equal(focusText(text), text)
})
