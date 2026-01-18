type SoundType = 'default' | 'success' | 'warning' | 'error' | 'message' | 'deadline'

class SoundManager {
  private audioContext: AudioContext | null = null
  private enabled = true

  constructor() {
    if (typeof window !== 'undefined' && 'AudioContext' in window) {
      this.audioContext = new AudioContext()
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
  }

  private async playTone(
    frequency: number,
    duration: number,
    volume: number = 0.3,
    type: OscillatorType = 'sine'
  ) {
    if (!this.enabled || !this.audioContext) return

    try {
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }

      const oscillator = this.audioContext.createOscillator()
      const gainNode = this.audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(this.audioContext.destination)

      oscillator.frequency.value = frequency
      oscillator.type = type

      gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + duration
      )

      oscillator.start(this.audioContext.currentTime)
      oscillator.stop(this.audioContext.currentTime + duration)
    } catch (error) {
      console.error('Error playing sound:', error)
    }
  }

  async playNotificationSound(type: SoundType = 'default') {
    switch (type) {
      case 'success':
        await this.playSuccessSound()
        break
      case 'warning':
        await this.playWarningSound()
        break
      case 'error':
        await this.playErrorSound()
        break
      case 'message':
        await this.playMessageSound()
        break
      case 'deadline':
        await this.playDeadlineSound()
        break
      default:
        await this.playDefaultSound()
    }
  }

  private async playDefaultSound() {
    await this.playTone(800, 0.1, 0.2)
    await new Promise((resolve) => setTimeout(resolve, 50))
    await this.playTone(1000, 0.15, 0.2)
  }

  private async playSuccessSound() {
    await this.playTone(523.25, 0.1, 0.2)
    await new Promise((resolve) => setTimeout(resolve, 30))
    await this.playTone(659.25, 0.1, 0.2)
    await new Promise((resolve) => setTimeout(resolve, 30))
    await this.playTone(783.99, 0.2, 0.2)
  }

  private async playWarningSound() {
    await this.playTone(880, 0.15, 0.25, 'square')
    await new Promise((resolve) => setTimeout(resolve, 50))
    await this.playTone(880, 0.15, 0.25, 'square')
  }

  private async playErrorSound() {
    await this.playTone(400, 0.2, 0.3, 'sawtooth')
    await new Promise((resolve) => setTimeout(resolve, 30))
    await this.playTone(300, 0.3, 0.3, 'sawtooth')
  }

  private async playMessageSound() {
    await this.playTone(600, 0.08, 0.15)
    await new Promise((resolve) => setTimeout(resolve, 40))
    await this.playTone(900, 0.12, 0.15)
  }

  private async playDeadlineSound() {
    await this.playTone(1000, 0.15, 0.35, 'triangle')
    await new Promise((resolve) => setTimeout(resolve, 100))
    await this.playTone(800, 0.15, 0.35, 'triangle')
    await new Promise((resolve) => setTimeout(resolve, 100))
    await this.playTone(1000, 0.2, 0.35, 'triangle')
  }
}

export const soundManager = new SoundManager()

export const playNotificationSound = (type: SoundType = 'default') => {
  return soundManager.playNotificationSound(type)
}

export const setSoundEnabled = (enabled: boolean) => {
  soundManager.setEnabled(enabled)
}
