'use client';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  ctx ??= new AC();
  return ctx;
}

/** Browsers only allow sound after a tap or click. Call this from any user gesture. */
export function unlockAudio() {
  const c = audio();
  if (c && c.state === 'suspended') void c.resume();
}

/** Three soft beeps, generated in code so no sound file is needed. */
export function playAlarm() {
  const c = audio();
  if (!c) return;
  void c.resume();
  [0, 0.45, 0.9].forEach((d) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    const t0 = c.currentTime + d;
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.4, t0 + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + 0.4);
  });
}
