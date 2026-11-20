'use strict';

const CATEGORIES = ['hardware', 'software', 'network'];
const PRIORITIES = ['low', 'medium', 'high'];
const STATUSES = ['new', 'in_progress', 'resolved'];
const PRIORITY_RANK = { low: 1, medium: 2, high: 3 };
// Поля, по которым фильтр сравнивает значение на точное совпадение
const EXACT_FILTERS = ['status', 'category', 'priority'];
// Разрешённые переходы: из какого статуса -> в какой
const TRANSITIONS = { new: ['in_progress'], in_progress: ['resolved'], resolved: [] };

/**
 * Нормализует тему заявки: внешние и повторяющиеся пробелы незначимы.
 * Продукт передан студентам в исходном состоянии; корректность НЕ гарантируется.
 */
function normalizeTitle(title) {
  return typeof title === 'string' ? title.trim().replace(/\s+/g, ' ') : '';
}

function validateTicketInput(input) {
  const errors = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { input: 'Ожидается объект с данными заявки' };
  }

  const title = normalizeTitle(input.title);
  if (typeof input.title !== 'string' || title.length < 5 || title.length > 80) {
    errors.title = 'Тема должна содержать от 5 до 80 символов';
  }

  const description = typeof input.description === 'string' ? input.description.trim() : '';
  if (description.length < 10 || description.length > 500) {
    errors.description = 'Описание должно содержать от 10 до 500 символов';
  }
  if (!CATEGORIES.includes(input.category)) {
    errors.category = 'Неизвестная категория';
  }
  if (!PRIORITIES.includes(input.priority)) {
    errors.priority = 'Неизвестный приоритет';
  }
  return errors;
}

function canChangeStatus(from, to) {
  return Object.hasOwn(TRANSITIONS, from) && TRANSITIONS[from].includes(to);
}

/**
 * Условия поиска объединяются оператором AND.
 * В результирующем списке первыми должны идти важные и новые заявки.
 */
function clean(value) {
  return String(value || '').trim();
}

function matchesFilters(ticket, filters) {
  const exactOk = EXACT_FILTERS.every((field) => {
    const wanted = clean(filters[field]);
    return !wanted || ticket[field] === wanted;
  });
  if (!exactOk) return false;
  const search = clean(filters.search).toLowerCase();
  if (!search) return true;
  return ticket.title.toLowerCase().includes(search)
    || ticket.description.toLowerCase().includes(search);
}

function compareTickets(a, b) {
  const byPriority = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
  if (byPriority !== 0) return byPriority;
  return b.createdAt.localeCompare(a.createdAt);
}

function filterAndSort(tickets, filters = {}) {
  return tickets.filter((ticket) => matchesFilters(ticket, filters)).sort(compareTickets);
}

module.exports = {
  CATEGORIES,
  PRIORITIES,
  STATUSES,
  EXACT_FILTERS,
  normalizeTitle,
  validateTicketInput,
  canChangeStatus,
  filterAndSort
};
