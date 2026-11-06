import { classifyMicError, micProblemMessage } from '../answerMemory';

// The side panel cannot show Chrome's permission prompt, so the one-time ask
// happens here, in a normal tab on the same extension origin. Once allowed,
// the side panel can record without asking again.
const button = document.getElementById('allow') as HTMLButtonElement;
const status = document.getElementById('status') as HTMLDivElement;

button.addEventListener('click', async () => {
  status.className = '';
  status.textContent = '';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    status.className = 'ok';
    status.textContent = 'Microphone allowed. You can close this tab and press Speak in the panel.';
  } catch (err) {
    const problem = classifyMicError(err);
    status.className = 'bad';
    status.textContent = problem === 'denied'
      ? 'Chrome blocked it. Click the icon at the left of the address bar, allow the microphone, then try again.'
      : micProblemMessage(problem);
  }
});
