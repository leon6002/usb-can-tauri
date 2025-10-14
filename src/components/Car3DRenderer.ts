/**
 * 车辆3D渲染器 - 使用npm包版本的Three.js
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class Car3DRenderer {
    private container: HTMLElement;
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private car: THREE.Group | null = null;
    private mixer: THREE.AnimationMixer | null = null;
    private clock: THREE.Clock;
    private animationId: number | null = null;
    private controls: OrbitControls | null = null;
    
    // 门对象和动画相关
    private leftDoor: THREE.Object3D | null = null;
    private rightDoor: THREE.Object3D | null = null;
    private doorAnimations: { [key: string]: any } = {};
    private doorStates = {
        leftDoor: 0,  // 0: 关闭, 1: 开启
        rightDoor: 0
    };

    // 轮子对象和动画相关
    private wheels = {
        frontLeft: null as THREE.Object3D | null,
        frontRight: null as THREE.Object3D | null,
        rearLeft: null as THREE.Object3D | null,
        rearRight: null as THREE.Object3D | null
    };

    // 车灯对象
    private lights = {
        headlights: [] as THREE.Object3D[],
        taillights: [] as THREE.Object3D[],
        turnSignals: [] as THREE.Object3D[]
    };

    // 轮子旋转相关
    private wheelRotation = {
        isRotating: false,
        speed: 0,
        direction: 1 // 1: 前进, -1: 后退
    };

    // 道路移动相关
    private roadMovement = {
        isMoving: false,
        speed: 0,
        objects: [] as THREE.Object3D[]
    };

    // 车灯动画相关
    private lightAnimation: NodeJS.Timeout | null = null;

    // 运镜系统
    private cameraAnimation = {
        isActive: false,
        mode: 'orbit' as 'orbit' | 'showcase' | 'cinematic' | 'follow',
        startTime: 0,
        duration: 10000, // 10秒
        originalPosition: null as THREE.Vector3 | null,
        originalTarget: null as THREE.Vector3 | null,
        keyframes: [] as any[],
        currentKeyframe: 0
    };

    // 3D按钮系统
    private doorButtons = {
        leftDoor: null as THREE.Object3D | null,
        rightDoor: null as THREE.Object3D | null
    };
    private raycaster = new THREE.Raycaster();
    private mouse = new THREE.Vector2();
    private clickableObjects: THREE.Object3D[] = [];

    constructor(containerId: string) {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Container with id "${containerId}" not found`);
        }
        this.container = container;
        this.clock = new THREE.Clock();
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera();
        this.renderer = new THREE.WebGLRenderer();
        
        this.init();
    }

    private init(): void {
        this.createScene();
        this.createCamera();
        this.createRenderer();
        this.createLights();
        this.loadCarModel();
        this.setupControls();
        this.setupClickHandlers();
        this.animate();

        // 监听窗口大小变化
        this.onWindowResize = this.onWindowResize.bind(this);
        window.addEventListener('resize', this.onWindowResize);
    }

    private createScene(): void {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // 天蓝色背景
        this.scene.fog = new THREE.Fog(0x87CEEB, 10, 50);
    }

    private createCamera(): void {
        this.camera = new THREE.PerspectiveCamera(
            40,
            this.container.clientWidth / this.container.clientHeight,
            0.2,
            1000
        );
        this.camera.position.set(5, 3, 5);
        this.camera.lookAt(0, 0, 0);
    }

    private createRenderer(): void {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1;

        // 清空容器内容，防止重复渲染
        this.container.innerHTML = '';
        this.container.appendChild(this.renderer.domElement);
    }

    private createLights(): void {
        // 环境光
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);

        // 主光源
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(10, 10, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 50;
        directionalLight.shadow.camera.left = -10;
        directionalLight.shadow.camera.right = 10;
        directionalLight.shadow.camera.top = 10;
        directionalLight.shadow.camera.bottom = -10;
        this.scene.add(directionalLight);

        // 补光
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
        fillLight.position.set(-5, 5, -5);
        this.scene.add(fillLight);

        // 地面
        const groundGeometry = new THREE.PlaneGeometry(50, 50);
        const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x999999 });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -1;
        ground.receiveShadow = true;
        this.scene.add(ground);
    }

    private loadCarModel(): void {
        const loader = new GLTFLoader();
        
        loader.load(
            '/car-assets/models/Car.glb',
            (gltf) => {
                console.log('车辆模型加载成功');
                this.car = gltf.scene;
                
                // 设置模型属性并查找门对象
                this.car.traverse((child) => {
                    if (child.type === 'Mesh') {
                        const mesh = child as THREE.Mesh;
                        mesh.castShadow = true;
                        mesh.receiveShadow = false; // 车辆不接收阴影，保持亮度
                    }

                    // 查找门对象、轮子对象和车灯对象
                    if (child.name) {
                        // 识别车灯对象
                        this.identifyLights(child);

                        // 精确匹配门对象 - 只匹配主门体，排除所有子组件
                        if (this.isDoorMainBody(child.name, 'left')) {
                            this.leftDoor = child;
                            console.log('✓ 找到左门主体:', child.name);
                        } else if (this.isDoorMainBody(child.name, 'right')) {
                            this.rightDoor = child;
                            console.log('✓ 找到右门主体:', child.name);
                        }

                        // 查找轮子对象
                        if (this.isWheelObject(child.name)) {
                            this.assignWheel(child, child.name);
                        }
                    }
                });

                // 设置模型位置和缩放
                this.car.scale.set(1, 1, 1);
                this.car.position.set(0, -0.5, 0);
                
                this.scene.add(this.car);
                
                // 创建3D门按钮
                this.create3DDoorButtons();
                
                // 设置动画混合器
                if (gltf.animations && gltf.animations.length > 0) {
                    this.mixer = new THREE.AnimationMixer(this.car);
                    gltf.animations.forEach((clip) => {
                        const action = this.mixer!.clipAction(clip);
                        this.doorAnimations[clip.name] = action;
                    });
                }
                
                console.log('✅ 车辆模型初始化完成');
                console.log('🚪 门对象状态:', {
                    leftDoor: !!this.leftDoor,
                    rightDoor: !!this.rightDoor
                });
                console.log('🎡 轮子对象状态:', this.wheels);
                console.log('💡 车灯对象状态:', {
                    headlights: this.lights.headlights.length,
                    taillights: this.lights.taillights.length,
                    turnSignals: this.lights.turnSignals.length
                });
                
                this.onModelLoaded();
            },
            (progress) => {
                console.log('Loading progress:', (progress.loaded / progress.total * 100) + '%');
            },
            (error) => {
                console.error('模型加载失败:', error);
                this.showLoadError();
            }
        );
    }

    private setupControls(): void {
        // 使用 OrbitControls 进行相机控制
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxPolarAngle = Math.PI / 2;
        this.controls.minDistance = 2;
        this.controls.maxDistance = 20;
    }

    private animate(): void {
        this.animationId = requestAnimationFrame(() => this.animate());

        const delta = this.clock.getDelta();

        if (this.mixer) {
            this.mixer.update(delta);
        }

        if (this.controls) {
            this.controls.update();
        }

        // 更新轮子旋转
        this.updateWheelRotation(delta);

        // 更新道路移动
        this.updateRoadMovement(delta);

        // 更新运镜动画
        this.updateCameraAnimation(delta);

        this.renderer.render(this.scene, this.camera);
    }

    private onWindowResize(): void {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(width, height);
    }

    private onModelLoaded(): void {
        // 隐藏加载提示
        const loadingElement = this.container.querySelector('.loading-3d');
        if (loadingElement) {
            (loadingElement as HTMLElement).style.display = 'none';
        }

        console.log('3D车辆模型加载完成');
        console.log('门按钮状态:', {
            leftButton: !!this.doorButtons?.leftDoor,
            rightButton: !!this.doorButtons?.rightDoor,
            clickableObjects: this.clickableObjects?.length || 0
        });

        // 触发自定义事件
        const event = new CustomEvent('car3dLoaded');
        document.dispatchEvent(event);
    }

    private showLoadError(): void {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-3d';
        errorDiv.innerHTML = `
            <div class="error-content">
                <h3>模型加载失败</h3>
                <p>请检查模型文件路径: /car-assets/models/Car.glb</p>
            </div>
        `;
        this.container.appendChild(errorDiv);
    }

    // 门控制方法
    public controlLeftDoor(action: number): void {
        console.log('控制左门，动作:', action);
        console.log('左门对象是否存在:', !!this.leftDoor);

        if (!this.leftDoor) {
            console.warn('左门对象不存在');
            return;
        }

        switch(action) {
            case 1: // 开门
                console.log('执行左门开门动画');
                this.animateDoor(this.leftDoor, 'left', true);
                this.doorStates.leftDoor = 1;
                break;
            case 2: // 关门
                console.log('执行左门关门动画');
                this.animateDoor(this.leftDoor, 'left', false);
                this.doorStates.leftDoor = 0;
                break;
            case 0: // 停止
                console.log('停止左门动画');
                // 停止动画的逻辑可以在这里实现
                break;
        }
    }

    public controlRightDoor(action: number): void {
        console.log('控制右门，动作:', action);
        console.log('右门对象是否存在:', !!this.rightDoor);

        if (!this.rightDoor) {
            console.warn('右门对象不存在');
            return;
        }

        switch(action) {
            case 1: // 开门
                console.log('执行右门开门动画');
                this.animateDoor(this.rightDoor, 'right', true);
                this.doorStates.rightDoor = 1;
                break;
            case 2: // 关门
                console.log('执行右门关门动画');
                this.animateDoor(this.rightDoor, 'right', false);
                this.doorStates.rightDoor = 0;
                break;
            case 0: // 停止
                console.log('停止右门动画');
                // 停止动画的逻辑可以在这里实现
                break;
        }
    }

    // 门动画方法
    private animateDoor(door: THREE.Object3D, side: 'left' | 'right', open: boolean): void {
        if (!door) return;

        const targetRotation = open ? (side === 'left' ? -Math.PI / 3 : Math.PI / 3) : 0;
        const duration = 1000; // 1秒动画
        const startRotation = door.rotation.y;
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // 使用缓动函数
            const easeProgress = 1 - Math.pow(1 - progress, 3);

            door.rotation.y = startRotation + (targetRotation - startRotation) * easeProgress;

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        animate();
    }

    // 轮子控制方法
    public startWheelRotation(speed: number = 2, direction: number = 1): void {
        this.wheelRotation.isRotating = true;
        this.wheelRotation.speed = speed;
        this.wheelRotation.direction = direction;
        console.log(`开始轮子旋转 - 速度: ${speed}, 方向: ${direction > 0 ? '前进' : '后退'}`);
    }

    public stopWheelRotation(): void {
        this.wheelRotation.isRotating = false;
        console.log('停止轮子旋转');
    }

    private updateWheelRotation(delta: number): void {
        if (!this.wheelRotation.isRotating) return;

        const rotationSpeed = this.wheelRotation.speed * this.wheelRotation.direction * delta;

        Object.values(this.wheels).forEach(wheel => {
            if (wheel) {
                wheel.rotation.x += rotationSpeed;
            }
        });
    }

    // 道路移动效果
    public startRoadMovement(speed: number = 1): void {
        this.roadMovement.isMoving = true;
        this.roadMovement.speed = speed;
        console.log(`开始道路移动效果 - 速度: ${speed}`);
    }

    public stopRoadMovement(): void {
        this.roadMovement.isMoving = false;
        console.log('停止道路移动效果');
    }

    private updateRoadMovement(delta: number): void {
        if (!this.roadMovement.isMoving) return;

        this.roadMovement.objects.forEach(obj => {
            obj.position.z += this.roadMovement.speed * delta;
            if (obj.position.z > 10) {
                obj.position.z = -10;
            }
        });
    }

    // 车灯控制方法
    public controlHeadlights(state: boolean): void {
        console.log('控制前大灯:', state ? '开启' : '关闭');
        this.lights.headlights.forEach(light => {
            if (light.userData.material) {
                light.userData.material.emissive.setHex(state ? 0xffffff : 0x000000);
                light.userData.material.emissiveIntensity = state ? 1 : 0;
            }
        });
    }

    public controlTaillights(state: boolean): void {
        console.log('控制尾灯:', state ? '开启' : '关闭');
        this.lights.taillights.forEach(light => {
            if (light.userData.material) {
                light.userData.material.emissive.setHex(state ? 0xff0000 : 0x000000);
                light.userData.material.emissiveIntensity = state ? 1 : 0;
            }
        });
    }

    public controlTurnSignals(side: 'left' | 'right' | 'both' | 'off'): void {
        console.log('控制转向灯:', side);

        if (this.lightAnimation) {
            clearInterval(this.lightAnimation);
            this.lightAnimation = null;
        }

        if (side === 'off') {
            this.lights.turnSignals.forEach(light => {
                if (light.userData.material) {
                    light.userData.material.emissive.setHex(0x000000);
                    light.userData.material.emissiveIntensity = 0;
                }
            });
            return;
        }

        const targetLights = this.lights.turnSignals.filter(light => {
            const name = light.name.toLowerCase();
            if (side === 'both') return true;
            return name.includes(side);
        });

        this.startBreathingAnimation(targetLights);
    }

    // 开始呼吸灯动画
    private startBreathingAnimation(lights: THREE.Object3D[]): void {
        let intensity = 0;
        let direction = 1;
        this.lightAnimation = setInterval(() => {
            intensity += direction * 0.05;
            if (intensity >= 1) {
                intensity = 1;
                direction = -1;
            } else if (intensity <= 0) {
                intensity = 0;
                direction = 1;
            }

            lights.forEach(light => {
                if (light.userData.material && light.userData.material.emissive) {
                    light.userData.material.emissive.setHex(0xffffff);
                    light.userData.material.emissiveIntensity = intensity;
                }
            });
        }, 50); // 50ms间隔，创建平滑的呼吸效果
    }

    // 辅助方法 - 识别车灯对象
    private identifyLights(child: THREE.Object3D): void {
        const name = child.name.toLowerCase();

        if (name.includes('headlight') || name.includes('front') && name.includes('light')) {
            this.lights.headlights.push(child);
            console.log('✓ 找到前大灯:', child.name);
        } else if (name.includes('taillight') || name.includes('rear') && name.includes('light')) {
            this.lights.taillights.push(child);
            console.log('✓ 找到尾灯:', child.name);
        } else if (name.includes('turn') || name.includes('signal') || name.includes('indicator')) {
            this.lights.turnSignals.push(child);
            console.log('✓ 找到转向灯:', child.name);
        }
    }

    // 辅助方法 - 判断是否为门主体
    private isDoorMainBody(name: string, side: 'left' | 'right'): boolean {
        const nameLower = name.toLowerCase();
        const sideKeywords = side === 'left' ? ['left', 'l_', '_l_', '_l'] : ['right', 'r_', '_r_', '_r'];
        const doorKeywords = ['door'];

        // 排除子组件关键词
        const excludeKeywords = ['handle', 'window', 'mirror', 'lock', 'hinge', 'glass', 'trim'];

        const hasSide = sideKeywords.some(keyword => nameLower.includes(keyword));
        const hasDoor = doorKeywords.some(keyword => nameLower.includes(keyword));
        const hasExclude = excludeKeywords.some(keyword => nameLower.includes(keyword));

        return hasSide && hasDoor && !hasExclude;
    }

    // 辅助方法 - 判断是否为轮子对象
    private isWheelObject(name: string): boolean {
        const nameLower = name.toLowerCase();
        return nameLower.includes('wheel') || nameLower.includes('tire') || nameLower.includes('rim');
    }

    // 辅助方法 - 分配轮子对象
    private assignWheel(child: THREE.Object3D, name: string): void {
        const nameLower = name.toLowerCase();

        if (nameLower.includes('front') && nameLower.includes('left')) {
            this.wheels.frontLeft = child;
            console.log('✓ 找到前左轮:', name);
        } else if (nameLower.includes('front') && nameLower.includes('right')) {
            this.wheels.frontRight = child;
            console.log('✓ 找到前右轮:', name);
        } else if (nameLower.includes('rear') && nameLower.includes('left')) {
            this.wheels.rearLeft = child;
            console.log('✓ 找到后左轮:', name);
        } else if (nameLower.includes('rear') && nameLower.includes('right')) {
            this.wheels.rearRight = child;
            console.log('✓ 找到后右轮:', name);
        }
    }

    // 创建3D门按钮
    private create3DDoorButtons(): void {
        if (!this.car) return;

        // 创建左门按钮
        if (this.leftDoor) {
            const leftButtonGeometry = new THREE.SphereGeometry(0.1, 16, 16);
            const leftButtonMaterial = new THREE.MeshBasicMaterial({
                color: 0x00ff00,
                transparent: true,
                opacity: 0.7
            });
            const leftButton = new THREE.Mesh(leftButtonGeometry, leftButtonMaterial);

            // 计算门的边界框来定位按钮
            const box = new THREE.Box3().setFromObject(this.leftDoor);
            leftButton.position.copy(box.getCenter(new THREE.Vector3()));
            leftButton.position.y = box.max.y - 0.2;
            leftButton.position.x += 0.3;

            leftButton.userData = { type: 'doorButton', side: 'left' };
            this.doorButtons.leftDoor = leftButton;
            this.clickableObjects.push(leftButton);
            this.scene.add(leftButton);
        }

        // 创建右门按钮
        if (this.rightDoor) {
            const rightButtonGeometry = new THREE.SphereGeometry(0.1, 16, 16);
            const rightButtonMaterial = new THREE.MeshBasicMaterial({
                color: 0x0000ff,
                transparent: true,
                opacity: 0.7
            });
            const rightButton = new THREE.Mesh(rightButtonGeometry, rightButtonMaterial);

            // 计算门的边界框来定位按钮
            const box = new THREE.Box3().setFromObject(this.rightDoor);
            rightButton.position.copy(box.getCenter(new THREE.Vector3()));
            rightButton.position.y = box.max.y - 0.2;
            rightButton.position.x -= 0.3;

            rightButton.userData = { type: 'doorButton', side: 'right' };
            this.doorButtons.rightDoor = rightButton;
            this.clickableObjects.push(rightButton);
            this.scene.add(rightButton);
        }
    }

    // 设置点击处理器
    private setupClickHandlers(): void {
        this.container.addEventListener('click', (event) => {
            const rect = this.container.getBoundingClientRect();
            this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.clickableObjects);

            if (intersects.length > 0) {
                const clickedObject = intersects[0].object;
                if (clickedObject.userData.type === 'doorButton') {
                    const side = clickedObject.userData.side;
                    const currentState = side === 'left' ? this.doorStates.leftDoor : this.doorStates.rightDoor;
                    const newAction = currentState === 0 ? 1 : 2; // 0->1(开门), 1->2(关门)

                    if (side === 'left') {
                        this.controlLeftDoor(newAction);
                    } else {
                        this.controlRightDoor(newAction);
                    }
                }
            }
        });
    }

    // 运镜系统方法
    public startCameraAnimation(mode: 'orbit' | 'showcase' | 'cinematic' | 'follow', duration: number = 10000): void {
        if (this.cameraAnimation.isActive) {
            this.stopCameraAnimation();
        }

        this.cameraAnimation.isActive = true;
        this.cameraAnimation.mode = mode;
        this.cameraAnimation.startTime = Date.now();
        this.cameraAnimation.duration = duration;
        this.cameraAnimation.originalPosition = this.camera.position.clone();
        this.cameraAnimation.originalTarget = this.controls ? this.controls.target.clone() : new THREE.Vector3();

        // 根据模式设置关键帧
        this.setupCameraKeyframes(mode);

        console.log(`开始${mode}运镜，持续时间: ${duration}ms`);
    }

    public stopCameraAnimation(): void {
        if (!this.cameraAnimation.isActive) return;

        this.cameraAnimation.isActive = false;

        // 恢复原始相机位置
        if (this.cameraAnimation.originalPosition && this.cameraAnimation.originalTarget) {
            this.camera.position.copy(this.cameraAnimation.originalPosition);
            if (this.controls) {
                this.controls.target.copy(this.cameraAnimation.originalTarget);
                this.controls.update();
            }
        }

        console.log('停止运镜动画');
    }

    private setupCameraKeyframes(mode: 'orbit' | 'showcase' | 'cinematic' | 'follow'): void {
        this.cameraAnimation.keyframes = [];

        switch (mode) {
            case 'orbit':
                // 环绕运镜
                for (let i = 0; i <= 8; i++) {
                    const angle = (i / 8) * Math.PI * 2;
                    const radius = 6;
                    this.cameraAnimation.keyframes.push({
                        position: new THREE.Vector3(
                            Math.cos(angle) * radius,
                            3,
                            Math.sin(angle) * radius
                        ),
                        target: new THREE.Vector3(0, 0, 0)
                    });
                }
                break;

            case 'showcase':
                // 展示运镜
                this.cameraAnimation.keyframes = [
                    { position: new THREE.Vector3(5, 3, 5), target: new THREE.Vector3(0, 0, 0) },
                    { position: new THREE.Vector3(-5, 3, 5), target: new THREE.Vector3(0, 0, 0) },
                    { position: new THREE.Vector3(-5, 3, -5), target: new THREE.Vector3(0, 0, 0) },
                    { position: new THREE.Vector3(5, 3, -5), target: new THREE.Vector3(0, 0, 0) },
                    { position: new THREE.Vector3(0, 8, 0), target: new THREE.Vector3(0, 0, 0) },
                    { position: new THREE.Vector3(5, 3, 5), target: new THREE.Vector3(0, 0, 0) }
                ];
                break;

            case 'cinematic':
                // 电影运镜
                this.cameraAnimation.keyframes = [
                    { position: new THREE.Vector3(8, 2, 8), target: new THREE.Vector3(0, 0, 0) },
                    { position: new THREE.Vector3(2, 1, 4), target: new THREE.Vector3(0, 0, 0) },
                    { position: new THREE.Vector3(-2, 1, 4), target: new THREE.Vector3(0, 0, 0) },
                    { position: new THREE.Vector3(-8, 2, 8), target: new THREE.Vector3(0, 0, 0) },
                    { position: new THREE.Vector3(0, 6, -8), target: new THREE.Vector3(0, 0, 0) },
                    { position: new THREE.Vector3(8, 2, 8), target: new THREE.Vector3(0, 0, 0) }
                ];
                break;

            case 'follow':
                // 跟随运镜
                this.cameraAnimation.keyframes = [
                    { position: new THREE.Vector3(3, 2, 3), target: new THREE.Vector3(0, 0, 0) },
                    { position: new THREE.Vector3(3, 2, -3), target: new THREE.Vector3(0, 0, 0) },
                    { position: new THREE.Vector3(-3, 2, -3), target: new THREE.Vector3(0, 0, 0) },
                    { position: new THREE.Vector3(-3, 2, 3), target: new THREE.Vector3(0, 0, 0) }
                ];
                break;
        }
    }

    private updateCameraAnimation(delta: number): void {
        if (!this.cameraAnimation.isActive || this.cameraAnimation.keyframes.length === 0) return;

        const elapsed = Date.now() - this.cameraAnimation.startTime;
        const progress = Math.min(elapsed / this.cameraAnimation.duration, 1);

        if (progress >= 1) {
            this.stopCameraAnimation();
            return;
        }

        // 计算当前关键帧
        const keyframeProgress = progress * (this.cameraAnimation.keyframes.length - 1);
        const currentKeyframe = Math.floor(keyframeProgress);
        const nextKeyframe = Math.min(currentKeyframe + 1, this.cameraAnimation.keyframes.length - 1);
        const t = keyframeProgress - currentKeyframe;

        // 插值计算相机位置和目标
        const current = this.cameraAnimation.keyframes[currentKeyframe];
        const next = this.cameraAnimation.keyframes[nextKeyframe];

        this.camera.position.lerpVectors(current.position, next.position, t);

        if (this.controls) {
            this.controls.target.lerpVectors(current.target, next.target, t);
            this.controls.update();
        }
    }

    // 获取相机位置用于调试
    public getCameraPosition(): { position: THREE.Vector3; target: THREE.Vector3 } {
        return {
            position: this.camera.position.clone(),
            target: this.controls ? this.controls.target.clone() : new THREE.Vector3()
        };
    }

    // 获取运镜状态
    public getCameraAnimationStatus(): { isActive: boolean; mode: string; progress: number; keyframeCount: number } {
        return {
            isActive: this.cameraAnimation.isActive,
            mode: this.cameraAnimation.mode,
            progress: this.cameraAnimation.isActive ?
                Math.min((Date.now() - this.cameraAnimation.startTime) / this.cameraAnimation.duration, 1) : 0,
            keyframeCount: this.cameraAnimation.keyframes.length
        };
    }

    // 设置运镜模式并开始
    public setCameraAnimationMode(mode: 'orbit' | 'showcase' | 'cinematic' | 'follow', duration: number = 10000): void {
        if (this.cameraAnimation.isActive) {
            this.stopCameraAnimation();
        }
        setTimeout(() => {
            this.startCameraAnimation(mode, duration);
        }, 100);
    }

    // 资源清理方法
    public dispose(): void {
        // 停止动画循环
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        // 清理事件监听器
        window.removeEventListener('resize', this.onWindowResize);

        // 清理控制器
        if (this.controls) {
            this.controls.dispose();
        }

        // 清理渲染器
        if (this.renderer) {
            this.renderer.dispose();
        }

        // 清理场景中的对象
        if (this.scene) {
            this.scene.traverse((child) => {
                if (child.type === 'Mesh') {
                    const mesh = child as THREE.Mesh;
                    if (mesh.geometry) mesh.geometry.dispose();
                    if (mesh.material) {
                        if (Array.isArray(mesh.material)) {
                            mesh.material.forEach(material => material.dispose());
                        } else {
                            mesh.material.dispose();
                        }
                    }
                }
            });
            this.scene.clear();
        }

        // 清理动画
        if (this.lightAnimation) {
            clearInterval(this.lightAnimation);
            this.lightAnimation = null;
        }

        console.log('3D渲染器资源已清理');
    }
}
