/**
 * ================================================================
 * ACCESSIBILITY MVP
 * ================================================================
 *
 * CURSOR CONTROLADO PELA CABEÇA
 *
 * - MediaPipe Face Landmarker
 * - Calibração individual
 * - Centro / esquerda / direita / cima / baixo
 * - Zona morta
 * - Suavização
 * - Velocidade proporcional ao movimento
 * - Dwell click
 * - Clique por aceno da cabeça
 * - Cursor virtual
 *
 * Requer:
 * - HTTPS ou localhost
 * - Chrome/Edge moderno
 * - câmera frontal
 * ================================================================
 */

class AccessibilityMVP {

    constructor(options = {}) {

        this.options = {

            // Cursor
            cursorSize: 34,
            maxSpeed: 15,
            sensitivity: 1.0,

            // Movimento
            deadZone: 0.08,
            smoothing: 0.22,

            // Dwell
            dwellEnabled: true,
            dwellTime: 1400,

            // Aceno
            nodEnabled: true,
            nodThreshold: 0.07,
            clickCooldown: 700,

            // Interface
            showPanel: true,
            showCameraPreview: true,

            ...options
        };


        // ==========================================================
        // CÂMERA
        // ==========================================================

        this.cameraEnabled = false;

        this.stream = null;

        this.video = null;

        this.videoAnimationFrame = null;

        this.cursorAnimationFrame = null;


        // ==========================================================
        // MEDIAPIPE
        // ==========================================================

        this.faceLandmarker = null;

        this.lastVideoTime = -1;


        // ==========================================================
        // POSE DA CABEÇA
        // ==========================================================

        this.currentYaw = 0;

        this.currentPitch = 0;

        this.filteredYaw = 0;

        this.filteredPitch = 0;


        // ==========================================================
        // CALIBRAÇÃO
        // ==========================================================

        this.isCalibrated = false;

        this.calibrationRunning = false;

        this.calibrationStep = 0;

        this.calibrationSamples = [];

        this.calibration = {

            centerYaw: 0,
            centerPitch: 0,

            leftYaw: 0,
            rightYaw: 0,

            upPitch: 0,
            downPitch: 0
        };


        /*
         * Quantidade de frames utilizados
         * para cada ponto da calibração.
         */

        this.calibrationSampleCount = 45;


        // ==========================================================
        // CURSOR
        // ==========================================================

        this.cursorX =
            window.innerWidth / 2;

        this.cursorY =
            window.innerHeight / 2;

        this.targetCursorX =
            this.cursorX;

        this.targetCursorY =
            this.cursorY;

        this.cursorVelocityX = 0;

        this.cursorVelocityY = 0;


        // ==========================================================
        // DWELL
        // ==========================================================

        this.dwellTarget = null;

        this.dwellStartedAt = 0;

        this.dwellTimer = null;


        // ==========================================================
        // CLIQUE
        // ==========================================================

        this.lastClickTime = 0;


        // ==========================================================
        // NOD
        // ==========================================================

        this.nodState = "neutral";

        this.nodStartedAt = 0;


        // ==========================================================
        // UI
        // ==========================================================

        this.panel = null;

        this.statusElement = null;

        this.cursorElement = null;

        this.dwellElement = null;

        this.cameraContainer = null;

        this.calibrationOverlay = null;

        this.debugElement = null;


        // ==========================================================
        // INIT
        // ==========================================================

        this.init();
    }


    // ==============================================================
    // INIT
    // ==============================================================

    init() {

        this.injectStyles();

        this.createUI();

        this.createCursor();

        this.setupKeyboard();

        this.setupResize();

        this.refreshInteractiveElements();

        this.observeDOM();
    }


    // ==============================================================
    // CSS
    // ==============================================================

    injectStyles() {

        if (
            document.getElementById(
                "a11y-head-styles"
            )
        ) {

            return;
        }


        const style =
            document.createElement("style");


        style.id =
            "a11y-head-styles";


        style.textContent = `

            /* =====================================================
               PAINEL
               ===================================================== */

            #a11y-head-panel {

                position: fixed;

                right: 20px;

                bottom: 20px;

                width: 330px;

                padding: 18px;

                background: #111827;

                color: white;

                border-radius: 16px;

                box-shadow:
                    0 15px 50px
                    rgba(0,0,0,.45);

                z-index: 2147483647;

                font-family:
                    system-ui,
                    -apple-system,
                    BlinkMacSystemFont,
                    "Segoe UI",
                    sans-serif;

                font-size: 14px;

                box-sizing: border-box;
            }


            #a11y-head-panel h3 {

                margin:
                    0 0 12px;

                font-size: 18px;

            }


            #a11y-head-status {

                padding: 10px;

                margin-bottom: 10px;

                background: #1f2937;

                border-radius: 9px;

                line-height: 1.5;

            }


            .a11y-head-button {

                width: 100%;

                min-height: 42px;

                padding: 10px;

                margin-top: 8px;

                border: none;

                border-radius: 10px;

                background: #2563eb;

                color: white;

                cursor: pointer;

                font-size: 14px;

                font-weight: 600;

            }


            .a11y-head-button:hover {

                background: #1d4ed8;

            }


            .a11y-head-button.secondary {

                background: #374151;

            }


            .a11y-head-button:disabled {

                opacity: .45;

                cursor: not-allowed;

            }


            /* =====================================================
               CURSOR
               ===================================================== */

            #a11y-head-cursor {

                position: fixed;

                left: 0;

                top: 0;

                width: 34px;

                height: 34px;

                border-radius: 50%;

                background:
                    rgba(0, 229, 255, .96);

                border:
                    4px solid white;

                box-shadow:
                    0 0 0 3px
                    rgba(0,229,255,.35),

                    0 0 22px
                    rgba(0,229,255,.9);

                pointer-events: none;

                z-index: 2147483646;

                transform:
                    translate(-50%, -50%);

                box-sizing: border-box;

                transition:
                    width .1s ease,
                    height .1s ease,
                    background .1s ease;

            }


            #a11y-head-cursor.clickable {

                width: 44px;

                height: 44px;

                background:
                    rgba(34,197,94,.96);

                box-shadow:
                    0 0 0 4px
                    rgba(34,197,94,.25),

                    0 0 25px
                    rgba(34,197,94,.9);

            }


            #a11y-head-cursor.clicking {

                width: 52px;

                height: 52px;

                background:
                    rgba(250,204,21,.98);

            }


            /* =====================================================
               DWELL
               ===================================================== */

            #a11y-head-dwell {

                position: fixed;

                width: 62px;

                height: 62px;

                border-radius: 50%;

                border:
                    4px solid
                    rgba(255,255,255,.85);

                pointer-events: none;

                z-index: 2147483645;

                transform:
                    translate(-50%, -50%);

                display: none;

                box-sizing: border-box;

            }


            #a11y-head-dwell-progress {

                position: absolute;

                inset: -4px;

                border-radius: 50%;

                border:
                    4px solid transparent;

                border-top-color:
                    #22c55e;

                transform:
                    rotate(-90deg);

            }


            /* =====================================================
               CAMERA
               ===================================================== */

            #a11y-head-camera {

                position: fixed;

                left: 20px;

                bottom: 20px;

                width: 220px;

                aspect-ratio: 16 / 9;

                background: black;

                border-radius: 14px;

                overflow: hidden;

                z-index: 2147483644;

                box-shadow:
                    0 10px 35px
                    rgba(0,0,0,.4);

                display: none;

            }


            #a11y-head-camera video {

                width: 100%;

                height: 100%;

                object-fit: cover;

                transform:
                    scaleX(-1);

            }


            #a11y-head-camera-label {

                position: absolute;

                top: 8px;

                left: 8px;

                padding: 4px 8px;

                background:
                    rgba(0,0,0,.7);

                color: white;

                border-radius: 6px;

                font-size: 11px;

            }


            /* =====================================================
               CALIBRAÇÃO
               ===================================================== */

            #a11y-head-calibration {

                position: fixed;

                inset: 0;

                z-index: 2147483647;

                background:
                    rgba(0,0,0,.94);

                color: white;

                display: none;

                align-items: center;

                justify-content: center;

                flex-direction: column;

                text-align: center;

                font-family:
                    system-ui,
                    sans-serif;

                padding: 20px;

                box-sizing: border-box;

            }


            #a11y-head-calibration h2 {

                margin:
                    0 0 14px;

                font-size: 30px;

            }


            #a11y-calibration-dot {

                width: 42px;

                height: 42px;

                border-radius: 50%;

                background: #00e5ff;

                box-shadow:
                    0 0 30px
                    rgba(0,229,255,.9);

                position: fixed;

                transform:
                    translate(-50%, -50%);

                transition:
                    left .3s ease,
                    top .3s ease;

            }


            #a11y-calibration-progress {

                width: 320px;

                max-width: 80vw;

                height: 8px;

                margin-top: 25px;

                background: #374151;

                border-radius: 20px;

                overflow: hidden;

            }


            #a11y-head-calibration-bar {

                width: 0%;

                height: 100%;

                background: #00e5ff;

            }


            #a11y-calibration-message {

                max-width: 600px;

                line-height: 1.6;

                font-size: 17px;

            }


            /* =====================================================
               DEBUG
               ===================================================== */

            #a11y-head-debug {

                position: fixed;

                top: 10px;

                left: 10px;

                padding: 8px 10px;

                border-radius: 8px;

                background:
                    rgba(0,0,0,.7);

                color: white;

                font-family:
                    monospace;

                font-size: 11px;

                z-index: 2147483640;

                pointer-events: none;

                display: none;

            }


            @media (max-width: 600px) {

                #a11y-head-panel {

                    left: 10px;

                    right: 10px;

                    bottom: 10px;

                    width: auto;

                }


                #a11y-head-camera {

                    left: 10px;

                    top: 10px;

                    bottom: auto;

                    width: 150px;

                }

            }

        `;


        document.head.appendChild(style);
    }


    // ==============================================================
    // UI
    // ==============================================================

    createUI() {

        if (this.options.showPanel) {

            this.panel =
                document.createElement("div");


            this.panel.id =
                "a11y-head-panel";


            this.panel.innerHTML = `

                <h3>
                    🧠 Cursor por movimento da cabeça
                </h3>

                <div id="a11y-head-status">
                    Câmera desativada
                </div>

                <button
                    id="a11y-head-start"
                    class="a11y-head-button"
                >
                    Ativar câmera
                </button>

                <button
                    id="a11y-head-calibrate"
                    class="a11y-head-button secondary"
                    disabled
                >
                    Calibrar cabeça
                </button>

                <button
                    id="a11y-head-dwell"
                    class="a11y-head-button secondary"
                >
                    Dwell: ON
                </button>

                <button
                    id="a11y-head-camera-toggle"
                    class="a11y-head-button secondary"
                >
                    Câmera: ON
                </button>

                <div
                    style="
                        margin-top:12px;
                        font-size:12px;
                        opacity:.78;
                        line-height:1.55;
                    "
                >

                    <strong>Como usar:</strong><br>

                    Mova a cabeça para controlar
                    o cursor.<br><br>

                    🎯 Faça a calibração antes
                    de começar.<br>

                    👇 Acene para baixo e volte
                    para clicar.<br>

                    ⏱️ Ou permaneça sobre um
                    botão para usar o Dwell.

                </div>
            `;


            document.body.appendChild(
                this.panel
            );


            this.statusElement =
                this.panel.querySelector(
                    "#a11y-head-status"
                );


            this.panel
                .querySelector(
                    "#a11y-head-start"
                )
                .addEventListener(
                    "click",
                    () =>
                        this.toggleCamera()
                );


            this.panel
                .querySelector(
                    "#a11y-head-calibrate"
                )
                .addEventListener(
                    "click",
                    () =>
                        this.startCalibration()
                );


            this.panel
                .querySelector(
                    "#a11y-head-dwell"
                )
                .addEventListener(
                    "click",
                    event => {

                        this.options.dwellEnabled =
                            !this.options.dwellEnabled;

                        event.currentTarget
                            .textContent =
                            this.options.dwellEnabled
                                ? "Dwell: ON"
                                : "Dwell: OFF";

                        this.resetDwell();
                    }
                );


            this.panel
                .querySelector(
                    "#a11y-head-camera-toggle"
                )
                .addEventListener(
                    "click",
                    event => {

                        this.options.showCameraPreview =
                            !this.options.showCameraPreview;

                        this.updateCameraVisibility();

                        event.currentTarget
                            .textContent =
                            this.options.showCameraPreview
                                ? "Câmera: ON"
                                : "Câmera: OFF";
                    }
                );
        }


        // ==========================================================
        // DWELL
        // ==========================================================

        this.dwellElement =
            document.createElement("div");

        this.dwellElement.id =
            "a11y-head-dwell";

        this.dwellElement.innerHTML = `

            <div
                id="a11y-head-dwell-progress"
            ></div>

        `;

        document.body.appendChild(
            this.dwellElement
        );


        // ==========================================================
        // CAMERA
        // ==========================================================

        this.cameraContainer =
            document.createElement("div");

        this.cameraContainer.id =
            "a11y-head-camera";

        this.cameraContainer.innerHTML = `

            <video
                id="a11y-head-video"
                autoplay
                muted
                playsinline
            ></video>

            <div id="a11y-head-camera-label">
                Detecção da cabeça
            </div>

        `;

        document.body.appendChild(
            this.cameraContainer
        );


        this.video =
            this.cameraContainer.querySelector(
                "#a11y-head-video"
            );


        // ==========================================================
        // CALIBRAÇÃO
        // ==========================================================

        this.calibrationOverlay =
            document.createElement("div");

        this.calibrationOverlay.id =
            "a11y-head-calibration";

        this.calibrationOverlay.innerHTML = `

            <div
                id="a11y-calibration-dot"
            ></div>

            <h2>
                Calibração
            </h2>

            <div
                id="a11y-calibration-message"
            >
                Prepare-se...
            </div>

            <div
                id="a11y-calibration-progress"
            >
                <div
                    id="a11y-head-calibration-bar"
                ></div>
            </div>

        `;

        document.body.appendChild(
            this.calibrationOverlay
        );


        // ==========================================================
        // DEBUG
        // ==========================================================

        this.debugElement =
            document.createElement("div");

        this.debugElement.id =
            "a11y-head-debug";

        document.body.appendChild(
            this.debugElement
        );
    }


    // ==============================================================
    // CURSOR
    // ==============================================================

    createCursor() {

        this.cursorElement =
            document.createElement("div");

        this.cursorElement.id =
            "a11y-head-cursor";

        document.body.appendChild(
            this.cursorElement
        );

        this.updateCursorPosition();
    }


    // ==============================================================
    // CAMERA
    // ==============================================================

    async toggleCamera() {

        if (this.cameraEnabled) {

            this.stopCamera();

        } else {

            await this.startCamera();
        }
    }


    // ==============================================================
    // START CAMERA
    // ==============================================================

    async startCamera() {

        try {

            if (
                !window.isSecureContext &&
                location.hostname !== "localhost"
            ) {

                throw new Error(
                    "A câmera exige HTTPS ou localhost."
                );
            }


            if (
                !navigator.mediaDevices ||
                !navigator.mediaDevices.getUserMedia
            ) {

                throw new Error(
                    "Este navegador não suporta acesso à câmera."
                );
            }


            this.updateStatus(
                "Solicitando acesso à câmera..."
            );


            this.stream =
                await navigator.mediaDevices
                    .getUserMedia({

                        video: {

                            facingMode: {
                                ideal: "user"
                            },

                            width: {
                                ideal: 640
                            },

                            height: {
                                ideal: 480
                            },

                            frameRate: {
                                ideal: 30
                            }
                        },

                        audio: false
                    });


            this.video.srcObject =
                this.stream;


            await this.video.play();


            this.updateStatus(
                "Carregando detector facial..."
            );


            // ======================================================
            // MEDIAPIPE
            // ======================================================

            const vision =
                await import(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304"
                );


            const FilesetResolver =
                vision.FilesetResolver;


            const FaceLandmarker =
                vision.FaceLandmarker;


            const resolver =
                await FilesetResolver.forVisionTasks(

                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm"

                );


            this.faceLandmarker =
                await FaceLandmarker.createFromOptions(
                    resolver,
                    {

                        baseOptions: {

                            modelAssetPath:
                                "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",

                            delegate:
                                "GPU"
                        },

                        runningMode:
                            "VIDEO",

                        numFaces:
                            1,

                        minFaceDetectionConfidence:
                            0.5,

                        minFacePresenceConfidence:
                            0.5,

                        minTrackingConfidence:
                            0.5,

                        outputFaceBlendshapes:
                            false,

                        outputFacialTransformationMatrixes:
                            true
                    }
                );


            this.cameraEnabled =
                true;


            this.updateCameraVisibility();


            const startButton =
                this.panel?.querySelector(
                    "#a11y-head-start"
                );


            const calibrateButton =
                this.panel?.querySelector(
                    "#a11y-head-calibrate"
                );


            if (startButton) {

                startButton.textContent =
                    "Desativar câmera";
            }


            if (calibrateButton) {

                calibrateButton.disabled =
                    false;
            }


            this.updateStatus(
                "Câmera ativa."
            );


            // ======================================================
            // INICIA DETECÇÃO
            // ======================================================

            this.processVideo();


            // ======================================================
            // INICIA CURSOR
            // ======================================================

            this.startCursorLoop();


            // ======================================================
            // CALIBRAÇÃO AUTOMÁTICA
            // ======================================================

            await this.startCalibration();

        } catch (error) {

            console.error(
                "Erro ao iniciar câmera:",
                error
            );


            this.updateStatus(
                this.getErrorMessage(error)
            );


            this.stopCamera();
        }
    }


    // ==============================================================
    // STOP CAMERA
    // ==============================================================

    stopCamera() {

        this.cameraEnabled =
            false;


        if (this.videoAnimationFrame) {

            cancelAnimationFrame(
                this.videoAnimationFrame
            );

            this.videoAnimationFrame =
                null;
        }


        if (this.cursorAnimationFrame) {

            cancelAnimationFrame(
                this.cursorAnimationFrame
            );

            this.cursorAnimationFrame =
                null;
        }


        if (this.stream) {

            this.stream
                .getTracks()
                .forEach(
                    track =>
                        track.stop()
                );

            this.stream =
                null;
        }


        if (this.video) {

            this.video.srcObject =
                null;
        }


        if (this.faceLandmarker) {

            try {

                this.faceLandmarker.close();

            } catch (error) {

                console.warn(
                    error
                );
            }

            this.faceLandmarker =
                null;
        }


        this.isCalibrated =
            false;

        this.calibrationRunning =
            false;


        this.resetDwell();


        this.cursorVelocityX =
            0;

        this.cursorVelocityY =
            0;


        this.updateCameraVisibility();


        const startButton =
            this.panel?.querySelector(
                "#a11y-head-start"
            );


        const calibrateButton =
            this.panel?.querySelector(
                "#a11y-head-calibrate"
            );


        if (startButton) {

            startButton.textContent =
                "Ativar câmera";
        }


        if (calibrateButton) {

            calibrateButton.disabled =
                true;
        }


        this.updateStatus(
            "Câmera desativada"
        );
    }


    // ==============================================================
    // CAMERA VISIBILITY
    // ==============================================================

    updateCameraVisibility() {

        if (!this.cameraContainer) {

            return;
        }


        this.cameraContainer.style.display =
            this.cameraEnabled &&
            this.options.showCameraPreview
                ? "block"
                : "none";
    }


    // ==============================================================
    // PROCESS VIDEO
    // ==============================================================

    processVideo() {

        if (
            !this.cameraEnabled ||
            !this.faceLandmarker
        ) {

            return;
        }


        const now =
            performance.now();


        if (
            this.video.readyState >= 2 &&
            this.video.currentTime !==
                this.lastVideoTime
        ) {

            this.lastVideoTime =
                this.video.currentTime;


            try {

                const result =
                    this.faceLandmarker
                        .detectForVideo(
                            this.video,
                            now
                        );


                this.processFaceResult(
                    result
                );

            } catch (error) {

                console.error(
                    "Erro detectando rosto:",
                    error
                );
            }
        }


        this.videoAnimationFrame =
            requestAnimationFrame(
                () =>
                    this.processVideo()
            );
    }


    // ==============================================================
    // PROCESS FACE
    // ==============================================================

    processFaceResult(result) {

        if (
            !result ||
            !result.faceLandmarks ||
            result.faceLandmarks.length === 0
        ) {

            this.cursorVelocityX = 0;

            this.cursorVelocityY = 0;

            this.updateStatus(
                "Rosto não detectado"
            );

            return;
        }


        const landmarks =
            result.faceLandmarks[0];


        const pose =
            this.calculateHeadPose(
                landmarks
            );


        if (!pose) {

            return;
        }


        this.currentYaw =
            pose.yaw;

        this.currentPitch =
            pose.pitch;


        // ==========================================================
        // FILTRO
        // ==========================================================

        const alpha =
            this.options.smoothing;


        this.filteredYaw +=
            (
                this.currentYaw -
                this.filteredYaw
            ) * alpha;


        this.filteredPitch +=
            (
                this.currentPitch -
                this.filteredPitch
            ) * alpha;


        // ==========================================================
        // SE ESTIVER CALIBRANDO
        // ==========================================================

        if (
            this.calibrationRunning
        ) {

            this.collectCalibrationSample();

            return;
        }


        // ==========================================================
        // SE NÃO CALIBRADO
        // ==========================================================

        if (
            !this.isCalibrated
        ) {

            return;
        }


        // ==========================================================
        // MOVIMENTO
        // ==========================================================

        const yaw =
            this.filteredYaw -
            this.calibration.centerYaw;


        const pitch =
            this.filteredPitch -
            this.calibration.centerPitch;


        this.updateHeadVelocity(
            yaw,
            pitch
        );


        // ==========================================================
        // NOD
        // ==========================================================

        if (
            this.options.nodEnabled
        ) {

            this.detectNod(
                pitch
            );
        }
    }


    // ==============================================================
    // CALCULA POSE
    // ==============================================================

    calculateHeadPose(
        landmarks
    ) {

        const nose =
            landmarks[1];

        const forehead =
            landmarks[10];

        const chin =
            landmarks[152];

        const leftOuter =
            landmarks[33];

        const leftInner =
            landmarks[133];

        const rightInner =
            landmarks[362];

        const rightOuter =
            landmarks[263];


        if (
            !nose ||
            !forehead ||
            !chin ||
            !leftOuter ||
            !leftInner ||
            !rightInner ||
            !rightOuter
        ) {

            return null;
        }


        // ==========================================================
        // OLHO ESQUERDO
        // ==========================================================

        const leftEye = {

            x:
                (
                    leftOuter.x +
                    leftInner.x
                ) / 2,

            y:
                (
                    leftOuter.y +
                    leftInner.y
                ) / 2
        };


        // ==========================================================
        // OLHO DIREITO
        // ==========================================================

        const rightEye = {

            x:
                (
                    rightOuter.x +
                    rightInner.x
                ) / 2,

            y:
                (
                    rightOuter.y +
                    rightInner.y
                ) / 2
        };


        // ==========================================================
        // CENTRO DOS OLHOS
        // ==========================================================

        const eyeCenter = {

            x:
                (
                    leftEye.x +
                    rightEye.x
                ) / 2,

            y:
                (
                    leftEye.y +
                    rightEye.y
                ) / 2
        };


        // ==========================================================
        // DISTÂNCIA DOS OLHOS
        // ==========================================================

        const eyeDistance =
            Math.hypot(

                rightEye.x -
                leftEye.x,

                rightEye.y -
                leftEye.y
            );


        if (
            eyeDistance < 0.001
        ) {

            return null;
        }


        // ==========================================================
        // YAW
        // ==========================================================

        const yaw =
            (
                nose.x -
                eyeCenter.x
            ) /
            eyeDistance;


        // ==========================================================
        // ALTURA DO ROSTO
        // ==========================================================

        const faceHeight =
            Math.abs(
                chin.y -
                forehead.y
            );


        if (
            faceHeight < 0.001
        ) {

            return null;
        }


        // ==========================================================
        // PITCH
        // ==========================================================

        const pitch =
            (
                nose.y -
                eyeCenter.y
            ) /
            faceHeight;


        return {
            yaw,
            pitch
        };
    }


    // ==============================================================
    // CALIBRAÇÃO
    // ==============================================================

    async startCalibration() {

        if (
            !this.cameraEnabled ||
            this.calibrationRunning
        ) {

            return;
        }


        this.calibrationRunning =
            true;

        this.isCalibrated =
            false;


        this.cursorVelocityX = 0;

        this.cursorVelocityY = 0;


        this.calibrationOverlay.style.display =
            "flex";


        const points = [

            {
                name: "center",
                x: 50,
                y: 50,

                message:
                    "Olhe para o centro da tela e mantenha a cabeça em posição natural."
            },

            {
                name: "left",
                x: 15,
                y: 50,

                message:
                    "Agora vire a cabeça lentamente para a esquerda. Não mova o corpo."
            },

            {
                name: "right",
                x: 85,
                y: 50,

                message:
                    "Agora vire a cabeça lentamente para a direita."
            },

            {
                name: "up",
                x: 50,
                y: 18,

                message:
                    "Agora incline a cabeça lentamente para cima."
            },

            {
                name: "down",
                x: 50,
                y: 82,

                message:
                    "Agora incline a cabeça lentamente para baixo."
            }
        ];


        try {

            for (
                let i = 0;
                i < points.length;
                i++
            ) {

                await this.calibrationPoint(
                    points[i],
                    i,
                    points.length
                );
            }


            // ======================================================
            // GARANTE VALORES VÁLIDOS
            // ======================================================

            this.normalizeCalibration();


            this.isCalibrated =
                true;


            this.updateCursorToCenter();


            this.updateStatus(
                "Calibração concluída. Mova a cabeça para controlar o cursor."
            );


        } finally {

            this.calibrationRunning =
                false;

            this.calibrationOverlay.style.display =
                "none";
        }
    }


    // ==============================================================
    // CALIBRATION POINT
    // ==============================================================

    async calibrationPoint(
        point,
        index,
        total
    ) {

        const dot =
            document.getElementById(
                "a11y-calibration-dot"
            );


        const message =
            document.getElementById(
                "a11y-calibration-message"
            );


        const bar =
            document.getElementById(
                "a11y-head-calibration-bar"
            );


        dot.style.left =
            `${point.x}%`;


        dot.style.top =
            `${point.y}%`;


        message.textContent =
            point.message;


        /*
         * Pequeno tempo para a pessoa
         * posicionar a cabeça.
         */

        await this.wait(900);


        /*
         * Coleta amostras.
         */

        this.calibrationSamples =
            [];


        for (
            let i = 0;
            i < this.calibrationSampleCount;
            i++
        ) {

            await this.wait(35);


            if (
                !this.cameraEnabled
            ) {

                throw new Error(
                    "Câmera desligada durante calibração."
                );
            }


            this.calibrationSamples.push({

                yaw:
                    this.filteredYaw,

                pitch:
                    this.filteredPitch
            });


            const localProgress =
                (i + 1) /
                this.calibrationSampleCount;


            const totalProgress =
                (
                    index +
                    localProgress
                ) /
                total;


            bar.style.width =
                `${totalProgress * 100}%`;
        }


        const yaw =
            this.average(
                this.calibrationSamples.map(
                    sample =>
                        sample.yaw
                )
            );


        const pitch =
            this.average(
                this.calibrationSamples.map(
                    sample =>
                        sample.pitch
                )
            );


        this.calibration[
            `${point.name}Yaw`
        ] = yaw;


        this.calibration[
            `${point.name}Pitch`
        ] = pitch;
    }


    // ==============================================================
    // NORMALIZA CALIBRAÇÃO
    // ==============================================================

    normalizeCalibration() {

        const c =
            this.calibration;


        // ==========================================================
        // CENTRO
        // ==========================================================

        /*
         * Se alguma coisa deu errado,
         * usa o valor atual.
         */

        if (
            !Number.isFinite(
                c.centerYaw
            )
        ) {

            c.centerYaw =
                this.filteredYaw;
        }


        if (
            !Number.isFinite(
                c.centerPitch
            )
        ) {

            c.centerPitch =
                this.filteredPitch;
        }


        // ==========================================================
        // ESQUERDA
        // ==========================================================

        if (
            !Number.isFinite(
                c.leftYaw
            )
        ) {

            c.leftYaw =
                c.centerYaw -
                0.12;
        }


        // ==========================================================
        // DIREITA
        // ==========================================================

        if (
            !Number.isFinite(
                c.rightYaw
            )
        ) {

            c.rightYaw =
                c.centerYaw +
                0.12;
        }


        // ==========================================================
        // CIMA
        // ==========================================================

        if (
            !Number.isFinite(
                c.upPitch
            )
        ) {

            c.upPitch =
                c.centerPitch -
                0.08;
        }


        // ==========================================================
        // BAIXO
        // ==========================================================

        if (
            !Number.isFinite(
                c.downPitch
            )
        ) {

            c.downPitch =
                c.centerPitch +
                0.08;
        }


        /*
         * Garante amplitude mínima.
         */

        const minimum =
            0.025;


        if (
            Math.abs(
                c.rightYaw -
                c.centerYaw
            ) < minimum
        ) {

            c.rightYaw =
                c.centerYaw +
                minimum;
        }


        if (
            Math.abs(
                c.leftYaw -
                c.centerYaw
            ) < minimum
        ) {

            c.leftYaw =
                c.centerYaw -
                minimum;
        }


        if (
            Math.abs(
                c.downPitch -
                c.centerPitch
            ) < minimum
        ) {

            c.downPitch =
                c.centerPitch +
                minimum;
        }


        if (
            Math.abs(
                c.upPitch -
                c.centerPitch
            ) < minimum
        ) {

            c.upPitch =
                c.centerPitch -
                minimum;
        }
    }


    // ==============================================================
    // ATUALIZA VELOCIDADE
    // ==============================================================

    updateHeadVelocity(
        yaw,
        pitch
    ) {

        const normalizedX =
            this.normalizeHorizontal(
                yaw
            );


        const normalizedY =
            this.normalizeVertical(
                pitch
            );


        /*
         * Zona morta.
         */

        const x =
            this.applyDeadZone(
                normalizedX,
                this.options.deadZone
            );


        const y =
            this.applyDeadZone(
                normalizedY,
                this.options.deadZone
            );


        /*
         * Curva.
         *
         * Pequeno movimento =
         * cursor lento.
         *
         * Grande movimento =
         * cursor rápido.
         */

        const curvedX =
            this.speedCurve(x);


        const curvedY =
            this.speedCurve(y);


        this.cursorVelocityX =
            curvedX *
            this.options.maxSpeed *
            this.options.sensitivity;


        this.cursorVelocityY =
            curvedY *
            this.options.maxSpeed *
            this.options.sensitivity;
    }


    // ==============================================================
    // NORMALIZA HORIZONTAL
    // ==============================================================

    normalizeHorizontal(
        yaw
    ) {

        const c =
            this.calibration;


        if (
            yaw >= 0
        ) {

            const range =
                c.rightYaw -
                c.centerYaw;


            if (
                Math.abs(range) < 0.001
            ) {

                return 0;
            }


            return Math.max(
                -1,
                Math.min(
                    1,
                    yaw / range
                )
            );
        }


        const range =
            c.leftYaw -
            c.centerYaw;


        if (
            Math.abs(range) < 0.001
        ) {

            return 0;
        }


        return Math.max(
            -1,
            Math.min(
                1,
                yaw / Math.abs(range)
            )
        );
    }


    // ==============================================================
    // NORMALIZA VERTICAL
    // ==============================================================

    normalizeVertical(
        pitch
    ) {

        const c =
            this.calibration;


        if (
            pitch >= 0
        ) {

            const range =
                c.downPitch -
                c.centerPitch;


            if (
                Math.abs(range) < 0.001
            ) {

                return 0;
            }


            return Math.max(
                -1,
                Math.min(
                    1,
                    pitch / range
                )
            );
        }


        const range =
            c.upPitch -
            c.centerPitch;


        if (
            Math.abs(range) < 0.001
        ) {

            return 0;
        }


        return Math.max(
            -1,
            Math.min(
                1,
                pitch / Math.abs(range)
            )
        );
    }


    // ==============================================================
    // DEAD ZONE
    // ==============================================================

    applyDeadZone(
        value,
        deadZone
    ) {

        const absolute =
            Math.abs(value);


        if (
            absolute <= deadZone
        ) {

            return 0;
        }


        const sign =
            Math.sign(value);


        const adjusted =
            (
                absolute -
                deadZone
            ) /
            (
                1 -
                deadZone
            );


        return (
            sign *
            Math.min(
                1,
                adjusted
            )
        );
    }


    // ==============================================================
    // CURVA
    // ==============================================================

    speedCurve(
        value
    ) {

        if (
            value === 0
        ) {

            return 0;
        }


        const sign =
            Math.sign(value);


        const magnitude =
            Math.abs(value);


        return (
            sign *
            Math.pow(
                magnitude,
                1.6
            )
        );
    }


    // ==============================================================
    // LOOP DO CURSOR
    // ==============================================================

    startCursorLoop() {

        if (
            this.cursorAnimationFrame
        ) {

            cancelAnimationFrame(
                this.cursorAnimationFrame
            );
        }


        const loop =
            () => {

                if (
                    !this.cameraEnabled
                ) {

                    return;
                }


                this.updateCursorMovement();


                this.cursorAnimationFrame =
                    requestAnimationFrame(
                        loop
                    );
            };


        loop();
    }


    // ==============================================================
    // MOVIMENTO DO CURSOR
    // ==============================================================

    updateCursorMovement() {

        if (
            !this.isCalibrated
        ) {

            return;
        }


        /*
         * Atualiza alvo.
         */

        this.targetCursorX +=
            this.cursorVelocityX;


        this.targetCursorY +=
            this.cursorVelocityY;


        /*
         * Limites.
         */

        const margin =
            this.options.cursorSize / 2;


        this.targetCursorX =
            Math.max(
                margin,
                Math.min(
                    window.innerWidth -
                    margin,
                    this.targetCursorX
                )
            );


        this.targetCursorY =
            Math.max(
                margin,
                Math.min(
                    window.innerHeight -
                    margin,
                    this.targetCursorY
                )
            );


        /*
         * Suavização visual.
         */

        const smooth =
            0.38;


        this.cursorX +=
            (
                this.targetCursorX -
                this.cursorX
            ) *
            smooth;


        this.cursorY +=
            (
                this.targetCursorY -
                this.cursorY
            ) *
            smooth;


        this.updateCursorPosition();


        this.updateHoveredElement();


        this.updateDebug();
    }


    // ==============================================================
    // POSIÇÃO CURSOR
    // ==============================================================

    updateCursorPosition() {

        if (
            !this.cursorElement
        ) {

            return;
        }


        this.cursorElement.style.left =
            `${this.cursorX}px`;


        this.cursorElement.style.top =
            `${this.cursorY}px`;


        if (
            this.dwellElement
        ) {

            this.dwellElement.style.left =
                `${this.cursorX}px`;

            this.dwellElement.style.top =
                `${this.cursorY}px`;
        }
    }


    // ==============================================================
    // CENTRALIZA CURSOR
    // ==============================================================

    updateCursorToCenter() {

        this.cursorX =
            window.innerWidth / 2;

        this.cursorY =
            window.innerHeight / 2;


        this.targetCursorX =
            this.cursorX;

        this.targetCursorY =
            this.cursorY;


        this.cursorVelocityX = 0;

        this.cursorVelocityY = 0;


        this.updateCursorPosition();
    }


    // ==============================================================
    // ELEMENTO SOB CURSOR
    // ==============================================================

    updateHoveredElement() {

        const element =
            document.elementFromPoint(
                this.cursorX,
                this.cursorY
            );


        const clickable =
            this.findClickableElement(
                element
            );


        if (
            clickable
        ) {

            this.cursorElement
                .classList
                .add("clickable");


            this.updateDwell(
                clickable
            );

        } else {

            this.cursorElement
                .classList
                .remove("clickable");


            this.resetDwell();
        }
    }


    // ==============================================================
    // ENCONTRA CLICÁVEL
    // ==============================================================

    findClickableElement(
        element
    ) {

        if (!element) {

            return null;
        }


        const clickable =
            element.closest(
                [
                    "button",
                    "a[href]",
                    "input",
                    "select",
                    "textarea",
                    "[role='button']",
                    "[role='link']",
                    "[role='checkbox']",
                    "[role='radio']",
                    "[role='tab']"
                ].join(",")
            );


        if (!clickable) {

            return null;
        }


        if (
            clickable.disabled ||
            clickable.hidden
        ) {

            return null;
        }


        if (
            clickable.getAttribute(
                "aria-disabled"
            ) === "true"
        ) {

            return null;
        }


        if (
            !this.isVisible(
                clickable
            )
        ) {

            return null;
        }


        if (
            this.isAccessibilityUI(
                clickable
            )
        ) {

            return null;
        }


        return clickable;
    }


    // ==============================================================
    // VISIBILIDADE
    // ==============================================================

    isVisible(
        element
    ) {

        const style =
            window.getComputedStyle(
                element
            );


        if (
            style.display === "none" ||
            style.visibility === "hidden" ||
            style.opacity === "0"
        ) {

            return false;
        }


        const rect =
            element.getBoundingClientRect();


        return (
            rect.width > 0 &&
            rect.height > 0
        );
    }


    // ==============================================================
    // DWELL
    // ==============================================================

    updateDwell(
        element
    ) {

        if (
            !this.options.dwellEnabled
        ) {

            this.resetDwell();

            return;
        }


        if (
            this.dwellTarget === element
        ) {

            this.updateDwellVisual();

            return;
        }


        this.resetDwell();


        this.dwellTarget =
            element;


        this.dwellStartedAt =
            performance.now();


        this.dwellElement.style.display =
            "block";


        this.dwellTimer =
            setTimeout(
                () => {

                    if (
                        this.dwellTarget ===
                        element
                    ) {

                        this.clickElement(
                            element,
                            "dwell"
                        );
                    }

                },
                this.options.dwellTime
            );
    }


    // ==============================================================
    // DWELL VISUAL
    // ==============================================================

    updateDwellVisual() {

        if (
            !this.dwellTarget ||
            !this.dwellStartedAt
        ) {

            return;
        }


        const elapsed =
            performance.now() -
            this.dwellStartedAt;


        const progress =
            Math.min(
                1,
                elapsed /
                this.options.dwellTime
            );


        const progressElement =
            this.dwellElement.querySelector(
                "#a11y-head-dwell-progress"
            );


        if (
            progressElement
        ) {

            progressElement.style.transform =
                `rotate(${
                    -90 +
                    progress * 360
                }deg)`;
        }
    }


    // ==============================================================
    // RESET DWELL
    // ==============================================================

    resetDwell() {

        if (
            this.dwellTimer
        ) {

            clearTimeout(
                this.dwellTimer
            );

            this.dwellTimer =
                null;
        }


        this.dwellTarget =
            null;


        this.dwellStartedAt =
            0;


        if (
            this.dwellElement
        ) {

            this.dwellElement.style.display =
                "none";
        }
    }


    // ==============================================================
    // NOD
    // ==============================================================

    detectNod(
        pitch
    ) {

        const threshold =
            this.options.nodThreshold;


        const now =
            performance.now();


        /*
         * Começou a inclinar para baixo.
         */

        if (
            this.nodState ===
            "neutral"
        ) {

            if (
                pitch >
                threshold
            ) {

                this.nodState =
                    "down";

                this.nodStartedAt =
                    now;
            }


            return;
        }


        /*
         * Timeout.
         */

        if (
            now -
            this.nodStartedAt >
            1200
        ) {

            this.nodState =
                "neutral";

            return;
        }


        /*
         * Voltou.
         */

        if (
            this.nodState ===
            "down"
        ) {

            if (
                Math.abs(pitch) <
                threshold * .4
            ) {

                this.nodState =
                    "neutral";


                this.clickCurrentElement(
                    "nod"
                );
            }
        }
    }


    // ==============================================================
    // CLIQUE ATUAL
    // ==============================================================

    clickCurrentElement(
        source
    ) {

        const element =
            document.elementFromPoint(
                this.cursorX,
                this.cursorY
            );


        const clickable =
            this.findClickableElement(
                element
            );


        if (
            clickable
        ) {

            this.clickElement(
                clickable,
                source
            );
        }
    }


    // ==============================================================
    // CLIQUE
    // ==============================================================

    clickElement(
        element,
        source
    ) {

        if (!element) {

            return;
        }


        const now =
            performance.now();


        /*
         * Evita duplo clique acidental.
         */

        if (
            now -
            this.lastClickTime <
            this.options.clickCooldown
        ) {

            return;
        }


        this.lastClickTime =
            now;


        this.resetDwell();


        this.cursorElement
            .classList
            .add("clicking");


        setTimeout(
            () => {

                this.cursorElement
                    .classList
                    .remove("clicking");

            },
            220
        );


        try {

            element.focus({
                preventScroll:
                    true
            });

        } catch (error) {

            try {

                element.focus();

            } catch (_) {}
        }


        try {

            element.click();

        } catch (error) {

            console.error(
                "Erro no clique:",
                error
            );
        }
    }


    // ==============================================================
    // TECLADO
    // ==============================================================

    setupKeyboard() {

        document.addEventListener(
            "keydown",
            event => {

                /*
                 * C
                 *
                 * recalibra
                 */

                if (
                    event.key.toLowerCase() ===
                    "c"
                ) {

                    if (
                        this.cameraEnabled
                    ) {

                        this.startCalibration();
                    }

                    return;
                }


                /*
                 * ENTER
                 */

                if (
                    event.key ===
                    "Enter"
                ) {

                    this.clickCurrentElement(
                        "keyboard"
                    );

                    return;
                }


                /*
                 * ESPAÇO
                 */

                if (
                    event.key ===
                    " "
                ) {

                    this.clickCurrentElement(
                        "keyboard"
                    );

                    return;
                }


                /*
                 * + aumenta sensibilidade
                 */

                if (
                    event.key === "+"
                ) {

                    this.options.sensitivity =
                        Math.min(
                            3,
                            this.options.sensitivity +
                            0.1
                        );

                    return;
                }


                /*
                 * - diminui sensibilidade
                 */

                if (
                    event.key === "-"
                ) {

                    this.options.sensitivity =
                        Math.max(
                            .3,
                            this.options.sensitivity -
                            0.1
                        );
                }

            }
        );
    }


    // ==============================================================
    // RESIZE
    // ==============================================================

    setupResize() {

        window.addEventListener(
            "resize",
            () => {

                const margin =
                    this.options.cursorSize / 2;


                this.targetCursorX =
                    Math.max(
                        margin,
                        Math.min(
                            window.innerWidth -
                            margin,
                            this.targetCursorX
                        )
                    );


                this.targetCursorY =
                    Math.max(
                        margin,
                        Math.min(
                            window.innerHeight -
                            margin,
                            this.targetCursorY
                        )
                    );


                this.updateCursorPosition();
            }
        );
    }


    // ==============================================================
    // OBSERVER
    // ==============================================================

    observeDOM() {

        const observer =
            new MutationObserver(
                () => {

                    clearTimeout(
                        this.refreshTimeout
                    );


                    this.refreshTimeout =
                        setTimeout(
                            () => {

                                this.refreshInteractiveElements();

                            },
                            250
                        );
                }
            );


        observer.observe(
            document.body,
            {

                childList: true,

                subtree: true,

                attributes: true,

                attributeFilter: [

                    "disabled",
                    "hidden",
                    "style",
                    "class",
                    "aria-hidden"

                ]
            }
        );


        this.domObserver =
            observer;
    }


    // ==============================================================
    // INTERATIVOS
    // ==============================================================

    refreshInteractiveElements() {

        const selectors = [

            "button",
            "a[href]",
            "input",
            "select",
            "textarea",
            "[role='button']",
            "[role='link']",
            "[role='checkbox']",
            "[role='radio']",
            "[role='tab']"

        ];


        this.interactiveElements =
            Array.from(
                document.querySelectorAll(
                    selectors.join(",")
                )
            )
                .filter(
                    element =>
                        this.isVisible(
                            element
                        ) &&
                        !this.isAccessibilityUI(
                            element
                        )
                );
    }


    // ==============================================================
    // IGNORA NOSSA INTERFACE
    // ==============================================================

    isAccessibilityUI(
        element
    ) {

        return Boolean(
            element.closest(
                [
                    "#a11y-head-panel",
                    "#a11y-head-camera",
                    "#a11y-head-calibration",
                    "#a11y-head-cursor",
                    "#a11y-head-dwell",
                    "#a11y-head-debug"
                ].join(",")
            )
        );
    }


    // ==============================================================
    // STATUS
    // ==============================================================

    updateStatus(
        message
    ) {

        if (
            this.statusElement
        ) {

            this.statusElement.textContent =
                message;
        }
    }


    // ==============================================================
    // DEBUG
    // ==============================================================

    updateDebug() {

        if (
            !this.debugElement
        ) {

            return;
        }


        if (
            !this.isCalibrated
        ) {

            return;
        }


        const yaw =
            this.filteredYaw -
            this.calibration.centerYaw;


        const pitch =
            this.filteredPitch -
            this.calibration.centerPitch;


        this.debugElement.innerHTML = `

            YAW:
            ${yaw.toFixed(3)}

            <br>

            PITCH:
            ${pitch.toFixed(3)}

            <br>

            VX:
            ${this.cursorVelocityX.toFixed(2)}

            <br>

            VY:
            ${this.cursorVelocityY.toFixed(2)}

        `;
    }


    // ==============================================================
    // UTILITÁRIOS
    // ==============================================================

    average(
        values
    ) {

        if (
            !values.length
        ) {

            return 0;
        }


        return (
            values.reduce(
                (
                    total,
                    value
                ) =>
                    total + value,
                0
            ) /
            values.length
        );
    }


    wait(
        milliseconds
    ) {

        return new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    milliseconds
                )
        );
    }


    // ==============================================================
    // ERROR
    // ==============================================================

    getErrorMessage(
        error
    ) {

        if (!error) {

            return "Erro desconhecido.";
        }


        switch (
            error.name
        ) {

            case "NotAllowedError":

                return (
                    "Permissão da câmera negada. " +
                    "Permita a câmera no Chrome."
                );


            case "NotFoundError":

                return (
                    "Nenhuma câmera foi encontrada."
                );


            case "NotReadableError":

                return (
                    "A câmera está sendo usada " +
                    "por outro aplicativo."
                );


            case "SecurityError":

                return (
                    "A câmera exige HTTPS."
                );


            default:

                return (
                    error.message ||
                    "Não foi possível iniciar a câmera."
                );
        }
    }


    // ==============================================================
    // API PÚBLICA
    // ==============================================================

    enable() {

        return this.startCamera();
    }


    disable() {

        this.stopCamera();
    }


    recalibrate() {

        if (
            this.cameraEnabled
        ) {

            return this.startCalibration();
        }
    }


    setSensitivity(
        value
    ) {

        this.options.sensitivity =
            Math.max(
                .3,
                Math.min(
                    3,
                    Number(value)
                )
            );
    }


    setDwellTime(
        milliseconds
    ) {

        this.options.dwellTime =
            Math.max(
                300,
                Number(milliseconds)
            );
    }
}


/* =================================================================
   INICIALIZAÇÃO
   ================================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        window.accessibilityMVP =
            new AccessibilityMVP({

                cursorSize:
                    34,

                maxSpeed:
                    15,

                sensitivity:
                    1.0,

                deadZone:
                    0.08,

                smoothing:
                    0.22,

                dwellEnabled:
                    true,

                dwellTime:
                    1400,

                nodEnabled:
                    true,

                nodThreshold:
                    0.07,

                clickCooldown:
                    700,

                showPanel:
                    true,

                showCameraPreview:
                    true
            });
    }
);