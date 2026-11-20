export class TicketsPage {
  open() {
    cy.intercept('GET', '/api/tickets*').as('loadTickets');
    cy.visit('/');
    cy.wait('@loadTickets');
  }
  items() { return cy.get('[data-testid="ticket-item"]'); }
  count() { return cy.get('[data-testid="ticket-count"]'); }
  itemByTitle(title) { return cy.contains('[data-testid="ticket-item"]', title); }
  searchFor(text) { cy.get('[data-testid="search"]').clear().type(text); }
  setStatus(status) { cy.get('[data-testid="status-filter"]').select(status); }
  setPriority(priority) { cy.get('[data-testid="priority-filter"]').select(priority); }
  setCategory(category) { cy.get('[data-testid="category-filter"]').select(category); }
  // Нажать кнопку действия («В работу» / «Завершить») у заявки и дождаться PATCH
  pressAction(title, label) {
    cy.intercept('PATCH', '/api/tickets/*/status').as('changeStatus');
    this.itemByTitle(title).contains('button', label).click();
    cy.wait('@changeStatus').its('response.statusCode').should('eq', 200);
  }
}
