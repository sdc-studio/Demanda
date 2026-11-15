
/*
 * EL BOTE DE LOS 100 KILOS
 * Colaboración con Supabase
 * Versión con alerta visual de crisis
 */

(() => {
  "use strict";

  const MESAS = ["mesa1", "mesa2", "mesa3", "mesa4"];
  const INTERVALO = 2500;

  let db;
  let codigo = null;
  let rol = null;
  let conectado = false;
  let sincronizando = false;
  let ultimaVersion = "";
  let crisisNotificada = false;
  let intervaloActivo = null;
  let timerData = null;
  let timerOffsetMs = 0;
  let finalShown = false;
  let resultDismissed = false;
  let timerTick = null;
  let timerBusy = false;

  function mostrarEstado(mensaje) {
    const elemento = document.getElementById("collab-status");
    if (elemento) elemento.textContent = mensaje;
  }

  function mensajeError(error) {
    return error?.message || String(error);
  }

  async function ejecutar(nombre, parametros = {}) {
    const { data, error } = await db.rpc(nombre, parametros);
    if (error) throw error;
    return data;
  }

  function crearPantallaAcceso() {
    if (document.getElementById("collab-panel")) return;

    const panel = document.createElement("div");
    panel.id = "collab-panel";

    panel.style.cssText = `
      position:fixed;
      inset:0;
      z-index:9999;
      background:rgba(5,10,25,.96);
      display:flex;
      align-items:center;
      justify-content:center;
      padding:20px;
      color:white;
      font-family:Arial,sans-serif;
    `;

    panel.innerHTML = `
      <div style="
        width:100%;
        max-width:440px;
        padding:30px;
        background:#1e293b;
        border:1px solid #475569;
        border-radius:18px;
      ">
        <h2 style="
          font-size:24px;
          font-weight:800;
          margin-bottom:12px;
        ">
          El Bote de los 100 Kilos
        </h2>

        <p style="color:#cbd5e1;margin-bottom:24px">
          Taller colaborativo de gestión de la demanda
        </p>

        <label>Nombre del taller</label>

        <input
          id="collab-title"
          value="Taller de Demanda"
          style="
            width:100%;
            padding:12px;
            margin:8px 0;
            color:#111;
            border-radius:8px;
          "
        >

        <button id="collab-create" style="
          width:100%;
          padding:14px;
          background:#2563eb;
          border-radius:8px;
          font-weight:bold;
          margin:8px 0;
        ">
          Crear sesión como facilitador
        </button>

        <hr style="
          border-color:#475569;
          margin:24px 0;
        ">

        <label>Código de sesión</label>

        <input
          id="collab-code"
          placeholder="Ingresá el código"
          style="
            width:100%;
            padding:12px;
            margin:8px 0;
            color:#111;
            border-radius:8px;
          "
        >

        <label>Seleccioná tu mesa</label>

        <select id="collab-team" style="
          width:100%;
          padding:12px;
          margin:8px 0;
          color:#111;
          border-radius:8px;
        ">
          <option value="mesa1">Mesa 1</option>
          <option value="mesa2">Mesa 2</option>
          <option value="mesa3">Mesa 3</option>
          <option value="mesa4">Mesa 4</option>
        </select>

        <button id="collab-join" style="
          width:100%;
          padding:14px;
          margin-top:12px;
          background:#059669;
          border-radius:8px;
          font-weight:bold;
        ">
          Ingresar al taller
        </button>

        <p id="collab-status" style="
          color:#fbbf24;
          margin-top:16px;
          font-size:13px;
        "></p>
      </div>
    `;

    document.body.appendChild(panel);

    document.getElementById("collab-create")
      .addEventListener("click", crearSesion);

    document.getElementById("collab-join")
      .addEventListener("click", ingresarSesion);
  }

  async function iniciarConexion() {
    if (!window.SUPABASE_URL || !window.SUPABASE_KEY) {
      throw new Error("Falta configurar Supabase.");
    }

    if (!window.supabase?.createClient) {
      throw new Error("No se cargó Supabase JS.");
    }

    db = window.supabase.createClient(
      window.SUPABASE_URL,
      window.SUPABASE_KEY
    );

    const { data, error } = await db.auth.getSession();

    if (error) throw error;

    if (!data.session) {
      const resultado = await db.auth.signInAnonymously();
      if (resultado.error) throw resultado.error;
    }

    crearPantallaAcceso();
  }


async function crearSesion() {
  try {
    mostrarEstado("Creando sesión...");

    const titulo = document.getElementById("collab-title").value;

    codigo = await ejecutar("mural_create", {
      p_title: titulo
    });

    rol = "facilitador";

    await comenzar();

    const ventana = document.createElement("div");
    ventana.id = "modal-codigo-sesion";

    ventana.style.cssText = `
      position:fixed;
      inset:0;
      z-index:99999;
      background:rgba(2,6,23,.92);
      display:flex;
      align-items:center;
      justify-content:center;
      padding:20px;
      font-family:Inter,Arial,sans-serif;
    `;

    ventana.innerHTML = `
      <div style="
        background:#0f172a;
        border:1px solid #475569;
        border-radius:20px;
        padding:32px;
        width:100%;
        max-width:420px;
        color:white;
        text-align:center;
        box-shadow:0 25px 80px rgba(0,0,0,.6);
      ">
        <h2 style="font-size:24px;font-weight:800;margin-bottom:12px">
          Sesión creada correctamente
        </h2>

        <p style="color:#94a3b8;margin-bottom:20px">
          Compartí este código con las mesas
        </p>

        <input id="codigo-para-copiar"
          readonly
          style="
            width:100%;
            background:#020617;
            color:#60a5fa;
            font-size:24px;
            font-weight:800;
            text-align:center;
            padding:14px;
            border:1px solid #475569;
            border-radius:10px;
            margin-bottom:16px;
          "
        >

        <button id="boton-copiar-codigo" style="
          width:100%;
          padding:14px;
          background:#2563eb;
          color:white;
          border:0;
          border-radius:10px;
          font-weight:700;
          cursor:pointer;
          margin-bottom:10px;
        ">
          Copiar código
        </button>

        <button id="boton-cerrar-codigo" style="
          width:100%;
          padding:12px;
          background:#334155;
          color:white;
          border:0;
          border-radius:10px;
          cursor:pointer;
        ">
          Continuar al mural
        </button>
      </div>
    `;

    document.body.appendChild(ventana);

    const campo = ventana.querySelector("#codigo-para-copiar");
    campo.value = codigo;

    ventana.querySelector("#boton-copiar-codigo").onclick = async () => {
      const boton = ventana.querySelector("#boton-copiar-codigo");

      try {
        await navigator.clipboard.writeText(codigo);
        boton.textContent = "✓ Código copiado";
      } catch (error) {
        campo.focus();
        campo.select();
        boton.textContent = "Seleccionado: presioná Ctrl + C";
      }
    };

    ventana.querySelector("#boton-cerrar-codigo").onclick = () => {
      ventana.remove();
    };

  } catch (error) {
    mostrarEstado(mensajeError(error));
    alert("Error al crear la sesión: " + mensajeError(error));
  }
}


  async function ingresarSesion() {
    try {
      mostrarEstado("Conectando...");

      codigo = document.getElementById(
        "collab-code"
      ).value.trim().toUpperCase();

      const mesa = document.getElementById(
        "collab-team"
      ).value;

      if (!codigo) {
        throw new Error("Ingresá el código de sesión.");
      }

      const resultado = await ejecutar("mural_join", {
        p_code: codigo,
        p_team: mesa
      });

      rol = resultado.role;

      await comenzar();

    } catch (error) {
      mostrarEstado(mensajeError(error));
    }
  }

  
function mostrarIdentificacion() {
  const anterior = document.getElementById("collab-session-label");
  if (anterior) anterior.remove();

  const etiqueta = document.createElement("div");
  etiqueta.id = "collab-session-label";

  etiqueta.style.cssText = `
    position:fixed;
    bottom:12px;
    right:12px;
    z-index:10001;
    background:#0f172a;
    border:1px solid #475569;
    border-radius:12px;
    padding:14px;
    color:white;
    font:13px Arial,sans-serif;
    box-shadow:0 10px 30px rgba(0,0,0,.4);
  `;

  const titulo = document.createElement("div");
  titulo.textContent = "Sesión: " + codigo + " | " + rol;
  titulo.style.marginBottom = "8px";
  etiqueta.appendChild(titulo);

  if (rol === "facilitador") {
    const boton = document.createElement("button");
    boton.textContent = "Copiar código";
    boton.style.cssText = `
      background:#2563eb;
      color:white;
      border:0;
      padding:10px 16px;
      border-radius:8px;
      cursor:pointer;
      font-weight:bold;
      width:100%;
    `;

    boton.onclick = async () => {
      try {
        await navigator.clipboard.writeText(String(codigo));
        boton.textContent = "✓ Código copiado";
      } catch (error) {
        window.prompt(
          "Copiá el código de sesión:",
          String(codigo)
        );
      }
    };

    etiqueta.appendChild(boton);
  }

  document.body.appendChild(etiqueta);
}


  function restringirInterfaz() {
    if (rol === "facilitador") return;

    if (typeof window.switchTeam === "function") {
      window.switchTeam(rol);
    }

    // Ocultar botones de otras mesas.
    document.querySelectorAll(
      '[onclick*="switchTeam"]'
    ).forEach(boton => {
      const accion = boton.getAttribute("onclick") || "";

      if (!accion.includes(rol)) {
        boton.style.display = "none";
      }
    });

    // Ocultar controles de crisis.
    document.querySelectorAll(
      '[onclick*="triggerCrisisModal"]'
    ).forEach(boton => {
      boton.style.display = "none";
    });

    // Impedir cambios de mesa desde el código global.
    if (typeof window.switchTeam === "function") {
      const cambiarMesa = window.switchTeam;

      window.switchTeam = function(mesa) {
        if (mesa !== rol) return;
        return cambiarMesa(mesa);
      };
    }
  }

  async function comenzar() {
    conectado = true;
    ultimaVersion = "";
    crisisNotificada = false;

    try {
      await sincronizar();
    } catch (error) {
      conectado = false;
      throw error;
    }

    const panel = document.getElementById("collab-panel");
    if (panel) panel.remove();

    restringirInterfaz();
    mostrarIdentificacion();
    document.getElementById("timer-controls").style.display = rol === "facilitador" ? "flex" : "none";
    if (timerTick) clearInterval(timerTick);
    timerTick = setInterval(renderTimer, 250);

    if (intervaloActivo) {
      clearInterval(intervaloActivo);
    }

    intervaloActivo = setInterval(() => {
      sincronizar().catch(error => {
        console.error("Error de sincronización:", error);
      });
    }, INTERVALO);
  }

  function mostrarAlertaCrisis() {
    if (document.getElementById("alerta-crisis")) return;

    const overlay = document.createElement("div");

    overlay.id = "alerta-crisis";

    overlay.style.cssText = `
      position:fixed;
      inset:0;
      z-index:99999;
      background:rgba(3,7,18,.92);
      backdrop-filter:blur(8px);
      display:flex;
      align-items:center;
      justify-content:center;
      padding:20px;
      font-family:Arial,sans-serif;
    `;

    overlay.innerHTML = `
      <div style="
        width:100%;
        max-width:480px;
        padding:32px;
        border-radius:22px;
        background:linear-gradient(
          145deg,#991b1b,#450a0a
        );
        border:1px solid #ef4444;
        box-shadow:0 30px 90px rgba(0,0,0,.7);
        color:white;
        text-align:center;
        animation:entradaCrisis .4s ease-out;
      ">

        <div style="
          font-size:12px;
          letter-spacing:3px;
          font-weight:800;
          color:#fecaca;
        ">
          EVENTO EXTRAORDINARIO
        </div>

        <div style="
          font-size:54px;
          margin:20px 0 10px;
        ">
          🚨
        </div>

        <h2 style="
          font-size:30px;
          font-weight:900;
          margin-bottom:16px;
        ">
          ¡CRISIS A BORDO!
        </h2>

        <p style="
          font-size:16px;
          line-height:1.6;
          color:#fee2e2;
          margin-bottom:24px;
        ">
          Una situación inesperada altera
          las condiciones del desafío.
          Tu equipo debe revisar sus decisiones.
        </p>

        <div style="
          background:rgba(0,0,0,.3);
          padding:22px;
          border-radius:14px;
          margin-bottom:24px;
        ">
          <div style="
            font-size:12px;
            letter-spacing:1px;
            color:#fecaca;
          ">
            NUEVA CARGA OBLIGATORIA
          </div>

          <div style="
            font-size:46px;
            font-weight:900;
            margin:12px 0;
          ">
            +15 KG
          </div>

          <p style="
            font-size:14px;
            color:#fee2e2;
          ">
            Reorganicen el bote sin superar
            su capacidad máxima de 100 kg.
          </p>
        </div>

        <button id="confirmar-alerta-crisis" style="
          width:100%;
          padding:16px;
          background:white;
          color:#7f1d1d;
          border:0;
          border-radius:10px;
          font-size:14px;
          font-weight:800;
          cursor:pointer;
        ">
          ENTENDIDO, CONTINUAR EL DESAFÍO
        </button>

      </div>
    `;

    if (!document.getElementById("estilos-crisis")) {
      const estilos = document.createElement("style");

      estilos.id = "estilos-crisis";

      estilos.textContent = `
        @keyframes entradaCrisis {
          from {
            opacity:0;
            transform:translateY(25px) scale(.9);
          }
          to {
            opacity:1;
            transform:translateY(0) scale(1);
          }
        }
      `;

      document.head.appendChild(estilos);
    }

    document.body.appendChild(overlay);

    overlay.querySelector("#confirmar-alerta-crisis")
      .addEventListener("click", () => {
        overlay.remove();
      });
  }

  async function sincronizar() {
    if (!conectado || sincronizando) return;

    sincronizando = true;

    try {
      const datos = await ejecutar("mural_snapshot", {
        p_code: codigo
      });

      if (!datos) return;

      // Notificación para las mesas participantes.
      if (
        datos.crisis &&
        rol !== "facilitador" &&
        !crisisNotificada
      ) {
        crisisNotificada = true;
        mostrarAlertaCrisis();
      }

      timerData = datos.timer || null;
      timerOffsetMs = datos.server_now ? Date.parse(datos.server_now) - Date.now() : timerOffsetMs;
      renderTimer();
      if (isFinished()) showResults(datos);

      const version = JSON.stringify({
        choices: datos.choices,
        crisis: datos.crisis
      });

      if (version === ultimaVersion) return;

      ultimaVersion = version;

      if (!window.teamsState || !window.BASE_ITEMS) {
        throw new Error(
          "No se encontraron los datos originales del mural."
        );
      }

      for (const mesaId of MESAS) {
        if (
          rol !== "facilitador" &&
          rol !== mesaId
        ) {
          continue;
        }

        const estado = window.teamsState[mesaId];
        if (!estado) continue;

        const elementos = [
          ...window.BASE_ITEMS,
          ...(datos.crisis && window.CRISIS_ITEM
            ? [window.CRISIS_ITEM]
            : [])
        ];

        const decisiones = (datos.choices || [])
          .filter(d => d.team === mesaId);

        const enBote = new Set(
          decisiones
            .filter(d => d.zone === "boat")
            .map(d => d.item_id)
        );

        estado.boat = elementos
          .filter(item => enBote.has(item.id))
          .map(item => ({ ...item }));

        estado.beach = elementos
          .filter(item => !enBote.has(item.id))
          .map(item => ({ ...item }));
      }

      if (typeof window.renderCurrentTeam === "function") {
        window.renderCurrentTeam();
      }

    } finally {
      sincronizando = false;
    }
  }

  window.moveItem = async function(itemId, zona) {
    if (!conectado || isFinished()) return;

    const mesa = window.currentTeam;

    if (
      rol !== "facilitador" &&
      rol !== mesa
    ) return;

    try {
      await ejecutar("mural_move", {
        p_code: codigo,
        p_team: mesa,
        p_item_id: itemId,
        p_zone: zona
      });

      ultimaVersion = "";
      await sincronizar();

    } catch (error) {
      alert(
        "No se pudo guardar el movimiento:\n" +
        mensajeError(error)
      );
    }
  };

  window.clearBoat = async function() {
    if (!conectado || isFinished()) return;

    const mesa = window.currentTeam;

    if (
      rol !== "facilitador" &&
      rol !== mesa
    ) return;

    try {
      await ejecutar("mural_clear", {
        p_code: codigo,
        p_team: mesa
      });

      ultimaVersion = "";
      await sincronizar();

    } catch (error) {
      alert(mensajeError(error));
    }
  };

  window.applyCrisisToAllTeams = async function() {
    if (!conectado || rol !== "facilitador" || isFinished()) return;

    try {
      await ejecutar("mural_crisis", {
        p_code: codigo
      });

      if (
        typeof window.closeCrisisModal === "function"
      ) {
        window.closeCrisisModal();
      }

      ultimaVersion = "";
      await sincronizar();

    } catch (error) {
      alert(mensajeError(error));
    }
  };

  function secondsLeft() {
    if (!timerData) return 420;
    if (timerData.status !== "running") return Math.max(0, Number(timerData.remaining_seconds) || 0);
    const elapsed = (Date.now() + timerOffsetMs - Date.parse(timerData.started_at)) / 1000;
    return Math.max(0, Math.ceil(Number(timerData.remaining_seconds) - elapsed));
  }

  function isFinished() {
    return !!timerData && (timerData.status === "finished" ||
      (timerData.status === "running" && secondsLeft() <= 0));
  }
  window.collabRoundLocked = isFinished;

  function renderTimer() {
    if (!timerData) return;
    const seconds = secondsLeft();
    const display = document.getElementById("timer-display");
    if (!display) return;
    display.textContent = `${String(Math.floor(seconds / 60)).padStart(2,"0")}:${String(seconds % 60).padStart(2,"0")}`;
    const finished = isFinished();
    const status = document.getElementById("timer-state");
    if (status) status.textContent = finished ? "FINALIZADO" : ({ready:"PREPARADO",running:"EN CURSO",paused:"PAUSADO"}[timerData.status] || "");
    document.body.classList.toggle("round-finished", finished);
    const input = document.getElementById("timer-minutes");
    const start = document.getElementById("timer-btn");
    const reset = document.getElementById("timer-reset");
    if (input) {
      if (document.activeElement !== input) input.value = Math.round(timerData.duration_seconds / 60);
      input.disabled = timerData.status !== "ready" || timerBusy;
    }
    if (start) {
      start.textContent = timerData.status === "running" ? "Pausar" : timerData.status === "paused" ? "Reanudar" : "Iniciar";
      start.disabled = finished || timerBusy;
    }
    if (reset) reset.disabled = finished || timerBusy;
    if (finished && !finalShown) {
      finalShown = true;
      sincronizar().catch(console.error);
    }
  }

  async function timerAction(action, minutes) {
    if (!conectado || rol !== "facilitador" || timerBusy) return;
    timerBusy = true;
    try {
      const response = await ejecutar("mural_timer_control", {
        p_code: codigo, p_action: action, p_minutes: minutes ?? null
      });
      timerData = response.timer;
      timerOffsetMs = Date.parse(response.server_now) - Date.now();
      renderTimer();
      await sincronizar();
    } catch (error) { alert("Temporizador: " + mensajeError(error)); }
    finally { timerBusy = false; renderTimer(); }
  }
  window.collabTimerToggle = function() {
    if (!timerData || isFinished()) return;
    if (timerData.status === "running") return timerAction("pause");
    if (timerData.status === "paused") return timerAction("resume");
    const minutes = Number(document.getElementById("timer-minutes").value);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 30) {
      alert("Elegí entre 1 y 30 minutos."); return;
    }
    return timerAction("start", minutes);
  };
  window.collabTimerReset = () => timerAction("reset");

  function teamWeight(team, choices, crisis) {
    const weights = Object.fromEntries([...(window.BASE_ITEMS || []), ...(crisis ? [window.CRISIS_ITEM] : [])].filter(Boolean).map(i=>[i.id,i.weight]));
    return (choices || []).filter(c=>c.team===team && c.zone==="boat").reduce((n,c)=>n+(weights[c.item_id]||0),0);
  }

  function showResults(datos) {
    if (resultDismissed || document.getElementById("round-result")) return;
    const teams = rol === "facilitador" ? MESAS : [rol];
    const weights = teams.map(t=>({team:t, weight:teamWeight(t,datos.choices,datos.crisis)}));
    const current = weights.find(x=>x.team===window.currentTeam) || weights[0];
    const sunk = current.weight > 100;
    const overlay = document.createElement("div");
    overlay.id = "round-result";
    overlay.className = sunk ? "sunk" : "safe";
    overlay.innerHTML = `<div class="result-box">
      <div style="font-size:56px">${sunk ? "🌊" : "⛵"}</div>
      <h2 style="font-size:30px;font-weight:900;margin:12px 0">${rol === "facilitador" ? "RESULTADOS DE LA RONDA" : sunk ? "¡EL BOTE SE HUNDIÓ!" : "¡EL BOTE SE SALVÓ!"}</h2>
      <p style="color:#cbd5e1;margin-bottom:20px">Tiempo cumplido. Las decisiones quedaron bloqueadas.</p>
      ${weights.map(x=>`<div style="display:flex;justify-content:space-between;gap:12px;padding:12px;border-bottom:1px solid #334155"><strong>${x.team.replace("mesa","Mesa ")}</strong><span>${x.weight} / 100 kg — <strong style="color:${x.weight>100?'#f87171':'#34d399'}">${x.weight>100?'HUNDIDO':'A FLOTE'}</strong></span></div>`).join("")}
      <button id="close-round-result" style="margin-top:24px;padding:12px 20px;border-radius:10px;background:#334155;color:white;font-weight:700">Ver tablero bloqueado</button>
    </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#close-round-result").onclick = () => {
    resultDismissed = true;
    overlay.remove();
    };
  }

  window.addEventListener("load", () => {
    iniciarConexion().catch(error => {
      alert(
        "Error de conexión:\n" +
        mensajeError(error)
      );
    });
  });

})();
