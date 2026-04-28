// Shared UI helpers (formatters, toasts, modals) exposed on window for any page.

// Format a number as a USD currency string.
function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
}

// Format a date-only string for display; falls back to em-dash for null/empty.
function formatDate(value) {
  if (!value) {
    return '—';
  }
  return new Date(value).toLocaleDateString();
}

// Format a full timestamp for display; falls back to em-dash for null/empty.
function formatDateTime(value) {
  if (!value) {
    return '—';
  }
  return new Date(value).toLocaleString();
}

// Show an auto-dismissing toast in the bottom-right corner.
// Lazily creates the container on first call.
function toast(message, type = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.style.position = 'fixed';
    container.style.right = '18px';
    container.style.bottom = '18px';
    container.style.zIndex = '60';
    container.style.display = 'grid';
    container.style.gap = '10px';
    document.body.appendChild(container);
  }

  const item = document.createElement('div');
  item.textContent = message;
  item.style.padding = '12px 14px';
  item.style.borderRadius = '12px';
  item.style.background = type === 'error' ? 'rgba(239,83,80,0.18)' : 'rgba(20,20,22,0.95)';
  item.style.border = '1px solid rgba(255,255,255,0.08)';
  item.style.color = 'white';
  item.style.boxShadow = '0 10px 30px rgba(0,0,0,0.3)';
  container.appendChild(item);
  setTimeout(() => item.remove(), 2800);
}

// Toggle the .show class on a modal element by id (no-op if missing).
function setModalState(id, open) {
  const modal = document.getElementById(id);
  if (!modal) {
    return;
  }
  modal.classList.toggle('show', open);
}

// Public modal API used across pages: modal.open(id) / modal.close(id).
const modal = {
  open(id) {
    setModalState(id, true);
  },
  close(id) {
    setModalState(id, false);
  },
};

window.formatCurrency = formatCurrency;
window.formatDate = formatDate;
window.formatDateTime = formatDateTime;
window.toast = toast;
window.modal = modal;
