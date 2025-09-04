const { JSDOM } = require('jsdom');
const FluidCursor = require('../js/ui/fluid-cursor.js');

const dom = new JSDOM('<!DOCTYPE html><body></body>');
const { window } = dom;

global.window = window;
global.document = window.document;

// Stub animation frames to avoid loops
global.requestAnimationFrame = () => 0;
global.cancelAnimationFrame = () => {};

new FluidCursor();

if (!window.document.querySelector('.fluid-cursor')) {
  throw new Error('Fluid cursor element not created');
}

console.log('Smoke test passed: fluid cursor initialized');
