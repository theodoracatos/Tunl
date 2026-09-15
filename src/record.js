// TUNL. Copyright (c) 2026 Theodoracatos. All rights reserved. https://flytunl.ch
// ── Run recording (web only) ─────────────────────────────────────────
// A "record this run" button for flytunl.ch/play. Before this the only way to
// capture a run with sound for a promo clip was the iOS Simulator's screen
// recorder plus a separate audio capture pass stitched together by hand -
// cumbersome enough that it discouraged making clips at all.
//
// Gameplay itself renders at a fixed W/H = 956x440 (see constants.js's W/H caps
// and CLAUDE.md's "Screen-independent feel" / "Cross-device fairness" sections) -
// the iPhone 17 Pro Max's own landscape footprint - but the CANVAS ELEMENT's own
// backing store is NOT that: constants.js additionally multiplies it by
// _RASTER_SCALE (devicePixelRatio times a desktop-only up-to-1.4x zoom, see its
// doc comment), so cv.width/height varies with the recording machine's window
// size and screen density even though gameplay is always geometrically the same
// 956x440. Recording straight off cv would make every clip a different
// resolution depending who recorded it and how their browser window was sized.
// _recCanvas below is a dedicated offscreen canvas at a fixed
// REC_OUT_SCALE x 956x440 - every recording exports at the exact same pixel
// size (1912x880, a clean 2x of the reference footprint) regardless of DPR or
// window size. _recCopyFrame blits the live game canvas onto it once per
// animation frame while recording is active; that offscreen canvas, not cv, is
// what captureStream() reads from.
//
// audioRecordStream() (audio.js) taps the shared _master gain bus that every
// sfx/bgm node already connects to instead of _ac.destination directly -
// specifically so this file can capture the real game mix in parallel with the
// speakers, rather than re-synthesizing a guess at it. Both tracks go into one
// MediaStream and out through MediaRecorder.
//
// Gated on isWeb() throughout: the app builds have no DOM to host the button/
// panel in, and the Simulator capture workflow this replaces has nothing to do
// with what ships inside the app itself.

const REC_FPS = 30;
const REC_VIDEO_BPS = 8000000;
const REC_OUT_SCALE = 2;   // 1912x880 export - a crisp 2x of the 956x440 reference footprint

let _recRecorder = null, _recChunks = [], _recActive = false, _recStream = null;
let _recCanvas = null, _recCtx = null, _recCopyRAF = null;
let _recBtn = null, _recPanel = null, _recVideo = null, _recDownload = null;
let _recShareBtn = null, _recCloseBtn = null;
let _recBtnLbl = null, _recDownloadLbl = null, _recShareLbl = null;
let _recBtnShown = false, _recLangShown = null;
let _recBlob = null, _recUrl = null, _recFileType = 'video/webm';

function _recEnsureCanvas() {
    if (_recCanvas) return _recCanvas;
    _recCanvas = document.createElement('canvas');
    _recCanvas.width = W * REC_OUT_SCALE;
    _recCanvas.height = H * REC_OUT_SCALE;
    _recCtx = _recCanvas.getContext('2d');
    return _recCanvas;
}

function _recCopyFrame() {
    if (!_recActive) return;
    _recCtx.drawImage(cv, 0, 0, cv.width, cv.height, 0, 0, _recCanvas.width, _recCanvas.height);
    _recCopyRAF = requestAnimationFrame(_recCopyFrame);
}

function _recMimeType() {
    if (typeof MediaRecorder === 'undefined') return null;
    // Safari records mp4 (H.264+AAC) directly when asked; Chrome/Firefox only ever
    // offer webm. Try the most widely-shareable option first and fall back through
    // whatever a given browser actually supports, rather than assuming one.
    const candidates = [
        'video/mp4;codecs=avc1,mp4a.40.2',
        'video/mp4',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
    ];
    for (const t of candidates) {
        if (MediaRecorder.isTypeSupported(t)) return t;
    }
    return '';
}

function _recSupported() {
    return typeof isWeb === 'function' && isWeb()
        && typeof cv !== 'undefined' && typeof cv.captureStream === 'function'
        && typeof MediaRecorder !== 'undefined';
}

function startRecording() {
    if (_recActive || !_recSupported()) return;
    // Recording needs the AudioContext already running to tap it -- _initAC() is a
    // no-op once it exists (every thrust tap already calls it, see input.js), so this
    // just guarantees the tap below has a live _master to connect to.
    if (typeof _initAC === 'function') _initAC();

    _recEnsureCanvas();
    _recCtx.drawImage(cv, 0, 0, cv.width, cv.height, 0, 0, _recCanvas.width, _recCanvas.height);
    const videoStream = _recCanvas.captureStream(REC_FPS);
    const audioStream = typeof audioRecordStream === 'function' ? audioRecordStream() : null;
    const tracks = videoStream.getVideoTracks().slice();
    if (audioStream) tracks.push(...audioStream.getAudioTracks());
    _recStream = new MediaStream(tracks);

    const mime = _recMimeType();
    try {
        _recRecorder = mime
            ? new MediaRecorder(_recStream, { mimeType: mime, videoBitsPerSecond: REC_VIDEO_BPS })
            : new MediaRecorder(_recStream);
    } catch (e) {
        _recRecorder = null;
        _recStream.getTracks().forEach(t => { try { t.stop(); } catch (e2) {} });
        _recStream = null;
        return;
    }
    _recChunks = [];
    _recRecorder.ondataavailable = e => { if (e.data && e.data.size) _recChunks.push(e.data); };
    _recRecorder.onstop = _recFinish;
    _recRecorder.start();
    _recActive = true;
    _recCopyRAF = requestAnimationFrame(_recCopyFrame);
    _recSyncBtn();
}

function stopRecording() {
    if (!_recActive || !_recRecorder) return;
    _recActive = false;
    if (_recCopyRAF) { cancelAnimationFrame(_recCopyRAF); _recCopyRAF = null; }
    try { _recRecorder.stop(); } catch (e) {}
    _recSyncBtn();
}

function toggleRecording() {
    if (_recActive) stopRecording(); else startRecording();
}

// audio.js's _reviveAudioContext calls this before tearing the AudioContext down
// (backgrounding, WebKit's auto-suspend). There's no such thing as reconnecting a
// running MediaRecorder to a fresh context's output mid-recording, so finalize
// whatever was captured rather than let the file go silent from here on.
function _recOnAudioContextLost() {
    if (_recActive) stopRecording();
}

function _recFinish() {
    if (typeof audioRecordStop === 'function') audioRecordStop();
    if (_recStream) { _recStream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} }); _recStream = null; }
    const type = (_recRecorder && _recRecorder.mimeType) || 'video/webm';
    _recRecorder = null;
    if (!_recChunks.length) return;
    const blob = new Blob(_recChunks, { type });
    _recChunks = [];
    _recShowPanel(blob, type);
}

// ── Panel ─────────────────────────────────────────────────────────────

function _recShowPanel(blob, type) {
    if (_recUrl) URL.revokeObjectURL(_recUrl);
    _recBlob = blob;
    _recFileType = type;
    _recUrl = URL.createObjectURL(blob);
    if (_recVideo) _recVideo.src = _recUrl;
    if (_recDownload) {
        _recDownload.href = _recUrl;
        _recDownload.download = 'tunl-run.' + (type.indexOf('mp4') >= 0 ? 'mp4' : 'webm');
    }
    if (_recShareBtn) {
        _recShareBtn.hidden = !(navigator.share && navigator.canShare
            && navigator.canShare({ files: [new File([], 'x.' + (type.indexOf('mp4') >= 0 ? 'mp4' : 'webm'), { type })] }));
    }
    if (_recPanel) { _recPanel.classList.add('show'); _recPanel.setAttribute('aria-hidden', 'false'); }
}

function _recHidePanel() {
    if (_recPanel) { _recPanel.classList.remove('show'); _recPanel.setAttribute('aria-hidden', 'true'); }
    if (_recVideo) { _recVideo.pause(); _recVideo.removeAttribute('src'); _recVideo.load(); }
    if (_recUrl) { URL.revokeObjectURL(_recUrl); _recUrl = null; }
    _recBlob = null;
}

function _recShare() {
    if (!_recBlob || !navigator.share) return;
    const ext = _recFileType.indexOf('mp4') >= 0 ? 'mp4' : 'webm';
    const file = new File([_recBlob], 'tunl-run.' + ext, { type: _recFileType });
    if (navigator.canShare && !navigator.canShare({ files: [file] })) return;
    const text = typeof shareRunText === 'function' ? shareRunText() : 'TUNL';
    navigator.share({ files: [file], text }).catch(() => {});
}

// ── DOM wiring ───────────────────────────────────────────────────────

function _recInitDom() {
    if (_recBtn) return; // already wired
    if (typeof isWeb !== 'function' || !isWeb()) return;
    _recBtn = document.getElementById('rec-btn');
    _recPanel = document.getElementById('rec-panel');
    _recVideo = document.getElementById('rec-video');
    _recDownload = document.getElementById('rec-download');
    _recShareBtn = document.getElementById('rec-share');
    _recCloseBtn = document.getElementById('rec-close');
    _recBtnLbl = document.getElementById('rec-btn-lbl');
    _recDownloadLbl = document.getElementById('rec-download-lbl');
    _recShareLbl = document.getElementById('rec-share-lbl');
    if (!_recBtn || !_recSupported()) return; // no capture support - stay hidden
    _recBtn.addEventListener('click', toggleRecording);
    if (_recCloseBtn) _recCloseBtn.addEventListener('click', _recHidePanel);
    if (_recShareBtn) _recShareBtn.addEventListener('click', _recShare);
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _recInitDom);
} else {
    _recInitDom();
}

function _recSyncBtn() {
    if (!_recBtn) return;
    _recBtn.classList.toggle('active', _recActive);
    _recBtn.setAttribute('aria-pressed', _recActive ? 'true' : 'false');
}

// Called from main.js's loop, same pattern as _syncWebCta: hides the button behind
// a full-screen menu panel (it would otherwise float on top of the Missions/Shop/
// Settings/Ship-picker/currency-info overlays) and keeps its label current when the
// player switches language mid-session.
function _recTick() {
    if (!_recBtn) return;
    const panelOpen = showShop || showShipPicker || showSettings || showMissions || showCurrencyInfo;
    const show = !panelOpen;
    if (show !== _recBtnShown) {
        _recBtnShown = show;
        _recBtn.classList.toggle('show', show);
        _recBtn.setAttribute('aria-hidden', show ? 'false' : 'true');
    }
    if (typeof T !== 'undefined' && T.rec && _recLangShown !== T.rec) {
        _recLangShown = T.rec;
        if (_recBtnLbl) _recBtnLbl.textContent = T.rec;
        if (_recDownloadLbl) _recDownloadLbl.textContent = T.download;
        if (_recShareLbl) _recShareLbl.textContent = T.share;
    }
}
