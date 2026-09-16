const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createGuest,
  findPossibleDuplicates,
  groupSize,
  searchGuests,
  validateGuestDraft,
} = require('./guest.ts');

const guest = (name, companions = 0, table = '1', role = 'Convidado') => ({
  ...createGuest({ name, role, companions, table }),
  id: `${name}-${table}`,
});

test('a busca ignora acentos, maiúsculas e aceita parte do nome', () => {
  const guests = [guest('João da Silva'), guest('Mariana Souza'), guest('JOANA Lima')];
  assert.deepEqual(searchGuests(guests, 'joa').map((item) => item.name), ['JOANA Lima', 'João da Silva']);
});

test('a busca encontra convidados pela função', () => {
  const guests = [guest('Ana Lima', 0, '2', 'Cerimonial'), guest('Bruno Costa', 0, '4', 'Homenageado')];
  assert.deepEqual(searchGuests(guests, 'cerimon').map((item) => item.name), ['Ana Lima']);
  assert.deepEqual(searchGuests(guests, 'HOMENAGEADO').map((item) => item.name), ['Bruno Costa']);
});

test('homônimos são identificados mesmo com escrita diferente', () => {
  const guests = [guest('José Carlos', 2, '8')];
  assert.equal(findPossibleDuplicates(guests, '  jose   carlos ').length, 1);
});

test('cadastro exige nome, função, mesa e quantidade válida', () => {
  const errors = validateGuestDraft({ name: ' ', role: '', companions: -1, table: '' });
  assert.ok(errors.name);
  assert.ok(errors.role);
  assert.ok(errors.companions);
  assert.ok(errors.table);
});

test('total do grupo inclui o convidado principal', () => {
  assert.equal(groupSize(guest('Ana', 3)), 4);
});
