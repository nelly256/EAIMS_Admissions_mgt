# EAIMS Admissions Frontend

This repository contains a responsive front-end prototype for the EAIMS admissions management system. It is built to match the following schema:

- `courses`
- `intakes`
- `students`
- `admission_letters`

## Files

- `index.html` — main user interface with tabs for dashboard, courses, intakes, students, and admission letters.
- `styles.css` — responsive layout and styling.
- `app.js` — form handling, table rendering, and local state management.

The students form now captures an `address` field (e.g., city or region) to help analyze applicant demographics.
The admission letter form now auto-generates per-intake `sequence_number` and `registration_number` when a student is selected.

## How to use

1. Open `index.html` in a browser.
2. Use the tabs to add courses, intakes, students, and admission letters.
3. The current implementation stores data in memory only.

## Next steps

- Add a backend API to persist data.
- Connect forms to `POST`, `GET`, and `DELETE` endpoints.
- Add validation for registered students and admission letter lifecycle.
- Expand the UI with edit and delete controls.
 