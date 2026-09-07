// Apply the saved preference before Angular starts to avoid a light-theme flash.
try {
  document.documentElement.dataset.theme =
    localStorage.getItem('cinema-admin-theme') === 'dark' ? 'dark' : 'light';
} catch {
  document.documentElement.dataset.theme = 'light';
}
