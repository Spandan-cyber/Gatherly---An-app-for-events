let gateStream = null;
let gateScanActive = false;
let gateRequestActive = false;
let gateCameraMode = false;
let offlineManifest = null;

function offlineManifestKey() {
    return `gatherly-gate-manifest-${document.body.dataset.gateType || 'EVENT'}-${document.body.dataset.gateId || 'active'}`;
}

function offlineQueueKey() {
    return `gatherly-gate-queue-${document.body.dataset.gateType || 'EVENT'}-${document.body.dataset.gateId || 'active'}`;
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('gateLoginForm').addEventListener('submit', loginGate);
    document.getElementById('gateCameraButton').addEventListener('click', startGateCamera);
    document.getElementById('gateManualForm').addEventListener('submit', submitManualQr);
    document.getElementById('gateSignOut')?.addEventListener('click', logoutGate);
    if (document.body.dataset.gateAuthenticated === 'true') {
        if (document.body.dataset.gateType === 'MOVIE') {
            showGateFeedback('Theatre movie scanner ready. A live connection is required to validate movie tickets.');
        } else {
            try {
                offlineManifest = JSON.parse(sessionStorage.getItem(offlineManifestKey()) || 'null');
            } catch {
                offlineManifest = null;
            }
            refreshGateOfflineManifest();
        }
    }
    window.addEventListener('online', syncOfflineCheckins);
});

function showGateFeedback(message, isError = false) {
    const feedback = document.getElementById('gateScannerFeedback');
    feedback.textContent = message;
    feedback.className = `gate-feedback${isError ? ' error' : ''}`;
}

async function loginGate(event) {
    event.preventDefault();
    const feedback = document.getElementById('gateLoginFeedback');
    feedback.textContent = '';
    const form = event.currentTarget;
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
        const response = await fetch('/api/gate/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                username: document.getElementById('gateUsername').value,
                password: document.getElementById('gatePassword').value
            })
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || 'Could not sign in.');
        document.body.dataset.gateAuthenticated = 'true';
        document.body.dataset.gateType = result.gate_type || 'EVENT';
        document.getElementById('gateLoginPanel').classList.add('hidden');
        document.getElementById('gateScannerPanel').classList.remove('hidden');
        document.getElementById('gateEventTitle').textContent = result.event.title;
        document.body.dataset.gateId = String(result.gate_id);
        document.getElementById('gateEventDetails').replaceChildren(
            document.createTextNode(`${formatGatherlyDate(result.event.event_date)} · ${formatGatherlyTime(result.event.event_time)}`),
            document.createElement('br'),
            document.createTextNode(`${result.event.venue}, ${result.event.city}`)
        );
        const isMovieGate = document.body.dataset.gateType === 'MOVIE';
        document.getElementById('gateScopeLabel').textContent = isMovieGate
            ? 'THEATRE MOVIE SCANNER'
            : 'EVENT-SCOPED SCANNER';
        document.getElementById('gateScopeNote').textContent = isMovieGate
            ? 'This theatre gate validates movie tickets for screenings at this theatre.'
            : 'This account can validate passes for this event only.';
        const header = document.querySelector('.gate-navbar .nav-right');
        if (!document.getElementById('gateSignOut')) {
            const account = document.createElement('span');
            account.className = 'welcome-user';
            account.append('Gate: ', Object.assign(document.createElement('strong'), {textContent: result.gate_name}));
            const logout = document.createElement('button');
            logout.id = 'gateSignOut';
            logout.type = 'button';
            logout.className = 'btn-primary btn-logout';
            logout.textContent = 'SIGN OUT';
            logout.addEventListener('click', logoutGate);
            header.append(account, logout);
        }
        document.getElementById('gatePassword').value = '';
        document.getElementById('gateCameraButton').focus();
        if (isMovieGate) {
            offlineManifest = null;
            showGateFeedback('Theatre movie scanner ready. A live connection is required to validate movie tickets.');
        } else {
            await refreshGateOfflineManifest();
        }
    } catch (error) {
        feedback.textContent = error.message;
    } finally {
        submit.disabled = false;
    }
}

async function startGateCamera() {
    gateCameraMode = true;
    if (!navigator.mediaDevices?.getUserMedia) {
        showGateFeedback('Camera access requires a secure context (HTTPS or localhost) and a supported browser. Use masked manual entry below.', true);
        document.getElementById('gateQrInput').focus();
        return;
    }
    const nativeDetection = 'BarcodeDetector' in window;
    if (!nativeDetection && typeof window.jsQR !== 'function') {
        showGateFeedback('QR scanning could not load. Refresh the page or use masked manual entry below.', true);
        return;
    }
    stopGateCamera();
    clearGateResult();
    showGateFeedback(nativeDetection
        ? 'Starting the camera…'
        : 'Starting the camera with the built-in QR reader…');
    const video = document.getElementById('gateVideo');
    const button = document.getElementById('gateCameraButton');
    button.disabled = true;
    try {
        const detector = nativeDetection ? new BarcodeDetector({formats: ['qr_code']}) : null;
        const canvas = nativeDetection ? null : document.createElement('canvas');
        const context = canvas?.getContext('2d', {willReadFrequently: true});
        gateStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {facingMode: {ideal: 'environment'}}
        });
        video.srcObject = gateStream;
        video.classList.remove('hidden');
        await video.play();
        gateScanActive = true;
        showGateFeedback(nativeDetection
            ? 'Camera ready. Scan one attendee pass at a time.'
            : 'Camera ready. Scan one attendee at a time. QR decoding runs locally in your browser.');
        const scanFrame = async () => {
            if (!gateScanActive || gateRequestActive) return;
            try {
                let qrContent = '';
                if (detector) {
                    const codes = await detector.detect(video);
                    qrContent = codes[0]?.rawValue || '';
                } else if (context && video.videoWidth && video.videoHeight) {
                    const width = Math.min(video.videoWidth, 720);
                    const height = Math.round(video.videoHeight * width / video.videoWidth);
                    canvas.width = width;
                    canvas.height = height;
                    context.drawImage(video, 0, 0, width, height);
                    const frame = context.getImageData(0, 0, width, height);
                    qrContent = window.jsQR(frame.data, frame.width, frame.height, {
                        inversionAttempts: 'attemptBoth'
                    })?.data || '';
                }
                if (qrContent) {
                    gateScanActive = false;
                    stopGateCamera();
                    await processGateQr(qrContent);
                    return;
                }
            } catch (error) {
                gateScanActive = false;
                stopGateCamera();
                showGateFeedback('Could not read the QR. Try again or use masked manual entry.', true);
                console.error('Gate QR detection failed', error);
                return;
            }
            if (gateScanActive) window.setTimeout(scanFrame, 220);
        };
        scanFrame();
    } catch (error) {
        stopGateCamera();
        const message = error.name === 'NotAllowedError'
            ? 'Camera permission was denied. Allow camera access or use masked manual entry.'
            : error.name === 'NotFoundError'
                ? 'No camera was found. Use masked manual entry instead.'
                : error.name === 'NotReadableError'
                    ? 'The camera is busy in another app or tab. Close it and try again.'
                    : error.name === 'SecurityError'
                        ? 'Camera access is blocked. Open this page on HTTPS or localhost.'
                        : 'Camera could not start. Use masked manual entry instead.';
        showGateFeedback(message, true);
    } finally {
        button.disabled = false;
    }
}

function stopGateCamera() {
    gateScanActive = false;
    if (gateStream) {
        gateStream.getTracks().forEach(track => track.stop());
        gateStream = null;
    }
    const video = document.getElementById('gateVideo');
    if (video) {
        video.pause();
        video.srcObject = null;
        video.classList.add('hidden');
    }
}

function submitManualQr(event) {
    event.preventDefault();
    gateCameraMode = false;
    const input = document.getElementById('gateQrInput');
    const content = input.value;
    input.value = '';
    processGateQr(content);
}

async function processGateQr(qrContent) {
    if (!qrContent || gateRequestActive) return;
    gateRequestActive = true;
    clearGateResult();
    showGateFeedback('Verifying pass…');
    try {
        if (!navigator.onLine) {
            if (document.body.dataset.gateType === 'MOVIE') {
                showGateFeedback('Movie gate validation requires a live connection. No entry was recorded.', true);
                return;
            }
            processOfflineGateQr(qrContent);
            return;
        }
        const checkInUrl = document.body.dataset.gateType === 'MOVIE'
            ? '/api/movie-gate/check-in'
            : '/api/gate/check-in';
        const response = await fetch(checkInUrl, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({qr_content: qrContent})
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
            if (response.status === 401) {
                document.getElementById('gateScannerPanel').classList.add('hidden');
                document.getElementById('gateLoginPanel').classList.remove('hidden');
            }
            showGateFeedback(result.message || 'This pass could not be validated.', true);
            return;
        }
        showGateFeedback(result.message);
        renderGateResult(result);
    } catch {
        showGateFeedback('Could not reach the scanner service. Check the connection and try again.', true);
    } finally {
        gateRequestActive = false;
    }
}

async function refreshGateOfflineManifest() {
    if (!navigator.onLine || document.body.dataset.gateAuthenticated !== 'true') return;
    try {
        const response = await fetch('/api/gate/offline-manifest');
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || 'Offline roster unavailable.');
        offlineManifest = result;
        sessionStorage.setItem(offlineManifestKey(), JSON.stringify(result));
        document.body.dataset.gateId = String(result.gate_id || document.body.dataset.gateId);
        showGateFeedback(`Offline roster ready · ${result.tickets.length} valid passes cached for this event.`);
        if (readOfflineQueue().length) await syncOfflineCheckins();
    } catch (error) {
        showGateFeedback(`Offline roster could not refresh: ${error.message}`, true);
    }
}

function processOfflineGateQr(qrContent) {
    if (!offlineManifest || !Array.isArray(offlineManifest.tickets)) {
        showGateFeedback('No offline pass list is available. Connect to the internet before scanning offline.', true);
        return;
    }
    const ticket = offlineManifest.tickets.find(item => item.ticket_code === qrContent);
    if (!ticket || ticket.admitted_count >= ticket.quantity) {
        showGateFeedback('This pass is not available in the cached event list or is fully used.', true);
        return;
    }
    ticket.admitted_count += 1;
    const scans = readOfflineQueue();
    const syncId = crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    scans.push({sync_id: syncId, ticket_code: qrContent, admitted_count: 1});
    sessionStorage.setItem(offlineManifestKey(), JSON.stringify(offlineManifest));
    sessionStorage.setItem(offlineQueueKey(), JSON.stringify(scans));
    const panel = document.getElementById('gateScanResult');
    panel.replaceChildren();
    const heading = document.createElement('h2');
    heading.textContent = 'Offline admission queued';
    const eventName = document.createElement('p');
    eventName.className = 'gate-result-event';
    eventName.textContent = offlineManifest.event.title;
    const admission = document.createElement('p');
    admission.className = 'gate-result-admission';
    admission.textContent = `Person ${ticket.admitted_count} of ${ticket.quantity} · syncs when online`;
    panel.append(heading, eventName, admission);
    panel.classList.remove('hidden');
    showGateFeedback('Offline mode · admission saved on this device and will sync when connected.');
    window.setTimeout(() => {
        if (panel.classList.contains('hidden')) return;
        clearGateResult();
        document.getElementById('gateQrInput').focus();
    }, 1500);
}

function readOfflineQueue() {
    try {
        const queue = JSON.parse(sessionStorage.getItem(offlineQueueKey()) || '[]');
        return Array.isArray(queue) ? queue : [];
    } catch {
        return [];
    }
}

async function syncOfflineCheckins() {
    if (!navigator.onLine || !document.body.dataset.gateId) return;
    const scans = readOfflineQueue();
    if (!scans.length) return;
    try {
        const response = await fetch('/api/gate/offline-sync', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({scans})
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || 'Offline scans could not sync.');
        const completed = new Set(result.outcomes.map(outcome => outcome.sync_id));
        const remaining = scans.filter(scan => !completed.has(scan.sync_id));
        sessionStorage.setItem(offlineQueueKey(), JSON.stringify(remaining));
        const rejected = result.outcomes.filter(outcome => !outcome.success).length;
        if (rejected) {
            showGateFeedback(`${result.admitted} offline admissions synced; ${rejected} rejected because the pass was used elsewhere or is no longer valid.`, true);
        } else {
            showGateFeedback(`${result.admitted} offline admission(s) synced successfully.`);
        }
        if (!remaining.length) await refreshGateOfflineManifest();
    } catch (error) {
        showGateFeedback(`Offline check-ins are saved on this device; sync failed: ${error.message}`, true);
    }
}

function renderGateResult(result) {
    const panel = document.getElementById('gateScanResult');
    const event = result.event;
    const attendee = result.attendee;
    const pass = result.pass;
    const heading = document.createElement('h2');
    heading.textContent = 'Pass verified';
    const eventName = document.createElement('p');
    eventName.className = 'gate-result-event';
    eventName.textContent = event.title;
    const bookingName = document.createElement('p');
    bookingName.className = 'gate-result-attendee';
    bookingName.textContent = attendee.name;
    const admission = document.createElement('p');
    admission.className = 'gate-result-admission';
    admission.textContent = `${pass.admitted} of ${pass.quantity} admitted · ${pass.remaining} remaining`;
    const details = document.createElement('div');
    details.className = 'gate-result-details';
    [
        [`${formatGatherlyDate(event.event_date)} · ${formatGatherlyTime(event.event_time)}`, 'Event time'],
        [`${event.venue}, ${event.city}`, 'Venue'],
        [pass.booking_status, 'Booking'],
        [pass.payment_status, 'Payment']
    ].forEach(([value, label]) => {
        const item = document.createElement('div');
        const caption = document.createElement('span');
        caption.textContent = label;
        const detail = document.createElement('strong');
        detail.textContent = value;
        item.append(caption, detail);
        details.appendChild(item);
    });
    if (result.movie) {
        [
            [result.movie.screen, 'Screen'],
            [result.movie.seats, 'Movie seats']
        ].forEach(([value, label]) => {
            const item = document.createElement('div');
            const caption = document.createElement('span');
            caption.textContent = label;
            const detail = document.createElement('strong');
            detail.textContent = value;
            item.append(caption, detail);
            details.appendChild(item);
        });
    }
    const nextHint = document.createElement('p');
    nextHint.className = 'gate-next-hint';
    nextHint.textContent = 'Ready for the next attendee in a moment…';
    panel.replaceChildren(heading, eventName, bookingName, admission, details, nextHint);
    panel.classList.remove('hidden');
    window.setTimeout(() => {
        if (panel.classList.contains('hidden')) return;
        clearGateResult();
        if (gateCameraMode && document.body.dataset.gateAuthenticated === 'true') {
            startGateCamera();
        } else {
            showGateFeedback('Ready for the next attendee.');
            document.getElementById('gateQrInput').focus();
        }
    }, 1500);
}

function clearGateResult() {
    const result = document.getElementById('gateScanResult');
    result.replaceChildren();
    result.classList.add('hidden');
}

async function logoutGate() {
    const queued = readOfflineQueue();
    if (queued.length && !navigator.onLine) {
        showGateFeedback('Cannot sign out yet: reconnect to sync pending offline admissions first.', true);
        return;
    }
    if (queued.length) {
        await syncOfflineCheckins();
        if (readOfflineQueue().length) {
            showGateFeedback('Cannot sign out while offline admissions remain unsynced.', true);
            return;
        }
    }
    stopGateCamera();
    try {
        await fetch('/api/gate/logout', {method: 'POST'});
    } finally {
        sessionStorage.removeItem(offlineManifestKey());
        sessionStorage.removeItem(offlineQueueKey());
        window.location.assign('/gate');
    }
}
