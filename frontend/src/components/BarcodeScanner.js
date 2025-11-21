import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Camera, X } from 'lucide-react';
import { toast } from 'sonner';

export default function BarcodeScanner({ onScan, onClose }) {
  const videoRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const codeReaderRef = useRef(null);
  const streamRef = useRef(null);

  const startScanning = async () => {
    try {
      setIsScanning(true);
      const codeReader = new BrowserMultiFormatReader();
      codeReaderRef.current = codeReader;

      const videoInputDevices = await codeReader.listVideoInputDevices();
      
      if (videoInputDevices.length === 0) {
        toast.error('No se encontró ninguna cámara');
        setIsScanning(false);
        return;
      }

      // Prefer back camera on mobile
      const selectedDevice = videoInputDevices.find(device => 
        device.label.toLowerCase().includes('back') || 
        device.label.toLowerCase().includes('trasera')
      ) || videoInputDevices[0];

      const controls = await codeReader.decodeFromVideoDevice(
        selectedDevice.deviceId,
        videoRef.current,
        (result, error) => {
          if (result) {
            const barcode = result.getText();
            toast.success(`Código escaneado: ${barcode}`);
            onScan(barcode);
            stopScanning();
          }
        }
      );
      
      streamRef.current = controls;
    } catch (error) {
      console.error('Error starting scanner:', error);
      toast.error('Error al iniciar la cámara. Verifica los permisos.');
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

            <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                data-testid="scanner-video"
              />
              {!isScanning && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                  <p className="text-white">Iniciando cámara...</p>
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
                </div>
              )}
            </div>

            <p className="text-sm text-center text-green-600">
              Apunta la cámara al código de barras
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
