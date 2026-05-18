function createManualAdapter({
  name,
  label,
  matchers = [],
  manualHint,
}) {
  if (!name) throw new Error('manual adapter requires name');

  const normalizedMatchers = Array.isArray(matchers) ? matchers : [matchers];

  function matches(url) {
    if (!url) return false;
    const raw = String(url);
    return normalizedMatchers.some((m) => {
      try {
        if (m instanceof RegExp) return m.test(raw);
        if (typeof m === 'function') return !!m(raw);
        return false;
      } catch {
        return false;
      }
    });
  }

  async function submit(ctx = {}) {
    const applyUrl = ctx.applyUrl || ctx?.app?.applicationUrl || ctx?.app?.jobUrl || '';
    const reason = `${label} auto-submit is not implemented yet. Complete this application manually.`;
    const err = new Error(reason);
    err.needsHuman = true;
    err.unsupportedAts = true;
    err.blockers = [{
      field: {
        label: `${label} manual submission`,
        rawName: 'manual_submission',
      },
      reason: 'unsupported_ats',
    }];
    err.resolutions = [{
      note: manualHint || `Open the employer page and submit manually: ${applyUrl}`,
      action: 'manual_submit',
      at: new Date().toISOString(),
    }];
    err.provider = name;
    throw err;
  }

  return { name, matches, submit };
}

module.exports = { createManualAdapter };