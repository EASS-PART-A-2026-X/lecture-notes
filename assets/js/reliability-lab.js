// Independent-branch arithmetic for teaching; not a production latency model.
(() => {
  'use strict';
  function estimate(fastPercent, branches) {
    if (!Number.isFinite(fastPercent) || fastPercent < 0 || fastPercent > 100 ||
        !Number.isInteger(branches) || branches < 1 || branches > 1000) {
      throw new RangeError('Use 0–100 percent and 1–1000 whole dependencies.');
    }
    const allFast = (fastPercent / 100) ** branches;
    return {allFast, anySlow: 1 - allFast};
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = {estimate};
  if (typeof document === 'undefined') return;
  const lab = document.getElementById('reliability-lab');
  if (!lab) return;
  const form = lab.querySelector('form');
  const inputs = [...form.querySelectorAll('input')];
  const results = lab.querySelector('[data-results]');
  const error = lab.querySelector('[data-error]');
  const percent = value => `${(value * 100).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}%`;
  function render() {
    inputs.forEach(input => input.setAttribute('aria-invalid', String(!input.validity.valid)));
    try {
      if (!form.checkValidity()) throw new RangeError('Invalid input');
      const value = estimate(form.elements.fast.valueAsNumber, form.elements.branches.valueAsNumber);
      lab.querySelector('[data-all-fast]').textContent = percent(value.allFast);
      lab.querySelector('[data-any-slow]').textContent = percent(value.anySlow);
      lab.querySelector('[data-fast-bar]').style.width = `${value.allFast * 100}%`;
      lab.querySelector('[data-slow-bar]').style.width = `${value.anySlow * 100}%`;
      results.hidden = false;
      error.hidden = true;
    } catch (failure) {
      if (!(failure instanceof RangeError)) throw failure;
      results.hidden = true;
      error.hidden = false;
    }
  }
  inputs.forEach(input => input.addEventListener('input', render));
  form.addEventListener('submit', event => {event.preventDefault(); render();});
  form.querySelectorAll('[data-branches]').forEach(button => button.addEventListener('click', () => {
    form.elements.branches.value = button.dataset.branches;
    render();
  }));
  render();
  form.hidden = false;
})();
