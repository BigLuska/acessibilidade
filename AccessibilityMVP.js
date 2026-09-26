class AccessibilityMVP {
  constructor(options = {}) {
    this.options = {
      cursorSize: 28,
      dwellTime: 1200,
      smoothing: 0.18,

      // Quantidade de pontos usados na calibração
      calibrationPoints: 9,

      // Quantidade de amostras coletadas por ponto
      calibrationSamples: 25,

      // Tempo entre pontos de calibração
      calibrationPointTime: 1000,

      // Margem para impedir o cursor de ficar exatamente na borda
      screenMargin: 20,

      ...options
    };

    // ============================
    // ESTADO GERAL
    // ============================

    this.voiceEnabled = false;
    this.eyeEnabled = false;

    this.recognition = null;
    this.voiceRestartTimer = null;

    this.video = null;
    this.canvas = null;
    this.cursor = null;
    this.preview = null;
    this.stream = null;

    this.faceLandmarker = null;
    this.eyeLoopId = null;

    this.button = null;
    this.panel = null;

    // ============================
    // ESTADO DOS OLHOS
    // ============================

    this.eye = {
      gazeX: null,
      gazeY: null,

      rawX: null,
      rawY: null,

      lastFaceStatus: 0,

      dwellTarget: null,
      dwellStartedAt: 0,
      dwellLockedTarget: null,

      lastClick: 0,

      // Dados da calibração
      calibration: {
        active: false,
        pointIndex: 0,
        points: [],
        samples: [],
        timer: null
      }
    };

    // ============================
    // POSIÇÃO DO CURSOR
    // ============================

    this.cursorPosition = {
      x: Math.max(30, window.innerWidth / 2),
      y: Math.max(30, window.innerHeight / 2)
    };

    // ============================
    // CALIBRAÇÃO
    // ============================

    this.calibration = {
      points: [
        { x: 0.10, y: 0.10 },
        { x: 0.50, y: 0.10 },
        { x: 0.90, y: 0.10 },

        { x: 0.10, y: 0.50 },
        { x: 0.50, y: 0.50 },
        { x: 0.90, y: 0.50 },

        { x: 0.10, y: 0.90 },
        { x: 0.50, y: 0.90 },
        { x: 0.90, y: 0.90 }
      ],

      samples: [],

      minX: 0.15,
      maxX: 0.85,
      minY: 0.15,
      maxY: 0.85,

      calibrated: false
    };
  }

  // ============================================================
  // INIT
  // ============================================================

  init() {
    this.injectStyles();
    this.createUI();
    this.bindUI();
    this.updateCursor();

    this.setStatus("pronto");
  }

  // ============================================================
  // CSS
  // ============================================================

  injectStyles() {
    const style = document.createElement("style");

    style.textContent = `
      #a11y-mvp-button {
        position: fixed;
        right: max(12px, env(safe-area-inset-right));
        bottom: max(12px, env(safe-area-inset-bottom));
        z-index: 2147483647;

        width: 58px;
        height: 58px;

        border-radius: 50%;
        border: 0;

        background: #1455d9;
        color: #fff;

        font-size: 25px;
        cursor: pointer;

        box-shadow: 0 4px 18px #0005;

        touch-action: manipulation;
      }

      #a11y-mvp-panel {
        position: fixed;

        right: max(12px, env(safe-area-inset-right));

        bottom:
          calc(
            max(12px, env(safe-area-inset-bottom)) + 70px
          );

        z-index: 2147483646;

        width: min(340px, calc(100vw - 24px));

        max-height: min(80vh, 650px);

        overflow-y: auto;

        padding: 16px;

        background: #fff;
        color: #111;

        border: 1px solid #ccc;
        border-radius: 14px;

        box-shadow: 0 8px 30px #0003;

        display: none;

        font: 14px Arial, sans-serif;

        box-sizing: border-box;
      }

      #a11y-mvp-panel.open {
        display: block;
      }

      #a11y-mvp-panel h2 {
        margin: 0 0 14px;
        font-size: 19px;
      }

      .a11y-row {
        display: flex;
        align-items: center;
        justify-content: space-between;

        gap: 10px;

        padding: 12px 0;

        border-top: 1px solid #eee;
      }

      .a11y-row:first-of-type {
        border-top: 0;
      }

      .a11y-row > div {
        flex: 1;
      }

      .a11y-row button {
        padding: 10px 12px;

        min-height: 44px;

        cursor: pointer;

        border: 1px solid #bbb;

        border-radius: 8px;

        background: #f7f7f7;

        touch-action: manipulation;
      }

      .a11y-row button:hover {
        background: #eee;
      }

      #a11y-status {
        font-size: 12px;
        color: #444;

        margin-top: 12px;

        padding: 10px;

        background: #f5f5f5;

        border-radius: 8px;

        line-height: 1.4;
      }

      #a11y-eye-cursor {
        position: fixed;

        z-index: 2147483645;

        width: 28px;
        height: 28px;

        border: 3px solid #1455d9;

        border-radius: 50%;

        pointer-events: none;

        transform: translate(-50%, -50%);

        display: none;

        box-sizing: border-box;

        background: #fff8;

        transition:
          width .12s,
          height .12s,
          border-color .12s,
          background .12s;
      }

      #a11y-eye-preview {
        position: fixed;

        left: 10px;
        bottom: 10px;

        z-index: 2147483644;

        width: 180px;
        height: 135px;

        object-fit: cover;

        border-radius: 10px;

        border: 2px solid #1455d9;

        display: none;

        background: #000;

        transform: scaleX(-1);
      }

      #a11y-calibration {
        position: fixed;

        inset: 0;

        z-index: 2147483643;

        display: none;

        background: rgba(0, 0, 0, 0.88);

        color: white;
      }

      #a11y-calibration.open {
        display: block;
      }

      #a11y-calibration-instruction {
        position: fixed;

        top: 20px;
        left: 50%;

        transform: translateX(-50%);

        width: min(90vw, 500px);

        text-align: center;

        font: bold 18px Arial, sans-serif;

        line-height: 1.4;

        z-index: 2147483647;
      }

      #a11y-calibration-dot {
        position: fixed;

        width: 42px;
        height: 42px;

        border-radius: 50%;

        background: #fff;

        border: 6px solid #1455d9;

        box-shadow:
          0 0 0 8px rgba(20, 85, 217, .25),
          0 0 30px rgba(255,255,255,.8);

        transform: translate(-50%, -50%);

        transition:
          left .25s ease,
          top .25s ease;

        z-index: 2147483647;
      }

      #a11y-calibration-progress {
        position: fixed;

        left: 50%;
        bottom: 30px;

        transform: translateX(-50%);

        font: 14px Arial, sans-serif;

        color: #ddd;

        z-index: 2147483647;
      }

      #a11y-calibration-cancel {
        position: fixed;

        right: 20px;
        bottom: 20px;

        z-index: 2147483647;

        padding: 12px 16px;

        border: 0;

        border-radius: 8px;

        cursor: pointer;
      }

      @media (max-width: 600px) {

        #a11y-eye-preview {
          left: auto;

          right: max(
            8px,
            env(safe-area-inset-right)
          );

          top: max(
            8px,
            env(safe-area-inset-top)
          );

          bottom: auto;

          width: 110px;
          height: 82px;

          border-radius: 8px;
        }

        #a11y-mvp-panel {
          padding: 14px;

          max-height:
            min(
              70dvh,
              560px
            );
        }

        .a11y-row {
          gap: 8px;
        }

        .a11y-row button {
          flex: 0 0 auto;
        }
      }
    `;

    document.head.appendChild(style);
  }

  // ============================================================
  // UI
  // ============================================================

  createUI() {

    // Botão principal
    this.button = document.createElement("button");

    this.button.id = "a11y-mvp-button";

    this.button.type = "button";

    this.button.setAttribute(
      "aria-label",
      "Abrir acessibilidade"
    );

    this.button.setAttribute(
      "aria-expanded",
      "false"
    );

    this.button.textContent = "♿";


    // Painel
    this.panel = document.createElement("div");

    this.panel.id = "a11y-mvp-panel";

    this.panel.setAttribute(
      "role",
      "dialog"
    );

    this.panel.setAttribute(
      "aria-label",
      "Recursos de acessibilidade"
    );


    this.panel.innerHTML = `

      <h2>Acessibilidade</h2>

      <div class="a11y-row">

        <div>
          <strong>Navegação por olhos</strong><br>

          <small>
            Use a câmera para controlar o cursor
            com o olhar.
          </small>
        </div>

        <button
          id="a11y-eye-toggle"
          type="button"
        >
          Ativar
        </button>

      </div>


      <div class="a11y-row">

        <div>
          <strong>Calibração ocular</strong><br>

          <small>
            Faça antes de usar a navegação pelos olhos.
          </small>
        </div>

        <button
          id="a11y-calibrate"
          type="button"
          disabled
        >
          Calibrar
        </button>

      </div>


      <div class="a11y-row">

        <div>
          <strong>Navegação por voz</strong><br>

          <small>
            Exemplo:
            "clicar em Comprar"
          </small>
        </div>

        <button
          id="a11y-voice-toggle"
          type="button"
        >
          Ativar
        </button>

      </div>


      <div class="a11y-row">

        <div>
          <strong>Comandos disponíveis</strong><br>

          <small>
            clicar em Comprar<br>
            preencher nome com Lucas<br>
            rolar para baixo<br>
            rolar para cima<br>
            voltar<br>
            ir para o topo
          </small>
        </div>

      </div>


      <div
        id="a11y-status"
        role="status"
        aria-live="polite"
      >
        Status: pronto
      </div>
    `;


    // Cursor ocular
    this.cursor = document.createElement("div");

    this.cursor.id = "a11y-eye-cursor";


    // Preview da câmera
    this.preview = document.createElement("video");

    this.preview.id = "a11y-eye-preview";

    this.preview.autoplay = true;

    this.preview.muted = true;

    this.preview.playsInline = true;


    // Tela de calibração
    this.createCalibrationUI();


    document.body.append(
      this.button,
      this.panel,
      this.cursor,
      this.preview
    );
  }

  // ============================================================
  // UI DA CALIBRAÇÃO
  // ============================================================

  createCalibrationUI() {

    this.calibrationOverlay =
      document.createElement("div");

    this.calibrationOverlay.id =
      "a11y-calibration";

    this.calibrationOverlay.innerHTML = `

      <div id="a11y-calibration-instruction">
        Olhe diretamente para o ponto azul.
      </div>

      <div id="a11y-calibration-dot"></div>

      <div id="a11y-calibration-progress">
        Preparando calibração...
      </div>

      <button
        id="a11y-calibration-cancel"
        type="button"
      >
        Cancelar
      </button>
    `;

    document.body.appendChild(
      this.calibrationOverlay
    );

    this.calibrationDot =
      this.calibrationOverlay.querySelector(
        "#a11y-calibration-dot"
      );

    this.calibrationInstruction =
      this.calibrationOverlay.querySelector(
        "#a11y-calibration-instruction"
      );

    this.calibrationProgress =
      this.calibrationOverlay.querySelector(
        "#a11y-calibration-progress"
      );

    const cancelButton =
      this.calibrationOverlay.querySelector(
        "#a11y-calibration-cancel"
      );

    cancelButton.addEventListener(
      "click",
      () => this.cancelCalibration()
    );
  }

  // ============================================================
  // EVENTOS DA UI
  // ============================================================

  bindUI() {

    this.button.addEventListener(
      "click",
      () => {

        const isOpen =
          this.panel.classList.toggle("open");

        this.button.setAttribute(
          "aria-expanded",
          String(isOpen)
        );
      }
    );


    this.panel
      .querySelector("#a11y-eye-toggle")
      .addEventListener(
        "click",
        () => this.toggleEyes()
      );


    this.panel
      .querySelector("#a11y-calibrate")
      .addEventListener(
        "click",
        () => this.startCalibration()
      );


    this.panel
      .querySelector("#a11y-voice-toggle")
      .addEventListener(
        "click",
        () => this.toggleVoice()
      );


    window.addEventListener(
      "resize",
      () => {

        this.cursorPosition.x =
          Math.min(
            this.cursorPosition.x,
            window.innerWidth - this.options.screenMargin
          );

        this.cursorPosition.y =
          Math.min(
            this.cursorPosition.y,
            window.innerHeight - this.options.screenMargin
          );

        this.updateCursor();
      }
    );
  }

  // ============================================================
  // STATUS
  // ============================================================

  setStatus(message) {

    const el =
      this.panel?.querySelector(
        "#a11y-status"
      );

    if (el) {
      el.textContent =
        "Status: " + message;
    }
  }

  // ============================================================
  // CURSOR
  // ============================================================

  updateCursor() {

    if (!this.cursor) {
      return;
    }

    this.cursor.style.left =
      `${this.cursorPosition.x}px`;

    this.cursor.style.top =
      `${this.cursorPosition.y}px`;
  }

  // ============================================================
  // NAVEGAÇÃO OCULAR
  // ============================================================

  async toggleEyes() {

    if (this.eyeEnabled) {

      this.stopEyes();

      return;
    }


    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {

      this.setStatus(
        "este navegador não permite acesso à câmera"
      );

      return;
    }


    if (!window.isSecureContext) {

      this.setStatus(
        "a câmera exige HTTPS ou localhost"
      );

      return;
    }


    try {

      this.setStatus(
        "solicitando permissão da câmera..."
      );


      this.stream =
        await navigator.mediaDevices.getUserMedia({

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
              ideal: 30,
              max: 30
            }
          },

          audio: false
        });


      this.preview.srcObject =
        this.stream;

      this.preview.style.display =
        "block";


      await this.preview.play();


      this.setStatus(
        "carregando rastreamento facial..."
      );


      // ========================================================
      // MEDIA PIPE
      // ========================================================

      const vision =
        await import(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14"
        );


      const fileset =
        await vision.FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );


      this.faceLandmarker =
        await vision.FaceLandmarker.createFromOptions(
          fileset,
          {

            baseOptions: {

              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
            },

            runningMode: "VIDEO",

            numFaces: 1,

            minFaceDetectionConfidence: 0.5,

            minFacePresenceConfidence: 0.5,

            minTrackingConfidence: 0.5
          }
        );


      this.eyeEnabled = true;


      this.eye.gazeX = null;
      this.eye.gazeY = null;

      this.eye.rawX = null;
      this.eye.rawY = null;


      this.cursor.style.display =
        "block";


      const toggle =
        this.panel.querySelector(
          "#a11y-eye-toggle"
        );

      toggle.textContent =
        "Desativar";


      const calibrationButton =
        this.panel.querySelector(
          "#a11y-calibrate"
        );

      calibrationButton.disabled =
        false;


      this.setStatus(
        this.calibration.calibrated
          ? "rastreamento ativo"
          : "rastreamento ativo — faça a calibração"
      );


      this.startEyeTracking();

    } catch (error) {

      console.error(
        "Erro ao iniciar olhos:",
        error
      );


      this.stopEyes();


      if (
        error.name ===
        "NotAllowedError"
      ) {

        this.setStatus(
          "permissão da câmera negada"
        );

      } else if (
        error.name ===
        "NotFoundError"
      ) {

        this.setStatus(
          "nenhuma câmera encontrada"
        );

      } else {

        this.setStatus(
          "falha ao iniciar câmera/rastreamento — verifique HTTPS e conexão"
        );
      }
    }
  }

  // ============================================================
  // PARAR OLHOS
  // ============================================================

  stopEyes() {

    this.eyeEnabled = false;


    if (
      this.eyeLoopId !== null
    ) {

      cancelAnimationFrame(
        this.eyeLoopId
      );

      this.eyeLoopId = null;
    }


    if (this.faceLandmarker) {

      try {
        this.faceLandmarker.close();
      } catch (e) {
        console.warn(e);
      }

      this.faceLandmarker = null;
    }


    if (this.stream) {

      this.stream
        .getTracks()
        .forEach(
          track => track.stop()
        );

      this.stream = null;
    }


    if (this.preview) {

      this.preview.srcObject =
        null;

      this.preview.style.display =
        "none";
    }


    if (this.cursor) {

      this.cursor.style.display =
        "none";
    }


    this.eye.dwellTarget =
      null;

    this.eye.dwellLockedTarget =
      null;


    const eyeButton =
      this.panel?.querySelector(
        "#a11y-eye-toggle"
      );

    if (eyeButton) {
      eyeButton.textContent =
        "Ativar";
    }


    const calibrationButton =
      this.panel?.querySelector(
        "#a11y-calibrate"
      );

    if (calibrationButton) {
      calibrationButton.disabled =
        true;
    }


    this.setStatus(
      "navegação por olhos desativada"
    );
  }

  // ============================================================
  // LOOP DOS OLHOS
  // ============================================================

  startEyeTracking() {

    let lastDetection = 0;


    const track = (now) => {

      if (
        !this.eyeEnabled ||
        !this.faceLandmarker
      ) {

        return;
      }


      this.eyeLoopId =
        requestAnimationFrame(track);


      // aproximadamente 30 FPS
      if (
        now - lastDetection < 33
      ) {

        return;
      }


      lastDetection = now;


      if (
        this.preview.readyState < 2
      ) {

        return;
      }


      let result;

      try {

        result =
          this.faceLandmarker.detectForVideo(
            this.preview,
            now
          );

      } catch (error) {

        console.warn(
          "Erro detectForVideo:",
          error
        );

        return;
      }


      const landmarks =
        result.faceLandmarks?.[0];


      if (
        !landmarks ||
        landmarks.length < 478
      ) {

        if (
          now -
          this.eye.lastFaceStatus >
          2000
        ) {

          this.setStatus(
            "rosto não detectado — centralize o rosto na câmera"
          );

          this.eye.lastFaceStatus =
            now;
        }


        this.eye.dwellTarget =
          null;


        this.cursor.style.width =
          `${this.options.cursorSize}px`;

        this.cursor.style.height =
          `${this.options.cursorSize}px`;


        return;
      }


      const gaze =
        this.getGazePosition(
          landmarks
        );


      if (!gaze) {
        return;
      }


      this.eye.rawX =
        gaze.x;

      this.eye.rawY =
        gaze.y;


      // ========================================================
      // CALIBRAÇÃO
      // ========================================================

      if (
        this.eye.calibration.active
      ) {

        this.collectCalibrationSample(
          gaze.x,
          gaze.y
        );

        return;
      }


      // ========================================================
      // SUAVIZAÇÃO
      // ========================================================

      if (
        this.eye.gazeX === null
      ) {

        this.eye.gazeX =
          gaze.x;

        this.eye.gazeY =
          gaze.y;

      } else {

        this.eye.gazeX +=
          (
            gaze.x -
            this.eye.gazeX
          ) *
          this.options.smoothing;


        this.eye.gazeY +=
          (
            gaze.y -
            this.eye.gazeY
          ) *
          this.options.smoothing;
      }


      // ========================================================
      // CURSOR
      // ========================================================

      this.updateEyePosition(
        this.eye.gazeX,
        this.eye.gazeY
      );


      // ========================================================
      // DWELL CLICK
      // ========================================================

      this.updateDwellClick(
        now
      );
    };


    this.eyeLoopId =
      requestAnimationFrame(track);
  }

  // ============================================================
  // CALCULAR POSIÇÃO DO OLHAR
  // ============================================================

  getGazePosition(landmarks) {

    const eyes = [

      {
        iris: 468,

        corners: [
          33,
          133
        ],

        lids: [
          159,
          145
        ]
      },

      {
        iris: 473,

        corners: [
          362,
          263
        ],

        lids: [
          386,
          374
        ]
      }

    ];


    const positions =
      eyes.map(
        ({
          iris,
          corners,
          lids
        }) => {

          const irisPoint =
            landmarks[iris];


          const cornerPoints =
            corners.map(
              index =>
                landmarks[index]
            );


          const lidPoints =
            lids.map(
              index =>
                landmarks[index]
            );


          if (
            !irisPoint ||
            cornerPoints.some(
              p => !p
            ) ||
            lidPoints.some(
              p => !p
            )
          ) {

            return null;
          }


          const left =
            Math.min(
              cornerPoints[0].x,
              cornerPoints[1].x
            );


          const right =
            Math.max(
              cornerPoints[0].x,
              cornerPoints[1].x
            );


          const top =
            Math.min(
              lidPoints[0].y,
              lidPoints[1].y
            );


          const bottom =
            Math.max(
              lidPoints[0].y,
              lidPoints[1].y
            );


          const eyeWidth =
            Math.max(
              right - left,
              0.001
            );


          const eyeHeight =
            Math.max(
              bottom - top,
              0.001
            );


          let x =
            (
              irisPoint.x -
              left
            ) /
            eyeWidth;


          let y =
            (
              irisPoint.y -
              top
            ) /
            eyeHeight;


          /*
           * Espelhamento horizontal.
           *
           * A câmera frontal normalmente é exibida
           * como espelho, então invertemos X.
           */

          x = 1 - x;


          x =
            Math.max(
              0,
              Math.min(1, x)
            );


          y =
            Math.max(
              0,
              Math.min(1, y)
            );


          return {
            x,
            y
          };
        }
      );


    const valid =
      positions.filter(Boolean);


    if (
      valid.length === 0
    ) {

      return null;
    }


    return {

      x:
        valid.reduce(
          (sum, p) =>
            sum + p.x,
          0
        ) /
        valid.length,

      y:
        valid.reduce(
          (sum, p) =>
            sum + p.y,
          0
        ) /
        valid.length
    };
  }

  // ============================================================
  // POSIÇÃO DO CURSOR
  // ============================================================

  updateEyePosition(
    x,
    y
  ) {

    if (!this.eyeEnabled) {
      return;
    }


    let normalizedX;
    let normalizedY;


    // ========================================================
    // COM CALIBRAÇÃO
    // ========================================================

    if (
      this.calibration.calibrated
    ) {

      normalizedX =
        this.mapRange(
          x,
          this.calibration.minX,
          this.calibration.maxX,
          0,
          1
        );


      normalizedY =
        this.mapRange(
          y,
          this.calibration.minY,
          this.calibration.maxY,
          0,
          1
        );

    } else {

      /*
       * Antes da calibração usamos uma faixa conservadora.
       */

      normalizedX =
        this.mapRange(
          x,
          0.15,
          0.85,
          0,
          1
        );


      normalizedY =
        this.mapRange(
          y,
          0.15,
          0.85,
          0,
          1
        );
    }


    normalizedX =
      Math.max(
        0,
        Math.min(1, normalizedX)
      );


    normalizedY =
      Math.max(
        0,
        Math.min(1, normalizedY)
      );


    const margin =
      this.options.screenMargin;


    const targetX =
      margin +
      normalizedX *
      (
        window.innerWidth -
        margin * 2
      );


    const targetY =
      margin +
      normalizedY *
      (
        window.innerHeight -
        margin * 2
      );


    // ========================================================
    // SUAVIZAÇÃO
    // ========================================================

    this.cursorPosition.x +=
      (
        targetX -
        this.cursorPosition.x
      ) *
      this.options.smoothing;


    this.cursorPosition.y +=
      (
        targetY -
        this.cursorPosition.y
      ) *
      this.options.smoothing;


    this.cursorPosition.x =
      Math.max(
        margin,
        Math.min(
          window.innerWidth - margin,
          this.cursorPosition.x
        )
      );


    this.cursorPosition.y =
      Math.max(
        margin,
        Math.min(
          window.innerHeight - margin,
          this.cursorPosition.y
        )
      );


    this.updateCursor();
  }

  // ============================================================
  // MAP RANGE
  // ============================================================

  mapRange(
    value,
    inMin,
    inMax,
    outMin,
    outMax
  ) {

    if (
      Math.abs(inMax - inMin) <
      0.0001
    ) {

      return (
        outMin +
        outMax
      ) / 2;
    }


    return (
      (
        value - inMin
      ) /
      (
        inMax - inMin
      )
    ) *
    (
      outMax - outMin
    ) +
    outMin;
  }

  // ============================================================
  // DWELL CLICK
  // ============================================================

  updateDwellClick(now) {

    const element =
      document.elementFromPoint(
        this.cursorPosition.x,
        this.cursorPosition.y
      );


    const target =
      element?.closest(
        `
        button,
        a,
        input,
        select,
        textarea,
        [role='button'],
        label
        `
      );


    if (!target) {

      this.eye.dwellTarget =
        null;

      this.eye.dwellLockedTarget =
        null;


      this.cursor.style.width =
        `${this.options.cursorSize}px`;

      this.cursor.style.height =
        `${this.options.cursorSize}px`;


      return;
    }


    /*
     * Evita clicar repetidamente no mesmo elemento.
     */

    if (
      target !==
      this.eye.dwellLockedTarget
    ) {

      this.eye.dwellLockedTarget =
        null;
    }


    if (
      target ===
      this.eye.dwellLockedTarget
    ) {

      return;
    }


    if (
      target !==
      this.eye.dwellTarget
    ) {

      this.eye.dwellTarget =
        target;

      this.eye.dwellStartedAt =
        now;


      this.cursor.style.width =
        `${this.options.cursorSize}px`;

      this.cursor.style.height =
        `${this.options.cursorSize}px`;


      return;
    }


    const progress =
      Math.min(
        1,
        (
          now -
          this.eye.dwellStartedAt
        ) /
        this.options.dwellTime
      );


    const size =
      this.options.cursorSize +
      progress * 12;


    this.cursor.style.width =
      `${size}px`;

    this.cursor.style.height =
      `${size}px`;


    if (
      progress >= 1
    ) {

      this.eye.dwellLockedTarget =
        target;

      this.eye.dwellTarget =
        null;


      this.cursor.style.width =
        `${this.options.cursorSize}px`;

      this.cursor.style.height =
        `${this.options.cursorSize}px`;


      this.clickElement(
        target
      );
    }
  }

  // ============================================================
  // CLICK
  // ============================================================

  clickElement(
    element
  ) {

    const now =
      Date.now();


    if (
      now -
      this.eye.lastClick <
      700
    ) {

      return;
    }


    this.eye.lastClick =
      now;


    try {

      element.focus({
        preventScroll: true
      });

    } catch (e) {

      try {
        element.focus();
      } catch (_) {}
    }


    element.click();


    const label =
      element.innerText ||
      element.value ||
      element.getAttribute(
        "aria-label"
      ) ||
      element.tagName;


    this.setStatus(
      `clique ocular: ${String(label).trim()}`
    );
  }

  // ============================================================
  // CLICK NA POSIÇÃO DO CURSOR
  // ============================================================

  clickAtCursor() {

    const element =
      document.elementFromPoint(
        this.cursorPosition.x,
        this.cursorPosition.y
      );


    if (!element) {
      return;
    }


    const clickable =
      element.closest(
        `
        button,
        a,
        input,
        select,
        textarea,
        [role='button'],
        label
        `
      );


    if (clickable) {

      this.clickElement(
        clickable
      );
    }
  }

  // ============================================================
  // CALIBRAÇÃO
  // ============================================================

  startCalibration() {

    if (
      !this.eyeEnabled
    ) {

      this.setStatus(
        "ative a navegação por olhos antes de calibrar"
      );

      return;
    }


    if (
      this.eye.calibration.active
    ) {

      return;
    }


    this.eye.calibration.active =
      true;

    this.eye.calibration.pointIndex =
      0;

    this.eye.calibration.samples =
      [];


    this.calibration.samples =
      [];


    this.calibration.calibrated =
      false;


    this.calibrationOverlay
      .classList.add("open");


    this.setStatus(
      "calibração iniciada"
    );


    this.runCalibrationPoint();
  }

  // ============================================================
  // PONTO DA CALIBRAÇÃO
  // ============================================================

  runCalibrationPoint() {

    if (
      !this.eye.calibration.active
    ) {

      return;
    }


    const index =
      this.eye.calibration.pointIndex;


    if (
      index >=
      this.calibration.points.length
    ) {

      this.finishCalibration();

      return;
    }


    const point =
      this.calibration.points[index];


    const x =
      point.x *
      window.innerWidth;


    const y =
      point.y *
      window.innerHeight;


    this.calibrationDot.style.left =
      `${x}px`;

    this.calibrationDot.style.top =
      `${y}px`;


    this.calibrationInstruction.textContent =
      "Olhe fixamente para o ponto azul";


    this.calibrationProgress.textContent =
      `Ponto ${index + 1} de ${this.calibration.points.length}`;


    this.eye.calibration.samples =
      [];


    /*
     * Espera um pouco para o usuário
     * posicionar o olhar.
     */

    clearTimeout(
      this.eye.calibration.timer
    );


    this.eye.calibration.timer =
      setTimeout(
        () => {

          this.collectingCalibration =
            true;

          this.eye.calibration.samples =
            [];

          this.calibrationPointStart =
            Date.now();

        },

        500
      );
  }

  // ============================================================
  // COLETAR AMOSTRA
  // ============================================================

  collectCalibrationSample(
    x,
    y
  ) {

    if (
      !this.eye.calibration.active
    ) {

      return;
    }


    if (
      !this.collectingCalibration
    ) {

      return;
    }


    this.eye.calibration.samples.push({
      x,
      y
    });


    if (
      this.eye.calibration.samples.length >=
      this.options.calibrationSamples
    ) {

      this.collectingCalibration =
        false;


      this.processCalibrationPoint();
    }
  }

  // ============================================================
  // PROCESSAR PONTO
  // ============================================================

  processCalibrationPoint() {

    const samples =
      this.eye.calibration.samples;


    if (
      !samples.length
    ) {

      this.eye.calibration.pointIndex++;

      this.runCalibrationPoint();

      return;
    }


    /*
     * Remove valores extremos antes de calcular
     * a média.
     */

    const xs =
      samples
        .map(
          sample => sample.x
        )
        .sort(
          (a, b) => a - b
        );


    const ys =
      samples
        .map(
          sample => sample.y
        )
        .sort(
          (a, b) => a - b
        );


    const trim =
      Math.floor(
        samples.length * 0.15
      );


    const filteredX =
      xs.slice(
        trim,
        xs.length - trim
      );


    const filteredY =
      ys.slice(
        trim,
        ys.length - trim
      );


    const avgX =
      filteredX.reduce(
        (sum, value) =>
          sum + value,
        0
      ) /
      Math.max(
        filteredX.length,
        1
      );


    const avgY =
      filteredY.reduce(
        (sum, value) =>
          sum + value,
        0
      ) /
      Math.max(
        filteredY.length,
        1
      );


    this.calibration.samples.push({

      target:
        this.calibration.points[
          this.eye.calibration.pointIndex
        ],

      gaze: {
        x: avgX,
        y: avgY
      }
    });


    this.eye.calibration.pointIndex++;


    setTimeout(
      () => this.runCalibrationPoint(),
      300
    );
  }

  // ============================================================
  // FINALIZAR CALIBRAÇÃO
  // ============================================================

  finishCalibration() {

    this.eye.calibration.active =
      false;

    this.collectingCalibration =
      false;


    clearTimeout(
      this.eye.calibration.timer
    );


    const samples =
      this.calibration.samples;


    if (
      samples.length < 5
    ) {

      this.calibrationOverlay
        .classList.remove("open");


      this.setStatus(
        "calibração insuficiente — tente novamente"
      );


      return;
    }


    /*
     * Descobre os extremos observados.
     */

    const xs =
      samples.map(
        item =>
          item.gaze.x
      );


    const ys =
      samples.map(
        item =>
          item.gaze.y
      );


    let minX =
      Math.min(...xs);


    let maxX =
      Math.max(...xs);


    let minY =
      Math.min(...ys);


    let maxY =
      Math.max(...ys);


    /*
     * Adicionamos uma pequena margem para não
     * deixar o cursor preso nas bordas.
     */

    const paddingX =
      Math.max(
        0.02,
        (maxX - minX) * 0.08
      );


    const paddingY =
      Math.max(
        0.02,
        (maxY - minY) * 0.08
      );


    minX -= paddingX;
    maxX += paddingX;

    minY -= paddingY;
    maxY += paddingY;


    this.calibration.minX =
      Math.max(
        0,
        minX
      );


    this.calibration.maxX =
      Math.min(
        1,
        maxX
      );


    this.calibration.minY =
      Math.max(
        0,
        minY
      );


    this.calibration.maxY =
      Math.min(
        1,
        maxY
      );


    /*
     * Segurança contra calibração degenerada.
     */

    if (
      this.calibration.maxX -
      this.calibration.minX <
      0.08
    ) {

      this.calibration.minX =
        0.15;

      this.calibration.maxX =
        0.85;
    }


    if (
      this.calibration.maxY -
      this.calibration.minY <
      0.08
    ) {

      this.calibration.minY =
        0.15;

      this.calibration.maxY =
        0.85;
    }


    this.calibration.calibrated =
      true;


    this.calibrationOverlay
      .classList.remove("open");


    this.setStatus(
      "calibração concluída — navegação ocular pronta"
    );
  }

  // ============================================================
  // CANCELAR CALIBRAÇÃO
  // ============================================================

  cancelCalibration() {

    this.eye.calibration.active =
      false;

    this.collectingCalibration =
      false;


    clearTimeout(
      this.eye.calibration.timer
    );


    this.calibrationOverlay
      .classList.remove("open");


    this.setStatus(
      "calibração cancelada"
    );
  }

  // ============================================================
  // NAVEGAÇÃO POR VOZ
  // ============================================================

  async toggleVoice() {

    if (
      this.voiceEnabled
    ) {

      this.stopVoice();

      return;
    }


    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;


    if (
      !SpeechRecognition
    ) {

      this.setStatus(
        "reconhecimento de voz não disponível neste Chrome"
      );

      return;
    }


    if (
      !window.isSecureContext
    ) {

      this.setStatus(
        "o microfone exige HTTPS ou localhost"
      );

      return;
    }


    this.recognition =
      new SpeechRecognition();


    const recognition =
      this.recognition;


    recognition.lang =
      "pt-BR";


    recognition.continuous =
      true;


    recognition.interimResults =
      false;


    recognition.maxAlternatives =
      3;


    // ========================================================
    // RESULTADO
    // ========================================================

    recognition.onresult =
      (event) => {

        for (
          let i =
            event.resultIndex;
          i <
            event.results.length;
          i++
        ) {

          if (
            !event.results[i].isFinal
          ) {

            continue;
          }


          const transcript =
            event.results[i][0]
              .transcript
              .trim();


          if (
            !transcript
          ) {

            continue;
          }


          this.setStatus(
            `voz: "${transcript}"`
          );


          this.executeVoiceCommand(
            transcript
          );
        }
      };


    // ========================================================
    // ERRO
    // ========================================================

    recognition.onerror =
      (event) => {

        console.warn(
          "SpeechRecognition:",
          event.error
        );


        switch (
          event.error
        ) {

          case "not-allowed":

            this.voiceEnabled =
              false;

            this.panel
              .querySelector(
                "#a11y-voice-toggle"
              )
              .textContent =
              "Ativar";


            this.setStatus(
              "permissão do microfone negada"
            );

            break;


          case "service-not-allowed":

            this.voiceEnabled =
              false;

            this.panel
              .querySelector(
                "#a11y-voice-toggle"
              )
              .textContent =
              "Ativar";


            this.setStatus(
              "serviço de reconhecimento de voz não permitido"
            );

            break;


          case "audio-capture":

            this.voiceEnabled =
              false;

            this.panel
              .querySelector(
                "#a11y-voice-toggle"
              )
              .textContent =
              "Ativar";


            this.setStatus(
              "não foi possível acessar o microfone"
            );

            break;


          case "no-speech":

            this.setStatus(
              "nenhuma fala detectada"
            );

            break;


          case "network":

            this.setStatus(
              "erro de rede no reconhecimento de voz"
            );

            break;


          case "aborted":

            break;


          default:

            this.setStatus(
              `erro de voz: ${event.error}`
            );
        }
      };


    // ========================================================
    // FIM DA SESSÃO
    // ========================================================

    recognition.onend =
      () => {

        if (
          !this.voiceEnabled ||
          this.recognition !==
            recognition
        ) {

          return;
        }


        clearTimeout(
          this.voiceRestartTimer
        );


        this.voiceRestartTimer =
          setTimeout(
            () => {

              if (
                !this.voiceEnabled ||
                this.recognition !==
                  recognition
              ) {

                return;
              }


              try {

                recognition.start();

              } catch (error) {

                /*
                 * Chrome pode lançar InvalidStateError
                 * quando start() é chamado enquanto
                 * o reconhecimento ainda está encerrando.
                 */

                console.warn(
                  "Não foi possível reiniciar:",
                  error
                );
              }

            },

            500
          );
      };


    // ========================================================
    // START
    // ========================================================

    try {

      this.voiceEnabled =
        true;


      recognition.start();


      this.panel
        .querySelector(
          "#a11y-voice-toggle"
        )
        .textContent =
        "Desativar";


      this.setStatus(
        "escutando comandos de voz..."
      );

    } catch (error) {

      console.error(
        "Erro ao iniciar voz:",
        error
      );


      this.voiceEnabled =
        false;


      this.panel
        .querySelector(
          "#a11y-voice-toggle"
        )
        .textContent =
        "Ativar";


      this.setStatus(
        "não foi possível iniciar o reconhecimento de voz"
      );
    }
  }

  // ============================================================
  // PARAR VOZ
  // ============================================================

  stopVoice() {

    this.voiceEnabled =
      false;


    clearTimeout(
      this.voiceRestartTimer
    );


    this.voiceRestartTimer =
      null;


    if (
      this.recognition
    ) {

      try {

        this.recognition.onend =
          null;

        this.recognition.stop();

      } catch (error) {

        console.warn(error);
      }


      this.recognition =
        null;
    }


    const button =
      this.panel?.querySelector(
        "#a11y-voice-toggle"
      );


    if (button) {

      button.textContent =
        "Ativar";
    }


    this.setStatus(
      "navegação por voz desativada"
    );
  }

  // ============================================================
  // EXECUTAR COMANDO DE VOZ
  // ============================================================

  executeVoiceCommand(
    command
  ) {

    const text =
      this.normalizeText(
        command
      );


    // --------------------------------------------------------
    // CLICAR
    // --------------------------------------------------------

    if (
      text.startsWith(
        "clicar em "
      ) ||
      text.startsWith(
        "clique em "
      )
    ) {

      const targetName =
        text.replace(
          /^cli(?:car|que) em /,
          ""
        ).trim();


      this.clickByText(
        targetName
      );


      return;
    }


    // --------------------------------------------------------
    // PREENCHER
    // --------------------------------------------------------

    if (
      text.startsWith(
        "preencher "
      )
    ) {

      this.fillFieldByVoice(
        command.trim()
      );


      return;
    }


    // --------------------------------------------------------
    // ROLAR PARA BAIXO
    // --------------------------------------------------------

    if (
      text.includes(
        "rolar para baixo"
      ) ||
      text.includes(
        "descer"
      ) ||
      text ===
        "baixo"
    ) {

      window.scrollBy({

        top:
          window.innerHeight *
          0.75,

        behavior:
          "smooth"
      });


      this.setStatus(
        "rolando para baixo"
      );


      return;
    }


    // --------------------------------------------------------
    // ROLAR PARA CIMA
    // --------------------------------------------------------

    if (
      text.includes(
        "rolar para cima"
      ) ||
      text.includes(
        "subir"
      ) ||
      text ===
        "cima"
    ) {

      window.scrollBy({

        top:
          -window.innerHeight *
          0.75,

        behavior:
          "smooth"
      });


      this.setStatus(
        "rolando para cima"
      );


      return;
    }


    // --------------------------------------------------------
    // VOLTAR
    // --------------------------------------------------------

    if (
      text ===
      "voltar"
    ) {

      history.back();


      this.setStatus(
        "voltando"
      );


      return;
    }


    // --------------------------------------------------------
    // TOPO
    // --------------------------------------------------------

    if (
      text ===
        "ir para o topo" ||
      text ===
        "voltar ao topo" ||
      text ===
        "topo"
    ) {

      window.scrollTo({

        top: 0,

        behavior:
          "smooth"
      });


      this.setStatus(
        "voltando ao topo"
      );


      return;
    }


    // --------------------------------------------------------
    // PARAR VOZ
    // --------------------------------------------------------

    if (
      text ===
        "parar voz" ||
      text ===
        "parar reconhecimento"
    ) {

      this.stopVoice();


      return;
    }


    this.setStatus(
      `comando não reconhecido: "${command}"`
    );
  }

  // ============================================================
  // NORMALIZAR TEXTO
  // ============================================================

  normalizeText(
    text
  ) {

    return String(text)

      .toLowerCase()

      .normalize("NFD")

      .replace(
        /[\u0300-\u036f]/g,
        ""
      )

      .replace(
        /\s+/g,
        " "
      )

      .trim();
  }

  // ============================================================
  // CLICAR POR TEXTO
  // ============================================================

  clickByText(
    targetName
  ) {

    const normalizedTarget =
      this.normalizeText(
        targetName
      );


    const candidates = [

      ...document.querySelectorAll(
        `
        button,
        a,
        [role='button'],
        input[type='submit'],
        input[type='button']
        `
      )
    ];


    const target =
      candidates.find(
        el => {

          const label =
            this.normalizeText(

              el.innerText ||

              el.value ||

              el.getAttribute(
                "aria-label"
              ) ||

              el.getAttribute(
                "title"
              ) ||

              ""
            );


          return (
            label ===
              normalizedTarget ||

            label.includes(
              normalizedTarget
            )
          );
        }
      );


    if (target) {

      try {

        target.focus({
          preventScroll:
            true
        });

      } catch (_) {}


      target.click();


      this.setStatus(
        `clicou em "${targetName}"`
      );

    } else {

      this.setStatus(
        `não encontrei "${targetName}"`
      );
    }
  }

  // ============================================================
  // PREENCHER CAMPO
  // ============================================================

  fillFieldByVoice(
    text
  ) {

    /*
     * Exemplo:
     *
     * preencher nome com Lucas Gabriel
     */

    const match =
      text.match(
        /^preencher (.+?) com (.+)$/i
      );


    if (!match) {

      this.setStatus(
        "use: preencher [campo] com [valor]"
      );


      return;
    }


    const fieldName =
      this.normalizeText(
        match[1].trim()
      );


    const value =
      match[2].trim();


    const fields = [

      ...document.querySelectorAll(
        "input, textarea, select"
      )

    ];


    const field =
      fields.find(
        el => {

          const label =
            this.getFieldLabel(
              el
            );


          return label.includes(
            fieldName
          );
        }
      );


    if (!field) {

      this.setStatus(
        `campo "${fieldName}" não encontrado`
      );


      return;
    }


    // --------------------------------------------------------
    // SELECT
    // --------------------------------------------------------

    if (
      field.tagName ===
      "SELECT"
    ) {

      const normalizedValue =
        this.normalizeText(
          value
        );


      const option =
        [
          ...field.options
        ].find(
          option =>
            this.normalizeText(
              option.textContent
            ).includes(
              normalizedValue
            )
        );


      if (!option) {

        this.setStatus(
          `opção "${value}" não encontrada`
        );


        return;
      }


      field.value =
        option.value;


      field.dispatchEvent(
        new Event(
          "input",
          {
            bubbles:
              true
          }
        )
      );


      field.dispatchEvent(
        new Event(
          "change",
          {
            bubbles:
              true
          }
        )
      );

    } else {

      // ------------------------------------------------------
      // INPUT / TEXTAREA
      // ------------------------------------------------------

      const prototype =
        field instanceof
        HTMLTextAreaElement

          ? HTMLTextAreaElement.prototype

          : HTMLInputElement.prototype;


      const setter =
        Object.getOwnPropertyDescriptor(
          prototype,
          "value"
        )?.set;


      if (setter) {

        setter.call(
          field,
          value
        );

      } else {

        field.value =
          value;
      }


      field.dispatchEvent(
        new Event(
          "input",
          {
            bubbles:
              true
          }
        )
      );


      field.dispatchEvent(
        new Event(
          "change",
          {
            bubbles:
              true
          }
        )
      );
    }


    try {

      field.focus({
        preventScroll:
          true
      });

    } catch (_) {

      field.focus();
    }


    this.setStatus(
      `preenchido: ${fieldName}`
    );
  }

  // ============================================================
  // IDENTIFICAR LABEL DO CAMPO
  // ============================================================

  getFieldLabel(
    field
  ) {

    if (
      field.labels?.length
    ) {

      return this.normalizeText(
        field.labels[0].innerText
      );
    }


    /*
     * Procura também um label associado
     * pelo atributo for.
     */

    if (field.id) {

      const label =
        document.querySelector(
          `label[for="${CSS.escape(field.id)}"]`
        );


      if (label) {

        return this.normalizeText(
          label.innerText
        );
      }
    }


    return this.normalizeText(

      [

        field.name,

        field.id,

        field.placeholder,

        field.getAttribute(
          "aria-label"
        ),

        field.getAttribute(
          "title"
        )

      ]

        .filter(Boolean)

        .join(" ")
    );
  }
}


// ============================================================
// INICIALIZAÇÃO AUTOMÁTICA
// ============================================================

document.addEventListener(
  "DOMContentLoaded",
  () => {

    /*
     * Evita criar duas instâncias caso
     * o script seja carregado duas vezes.
     */

    if (
      window.accessibilityMVP
    ) {

      return;
    }


    window.accessibilityMVP =
      new AccessibilityMVP();


    window.accessibilityMVP.init();
  }
);