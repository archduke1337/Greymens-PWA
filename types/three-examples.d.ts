declare module 'three/examples/jsm/loaders/GLTFLoader' {
  import { Group, Loader, LoadingManager } from 'three';
  
  export interface GLTF {
    scene: Group;
    scenes: Group[];
    animations: any[];
    cameras: any[];
    asset: any;
  }
  
  export class GLTFLoader extends Loader {
    constructor(manager?: LoadingManager);
    load(
      url: string,
      onLoad: (gltf: GLTF) => void,
      onProgress?: (event: ProgressEvent) => void,
      onError?: (event: ErrorEvent | Error) => void
    ): void;
    parse(
      data: ArrayBuffer | string,
      path: string,
      onLoad: (gltf: GLTF) => void,
      onError?: (event: ErrorEvent | Error) => void
    ): void;
  }
}

declare module 'three/examples/jsm/controls/OrbitControls' {
  import { Camera, EventDispatcher, Object3D, Vector3 } from 'three';
  
  export class OrbitControls extends EventDispatcher {
    constructor(object: Camera, domElement?: HTMLElement);
    
    enabled: boolean;
    target: Vector3;
    minDistance: number;
    maxDistance: number;
    minPolarAngle: number;
    maxPolarAngle: number;
    enableDamping: boolean;
    dampingFactor: number;
    enableZoom: boolean;
    enableRotate: boolean;
    enablePan: boolean;
    autoRotate: boolean;
    autoRotateSpeed: number;
    
    update(): void;
    dispose(): void;
    reset(): void;
  }
}
