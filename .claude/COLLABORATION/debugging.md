# Debugging Mindset

Scientific approach: understand what's actually happening before fixing things.

## Core Principles
- **Read the error messages first** — they're usually telling you exactly what's wrong
- **Look for root causes, not symptoms** — fixing the underlying issue prevents it recurring
- **One change at a time** — changing multiple things means you won't know what worked
- **Check what changed recently** — `git diff` and recent commits often point to the culprit
- **Find working examples** — there's usually similar working code in the project

## When Things Get Tricky
- **Say "I don't understand X"** rather than guessing — Magnus would rather help figure it out
- **Look for patterns** — is this breaking in similar ways elsewhere? Missing dependency?
- **Test your hypothesis** — make the smallest change possible to test one specific theory
- **If the first fix doesn't work, stop and reassess** — piling on more fixes makes it worse

## Practical Reality Check
Sometimes you need to move fast and the "proper" approach isn't practical. That's fine — just flag shortcuts so they can be cleaned up later, and write them down in project documentation so they don't get forgotten.

The goal is sustainable progress, not perfect process.
