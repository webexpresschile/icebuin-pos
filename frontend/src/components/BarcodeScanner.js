import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Camera, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function BarcodeScanner({ onScan, onClose }) {
  const videoRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState(null);
  const codeReaderRef = useRef(null);
  const streamRef = useRef(null);

  const checkCameraPermissions = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Tu navegador no soporta acceso a la cámara');
      }
      return true;
    } catch (err) {
      return false;
    }
  };

  const requestCameraAccess = async () => {
    try {
      // Request camera access with specific constraints for mobile
      const constraints = {
        video: {
          facingMode: { ideal: 'environment' }, // Back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Stop the stream immediately (we just wanted permission)
      stream.getTracks().forEach(track => track.stop());
      
      return true;
    } catch (err) {
      console.error('Camera access error:', err);
      return false;
    }
  };

  const startScanning = async () => {
    try {
      setIsScanning(false);
      setError(null);

      // Check if camera is supported
      const supported = await checkCameraPermissions();
      if (!supported) {
        setError('Tu navegador no soporta acceso a la cámara. Prueba con Chrome o Safari.');
        return;
      }

      // Request camera access first
      const hasAccess = await requestCameraAccess();
      if (!hasAccess) {
        setError('No se pudo acceder a la cámara. Verifica los permisos en la configuración del navegador.');
        return;
      }

      setIsScanning(true);
      const codeReader = new BrowserMultiFormatReader();
      codeReaderRef.current = codeReader;

      const videoInputDevices = await codeReader.listVideoInputDevices();
      
      if (videoInputDevices.length === 0) {
        setError('No se encontró ninguna cámara en tu dispositivo');
        setIsScanning(false);
        return;
      }

      // Prefer back camera on mobile
      const selectedDevice = videoInputDevices.find(device => 
        device.label.toLowerCase().includes('back') || 
        device.label.toLowerCase().includes('trasera') ||
        device.label.toLowerCase().includes('rear') ||
        device.label.toLowerCase().includes('environment')
      ) || videoInputDevices[0];

      console.log('Using camera:', selectedDevice.label);

      const controls = await codeReader.decodeFromVideoDevice(
        selectedDevice.deviceId,
        videoRef.current,
        (result, error) => {
          if (result) {
            const barcode = result.getText();
            toast.success(`Código escaneado: ${barcode}`);
            onScan(barcode);
            stopScanning();
            onClose();
          }
        }
      );
      
      streamRef.current = controls;
    } catch (error) {
      console.error('Error starting scanner:', error);
      let errorMessage = 'Error al iniciar la cámara.';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Permiso de cámara denegado. Ve a la configuración del navegador y permite el acceso.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No se encontró ninguna cámara en el dispositivo.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'La cámara está siendo usada por otra aplicación.';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = 'No se pudo configurar la cámara con los ajustes solicitados.';
      }
      
      setError(errorMessage);
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    try {
      // Stop the video stream
      if (streamRef.current) {
        streamRef.current.stop();
        streamRef.current = null;
      }
      
      // Stop video element
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    } catch (error) {
      console.error('Error stopping scanner:', error);
    }
    setIsScanning(false);
  };

  const handleClose = () => {
    stopScanning();
    onClose();
  };

  useEffect(() => {
    startScanning();
    return () => {
      stopScanning();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4" data-testid="barcode-scanner-modal">
      <Card className="w-full max-w-2xl">
        <CardContent className="p-4">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-green-800 flex items-center gap-2">
                <Camera className="w-5 h-5" />
                Escáner de Código de Barras
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClose} data-testid="close-scanner-button">
                <X className="w-5 h-5" />
              </Button>
            </div>

            {error ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-800 mb-2">{error}</p>
                    <div className="text-xs text-red-700 space-y-1">
                      <p className="font-medium">Para permitir el acceso a la cámara:</p>
                      <p>📱 <strong>Chrome Android:</strong> Toca el candado → Permisos → Cámara → Permitir</p>
                      <p>🍎 <strong>Safari iOS:</strong> Ajustes → Safari → Cámara → Permitir</p>
                      <p>💻 <strong>Chrome Desktop:</strong> Clic en el candado → Configuración del sitio → Cámara → Permitir</p>
                    </div>
                    <Button 
                      onClick={startScanning} 
                      className="mt-3 w-full btn-primary"
                      data-testid="retry-camera-button"
                    >
                      Intentar de Nuevo
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    playsInline
                    autoPlay
                    muted
                    data-testid="scanner-video"
                  />
                  {!isScanning && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-70 gap-3 p-4">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-400"></div>
                      <p className="text-white text-center text-sm font-medium">Solicitando acceso a la cámara...</p>
                      <p className="text-gray-300 text-center text-xs">
                        Toca "Permitir" cuando tu navegador lo solicite
                      </p>
                    </div>
                  )}
                  {isScanning && (
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute inset-0 border-2 border-green-500 m-8 rounded-lg">
                        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-400 rounded-tl-lg"></div>
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-400 rounded-tr-lg"></div>
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-400 rounded-bl-lg"></div>
                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-400 rounded-br-lg"></div>
                      </div>
                      <div className="absolute bottom-4 left-0 right-0 text-center">
                        <p className="text-white text-sm font-medium bg-black bg-opacity-50 inline-block px-4 py-2 rounded-full">
                          Apunta al código de barras
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {!error && (
                  <div className="text-xs text-center text-green-600 space-y-1">
                    <p className="font-medium">💡 Consejos:</p>
                    <p>• Mantén el código de barras dentro del marco verde</p>
                    <p>• Asegúrate de tener buena iluminación</p>
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
