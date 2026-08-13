# BOZO v4.9.2 — Modal close fix

Root cause:
`.modal-backdrop { display:grid }` was overriding the browser's default
`[hidden] { display:none }` behavior. The close handlers were setting
`hidden = true`, but CSS continued rendering the modal.

Fix:
- Adds `.modal-backdrop[hidden]{display:none!important}`.
- Adds delegated close handling as a second layer for both Create Club and Create Arena.
- Existing backdrop click and Escape handling from v4.9.1 remains.

No Supabase changes are required.
