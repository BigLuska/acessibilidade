class AccessibilityMVP {
  constructor(options = {}) {
    this.options = {
      cursorSize: 28,
      cursorSpeed: 12,
      blinkClickCount: 2,
      ...options
    };

    this.voiceEnabled = false;
    this.eyeEnabled = false;
    this.recognition = null;
    this.video = null;
    this.canvas = null;
    this.cursor = null;
    this.stream = null;

    this.eye = {
      lastX: null,
      lastY: null,
      lastMove: 0,
      blinkTimes: [],
      lastBlink: 0
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
        position:fixed; right:20px; bottom:20px; z-index:2147483647;
        width:58px; height:58px; border-radius:50%; border:0;
        background:#1455d9; color:#fff; font-size:25px; cursor:pointer;
        box-shadow:0 4px 18px #0005;
      }
      #a11y-mvp-panel {
        position:fixed; right:20px; bottom:88px; z-index:2147483646;
        width:310px; max-width:calc(100vw - 40px); padding:18px;
        background:#fff; color:#111; border:1px solid #ccc; border-radius:14px;
        box-shadow:0 8px 30px #0003; display:none;
        font:14px Arial,sans-serif;
      }
      #a11y-mvp-panel.open { display:block; }
      #a11y-mvp-panel h2 { margin:0 0 14px; font-size:19px; }
      .a11y-row { display:flex; align-items:center; justify-content:space-between;
        gap:10px; padding:12px 0; border-top:1px solid #eee; }
      .a11y-row button { padding:8px 12px; cursor:pointer; }
      #a11y-status { font-size:12px; color:#555; margin-top:12px; }
      #a11y-eye-cursor {
        position:fixed; z-index:2147483645; width:28px; height:28px;
        border:3px solid #1455d9; border-radius:50%; pointer-events:none;
        transform:translate(-50%,-50%); display:none;
        box-sizing:border-box; background:#fff8;
      }
      #a11y-eye-preview {
        position:fixed; left:10px; bottom:10px; z-index:2147483644;
        width:180px; height:135px; object-fit:cover; border-radius:10px;
        border:2px solid #1455d9; display:none; background:#000;
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
          <small>Olhe para mover o cursor; duas piscadas clicam.</small>
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

      <div id="a11y-status">Status: pronto</div>
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
      this.panel.classList.toggle("open");
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

    try {
      this.setStatus("solicitando permissão da câmera...");
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });

      this.preview.srcObject = this.stream;
      this.preview.style.display = "block";
      this.cursor.style.display = "block";
      this.eyeEnabled = true;

      this.panel.querySelector("#a11y-eye-toggle").textContent = "Desativar";
      this.setStatus("câmera ativa — MVP aguardando rastreamento");

      /*
       * IMPORTANTE:
       * A câmera sozinha não fornece coordenadas dos olhos.
       * Para transformar isso em navegação real, conecte aqui
       * um modelo de face/eye tracking (MediaPipe, TF.js etc.).
       *
       * Este MVP já deixa a câmera, cursor e ciclo de ativação prontos.
       */
      this.startDemoCursor();
    } catch (error) {
      this.setStatus("permissão da câmera negada ou indisponível");
      console.error(error);
    }
  }

  stopEyes() {
    this.eyeEnabled = false;
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.preview.srcObject = null;
    this.preview.style.display = "none";
    this.cursor.style.display = "none";
    this.panel.querySelector("#a11y-eye-toggle").textContent = "Ativar";
    this.setStatus("navegação por olhos desativada");
  }

  startDemoCursor() {
    /*
     * Demonstração temporária:
     * move o cursor suavemente usando o mouse.
     * Substitua este bloco pelo resultado X/Y do eye tracker.
     */
    const move = (event) => {
      if (!this.eyeEnabled) return;
      this.cursorPosition.x = event.clientX;
      this.cursorPosition.y = event.clientY;
      this.updateCursor();
    };

    window.addEventListener("mousemove", move);

    this._removeDemoMouse = () => {
      window.removeEventListener("mousemove", move);
    };
  }

  async toggleVoice() {
    if (this.voiceEnabled) {
      this.stopVoice();
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      this.setStatus("reconhecimento de voz não suportado neste navegador");
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.lang = "pt-BR";
    this.recognition.continuous = true;
    this.recognition.interimResults = false;

    this.recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1][0].transcript.trim();
      this.setStatus(`voz: "${result}"`);
      this.executeVoiceCommand(result);
    };

    this.recognition.onerror = (event) => {
      console.warn("SpeechRecognition:", event.error);
      if (event.error !== "aborted") {
        this.setStatus(`erro de voz: ${event.error}`);
      }
    };

    this.recognition.onend = () => {
      if (this.voiceEnabled) {
        try { this.recognition.start(); } catch (_) {}
      }
    };

    try {
      this.voiceEnabled = true;
      this.recognition.start();
      this.panel.querySelector("#a11y-voice-toggle").textContent = "Desativar";
      this.setStatus("escutando comandos...");
    } catch (error) {
      this.voiceEnabled = false;
      this.setStatus("não foi possível iniciar o reconhecimento");
    }
  }

  stopVoice() {
    this.voiceEnabled = false;
    if (this.recognition) {
      this.recognition.stop();
      this.recognition = null;
    }
    this.panel.querySelector("#a11y-voice-toggle").textContent = "Ativar";
    this.setStatus("navegação por voz desativada");
  }

  executeVoiceCommand(command) {
    const text = command
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    if (text.startsWith("clicar em ") || text.startsWith("clique em ")) {
      const targetName = text.replace(/^clique? em /, "").trim();
      this.clickByText(targetName);
      return;
    }

    if (text.startsWith("preencher ")) {
      this.fillFieldByVoice(text);
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

  clickByText(targetName) {
    const candidates = [
      ...document.querySelectorAll("button, a, [role='button'], input[type='submit']")
    ];

    const target = candidates.find(el => {
      const label = (el.innerText || el.value || el.getAttribute("aria-label") || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();

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

    const fieldName = match[1].trim();
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
      const option = [...field.options].find(o =>
        o.textContent.toLowerCase().includes(value)
      );
      if (option) field.value = option.value;
    } else {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype, "value"
      )?.set || Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype, "value"
      )?.set;

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
      return field.labels[0].innerText.toLowerCase();
    }

    return [
      field.name,
      field.id,
      field.placeholder,
      field.getAttribute("aria-label")
    ].filter(Boolean).join(" ").toLowerCase();
  }

  /*
   * API pública para o futuro eye tracker:
   *
   * Quando seu modelo entregar uma posição normalizada,
   * chame:
   *
   * accessibility.updateEyePosition(x, y)
   *
   * onde x e y ficam entre 0 e 1.
   */
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