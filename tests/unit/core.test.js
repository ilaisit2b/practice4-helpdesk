'use strict';
const {
  normalizeTitle, validateTicketInput, canChangeStatus, filterAndSort
} = require('../../src/core');

// Корректная заявка — от неё отталкиваемся и меняем одно поле (Arrange)
const valid = (overrides = {}) => ({
  title: 'Ошибка печати',
  description: 'Принтер не печатает документ',
  category: 'software',
  priority: 'low',
  ...overrides
});

describe('Базовые unit-тесты (из стенда)', () => {
  test('удаляет пробелы в начале и конце темы', () => {
    expect(normalizeTitle('  Ошибка принтера  ')).toBe('Ошибка принтера');
  });

  test('отклоняет неизвестную категорию', () => {
    const errors = validateTicketInput(valid({ category: 'unknown' }));
    expect(errors).toHaveProperty('category');
  });

  test('запрещает возвращение из закрытого статуса', () => {
    expect(canChangeStatus('resolved', 'new')).toBe(false);
  });
});

describe('U: нормализация темы', () => {
  // U-02 / Дефект D1
  test('U-02 заменяет любую последовательность пробельных символов одним пробелом', () => {
    expect(normalizeTitle('  Сбой   VPN\t\tв  корпусе ')).toBe('Сбой VPN в корпусе');
  });

  test('не строка -> пустая строка', () => {
    expect(normalizeTitle(undefined)).toBe('');
    expect(normalizeTitle(123)).toBe('');
  });
});

describe('U: границы длины темы (5..80 после нормализации)', () => {
  // Границы выбраны методом граничных значений: 4 и 81 — первые недопустимые,
  // 5 и 80 — крайние допустимые. Плюс случаи, где длина ДО нормализации
  // проходит, а ПОСЛЕ — нет (и наоборот): так ловится проверка «сырой» строки.
  test.each([
    ['4 символа', false, 'a'.repeat(4)],
    ['5 символов (нижняя граница)', true, 'a'.repeat(5)],
    ['80 символов (верхняя граница)', true, 'a'.repeat(80)],
    ['81 символ', false, 'a'.repeat(81)],
    ['3 символа в окружении пробелов', false, '   абв   '],
    ['80 символов + пробелы по краям', true, '  ' + 'a'.repeat(80) + '  ']
  ])('U-03 %s -> валидна: %s', (_name, isValid, title) => {
    const errors = validateTicketInput(valid({ title }));
    expect(Object.prototype.hasOwnProperty.call(errors, 'title')).toBe(!isValid);
  });
});

describe('U: границы длины описания (10..500 после trim)', () => {
  test.each([
    ['9 символов', false, 'b'.repeat(9)],
    ['10 символов', true, 'b'.repeat(10)],
    ['500 символов', true, 'b'.repeat(500)],
    ['501 символ', false, 'b'.repeat(501)],
    ['9 символов + пробелы', false, '   ' + 'b'.repeat(9) + '   ']
  ])('U-04 %s -> валидно: %s', (_name, isValid, description) => {
    const errors = validateTicketInput(valid({ description }));
    expect(Object.prototype.hasOwnProperty.call(errors, 'description')).toBe(!isValid);
  });

  test('U-05 неизвестный приоритет и не-объект отклоняются', () => {
    expect(validateTicketInput(valid({ priority: 'urgent' }))).toHaveProperty('priority');
    expect(validateTicketInput(null)).toHaveProperty('input');
    expect(validateTicketInput([])).toHaveProperty('input');
  });

  test('корректная заявка не даёт ошибок', () => {
    expect(validateTicketInput(valid())).toEqual({});
  });
});

describe('U: переходы статусов', () => {
  // U-06 / Дефект D2: разрешены только new->in_progress и in_progress->resolved
  test.each([
    ['new', 'in_progress', true],
    ['in_progress', 'resolved', true],
    ['new', 'resolved', false],          // пропуск этапа
    ['in_progress', 'new', false],       // возврат
    ['resolved', 'in_progress', false],  // возврат
    ['new', 'new', false],
    ['new', 'closed', false]             // неизвестный статус
  ])('U-06 %s -> %s разрешён: %s', (from, to, allowed) => {
    expect(canChangeStatus(from, to)).toBe(allowed);
  });
});

describe('U: поиск и сортировка', () => {
  const tickets = [
    { id: 1, title: 'VPN недоступен', description: 'Нет подключения к сети', category: 'network', priority: 'low', status: 'new', createdAt: '2026-10-01T09:00:00.000Z' },
    { id: 2, title: 'Принтер', description: 'Не печатает', category: 'hardware', priority: 'high', status: 'new', createdAt: '2026-10-02T09:00:00.000Z' },
    { id: 3, title: 'Почта', description: 'Не приходят письма', category: 'software', priority: 'medium', status: 'in_progress', createdAt: '2026-10-03T09:00:00.000Z' },
    { id: 4, title: 'Wi-Fi', description: 'Сеть пропадает', category: 'network', priority: 'high', status: 'new', createdAt: '2026-10-04T09:00:00.000Z' }
  ];

  // U-07 / Дефект D3
  test('U-07 сортировка: high -> medium -> low, внутри приоритета новее выше', () => {
    expect(filterAndSort(tickets).map((t) => t.id)).toEqual([4, 2, 3, 1]);
  });

  // U-08 / Дефект D4
  test('U-08 поиск без учёта регистра и с обрезкой пробелов', () => {
    expect(filterAndSort(tickets, { search: '  vpn ' }).map((t) => t.id)).toEqual([1]);
    expect(filterAndSort(tickets, { search: 'СЕТ' }).map((t) => t.id)).toEqual([4, 1]);
  });

  test('U-09 фильтры объединяются через AND', () => {
    const result = filterAndSort(tickets, { search: 'сет', category: 'network', status: 'new' });
    expect(result.map((t) => t.id)).toEqual([4, 1]);
    expect(filterAndSort(tickets, { search: 'сет', category: 'hardware' })).toEqual([]);
  });

  test('фильтрация не меняет исходный массив', () => {
    const copy = JSON.parse(JSON.stringify(tickets));
    filterAndSort(tickets, { search: 'x' });
    expect(tickets).toEqual(copy);
  });
});
