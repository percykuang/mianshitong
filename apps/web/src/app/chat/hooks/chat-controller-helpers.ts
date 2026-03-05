export function closeSidebarOnMobile(setSidebarOpen: (open: boolean) => void): void {
  if (window.innerWidth < 768) {
    setSidebarOpen(false);
  }
}

export async function copyToClipboard(content: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(content);
    return;
  }

  const helperTextarea = document.createElement('textarea');
  helperTextarea.value = content;
  helperTextarea.setAttribute('readonly', '');
  helperTextarea.style.position = 'fixed';
  helperTextarea.style.opacity = '0';
  document.body.append(helperTextarea);
  helperTextarea.select();

  const copied = document.execCommand('copy');
  document.body.removeChild(helperTextarea);
  if (!copied) {
    throw new Error('copy failed');
  }
}
