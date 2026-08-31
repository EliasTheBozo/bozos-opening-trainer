BOZO v4.14.42 hotfix

Fixes two JavaScript temporal-dead-zone startup errors introduced by the Review voice/managed-engine integration:
- reviewVoiceEnabled was read by Review setup before its later let declaration initialized.
- webBotMoveEngine was read by resetManagedStockfish before its later let declaration initialized.

Both shared state variables are now declared with the main Review state before any Review event handlers can run. Voice preferences are assigned later after the constants/voice roster exist, and the voice UI is refreshed only after that initialization completes.

No database migration is required beyond v4.14.40.
