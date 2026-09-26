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
scene.fog = new THREE.FogExp2(0x0a0f1d, 0.01);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// --- Lighting ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 0.9);
sunLight.position.set(40, 60, 20);
sunLight.castShadow = true;
scene.add(sunLight);

// --- Map Environment ---
const floorGeo = new THREE.PlaneGeometry(160, 160);
const floorMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(160, 40, 0x00ffcc, 0x334155);
grid.position.y = 0.01;
scene.add(grid);

function createStructure(x, y, z, w, h, d, color = 0x334155) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshLambertMaterial({ color: color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
}

// Structures
createStructure(0, 0, -30, 20, 12, 10, 0x1e293b);
createStructure(0, 12, -30, 16, 1, 8, 0x0f172a);
createStructure(-35, 0, -10, 10, 8, 20, 0x334155);
createStructure(35, 0, -10, 10, 8, 20, 0x334155);
createStructure(-15, 0, 10, 12, 3, 2, 0x475569);
createStructure(15, 0, 10, 12, 3, 2, 0x475569);
createStructure(0, 0, 25, 16, 4, 3, 0x475569);

// --- Weapons Data System ---
const WEAPONS = {
    1: { name: "RIFLE", ammo: 30, maxAmmo: 30, damage: 35, fireRate: 120, spread: 0.02, pellets: 1 },
    2: { name: "SNIPER", ammo: 5, maxAmmo: 5, damage: 120, fireRate: 800, spread: 0.001, pellets: 1 },
    3: { name: "SHOTGUN", ammo: 8, maxAmmo: 8, damage: 18, fireRate: 600, spread: 0.08, pellets: 8 }
};

let currentWeaponKey = 1;
let currentWeapon = WEAPONS[currentWeaponKey];

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

// --- Player Controls & State ---
camera.position.set(0, 1.6, 40);
let health = 100, kills = 0;
let isReloading = false, isAiming = false, isLocked = false;
let lastShotTime = 0;

// Movement, Slide & Jump
const moveState = { forward: false, backward: false, left: false, right: false };
let velocityY = 0;
let isGrounded = true;
let isSliding = false;
let slideTimer = 0;
const gravity = 0.015;
const jumpForce = 0.38;
let playerHeight = 1.6;

// Pointer Lock
const overlay = document.getElementById('overlay');
overlay.addEventListener('click', () => document.body.requestPointerLock());

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

// Key Handling & Weapon Switching
window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyW') moveState.forward = true;
    if (e.code === 'KeyS') moveState.backward = true;
    if (e.code === 'KeyA') moveState.left = true;
    if (e.code === 'KeyD') moveState.right = true;

    // Weapon Switch (1, 2, 3)
    if (['Digit1', 'Digit2', 'Digit3'].includes(e.code)) {
        switchWeapon(parseInt(e.code.replace('Digit', '')));
    }

    // Jump
    if (e.code === 'Space' && isGrounded && !isSliding) {
        velocityY = jumpForce;
        isGrounded = false;
        playSound(220, 0.1, 'sine');
    }

    // Slide Mechanic
    if ((e.code === 'KeyC' || e.code === 'ControlLeft') && isGrounded && !isSliding && moveState.forward) {
        isSliding = true;
        slideTimer = 25; // Slide Duration
        playerHeight = 0.8;
        camera.position.y = playerHeight;
        playSound(150, 0.2, 'triangle');
    }

    if (e.code === 'KeyR' && !isReloading) reload();
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyW') moveState.forward = false;
    if (e.code === 'KeyS') moveState.backward = false;
    if (e.code === 'KeyA') moveState.left = false;
    if (e.code === 'KeyD') moveState.right = false;
});

function switchWeapon(key) {
    if (isReloading || currentWeaponKey === key) return;
    currentWeaponKey = key;
    currentWeapon = WEAPONS[key];
    document.getElementById('weapon-name').innerText = `${currentWeapon.name} [${key}]`;
    document.getElementById('ammo').innerText = currentWeapon.ammo;
    document.getElementById('max-ammo').innerText = ` / ${currentWeapon.maxAmmo}`;
    playSound(600, 0.1, 'sine');
}

// Aim Down Sight (ADS) / Scope
window.addEventListener('mousedown', (e) => {
    if (e.button === 2 && isLocked) {
        isAiming = true;
        if (currentWeaponKey === 2) {
            // Sniper Scope Overlay
            document.getElementById('sniper-scope').style.display = 'block';
            document.getElementById('crosshair').style.display = 'none';
            gunGroup.visible = false;
            camera.fov = 20;
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

// --- Enemy Bots with Health Bars ---
const bots = [];

function createBot() {
    const botGroup = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: 0xff4757 });

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), mat); 
    head.position.y = 1.6;
    head.name = "head"; // Hitbox identifier

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.3), mat); 
    torso.position.y = 1.0;
    torso.name = "torso";

    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), mat); leftArm.position.set(-0.45, 1.0, 0);
    const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), mat); rightArm.position.set(0.45, 1.0, 0);
    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), mat); leftLeg.position.set(-0.18, 0.35, 0);
    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), mat); rightLeg.position.set(0.18, 0.35, 0);

    const botGun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.5), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    botGun.position.set(0.45, 0.8, -0.2);

    // Health Bar 3D Sprite above head
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 12;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ff4757'; ctx.fillRect(0, 0, 64, 12);
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture });
    const healthSprite = new THREE.Sprite(spriteMat);
    healthSprite.position.set(0, 2.1, 0);
    healthSprite.scale.set(1.2, 0.2, 1);

    botGroup.add(head, torso, leftArm, rightArm, leftLeg, rightLeg, botGun, healthSprite);
    botGroup.position.set((Math.random() - 0.5) * 120, 0, (Math.random() - 0.5) * 120);
    
    botGroup.userData = { 
        health: 100, 
        lastShoot: Date.now(),
        leftLeg: leftLeg,
        rightLeg: rightLeg,
        animTime: Math.random() * 10,
        healthSprite: healthSprite,
        canvas: canvas,
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

for (let i = 0; i < 8; i++) createBot();

// --- Bullet Tracers ---
function createBulletTracer(start, end, color = 0x00ffcc) {
    const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
    const mat = new THREE.LineBasicMaterial({ color: color });
    const line = new THREE.Line(geo, mat);
    scene.add(line);
    setTimeout(() => scene.remove(line), 40);
}

// --- Shooting Mechanic ---
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
    gunGroup.position.z += 0.1;
    setTimeout(() => gunGroup.position.z -= 0.1, 50);

    const gunWorldPos = new THREE.Vector3();
    gunGroup.getWorldPosition(gunWorldPos);

    // Multi-pellet shooting for Shotgun, single for others
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
                dmg *= 2.0; // Headshot 2x Damage
                isHeadshot = true;
            }

            botGroup.userData.health -= dmg;
            updateBotHealthBar(botGroup);

            if (botGroup.userData.health <= 0) {
                scene.remove(botGroup);
                bots.splice(bots.indexOf(botGroup), 1);
                kills++;
                document.getElementById('kills').innerText = kills;
                addKillFeed(isHeadshot ? "🎯 HEADSHOT ELIMINATION!" : "Eliminated Enemy Bot");
                setTimeout(createBot, 2000);
            }
        } else {
            const farPoint = new THREE.Vector3();
            raycaster.ray.at(60, farPoint);
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
    }, 1400);
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
    setTimeout(() => overlay.style.opacity = '0', 150);
}

// --- Minimap Radar Renderer ---
const mapCanvas = document.getElementById('minimap');
const mapCtx = mapCanvas.getContext('2d');

function updateMinimap() {
    mapCtx.clearRect(0, 0, 140, 140);
    
    // Player Dot
    mapCtx.fillStyle = '#00ffcc';
    mapCtx.beginPath();
    mapCtx.arc(70, 70, 4, 0, Math.PI * 2);
    mapCtx.fill();

    // Bots Red Dots
    mapCtx.fillStyle = '#ff4757';
    bots.forEach(bot => {
        const dx = (bot.position.x - camera.position.x) * 0.8;
        const dz = (bot.position.z - camera.position.z) * 0.8;
        if (Math.hypot(dx, dz) < 65) {
            mapCtx.beginPath();
            mapCtx.arc(70 + dx, 70 + dz, 3, 0, Math.PI * 2);
            mapCtx.fill();
        }
    });
}

// --- Main Game Loop ---
function animate() {
    requestAnimationFrame(animate);

    if (isLocked) {
        // Player Movement & Slide Speed
        let moveSpeed = isSliding ? 0.22 : 0.14;

        if (isSliding) {
            camera.translateZ(-moveSpeed);
            slideTimer--;
            if (slideTimer <= 0) {
                isSliding = false;
                playerHeight = 1.6;
            }
        } else {
            if (moveState.forward) camera.translateZ(-moveSpeed);
            if (moveState.backward) camera.translateZ(moveSpeed);
            if (moveState.left) camera.translateX(-moveSpeed);
            if (moveState.right) camera.translateX(moveSpeed);
        }

        // Gravity & Jump Physics
        camera.position.y += velocityY;
        velocityY -= gravity;

        if (camera.position.y <= playerHeight) {
            camera.position.y = playerHeight;
            velocityY = 0;
            isGrounded = true;
        }

        // Bot AI & Animations
        bots.forEach(bot => {
            bot.lookAt(camera.position.x, 0, camera.position.z);
            bot.translateZ(0.04);

            bot.userData.animTime += 0.1;
            bot.userData.leftLeg.rotation.x = Math.sin(bot.userData.animTime) * 0.5;
            bot.userData.rightLeg.rotation.x = -Math.sin(bot.userData.animTime) * 0.5;

            // Attack Logic
            const dist = bot.position.distanceTo(camera.position);
            if (dist < 22 && Date.now() - bot.userData.lastShoot > 1800) {
                bot.userData.lastShoot = Date.now();
                
                playSound(150, 0.1, 'square');
                showDamageOverlay();

                const botGunPos = new THREE.Vector3();
                bot.children[6].getWorldPosition(botGunPos);
                createBulletTracer(botGunPos, camera.position, 0xff4757);

                health -= 10;
                document.getElementById('health-bar').style.width = Math.max(0, health) + '%';

                if (health <= 0) {
                    alert("GAME OVER! Total Kills: " + kills);
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