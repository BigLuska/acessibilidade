class AccessibilityMVP {
  constructor(options = {}) {
    this.options = {
      cursorSize: 28,
      cursorSpeed: 18,
      blinkClickCount: 2,
      dwellTime: 1200,
      ...options
    };

    this.voiceEnabled = false;
    this.eyeEnabled = false;
    this.recognition = null;
    this.video = null;
    this.canvas = null;
    this.cursor = null;
    this.stream = null;
    this.faceLandmarker = null;
    this.eyeLoopId = null;

    this.eye = {
      lastX: null,
      lastY: null,
      lastMove: 0,
      blinkTimes: [],
      lastBlink: 0,
      gazeX: null,
      gazeY: null,
      dwellTarget: null,
      dwellStartedAt: 0,
      dwellLockedTarget: null,
      lastFaceStatus: 0
    };

    this.cursorPosition = {
      x: Math.max(30, window.innerWidth / 2),
      y: Math.max(30, window.innerHeight / 2)
    };
  }

  init() {
    this.injectStyles();
    this.createUI();
    this.bindUI();
    this.updateCursor();
  }

  injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
      #a11y-mvp-button {
        position:fixed; right:max(12px, env(safe-area-inset-right));
        bottom:max(12px, env(safe-area-inset-bottom)); z-index:2147483647;
        width:56px; height:56px; border-radius:50%; border:0;
        background:#1455d9; color:#fff; font-size:25px; cursor:pointer;
        box-shadow:0 4px 18px #0005;
      }
      #a11y-mvp-panel {
        position:fixed; right:max(12px, env(safe-area-inset-right));
        bottom:calc(max(12px, env(safe-area-inset-bottom)) + 68px);
        z-index:2147483646; width:min(310px, calc(100vw - 24px)); padding:16px;
        background:#fff; color:#111; border:1px solid #ccc; border-radius:14px;
        box-shadow:0 8px 30px #0003; display:none;
        font:14px Arial,sans-serif;
      }
      #a11y-mvp-panel.open { display:block; }
      #a11y-mvp-panel h2 { margin:0 0 14px; font-size:19px; }
      .a11y-row { display:flex; align-items:center; justify-content:space-between;
        gap:10px; padding:12px 0; border-top:1px solid #eee; }
      .a11y-row button { padding:10px 12px; min-height:44px; cursor:pointer; }
      #a11y-status { font-size:12px; color:#444; margin-top:12px; }
      #a11y-eye-cursor {
        position:fixed; z-index:2147483645; width:28px; height:28px;
        border:3px solid #1455d9; border-radius:50%; pointer-events:none;
        transform:translate(-50%,-50%); display:none;
        box-sizing:border-box; background:#fff8; transition:width .12s, height .12s;
      }
      #a11y-eye-preview {
        position:fixed; left:10px; bottom:10px; z-index:2147483644;
        width:180px; height:135px; object-fit:cover; border-radius:10px;
        border:2px solid #1455d9; display:none; background:#000;
        transform:scaleX(-1);
      }
      @media (max-width:600px) {
        #a11y-eye-preview {
          left:auto; right:max(8px, env(safe-area-inset-right));
          top:max(8px, env(safe-area-inset-top)); bottom:auto;
          width:104px; height:78px; border-radius:8px;
        }
        #a11y-mvp-panel {
          padding:14px; max-height:70vh; max-height:min(70dvh, 520px); overflow:auto;
        }
        .a11y-row { gap:8px; }
        .a11y-row button { flex:0 0 auto; }
      }
    `;
    document.head.appendChild(style);
  }

  createUI() {
    this.button = document.createElement("button");
    this.button.id = "a11y-mvp-button";
    this.button.type = "button";
    this.button.setAttribute("aria-label", "Abrir acessibilidade");
    this.button.textContent = "♿";

    this.panel = document.createElement("div");
    this.panel.id = "a11y-mvp-panel";
    this.panel.setAttribute("role", "dialog");
    this.panel.setAttribute("aria-label", "Recursos de acessibilidade");

    this.panel.innerHTML = `
      <h2>Acessibilidade MVP</h2>

      <div class="a11y-row">
        <div>
          <strong>Navegação por olhos</strong><br>
          <small>Mova os olhos e mantenha o olhar sobre um item para clicar.</small>
        </div>
        <button id="a11y-eye-toggle" type="button">Ativar</button>
      </div>

      <div class="a11y-row">
        <div>
          <strong>Navegação por voz</strong><br>
          <small>Comandos como "clicar em Comprar" e "preencher nome".</small>
        </div>
        <button id="a11y-voice-toggle" type="button">Ativar</button>
      </div>

      <div id="a11y-status" role="status" aria-live="polite">Status: pronto</div>
    `;

    this.cursor = document.createElement("div");
    this.cursor.id = "a11y-eye-cursor";

    this.preview = document.createElement("video");
    this.preview.id = "a11y-eye-preview";
    this.preview.autoplay = true;
    this.preview.muted = true;
    this.preview.playsInline = true;

    document.body.append(this.button, this.panel, this.cursor, this.preview);
  }

  bindUI() {
    this.button.addEventListener("click", () => {
      const isOpen = this.panel.classList.toggle("open");
      this.button.setAttribute("aria-expanded", String(isOpen));
    });

    this.panel.querySelector("#a11y-eye-toggle")
      .addEventListener("click", () => this.toggleEyes());

    this.panel.querySelector("#a11y-voice-toggle")
      .addEventListener("click", () => this.toggleVoice());

    window.addEventListener("resize", () => {
      this.cursorPosition.x = Math.min(this.cursorPosition.x, window.innerWidth);
      this.cursorPosition.y = Math.min(this.cursorPosition.y, window.innerHeight);
      this.updateCursor();
    });
  }

  setStatus(message) {
    const el = this.panel.querySelector("#a11y-status");
    if (el) el.textContent = "Status: " + message;
  }

  updateCursor() {
    if (!this.cursor) return;
    this.cursor.style.left = `${this.cursorPosition.x}px`;
    this.cursor.style.top = `${this.cursorPosition.y}px`;
  }

  async toggleEyes() {
    if (this.eyeEnabled) {
      this.stopEyes();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      this.setStatus("este navegador não permite acesso à câmera");
      return;
    }
    if (!window.isSecureContext) {
      this.setStatus("a câmera exige HTTPS ou localhost");
      return;
    }

    try {
      this.setStatus("solicitando permissão da câmera...");
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30, max: 30 }
        },
        audio: false
      });

      this.preview.srcObject = this.stream;
      this.preview.style.display = "block";
      await this.preview.play();
      this.setStatus("carregando rastreamento ocular...");
      const vision = await import(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14"
      );
      const fileset = await vision.FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
      );
      this.faceLandmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
        },
        runningMode: "VIDEO",
        numFaces: 1
      });

      this.preview.style.display = "block";
      this.cursor.style.display = "block";
      this.eyeEnabled = true;
      this.panel.querySelector("#a11y-eye-toggle").textContent = "Desativar";
      this.setStatus("rastreamento ativo — mantenha o olhar sobre um item para clicar");
      this.startEyeTracking();
    } catch (error) {
      console.error(error);
      this.stopEyes();
      this.setStatus(error.name === "NotAllowedError"
        ? "permissão da câmera negada"
        : "falha ao iniciar rastreamento; verifique câmera e rede");
    }
  }

  stopEyes() {
    this.eyeEnabled = false;
    if (this.eyeLoopId !== null) {
      cancelAnimationFrame(this.eyeLoopId);
      this.eyeLoopId = null;
    }
    if (this.faceLandmarker) {
      this.faceLandmarker.close();
      this.faceLandmarker = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.preview.srcObject = null;
    this.preview.style.display = "none";
    this.cursor.style.display = "none";
    this.eye.dwellTarget = null;
    this.eye.dwellLockedTarget = null;
    this.panel.querySelector("#a11y-eye-toggle").textContent = "Ativar";
    this.setStatus("navegação por olhos desativada");
  }

  startEyeTracking() {
    let lastDetection = 0;
    const track = (now) => {
      if (!this.eyeEnabled || !this.faceLandmarker) return;
      this.eyeLoopId = requestAnimationFrame(track);

      if (now - lastDetection < 33 || this.preview.readyState < 2) return;
      lastDetection = now;

      const result = this.faceLandmarker.detectForVideo(this.preview, now);
      const landmarks = result.faceLandmarks?.[0];
      if (!landmarks || landmarks.length < 478) {
        if (now - this.eye.lastFaceStatus > 2000) {
          this.setStatus("rosto não detectado — centralize o rosto na câmera");
          this.eye.lastFaceStatus = now;
        }
        this.eye.dwellTarget = null;
        this.cursor.style.width = "28px";
        this.cursor.style.height = "28px";
        return;
      }

      const gaze = this.getGazePosition(landmarks);
      if (this.eye.gazeX === null) {
        this.eye.gazeX = gaze.x;
        this.eye.gazeY = gaze.y;
      } else {
        this.eye.gazeX += (gaze.x - this.eye.gazeX) * 0.28;
        this.eye.gazeY += (gaze.y - this.eye.gazeY) * 0.28;
      }

      this.updateEyePosition(this.eye.gazeX, this.eye.gazeY);
      this.updateDwellClick(now);
    };

    this.eyeLoopId = requestAnimationFrame(track);
  }

  getGazePosition(landmarks) {
    const eyes = [
      { iris: 468, corners: [33, 133], lids: [159, 145] },
      { iris: 473, corners: [362, 263], lids: [386, 374] }
    ];
    const positions = eyes.map(({ iris, corners, lids }) => {
      const irisPoint = landmarks[iris];
      const cornerPoints = corners.map(index => landmarks[index]);
      const lidPoints = lids.map(index => landmarks[index]);
      const left = Math.min(cornerPoints[0].x, cornerPoints[1].x);
      const right = Math.max(cornerPoints[0].x, cornerPoints[1].x);
      const top = Math.min(lidPoints[0].y, lidPoints[1].y);
      const bottom = Math.max(lidPoints[0].y, lidPoints[1].y);

      return {
        x: 1 - (irisPoint.x - left) / Math.max(right - left, 0.001),
        y: (irisPoint.y - top) / Math.max(bottom - top, 0.001)
      };
    });

    return {
      x: Math.max(0, Math.min(1, (positions[0].x + positions[1].x) / 2)),
      y: Math.max(0, Math.min(1, (positions[0].y + positions[1].y) / 2))
    };
  }

  updateDwellClick(now) {
    const element = document.elementFromPoint(
      this.cursorPosition.x,
      this.cursorPosition.y
    );
    const target = element?.closest(
      "button, a, input, select, textarea, [role='button'], label"
    );

    if (!target) {
      this.eye.dwellTarget = null;
      this.eye.dwellLockedTarget = null;
      this.cursor.style.width = "28px";
      this.cursor.style.height = "28px";
      return;
    }
    if (target !== this.eye.dwellLockedTarget) {
      this.eye.dwellLockedTarget = null;
    }
    if (target === this.eye.dwellLockedTarget) return;
    if (target !== this.eye.dwellTarget) {
      this.eye.dwellTarget = target;
      this.eye.dwellStartedAt = now;
      return;
    }

    const progress = Math.min(
      1,
      (now - this.eye.dwellStartedAt) / this.options.dwellTime
    );
    const size = 28 + progress * 12;
    this.cursor.style.width = `${size}px`;
    this.cursor.style.height = `${size}px`;

    if (progress >= 1) {
      this.eye.dwellLockedTarget = target;
      this.eye.dwellTarget = null;
      this.cursor.style.width = "28px";
      this.cursor.style.height = "28px";
      this.clickAtCursor();
    }
  }

  async toggleVoice() {
    if (this.voiceEnabled) {
      this.stopVoice();
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      this.setStatus("voz indisponível neste navegador; tente Chrome ou Edge");
      return;
    }
    if (!window.isSecureContext) {
      this.setStatus("o microfone exige HTTPS ou localhost");
      return;
    }

    this.recognition = new SpeechRecognition();
    const recognition = this.recognition;
    recognition.lang = "pt-BR";
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1][0].transcript.trim();
      this.setStatus(`voz: "${result}"`);
      this.executeVoiceCommand(result);
    };

    recognition.onerror = (event) => {
      console.warn("SpeechRecognition:", event.error);
      if (event.error !== "aborted") {
        this.setStatus(`erro de voz: ${event.error}`);
      }
      if (["not-allowed", "service-not-allowed", "audio-capture"].includes(event.error)) {
        this.voiceEnabled = false;
        this.panel.querySelector("#a11y-voice-toggle").textContent = "Ativar";
      }
    };

    recognition.onend = () => {
      if (!this.voiceEnabled || this.recognition !== recognition) return;
      this.voiceRestartTimer = setTimeout(() => {
        if (!this.voiceEnabled || this.recognition !== recognition) return;
        try {
          recognition.start();
        } catch (error) {
          this.setStatus("não foi possível reiniciar o microfone");
        }
      }, 300);
    };

    try {
      this.voiceEnabled = true;
      recognition.start();
      this.panel.querySelector("#a11y-voice-toggle").textContent = "Desativar";
      this.setStatus("escutando comandos...");
    } catch (error) {
      this.voiceEnabled = false;
      this.setStatus("não foi possível iniciar o reconhecimento");
    }
  }

  stopVoice() {
    this.voiceEnabled = false;
    clearTimeout(this.voiceRestartTimer);
    this.voiceRestartTimer = null;
    if (this.recognition) {
      this.recognition.stop();
      this.recognition = null;
    }
    this.panel.querySelector("#a11y-voice-toggle").textContent = "Ativar";
    this.setStatus("navegação por voz desativada");
  }

  executeVoiceCommand(command) {
    const text = this.normalizeText(command);

    if (text.startsWith("clicar em ") || text.startsWith("clique em ")) {
      const targetName = text.replace(/^cli(?:car|que) em /, "").trim();
      this.clickByText(targetName);
      return;
    }

    if (text.startsWith("preencher ")) {
      this.fillFieldByVoice(command.trim());
      return;
    }

    if (text.includes("rolar para baixo") || text.includes("descer")) {
      window.scrollBy({ top: window.innerHeight * 0.75, behavior: "smooth" });
      return;
    }

    if (text.includes("rolar para cima") || text.includes("subir")) {
      window.scrollBy({ top: -window.innerHeight * 0.75, behavior: "smooth" });
      return;
    }

    if (text === "voltar") {
      history.back();
      return;
    }

    if (text === "ir para o topo" || text === "voltar ao topo") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  normalizeText(text) {
    return String(text)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  clickByText(targetName) {
    const candidates = [
      ...document.querySelectorAll("button, a, [role='button'], input[type='submit']")
    ];

    const target = candidates.find(el => {
      const label = this.normalizeText(
        el.innerText || el.value || el.getAttribute("aria-label") || ""
      ).trim();

      return label === targetName || label.includes(targetName);
    });

    if (target) {
      target.focus();
      target.click();
      this.setStatus(`clicou em "${targetName}"`);
    } else {
      this.setStatus(`não encontrei "${targetName}"`);
    }
  }

  fillFieldByVoice(text) {
    // Exemplo: "preencher nome com Lucas Gabriel"
    const match = text.match(/^preencher (.+?) com (.+)$/);

    if (!match) {
      this.setStatus("use: preencher [campo] com [valor]");
      return;
    }

    const fieldName = this.normalizeText(match[1].trim());
    const value = match[2].trim();

    const fields = [...document.querySelectorAll("input, textarea, select")];

    const field = fields.find(el => {
      const label = this.getFieldLabel(el);
      return label.includes(fieldName);
    });

    if (!field) {
      this.setStatus(`campo "${fieldName}" não encontrado`);
      return;
    }

    if (field.tagName === "SELECT") {
      const normalizedValue = this.normalizeText(value);
      const option = [...field.options].find(o =>
        this.normalizeText(o.textContent).includes(normalizedValue)
      );
      if (!option) {
        this.setStatus(`opção "${value}" não encontrada`);
        return;
      }
      field.value = option.value;
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      const prototype = field instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

      if (setter) setter.call(field, value);
      else field.value = value;

      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
    }

    field.focus();
    this.setStatus(`preenchido: ${fieldName}`);
  }

  getFieldLabel(field) {
    if (field.labels?.length) {
      return this.normalizeText(field.labels[0].innerText);
    }

    return this.normalizeText([
      field.name,
      field.id,
      field.placeholder,
      field.getAttribute("aria-label")
    ].filter(Boolean).join(" "));
  }

  // Atualiza o cursor com coordenadas normalizadas fornecidas pelo rastreador.
  updateEyePosition(x, y) {
    if (!this.eyeEnabled) return;

    const deadZone = 0.04;
    const centerX = 0.5;
    const centerY = 0.5;

    const dx = Math.abs(x - centerX) > deadZone ? x - centerX : 0;
    const dy = Math.abs(y - centerY) > deadZone ? y - centerY : 0;

    this.cursorPosition.x += dx * this.options.cursorSpeed;
    this.cursorPosition.y += dy * this.options.cursorSpeed;

    this.cursorPosition.x = Math.max(
      10, Math.min(window.innerWidth - 10, this.cursorPosition.x)
    );
    this.cursorPosition.y = Math.max(
      10, Math.min(window.innerHeight - 10, this.cursorPosition.y)
    );

    this.updateCursor();
  }

  /*
   * API pública para o futuro detector de piscadas.
   * Chame registerBlink() sempre que o modelo detectar uma piscada.
   */
  registerBlink() {
    const now = Date.now();

    if (now - this.eye.lastBlink < 250) return;
    this.eye.lastBlink = now;

    this.eye.blinkTimes.push(now);
    this.eye.blinkTimes = this.eye.blinkTimes.filter(t => now - t < 900);

    if (this.eye.blinkTimes.length >= this.options.blinkClickCount) {
      this.eye.blinkTimes = [];
      this.clickAtCursor();
    }
  }

  clickAtCursor() {
    const element = document.elementFromPoint(
      this.cursorPosition.x,
      this.cursorPosition.y
    );

    if (!element) return;

    const clickable = element.closest(
      "button, a, input, select, textarea, [role='button'], label"
    );

    if (clickable) {
      clickable.focus();
      clickable.click();
      this.setStatus(`clique ocular: ${clickable.innerText || clickable.getAttribute("aria-label") || clickable.tagName}`);
    }
  }
}