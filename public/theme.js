// Applies the saved appearance before the page paints, so there is no flash. "Auto" follows the device,
// which on phones and laptops usually switches with the time of day.
try {
  var t = localStorage.getItem('unity.theme.v1')
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t)
} catch (e) { /* the choice is optional */ }
