BOZO v4.14.27 — Authored Theory First

Replace app.js and index.html in the site root.

What changed:
- Book moves now prioritize BOZO-authored per-ply theory before generated/structured fallback text.
- Added authored explanations + memorable takeaways for the full built-in Polish Opening: King's Indian, Polish Grob Attack main line and h5 branch.
- 1.b4, 1...Nf6, 2.Bb2 etc. no longer need to rediscover their purpose from raw square geometry.
- Authored notes are no longer hidden after a fallback note is generated.
- Internal validator text such as "The coach removed an unsupported board claim" can no longer appear to users.
- Generic "improve the piece's activity from X" fallback was removed from the book-move path.
- The Gustafsson PGN remains the annotation-style model; unrelated chess facts are not copied from it.

No database migration. No explorer shard changes.
