document.addEventListener('DOMContentLoaded', () => {
  const isMobile = /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
  if (!isMobile) return;

  const modal = document.getElementById('mobileWarningModal');
  const proceedBtn = document.getElementById('mobileProceedBtn');
  const leaveBtn = document.getElementById('mobileLeaveBtn');

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  proceedBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  });

  leaveBtn.addEventListener('click', () => {
    window.history.back();
  });
});

