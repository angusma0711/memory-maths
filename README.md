# Memory Maths

[Play the game](https://angusma0711.github.io/memory-maths/)

A teacher-led classroom memory and arithmetic game. No login, backend, analytics, microphone or installation required.

## Play

1. Choose a **3×3, 4×4 or 5×5** grid and **+, −, × or ÷**.
2. Students have **30 seconds** to memorise the numbers (1–9) and their letter labels.
3. Numbers disappear; letters and positions stay visible. The screen shows a question such as **□ + □ = 12**.
4. Students say two letters. The teacher selects those cards and clicks **Check answer**.
5. Incorrect answers can be retried without revealing numbers. Correct answers reveal only the chosen pair. Click **Next question** to hide it again.
6. Complete **five questions** on the same board, then reveal all cards. **End & reveal** can finish a round early after confirmation.

All valid pairs are accepted. Subtraction and division follow selection order; division questions have integer answers and subtraction questions have positive answers. Each question uses two different cards. There is no answer timer. Numbers may repeat across different cards. Grid size primarily changes memory load, not arithmetic difficulty.

## Run locally

Serve this directory using any static server, for example:

```sh
python3 -m http.server 4173
```

Open http://localhost:4173. JavaScript modules require an HTTP server, rather than opening `index.html` directly. Google Fonts is optional; system fonts are used if unavailable.

## Tests

With Node.js 20 or later:

```sh
npm test
```

Tests cover all grid sizes and operations, solvability, alternative pairs, card uniqueness and operand order. Serve the root directory directly with GitHub Pages; no build step or third-party JavaScript dependencies are needed.

## Classroom use

Start with 3×3 and addition. A wrong answer can reflect memory or arithmetic difficulty; this is a practice activity, not a diagnostic assessment. Use the full-screen button for projection where supported.
