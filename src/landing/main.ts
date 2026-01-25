const footerYearEl = document.getElementById('footerYear');
if (footerYearEl) {
  footerYearEl.textContent = `© ${new Date().getFullYear()} · Built with Three.js`;
}

