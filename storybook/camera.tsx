// Storybook's stand-in for expo-camera. Stories set `camera` before opening the scanner: the
// permission state and the answer to a request, as iOS gives them, and the codes the "camera"
// reports on mounting and on every re-render, as a real camera repeats a held barcode.
import { useCallback, useEffect, useState } from 'react';
import { View, type ViewProps } from 'react-native';

type Status = 'undetermined' | 'granted' | 'denied';
export const camera = { status: 'undetermined' as Status, answer: 'granted' as Status, requests: 0, scans: [] as string[] };

// iOS asks once; after a denial only Settings can grant access.
const permission = (status: Status) => ({ status, granted: status === 'granted', canAskAgain: status === 'undetermined', expires: 'never' });

export function useCameraPermissions() {
  const [state, setState] = useState(() => permission(camera.status));
  const request = useCallback(async () => {
    camera.requests++;
    camera.status = camera.answer;
    const next = permission(camera.status);
    setState(next);
    return next;
  }, []);
  return [state, request] as const;
}

export function CameraView({ onBarcodeScanned, style }: ViewProps & { onBarcodeScanned?: (scan: { data: string }) => void }) {
  useEffect(() => {
    for (const data of camera.scans) onBarcodeScanned?.({ data });
  }, [onBarcodeScanned]);
  return <View style={style} />;
}
