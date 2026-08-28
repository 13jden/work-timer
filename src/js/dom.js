/**
 * Salary Timer — DOM Helpers & Flip Animation
 * DOM-only utilities (no business logic).
 */

export const $ = (id) => document.getElementById(id);

export function fmtMoney(n) {
    if (n >= 10000) return '¥' + Math.round(n).toLocaleString('en-US');
    return '¥' + n.toFixed(2);
}

export function fmtMoneyFloat(n, dec = 4) {
    return '¥' + n.toFixed(dec);
}

export function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    })[c]);
}

// ── Flip number animation ─────────────────────────────────
const flipCache = new WeakMap();

export function setFlipText(el, newText) {
    if (!el) return;
    const prev = flipCache.get(el);
    if (prev === undefined) {
        el.textContent = newText;
        flipCache.set(el, newText);
        return;
    }
    if (prev === newText) return;

    const max = Math.max(prev.length, newText.length);
    if (max > 32) {
        el.textContent = newText;
        flipCache.set(el, newText);
        return;
    }

    const out = [];
    for (let i = 0; i < max; i++) {
        const oldCh = prev[i] || ' ';
        const newCh = newText[i] || ' ';
        out.push(`<span class="flip-static" data-i="${i}">${escapeHtml(newCh)}</span>`);
    }

    el.innerHTML = out.join('');
    for (let i = 0; i < max; i++) {
        if ((prev[i] || ' ') !== (newText[i] || ' ')) {
            const span = el.querySelector(`[data-i="${i}"]`);
            if (!span) continue;
            span.style.display = 'inline-block';
            span.style.transform = 'translateY(100%)';
            span.style.opacity = '0';
            requestAnimationFrame(() => {
                span.style.transition = 'transform 0.35s cubic-bezier(0.32,0.72,0,1), opacity 0.25s ease';
                span.style.transform = 'translateY(0)';
                span.style.opacity = '1';
            });
        }
    }
    flipCache.set(el, newText);
}
