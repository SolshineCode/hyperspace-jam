declare module '*.glsl' {
  const value: string
  export default value
}

// CDN-loaded MediaPipe — all types are `any` since loaded at runtime
declare module 'https://esm.sh/@mediapipe/tasks-vision@0.10.14' {
  const mod: any
  export default mod
  export const HandLandmarker: any
  export const FilesetResolver: any
}
