'use strict';
const { createApp } = require('../../src/app');
const { initialTickets } = require('../../src/store');

let server;
let base;

// Каждый тест получает свой сервер на свободном порту (порт 0) и своё состояние
async function startServer(seed) {
  server = createApp({ seed });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
}

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
});

const api = {
  list: (query = '') => fetch(`${base}/api/tickets${query}`).then(async (r) => ({ status: r.status, body: await r.json() })),
  create: (data) => fetch(`${base}/api/tickets`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data)
  }).then(async (r) => ({ status: r.status, body: await r.json() })),
  setStatus: (id, status) => fetch(`${base}/api/tickets/${id}/status`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status })
  }).then(async (r) => ({ status: r.status, body: await r.json() }))
};

const printer = {
  title: 'Сбой принтера', description: 'Принтер в аудитории не отвечает',
  category: 'hardware', priority: 'medium'
};

describe('API на пустом хранилище', () => {
  beforeEach(() => startServer([]));

  test('GET /api/health отвечает HTTP 200', async () => {
    const response = await fetch(`${base}/api/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  test('POST /api/tickets создает корректную заявку', async () => {
    const { status, body } = await api.create(printer);
    expect(status).toBe(201);
    expect(body.ticket.id).toBe(1);
    expect(body.ticket.status).toBe('new');
  });

  test('I-01 созданная заявка читается через GET с теми же данными', async () => {
    // Arrange + Act
    const created = await api.create(printer);
    const listed = await api.list();
    // Assert
    expect(listed.status).toBe(200);
    expect(listed.body.total).toBe(1);
    expect(listed.body.items[0]).toEqual(created.body.ticket);
    expect(listed.body.items[0]).toMatchObject({ ...printer, status: 'new' });
  });

  test('I-02 ошибка валидации -> 400, количество заявок не меняется', async () => {
    const before = await api.list();
    const { status, body } = await api.create({ ...printer, title: 'abc', priority: 'urgent' });
    const after = await api.list();
    expect(status).toBe(400);
    expect(body.errors).toHaveProperty('title');
    expect(body.errors).toHaveProperty('priority');
    expect(after.body.total).toBe(before.body.total);
  });

  test('I-03 тема нормализуется при создании через API', async () => {
    const { status, body } = await api.create({ ...printer, title: '  Сбой   VPN  в корпусе ' });
    expect(status).toBe(201);
    expect(body.ticket.title).toBe('Сбой VPN в корпусе');
  });

  test('I-04 тема из одних пробелов и 3 букв отклоняется (400)', async () => {
    const { status } = await api.create({ ...printer, title: '     абв     ' });
    expect(status).toBe(400);
    expect((await api.list()).body.total).toBe(0);
  });

  test('I-05 некорректный JSON -> 400', async () => {
    const response = await fetch(`${base}/api/tickets`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{oops'
    });
    expect(response.status).toBe(400);
  });

  test('I-06 последовательные запросы: id растут, статус всегда new', async () => {
    const a = await api.create(printer);
    const b = await api.create({ ...printer, status: 'resolved' }); // попытка подсунуть статус
    expect(a.body.ticket.id).toBe(1);
    expect(b.body.ticket.id).toBe(2);
    expect(b.body.ticket.status).toBe('new');
    expect((await api.list()).body.total).toBe(2);
  });
});

describe('API на демонстрационных данных', () => {
  beforeEach(() => startServer(initialTickets()));

  test('I-07 search + status + category работают одновременно (AND)', async () => {
    const { status, body } = await api.list('?search=%D1%81%D0%B5%D1%82%D0%B8&status=new&category=network'); // search=сети
    expect(status).toBe(200);
    expect(body.total).toBe(1);
    expect(body.items.map((t) => t.id)).toEqual([1]);
  });

  test('I-08 поиск в API без учёта регистра', async () => {
    const { body } = await api.list('?search=vpn');
    expect(body.items.map((t) => t.id)).toEqual([1]);
  });

  test('I-09 порядок в ответе: high -> medium -> low, при равном приоритете новее выше', async () => {
    const { body } = await api.list();
    expect(body.items.map((t) => t.id)).toEqual([4, 1, 2, 3]);
  });

  test('I-10 PATCH new -> resolved (пропуск этапа) -> 409, статус не меняется', async () => {
    const res = await api.setStatus(1, 'resolved');
    expect(res.status).toBe(409);
    const { body } = await api.list();
    expect(body.items.find((t) => t.id === 1).status).toBe('new');
  });

  test('I-11 допустимая цепочка new -> in_progress -> resolved -> 200, возврат -> 409', async () => {
    expect((await api.setStatus(3, 'in_progress')).status).toBe(200);
    const done = await api.setStatus(3, 'resolved');
    expect(done.status).toBe(200);
    expect(done.body.ticket.status).toBe('resolved');
    expect((await api.setStatus(3, 'new')).status).toBe(409);
  });

  test('I-12 неизвестный статус -> 400, несуществующий id -> 404', async () => {
    expect((await api.setStatus(1, 'closed')).status).toBe(400);
    expect((await api.setStatus(999, 'in_progress')).status).toBe(404);
  });

  // TDD (задание A): фильтр по приоритету
  test('T-01 GET /api/tickets?priority=high возвращает только high', async () => {
    const { status, body } = await api.list('?priority=high');
    expect(status).toBe(200);
    expect(body.total).toBe(2);
    expect(body.items.map((t) => t.priority)).toEqual(['high', 'high']);
  });

  test('T-02 priority сочетается с category и status (AND)', async () => {
    const { body } = await api.list('?priority=high&category=network&status=new');
    expect(body.items.map((t) => t.id)).toEqual([1]);
    const none = await api.list('?priority=low&category=network');
    expect(none.body.total).toBe(0);
  });
});
