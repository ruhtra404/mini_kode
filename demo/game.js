// 3D赛车游戏主逻辑
let scene, camera, renderer;
let car, track;
let keys = {};
let carSpeed = 0;
let carRotation = 0;
let gameState = 'menu'; // menu, playing, finished
let startTime, currentTime;
let laps = 0;
let checkpoints = [];
let lastCheckpoint = -1;

// 游戏配置
const config = {
    maxSpeed: 0.5,
    acceleration: 0.008,
    deceleration: 0.005,
    turnSpeed: 0.03,
    friction: 0.98
};

function init() {
    // 创建场景
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x87CEEB, 100, 500);
    
    // 创建相机
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 10);
    
    // 创建渲染器
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x87CEEB);
    document.body.appendChild(renderer.domElement);
    renderer.domElement.id = 'gameCanvas';
    
    // 创建光照
    setupLighting();
    
    // 创建赛道
    createTrack();
    
    // 创建赛车
    createCar();
    
    // 创建环境
    createEnvironment();
    
    // 事件监听
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('keydown', (e) => keys[e.key] = true);
    window.addEventListener('keyup', (e) => keys[e.key] = false);
}

function setupLighting() {
    // 环境光
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);
    
    // 方向光（太阳光）
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    scene.add(directionalLight);
}

function createTrack() {
    // 创建赛道几何体
    const trackGeometry = new THREE.RingGeometry(20, 40, 32);
    const trackMaterial = new THREE.MeshLambertMaterial({ 
        color: 0x333333,
        side: THREE.DoubleSide 
    });
    
    track = new THREE.Mesh(trackGeometry, trackMaterial);
    track.rotation.x = -Math.PI / 2;
    track.receiveShadow = true;
    scene.add(track);
    
    // 创建赛道边界
    createTrackBorders();
    
    // 创建检查点
    createCheckpoints();
    
    // 创建地面
    const groundGeometry = new THREE.PlaneGeometry(200, 200);
    const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x90EE90 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    ground.receiveShadow = true;
    scene.add(ground);
}

function createTrackBorders() {
    // 外边界
    const outerBorderGeometry = new THREE.TorusGeometry(40, 0.5, 8, 100);
    const borderMaterial = new THREE.MeshLambertMaterial({ color: 0xff0000 });
    const outerBorder = new THREE.Mesh(outerBorderGeometry, borderMaterial);
    outerBorder.rotation.x = -Math.PI / 2;
    outerBorder.position.y = 0.5;
    scene.add(outerBorder);
    
    // 内边界
    const innerBorderGeometry = new THREE.TorusGeometry(20, 0.5, 8, 100);
    const innerBorder = new THREE.Mesh(innerBorderGeometry, borderMaterial);
    innerBorder.rotation.x = -Math.PI / 2;
    innerBorder.position.y = 0.5;
    scene.add(innerBorder);
}

function createCheckpoints() {
    const checkpointCount = 4;
    for (let i = 0; i < checkpointCount; i++) {
        const angle = (i / checkpointCount) * Math.PI * 2;
        const radius = 30;
        
        const checkpointGeometry = new THREE.BoxGeometry(2, 5, 0.2);
        const checkpointMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xffff00,
            transparent: true,
            opacity: 0.3
        });
        
        const checkpoint = new THREE.Mesh(checkpointGeometry, checkpointMaterial);
        checkpoint.position.x = Math.cos(angle) * radius;
        checkpoint.position.z = Math.sin(angle) * radius;
        checkpoint.position.y = 2.5;
        checkpoint.userData = { id: i, passed: false };
        
        scene.add(checkpoint);
        checkpoints.push(checkpoint);
    }
}

function createCar() {
    // 车身
    const carBodyGeometry = new THREE.BoxGeometry(2, 0.8, 4);
    const carBodyMaterial = new THREE.MeshLambertMaterial({ color: 0xff0000 });
    const carBody = new THREE.Mesh(carBodyGeometry, carBodyMaterial);
    carBody.position.y = 0.5;
    carBody.castShadow = true;
    
    // 车窗
    const windowGeometry = new THREE.BoxGeometry(1.6, 0.4, 1.5);
    const windowMaterial = new THREE.MeshLambertMaterial({ color: 0x4444ff, transparent: true, opacity: 0.7 });
    const carWindow = new THREE.Mesh(windowGeometry, windowMaterial);
    carWindow.position.set(0, 0.9, 0.5);
    
    // 车轮
    const wheelGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16);
    const wheelMaterial = new THREE.MeshLambertMaterial({ color: 0x222222 });
    
    const wheels = [];
    const wheelPositions = [
        { x: -0.8, y: 0.2, z: 1.2 },
        { x: 0.8, y: 0.2, z: 1.2 },
        { x: -0.8, y: 0.2, z: -1.2 },
        { x: 0.8, y: 0.2, z: -1.2 }
    ];
    
    wheelPositions.forEach(pos => {
        const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        wheel.position.set(pos.x, pos.y, pos.z);
        wheel.rotation.z = Math.PI / 2;
        wheel.castShadow = true;
        wheels.push(wheel);
    });
    
    // 创建赛车组
    car = new THREE.Group();
    car.add(carBody);
    car.add(carWindow);
    wheels.forEach(wheel => car.add(wheel));
    
    // 设置初始位置
    car.position.set(30, 0, 0);
    car.userData.wheels = wheels;
    
    scene.add(car);
}

function createEnvironment() {
    // 创建一些装饰性的树木
    for (let i = 0; i < 20; i++) {
        const tree = createTree();
        const angle = Math.random() * Math.PI * 2;
        const distance = 50 + Math.random() * 30;
        tree.position.x = Math.cos(angle) * distance;
        tree.position.z = Math.sin(angle) * distance;
        scene.add(tree);
    }
    
    // 创建建筑物
    for (let i = 0; i < 10; i++) {
        const building = createBuilding();
        const angle = Math.random() * Math.PI * 2;
        const distance = 60 + Math.random() * 40;
        building.position.x = Math.cos(angle) * distance;
        building.position.z = Math.sin(angle) * distance;
        scene.add(building);
    }
}

function createTree() {
    const tree = new THREE.Group();
    
    // 树干
    const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.8, 4);
    const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = 2;
    trunk.castShadow = true;
    
    // 树冠
    const foliageGeometry = new THREE.SphereGeometry(3, 8, 6);
    const foliageMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
    const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
    foliage.position.y = 5;
    foliage.castShadow = true;
    
    tree.add(trunk);
    tree.add(foliage);
    
    return tree;
}

function createBuilding() {
    const height = 5 + Math.random() * 15;
    const buildingGeometry = new THREE.BoxGeometry(5, height, 5);
    const buildingMaterial = new THREE.MeshLambertMaterial({ 
        color: new THREE.Color(0.5 + Math.random() * 0.5, 0.5 + Math.random() * 0.5, 0.5 + Math.random() * 0.5)
    });
    const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
    building.position.y = height / 2;
    building.castShadow = true;
    building.receiveShadow = true;
    
    return building;
}

function updateCar() {
    if (gameState !== 'playing') return;
    
    // 处理输入
    if (keys['ArrowUp']) {
        carSpeed = Math.min(carSpeed + config.acceleration, config.maxSpeed);
    } else if (keys['ArrowDown']) {
        carSpeed = Math.max(carSpeed - config.acceleration * 2, -config.maxSpeed / 2);
    } else {
        carSpeed *= config.friction;
    }
    
    // 转向（只有在移动时才能转向）
    if (Math.abs(carSpeed) > 0.01) {
        if (keys['ArrowLeft']) {
            carRotation += config.turnSpeed * (carSpeed / config.maxSpeed);
        }
        if (keys['ArrowRight']) {
            carRotation -= config.turnSpeed * (carSpeed / config.maxSpeed);
        }
    }
    
    // 手刹
    if (keys[' ']) {
        carSpeed *= 0.95;
    }
    
    // 重置位置
    if (keys['r'] || keys['R']) {
        car.position.set(30, 0, 0);
        car.rotation.y = 0;
        carSpeed = 0;
        carRotation = 0;
    }
    
    // 应用移动
    car.rotation.y = carRotation;
    car.position.x += Math.sin(carRotation) * carSpeed;
    car.position.z += Math.cos(carRotation) * carSpeed;
    
    // 边界检测
    const distance = Math.sqrt(car.position.x * car.position.x + car.position.z * car.position.z);
    if (distance < 20 || distance > 40) {
        carSpeed *= 0.5; // 撞墙减速
        // 推回赛道内
        const pushDirection = distance < 20 ? 1 : -1;
        car.position.x = (car.position.x / distance) * (20 + 1) * pushDirection;
        car.position.z = (car.position.z / distance) * (20 + 1) * pushDirection;
    }
    
    // 更新车轮旋转
    if (car.userData.wheels) {
        car.userData.wheels.forEach(wheel => {
            wheel.rotation.x += carSpeed * 2;
        });
    }
    
    // 检查检查点
    checkCheckpoints();
}

function checkCheckpoints() {
    checkpoints.forEach(checkpoint => {
        const distance = car.position.distanceTo(checkpoint.position);
        if (distance < 10 && !checkpoint.userData.passed) {
            checkpoint.userData.passed = true;
            
            // 检查是否按顺序通过所有检查点
            const expectedCheckpoint = (lastCheckpoint + 1) % checkpoints.length;
            if (checkpoint.userData.id === expectedCheckpoint) {
                lastCheckpoint = expectedCheckpoint;
                
                // 如果完成一圈
                if (expectedCheckpoint === 0 && lastCheckpoint > 0) {
                    laps++;
                    if (laps >= 3) {
                        gameState = 'finished';
                        alert(`恭喜完成！用时: ${Math.floor((Date.now() - startTime) / 1000)}秒`);
                    }
                }
            }
        }
    });
}

function updateCamera() {
    // 第三人称相机跟随
    const idealOffset = new THREE.Vector3(
        Math.sin(carRotation) * -10,
        5,
        Math.cos(carRotation) * -10
    );
    
    camera.position.lerp(
        car.position.clone().add(idealOffset),
        0.1
    );
    camera.lookAt(car.position);
}

function updateUI() {
    if (gameState === 'playing') {
        document.getElementById('speed').textContent = Math.floor(Math.abs(carSpeed) * 200);
        document.getElementById('laps').textContent = laps;
        document.getElementById('time').textContent = Math.floor((Date.now() - startTime) / 1000);
    }
}

function animate() {
    requestAnimationFrame(animate);
    
    updateCar();
    updateCamera();
    updateUI();
    
    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function startGame() {
    // 隐藏开始画面，显示游戏UI
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('ui').style.display = 'block';
    document.getElementById('controls').style.display = 'block';
    
    // 重置游戏状态
    gameState = 'playing';
    startTime = Date.now();
    laps = 0;
    lastCheckpoint = -1;
    carSpeed = 0;
    carRotation = 0;
    
    // 重置赛车位置
    car.position.set(30, 0, 0);
    car.rotation.y = 0;
    
    // 重置检查点
    checkpoints.forEach(checkpoint => {
        checkpoint.userData.passed = false;
    });
}

// 启动游戏
init();
animate();