const test = require('node:test');
const assert = require('node:assert/strict');
const { clampMapElement, createDefaultLayout, findTableElement } = require('./eventLayout.ts');

test('o mapa inicial contém as 30 mesas sem números repetidos', () => {
  const layout = createDefaultLayout();
  const labels = layout.elements.filter((item) => item.kind === 'table').map((item) => item.label);
  assert.equal(labels.length, 30);
  assert.equal(new Set(labels).size, 30);
});

test('a mesa de um convidado é localizada sem diferença de espaços', () => {
  assert.equal(findTableElement(createDefaultLayout(), ' 10 ')?.label, '10');
});

test('um item movido permanece dentro dos limites do mapa', () => {
  const item = clampMapElement({ id: 'x', kind: 'structure', label: 'X', x: 99, y: -5, width: 20, height: 10, color: '#fff', shape: 'rectangle' });
  assert.equal(item.x, 80);
  assert.equal(item.y, 0);
});
