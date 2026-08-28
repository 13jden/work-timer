/**
 * Salary Timer — Sheets: Item Sheet (add/edit convert items)
 * Handles the modal for adding, editing, and deleting convert items.
 */
import { $, escapeHtml } from './dom.js';
import { state, EMOJI_CHOICES } from './state.js';
import { persistItems } from './storage.js';
import { renderConvert } from './render-convert.js';
import { toast, closeSheet } from './ui.js';

export function buildEmojiGrid() {
    const g = $('emoji-grid');
    g.innerHTML = EMOJI_CHOICES.map(e =>
        `<button data-emoji="${e}">${e}</button>`
    ).join('');
    g.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        g.querySelectorAll('button').forEach(x => x.classList.remove('selected'));
        b.classList.add('selected');
        state.selectedIcon = b.dataset.emoji;
    });
}

export function openItemSheet(item = null) {
    state.editingItemId = item ? item.id : null;
    $('item-sheet-title').textContent = item ? '编辑物品' : '添加物品';
    $('item-name').value  = item ? item.name  : '';
    $('item-price').value = item ? item.price : '';
    state.selectedIcon = item ? item.icon : '📦';
    $('item-delete').classList.toggle('hidden', !item);

    setTimeout(() => {
        const g = $('emoji-grid');
        g.querySelectorAll('button').forEach(b => {
            b.classList.toggle('selected', b.dataset.emoji === state.selectedIcon);
        });
    }, 0);

    $('sheet-backdrop').classList.add('is-open');
    $('item-sheet').style.display = 'block';
    $('day-sheet').style.display  = 'none';
    setTimeout(() => $('item-name').focus(), 350);
}

export function closeSheet() {
    $('sheet-backdrop').classList.remove('is-open');
}

export function saveItemFromSheet() {
    const name  = $('item-name').value.trim();
    const price = parseFloat($('item-price').value);
    if (!name) { toast('请输入物品名称'); return; }
    if (!name.match(/^[\u4e00-\u9fa5A-Za-z0-9\s·•\-_]{1,20}$/)) {
        toast('名称最多 20 个字符'); return;
    }
    if (isNaN(price) || price <= 0) { toast('请输入有效价格'); return; }

    if (state.editingItemId) {
        const it = state.items.find(i => i.id === state.editingItemId);
        if (it) Object.assign(it, { name, price, icon: state.selectedIcon });
    } else {
        state.items.push({
            id: 'item-' + Date.now(),
            name, price, icon: state.selectedIcon,
            order: state.items.length,
        });
    }
    persistItems();
    renderConvert();
    closeSheet();
    toast(state.editingItemId ? '已更新' : '已添加：' + name);
}

export function deleteCurrentItem() {
    if (!state.editingItemId) return;
    const it = state.items.find(i => i.id === state.editingItemId);
    const name = it ? it.name : '';
    state.items = state.items.filter(i => i.id !== state.editingItemId);
    state.items.forEach((it, idx) => it.order = idx);
    persistItems();
    renderConvert();
    closeSheet();
    toast('已删除：' + name);
}
