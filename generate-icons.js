/**
 * Run once to generate the icons folder:
 *   node generate-icons.js
 *
 * Requires the `canvas` package:
 *   npm install canvas   (or: npx --yes canvas)
 */

const fs = require('fs');
const path = require('path');

try {
  const { createCanvas } = require('canvas');

  [16, 48, 128].forEach(size => {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    const s = size;

    // ── Background: rounded square, dark navy ────────────────────────
    const radius = s * 0.2;
    ctx.fillStyle = '#0f172a';
    roundRect(ctx, 0, 0, s, s, radius);
    ctx.fill();

    // ── React atom (3 orbits + nucleus) ─────────────────────────────
    const cx = s / 2;
    const cy = s / 2;
    // Scale orbit radii so they fit nicely with padding
    const rx = s * 0.36;   // semi-major
    const ry = s * 0.13;   // semi-minor

    ctx.strokeStyle = '#38bdf8';  // sky-400 — clear, bright cyan-blue
    ctx.lineWidth = Math.max(1, s * 0.065);
    ctx.lineCap = 'round';

    [0, 60, 120].forEach(deg => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((deg * Math.PI) / 180);
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });

    // Nucleus dot
    ctx.fillStyle = '#7dd3fc';   // sky-300
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.075, 0, Math.PI * 2);
    ctx.fill();

    // ── Cursor pointer arrow (bottom-right corner) ───────────────────
    // Only draw on 48+ where there's enough room
    if (s >= 48) {
      drawCursorArrow(ctx, s);
    }

    const outPath = path.join(__dirname, 'icons', `icon${size}.png`);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
    console.log(`✓ icons/icon${size}.png`);
  });

} catch (err) {
  console.error('Error generating icons:', err.message);
  console.log('\nInstall canvas first:  npm install canvas');
  process.exit(1);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawCursorArrow(ctx, s) {
  // Arrow tip at about 78% of size (bottom-right quadrant)
  const ox = s * 0.60;
  const oy = s * 0.57;
  const len = s * 0.30;
  const hw  = s * 0.085;  // half-width of arrowhead

  // Arrow points down-right at ~135° (like a cursor)
  // We draw a classic mouse-pointer shape (thin triangle + tail)
  const angle = (Math.PI * 3) / 4;  // 135° = pointing down-right
  const tipX = ox + Math.cos(angle) * len * 0.55;
  const tipY = oy + Math.sin(angle) * len * 0.55;

  // Simple solid cursor triangle
  const pts = cursorShape(ox, oy, len, s * 0.07);

  // White fill with dark outline for visibility on any bg
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = Math.max(1, s * 0.04);
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.stroke();
  ctx.fill();
  ctx.restore();
}

function cursorShape(x, y, size, strokeW) {
  // Classic OS cursor: tall narrow triangle with notch
  // Tip at (x,y), pointing up-left, tail going down-right
  const tip = { x, y };
  const bl  = { x: x + size * 0.12,  y: y + size };
  const mid = { x: x + size * 0.12 + size * 0.18, y: y + size * 0.68 };
  const br  = { x: x + size * 0.46,  y: y + size * 0.86 };
  return [tip, bl, mid, br];
}
