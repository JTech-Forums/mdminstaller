document.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('privacyAccepted') === 'true') {
    return;
  }

  const modal = document.getElementById('privacyModal');
  const textEl = document.getElementById('privacyText');
  const checkbox = document.getElementById('policyCheck');
  const acceptBtn = document.getElementById('acceptPolicyBtn');
  const rejectBtn = document.getElementById('rejectPolicyBtn');
  const blocker = document.getElementById('policyBlocker');

  fetch('privacy.txt')
    .then((r) => r.text())
    .then((text) => {
      textEl.textContent = text;
      modal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    });

  checkbox.addEventListener('change', () => {
    acceptBtn.disabled = !checkbox.checked;
  });

  acceptBtn.addEventListener('click', () => {
    localStorage.setItem('privacyAccepted', 'true');
    modal.classList.add('hidden');
    document.body.style.overflow = '';
    // Do not auto-open tutorial/welcome after accepting privacy
  });

  rejectBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
    blocker.classList.remove('hidden');
    document.body.style.overflow = '';
  });
});
