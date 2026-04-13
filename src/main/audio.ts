import { exec, spawn } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import { platform } from 'os'

const execAsync = promisify(exec)
const isMac = platform() === 'darwin'
const isWin = platform() === 'win32'

// Ensure homebrew binaries are in PATH (macOS)
if (isMac && !process.env.PATH?.includes('/opt/homebrew/bin')) {
  process.env.PATH = `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}`
}

let recordingProcess: ReturnType<typeof spawn> | null = null
let currentTempPath: string = ''
let recordingStartTime: number = 0
let currentAudioLevel: number = 0

const logFilePath = () => path.join(app.getPath('userData'), 'dictation.log')
function log(msg: string): void {
  fs.appendFileSync(logFilePath(), `[${new Date().toISOString()}] [audio] ${msg}\n`)
}

export interface AudioRecordingResult {
  buffer: Buffer
  durationMs: number
  filePath: string
}

/**
 * Start recording audio using the best available tool on the current platform.
 * macOS priority: sox (rec) > ffmpeg > native Swift binary
 * Windows priority: ffmpeg > PowerShell .NET
 */
// Cache tool check result
let cachedTools: { sox: boolean; ffmpeg: boolean; swift: boolean } | null = null

export async function startRecording(deviceName?: string): Promise<void> {
  currentTempPath = path.join(app.getPath('temp'), `diktuvai_recording_${Date.now()}.wav`)
  recordingStartTime = Date.now()
  currentAudioLevel = 0

  // Use cached tools check (don't re-check every time)
  if (!cachedTools) cachedTools = await checkRecordingTools()
  const tools = cachedTools

  if (isMac) {
    // Native Swift is fastest (~50ms startup vs ~300ms for ffmpeg)
    startRecordingNativeMac(currentTempPath)

  } else if (isWin) {
    if (tools.ffmpeg) {
      startRecordingFfmpegWin(currentTempPath, deviceName)
    } else {
      startRecordingPowerShell(currentTempPath)
    }
  }
}

// ========================
// macOS recording methods
// ========================

function startRecordingSox(tempPath: string, deviceName?: string): void {
  const args = [
    '-d', '-r', '16000', '-c', '1', '-b', '16',
    '-e', 'signed-integer', '-t', 'wav', tempPath,
  ]

  const env = { ...process.env }
  if (deviceName && deviceName !== 'default') {
    env.AUDIODEV = deviceName
  }

  recordingProcess = spawn('rec', args, { env, stdio: ['pipe', 'pipe', 'pipe'] })
  recordingProcess.on('error', () => {
    // Fallback to native
    startRecordingNativeMac(tempPath)
  })
}

function startRecordingFfmpegMac(tempPath: string): void {
  recordingProcess = spawn('ffmpeg', [
    '-f', 'avfoundation',
    '-audio_device_index', '0',
    '-i', ':default',
    '-ar', '16000', '-ac', '1',
    '-acodec', 'pcm_s16le',
    '-flush_packets', '1',
    '-y', tempPath
  ], { stdio: ['pipe', 'pipe', 'pipe'] })

  recordingProcess.on('error', () => {
    startRecordingNativeMac(tempPath)
  })
}

/**
 * Pre-compiled Swift binary path (compiled once on first use).
 */
let compiledBinaryPath: string | null = null

/**
 * Compile the Swift recorder once, then reuse the binary.
 */
async function ensureRecorderCompiled(): Promise<string> {
  const binaryPath = path.join(app.getPath('userData'), 'diktuvai_recorder')

  if (compiledBinaryPath && fs.existsSync(compiledBinaryPath)) {
    return compiledBinaryPath
  }

  if (fs.existsSync(binaryPath)) {
    compiledBinaryPath = binaryPath
    return binaryPath
  }

  // Compile Swift recorder binary
  const scriptPath = path.join(app.getPath('userData'), 'diktuvai_recorder.swift')
  const swiftCode = `
import AVFoundation
import Foundation

guard CommandLine.arguments.count > 1 else {
    fputs("Usage: diktuvai_recorder <output.wav>\\n", stderr)
    exit(1)
}

let url = URL(fileURLWithPath: CommandLine.arguments[1])
let settings: [String: Any] = [
    AVFormatIDKey: Int(kAudioFormatLinearPCM),
    AVSampleRateKey: 16000,
    AVNumberOfChannelsKey: 1,
    AVLinearPCMBitDepthKey: 16,
    AVLinearPCMIsFloatKey: false,
    AVLinearPCMIsBigEndianKey: false
]

guard let recorder = try? AVAudioRecorder(url: url, settings: settings) else {
    fputs("ERROR\\n", stderr)
    exit(1)
}

recorder.isMeteringEnabled = true
recorder.record()
fputs("RECORDING\\n", stderr)

signal(SIGINT) { _ in exit(0) }
signal(SIGTERM) { _ in exit(0) }

// Output audio levels to stderr every 100ms for real-time visualization
Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { _ in
    recorder.updateMeters()
    let db = recorder.averagePower(forChannel: 0) // -160 to 0 dB
    let level = max(0.0, min(1.0, (Double(db) + 50.0) / 50.0)) // normalize -50..0 dB to 0..1
    fputs("LEVEL:\\(String(format: "%.3f", level))\\n", stderr)
}

RunLoop.current.run()
`
  fs.writeFileSync(scriptPath, swiftCode)

  return new Promise((resolve, reject) => {
    exec(`swiftc -O -o "${binaryPath}" "${scriptPath}"`, { timeout: 30000 }, (err) => {
      if (err) {
        reject(new Error('Failed to compile recorder: ' + err.message))
      } else {
        compiledBinaryPath = binaryPath
        resolve(binaryPath)
      }
    })
  })
}

/**
 * Record audio using pre-compiled native macOS binary.
 */
function startRecordingNativeMac(tempPath: string): void {
  const binaryPath = compiledBinaryPath || path.join(app.getPath('userData'), 'diktuvai_recorder')

  if (!fs.existsSync(binaryPath)) {
    // Fallback to compile, then ffmpeg
    ensureRecorderCompiled().then((bp) => {
      startRecordingNativeMac(tempPath)
    }).catch(() => {
      startRecordingFfmpegMac(tempPath)
    })
    return
  }

  recordingProcess = spawn(binaryPath, [tempPath], {
    stdio: ['pipe', 'pipe', 'pipe']
  })

  recordingProcess.stderr?.on('data', (data: Buffer) => {
    const msg = data.toString().trim()
    // Parse real audio level lines from the Swift recorder
    for (const line of msg.split('\n')) {
      if (line.startsWith('LEVEL:')) {
        currentAudioLevel = parseFloat(line.slice(6)) || 0
      } else if (line) {
        log(`Recorder: ${line}`)
      }
    }
  })

  recordingProcess.on('error', (err: Error) => {
    log(`Native recorder error: ${err.message}, falling back to ffmpeg`)
    recordingProcess = null
    startRecordingFfmpegMac(tempPath)
  })
}

// ========================
// Windows recording methods
// ========================

/**
 * Record audio on Windows using ffmpeg with DirectShow.
 */
function startRecordingFfmpegWin(tempPath: string, deviceName?: string): void {
  const audioDevice = deviceName && deviceName !== 'default'
    ? deviceName
    : 'Microphone'

  // List devices first to find a valid one, or use the provided name
  recordingProcess = spawn('ffmpeg', [
    '-f', 'dshow',
    '-i', `audio=${audioDevice}`,
    '-ar', '16000', '-ac', '1',
    '-acodec', 'pcm_s16le',
    '-y', tempPath
  ], {
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: false
  })

  recordingProcess.stderr?.on('data', (data: Buffer) => {
    const msg = data.toString().trim()
    if (msg) log(`ffmpeg-win: ${msg}`)
  })

  recordingProcess.on('error', (err: Error) => {
    log(`ffmpeg-win error: ${err.message}, falling back to PowerShell`)
    startRecordingPowerShell(tempPath)
  })
}

/**
 * Record audio on Windows using PowerShell with .NET NAudio-style approach.
 * This is a fallback when ffmpeg is not available.
 */
function startRecordingPowerShell(tempPath: string): void {
  const psScript = `
Add-Type -TypeDefinition @"
using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;

public class WavRecorder {
    [DllImport("winmm.dll")]
    private static extern int waveInOpen(ref IntPtr hWaveIn, int deviceId, ref WAVEFORMATEX lpFormat, IntPtr dwCallback, IntPtr dwInstance, int dwFlags);
    [DllImport("winmm.dll")]
    private static extern int waveInPrepareHeader(IntPtr hWaveIn, ref WAVEHDR lpWaveHdr, int uSize);
    [DllImport("winmm.dll")]
    private static extern int waveInAddBuffer(IntPtr hWaveIn, ref WAVEHDR lpWaveHdr, int uSize);
    [DllImport("winmm.dll")]
    private static extern int waveInStart(IntPtr hWaveIn);
    [DllImport("winmm.dll")]
    private static extern int waveInStop(IntPtr hWaveIn);
    [DllImport("winmm.dll")]
    private static extern int waveInReset(IntPtr hWaveIn);
    [DllImport("winmm.dll")]
    private static extern int waveInClose(IntPtr hWaveIn);
    [DllImport("winmm.dll")]
    private static extern int waveInUnprepareHeader(IntPtr hWaveIn, ref WAVEHDR lpWaveHdr, int uSize);

    [StructLayout(LayoutKind.Sequential)]
    private struct WAVEFORMATEX {
        public short wFormatTag;
        public short nChannels;
        public int nSamplesPerSec;
        public int nAvgBytesPerSec;
        public short nBlockAlign;
        public short wBitsPerSample;
        public short cbSize;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct WAVEHDR {
        public IntPtr lpData;
        public int dwBufferLength;
        public int dwBytesRecorded;
        public IntPtr dwUser;
        public int dwFlags;
        public int dwLoops;
        public IntPtr lpNext;
        public IntPtr reserved;
    }

    public static void Record(string outputPath) {
        IntPtr hWaveIn = IntPtr.Zero;
        int sampleRate = 16000;
        short channels = 1;
        short bitsPerSample = 16;
        int bufferSize = sampleRate * channels * (bitsPerSample / 8); // 1 second buffer

        var format = new WAVEFORMATEX();
        format.wFormatTag = 1; // PCM
        format.nChannels = channels;
        format.nSamplesPerSec = sampleRate;
        format.wBitsPerSample = bitsPerSample;
        format.nBlockAlign = (short)(channels * bitsPerSample / 8);
        format.nAvgBytesPerSec = sampleRate * format.nBlockAlign;
        format.cbSize = 0;

        int result = waveInOpen(ref hWaveIn, -1, ref format, IntPtr.Zero, IntPtr.Zero, 0);
        if (result != 0) { Console.Error.WriteLine("ERROR: waveInOpen failed"); return; }

        using (var fs = new FileStream(outputPath, FileMode.Create))
        using (var bw = new BinaryWriter(fs)) {
            // Write WAV header placeholder
            bw.Write(new byte[44]);
            long dataStart = fs.Position;

            Console.Error.WriteLine("RECORDING");
            Console.Error.Flush();

            bool running = true;
            Console.CancelKeyPress += (s, e) => { e.Cancel = true; running = false; };

            var bufferPtr = Marshal.AllocHGlobal(bufferSize);
            var header = new WAVEHDR();
            header.lpData = bufferPtr;
            header.dwBufferLength = bufferSize;
            waveInPrepareHeader(hWaveIn, ref header, Marshal.SizeOf(typeof(WAVEHDR)));
            waveInAddBuffer(hWaveIn, ref header, Marshal.SizeOf(typeof(WAVEHDR)));
            waveInStart(hWaveIn);

            while (running) {
                Thread.Sleep(100);
                if ((header.dwFlags & 1) != 0) { // WHDR_DONE
                    if (header.dwBytesRecorded > 0) {
                        byte[] data = new byte[header.dwBytesRecorded];
                        Marshal.Copy(header.lpData, data, 0, header.dwBytesRecorded);
                        bw.Write(data);
                    }
                    header.dwFlags = 0;
                    header.dwBytesRecorded = 0;
                    waveInPrepareHeader(hWaveIn, ref header, Marshal.SizeOf(typeof(WAVEHDR)));
                    waveInAddBuffer(hWaveIn, ref header, Marshal.SizeOf(typeof(WAVEHDR)));
                }
            }

            waveInStop(hWaveIn);
            waveInReset(hWaveIn);
            Thread.Sleep(200);

            // Flush remaining data
            if (header.dwBytesRecorded > 0) {
                byte[] data = new byte[header.dwBytesRecorded];
                Marshal.Copy(header.lpData, data, 0, header.dwBytesRecorded);
                bw.Write(data);
            }

            waveInUnprepareHeader(hWaveIn, ref header, Marshal.SizeOf(typeof(WAVEHDR)));
            Marshal.FreeHGlobal(bufferPtr);
            waveInClose(hWaveIn);

            // Write WAV header
            long dataSize = fs.Position - dataStart;
            fs.Seek(0, SeekOrigin.Begin);
            bw.Write(System.Text.Encoding.ASCII.GetBytes("RIFF"));
            bw.Write((int)(dataSize + 36));
            bw.Write(System.Text.Encoding.ASCII.GetBytes("WAVE"));
            bw.Write(System.Text.Encoding.ASCII.GetBytes("fmt "));
            bw.Write(16);
            bw.Write((short)1);
            bw.Write(channels);
            bw.Write(sampleRate);
            bw.Write(sampleRate * channels * bitsPerSample / 8);
            bw.Write((short)(channels * bitsPerSample / 8));
            bw.Write(bitsPerSample);
            bw.Write(System.Text.Encoding.ASCII.GetBytes("data"));
            bw.Write((int)dataSize);
        }
    }
}
"@
[WavRecorder]::Record("${tempPath.replace(/\\/g, '\\\\')}")
`

  const psScriptPath = path.join(app.getPath('temp'), 'diktuvai_record.ps1')
  fs.writeFileSync(psScriptPath, psScript)

  recordingProcess = spawn('powershell', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psScriptPath
  ], {
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: false
  })

  recordingProcess.stderr?.on('data', (data: Buffer) => {
    const msg = data.toString().trim()
    if (msg) log(`ps-recorder: ${msg}`)
  })

  recordingProcess.on('error', (err: Error) => {
    log(`PowerShell recorder error: ${err.message}`)
    recordingProcess = null
  })
}

/**
 * Stop recording and return the audio buffer + file path.
 */
export async function stopRecording(): Promise<AudioRecordingResult | null> {
  if (!recordingProcess) return null

  const durationMs = Date.now() - recordingStartTime
  const filePath = currentTempPath
  const proc = recordingProcess

  return new Promise((resolve) => {
    let resolved = false
    const finish = () => {
      if (resolved) return
      resolved = true
      recordingProcess = null

      // Wait for file to be written and finalized
      let attempts = 0
      const checkFile = () => {
        attempts++
        try {
          if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath)
            if (stats.size > 100) {
              const buffer = fs.readFileSync(filePath)
              resolve({ buffer, durationMs, filePath })
              return
            }
          }
        } catch { /* ignore */ }

        if (attempts < 10) {
          setTimeout(checkFile, 200)
        } else {
          resolve(null)
        }
      }
      // Give initial delay for file flush
      setTimeout(checkFile, 500)
    }

    proc.on('close', finish)
    proc.on('exit', finish)

    // Send appropriate signal to stop recording
    if (isWin) {
      // On Windows, SIGINT doesn't work well; use taskkill for graceful stop
      try {
        if (proc.pid) {
          exec(`taskkill /pid ${proc.pid} /t`, () => {})
        }
      } catch { /* ignore */ }
      // Also try SIGTERM
      try { proc.kill('SIGTERM') } catch { /* ignore */ }
    } else {
      // Send SIGINT to gracefully stop
      proc.kill('SIGINT')
    }

    // Force kill after 3 seconds
    setTimeout(() => {
      if (!resolved) {
        try { proc.kill('SIGKILL') } catch { /* ignore */ }
        finish()
      }
    }, 3000)
  })
}

/**
 * Cancel recording without saving.
 */
export function cancelRecording(): void {
  if (recordingProcess) {
    if (isWin) {
      try {
        if (recordingProcess.pid) {
          exec(`taskkill /pid ${recordingProcess.pid} /t /f`, () => {})
        }
      } catch { /* ignore */ }
    }
    recordingProcess.kill('SIGKILL')
    recordingProcess = null
  }
  cleanupTempFiles()
}

/**
 * Check if recording tools are available.
 */
export async function checkRecordingTools(): Promise<{ sox: boolean; ffmpeg: boolean; swift: boolean }> {
  let sox = false
  let ffmpeg = false
  let swift = false

  const whichCmd = isWin ? 'where' : 'which'

  try { await execAsync(`${whichCmd} rec`); sox = true } catch { /* not found */ }
  try { await execAsync(`${whichCmd} ffmpeg`); ffmpeg = true } catch { /* not found */ }

  if (isMac) {
    try { await execAsync('which swift'); swift = true } catch { /* not found */ }
  }

  return { sox, ffmpeg, swift }
}

/**
 * Get available audio input devices.
 */
export async function getAudioDevices(): Promise<string[]> {
  try {
    if (isMac) {
      // Use system_profiler to list audio devices
      const { stdout } = await execAsync('system_profiler SPAudioDataType 2>/dev/null')
      const devices: string[] = ['default']
      const matches = stdout.matchAll(/Input Source:\s*(.+)/g)
      for (const match of matches) {
        if (match[1]) devices.push(match[1].trim())
      }
      return devices.length > 1 ? devices : ['default']
    } else if (isWin) {
      // Use ffmpeg to list DirectShow devices
      try {
        const { stderr } = await execAsync('ffmpeg -list_devices true -f dshow -i dummy 2>&1', {
          timeout: 5000
        }).catch(e => ({ stdout: '', stderr: e.stderr || '' }))
        const devices: string[] = ['default']
        const audioSection = stderr.split('DirectShow audio devices')[1] || ''
        const matches = audioSection.matchAll(/"([^"]+)"/g)
        for (const match of matches) {
          if (match[1] && !match[1].includes('Alternative name')) {
            devices.push(match[1].trim())
          }
        }
        return devices.length > 1 ? devices : ['default']
      } catch {
        return ['default']
      }
    }
    return ['default']
  } catch {
    return ['default']
  }
}

/**
 * Clean up temporary recording files.
 */
export function cleanupTempFiles(): void {
  try {
    const tempDir = app.getPath('temp')
    const files = fs.readdirSync(tempDir).filter(f =>
      f.startsWith('diktuvai_recording_') ||
      f === 'diktuvai_recorder.swift' ||
      f === 'diktuvai_paste.scpt' ||
      f === 'diktuvai_record.ps1'
    )
    for (const file of files) {
      try { fs.unlinkSync(path.join(tempDir, file)) } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
}

export function createAudioStream(filePath: string): fs.ReadStream {
  return fs.createReadStream(filePath)
}

export function isRecording(): boolean {
  return recordingProcess !== null
}

/**
 * Get the current real audio level (0-1) from the recording process.
 * Returns 0 if not recording or if the recorder doesn't support levels.
 */
export function getAudioLevel(): number {
  return recordingProcess ? currentAudioLevel : 0
}
