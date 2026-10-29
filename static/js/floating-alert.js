(() => {
    const originalAlert = window.alert.bind(window);
    let activeDialog = null;
    const pendingMessages = [];

    function closeDialog() {
        if (!activeDialog) return;
        activeDialog.remove();
        activeDialog = null;
        if (pendingMessages.length) showMessage(pendingMessages.shift());
    }

    function showMessage(message) {
        if (activeDialog) {
            pendingMessages.push(message);
            return;
        }

        const overlay = document.createElement('div');
        overlay.className = 'floating-alert-overlay';
        const dialog = document.createElement('section');
        dialog.className = 'floating-alert-dialog';
        dialog.setAttribute('role', 'alertdialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'floatingAlertTitle');
        dialog.setAttribute('aria-describedby', 'floatingAlertMessage');

        const close = document.createElement('button');
        close.className = 'floating-alert-close';
        close.type = 'button';
        close.setAttribute('aria-label', 'Close message');
        close.textContent = '×';

        const title = document.createElement('h2');
        title.id = 'floatingAlertTitle';
        title.textContent = 'Gatherly notice';

        const text = document.createElement('p');
        text.id = 'floatingAlertMessage';
        text.textContent = message;

        const okay = document.createElement('button');
        okay.className = 'btn-primary floating-alert-okay';
        okay.type = 'button';
        okay.textContent = 'OK';

        dialog.append(close, title, text, okay);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        activeDialog = overlay;
        close.addEventListener('click', closeDialog);
        okay.addEventListener('click', closeDialog);
        overlay.addEventListener('click', event => {
            if (event.target === overlay) closeDialog();
        });
        dialog.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                event.stopPropagation();
                closeDialog();
            }
        });
        okay.focus();
    }

    window.alert = message => {
        if (!document.body) {
            originalAlert(message);
            return;
        }
        showMessage(String(message ?? ''));
    };
})();
