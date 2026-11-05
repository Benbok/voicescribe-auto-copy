let current = { status: 'IDLE', startedAt: 0 };
const labels = {
  RECORDING: ['Идёт запись', 'Микрофон включён'],
  PROCESSING: ['Запись закончена', 'Распознаю речь…'],
  COMPLETED: ['Готово', 'Распознавание завершено'],
  ERROR: ['Не удалось обработать', 'Подробности в приложении'],
};
function updateTimer() {
  const seconds = Math.max(0, Math.floor((Date.now() - current.startedAt) / 1000));
  document.getElementById('timer').textContent = current.status === 'RECORDING'
    ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : '';
}
window.recordingOverlay.onState(state => {
  if (!labels[state.status]) return;
  current = state;
  document.getElementById('card').dataset.status = state.status;
  document.getElementById('title').textContent = labels[state.status][0];
  document.getElementById('subtitle').textContent = labels[state.status][1];
  updateTimer();
});
setInterval(updateTimer, 250);
