import dotenv from 'dotenv';
import path from 'node:path';
import { normalizeModelProvider } from '../shared/ai-runtime-contract';
import { normalizeVisionMode } from '../shared/ai-vision-contract';

dotenv.config();

function readNumberEnv(name: string, fallback: number) {
  const raw = process.env[name];
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readNonNegativeNumberEnv(name: string, fallback: number) {
  const raw = process.env[name];
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function readStringEnv(name: string, fallback: string) {
  const value = process.env[name]?.trim();
  return value || fallback;
}

const defaultParserCommand = process.platform === 'win32' ? 'py' : 'python3';
const defaultParserArgs = process.platform === 'win32' ? ['-3'] : [];

function readStringListEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value.split(/[\s,]+/).filter(Boolean) : [];
}

const defaultVisionModels = ['qwen3-vl:8b', 'qwen2.5vl:7b', 'qwen3-vl:4b', 'qwen3-vl:2b', 'internvl3:2b'];

export const serverConfig = {
  host: readStringEnv('HOST', '0.0.0.0'),
  port: readNumberEnv('PORT', 3000),
  supabaseUrl: process.env.SUPABASE_URL?.trim() || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY?.trim() || '',
  appOwnerEmail: process.env.APP_OWNER_EMAIL?.trim() || '',
  modelProvider: normalizeModelProvider(process.env.MODEL_PROVIDER),
  ollamaHost: readStringEnv('OLLAMA_HOST', 'http://127.0.0.1:11434').replace(/\/+$/, ''),
  ollamaModel: readStringEnv('OLLAMA_MODEL', 'qwen3.5:9b-q4_K_M'),
  modelLabel: readStringEnv('MODEL_LABEL', 'Qwen 3.5 9B'),
  deepseekBaseUrl: readStringEnv('DEEPSEEK_BASE_URL', 'https://api.deepseek.com').replace(/\/+$/, ''),
  deepseekApiKey: process.env.DEEPSEEK_API_KEY?.trim() || '',
  localDbPath: path.resolve(process.cwd(), readStringEnv('LOCAL_DB_PATH', '.local-data/thebestappeva.sqlite')),
  aiAttachmentStoragePath: path.resolve(process.cwd(), readStringEnv('AI_ATTACHMENT_STORAGE_PATH', '.local-data/ai-attachments')),
  aiAttachmentMaxUploadBytes: readNumberEnv('AI_ATTACHMENT_MAX_UPLOAD_BYTES', 20 * 1024 * 1024),
  aiAttachmentInlineChars: readNumberEnv('AI_ATTACHMENT_INLINE_CHARS', 12000),
  aiAttachmentMaxContextChars: readNumberEnv('AI_ATTACHMENT_MAX_CONTEXT_CHARS', 18000),
  aiAttachmentTopChunks: readNumberEnv('AI_ATTACHMENT_TOP_CHUNKS', 6),
  aiPdfRenderScale: readNumberEnv('AI_PDF_RENDER_SCALE', 1.5),
  aiParserTimeoutMs: readNumberEnv('AI_PARSER_TIMEOUT_MS', 120000),
  aiParserPythonCommand: readStringEnv('AI_PARSER_PYTHON_COMMAND', defaultParserCommand),
  aiParserPythonArgs: readStringListEnv('AI_PARSER_PYTHON_ARGS').length ? readStringListEnv('AI_PARSER_PYTHON_ARGS') : defaultParserArgs,
  aiImageAnalysisTimeoutMs: readNumberEnv('AI_IMAGE_ANALYSIS_TIMEOUT_MS', 120000),
  aiImageAnalysisPythonCommand: readStringEnv('AI_IMAGE_ANALYSIS_PYTHON_COMMAND', defaultParserCommand),
  aiImageAnalysisPythonArgs: readStringListEnv('AI_IMAGE_ANALYSIS_PYTHON_ARGS').length
    ? readStringListEnv('AI_IMAGE_ANALYSIS_PYTHON_ARGS')
    : defaultParserArgs,
  aiImageAnalysisVisionModel: readStringEnv('AI_IMAGE_ANALYSIS_VISION_MODEL', 'qwen3-vl:8b'),
  aiImageAnalysisVisionTimeoutMs: readNumberEnv('AI_IMAGE_ANALYSIS_VISION_TIMEOUT_MS', 600000),
  aiVisionModels: readStringListEnv('AI_VISION_MODELS').length ? readStringListEnv('AI_VISION_MODELS') : defaultVisionModels,
  visionMode: normalizeVisionMode(process.env.VISION_MODE),
  localVisionModel: readStringEnv('LOCAL_VISION_MODEL', ''),
  onlineVisionProvider: readStringEnv('ONLINE_VISION_PROVIDER', 'gemini'),
  onlineSummaryModel: readStringEnv('ONLINE_SUMMARY_MODEL', 'gemini-2.5-flash-lite'),
  onlineDetailedModel: readStringEnv('ONLINE_DETAILED_MODEL', 'gemini-2.5-flash'),
  visionTimeoutMs: readNumberEnv('VISION_TIMEOUT_MS', 45000),
  visionMaxRetries: readNonNegativeNumberEnv('VISION_MAX_RETRIES', 1),
  visionMaxOutputTokens: readNumberEnv('VISION_MAX_OUTPUT_TOKENS', 1024),
  visionMaxCallsPerMessage: readNumberEnv('VISION_MAX_CALLS_PER_MESSAGE', 4),
  geminiBaseUrl: readStringEnv('GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, ''),
  geminiApiKey: process.env.GEMINI_API_KEY?.trim() || '',
  aiPythonExecCommand: readStringEnv('AI_PYTHON_EXEC_COMMAND', defaultParserCommand),
  aiPythonExecArgs: readStringListEnv('AI_PYTHON_EXEC_ARGS').length ? readStringListEnv('AI_PYTHON_EXEC_ARGS') : defaultParserArgs,
  aiPythonExecTimeoutMs: readNumberEnv('AI_PYTHON_EXEC_TIMEOUT_MS', 30000),
  aiPythonExecMaxCodeChars: readNumberEnv('AI_PYTHON_EXEC_MAX_CODE_CHARS', 20000),
  aiPythonExecMaxOutputChars: readNumberEnv('AI_PYTHON_EXEC_MAX_OUTPUT_CHARS', 12000),
  aiPythonExecMaxFiles: readNumberEnv('AI_PYTHON_EXEC_MAX_FILES', 6),
  aiPythonExecDockerImage: readStringEnv('AI_PYTHON_EXEC_DOCKER_IMAGE', 'thebestappeva-python-exec:latest'),
  aiPythonExecMemoryMb: readNumberEnv('AI_PYTHON_EXEC_MEMORY_MB', 512),
  aiPythonExecSessionIdleMs: readNumberEnv('AI_PYTHON_EXEC_SESSION_IDLE_MS', 300000),
  aiPythonExecSmokeTimeoutMs: readNumberEnv('AI_PYTHON_EXEC_SMOKE_TIMEOUT_MS', 15000),
  aiPythonExecWorkspaceRoot: path.resolve(process.cwd(), readStringEnv('AI_PYTHON_EXEC_WORKSPACE_ROOT', '.local-data/ai-python-workspaces')),
  searxngBaseUrl: readStringEnv('SEARXNG_BASE_URL', 'http://127.0.0.1:8888').replace(/\/+$/, ''),
  webSearchTimeoutMs: readNumberEnv('WEB_SEARCH_TIMEOUT_MS', 10000),
  urlFetchTimeoutMs: readNumberEnv('URL_FETCH_TIMEOUT_MS', 12000),
  maxSearchResults: readNumberEnv('WEB_SEARCH_MAX_RESULTS', 8),
  maxFetchedChars: readNumberEnv('URL_FETCH_MAX_CHARS', 12000),
  fetchUserAgent: readStringEnv(
    'URL_FETCH_USER_AGENT',
    'thebestappeva/1.0 (+local-ai-fetch; https://localhost)',
  ),
};
