# EECOL Wire List Roadmap

## Phase 1: UI Polish
- [x] Make the order comments tet bold so it is more glanceable in a busy environment. Bold text makes it easier to read. Enlarging the text slightly so it stays in the current position, but is slightly arger and bold.
- [x] Remove the 'Collapse" button in the header that collapses the list. This feature is not needed as the list should always remain open.
- [x] Remove the 'Complete' and 'Remove' buttons in 'Completed' and 'Archived' lists as the order was already completed/archived to be sent to the 'Completeed' and 'Archived' lists. We dont need duplicate useless buttons.
- [x] Add export options for HTML, Markdown and Text export formats for more varied format export options. We should be supporting all 4 types. CSV, Markdown, HTML, and Text.

## Phase 2: Performance & Security
- [ ] **List Virtualization:** Implement a virtualization library (like `react-window` or `tanstack-virtual`) to handle large datasets efficiently by only rendering items currently in the viewport.
- [ ] **Web Workers for Fuzzy Search:** Move the Fuse.js search logic to a Web Worker to prevent UI thread blocking during intensive search operations on large lists.
- [ ] **IndexedDB Indexing:** Optimize data retrieval by adding indexes to the IndexedDB store for frequently filtered or sorted fields like `status`, `entryType`, and `createdAt`.
- [ ] **Input Sanitization & Validation:** Implement robust sanitization for all user-provided fields (Order #, Comments, etc.) to prevent potential XSS and ensure data integrity.
- [ ] **Content Security Policy (CSP):** Configure a strict CSP to mitigate risks of cross-site scripting and other code injection attacks, ensuring only trusted resources are loaded.
