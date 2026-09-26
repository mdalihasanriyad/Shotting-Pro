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
scene.background = new THREE.Color(0x0f172a);
scene.fog = new THREE.FogExp2(0x0f172a, 0.012);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// --- Lighting ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
sunLight.position.set(30, 50, 20);
sunLight.castShadow = true;
scene.add(sunLight);

// --- Arena Map ---
const floorGeo = new THREE.PlaneGeometry(120, 120);
const floorMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(120, 30, 0x00ffcc, 0x334155);
grid.position.y = 0.01;
scene.add(grid);

// Cover Obstacles
const boxes = [];
function createBox(x, z, w, h, d) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshLambertMaterial({ color: 0x334155 });
    const box = new THREE.Mesh(geo, mat);
    box.position.set(x, h / 2, z);
    box.castShadow = true;
    box.receiveShadow = true;
    scene.add(box);
    boxes.push(box);
}

createBox(0, -20, 10, 4, 2);
createBox(-15, 0, 4, 5, 12);
createBox(15, 10, 8, 4, 8);
createBox(-20, -20, 6, 6, 6);
createBox(20, -25, 6, 6, 6);

// --- Player Weapon ---
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

// --- Player State & Physics ---
camera.position.set(0, 1.6, 20);
let health = 100, kills = 0, ammo = 30, maxAmmo = 30;
let isReloading = false, isAiming = false;
let isLocked = false;

// Movement & Jumping Variables
const moveState = { forward: false, backward: false, left: false, right: false };
let velocityY = 0;
let canJump = true;
const gravity = 0.015;
const jumpStrength = 0.35;
const playerHeight = 1.6;

// --- Pointer Lock Controls ---
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

// Keyboard Inputs
window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyW') moveState.forward = true;
    if (e.code === 'KeyS') moveState.backward = true;
    if (e.code === 'KeyA') moveState.left = true;
    if (e.code === 'KeyD') moveState.right = true;
    if (e.code === 'Space' && canJump) {
        velocityY = jumpStrength;
        canJump = false;
        playSound(200, 0.1, 'sine');
    }
    if (e.code === 'KeyR' && !isReloading && ammo < maxAmmo) reload();
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyW') moveState.forward = false;
    if (e.code === 'KeyS') moveState.backward = false;
    if (e.code === 'KeyA') moveState.left = false;
    if (e.code === 'KeyD') moveState.right = false;
});

// Aim Down Sight (ADS)
window.addEventListener('mousedown', (e) => {
    if (e.button === 2 && isLocked) {
        isAiming = true;
        camera.fov = 45;
        camera.updateProjectionMatrix();
        gunGroup.position.set(0, -0.12, -0.3);
    }
});
window.addEventListener('mouseup', (e) => {
    if (e.button === 2) {
        isAiming = false;
        camera.fov = 75;
        camera.updateProjectionMatrix();
        gunGroup.position.set(0.25, -0.2, -0.4);
    }
});
window.addEventListener('contextmenu', e => e.preventDefault());

// --- Humanoid Enemy Generator ---
const bots = [];

function createHumanoidBot() {
    const botGroup = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: 0xff4757 });

    // Head
    const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    const head = new THREE.Mesh(headGeo, mat);
    head.position.y = 1.6;
    head.castShadow = true;

    // Torso
    const torsoGeo = new THREE.BoxGeometry(0.6, 0.8, 0.3);
    const torso = new THREE.Mesh(torsoGeo, mat);
    torso.position.y = 1.0;
    torso.castShadow = true;

    // Arms
    const armGeo = new THREE.BoxGeometry(0.2, 0.7, 0.2);
    const leftArm = new THREE.Mesh(armGeo, mat);
    leftArm.position.set(-0.45, 1.0, 0);
    const rightArm = new THREE.Mesh(armGeo, mat);
    rightArm.position.set(0.45, 1.0, 0);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.22, 0.7, 0.22);
    const leftLeg = new THREE.Mesh(legGeo, mat);
    leftLeg.position.set(-0.18, 0.35, 0);
    const rightLeg = new THREE.Mesh(legGeo, mat);
    rightLeg.position.set(0.18, 0.35, 0);

    // Gun in Right Hand
    const botGunGeo = new THREE.BoxGeometry(0.1, 0.1, 0.5);
    const botGunMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const botGun = new THREE.Mesh(botGunGeo, botGunMat);
    botGun.position.set(0.45, 0.8, -0.2);

    botGroup.add(head, torso, leftArm, rightArm, leftLeg, rightLeg, botGun);
    botGroup.position.set((Math.random() - 0.5) * 80, 0, (Math.random() - 0.5) * 80);
    
    botGroup.userData = { 
        health: 100, 
        lastShoot: Date.now(), 
        leftLeg: leftLeg, 
        rightLeg: rightLeg,
        animTime: Math.random() * 10
    };

    scene.add(botGroup);
    bots.push(botGroup);
}

for (let i = 0; i < 6; i++) createHumanoidBot();

// --- Bullet Visual Effect ---
function createBulletTracer(start, end, color = 0x00ffcc) {
    const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
    const mat = new THREE.LineBasicMaterial({ color: color });
    const line = new THREE.Line(geo, mat);
    scene.add(line);
    setTimeout(() => scene.remove(line), 50);
}

// --- Player Shooting ---
const raycaster = new THREE.Raycaster();

window.addEventListener('mousedown', (e) => {
    if (!isLocked || e.button !== 0 || isReloading) return;

    if (ammo <= 0) {
        reload();
        return;
    }

    ammo--;
    document.getElementById('ammo').innerText = ammo;
    playSound(400, 0.1);

    // Recoil
    gunGroup.position.z += 0.08;
    setTimeout(() => gunGroup.position.z -= 0.08, 50);

    // Shooting Raycast
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const botMeshes = [];
    bots.forEach(b => b.children.forEach(c => botMeshes.push(c)));

    const intersects = raycaster.intersectObjects(botMeshes);

    const gunWorldPos = new THREE.Vector3();
    gunGroup.getWorldPosition(gunWorldPos);

    if (intersects.length > 0) {
        const hitMesh = intersects[0].object;
        const botGroup = hitMesh.parent;

        createBulletTracer(gunWorldPos, intersects[0].point, 0x00ffcc);
        botGroup.userData.health -= 50;

        if (botGroup.userData.health <= 0) {
            scene.remove(botGroup);
            bots.splice(bots.indexOf(botGroup), 1);
            kills++;
            document.getElementById('kills').innerText = kills;
            addKillFeed("Eliminated Enemy Humanoid");
            setTimeout(createHumanoidBot, 2000);
        }
    } else {
        const farPoint = new THREE.Vector3();
        raycaster.ray.at(50, farPoint);
        createBulletTracer(gunWorldPos, farPoint, 0x00ffcc);
    }
});

function reload() {
    isReloading = true;
    document.getElementById('ammo').innerText = "RELOADING...";
    setTimeout(() => {
        ammo = maxAmmo;
        document.getElementById('ammo').innerText = ammo;
        isReloading = false;
    }, 1500);
}

function addKillFeed(msg) {
    const feed = document.getElementById('kill-feed');
    const item = document.createElement('div');
    item.innerText = msg;
    feed.appendChild(item);
    setTimeout(() => item.remove(), 3000);
}

// --- Main Loop ---
function animate() {
    requestAnimationFrame(animate);

    if (isLocked) {
        // Horizontal Movement
        const moveSpeed = 0.12;
        if (moveState.forward) camera.translateZ(-moveSpeed);
        if (moveState.backward) camera.translateZ(moveSpeed);
        if (moveState.left) camera.translateX(-moveSpeed);
        if (moveState.right) camera.translateX(moveSpeed);

        // Jump & Gravity Physics
        camera.position.y += velocityY;
        velocityY -= gravity;

        if (camera.position.y <= playerHeight) {
            camera.position.y = playerHeight;
            velocityY = 0;
            canJump = true;
        }

        // Enemy AI & Shooting
        bots.forEach(bot => {
            bot.lookAt(camera.position.x, 0, camera.position.z);
            bot.translateZ(0.04);

            // Walking Animation
            bot.userData.animTime += 0.1;
            bot.userData.leftLeg.rotation.x = Math.sin(bot.userData.animTime) * 0.5;
            bot.userData.rightLeg.rotation.x = -Math.sin(bot.userData.animTime) * 0.5;

            // Enemy Attack Logic
            const dist = bot.position.distanceTo(camera.position);
            if (dist < 20 && Date.now() - bot.userData.lastShoot > 1800) {
                bot.userData.lastShoot = Date.now();
                
                // Bot Shoot Visual & Sound
                playSound(150, 0.1, 'square');
                const botGunPos = new THREE.Vector3();
                bot.children[6].getWorldPosition(botGunPos);
                createBulletTracer(botGunPos, camera.position, 0xff4757);

                health -= 12;
                document.getElementById('health-bar').style.width = Math.max(0, health) + '%';

                if (health <= 0) {
                    alert("GAME OVER! Total Kills: " + kills);
                    location.reload();
                }
            }
        });
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