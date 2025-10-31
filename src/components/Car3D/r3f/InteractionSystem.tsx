/**
 * R3F 交互系统组件 - 使用 useThree 和 raycaster 替代原有的 InteractionHandler
 */
import React, { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

export interface InteractionSystemProps {
  car: THREE.Group | null;
  isDriving: boolean; // 是否正在行驶
  onDoorClick?: (door: "left" | "right") => void;
  onObjectClick?: (object: THREE.Object3D) => void;
}

export const InteractionSystem: React.FC<InteractionSystemProps> = ({
  car,
  isDriving,
  onDoorClick,
  onObjectClick,
}) => {
  const { camera, gl } = useThree();
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const clickableObjectsRef = useRef<THREE.Object3D[]>([]);
  const doorButtonsRef = useRef<{ left?: THREE.Group; right?: THREE.Group }>(
    {}
  );
  const hoveredButtonRef = useRef<THREE.Group | null>(null);
  const originalScalesRef = useRef<Map<THREE.Group, THREE.Vector3>>(new Map());

  // 创建门按钮
  const createDoorButtons = (carGroup: THREE.Group) => {
    console.log("🔍 开始创建3D门按钮...");

    // 查找左门和右门对象
    let leftDoor: THREE.Object3D | null = null;
    let rightDoor: THREE.Object3D | null = null;

    carGroup.traverse((child: THREE.Object3D) => {
      if (child.name === "Object_347") {
        leftDoor = child;
      } else if (child.name === "Object_401") {
        rightDoor = child;
      }
    });

    // 创建左门按钮
    if (leftDoor) {
      const leftButton = createButtonGeometry();
      leftButton.position.set(-0.2, -1.1, 0.2);
      leftButton.rotation.y = Math.PI / 2;
      leftButton.userData = { type: "doorButton", door: "left" };
      (leftDoor as THREE.Object3D).add(leftButton);
      doorButtonsRef.current.left = leftButton;
      clickableObjectsRef.current.push(leftButton);
      originalScalesRef.current.set(leftButton, leftButton.scale.clone());
      console.log("✓ 左门按钮已创建");
    }

    // 创建右门按钮
    if (rightDoor) {
      const rightButton = createButtonGeometry();
      rightButton.position.set(0.2, -1.2, 0);
      rightButton.rotation.y = -Math.PI / 2;
      rightButton.userData = { type: "doorButton", door: "right" };
      (rightDoor as THREE.Object3D).add(rightButton);
      doorButtonsRef.current.right = rightButton;
      clickableObjectsRef.current.push(rightButton);
      originalScalesRef.current.set(rightButton, rightButton.scale.clone());
      console.log("✓ 右门按钮已创建");
    }

    console.log(
      `✅ 3D门按钮创建完成，总共可点击对象: ${clickableObjectsRef.current.length}`
    );
  };

  // 创建按钮几何体
  const createButtonGeometry = (): THREE.Group => {
    const outerGeometry = new THREE.RingGeometry(0.08, 0.1, 32);
    const innerGeometry = new THREE.CircleGeometry(0.06, 32);

    const outerMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
      emissive: 0x222222,
      metalness: 0.1,
      roughness: 0.8,
      side: THREE.DoubleSide,
    });

    const innerMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5,
      emissive: 0x111111,
      metalness: 0.1,
      roughness: 0.8,
      side: THREE.DoubleSide,
    });

    const outerRing = new THREE.Mesh(outerGeometry, outerMaterial);
    const innerCircle = new THREE.Mesh(innerGeometry, innerMaterial);

    const buttonGroup = new THREE.Group();
    buttonGroup.add(outerRing);
    buttonGroup.add(innerCircle);

    return buttonGroup;
  };

  // 初始化可点击对象和门按钮
  useEffect(() => {
    if (!car) return;

    clickableObjectsRef.current = [];
    createDoorButtons(car);

    console.log(
      `Found ${clickableObjectsRef.current.length} clickable objects`
    );
  }, [car]);

  // 处理鼠标点击
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      // 计算鼠标在标准化设备坐标中的位置
      const rect = gl.domElement.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      // 更新射线
      raycasterRef.current.setFromCamera(mouseRef.current, camera);

      // 检测交集
      const intersects = raycasterRef.current.intersectObjects(
        clickableObjectsRef.current,
        true
      );

      if (intersects.length > 0) {
        const clickedObject = intersects[0].object;

        // 查找父对象中的 userData
        let parent = clickedObject as THREE.Object3D | null;
        let doorType: "left" | "right" | null = null;

        while (parent) {
          if (parent.userData?.type === "doorButton") {
            doorType = parent.userData.door;
            break;
          }
          parent = parent.parent;
        }

        if (doorType && onDoorClick) {
          // 点击任意按钮，只调用一次 onDoorClick，在 handleDoorClick 中同时播放两个门的动画
          onDoorClick(doorType);
          console.log(
            `Clicked door button: ${doorType}, will open/close both doors`
          );
        }

        if (onObjectClick) {
          onObjectClick(clickedObject);
        }
      }
    };

    gl.domElement.addEventListener("click", handleClick);
    return () => {
      gl.domElement.removeEventListener("click", handleClick);
    };
  }, [camera, gl, onDoorClick, onObjectClick]);

  // 根据行驶状态显示/隐藏门按钮
  useEffect(() => {
    console.log("[DoorRing] Driving state changing: ", isDriving);
    console.log("[DoorRing] doorButtonsRef.current:", doorButtonsRef.current);
    console.log(
      "[DoorRing] Object.values:",
      Object.values(doorButtonsRef.current)
    );

    Object.values(doorButtonsRef.current).forEach((button) => {
      if (button) {
        console.log("[DoorRing] Processing button:", button);
        console.log("[DoorRing] Button type:", button.type);
        console.log("[DoorRing] Button visible before:", button.visible);
        console.log("[DoorRing] Button children:", button.children);
        //todo visible属性不管用，后面再处理这个问题
        button.visible = !isDriving;

        console.log("[DoorRing] Button visible after:", button.visible);
      }
    });
  }, [isDriving]);

  // 处理鼠标移动和悬停效果
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      // 如果正在行驶，不处理悬停
      if (isDriving) {
        // 重置所有按钮的缩放
        Object.values(doorButtonsRef.current).forEach((button) => {
          if (button) {
            const originalScale = originalScalesRef.current.get(button);
            if (originalScale) {
              button.scale.copy(originalScale);
            }
          }
        });
        hoveredButtonRef.current = null;
        gl.domElement.style.cursor = "default";
        return;
      }

      // 计算鼠标在标准化设备坐标中的位置
      const rect = gl.domElement.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      // 更新射线
      raycasterRef.current.setFromCamera(mouseRef.current, camera);

      // 检测交集
      const intersects = raycasterRef.current.intersectObjects(
        clickableObjectsRef.current,
        true
      );

      let hoveredButton: THREE.Group | null = null;

      if (intersects.length > 0) {
        const hoveredObject = intersects[0].object;

        // 查找父对象中的 userData
        let parent = hoveredObject as THREE.Object3D | null;

        while (parent) {
          if (parent.userData?.type === "doorButton") {
            hoveredButton = parent as THREE.Group;
            break;
          }
          parent = parent.parent;
        }
      }

      // 如果悬停的按钮改变了
      if (hoveredButton !== hoveredButtonRef.current) {
        // 重置之前悬停的按钮
        if (hoveredButtonRef.current) {
          const originalScale = originalScalesRef.current.get(
            hoveredButtonRef.current
          );
          if (originalScale) {
            hoveredButtonRef.current.scale.copy(originalScale);
          }
        }

        // 放大当前悬停的按钮
        if (hoveredButton) {
          const originalScale = originalScalesRef.current.get(hoveredButton);
          if (originalScale) {
            hoveredButton.scale.copy(originalScale).multiplyScalar(1.2);
          }
          gl.domElement.style.cursor = "pointer";
        } else {
          gl.domElement.style.cursor = "default";
        }

        hoveredButtonRef.current = hoveredButton;
      }
    };

    gl.domElement.addEventListener("mousemove", handleMouseMove);
    return () => {
      gl.domElement.removeEventListener("mousemove", handleMouseMove);
      gl.domElement.style.cursor = "default";
    };
  }, [camera, gl, isDriving]);

  return null;
};
