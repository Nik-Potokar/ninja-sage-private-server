import { callAmf } from './amf';

const root = document.querySelector('#game-client');
const sessionKeys = {
    uid: 'ninja-sage.uid',
    sessionKey: 'ninja-sage.session-key',
    characterId: 'ninja-sage.character-id',
};
const state = {
    uid: Number(sessionStorage.getItem(sessionKeys.uid)) || null,
    sessionKey: sessionStorage.getItem(sessionKeys.sessionKey),
    authMode: 'login',
    screen: 'auth',
    busy: false,
    notice: '',
    error: '',
    characters: [],
    characterId: Number(sessionStorage.getItem(sessionKeys.characterId)) || null,
    characterData: null,
    missions: [],
    enemies: new Map(),
    activeMission: null,
    battleToken: null,
    battle: null,
    selectedEnemyIndex: 0,
    missionResult: null,
};

const elements = [
    { id: 1, name: 'Viento' },
    { id: 2, name: 'Fuego' },
    { id: 3, name: 'Rayo' },
    { id: 4, name: 'Tierra' },
    { id: 5, name: 'Agua' },
];
const ranks = { 1: 'Genin', 3: 'Chunin', 5: 'Jounin', 7: 'Jounin especial', 8: 'Sannin', 10: 'Kage' };
const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    })[character]);
}

function formatNumber(value) {
    return new Intl.NumberFormat('es').format(Number(value) || 0);
}

function clearSession() {
    Object.values(sessionKeys).forEach((key) => sessionStorage.removeItem(key));
    state.uid = null;
    state.sessionKey = null;
    state.characterId = null;
    state.characters = [];
    state.characterData = null;
    state.activeMission = null;
    state.screen = 'auth';
    state.authMode = 'login';
}

function setFeedback(message = '', error = '') {
    state.notice = message;
    state.error = error;
}

function feedbackMarkup() {
    if (state.error) {
        return `<div class="feedback feedback-error" role="alert">${escapeHtml(state.error)}</div>`;
    }
    if (state.notice) {
        return `<div class="feedback feedback-success" role="status">${escapeHtml(state.notice)}</div>`;
    }
    return '';
}

function headerMarkup() {
    const character = state.characterData?.character_data;
    const level = character?.character_level;
    return `
        <header class="topbar">
            <a class="brand" href="/" aria-label="Ninja Sage, inicio">
                <span class="brand-mark">忍</span>
                <span><strong>NINJA SAGE</strong><small>CLIENTE WEB</small></span>
            </a>
            ${character ? `
                <div class="topbar-character">
                    <span class="status-dot"></span>
                    <span>${escapeHtml(character.character_name)}</span>
                    <span class="topbar-level">NIV. ${escapeHtml(level)}</span>
                </div>
                <button class="text-button" type="button" data-action="characters">Cambiar personaje</button>
                <button class="text-button" type="button" data-action="logout">Salir</button>
            ` : state.uid ? `
                <button class="text-button" type="button" data-action="logout">Salir</button>
            ` : '<span class="connection-label"><span class="status-dot"></span> Gateway AMF</span>'}
        </header>`;
}

function authMarkup() {
    const registering = state.authMode === 'register';
    return `
        <div class="auth-layout">
            <section class="welcome-panel">
                <div class="eyebrow"><span class="eyebrow-line"></span> TU ALDEA, TU HISTORIA</div>
                <h1>El camino<br>del ninja <span>empieza aquí.</span></h1>
                <p>Entra con tu cuenta del servidor para continuar tu aventura. Este cliente se conecta al gateway AMF real de esta instalación.</p>
                <div class="welcome-rune" aria-hidden="true">忍</div>
                <div class="welcome-foot"><span>01</span> CONEXIÓN DIRECTA AL SERVIDOR</div>
            </section>
            <section class="auth-card">
                <div class="section-kicker">ACCESO AL SERVIDOR</div>
                <h2>${registering ? 'Crear cuenta' : 'Bienvenido de vuelta'}</h2>
                <p class="muted">${registering ? 'Registra una cuenta para empezar a jugar.' : 'Inicia sesión con las credenciales de tu cuenta.'}</p>
                ${feedbackMarkup()}
                <form data-form="auth" class="form-stack">
                    ${registering ? `
                        <label>Correo electrónico
                            <input name="email" type="email" autocomplete="email" required maxlength="255" placeholder="ninja@aldea.test">
                        </label>` : ''}
                    <label>Nombre de cuenta
                        <input name="username" type="text" autocomplete="username" required maxlength="255" placeholder="Tu usuario">
                    </label>
                    <label>Contraseña
                        <input name="password" type="password" autocomplete="${registering ? 'new-password' : 'current-password'}" required minlength="1" placeholder="••••••••">
                    </label>
                    <button class="button button-primary button-wide" type="submit" ${state.busy ? 'disabled' : ''}>
                        ${state.busy ? '<span class="spinner"></span> Conectando…' : registering ? 'Crear cuenta' : 'Entrar al servidor'}
                    </button>
                </form>
                <div class="auth-switch">
                    ${registering ? '¿Ya tienes una cuenta?' : '¿Aún no tienes cuenta?'}
                    <button type="button" class="inline-button" data-action="toggle-auth">${registering ? 'Inicia sesión' : 'Crear una cuenta'}</button>
                </div>
                <p class="security-note"><span>◆</span> El acceso local se guarda solo en esta pestaña y se borra al salir; el gateway no expone cierre remoto.</p>
            </section>
        </div>`;
}

function characterCreationMarkup() {
    return `
        <section class="content-card creation-card">
            <div class="section-kicker">NUEVO PERSONAJE</div>
            <h2>Prepara tu identidad ninja</h2>
            <p class="muted">El servidor permite crear el personaje inicial asociado a esta cuenta.</p>
            ${feedbackMarkup()}
            <form data-form="character" class="form-stack">
                <label>Nombre del personaje
                    <input name="name" type="text" required minlength="2" maxlength="24" placeholder="Nombre">
                </label>
                <div class="form-row">
                    <label>Género
                        <select name="gender"><option value="0">Masculino</option><option value="1">Femenino</option></select>
                    </label>
                    <label>Elemento inicial
                        <select name="element">${elements.map((element) => `<option value="${element.id}">${element.name}</option>`).join('')}</select>
                    </label>
                </div>
                <label>Peinado
                    <select name="hair">${Array.from({ length: 12 }, (_, index) => `<option value="${index + 1}">Estilo ${String(index + 1).padStart(2, '0')}</option>`).join('')}</select>
                </label>
                <button class="button button-primary" type="submit" ${state.busy ? 'disabled' : ''}>
                    ${state.busy ? '<span class="spinner"></span> Guardando…' : 'Crear personaje'}
                </button>
            </form>
        </section>`;
}

function charactersMarkup() {
    return `
        <div class="simple-layout">
            <section class="content-card character-select-card">
                <div class="section-kicker">CUENTA CONECTADA · #${escapeHtml(state.uid)}</div>
                <h1>Elige tu ninja</h1>
                <p class="muted">Selecciona un personaje existente o crea uno nuevo.</p>
                ${state.characters.length ? `
                    <div class="character-list">
                        ${state.characters.map((character) => `
                            <button type="button" class="character-option" data-action="select-character" data-id="${escapeHtml(character.char_id)}" ${state.busy ? 'disabled' : ''}>
                                <span class="character-emblem">${escapeHtml((character.character_name || '?').slice(0, 1).toUpperCase())}</span>
                                <span class="character-option-copy">
                                    <strong>${escapeHtml(character.character_name)}</strong>
                                    <small>${escapeHtml(ranks[character.character_rank] || 'Ninja')} · Nivel ${escapeHtml(character.character_level)}</small>
                                </span>
                                <span class="character-arrow">↗</span>
                            </button>`).join('')}
                    </div>` : '<div class="empty-state">Esta cuenta todavía no tiene personajes.</div>'}
                ${characterCreationMarkup()}
            </section>
        </div>`;
}

function statsMarkup() {
    const character = state.characterData.character_data;
    const selectedElement = elements.find((element) => Number(element.id) === Number(character.character_element_1));
    return `
        <section class="character-banner">
            <div class="character-emblem character-emblem-large">${escapeHtml((character.character_name || '?').slice(0, 1).toUpperCase())}</div>
            <div class="character-identity">
                <div class="section-kicker">TU PERSONAJE</div>
                <h1>${escapeHtml(character.character_name)}</h1>
                <p>${escapeHtml(ranks[character.character_rank] || 'Ninja')} <span>·</span> ${escapeHtml(selectedElement?.name || 'Elemento sin definir')}</p>
            </div>
            <div class="stat-block"><span>NIVEL</span><strong>${escapeHtml(character.character_level)}</strong></div>
            <div class="stat-block"><span>ORO</span><strong>${formatNumber(character.character_gold)}</strong></div>
            <div class="stat-block"><span>XP</span><strong>${formatNumber(character.character_xp)}</strong></div>
        </section>`;
}

function missionCardMarkup(mission) {
    const enemyNames = mission.enemies.map((id) => state.enemies.get(id)?.name || id);
    return `
        <article class="mission-card">
            <div class="mission-card-top">
                <span class="mission-grade">RANGO ${escapeHtml(String(mission.grade || '—').toUpperCase())}</span>
                <span class="mission-level">NIVEL ${escapeHtml(mission.level)}</span>
            </div>
            <h3>${escapeHtml(mission.name)}</h3>
            <p>${escapeHtml(mission.description)}</p>
            <div class="mission-targets">
                <span class="target-icon">◎</span>
                <span>${mission.enemies.length} ${mission.enemies.length === 1 ? 'objetivo' : 'objetivos'}</span>
                <span class="target-divider">·</span>
                <span>${escapeHtml(enemyNames.join(', '))}</span>
            </div>
            <button type="button" class="button button-secondary" data-action="start-mission" data-id="${escapeHtml(mission.id)}" ${state.busy ? 'disabled' : ''}>
                ${state.busy ? '<span class="spinner"></span> Iniciando…' : 'Iniciar misión <span aria-hidden="true">→</span>'}
            </button>
        </article>`;
}

function dashboardMarkup() {
    const level = Number(state.characterData.character_data.character_level) || 1;
    const available = state.missions.filter((mission) => mission.visible !== false && Number(mission.level) <= level);
    return `
        <div class="game-layout">
            ${statsMarkup()}
            <div class="mission-heading">
                <div>
                    <div class="section-kicker">TABLERO DE MISIONES</div>
                    <h2>Una nueva tarea te espera</h2>
                </div>
                <span class="catalog-count">${available.length} DISPONIBLE${available.length === 1 ? '' : 'S'}</span>
            </div>
            ${feedbackMarkup()}
            ${available.length ? `<div class="mission-grid">${available.map(missionCardMarkup).join('')}</div>` : `
                <div class="empty-state">No hay misiones visibles para este nivel en el catálogo incluido.</div>`}
            <aside class="notice-panel">
                <span class="notice-symbol">i</span>
                <p><strong>Combate por turnos.</strong> El servidor resuelve el daño, los turnos enemigos y las recompensas; las estadísticas y acciones enviadas por el navegador no deciden el resultado.</p>
            </aside>
        </div>`;
}

function healthBarMarkup(current, maximum, kind) {
    const percent = maximum > 0 ? Math.max(0, Math.min(100, (current / maximum) * 100)) : 0;
    return `<div class="combat-meter ${kind}"><div class="meter-track"><span style="width:${percent}%"></span></div><small>${formatNumber(current)} / ${formatNumber(maximum)}</small></div>`;
}

function combatMarkup() {
    const mission = state.activeMission;
    const battle = state.battle;
    const player = battle.player;
    const finished = battle.status !== 'ongoing';
    const victory = battle.status === 'victory';
    const selectedEnemy = battle.enemies[state.selectedEnemyIndex];
    return `
        <div class="game-layout">
            ${statsMarkup()}
            <section class="active-mission content-card">
                <div class="mission-stamp"><span class="status-dot"></span> ${finished ? victory ? 'VICTORIA' : 'DERROTA' : `COMBATE · RONDA ${escapeHtml(battle.round)}`}</div>
                <div class="section-kicker">MISIÓN ${escapeHtml(mission.id)}</div>
                <h1>${escapeHtml(mission.name)}</h1>
                <p class="mission-description">${escapeHtml(mission.description)}</p>
                ${feedbackMarkup()}
                <div class="combatant-grid">
                    <article class="combatant-card player-combatant">
                        <div class="combatant-heading"><span class="combatant-tag">TU NINJA</span><strong>${escapeHtml(state.characterData.character_data.character_name)}</strong></div>
                        <span class="combat-stat-label">SALUD</span>
                        ${healthBarMarkup(player.hp, player.max_hp, 'health')}
                        <span class="combat-stat-label">CHAKRA</span>
                        ${healthBarMarkup(player.cp, player.max_cp, 'chakra')}
                    </article>
                    ${battle.enemies.map((enemy, index) => `
                        <button type="button" class="combatant-card enemy-combatant ${index === state.selectedEnemyIndex ? 'selected' : ''} ${enemy.hp <= 0 ? 'defeated' : ''}" data-action="select-target" data-index="${index}" ${finished || enemy.hp <= 0 ? 'disabled' : ''}>
                            <span class="combatant-tag">OBJETIVO ${String(index + 1).padStart(2, '0')}</span>
                            <strong>${escapeHtml(enemy.name)}</strong>
                            ${healthBarMarkup(enemy.hp, enemy.max_hp, 'health')}
                            <small class="target-hint">${enemy.hp <= 0 ? 'DERROTADO' : index === state.selectedEnemyIndex ? 'OBJETIVO SELECCIONADO' : 'SELECCIONAR OBJETIVO'}</small>
                        </button>`).join('')}
                </div>
                <div class="combat-log" aria-label="Registro de combate">
                    <div class="combat-log-heading">REGISTRO DE COMBATE</div>
                    ${[...battle.log].reverse().map((entry) => `<p>${escapeHtml(entry)}</p>`).join('')}
                </div>
                ${finished ? `
                    <div class="battle-result ${victory ? 'victory' : 'defeat'}">
                        <strong>${victory ? 'Misión completada' : 'Tu ninja ha caído'}</strong>
                        <span>${victory && state.missionResult?.result ? `Recompensas del servidor: ${formatNumber(state.missionResult.result[0])} XP y ${formatNumber(state.missionResult.result[1])} de oro.` : victory ? 'El servidor confirmó la victoria.' : 'No se concedieron recompensas.'}</span>
                    </div>
                    <button type="button" class="button button-secondary" data-action="back-to-missions">Volver al tablero</button>
                ` : `
                    <div class="combat-actions">
                        <button type="button" class="button button-primary" data-action="combat-attack" data-index="${state.selectedEnemyIndex}" ${state.busy || !selectedEnemy || selectedEnemy.hp <= 0 ? 'disabled' : ''}>Ataque básico <span aria-hidden="true">→</span></button>
                        ${battle.skills.map((skill) => `
                            <button type="button" class="button button-secondary" data-action="combat-skill" data-id="${escapeHtml(skill.id)}" data-index="${state.selectedEnemyIndex}" ${state.busy || !selectedEnemy || selectedEnemy.hp <= 0 || skill.cooldown_remaining > 0 || player.cp < skill.cp_cost ? 'disabled' : ''}>
                                ${escapeHtml(skill.name)} <span>${formatNumber(skill.cp_cost)} chakra</span>
                                ${skill.cooldown_remaining > 0 ? `<small>Espera ${skill.cooldown_remaining} turnos</small>` : ''}
                            </button>`).join('')}
                        <button type="button" class="button button-guard" data-action="combat-guard" ${state.busy ? 'disabled' : ''}>Defender <span>Reduce el siguiente daño</span></button>
                        ${state.busy ? '<span class="turn-pending"><span class="spinner"></span> Resolviendo turno…</span>' : ''}
                    </div>
                `}
            </section>
        </div>`;
}

function render() {
    const header = headerMarkup();
    let content;
    if (state.screen === 'auth') {
        content = authMarkup();
    } else if (state.screen === 'characters') {
        content = charactersMarkup();
    } else if (state.screen === 'combat') {
        content = combatMarkup();
    } else {
        content = dashboardMarkup();
    }
    root.innerHTML = `${header}<div class="page-shell">${content}</div><footer class="site-footer"><span>NINJA SAGE · CLIENTE INICIAL</span><span>Conectado mediante el gateway AMF del servidor</span></footer>`;
}

function requireSuccess(result, fallbackMessage) {
    if (!result || typeof result !== 'object' || Number(result.status) !== 1) {
        throw new Error(result?.error || result?.result || fallbackMessage);
    }
    return result;
}

function randomText(length) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const random = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(random, (value) => alphabet[value % alphabet.length]).join('');
}

function base64(bytes) {
    let binary = '';
    new Uint8Array(bytes).forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary);
}

async function encryptPassword(password) {
    const keyText = randomText(16);
    const ivText = randomText(15);
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(keyText), 'AES-CBC', false, ['encrypt']);
    const iv = new Uint8Array(16);
    iv.set(new TextEncoder().encode(ivText));
    iv[15] = 1;
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, key, new TextEncoder().encode(password));
    return { ciphertext: base64(ciphertext), ivText, keyText };
}

async function login(username, password) {
    const encrypted = await encryptPassword(password);
    const response = requireSuccess(await callAmf('SystemLogin.loginUser', [
        username,
        encrypted.ciphertext,
        encrypted.ivText,
        0,
        0,
        encrypted.keyText,
        0,
        0,
        password.length,
    ]), 'Usuario o contraseña incorrectos.');
    if (!response.sessionkey || !response.uid) {
        throw new Error('El servidor no devolvió una sesión válida.');
    }
    state.uid = Number(response.uid);
    state.sessionKey = response.sessionkey;
    sessionStorage.setItem(sessionKeys.uid, String(state.uid));
    sessionStorage.setItem(sessionKeys.sessionKey, state.sessionKey);
}

async function loadCharacters() {
    const response = requireSuccess(await callAmf('SystemLogin.getAllCharacters', [state.uid, state.sessionKey]), 'No se pudieron cargar los personajes.');
    state.characters = Array.isArray(response.account_data) ? response.account_data : [];
}

async function loadCatalogs() {
    const [missionResponse, enemyResponse] = await Promise.all([
        fetch('/game_data/mission.json'),
        fetch('/game_data/enemy.json'),
    ]);
    if (!missionResponse.ok || !enemyResponse.ok) {
        throw new Error('No se pudieron cargar los catálogos públicos de misiones y enemigos.');
    }
    const [missions, enemies] = await Promise.all([missionResponse.json(), enemyResponse.json()]);
    if (!Array.isArray(missions) || !Array.isArray(enemies)) {
        throw new Error('El formato de los catálogos públicos no es válido.');
    }
    state.missions = missions;
    state.enemies = new Map(enemies.map((enemy) => [enemy.id, enemy]));
}

async function selectCharacter(characterId) {
    const response = requireSuccess(await callAmf('SystemLogin.getCharacterData', [characterId, state.sessionKey]), 'No se pudieron cargar los datos del personaje.');
    if (!response.character_data) {
        throw new Error('El servidor no devolvió los datos del personaje.');
    }
    state.characterId = Number(characterId);
    state.characterData = response;
    sessionStorage.setItem(sessionKeys.characterId, String(state.characterId));
    await loadCatalogs();
    state.screen = 'dashboard';
    setFeedback();
    render();
}

async function withBusy(action) {
    state.busy = true;
    state.error = '';
    render();
    try {
        await action();
    } catch (error) {
        setFeedback('', error instanceof Error ? error.message : 'Ocurrió un error inesperado.');
    } finally {
        state.busy = false;
        render();
    }
}

async function handleAuth(values) {
    const username = String(values.get('username') || '').trim();
    const password = String(values.get('password') || '');
    if (state.authMode === 'register') {
        const response = requireSuccess(await callAmf('SystemLogin.registerUser', [
            username,
            String(values.get('email') || '').trim(),
            password,
            'web-client',
        ]), 'No se pudo crear la cuenta.');
        if (Number(response.status) !== 1) {
            throw new Error(response.result || response.error || 'No se pudo crear la cuenta.');
        }
    }
    await login(username, password);
    await loadCharacters();
    state.screen = 'characters';
    const storedCharacter = state.characters.find((character) => Number(character.char_id) === state.characterId);
    if (storedCharacter) {
        await selectCharacter(storedCharacter.char_id);
    } else {
        setFeedback(state.characters.length ? 'Sesión iniciada. Elige un personaje.' : 'Cuenta conectada. Crea tu primer personaje.');
    }
}

async function handleCharacterCreation(values) {
    const name = String(values.get('name') || '').trim();
    const result = requireSuccess(await callAmf('Character.characterRegister', [[
        state.uid,
        state.sessionKey,
        name,
        Number(values.get('gender')),
        Number(values.get('element')),
        '0|0',
        Number(values.get('hair')),
    ]]), 'No se pudo crear el personaje.');
    if (Number(result.status) !== 1) {
        throw new Error(result.error || result.result || 'No se pudo crear el personaje.');
    }
    await loadCharacters();
    const created = state.characters.find((character) => character.character_name === name);
    if (!created) {
        setFeedback('El servidor confirmó la creación. Selecciona el nuevo personaje.');
        return;
    }
    await selectCharacter(created.char_id);
}

async function startMission(missionId) {
    const mission = state.missions.find((entry) => entry.id === missionId);
    if (!mission) {
        throw new Error('La misión ya no está disponible en el catálogo.');
    }
    const enemies = mission.enemies.map((id) => state.enemies.get(id));
    if (enemies.some((enemy) => !enemy)) {
        throw new Error('Faltan datos de enemigos para iniciar esta misión.');
    }
    const enemyIds = mission.enemies.join(',');
    const enemyStats = enemies.map((enemy) => `id:${enemy.id}|hp:${enemy.hp}|agility:${enemy.agility}`).join('#');
    const unknown = '';
    const hashBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(enemyIds + enemyStats + unknown));
    const hash = Array.from(new Uint8Array(hashBytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
    const token = await callAmf('BattleSystem.startMission', [
        state.characterId,
        mission.id,
        enemyIds,
        enemyStats,
        unknown,
        hash,
        state.sessionKey,
    ]);
    if (typeof token !== 'string' || token.length === 0) {
        throw new Error(token?.error || 'El servidor no inició la misión.');
    }
    const response = requireSuccess(await callAmf('BattleSystem.getBattleState', [
        state.characterId,
        mission.id,
        token,
        state.sessionKey,
    ]), 'No se pudo preparar el combate.');
    state.battleToken = token;
    state.activeMission = mission;
    state.battle = response.battle;
    state.missionResult = null;
    state.selectedEnemyIndex = 0;
    state.screen = 'combat';
    setFeedback();
}

async function performCombatAction(action, targetIndex, skillId = '') {
    const response = requireSuccess(await callAmf('BattleSystem.performTurn', [
        state.characterId,
        state.activeMission.id,
        state.battleToken,
        action,
        Number(targetIndex),
        skillId,
        state.sessionKey,
    ]), 'No se pudo resolver el turno.');
    state.battle = response.battle;

    if (state.battle.status === 'victory') {
        state.missionResult = await callAmf('BattleSystem.finishMission', [
            state.characterId,
            state.activeMission.id,
            state.battleToken,
            '',
            0,
            state.sessionKey,
            '',
            '',
        ]);
        if (Number(state.missionResult?.status) !== 1) {
            throw new Error(state.missionResult?.error || 'La victoria se guardó, pero el servidor no pudo entregar las recompensas.');
        }
        const characterResponse = requireSuccess(await callAmf('SystemLogin.getCharacterData', [
            state.characterId,
            state.sessionKey,
        ]), 'Se obtuvieron las recompensas, pero no se pudo actualizar la ficha.');
        state.characterData = characterResponse;
    }

    if (state.battle.status === 'ongoing' && state.battle.enemies[state.selectedEnemyIndex]?.hp <= 0) {
        state.selectedEnemyIndex = state.battle.enemies.findIndex((enemy) => enemy.hp > 0);
    }
}

root.addEventListener('submit', (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) {
        return;
    }
    event.preventDefault();
    const values = new FormData(form);
    if (form.dataset.form === 'auth') {
        withBusy(() => handleAuth(values));
    } else if (form.dataset.form === 'character') {
        withBusy(() => handleCharacterCreation(values));
    }
});

root.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button || button.disabled) {
        return;
    }
    const { action } = button.dataset;
    if (action === 'toggle-auth') {
        state.authMode = state.authMode === 'login' ? 'register' : 'login';
        setFeedback();
        render();
    } else if (action === 'logout') {
        clearSession();
        setFeedback('Sesión cerrada.');
        render();
    } else if (action === 'characters') {
        state.screen = 'characters';
        setFeedback();
        render();
    } else if (action === 'select-character') {
        withBusy(() => selectCharacter(Number(button.dataset.id)));
    } else if (action === 'start-mission') {
        withBusy(() => startMission(button.dataset.id));
    } else if (action === 'back-to-missions') {
        state.screen = 'dashboard';
        state.activeMission = null;
        state.battleToken = null;
        state.battle = null;
        state.missionResult = null;
        setFeedback();
        render();
    } else if (action === 'select-target') {
        state.selectedEnemyIndex = Number(button.dataset.index);
        render();
    } else if (action === 'combat-attack') {
        withBusy(() => performCombatAction('attack', button.dataset.index));
    } else if (action === 'combat-skill') {
        withBusy(() => performCombatAction('skill', button.dataset.index, button.dataset.id));
    } else if (action === 'combat-guard') {
        withBusy(() => performCombatAction('guard', 0));
    }
});

async function initialize() {
    if (!state.uid || !state.sessionKey) {
        render();
        return;
    }
    state.screen = 'characters';
    state.busy = true;
    render();
    try {
        await loadCharacters();
        const character = state.characters.find((entry) => Number(entry.char_id) === state.characterId);
        if (character) {
            await selectCharacter(character.char_id);
        } else {
            setFeedback(state.characters.length ? 'Elige un personaje para continuar.' : 'Crea tu primer personaje para empezar.');
        }
    } catch (error) {
        clearSession();
        setFeedback('', error instanceof Error ? error.message : 'No se pudo restaurar la sesión.');
    } finally {
        state.busy = false;
        render();
    }
}

if (csrfToken && root) {
    initialize();
} else if (root) {
    root.textContent = 'No se pudo inicializar la sesión segura del cliente.';
}
