import { TicketsPage } from '../pages/TicketsPage';
import { TicketForm } from '../pages/TicketForm';

const page = new TicketsPage();
const form = new TicketForm();

describe('HelpDesk — E2E-сценарии', () => {
  beforeEach(() => {
    // Независимое начальное состояние: 4 демо-заявки перед каждым сценарием.
    // Сброс доступен только при запуске npm run start:test.
    cy.request('POST', '/api/__reset');
    page.open();
  });

  it('E-01 показывает исходные заявки', () => {
    cy.get('[data-testid="page-title"]').should('contain', 'HelpDesk');
    page.items().should('have.length', 4);
    page.count().should('have.text', '4');
    // сортировка: сначала high, при равном приоритете — более новая
    cy.get('.ticket-title').first().should('have.text', 'Wi-Fi на этаже');
  });

  it('E-02 BDD-1: создание корректной заявки через форму', () => {
    // Given: открыт экран, в реестре 4 заявки
    page.count().should('have.text', '4');
    // When: пользователь заполняет все поля и отправляет форму
    form.fill({
      title: 'Не работает проектор',
      description: 'В аудитории 405 проектор не включается',
      category: 'hardware',
      priority: 'high'
    });
    form.submit().its('response.statusCode').should('eq', 201);
    // Then: сообщение с номером, заявка в списке, счётчик 5
    form.message().should('have.text', 'Заявка №5 создана');
    page.count().should('have.text', '5');
    page.itemByTitle('Не работает проектор').should('contain', 'Новая');
  });

  it('E-03 BDD-2: слишком короткая тема отклоняется', () => {
    form.fill({ title: 'abc', description: 'Описание достаточной длины' });
    form.submit().its('response.statusCode').should('eq', 400);
    form.message().should('contain', 'Тема должна содержать от 5 до 80 символов');
    page.count().should('have.text', '4');
  });

  it('E-04 поиск + фильтры статуса и категории (AND)', () => {
    page.searchFor('сети');
    page.items().should('have.length', 2);
    page.setStatus('new');
    page.setCategory('network');
    page.items().should('have.length', 1).first().should('contain', 'VPN недоступен');
    page.count().should('have.text', '1');
  });

  it('E-05 BDD-3: перевод заявки в работу и завершение', () => {
    page.pressAction('Мышь не работает', 'В работу');
    page.itemByTitle('Мышь не работает').should('contain', 'В работе');
    page.pressAction('Мышь не работает', 'Завершить');
    page.itemByTitle('Мышь не работает')
      .should('contain', 'Завершена')
      .find('button').should('not.exist');
  });

  it('E-06 HTML из ввода пользователя отображается как текст', () => {
    const evil = '<img src=x onerror="window.__xss=1">Взлом';
    form.fill({ title: evil, description: '<b>жирный</b> текст описания' });
    form.submit().its('response.statusCode').should('eq', 201);
    page.itemByTitle('Взлом').within(() => {
      cy.get('img').should('not.exist');
      cy.get('b').should('not.exist');
      cy.get('.ticket-title').should('have.text', evil);
    });
    cy.window().should('not.have.property', '__xss');
  });

  it('E-07 фильтр по приоритету (TDD) сочетается с другими фильтрами', () => {
    page.setPriority('high');
    page.items().should('have.length', 2);
    page.setCategory('network');
    page.setStatus('new');
    page.items().should('have.length', 1).first().should('contain', 'VPN недоступен');
  });
});
