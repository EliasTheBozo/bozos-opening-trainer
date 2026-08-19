# BOZO v4.13.3 — DM RPC Fix

Fixes repeated HTTP 400 responses from `bozo_get_or_create_dm` when starting a DM.

The client now resolves a username to its profile UUID before calling a simpler UUID-based Supabase RPC. This removes username matching from the thread-creation transaction and produces clearer `Player not found` errors before the RPC is called.
