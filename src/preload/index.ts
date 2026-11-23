import { contextBridge, ipcRenderer } from 'electron'
import type {
  AgentAPI,
  AgentEvent,
  ArduinoCliAPI,
  ArduinoOperationEvent,
  ChatAPI,
  DretAPI,
  DiagnosticsAPI,
  HistoryAPI,
  UpdateStatus,
  UpdaterAPI,
  SecretsAPI,
  SerialAPI,
  SerialDataChunk,
  SerialStatus,
  SettingsAPI,
  SketchAPI,
  SkillsAPI,
  WindowAPI
} from '@shared/types'
import { IPC_CHANNELS } from '@shared/types'

/**
 * main->renderer olaylarına abone olmak için ortak yardımcı. ipcRenderer'ı
 * doğrudan dışarı vermek yerine, her zaman bir "abonelikten çık" (unsubscribe)
 * fonksiyonu döner; bileşenler unmount olduğunda dinleyiciyi temizleyebilir.
 */
function olayaAbolOl<T>(kanal: string, dinleyici: (veri: T) => void): () => void {
  const sarmalayici = (_event: Electron.IpcRendererEvent, veri: T): void => dinleyici(veri)
  ipcRenderer.on(kanal, sarmalayici)
  return () => ipcRenderer.removeListener(kanal, sarmalayici)
}

const arduinoCli: ArduinoCliAPI = {
  getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.arduinoCli.getStatus),
  browseForCliPath: () => ipcRenderer.invoke(IPC_CHANNELS.arduinoCli.browseForCliPath),
  setCliPath: (path) => ipcRenderer.invoke(IPC_CHANNELS.arduinoCli.setCliPath, path),
  getBoardManagerUrls: () => ipcRenderer.invoke(IPC_CHANNELS.arduinoCli.getBoardManagerUrls),
  addBoardManagerUrl: (url) => ipcRenderer.invoke(IPC_CHANNELS.arduinoCli.addBoardManagerUrl, url),
  removeBoardManagerUrl: (url) => ipcRenderer.invoke(IPC_CHANNELS.arduinoCli.removeBoardManagerUrl, url),
  updateIndex: () => ipcRenderer.invoke(IPC_CHANNELS.arduinoCli.updateIndex),
  listCores: () => ipcRenderer.invoke(IPC_CHANNELS.arduinoCli.listCores),
  searchCores: (query) => ipcRenderer.invoke(IPC_CHANNELS.arduinoCli.searchCores, query),
  installCore: (id, operationId) => ipcRenderer.invoke(IPC_CHANNELS.arduinoCli.installCore, id, operationId),
  uninstallCore: (id) => ipcRenderer.invoke(IPC_CHANNELS.arduinoCli.uninstallCore, id),
  listPorts: () => ipcRenderer.invoke(IPC_CHANNELS.arduinoCli.listPorts),
  listAllBoards: () => ipcRenderer.invoke(IPC_CHANNELS.arduinoCli.listAllBoards),
  listLibraries: (force) => ipcRenderer.invoke(IPC_CHANNELS.arduinoCli.listLibraries, force),
  getLibrarySymbols: (force) => ipcRenderer.invoke(IPC_CHANNELS.arduinoCli.getLibrarySymbols, force),
  searchLibraries: (query) => ipcRenderer.invoke(IPC_CHANNELS.arduinoCli.searchLibraries, query),
  getBoardOptions: (fqbn) => ipcRenderer.invoke(IPC_CHANNELS.arduinoCli.getBoardOptions, fqbn),
  listUpdatableLibraries: (force) => ipcRenderer.invoke(IPC_CHANNELS.arduinoCli.listUpdatableLibraries, force),
  suggestLibrary: (header) => ipcRenderer.invoke(IPC_CHANNELS.arduinoCli.suggestLibrary, header),
  installLibrary: (name, version, operationId) =>
    ipcRenderer.invoke(IPC_CHANNELS.arduinoCli.installLibrary, name, version, operationId),
  uninstallLibrary: (name) => ipcRenderer.invoke(IPC_CHANNELS.arduinoCli.uninstallLibrary, name),
  listExamples: () => ipcRenderer.invoke(IPC_CHANNELS.arduinoCli.listExamples),
  compile: (sketchPath, fqbn, operationId) =>
    ipcRenderer.invoke(IPC_CHANNELS.arduinoCli.compile, sketchPath, fqbn, operationId),
  upload: (sketchPath, fqbn, port, operationId) =>
    ipcRenderer.invoke(IPC_CHANNELS.arduinoCli.upload, sketchPath, fqbn, port, operationId),
  cancelOperation: (operationId) => ipcRenderer.invoke(IPC_CHANNELS.arduinoCli.cancelOperation, operationId),
  onOperationEvent: (dinleyici) =>
    olayaAbolOl<ArduinoOperationEvent>(IPC_CHANNELS.arduinoCli.onOperationEvent, dinleyici),
  onBusyChanged: (dinleyici) => olayaAbolOl<boolean>(IPC_CHANNELS.arduinoCli.onBusyChanged, dinleyici)
}

const sketch: SketchAPI = {
  createFromTemplate: (name, code) => ipcRenderer.invoke(IPC_CHANNELS.sketch.createFromTemplate, name, code),
  createNew: (name) => ipcRenderer.invoke(IPC_CHANNELS.sketch.createNew, name),
  createSiblingSketch: (baseFolderPath, sketchName, initialCode) =>
    ipcRenderer.invoke(IPC_CHANNELS.sketch.createSiblingSketch, baseFolderPath, sketchName, initialCode),
  getInitialSketchPath: () => ipcRenderer.invoke(IPC_CHANNELS.sketch.getInitialSketchPath),
  openDialog: () => ipcRenderer.invoke(IPC_CHANNELS.sketch.openDialog),
  openPath: (folderPath) => ipcRenderer.invoke(IPC_CHANNELS.sketch.openPath, folderPath),
  saveAsDialog: (currentFolderPath) => ipcRenderer.invoke(IPC_CHANNELS.sketch.saveAsDialog, currentFolderPath),
  readFile: (filePath) => ipcRenderer.invoke(IPC_CHANNELS.sketch.readFile, filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke(IPC_CHANNELS.sketch.writeFile, filePath, content),
  listFiles: (folderPath) => ipcRenderer.invoke(IPC_CHANNELS.sketch.listFiles, folderPath),
  addFile: (folderPath, fileName) => ipcRenderer.invoke(IPC_CHANNELS.sketch.addFile, folderPath, fileName),
  deleteFile: (filePath) => ipcRenderer.invoke(IPC_CHANNELS.sketch.deleteFile, filePath),
  renameFile: (filePath, newName) => ipcRenderer.invoke(IPC_CHANNELS.sketch.renameFile, filePath, newName),
  getRecent: () => ipcRenderer.invoke(IPC_CHANNELS.sketch.getRecent),
  getLastOpened: () => ipcRenderer.invoke(IPC_CHANNELS.sketch.getLastOpened)
}

const serial: SerialAPI = {
  listPorts: () => ipcRenderer.invoke(IPC_CHANNELS.serial.listPorts),
  open: (port, baud) => ipcRenderer.invoke(IPC_CHANNELS.serial.open, port, baud),
  close: (port) => ipcRenderer.invoke(IPC_CHANNELS.serial.close, port),
  write: (data, lineEnding, port) => ipcRenderer.invoke(IPC_CHANNELS.serial.write, data, lineEnding, port),
  isOpen: () => ipcRenderer.invoke(IPC_CHANNELS.serial.isOpen),
  onData: (dinleyici) => olayaAbolOl<SerialDataChunk>(IPC_CHANNELS.serial.onData, dinleyici),
  onStatusChanged: (dinleyici) => olayaAbolOl<SerialStatus>(IPC_CHANNELS.serial.onStatusChanged, dinleyici)
}

const settings: SettingsAPI = {
  get: () => ipcRenderer.invoke(IPC_CHANNELS.settings.get),
  set: (key, value) => ipcRenderer.invoke(IPC_CHANNELS.settings.set, key, value)
}

const diagnostics: DiagnosticsAPI = {
  collect: () => ipcRenderer.invoke(IPC_CHANNELS.diagnostics.collect),
  saveReport: (metin) => ipcRenderer.invoke(IPC_CHANNELS.diagnostics.saveReport, metin),
  openIssue: (baslik, govde) => ipcRenderer.invoke(IPC_CHANNELS.diagnostics.openIssue, baslik, govde)
}

const updater: UpdaterAPI = {
  getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.updater.getStatus),
  check: () => ipcRenderer.invoke(IPC_CHANNELS.updater.check),
  download: () => ipcRenderer.invoke(IPC_CHANNELS.updater.download),
  install: () => ipcRenderer.invoke(IPC_CHANNELS.updater.install),
  openReleases: () => ipcRenderer.invoke(IPC_CHANNELS.updater.openReleases),
  onStatus: (dinleyici) => olayaAbolOl<UpdateStatus>(IPC_CHANNELS.updater.onStatus, dinleyici)
}

const history: HistoryAPI = {
  status: (p) => ipcRenderer.invoke(IPC_CHANNELS.history.status, p),
  list: (p, dal) => ipcRenderer.invoke(IPC_CHANNELS.history.list, p, dal),
  diff: (p, a, b) => ipcRenderer.invoke(IPC_CHANNELS.history.diff, p, a, b),
  commit: (p, mesaj, otomatik) => ipcRenderer.invoke(IPC_CHANNELS.history.commit, p, mesaj, otomatik),
  restore: (p, id, dosyalar) => ipcRenderer.invoke(IPC_CHANNELS.history.restore, p, id, dosyalar),
  tag: (p, id, ad) => ipcRenderer.invoke(IPC_CHANNELS.history.tag, p, id, ad),
  untag: (p, ad) => ipcRenderer.invoke(IPC_CHANNELS.history.untag, p, ad),
  createBranch: (p, ad, id) => ipcRenderer.invoke(IPC_CHANNELS.history.createBranch, p, ad, id),
  checkout: (p, ad) => ipcRenderer.invoke(IPC_CHANNELS.history.checkout, p, ad),
  deleteBranch: (p, ad) => ipcRenderer.invoke(IPC_CHANNELS.history.deleteBranch, p, ad),
  exportPackage: (p) => ipcRenderer.invoke(IPC_CHANNELS.history.exportPackage, p),
  importPackage: () => ipcRenderer.invoke(IPC_CHANNELS.history.importPackage)
}

const secrets: SecretsAPI = {
  setApiKey: (provider, apiKey) => ipcRenderer.invoke(IPC_CHANNELS.secrets.setApiKey, provider, apiKey),
  clearApiKey: (provider) => ipcRenderer.invoke(IPC_CHANNELS.secrets.clearApiKey, provider),
  getConfiguredProviders: () => ipcRenderer.invoke(IPC_CHANNELS.secrets.getConfiguredProviders)
}

const chat: ChatAPI = {
  getSessions: (sketchPath: string) => ipcRenderer.invoke(IPC_CHANNELS.chat.getSessions, sketchPath),
  getSession: (sessionId: string) => ipcRenderer.invoke(IPC_CHANNELS.chat.getSession, sessionId),
  createSession: (sketchPath: string, sketchName: string, baslik?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.chat.createSession, sketchPath, sketchName, baslik),
  saveSession: (session) => ipcRenderer.invoke(IPC_CHANNELS.chat.saveSession, session),
  deleteSession: (sessionId: string) => ipcRenderer.invoke(IPC_CHANNELS.chat.deleteSession, sessionId),
  renameSession: (sessionId: string, yeniBaslik: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.chat.renameSession, sessionId, yeniBaslik),
  clearSessions: (sketchPath: string) => ipcRenderer.invoke(IPC_CHANNELS.chat.clearSessions, sketchPath),
  migrateSessions: (oldSketchPath: string, newSketchPath: string, newSketchName: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.chat.migrateSessions, oldSketchPath, newSketchPath, newSketchName),
  getProviderModels: (provider) => ipcRenderer.invoke(IPC_CHANNELS.chat.getProviderModels, provider),
  compactSession: (params) => ipcRenderer.invoke(IPC_CHANNELS.chat.compactSession, params),
  generateTitle: (params) => ipcRenderer.invoke(IPC_CHANNELS.chat.generateTitle, params)
}

const agent: AgentAPI = {
  run: (params) => ipcRenderer.invoke(IPC_CHANNELS.agent.run, params),
  abort: (runId) => ipcRenderer.invoke(IPC_CHANNELS.agent.abort, runId),
  reply: (runId, callId, reply) => ipcRenderer.invoke(IPC_CHANNELS.agent.reply, runId, callId, reply),
  undo: (checkpointId) => ipcRenderer.invoke(IPC_CHANNELS.agent.undo, checkpointId),
  onEvent: (dinleyici) => olayaAbolOl<AgentEvent>(IPC_CHANNELS.agent.onEvent, dinleyici),
  testProvider: (provider, model) => ipcRenderer.invoke(IPC_CHANNELS.agent.testProvider, provider, model)
}

const skills: SkillsAPI = {
  getSkillsInfo: (boardContext) => ipcRenderer.invoke(IPC_CHANNELS.skills.getSkillsInfo, boardContext),
  listCustomSkills: () => ipcRenderer.invoke(IPC_CHANNELS.skills.listCustomSkills),
  addCustomSkill: (skill) => ipcRenderer.invoke(IPC_CHANNELS.skills.addCustomSkill, skill),
  deleteCustomSkill: (id) => ipcRenderer.invoke(IPC_CHANNELS.skills.deleteCustomSkill, id),
  reindexRag: () => ipcRenderer.invoke(IPC_CHANNELS.skills.reindexRag),
  getSkillsDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.skills.getSkillsDirectory),
  openSkillsFolder: () => ipcRenderer.invoke(IPC_CHANNELS.skills.openSkillsFolder),
  saveBoardModel: (family, model) => ipcRenderer.invoke(IPC_CHANNELS.skills.saveBoardModel, family, model),
  addBoardModel: (family, model) => ipcRenderer.invoke(IPC_CHANNELS.skills.addBoardModel, family, model),
  deleteBoardModel: (family, modelId) => ipcRenderer.invoke(IPC_CHANNELS.skills.deleteBoardModel, family, modelId),
  resetBoardModel: (family, modelId) => ipcRenderer.invoke(IPC_CHANNELS.skills.resetBoardModel, family, modelId)
}

const windowApi: WindowAPI = {
  onCloseRequested: (dinleyici) => {
    const sarmalayici = (): void => dinleyici()
    ipcRenderer.on(IPC_CHANNELS.window.onCloseRequested, sarmalayici)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.window.onCloseRequested, sarmalayici)
  },
  replyCloseRequest: (proceed) => ipcRenderer.send(IPC_CHANNELS.window.replyCloseRequest, proceed),
  openNewWindow: (sketchPath) => ipcRenderer.invoke(IPC_CHANNELS.window.openNewWindow, sketchPath)
}

/**
 * Renderer'a expose edilecek tipli API. Renderer bu nesne dışında hiçbir
 * Node.js veya Electron API'sine erişemez (contextIsolation: true,
 * nodeIntegration: false). Yeni bir yetenek eklenirken önce
 * src/shared/types.ts içindeki DretAPI arayüzü genişletilmeli, sonra
 * burada gerçek implementasyon yazılmalıdır.
 */
const api: DretAPI = {
  app: {
    getVersion: () => ipcRenderer.invoke(IPC_CHANNELS.app.getVersion),
    platform: process.platform
  },
  arduinoCli,
  sketch,
  serial,
  settings,
  diagnostics,
  updater,
  history,
  secrets,
  chat,
  agent,
  skills,
  window: windowApi
}

contextBridge.exposeInMainWorld('api', api)

