export class TicketForm {
  fill({ title, description, category = 'software', priority = 'medium' }) {
    cy.get('[data-testid="title"]').type(title, { parseSpecialCharSequences: false });
    cy.get('[data-testid="description"]').type(description, { parseSpecialCharSequences: false });
    cy.get('[data-testid="category"]').select(category);
    cy.get('[data-testid="priority"]').select(priority);
  }
  submit() {
    cy.intercept('POST', '/api/tickets').as('createTicket');
    cy.get('[data-testid="submit-ticket"]').click();
    return cy.wait('@createTicket');
  }
  message() { return cy.get('[data-testid="form-message"]'); }
}
