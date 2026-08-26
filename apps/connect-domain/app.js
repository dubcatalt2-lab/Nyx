(() => {
  const target = document.querySelector('[data-target-ip]');
  const copy = document.querySelector('[data-copy-ip]');
  const form = document.querySelector('[data-domain-form]');
  const linkName = form.elements.linkName;
  const baseDomain = form.elements.baseDomain;
  const customDomainField = document.querySelector('[data-custom-domain]');
  const customDomain = form.elements.customDomain;
  const preview = document.querySelector('[data-hostname-preview]');
  const openFreedns = document.querySelector('[data-open-freedns]');
  const submit = document.querySelector('[data-submit]');
  const status = document.querySelector('[data-status]');
  const dialog = document.querySelector('[data-freedns-dialog]');
  const frame = document.querySelector('[data-freedns-frame]');
  const dialogHost = document.querySelector('[data-freedns-dialog-host]');
  const dialogIp = document.querySelector('[data-dialog-ip]');
  const external = document.querySelector('[data-freedns-external]');
  let targetIp = '';
  let connectionEnabled = false;

  function showStatus(message, type = '') {
    status.hidden = false;
    status.className = `status${type ? ` ${type}` : ''}`;
    status.textContent = message;
  }

  async function readJson(response) {
    const text = await response.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`Nyx returned an unexpected ${response.status} response.`);
    }
  }

  function cleanLabel(value) {
    return String(value || '').trim().toLowerCase();
  }

  function cleanDomain(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '');
  }

  function validLabel(value) {
    return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value);
  }

  function validDomain(value) {
    return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value);
  }

  function chosenDomain() {
    return baseDomain.value === '__custom__' ? cleanDomain(customDomain.value) : cleanDomain(baseDomain.value);
  }

  function chosenHostname() {
    const label = cleanLabel(linkName.value);
    const domain = chosenDomain();
    return validLabel(label) && validDomain(domain) ? `${label}.${domain}` : '';
  }

  function freednsUrl() {
    const option = baseDomain.selectedOptions[0];
    const domainId = String(option?.dataset?.domainId || '');
    return /^\d+$/.test(domainId)
      ? `https://freedns.afraid.org/subdomain/edit.php?edit_domain_id=${domainId}`
      : 'https://freedns.afraid.org/subdomain/';
  }

  function updatePreview() {
    const hostname = chosenHostname();
    const custom = baseDomain.value === '__custom__';
    customDomainField.hidden = !custom;
    customDomain.required = custom;
    preview.textContent = hostname || 'Choose a valid name and domain';
    preview.classList.toggle('ready', Boolean(hostname));
    openFreedns.disabled = !connectionEnabled || !hostname;
    submit.disabled = !connectionEnabled || !hostname;
  }

  async function copyIp(button = copy) {
    if (!targetIp) return;
    try {
      await navigator.clipboard.writeText(targetIp);
      const original = button.textContent;
      button.textContent = 'Copied';
      setTimeout(() => { button.textContent = original; }, 1400);
    } catch {
      showStatus(`Copy this address: ${targetIp}`);
    }
  }

  async function loadConfig() {
    try {
      const response = await fetch('/api/custom-hostnames/config', { credentials: 'same-origin', cache: 'no-store' });
      const data = await readJson(response);
      targetIp = String(data.targetIps?.[0] || '');
      connectionEnabled = Boolean(data.enabled && targetIp);
      target.textContent = targetIp || 'Not configured';
      dialogIp.textContent = targetIp || 'Not configured';
      copy.disabled = !targetIp;
      if (!connectionEnabled) showStatus('Custom-domain connection is not enabled on this Nyx server yet.', 'error');
      updatePreview();
    } catch (error) {
      target.textContent = 'Unavailable';
      dialogIp.textContent = 'Unavailable';
      copy.disabled = true;
      connectionEnabled = false;
      updatePreview();
      showStatus(error.message || 'Nyx could not load the domain configuration.', 'error');
    }
  }

  async function loadRegistry() {
    const prompt = document.createElement('option');
    prompt.value = '';
    prompt.textContent = 'Choose a public FreeDNS domain';
    try {
      const response = await fetch('/api/link-checker/freedns-registry?page=1', { credentials: 'same-origin', cache: 'no-store' });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || `FreeDNS registry request failed (${response.status}).`);
      const domains = (Array.isArray(data.domains) ? data.domains : [])
        .filter(item => item?.status === 'public' && validDomain(cleanDomain(item.domain)))
        .sort((left, right) => Number(right.hosts || 0) - Number(left.hosts || 0));
      baseDomain.replaceChildren(prompt);
      for (const item of domains) {
        const option = document.createElement('option');
        option.value = cleanDomain(item.domain);
        option.textContent = `${item.domain} (${Number(item.hosts || 0).toLocaleString()} hosts)`;
        option.dataset.domainId = String(item.id || '');
        baseDomain.append(option);
      }
    } catch (error) {
      prompt.textContent = 'Registry unavailable - enter a domain';
      baseDomain.replaceChildren(prompt);
      showStatus(error.message || 'Nyx could not load the FreeDNS registry.', 'error');
    }
    const custom = document.createElement('option');
    custom.value = '__custom__';
    custom.textContent = 'Enter another FreeDNS domain...';
    baseDomain.append(custom);
    baseDomain.disabled = false;
    updatePreview();
  }

  function openFreednsDialog() {
    const hostname = chosenHostname();
    if (!hostname || !connectionEnabled) return;
    const url = freednsUrl();
    dialogHost.textContent = hostname;
    external.href = url;
    frame.src = url;
    dialog.showModal();
  }

  function closeFreednsDialog() {
    dialog.close();
    frame.src = 'about:blank';
  }

  async function verifyHostname() {
    const hostname = chosenHostname();
    if (!hostname || !connectionEnabled) return;
    submit.disabled = true;
    const originalLabel = submit.textContent;
    submit.textContent = 'Verifying...';
    status.hidden = true;
    try {
      const response = await fetch('/api/custom-hostnames', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostname })
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || `Domain verification failed (${response.status}).`);
      status.hidden = false;
      status.className = 'status success';
      status.replaceChildren(document.createTextNode(`${data.message} `));
      const link = document.createElement('a');
      link.href = data.url;
      link.textContent = `Open ${data.hostname}`;
      status.append(link);
    } catch (error) {
      showStatus(error.message || 'Nyx could not connect that domain.', 'error');
    } finally {
      submit.disabled = false;
      submit.textContent = originalLabel;
      updatePreview();
    }
  }

  copy.addEventListener('click', () => void copyIp());
  document.querySelector('[data-dialog-copy]').addEventListener('click', event => void copyIp(event.currentTarget));
  linkName.addEventListener('input', updatePreview);
  baseDomain.addEventListener('change', updatePreview);
  customDomain.addEventListener('input', updatePreview);
  openFreedns.addEventListener('click', openFreednsDialog);
  document.querySelector('[data-dialog-close]').addEventListener('click', closeFreednsDialog);
  document.querySelector('[data-created-verify]').addEventListener('click', () => {
    closeFreednsDialog();
    void verifyHostname();
  });
  dialog.addEventListener('click', event => {
    if (event.target === dialog) closeFreednsDialog();
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    void verifyHostname();
  });

  void Promise.all([loadConfig(), loadRegistry()]);
})();
