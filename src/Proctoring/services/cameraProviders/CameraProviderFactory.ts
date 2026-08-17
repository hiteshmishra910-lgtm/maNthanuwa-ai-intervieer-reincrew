import { CameraProvider, ProctoringConfiguration } from '../../../../types';
import { LocalCameraProvider } from './LocalCameraProvider';
import { PhoneCameraProvider } from './PhoneCameraProvider';

export class CameraProviderFactory {
  /**
   * Returns the primary CameraProvider instance based on the configuration.
   */
  static createPrimary(sessionId: string, config: ProctoringConfiguration): CameraProvider | null {
    if (!config.enabled) return null;

    switch (config.camera.mode) {
      case 'phone':
        return new PhoneCameraProvider(sessionId);
      case 'webcam':
      case 'auto':
      default:
        return new LocalCameraProvider();
    }
  }

  /**
   * Returns the fallback CameraProvider instance if the primary provider fails.
   */
  static createFallback(sessionId: string, config: ProctoringConfiguration): CameraProvider | null {
    if (!config.enabled) return null;

    switch (config.camera.mode) {
      case 'auto':
        return new PhoneCameraProvider(sessionId);
      case 'webcam':
      case 'phone':
      default:
        // No fallback for explicit modes
        return null;
    }
  }
}
export default CameraProviderFactory;
