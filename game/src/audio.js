// All sound is synthesised with WebAudio — no audio files. A lazy engine hum
// and a police siren run as oscillators whose gain follows the action; the
// rest are short one-shot blips (punch, crash, cash register, mission sting).

export function createAudio() {
  let context = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenFlip = null;
  let muted = false;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return true;
    }
    try {
      context = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return false;
    }
    master = context.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(context.destination);

    engineOsc = context.createOscillator();
    engineOsc.type = 'sawtooth';
    engineGain = context.createGain();
    engineGain.gain.value = 0;
    const engineFilter = context.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineOsc.connect(engineFilter).connect(engineGain).connect(master);
    engineOsc.start();

    sirenOsc = context.createOscillator();
    sirenOsc.type = 'triangle';
    sirenGain = context.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain).connect(master);
    sirenOsc.start();
    let high = false;
    sirenFlip = window.setInterval(() => {
      if (!context || sirenGain.gain.value <= 0) return;
      high = !high;
      sirenOsc.frequency.setValueAtTime(high ? 1180 : 840, context.currentTime);
    }, 380);
    return true;
  }

  function blip(freqA, freqB, seconds, type, volume) {
    if (!ensure()) return;
    const osc = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    osc.type = type;
    osc.frequency.setValueAtTime(freqA, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqB), now + seconds);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + seconds);
    osc.connect(gain).connect(master);
    osc.start(now);
    osc.stop(now + seconds + 0.02);
  }

  function noiseBurst(seconds, volume) {
    if (!ensure()) return;
    const length = Math.floor(context.sampleRate * seconds);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const gain = context.createGain();
    gain.gain.value = volume;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    source.connect(filter).connect(gain).connect(master);
    source.start();
  }

  return {
    ensure,
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (master && context) master.gain.setValueAtTime(muted ? 0 : 0.5, context.currentTime);
      return muted;
    },
    /** Continuous engine note: call every frame with speed 0..1, or null when on foot. */
    setEngine(speedRatio) {
      if (!context || !engineOsc) return;
      const now = context.currentTime;
      if (speedRatio === null) {
        engineGain.gain.setTargetAtTime(0, now, 0.1);
      } else {
        engineOsc.frequency.setTargetAtTime(55 + speedRatio * 165, now, 0.06);
        engineGain.gain.setTargetAtTime(0.05 + speedRatio * 0.05, now, 0.08);
      }
    },
    setSiren(active) {
      if (!context || !sirenGain) return;
      sirenGain.gain.setTargetAtTime(active ? 0.035 : 0, context.currentTime, 0.2);
    },
    punch() { noiseBurst(0.09, 0.25); blip(160, 60, 0.09, 'square', 0.12); },
    crash(strength) { noiseBurst(0.22, Math.min(0.5, 0.15 + strength * 0.4)); blip(120, 40, 0.2, 'sawtooth', 0.15); },
    screech() { blip(1400, 900, 0.16, 'sawtooth', 0.03); },
    pickup() { blip(660, 990, 0.12, 'sine', 0.18); },
    cash() { blip(880, 880, 0.07, 'square', 0.12); window.setTimeout(() => blip(1318, 1318, 0.12, 'square', 0.12), 70); },
    missionComplete() { [523, 659, 784, 1046].forEach((f, i) => window.setTimeout(() => blip(f, f, 0.16, 'triangle', 0.16), i * 95)); },
    missionFail() { blip(320, 140, 0.35, 'triangle', 0.16); },
    bustedSting() { blip(392, 392, 0.18, 'square', 0.14); window.setTimeout(() => blip(311, 220, 0.4, 'square', 0.14), 180); },
    click() { blip(700, 700, 0.05, 'sine', 0.1); },
    dispose() { if (sirenFlip) window.clearInterval(sirenFlip); },
  };
}
