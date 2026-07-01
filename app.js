// ── Constantes ─────────────────────────────────────────────────────────────
const BYE_ID = "BYE";

// ── Estado ──────────────────────────────────────────────────────────────────
let jugadores = JSON.parse(localStorage.getItem("jugadores")) || [];
let estado = JSON.parse(localStorage.getItem("estado")) || null;
let idCounter = JSON.parse(localStorage.getItem("idCounter")) || 1;

// ── Arranque ─────────────────────────────────────────────────────────────────
mostrar();
mostrarHistorial();
actualizarControles();
actualizarContador();
if (estado) restaurar();

// ── Persistencia ─────────────────────────────────────────────────────────────
function guardarJugadores() {
    localStorage.setItem("jugadores", JSON.stringify(jugadores));
    mostrarGuardado();
}

function guardarEstado() {
    localStorage.setItem("estado", JSON.stringify(estado));
    mostrarGuardado();
}

function nextId() {
    const id = "p" + idCounter++;
    localStorage.setItem("idCounter", JSON.stringify(idCounter));
    return id;
}

function restaurar() {
    bracket.innerHTML = "";
    renderEstado();
    actualizarProgreso();
}

// ── Nombres ───────────────────────────────────────────────────────────────────
function nombreDe(id) {
    if (id === BYE_ID) return "BYE";
    if (!id) return "";
    return (estado && estado.nombres && estado.nombres[id]) || "???";
}

// Escapa caracteres HTML antes de insertar texto de usuario en innerHTML,
// para que nombres como "<img onerror=...>" se muestren como texto plano
// y no se interpreten como HTML/JS.
function escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
}

// ── Lista de jugadores ────────────────────────────────────────────────────────
function mostrar() {
    lista.innerHTML = "";
    jugadores.forEach((j, i) => {
        const li = document.createElement("li");
        li.innerHTML = `
            <span class="nombre-jugador" data-i="${i}" title="Click para editar">${escapeHTML(j.nombre)}</span>
            <button onclick="eliminar(${i})">x</button>
        `;
        lista.appendChild(li);
    });

    // Edición inline al hacer click en el nombre
    document.querySelectorAll(".nombre-jugador").forEach(span => {
        span.addEventListener("click", function () {
            const i = parseInt(this.dataset.i);
            const input = document.createElement("input");
            input.value = jugadores[i].nombre;
            input.style.cssText = "padding:4px 8px;background:#222;color:#fff;border:1px solid #ff9900;border-radius:4px;font-size:inherit;";
            this.replaceWith(input);
            input.focus();
            input.select();

            let cancelado = false;

            function confirmar() {
                if (cancelado) return;
                const nuevo = input.value.trim();
                if (nuevo) jugadores[i].nombre = nuevo;
                guardarJugadores();
                mostrar();
                // Si hay torneo activo, actualizar nombres en el estado
                if (estado) sincronizarNombres();
            }

            input.addEventListener("blur", confirmar);
            input.addEventListener("keydown", e => {
                if (e.key === "Enter") input.blur();
                if (e.key === "Escape") { cancelado = true; mostrar(); }
            });
        });
    });
    actualizarContador();
}

function sincronizarNombres() {
    if (!estado) return;
    jugadores.forEach(j => {
        if (estado.nombres && estado.nombres[j.id] !== undefined) {
            estado.nombres[j.id] = j.nombre;
        }
    });
    guardarEstado();
    renderEstado();
}

function agregarJugador() {
    const nombre = nombreJugador.value.trim();
    const max = parseInt(maximo.value);

    if (!nombre) return;

    if (maximo.value !== "" && (isNaN(max) || max < 2)) {
        alert("El máximo debe ser 2 o mayor");
        maximo.value = "";
        return;
    }

    if (!isNaN(max) && max > 0 && jugadores.length >= max) {
        alert("Límite alcanzado");
        return;
    }

    jugadores.push({ id: nextId(), nombre });
    guardarJugadores();
    mostrar();
    nombreJugador.value = "";
    nombreJugador.focus();
    nombreJugador.select();
}

function cambiarMaximo(delta) {
    if (maximo.disabled) return;
    const actual = parseInt(maximo.value) || 0;
    let nuevo = actual + delta;
    if (nuevo < 2) nuevo = 2;
    maximo.value = nuevo;
    actualizarContador();
}

function eliminar(i) {
    jugadores.splice(i, 1);
    guardarJugadores();
    mostrar();
}

// ── Utilidades ────────────────────────────────────────────────────────────────
function mezclar(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const r = Math.floor(Math.random() * (i + 1));
        [a[i], a[r]] = [a[r], a[i]];
    }
    return a;
}

function siguientePotencia2(n) {
    let p = 1;
    while (p < n) p *= 2;
    return p;
}

function crearPartidaRaw(j1, j2) {
    const p = { j1, j2, score1: 0, score2: 0, ganador: null, perdedor: null };
    if (j2 === BYE_ID && j1 !== BYE_ID) { p.ganador = j1; p.perdedor = BYE_ID; }
    else if (j1 === BYE_ID && j2 !== BYE_ID) { p.ganador = j2; p.perdedor = BYE_ID; }
    return p;
}

function obtenerPartida(tipo, ri, pi) {
    if (tipo === "w") return estado.winners[ri]?.[pi];
    if (tipo === "l") return estado.losers[ri]?.[pi];
    if (tipo === "gf") return estado.granFinal?.partida;
    if (tipo === "reset") return estado.reset;
}

// ── Generación del torneo ─────────────────────────────────────────────────────
function generarTorneo() {
    const modo = document.getElementById("modo").value;
    const confirmado = confirm(
        `¿Generar torneo?\nJugadores: ${jugadores.length}\nFormato: FT${formato.value}\nModo: ${modo}`
    );
    if (!confirmado) return;
    if (jugadores.length < 2) {
        alert("Agrega al menos 2 jugadores");
        return;
    }
    const barajados = mezclar([...jugadores]);
    const size = siguientePotencia2(barajados.length);
    const ids = barajados.map(j => j.id);
    while (ids.length < size) ids.push(BYE_ID);

    const nombres = {};
    jugadores.forEach(j => { nombres[j.id] = j.nombre; });

    const ronda1 = [];
    for (let i = 0; i < ids.length; i += 2) {
        ronda1.push(crearPartidaRaw(ids[i], ids[i + 1]));
    }

    estado = {
        modo,
        nombres,
        winners: [ronda1],
        losers: [],
        colaW: [],
        granFinal: null,
        reset: null,
        campeon: null
    };

    avanzarWinners();

    guardarEstado();
    renderEstado();
    actualizarControles();

    document.querySelectorAll(".partida").forEach(card => card.classList.add("avance"));
}

// ── Winners bracket ───────────────────────────────────────────────────────────
function avanzarWinners() {
    const w = estado.winners;
    const ultima = w[w.length - 1];
    const completas = ultima.every(p => p.ganador);
    if (!completas) return;

    if (estado.modo === "double") {
        const perdedores = ultima.map(p => p.perdedor).filter(id => id && id !== BYE_ID);
        if (perdedores.length) estado.colaW.push(...perdedores);
    }

    if (ultima.length === 1) {
        if (estado.modo === "simple") {
            estado.campeon = ultima[0].ganador;
            guardarCampeon(nombreDe(estado.campeon));
        } else {
            crearGranFinal(ultima[0].ganador, null);
        }
    } else {
        const siguiente = [];
        for (let i = 0; i < ultima.length; i += 2) {
            siguiente.push(crearPartidaRaw(ultima[i].ganador, ultima[i + 1] ? ultima[i + 1].ganador : BYE_ID));
        }
        w.push(siguiente);
        avanzarWinners(); // cascada por si la nueva ronda se autorresuelve con BYEs
    }

    if (estado.modo === "double") procesarLosers();
}

// ── Losers bracket ────────────────────────────────────────────────────────────
// estado.colaW guarda, en orden FIFO, a los perdedores de winners que aún
// no han sido incorporados al losers bracket. Nunca se descartan: si no hay
// suficientes para formar la siguiente ronda todavía, simplemente esperan.
function procesarLosers() {
    if (estado.modo !== "double") return;

    const l = estado.losers;
    const wFinal = estado.winners[estado.winners.length - 1];
    const winnersTerminado = wFinal.length === 1 && !!wFinal[0].ganador;

    // Losers bracket todavía no tiene ninguna ronda
    if (l.length === 0) {
        if (estado.colaW.length >= 2) {
            const tomar = estado.colaW.splice(0, estado.colaW.length);
            const ronda = [];
            for (let i = 0; i < tomar.length; i += 2) {
                ronda.push(crearPartidaRaw(tomar[i], tomar[i + 1] ?? BYE_ID));
            }
            l.push(ronda);
            procesarLosers(); // cascada si la ronda se autorresolvió con BYEs
        } else if (estado.colaW.length === 1 && winnersTerminado) {
            // Bracket de 2 jugadores: el único perdedor de winners es directo
            // finalista del losers bracket.
            const id = estado.colaW.shift();
            crearGranFinal(null, id);
        }
        return;
    }

    const ultima = l[l.length - 1];
    if (!ultima.every(p => p.ganador)) return;

    const ganadores = ultima.map(p => p.ganador);

    // Solo se declara finalista de losers cuando ya no hay nadie más en
    // cola Y winners ya no va a producir más perdedores.
    if (ganadores.length === 1 && estado.colaW.length === 0 && winnersTerminado) {
        crearGranFinal(null, ganadores[0]);
        return;
    }

    if (estado.colaW.length >= ganadores.length) {
        const tomar = estado.colaW.splice(0, ganadores.length);
        const ronda = ganadores.map((g, i) => crearPartidaRaw(g, tomar[i]));
        l.push(ronda);
        procesarLosers();
        return;
    }

    if (winnersTerminado && estado.colaW.length < ganadores.length) {
        // Ya no llegarán más perdedores de winners (su número ya es fijo) y
        // no alcanzan para emparejar 1 a 1 contra los ganadores: ronda
        // interna entre los sobrevivientes del losers bracket para reducir
        // su número antes de mezclarlos con los que sí llegaron.
        const ronda = [];
        for (let i = 0; i < ganadores.length; i += 2) {
            ronda.push(crearPartidaRaw(ganadores[i], ganadores[i + 1] ?? BYE_ID));
        }
        l.push(ronda);
        procesarLosers();
        return;
    }
    // si no, faltan perdedores de winners por llegar: esperar.
}

// ── Gran Final ────────────────────────────────────────────────────────────────
function crearGranFinal(idW, idL) {
    estado.granFinal = estado.granFinal || {};
    if (idW) estado.granFinal.winnerWId = idW;
    if (idL) estado.granFinal.winnerLId = idL;

    if (estado.granFinal.winnerWId && estado.granFinal.winnerLId && !estado.granFinal.partida) {
        estado.granFinal.partida = {
            j1: estado.granFinal.winnerWId,
            j2: estado.granFinal.winnerLId,
            score1: 0, score2: 0, ganador: null
        };
    }
}

function avanzarGranFinal() {
    const gf = estado.granFinal?.partida;
    if (!gf || !gf.ganador) return;

    // Si ganó el jugador de losers, bracket reset
    if (gf.ganador === estado.granFinal.winnerLId && !estado.reset) {
        estado.reset = {
            j1: estado.granFinal.winnerWId,
            j2: estado.granFinal.winnerLId,
            score1: 0, score2: 0, ganador: null
        };
        guardarEstado();
        renderEstado();
        return;
    }

    estado.campeon = gf.ganador;
    guardarCampeon(nombreDe(estado.campeon));
    guardarEstado();
    renderEstado();
}

function avanzarReset() {
    const r = estado.reset;
    if (!r || !r.ganador) return;
    estado.campeon = r.ganador;
    guardarCampeon(nombreDe(estado.campeon));
    guardarEstado();
    renderEstado();
}

// ── Sumar puntos ──────────────────────────────────────────────────────────────
const RESET_OBJETIVO = 3; // el Bracket Reset siempre es FT3, sin importar el formato del torneo

function sumar(tipo, ri, pi, lado) {
    const objetivo = tipo === "reset" ? RESET_OBJETIVO : parseInt(formato.value);
    const p = obtenerPartida(tipo, ri, pi);

    if (!p || p.ganador) return;

    if (lado === 1) p.score1++;
    else p.score2++;

    if (p.score1 >= objetivo) { p.ganador = p.j1; p.perdedor = p.j2; }
    if (p.score2 >= objetivo) { p.ganador = p.j2; p.perdedor = p.j1; }

    if (p.ganador) {
        if (tipo === "w") avanzarWinners();
        else if (tipo === "l") procesarLosers();
        else if (tipo === "gf") avanzarGranFinal();
        else if (tipo === "reset") avanzarReset();

        requestAnimationFrame(() => {
            const card = document.querySelector(`.partida[data-tipo="${tipo}"][data-ri="${ri}"][data-pi="${pi}"]`);
            if (card) {
                card.classList.add("ganando");
                setTimeout(() => card.classList.remove("ganando"), 1000);
            }
        });
    }

    guardarEstado();
    renderEstado();
}

// Verifica si el ganador de una partida ya fue usado más adelante en el
// bracket (siguiente ronda, cola de losers, gran final, reset o campeón),
// para impedir un "deshacer" que dejaría el bracket inconsistente.
function idUsadoDespues(id, tipo, ri) {
    const enPartidas = (rondas) => rondas.some(ronda => ronda.some(p => p.j1 === id || p.j2 === id));

    if (tipo === "w") {
        if (enPartidas(estado.winners.slice(ri + 1))) return true;
        if (estado.colaW.includes(id)) return true;
        if (enPartidas(estado.losers)) return true;
    }
    if (tipo === "l") {
        if (enPartidas(estado.losers.slice(ri + 1))) return true;
    }
    if (estado.granFinal) {
        if (estado.granFinal.winnerWId === id || estado.granFinal.winnerLId === id) return true;
        if (estado.granFinal.partida && (estado.granFinal.partida.j1 === id || estado.granFinal.partida.j2 === id)) return true;
    }
    if (estado.reset && (estado.reset.j1 === id || estado.reset.j2 === id)) return true;
    if (estado.campeon === id) return true;
    return false;
}

function resetPartida(tipo, ri, pi) {
    const p = obtenerPartida(tipo, ri, pi);
    if (!p || !p.ganador) return;

    if (idUsadoDespues(p.ganador, tipo, ri)) {
        alert("No se puede deshacer: el resultado ya avanzó más adelante en el bracket. Deshaz primero las partidas posteriores.");
        return;
    }

    p.score1 = 0; p.score2 = 0; p.ganador = null; p.perdedor = null;
    guardarEstado();
    renderEstado();
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderEstado() {
    bracket.innerHTML = "";
    if (!estado) return;

    // Winners
    const secW = document.createElement("div");
    secW.className = "seccion-bracket";
    secW.innerHTML = `<h3 class="seccion-titulo">Winners Bracket</h3>`;
    const colsW = document.createElement("div");
    colsW.style.cssText = "display:flex;gap:120px;align-items:flex-start;";
    estado.winners.forEach((ronda, ri) => {
        colsW.appendChild(crearColumna(`Ronda ${ri + 1}`, ronda, "w", ri));
    });
    secW.appendChild(colsW);
    bracket.appendChild(secW);

    // Losers
    if (estado.modo === "double" && estado.losers.length) {
        const secL = document.createElement("div");
        secL.className = "seccion-bracket";
        secL.innerHTML = `<h3 class="seccion-titulo losers-titulo">Losers Bracket</h3>`;
        const colsL = document.createElement("div");
        colsL.style.cssText = "display:flex;gap:120px;align-items:flex-start;";
        estado.losers.forEach((ronda, ri) => {
            colsL.appendChild(crearColumna(`L-Ronda ${ri + 1}`, ronda, "l", ri));
        });
        secL.appendChild(colsL);
        bracket.appendChild(secL);
    }

    // Gran Final
    if (estado.granFinal?.partida) {
        const secGF = document.createElement("div");
        secGF.className = "seccion-bracket";
        secGF.innerHTML = `<h3 class="seccion-titulo gf-titulo">Gran Final</h3>`;
        secGF.appendChild(crearTarjeta(estado.granFinal.partida, "gf", 0, 0));
        bracket.appendChild(secGF);
    }

    // Bracket Reset
    if (estado.reset) {
        const secR = document.createElement("div");
        secR.className = "seccion-bracket";
        secR.innerHTML = `
            <h3 class="seccion-titulo reset-titulo">Bracket Reset</h3>
            <div class="reset-banner">
                ⚠️ ${escapeHTML(nombreDe(estado.reset.j2))} venció a ${escapeHTML(nombreDe(estado.reset.j1))} en la Gran Final.
                Como viene del Losers Bracket, debe ganar una vez más para ser campeón.
                Esta partida es <strong>FT${RESET_OBJETIVO}</strong>, sin importar el formato del resto del torneo.
            </div>
        `;
        secR.appendChild(crearTarjeta(estado.reset, "reset", 0, 0));
        bracket.appendChild(secR);
    }

    // Campeón
    if (estado.campeon) {
        const banner = document.createElement("div");
        banner.className = "campeon-banner";
        banner.innerHTML = `
            <div class="campeon-icono">🏆</div>
            <div class="campeon-label">CAMPEÓN</div>
            <strong>${escapeHTML(nombreDe(estado.campeon))}</strong>
            <div class="campeon-ft">FT${formato.value}</div>
        `;
        bracket.appendChild(banner);
    }

    setTimeout(dibujarLlaves);
}

function crearColumna(titulo, ronda, tipo, ri) {
    const col = document.createElement("div");
    col.className = "ronda";
    col.dataset.ronda = ri;
    const activa = ronda.some(p => !p.ganador);
    if (activa) {
        const anteriores = document.querySelector(".ronda-actual");
        if (!anteriores) col.classList.add("ronda-actual");
    }
    col.innerHTML = `<h3>${titulo}</h3>`;
    ronda.forEach((p, pi) => {
        col.appendChild(crearTarjeta(p, tipo, ri, pi));
    });
    return col;
}

function crearTarjeta(p, tipo, ri, pi) {
    const card = document.createElement("div");
    card.className = "partida";
    card.dataset.tipo = tipo;
    card.dataset.ri = ri;
    card.dataset.pi = pi;
    if (p.ganador) card.classList.add("partida-completa");

    const esBye = p.j1 === BYE_ID || p.j2 === BYE_ID;
    const nombre1 = escapeHTML(nombreDe(p.j1));
    const nombre2 = escapeHTML(nombreDe(p.j2));

    // El botón de deshacer no debe aparecer en partidas resueltas
    // automáticamente por un BYE: no hay nada que "rejugar" y, al no tener
    // rival real, la partida quedaría sin forma de resolverse de nuevo.
    const btnReset = (p.ganador && !esBye) ? `<button class="btn-reset-partida" onclick="resetPartida('${tipo}',${ri},${pi})">↩</button>` : "";
    const badgeReset = tipo === "reset" ? `<div class="badge-reset">RESET · FT${RESET_OBJETIVO}</div>` : "";

    card.innerHTML = `
        ${badgeReset}
        <div class="jugador ${p.ganador === p.j1 ? 'ganador' : ''}">${nombre1}</div>
        <div class="jugador ${p.ganador === p.j2 ? 'ganador' : ''}">${nombre2}</div>
        <div class="score">
            <div class="puntos">${p.score1 ?? 0} - ${p.score2 ?? 0}</div>
            ${!p.ganador && !esBye ? `
            <div class="marcador">
                <button onclick="sumar('${tipo}',${ri},${pi},1)">+</button>
                <button onclick="sumar('${tipo}',${ri},${pi},2)">+</button>
            </div>` : ""}
            ${btnReset}
        </div>
        <div class="resultado">${p.ganador ? "Ganador: " + escapeHTML(nombreDe(p.ganador)) : ""}</div>
    `;
    return card;
}

// ── Dibujar líneas SVG ────────────────────────────────────────────────────────
function dibujarLlaves() {
    const svg = document.getElementById("lineas");
    const contenedor = document.getElementById("contenedorBracket");
    svg.setAttribute("width", contenedor.scrollWidth);
    svg.setAttribute("height", contenedor.scrollHeight);
    svg.style.width = contenedor.scrollWidth + "px";
    svg.style.height = contenedor.scrollHeight + "px";
    svg.innerHTML = "";

    const rondasEl = [...document.querySelectorAll(".ronda")];
    const b = contenedor.getBoundingClientRect();

    for (let r = 0; r < rondasEl.length - 1; r++) {
        const actual = [...rondasEl[r].querySelectorAll(".partida")];
        const siguiente = [...rondasEl[r + 1].querySelectorAll(".partida")];

        for (let i = 0; i < actual.length; i += 2) {
            const p1 = actual[i];
            const p2 = actual[i + 1];
            const destino = siguiente[Math.floor(i / 2)];

            if (!p1 || !p2 || !destino) continue;

            const a = p1.getBoundingClientRect();
            const x1 = a.right - b.left + contenedor.scrollLeft;
            const y1 = a.top - b.top + contenedor.scrollTop + a.height / 2;

            const c = p2.getBoundingClientRect();
            const y2 = c.top - b.top + contenedor.scrollTop + c.height / 2;

            const d = destino.getBoundingClientRect();
            const x2 = d.left - b.left + contenedor.scrollLeft;
            const y2d = d.top - b.top + contenedor.scrollTop + d.height / 2;

            const yc = (y1 + y2) / 2;
            crearLlave(svg, x1, y1, y2, yc);
            crearCurva(svg, x1 + 70, yc, x2, y2d);
        }
    }
}

function crearLlave(svg, x, y1, y2, yc) {
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", `M${x},${y1} H${x + 40} Q${x + 70},${y1} ${x + 70},${yc} Q${x + 70},${y2} ${x + 40},${y2} H${x}`);
    svg.appendChild(p);
}

function crearCurva(svg, x1, y1, x2, y2) {
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", `M${x1},${y1} C${x1 + 50},${y1} ${x2 - 50},${y2} ${x2},${y2}`);
    svg.appendChild(p);
}

// ── Resto ─────────────────────────────────────────────────────────────────────
// ── Cancelar torneo (mantiene la lista de jugadores) ──────────────────────────
function cancelarTorneo() {
    if (!estado) return;
    if (!confirm("¿Cancelar el torneo actual? Los jugadores se mantienen, pero se perderá el progreso del bracket.")) return;

    estado = null;
    localStorage.removeItem("estado");
    bracket.innerHTML = "";
    document.getElementById("lineas").innerHTML = "";
    actualizarControles();
    actualizarProgreso();
    mostrarGuardado();
}

// ── Exportar / Importar respaldo ───────────────────────────────────────────────
function exportarRespaldo() {
    const datos = {
        version: 1,
        fecha: new Date().toISOString(),
        jugadores,
        estado,
        idCounter,
        campeones: JSON.parse(localStorage.getItem("campeones")) || []
    };
    const blob = new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const marca = new Date().toISOString().slice(0, 10);

    const a = document.createElement("a");
    a.href = url;
    a.download = `sfiii-torneo-respaldo-${marca}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function importarRespaldo(event) {
    const file = event.target.files[0];
    if (!file) return;

    const nombreEl = document.getElementById("nombreArchivo");
    nombreEl.textContent = file.name;
    nombreEl.classList.add("con-archivo");

    if (!confirm("Importar reemplazará todos los datos actuales (jugadores, torneo en curso e historial). ¿Continuar?")) {
        event.target.value = "";
        nombreEl.textContent = "Ningún archivo seleccionado";
        nombreEl.classList.remove("con-archivo");
        return;
    }

    const reader = new FileReader();
    reader.onload = () => {
        try {
            const datos = JSON.parse(reader.result);
            if (!datos || !Array.isArray(datos.jugadores)) throw new Error("Formato inválido");

            jugadores = datos.jugadores;
            estado = datos.estado || null;
            idCounter = datos.idCounter || 1;

            localStorage.setItem("jugadores", JSON.stringify(jugadores));
            localStorage.setItem("estado", JSON.stringify(estado));
            localStorage.setItem("idCounter", JSON.stringify(idCounter));
            if (Array.isArray(datos.campeones)) {
                localStorage.setItem("campeones", JSON.stringify(datos.campeones));
            }

            mostrar();
            mostrarHistorial();
            actualizarControles();
            actualizarContador();

            if (estado) {
                restaurar();
            } else {
                bracket.innerHTML = "";
                document.getElementById("lineas").innerHTML = "";
                actualizarProgreso();
            }

            mostrarGuardado();
            alert("Respaldo importado correctamente.");
        } catch (e) {
            alert("No se pudo leer el archivo de respaldo. Verifica que sea un JSON válido exportado desde esta app.");
            nombreEl.textContent = "Ningún archivo seleccionado";
            nombreEl.classList.remove("con-archivo");
        } finally {
            event.target.value = "";
        }
    };
    reader.readAsText(file);
}

function reiniciarTodo() {
    if (!confirm("¿Reiniciar todo?")) return;
    const campeones = localStorage.getItem("campeones"); // 1. guardar
    localStorage.clear();                                 // 2. limpiar
    if (campeones) localStorage.setItem("campeones", campeones); // 3. restaurar
    jugadores = [];
    estado = null;
    nombreJugador.value = "";
    maximo.value = "";
    mostrar();
    mostrarHistorial(); // 4. mostrar DESPUÉS de restaurar
    actualizarControles();
    bracket.innerHTML = "";
    document.getElementById("lineas").innerHTML = "";
}

function guardarCampeon(nombre) {
    const historial = JSON.parse(localStorage.getItem("campeones")) || [];
    historial.push({ nombre, fecha: new Date().toLocaleDateString() });
    localStorage.setItem("campeones", JSON.stringify(historial));
    mostrarHistorial();
}

function mostrarHistorial() {
    const historial = JSON.parse(localStorage.getItem("campeones")) || [];
    const div = document.getElementById("historial");

    if (!historial.length) {
        div.innerHTML = `<p class="historial-vacio">Aún no hay campeones registrados.</p>`;
        return;
    }

    div.innerHTML = historial
        .map((c, i) => `
            <div class="historial-item">
                <span class="historial-pos">#${i + 1}</span>
                <span class="historial-nombre">${escapeHTML(c.nombre)}</span>
                <span class="historial-fecha">${escapeHTML(c.fecha)}</span>
            </div>
        `).join("");
}

function borrarHistorial() {
    if (!confirm("¿Borrar todo el historial de campeones?")) return;
    localStorage.removeItem("campeones");
    mostrarHistorial();
}

function actualizarControles() {
    const iniciado = !!estado;
    nombreJugador.disabled = iniciado;
    maximo.disabled = iniciado;
    formato.disabled = iniciado;
    modo.disabled = iniciado;
    document.getElementById("btnGenerar").style.display = iniciado ? "none" : "";
    document.getElementById("btnCancelarTorneo").style.display = iniciado ? "" : "none";
    document.querySelector(".btn-primario").disabled = iniciado;
    document.querySelectorAll(".spinner-numero button").forEach(b => {
        b.disabled = iniciado;
        b.style.opacity = iniciado ? ".3" : "1";
    });
    document.querySelectorAll("#lista li button").forEach(b => {
        b.disabled = iniciado;
        b.style.opacity = iniciado ? ".3" : "1";
    });
}

function actualizarProgreso() {
    const div = document.getElementById("estadoTorneo");
    if (!estado) {
        div.innerHTML = "Esperando torneo";
        return;
    }
    let total = 0;
    let completas = 0;
    const revisar = (rondas) => {
        rondas.forEach(r => {
            r.forEach(p => {
                total++;
                if (p.ganador) completas++;
            });
        });
    };
    revisar(estado.winners);
    revisar(estado.losers);
    div.innerHTML = `Jugadores: ${jugadores.length} &nbsp;|&nbsp; Partidas: ${completas}/${total}`;
}

let timerGuardado;

function mostrarGuardado() {
    const aviso = document.getElementById("guardado");
    aviso.textContent = "✓ Guardado automáticamente";
    aviso.classList.add("visible");
    clearTimeout(timerGuardado);
    timerGuardado = setTimeout(() => {
        aviso.classList.remove("visible");
    }, 2000);
}

function actualizarContador() {
    const contador = document.getElementById("contador");
    const max = parseInt(maximo.value) || 0;
    contador.textContent = `${jugadores.length} / ${max} jugadores`;
    contador.classList.toggle("lleno", max > 0 && jugadores.length === max);
}

document.getElementById("contenedorBracket").addEventListener("scroll", () => {
    requestAnimationFrame(dibujarLlaves);
});
window.addEventListener("resize", () => {
    requestAnimationFrame(dibujarLlaves);
});
