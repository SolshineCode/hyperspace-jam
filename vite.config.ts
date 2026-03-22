import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import glsl from 'vite-plugin-glsl'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), glsl()],
  resolve: {
    alias: {
      // Bypass @mediapipe/tasks-vision's malformed exports map
      // (mixes subpath keys with condition keys, which Vite 8/Rolldown rejects)
      '@mediapipe/tasks-vision': path.resolve(
        __dirname,
        'node_modules/@mediapipe/tasks-vision/vision_bundle.mjs'
      ),
    },
  },
})
