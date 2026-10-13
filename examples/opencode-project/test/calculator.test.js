import test from 'node:test';
import assert from 'node:assert/strict';
import { add, multiply } from '../src/calculator.js';

test('addition remains unchanged', () => {
  assert.equal(add(2, 3), 5);
});

test('multiplication works with positive, negative and zero operands', () => {
  assert.equal(multiply(2, 3), 6);
  assert.equal(multiply(-2, 3), -6);
  assert.equal(multiply(0, 5), 0);
});
