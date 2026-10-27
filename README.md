# TuZoca Penalty Shootout — Documentación del juego e integración con agregador

Versión del documento: 1.0 (borrador)
Estado del juego: front-end demo, listo para conectarse a un backend externo.

---

## 1. Resumen

**TuZoca Penalty Shootout** es un juego de tipo *crash/ladder* con temática de fútbol. El jugador apuesta, lanza penaltis consecutivos y, con cada gol, sube un escalón del multiplicador. Puede cobrar en cualquier momento tras un gol, o arriesgarse a tirar de nuevo. Si el portero ataja, pierde la apuesta.

| Dato | Valor |
|---|---|
| Género | Instant game / ladder |
| Tipo de ronda | Una apuesta, hasta 5 tiros encadenados |
| Multiplicadores | x1.5 · x2 · x3 · x6 · x12 |
| Pago máximo | 12 × apuesta |
| RTP propuesto | 96 % (configurable, ver §5) |
| Volatilidad | Media |
| Plataforma | HTML5 / JS, desktop y móvil |
| Idioma actual | Español (localizable) |

---

## 2. Cómo se juega

1. **Elegir apuesta.** El jugador escribe un importe o usa los botones rápidos (10, 25, 50) y los botones ½ / ×2.
2. **Pulsar "Jugar".** Se descuenta la apuesta y comienza la ronda.
3. **Elegir zona de tiro.** La portería tiene 6 zonas (3 arriba y 3 abajo: izquierda, centro, derecha). También existe el botón de **tiro aleatorio**.
4. **Resultado del tiro.**
   - **Gol:** sube un escalón en la escalera de multiplicadores.
   - **Atajado:** la ronda termina y la apuesta se pierde.
5. **Tras cada gol** el jugador decide:
   - **Cobrar:** recibe `apuesta × multiplicador actual` y la ronda termina.
   - **Seguir tirando:** busca el siguiente multiplicador.
6. **Máximo:** al marcar el 5.º gol (x12) la ronda termina automáticamente con el pago máximo.

### Escalera de multiplicadores

| Gol nº | Multiplicador | Pago con apuesta de 10 |
|---|---|---|
| 1 | x1.5 | 15 |
| 2 | x2 | 20 |
| 3 | x3 | 30 |
| 4 | x6 | 60 |
| 5 | x12 | 120 |

### Importante para el jugador y para certificación

- **La zona elegida por el jugador NO influye en el resultado.** El resultado de cada tiro lo decide únicamente el RNG del servidor. La elección de zona y la posición del portero son solo animación. Esto debe constar en las reglas del juego mostradas al jugador.
- Cada tiro es independiente del anterior; la probabilidad depende solo del escalón en el que se está (§5).

---

## 3. Arquitectura de integración

```
┌────────────┐   launch URL + token   ┌────────────────────┐
│  Jugador   │ ─────────────────────▶ │  Juego (front-end) │
└────────────┘                        └─────────┬──────────┘
                                                │ HTTPS / postMessage
                                                ▼
                                   ┌────────────────────────┐
                                   │  Game Server (backend) │  ← RNG + lógica de rondas + RTP
                                   └─────────┬──────────────┘
                                             │ API wallet del operador
                                             ▼
                                   ┌────────────────────────┐
                                   │ Agregador / Operador   │  ← balance, bet, win, rollback
                                   └────────────────────────┘
```

**Responsabilidades**

| Componente | Responsabilidad |
|---|---|
| Front-end (este repo) | Interfaz, animaciones, audio. **No decide resultados, no gestiona saldo.** |
| Game Server | RNG, probabilidades, estado de ronda, validación de apuesta/cobro, historial, idempotencia. |
| Agregador/Operador | Autenticación del jugador, saldo (wallet), registro de transacciones, límites, juego responsable. |

---

## 4. Qué debe aportar el agregador (y qué debe aportar el proveedor del juego)

### 4.1 Lo que el agregador / operador proporciona

1. **Lanzamiento del juego:** launch URL con token de sesión, idioma, moneda, modo (real/demo) y URL de retorno al lobby.
2. **API de wallet (server-to-server):**
   - `balance` — consultar saldo.
   - `bet` / `debit` — descontar la apuesta al iniciar la ronda.
   - `win` / `credit` — acreditar el premio al cobrar (o `0` si pierde, para cerrar la ronda).
   - `rollback` / `cancel` — revertir una apuesta no completada.
   - Todas con **ID de transacción único e idempotencia** (reintentar la misma llamada no debe duplicar el cargo).
3. **Configuración por operador/jugador:** moneda, apuesta mínima y máxima, apuestas rápidas permitidas, pago máximo por ronda, límites de jugador.
4. **Juego responsable y cumplimiento:** reality checks, límites de sesión, autoexclusión, requisitos de la jurisdicción.
5. **Reporting:** consulta de historial de rondas y transacciones.

### 4.2 Lo que el proveedor del juego (nosotros) debe tener

1. **Game Server con RNG certificado** (ver §5 y §6).
2. **Adaptador** entre este front-end y la API del agregador (hoy solo existen eventos del navegador).
3. **Certificación** del RNG y del juego por laboratorio acreditado (GLI, BMM, iTech Labs…), según jurisdicción.
4. **Reglas del juego / paytable** visibles para el jugador, localizadas.
5. **Recuperación de ronda:** si el jugador recarga o pierde la conexión con una ronda abierta, debe poder reanudarla.

---

## 5. RNG y modelo matemático

### 5.1 Qué es el RNG aquí

El **RNG (Random Number Generator)** es el componente del **servidor** que genera números aleatorios impredecibles y de los que sale el resultado de cada tiro (gol o atajado). Requisitos:

- Ejecutarse **solo en el servidor**. El cliente nunca decide ni conoce el resultado antes de pedirlo.
- Ser un **CSPRNG** (generador criptográficamente seguro), por ejemplo `crypto.randomBytes` (Node), `secrets` (Python) o `/dev/urandom`. **No** usar `Math.random()`.
- Estar **certificado** por laboratorio acreditado para mercados regulados.
- Usar un método de mapeo sin sesgo (rechazo/rejection sampling) al convertir bytes en un valor uniforme.
- Registrar la semilla/valor usado en cada ronda para auditoría.

> Nota: el front-end actual usa `Math.random()` solo en `randomShot()` para elegir la zona visual y en el ruido de audio. Es cosmético y no afecta al resultado.

### 5.2 Modelo propuesto (RTP constante: 96 %)

Cada tiro tiene una probabilidad de gol distinta según el escalón, calibrada para que el **RTP sea el mismo (96 %) en cualquier estrategia de cobro**: da igual si el jugador cobra tras 1, 2, 3, 4 o 5 goles.

Fórmula: la probabilidad acumulada de llegar al gol *k* es `S_k = RTP / m_k`, y la probabilidad del tiro *k* es `p_k = S_k / S_(k-1)`.

| Tiro (k) | Multiplicador m_k | Prob. de gol del tiro p_k | Prob. acumulada S_k | RTP si cobra aquí (S_k × m_k) |
|---|---|---|---|---|
| 1 | x1.5 | 64.00 % | 64.00 % | 96 % |
| 2 | x2 | 75.00 % | 48.00 % | 96 % |
| 3 | x3 | 66.67 % | 32.00 % | 96 % |
| 4 | x6 | 50.00 % | 16.00 % | 96 % |
| 5 | x12 | 50.00 % | 8.00 % | 96 % |

- **Frecuencia de acierto del primer tiro:** 64 %.
- **Probabilidad de llegar al x12:** 8 %.
- **Ventaja de la casa:** 4 %.
- Estos valores son una **propuesta**. Cambiar el RTP objetivo solo requiere recalcular la tabla con la fórmula; el front-end no cambia.
- Pueden ofrecerse varios RTP por operador (por ejemplo 94 / 96 / 97 %); en ese caso el servidor debe informarlo y el valor debe constar en las reglas.

### 5.3 Algoritmo de un tiro (pseudocódigo)

```text
function resolveShot(round):
    k = round.goals + 1                       # escalón que se intenta
    p = P_GOAL[k]                             # tabla de §5.2
    r = csprng_uniform_float()                # [0, 1) sin sesgo
    scored = (r < p)

    # Posición del portero (solo visual, no afecta al resultado)
    if scored:
        keeperZone = random_zone_except(requestedZone)
    else:
        keeperZone = requestedZone

    return { scored, zone: requestedZone, goalkeeperZone: keeperZone }
```

### 5.4 Reglas que debe garantizar el servidor

- El resultado se genera **después** de recibir la solicitud de tiro y **nunca** antes.
- El resultado se **guarda** antes de devolverse al cliente (para recuperación de ronda).
- El cobro (`collect`) solo es válido si `goals ≥ 1` y no hay un tiro pendiente; el pago lo calcula el servidor como `stake × m_goals`, **nunca** el cliente.
- La apuesta y el multiplicador **se toman del estado del servidor**, no de lo que envíe el cliente.
- Pago máximo por ronda: `stake × 12`, sujeto al tope del operador.

---

## 6. Flujo de una ronda y contrato del servidor

### 6.1 Secuencia

```
Jugador            Front-end             Game Server              Wallet (agregador)
   │  Jugar (stake)    │                        │                          │
   │ ────────────────▶ │  POST /round/start     │                          │
   │                   │ ─────────────────────▶ │  bet(stake, txId)        │
   │                   │                        │ ───────────────────────▶ │
   │                   │                        │ ◀─── OK + balance ────── │
   │                   │ ◀── roundId, state ─── │                          │
   │  Elige zona       │                        │                          │
   │ ────────────────▶ │  POST /round/shot      │                          │
   │                   │ ─────────────────────▶ │  RNG → scored            │
   │                   │ ◀── scored, keeper ─── │                          │
   │  Cobrar           │  POST /round/collect   │                          │
   │ ────────────────▶ │ ─────────────────────▶ │  win(payout, txId)       │
   │                   │                        │ ───────────────────────▶ │
   │                   │ ◀── payout, balance ── │ ◀─── OK + balance ────── │
```

Si el tiro es atajado, el servidor cierra la ronda y llama a `win(0)` (o equivalente de cierre) para que el agregador registre el fin de ronda.

### 6.2 Endpoints sugeridos del Game Server

| Endpoint | Entrada | Salida |
|---|---|---|
| `POST /round/start` | `sessionToken`, `stake` | `roundId`, `balance`, `multipliers`, `maxGoals` |
| `POST /round/shot` | `roundId`, `zone` | `scored`, `goalkeeperZone`, `goals`, `multiplier`, `finished`, `payout?`, `balance?` |
| `POST /round/collect` | `roundId` | `payout`, `balance`, `transactionId` |
| `GET /round/current` | `sessionToken` | Estado de la ronda abierta (para recuperación) |
| `GET /history` | `sessionToken`, paginación | Últimas rondas |

### 6.3 Mapeo con el front-end actual

El juego ya expone esta API en `js/game.js` (objeto global `window.PenaltyShootoutGame`):

| Método del juego | Para qué se usa desde el adaptador |
|---|---|
| `configure({ balance, currency, externalWallet: true, autoResolveDemo: false })` | Inicializar con datos de la sesión. Con `externalWallet: true` el juego no modifica el saldo. |
| `resolveShot({ scored, zone, goalkeeperZone, transactionId })` | Entregar al juego el resultado del RNG. |
| `settleRound({ balance })` | Actualizar el saldo tras la liquidación. |

Eventos que emite el juego (`window.addEventListener('penalty:<evento>', …)`):

| Evento | Cuándo | Acción del adaptador |
|---|---|---|
| `penalty:round-started` | El jugador pulsa Jugar | Llamar a `/round/start` |
| `penalty:shot-requested` | El jugador elige zona | Llamar a `/round/shot` y devolver `resolveShot(...)` |
| `penalty:collect-requested` | El jugador pulsa Cobrar | Llamar a `/round/collect` y luego `settleRound(...)` |
| `penalty:shot-resolved` | Tras un gol | Informativo |
| `penalty:round-finished` | Fin de ronda | Informativo / analítica |
| `penalty:round-settled` | Tras `settleRound` | Informativo |

> **Cambios necesarios en el front-end antes de producción:** desactivar `autoResolveDemo` (en demo siempre marca gol), retirar la generación local de `roundId`, hacer que el importe de apuesta se valide y se tome del servidor, y gestionar errores de red y recuperación de ronda.

---

## 7. Reglas del juego (texto para el jugador)

> **Cómo jugar.** Elige tu apuesta y pulsa Jugar. Elige una zona de la portería para lanzar el penalti. Cada gol que marques te sube un escalón de la escalera de premios (x1.5, x2, x3, x6, x12). Tras cada gol puedes cobrar tu premio actual o seguir tirando para conseguir un multiplicador mayor. Si el portero ataja el penalti, pierdes la apuesta de la ronda.
>
> **Resultado.** El resultado de cada penalti lo determina un generador de números aleatorios del servidor. La zona que elijas no modifica la probabilidad de marcar.
>
> **Premio máximo.** El premio máximo es 12 veces tu apuesta.
>
> **RTP.** El retorno teórico al jugador es del 96 %.
>
> **Incidencias.** Si hay un fallo técnico, las rondas incompletas se anulan y las apuestas se devuelven. Los fallos anulan las jugadas y los pagos.

---

## 8. Lista de verificación para la integración

**Proveedor del juego**
- [ ] Game Server con CSPRNG y tabla de probabilidades de §5.2
- [ ] Adaptador front-end ↔ backend
- [ ] Desactivar `autoResolveDemo` y modo demo separado y claramente marcado
- [ ] Persistencia de rondas y recuperación tras desconexión
- [ ] Logs de auditoría (semilla, resultado, transacciones)
- [ ] Localización (idiomas y formato de moneda del operador)
- [ ] Reglas del juego/paytable en pantalla
- [ ] Pruebas de carga y de simulación de RTP (millones de rondas)
- [ ] Certificación del RNG y del juego

**Agregador / operador**
- [ ] Documentación de la API de wallet y entorno de pruebas (sandbox)
- [ ] Credenciales y secretos de firma de peticiones
- [ ] Configuración de monedas, límites y apuestas por operador
- [ ] Requisitos de juego responsable por jurisdicción
- [ ] Contrato de reporting y conciliación

---

## 9. Pendientes y decisiones abiertas

1. Agregador objetivo y jurisdicciones (determina protocolo de wallet y laboratorio de certificación).
2. RTP final y si se ofrecerán varias variantes.
3. Límites de apuesta (hoy el front-end solo exige `≥ 1`) y pago máximo por ronda.
4. Monedas soportadas (hoy fijo `$`).
5. Derechos de uso de los assets de marca TuZoca, o sustitución por assets propios.
