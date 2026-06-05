import path from 'path';
import { defineConfig } from 'vite';
import { createAppViteConfig } from './vite.shared';

export default defineConfig(() => createAppViteConfig(path.resolve(__dirname, '.')));
