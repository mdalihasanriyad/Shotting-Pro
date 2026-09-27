// --- Sound Engine (Web Audio API) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(freq, duration, type = 'sawtooth') {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

// --- Engine Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0f1d);
scene.fog = new THREE.FogExp2(0x0a0f1d, 0.008);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// --- Lighting ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
sunLight.position.set(50, 80, 30);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
scene.add(sunLight);

// Point lights for Cyber Vibe
const light1 = new THREE.PointLight(0x00ffcc, 2, 40);
light1.position.set(0, 10, 0);
scene.add(light1);

// --- Map Builder (Cyber Industrial Arena) ---
const mapColliders = [];

function createBox(x, y, z, w, h, d, color = 0x334155, isStructure = true) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshLambertMaterial({ color: color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    if (isStructure) {
        mapColliders.push(new THREE.Box3().setFromObject(mesh));
    }
    return mesh;
}

// Ground Floor
const floorGeo = new THREE.PlaneGeometry(200, 200);
const floorMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(200, 50, 0x00ffcc, 0x334155);
grid.position.y = 0.01;
scene.add(grid);

// Outer Arena Boundaries
createBox(0, 0, -100, 200, 15, 4, 0x0f172a);
createBox(0, 0, 100, 200, 15, 4, 0x0f172a);
createBox(-100, 0, 0, 4, 15, 200, 0x0f172a);
createBox(100, 0, 0, 4, 15, 200, 0x0f172a);

// Central Tactical Fortress Building (Two-Storey)
createBox(0, 0, 0, 30, 8, 30, 0x1e293b); // Ground floor walls
createBox(0, 8, 0, 32, 1, 32, 0x334155); // 2nd Floor Deck

// Watchtowers at Corners
function createWatchtower(x, z) {
    createBox(x, 0, z, 4, 14, 4, 0x0f172a); // Tower base
    createBox(x, 14, z, 10, 1, 10, 0x334155); // Tower platform
    createBox(x, 15, z + 4.5, 10, 2, 1, 0x00ffcc); // Barrier
    createBox(x, 15, z - 4.5, 10, 2, 1, 0x00ffcc);
}
createWatchtower(-60, -60);
createWatchtower(60, -60);
createWatchtower(-60, 60);
createWatchtower(60, 60);

// Cover Blocks & Shipping Containers
createBox(-25, 0, -35, 12, 6, 6, 0xef4444); // Red Container
createBox(25, 0, -35, 12, 6, 6, 0x3b82f6); // Blue Container
createBox(-35, 0, 25, 6, 6, 12, 0xeab308);  // Yellow Container
createBox(35, 0, 25, 6, 6, 12, 0x10b981);  // Green Container

// Scatter Concrete Barricades
createBox(-10, 0, -20, 8, 3, 2, 0x64748b);
createBox(10, 0, -20, 8, 3, 2, 0x64748b);
createBox(-10, 0, 20, 8, 3, 2, 0x64748b);
createBox(10, 0, 20, 8, 3, 2, 0x64748b);

// --- Health Drops / Medkits System ---
const medkits = [];

function spawnMedkit(x, z) {
    const group = new THREE.Group();
    const boxGeo = new THREE.BoxGeometry(1.5, 1, 1);
    const boxMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const box = new THREE.Mesh(boxGeo, boxMat);

    const crossGeo = new THREE.BoxGeometry(0.8, 0.8, 0.2);
    const crossMat = new THREE.MeshBasicMaterial({ color: 0x2ed573 });
    const cross = new THREE.Mesh(crossGeo, crossMat);
    cross.position.z = 0.51;

    group.add(box, cross);
    group.position.set(x, 0.8, z);
    scene.add(group);

    medkits.push(group);
}

// Fixed Medkit locations
spawnMedkit(-25, -30);
spawnMedkit(25, -30);
spawnMedkit(0, 0);

// --- Weapons Data System ---
const WEAPONS = {
    1: { name: "ASSAULT RIFLE", ammo: 30, maxAmmo: 30, damage: 32, fireRate: 110, spread: 0.02, pellets: 1 },
    2: { name: "SNIPER RIFLE", ammo: 5, maxAmmo: 5, damage: 110, fireRate: 750, spread: 0.001, pellets: 1 },
    3: { name: "SHOTGUN", ammo: 8, maxAmmo: 8, damage: 18, fireRate: 550, spread: 0.08, pellets: 8 },
    4: { name: "DUAL PISTOLS", ammo: 24, maxAmmo: 24, damage: 22, fireRate: 80, spread: 0.035, pellets: 1 }
};

let selectedWeaponKey = 1; // Default from menu selection
let currentWeaponKey = 1;
let currentWeapon = WEAPONS[currentWeaponKey];

// Pre-game Gun Selection Setup
const weaponCards = document.querySelectorAll('.weapon-card');
weaponCards.forEach(card => {
    card.addEventListener('click', () => {
        weaponCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        selectedWeaponKey = parseInt(card.dataset.weapon);
    });
});

// --- Player Weapon Model ---
const gunGroup = new THREE.Group();
const bodyGeo = new THREE.BoxGeometry(0.15, 0.2, 0.7);
const bodyMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
const gunBody = new THREE.Mesh(bodyGeo, bodyMat);

const barrelGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.6);
const barrelMat = new THREE.MeshLambertMaterial({ color: 0x000000 });
const barrel = new THREE.Mesh(barrelGeo, barrelMat);
barrel.rotation.x = Math.PI / 2;
barrel.position.set(0, 0.05, -0.4);

gunGroup.add(gunBody, barrel);
gunGroup.position.set(0.25, -0.2, -0.4);
camera.add(gunGroup);
scene.add(camera);

// --- Player Controls, Movement & State ---
camera.position.set(0, 1.6, 50);
let health = 100, kills = 0, wave = 1;
let isReloading = false, isAiming = false, isLocked = false;
let lastShotTime = 0;

const moveState = { forward: false, backward: false, left: false, right: false, sprint: false };
let velocityY = 0;
let isGrounded = true;
let isSliding = false;
let slideTimer = 0;
const gravity = 0.015;
const jumpForce = 0.36;
let playerHeight = 1.6;

// Pointer Lock & Start Game
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('start-btn');

startBtn.addEventListener('click', () => {
    switchWeapon(selectedWeaponKey);
    document.body.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
    isLocked = (document.pointerLockElement === document.body);
    overlay.style.display = isLocked ? 'none' : 'flex';
});

let yaw = 0, pitch = 0;
document.addEventListener('mousemove', (e) => {
    if (!isLocked) return;
    yaw -= e.movementX * 0.002;
    pitch -= e.movementY * 0.002;
    pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, pitch));

    camera.rotation.order = "YXZ";
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
});

// Key Handling
window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyW') moveState.forward = true;
    if (e.code === 'KeyS') moveState.backward = true;
    if (e.code === 'KeyA') moveState.left = true;
    if (e.code === 'KeyD') moveState.right = true;
    if (e.code === 'ShiftLeft') moveState.sprint = true;

    // Weapon Switch
    if (['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code)) {
        switchWeapon(parseInt(e.code.replace('Digit', '')));
    }

    // Jump
    if (e.code === 'Space' && isGrounded && !isSliding) {
        velocityY = jumpForce;
        isGrounded = false;
        playSound(220, 0.1, 'sine');
    }

    // Slide Mechanic (Sprint + C / Ctrl)
    if ((e.code === 'KeyC' || e.code === 'ControlLeft') && isGrounded && !isSliding && moveState.forward) {
        isSliding = true;
        slideTimer = 28;
        playerHeight = 0.8;
        camera.position.y = playerHeight;
        playSound(140, 0.25, 'triangle');
    }

    if (e.code === 'KeyR' && !isReloading) reload();
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyW') moveState.forward = false;
    if (e.code === 'KeyS') moveState.backward = false;
    if (e.code === 'KeyA') moveState.left = false;
    if (e.code === 'KeyD') moveState.right = false;
    if (e.code === 'ShiftLeft') moveState.sprint = false;
});

function switchWeapon(key) {
    if (isReloading || (currentWeaponKey === key && isLocked)) return;
    currentWeaponKey = key;
    currentWeapon = WEAPONS[key];
    document.getElementById('weapon-name').innerText = `${currentWeapon.name} [${key}]`;
    document.getElementById('ammo').innerText = currentWeapon.ammo;
    document.getElementById('max-ammo').innerText = ` / ${currentWeapon.maxAmmo}`;
    playSound(550, 0.1, 'sine');
}

// Aiming / Scope
window.addEventListener('mousedown', (e) => {
    if (e.button === 2 && isLocked) {
        isAiming = true;
        if (currentWeaponKey === 2) {
            document.getElementById('sniper-scope').style.display = 'block';
            document.getElementById('crosshair').style.display = 'none';
            gunGroup.visible = false;
            camera.fov = 18;
        } else {
            camera.fov = 45;
            gunGroup.position.set(0, -0.12, -0.3);
        }
        camera.updateProjectionMatrix();
    }
});

window.addEventListener('mouseup', (e) => {
    if (e.button === 2) {
        isAiming = false;
        document.getElementById('sniper-scope').style.display = 'none';
        document.getElementById('crosshair').style.display = 'block';
        gunGroup.visible = true;
        camera.fov = 75;
        camera.updateProjectionMatrix();
        gunGroup.position.set(0.25, -0.2, -0.4);
    }
});
window.addEventListener('contextmenu', e => e.preventDefault());

// --- Realistic Humanoid Enemy System ---
const bots = [];

function createRealisticBot(x, z) {
    const botGroup = new THREE.Group();

    const suitMat = new THREE.MeshLambertMaterial({ color: 0x1e293b }); // Dark Tactical Suit
    const armorMat = new THREE.MeshLambertMaterial({ color: 0x0f172a }); // Kevlar Vest
    const visorMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc });   // Glowing Visor

    // Head + Tactical Helmet
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), suitMat);
    head.position.y = 1.65;
    head.name = "head";

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.05), visorMat);
    visor.position.set(0, 1.68, -0.2);

    // Torso & Tactical Armor
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.3), armorMat);
    torso.position.y = 1.05;
    torso.name = "torso";

    // Limbs
    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.65, 0.18), suitMat); leftArm.position.set(-0.4, 1.05, 0);
    const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.65, 0.18), suitMat); rightArm.position.set(0.4, 1.05, 0);
    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), suitMat); leftLeg.position.set(-0.16, 0.35, 0);
    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), suitMat); rightLeg.position.set(0.16, 0.35, 0);

    // Detailed Assault Rifle for Bot
    const botGun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.6), armorMat);
    botGun.position.set(0.35, 0.9, -0.25);

    // Dynamic 3D Health Bar Canvas Sprite
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 12;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#00ffcc'; ctx.fillRect(0, 0, 64, 12);
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture });
    const healthSprite = new THREE.Sprite(spriteMat);
    healthSprite.position.set(0, 2.15, 0);
    healthSprite.scale.set(1.2, 0.2, 1);

    botGroup.add(head, visor, torso, leftArm, rightArm, leftLeg, rightLeg, botGun, healthSprite);
    botGroup.position.set(x, 0, z);

    botGroup.userData = {
        health: 100,
        lastShoot: Date.now() + Math.random() * 1000,
        leftLeg: leftLeg,
        rightLeg: rightLeg,
        animTime: Math.random() * 10,
        flankOffset: (Math.random() - 0.5) * 1.5, // Flanking movement AI
        healthSprite: healthSprite,
        ctx: ctx,
        texture: texture
    };

    scene.add(botGroup);
    bots.push(botGroup);
}

function updateBotHealthBar(bot) {
    const ctx = bot.userData.ctx;
    const pct = Math.max(0, bot.userData.health) / 100;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 64, 12);
    ctx.fillStyle = '#00ffcc'; ctx.fillRect(0, 0, 64 * pct, 12);
    bot.userData.texture.needsUpdate = true;
}

// Wave Spawner
function spawnWave(count) {
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const radius = 60 + Math.random() * 20;
        const x = camera.position.x + Math.cos(angle) * radius;
        const z = camera.position.z + Math.sin(angle) * radius;
        createRealisticBot(x, z);
    }
}
spawnWave(6); // First Wave

// --- Shooting & Bullet System ---
function createBulletTracer(start, end, color = 0x00ffcc) {
    const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
    const mat = new THREE.LineBasicMaterial({ color: color });
    const line = new THREE.Line(geo, mat);
    scene.add(line);
    setTimeout(() => scene.remove(line), 40);
}

const raycaster = new THREE.Raycaster();

window.addEventListener('mousedown', (e) => {
    if (!isLocked || e.button !== 0 || isReloading) return;

    const now = Date.now();
    if (now - lastShotTime < currentWeapon.fireRate) return;
    lastShotTime = now;

    if (currentWeapon.ammo <= 0) { reload(); return; }

    currentWeapon.ammo--;
    document.getElementById('ammo').innerText = currentWeapon.ammo;
    playSound(currentWeaponKey === 2 ? 180 : 380, 0.12);

    // Recoil Visual
    gunGroup.position.z += 0.12;
    setTimeout(() => gunGroup.position.z -= 0.12, 50);

    const gunWorldPos = new THREE.Vector3();
    gunGroup.getWorldPosition(gunWorldPos);

    for (let i = 0; i < currentWeapon.pellets; i++) {
        const spreadX = (Math.random() - 0.5) * currentWeapon.spread;
        const spreadY = (Math.random() - 0.5) * currentWeapon.spread;

        raycaster.setFromCamera(new THREE.Vector2(spreadX, spreadY), camera);

        const botMeshes = [];
        bots.forEach(b => b.children.forEach(c => { if (c.type === "Mesh") botMeshes.push(c); }));

        const intersects = raycaster.intersectObjects(botMeshes);

        if (intersects.length > 0) {
            const hitMesh = intersects[0].object;
            const botGroup = hitMesh.parent;

            createBulletTracer(gunWorldPos, intersects[0].point, 0x00ffcc);

            let dmg = currentWeapon.damage;
            let isHeadshot = false;

            if (hitMesh.name === "head") {
                dmg *= 2.2; // Headshot Multiplier
                isHeadshot = true;
            }

            botGroup.userData.health -= dmg;
            updateBotHealthBar(botGroup);

            if (botGroup.userData.health <= 0) {
                // Drop Medkit on enemy death (30% chance)
                if (Math.random() < 0.3) {
                    spawnMedkit(botGroup.position.x, botGroup.position.z);
                }

                scene.remove(botGroup);
                bots.splice(bots.indexOf(botGroup), 1);
                kills++;
                document.getElementById('kills').innerText = kills;
                addKillFeed(isHeadshot ? "🎯 HEADSHOT ELIMINATION!" : "Eliminated Cyber Bot");

                // Check Wave Completion
                if (bots.length === 0) {
                    wave++;
                    document.getElementById('wave-num').innerText = wave;
                    addKillFeed(`⚠️ WAVE ${wave} INCOMING!`);
                    setTimeout(() => spawnWave(6 + wave * 2), 2500);
                }
            }
        } else {
            const farPoint = new THREE.Vector3();
            raycaster.ray.at(70, farPoint);
            createBulletTracer(gunWorldPos, farPoint, 0x00ffcc);
        }
    }
});

function reload() {
    isReloading = true;
    document.getElementById('ammo').innerText = "RELOADING...";
    setTimeout(() => {
        currentWeapon.ammo = currentWeapon.maxAmmo;
        document.getElementById('ammo').innerText = currentWeapon.ammo;
        isReloading = false;
    }, 1300);
}

function addKillFeed(msg) {
    const feed = document.getElementById('kill-feed');
    const item = document.createElement('div');
    item.innerText = msg;
    feed.appendChild(item);
    setTimeout(() => item.remove(), 3000);
}

function showDamageOverlay() {
    const overlay = document.getElementById('damage-overlay');
    overlay.style.opacity = '1';
    setTimeout(() => overlay.style.opacity = '0', 120);
}

// --- Minimap Radar Renderer ---
const mapCanvas = document.getElementById('minimap');
const mapCtx = mapCanvas.getContext('2d');

function updateMinimap() {
    mapCtx.clearRect(0, 0, 140, 140);
    
    // Player
    mapCtx.fillStyle = '#00ffcc';
    mapCtx.beginPath();
    mapCtx.arc(70, 70, 4, 0, Math.PI * 2);
    mapCtx.fill();

    // Enemies
    mapCtx.fillStyle = '#ff4757';
    bots.forEach(bot => {
        const dx = (bot.position.x - camera.position.x) * 0.7;
        const dz = (bot.position.z - camera.position.z) * 0.7;
        if (Math.hypot(dx, dz) < 65) {
            mapCtx.beginPath();
            mapCtx.arc(70 + dx, 70 + dz, 3, 0, Math.PI * 2);
            mapCtx.fill();
        }
    });

    // Medkits
    mapCtx.fillStyle = '#2ed573';
    medkits.forEach(m => {
        const dx = (m.position.x - camera.position.x) * 0.7;
        const dz = (m.position.z - camera.position.z) * 0.7;
        if (Math.hypot(dx, dz) < 65) {
            mapCtx.fillRect(68 + dx, 68 + dz, 4, 4);
        }
    });
}

// --- Main Loop ---
function animate() {
    requestAnimationFrame(animate);

    if (isLocked) {
        // Sprinting & Sliding Speed
        let speed = isSliding ? 0.24 : (moveState.sprint ? 0.2 : 0.13);

        if (isSliding) {
            camera.translateZ(-speed);
            slideTimer--;
            if (slideTimer <= 0) {
                isSliding = false;
                playerHeight = 1.6;
            }
        } else {
            if (moveState.forward) camera.translateZ(-speed);
            if (moveState.backward) camera.translateZ(speed);
            if (moveState.left) camera.translateX(-speed);
            if (moveState.right) camera.translateX(speed);
        }

        // Gravity & Ground Height
        camera.position.y += velocityY;
        velocityY -= gravity;

        if (camera.position.y <= playerHeight) {
            camera.position.y = playerHeight;
            velocityY = 0;
            isGrounded = true;
        }

        // Medkit Pickup Collision Check
        medkits.forEach((m, idx) => {
            m.rotation.y += 0.02; // Rotate animation
            if (camera.position.distanceTo(m.position) < 2.0 && health < 100) {
                health = Math.min(100, health + 40);
                document.getElementById('health-bar').style.width = health + '%';
                document.getElementById('health-text').innerText = health + ' HP';
                playSound(800, 0.2, 'sine');
                scene.remove(m);
                medkits.splice(idx, 1);
            }
        });

        // Smart Flanking AI & Attack Loop
        bots.forEach(bot => {
            // Face towards player
            bot.lookAt(camera.position.x, 0, camera.position.z);

            // Flanking Movement (Angled approach)
            bot.translateX(bot.userData.flankOffset * 0.02);
            bot.translateZ(0.045 + wave * 0.005);

            // Legs Running Animation
            bot.userData.animTime += 0.12;
            bot.userData.leftLeg.rotation.x = Math.sin(bot.userData.animTime) * 0.6;
            bot.userData.rightLeg.rotation.x = -Math.sin(bot.userData.animTime) * 0.6;

            // Attack Logic
            const dist = bot.position.distanceTo(camera.position);
            if (dist < 25 && Date.now() - bot.userData.lastShoot > 1600) {
                bot.userData.lastShoot = Date.now();
                
                playSound(160, 0.1, 'square');
                showDamageOverlay();

                const botGunPos = new THREE.Vector3();
                bot.children[7].getWorldPosition(botGunPos);
                createBulletTracer(botGunPos, camera.position, 0xff4757);

                health -= 12;
                document.getElementById('health-bar').style.width = Math.max(0, health) + '%';
                document.getElementById('health-text').innerText = Math.max(0, health) + ' HP';

                if (health <= 0) {
                    alert(`GAME OVER!\nSurvived: Wave ${wave}\nTotal Kills: ${kills}`);
                    location.reload();
                }
            }
        });

        updateMinimap();
    }

    renderer.render(scene, camera);
}

animate();

// Window Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});